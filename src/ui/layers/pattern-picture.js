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

import { overviewLevel, levelSize, regionCells, pictureDrawRects, SINGLE_PICTURE_MAX_SIDE, TILE_SIZE } from '../../core/tile-pyramid.js';
import { fillLevelRows } from '../../core/level-pixels.js';
import { buildPlan, BUILD_BUDGET_STITCHES, TILE_CACHE_BUDGET_BYTES } from '../../core/tile-budget.js';

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
      };
    }
    return current;
  }

  function draw(ctx, frame, pattern, range) {
    const pictures = picturesOf(pattern);
    if (range.columnStart >= range.columnEnd || range.rowStart >= range.rowEnd) {
      return true;
    }
    const overview = overviewTarget(pattern, pictures.maxLevel);
    runBuildPlan(pictures, [overview], limits.buildBudgetStitches, createCellCanvas);
    drawPart(ctx, frame, pattern, pictures.built.get(OVERVIEW_KEY), rangeCells(range));
    return isComplete(pictures, OVERVIEW_KEY);
  }

  return { draw };
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
