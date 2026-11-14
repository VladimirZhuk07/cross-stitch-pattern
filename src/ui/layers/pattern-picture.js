// The picture of a pattern that the DMC colors and Chart layers draw their cell colors from.
// Behavior: openspec/specs/large-pattern-rendering/spec.md; numbers and choices: design of the
// change tile-large-pattern-rendering. Geometry, pixels and budgets are pure core functions;
// this module owns the canvases and runs the per-frame build plan.
//
// A pattern of at most SINGLE_PICTURE_MAX_SIDE stitches per side has one level-0 picture.
// A larger one has an overview (level M) and, below it, tiles of the detail level chosen from
// the zoom. Every picture is built row by row: each frame reads at most buildBudgetStitches
// stitches, and each new band of rows is uploaded with putImageData, so pictures appear
// progressively and draw() reports whether everything visible is complete.

import {
  overviewLevel,
  levelSize,
  tileRegion,
  regionCells,
  detailLevel,
  visibleTiles,
  pictureDrawRects,
  SINGLE_PICTURE_MAX_SIDE,
  TILE_SIZE,
} from '../../core/tile-pyramid.js';
import { fillLevelRows } from '../../core/level-pixels.js';
import { buildPlan, tilesToEvict, BUILD_BUDGET_STITCHES, TILE_CACHE_BUDGET_BYTES } from '../../core/tile-budget.js';

const BYTES_PER_PIXEL = 4;
const OVERVIEW_KEY = 'overview';

const DEFAULT_LIMITS = Object.freeze({
  singlePictureMaxSide: SINGLE_PICTURE_MAX_SIDE,
  tileSize: TILE_SIZE,
  cacheBudgetBytes: TILE_CACHE_BUDGET_BYTES,
  buildBudgetStitches: BUILD_BUDGET_STITCHES,
});

/**
 * Creates the picture cache of one layer.
 * options.createCellCanvas(width, height)  makes a canvas with a 2D context
 *                                          (createImageData, putImageData); e.g. OffscreenCanvas
 * options.colorTableOf(pattern)            the ColorTable (../../core/level-pixels.js) of a pattern
 * options.limits                           optional { singlePictureMaxSide, tileSize,
 *                                          cacheBudgetBytes, buildBudgetStitches }; defaults are
 *                                          the core constants; tests pass smaller values
 * Returns { draw(ctx, frame, pattern, range) }: builds what the frame needs within the frame's
 * budget, draws the cell colors of the visible stitches `range` (a CellRange) into
 * frame.content with the context's current smoothing, and returns true when every picture it
 * needs is complete (false = call again next frame). Pictures are kept per pattern identity;
 * a new pattern releases all canvases of the old one.
 */
export function createPatternPicture(options) {
  const { createCellCanvas, colorTableOf } = options;
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  let current = null;

  function picturesOf(pattern) {
    if (current === null || current.pattern !== pattern) {
      if (current !== null) {
        releaseAll(current);
      }
      current = {
        pattern,
        table: colorTableOf(pattern),
        maxLevel: overviewLevel(pattern, limits.singlePictureMaxSide),
        built: new Map(),
        frameNumber: 0,
      };
    }
    return current;
  }

  function draw(ctx, frame, pattern, range) {
    const pictures = picturesOf(pattern);
    if (range.columnStart >= range.columnEnd || range.rowStart >= range.rowEnd) {
      return true;
    }
    pictures.frameNumber += 1;
    const level = detailLevel(devicePxPerStitch(frame, pattern), pictures.maxLevel);
    const tiles = level === pictures.maxLevel ? [] : visibleTileTargets(pattern, level, range, limits.tileSize);
    // Visible tiles first, then the overview: it is what pending tiles show meanwhile.
    runBuildPlan(pictures, [...tiles, overviewTarget(pattern, pictures.maxLevel)], limits.buildBudgetStitches, createCellCanvas);

    const overview = pictures.built.get(OVERVIEW_KEY);
    if (tiles.length === 0) {
      drawPart(ctx, frame, pattern, overview, rangeCells(range));
    }
    for (const tile of tiles) {
      const picture = pictures.built.get(tile.key);
      const cells = regionCells(pattern, tile.level, tile.region);
      if (picture !== undefined && picture.image === null) {
        drawPart(ctx, frame, pattern, picture, cells);
        picture.lastDrawn = pictures.frameNumber;
      } else {
        drawPart(ctx, frame, pattern, overview, cells);
      }
    }
    releaseUnneededTiles(pictures, tiles, limits.cacheBudgetBytes);
    return isComplete(pictures, OVERVIEW_KEY) && tiles.every((tile) => isComplete(pictures, tile.key));
  }

  return { draw };
}

// The smaller on-screen side of a stitch in device px.
function devicePxPerStitch(frame, pattern) {
  const { content, pixelRatio } = frame;
  return Math.min(content.width / pattern.width, content.height / pattern.height) * pixelRatio;
}

// The visible tiles of a level as pictures to build, keyed 'level:column:row'.
function visibleTileTargets(pattern, level, range, tileSize) {
  return visibleTiles(pattern, level, range, tileSize).map(({ column, row }) => ({
    key: `${level}:${column}:${row}`,
    level,
    region: tileRegion(pattern, level, column, row, tileSize),
  }));
}

// A picture to build: its key, level and TileRegion (../../core/tile-pyramid.js).
function overviewTarget(pattern, level) {
  const size = levelSize(pattern, level);
  return { key: OVERVIEW_KEY, level, region: { x: 0, y: 0, width: size.width, height: size.height } };
}

// Builds the rows that buildPlan grants to the incomplete targets, in their order.
function runBuildPlan(pictures, targets, budgetStitches, createCellCanvas) {
  const jobs = [];
  const targetsByKey = new Map();
  for (const target of targets) {
    const picture = pictures.built.get(target.key);
    const rowsDone = picture === undefined ? 0 : picture.rowsDone;
    if (rowsDone < target.region.height) {
      jobs.push({ key: target.key, stitchesPerRow: stitchesPerRow(pictures.pattern, target), rowsLeft: target.region.height - rowsDone });
      targetsByKey.set(target.key, target);
    }
  }
  for (const step of buildPlan(jobs, budgetStitches)) {
    let picture = pictures.built.get(step.key);
    if (picture === undefined) {
      picture = startPicture(targetsByKey.get(step.key), createCellCanvas);
      pictures.built.set(step.key, picture);
    }
    buildRows(pictures, picture, step.rows);
  }
}

// Stitches read per picture row: one block row of stitches across the picture's stitches.
function stitchesPerRow(pattern, target) {
  const cells = regionCells(pattern, target.level, target.region);
  return cells.width * Math.min(2 ** target.level, cells.height);
}

// A picture being built: canvas, the ImageData its rows are filled into (null once complete),
// rows built so far, memory held and the frame it was last drawn in.
function startPicture(target, createCellCanvas) {
  const { width, height } = target.region;
  const canvas = createCellCanvas(width, height);
  const context = canvas.getContext('2d');
  return {
    key: target.key,
    level: target.level,
    region: target.region,
    canvas,
    context,
    image: context.createImageData(width, height),
    rowsDone: 0,
    bytes: width * height * BYTES_PER_PIXEL,
    lastDrawn: 0,
  };
}

function buildRows(pictures, picture, rows) {
  const rowStart = picture.rowsDone;
  const rowEnd = rowStart + rows;
  fillLevelRows(pictures.pattern, pictures.table, picture.level, picture.region, rowStart, rowEnd, picture.image.data);
  picture.context.putImageData(picture.image, 0, 0, 0, rowStart, picture.region.width, rows);
  picture.rowsDone = rowEnd;
  if (rowEnd === picture.region.height) {
    picture.image = null; // complete: the canvas holds the pixels now
  }
}

// Draws the stitches cellRect from a (possibly partly built) picture; nothing if not started.
function drawPart(ctx, frame, pattern, picture, cellRect) {
  if (picture === undefined) {
    return;
  }
  const { source, destination } = pictureDrawRects(frame.content, pattern, picture.level, picture.region, cellRect, frame.pixelRatio);
  ctx.drawImage(
    picture.canvas,
    source.x,
    source.y,
    source.width,
    source.height,
    destination.x,
    destination.y,
    destination.width,
    destination.height,
  );
}

function isComplete(pictures, key) {
  const picture = pictures.built.get(key);
  return picture !== undefined && picture.image === null;
}

function rangeCells(range) {
  return {
    x: range.columnStart,
    y: range.rowStart,
    width: range.columnEnd - range.columnStart,
    height: range.rowEnd - range.rowStart,
  };
}

// After drawing: drops unfinished tiles that left the view, then releases complete tiles
// beyond the memory budget, least recently drawn first, never one visible in this frame.
function releaseUnneededTiles(pictures, visibleTargets, budgetBytes) {
  const visibleKeys = visibleTargets.map((target) => target.key);
  const isVisible = new Set(visibleKeys);
  const tiles = [];
  for (const picture of pictures.built.values()) {
    if (picture.key === OVERVIEW_KEY) {
      continue;
    }
    if (picture.image !== null && !isVisible.has(picture.key)) {
      release(pictures, picture.key);
      continue;
    }
    tiles.push(picture);
  }
  for (const key of tilesToEvict(tiles, budgetBytes, visibleKeys)) {
    release(pictures, key);
  }
}

function release(pictures, key) {
  releaseCanvas(pictures.built.get(key));
  pictures.built.delete(key);
}

function releaseAll(pictures) {
  for (const picture of pictures.built.values()) {
    releaseCanvas(picture);
  }
  pictures.built.clear();
}

// Shrinking a canvas to 0 × 0 frees its memory at once; WebKit would otherwise keep the
// backing store until garbage collection and count it against its canvas memory limit.
function releaseCanvas(picture) {
  picture.canvas.width = 0;
  picture.canvas.height = 0;
  picture.image = null;
}
