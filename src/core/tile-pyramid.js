// Geometry of the pictures a pattern layer draws from: detail levels, tiles and where they go
// on screen. Pure: no DOM, no canvas. The authoritative description is
// openspec/specs/large-pattern-rendering/spec.md; the numbers are justified in the design of
// the change tile-large-pattern-rendering (D1-D3, D9).
//
// Detail level k (k = 0, 1, 2, ...) is a picture of the pattern in which one pixel stands for
// a block of 2^k × 2^k stitches: level-k pixel (i, j) covers stitch columns i·2^k … (i+1)·2^k − 1
// and rows j·2^k … (j+1)·2^k − 1 (blocks at the right and bottom edges may be partial).
//
// Shared input:
//   grid  { width, height }: stitches per row and number of rows, positive integers
//         (a Pattern from ./pattern.js works as it is).
//
// Shapes created here:
//   LevelSize    { width, height } from levelSize: the level-k picture in picture px,
//                ceil(W / 2^k) × ceil(H / 2^k).
//   TileRegion   { x, y, width, height } from tileRegion: a tile's place in its level
//                picture, picture px; the overview's region is its whole picture.
//   CellRect     { x, y, width, height } from regionCells: stitches, clipped to the grid.
//   TileAddress  { column, row } from visibleTiles.
//   DrawRects    { source, destination } from pictureDrawRects (see there).

/**
 * Patterns with both sides up to this many stitches are drawn from one level-0 picture.
 * 2048 × 2048 px = 16 MiB, a quarter of the iOS Safari canvas limit (16,777,216 px), so no
 * picture ever comes close to that limit. Also the largest side of an overview picture.
 */
export const SINGLE_PICTURE_MAX_SIDE = 2048;

/** Side of a tile in picture px: 512 × 512 × 4 bytes = 1 MiB (design D2). */
export const TILE_SIZE = 512;

/**
 * Returns the overview level M of a grid: the smallest level whose picture is at most
 * maxSide px on each side. 0 means the pattern fits into one level-0 picture.
 * grid     { width, height } in stitches, positive integers
 * maxSide  largest picture side in px (default SINGLE_PICTURE_MAX_SIDE; tests pass less)
 * Throws RangeError if a grid side or maxSide is not a positive integer.
 */
export function overviewLevel(grid, maxSide = SINGLE_PICTURE_MAX_SIDE) {
  assertGridSize(grid);
  assertPositiveInteger('maxSide', maxSide);
  let level = 0;
  while (Math.ceil(grid.width / 2 ** level) > maxSide || Math.ceil(grid.height / 2 ** level) > maxSide) {
    level += 1;
  }
  return level;
}

/**
 * Returns the LevelSize of level `level` of a grid: ceil(W / 2^level) × ceil(H / 2^level).
 * Throws RangeError if a grid side is not a positive integer or level is not an integer ≥ 0.
 */
export function levelSize(grid, level) {
  assertGridSize(grid);
  assertLevel(level);
  const blockSide = 2 ** level;
  return { width: Math.ceil(grid.width / blockSide), height: Math.ceil(grid.height / blockSide) };
}

/**
 * Returns how many tiles level `level` of a grid is cut into: { columns, rows }, each
 * ceil(level side / tileSize).
 * tileSize  tile side in picture px (default TILE_SIZE; tests pass less)
 * Throws RangeError for an invalid grid, level or tileSize.
 */
export function tileCount(grid, level, tileSize = TILE_SIZE) {
  assertPositiveInteger('tileSize', tileSize);
  const size = levelSize(grid, level);
  return { columns: Math.ceil(size.width / tileSize), rows: Math.ceil(size.height / tileSize) };
}

/**
 * Returns the TileRegion of tile (column, row) of level `level`:
 * { x, y, width, height } in picture px of that level, x = column × tileSize, y = row ×
 * tileSize, width and height up to tileSize, clipped to the level size.
 * Throws RangeError if column or row is not a tile index of the level.
 */
export function tileRegion(grid, level, column, row, tileSize = TILE_SIZE) {
  const size = levelSize(grid, level);
  const count = tileCount(grid, level, tileSize);
  assertIndex('column', column, count.columns);
  assertIndex('row', row, count.rows);
  const x = column * tileSize;
  const y = row * tileSize;
  return { x, y, width: Math.min(tileSize, size.width - x), height: Math.min(tileSize, size.height - y) };
}

/**
 * Returns the CellRect a region of level `level` covers: { x, y, width, height } in
 * stitches, clipped to the grid (so a level's last pixel may cover fewer than 2^level stitches).
 * region  { x, y, width, height } in picture px of that level, integers
 */
export function regionCells(grid, level, region) {
  assertGridSize(grid);
  assertLevel(level);
  const blockSide = 2 ** level;
  const x = region.x * blockSide;
  const y = region.y * blockSide;
  return {
    x,
    y,
    width: Math.min(grid.width, (region.x + region.width) * blockSide) - x,
    height: Math.min(grid.height, (region.y + region.height) * blockSide) - y,
  };
}

/**
 * Returns the detail level to draw: round(log2(1 / devicePxPerStitch)) limited to
 * 0 … maxLevel. One level pixel then covers about 0.71 to 1.41 device px, so the browser
 * scales a picture by at most √2 either way and the visible picture has at most twice the
 * frame's device pixels (the GPU "nearest mip level" rule, design D3).
 * devicePxPerStitch  the smaller on-screen side of a stitch in device px (> 0)
 * maxLevel           the overview level (from overviewLevel), integer ≥ 0
 * Throws RangeError if devicePxPerStitch is not a positive number or maxLevel is invalid.
 */
export function detailLevel(devicePxPerStitch, maxLevel) {
  if (!Number.isFinite(devicePxPerStitch) || devicePxPerStitch <= 0) {
    throw new RangeError(`devicePxPerStitch must be a positive number, got ${String(devicePxPerStitch)}`);
  }
  assertLevel(maxLevel);
  const ideal = Math.round(Math.log2(1 / devicePxPerStitch));
  return Math.min(maxLevel, Math.max(0, ideal));
}

/**
 * Returns the tiles of level `level` that contain a visible stitch, as a list of
 * { column, row } in row-major order (TileAddress). Empty for an empty range.
 * range     CellRange { columnStart, columnEnd, rowStart, rowEnd } from visibleCellRange
 *           (./chart-layout.js): half-open stitch ranges clamped to the grid
 * tileSize  tile side in picture px (default TILE_SIZE)
 */
export function visibleTiles(grid, level, range, tileSize = TILE_SIZE) {
  assertGridSize(grid);
  assertLevel(level);
  assertPositiveInteger('tileSize', tileSize);
  if (range.columnStart >= range.columnEnd || range.rowStart >= range.rowEnd) {
    return [];
  }
  const tileStitches = tileSize * 2 ** level;
  const firstColumn = Math.floor(range.columnStart / tileStitches);
  const lastColumn = Math.floor((range.columnEnd - 1) / tileStitches);
  const firstRow = Math.floor(range.rowStart / tileStitches);
  const lastRow = Math.floor((range.rowEnd - 1) / tileStitches);
  const tiles = [];
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      tiles.push({ column, row });
    }
  }
  return tiles;
}

/**
 * Returns the DrawRects for drawing the stitches `cellRect` from a picture of level `level`
 * whose top-left is at `region` (a tile, or the whole overview/single picture):
 *   source       { x, y, width, height } in picture px relative to the picture's top-left:
 *                cellRect / 2^level − region origin. Fractional only where the last picture
 *                pixel covers fewer than 2^level stitches, so that partial pixel is trimmed
 *                and nothing is drawn outside the content rectangle.
 *   destination  { x, y, width, height } in CSS px: where those stitches lie in `content`.
 *                Edges on the content rectangle's outer border keep their exact position;
 *                every other edge is rounded to the nearest device pixel, so neighbouring
 *                tiles meet on the same device pixel edge and canvas anti-aliasing leaves no
 *                seam between them (design D9).
 * content     { x, y, width, height } the content rectangle, CSS px
 * region      TileRegion of the picture, picture px of that level
 * cellRect    CellRect { x, y, width, height } in stitches, inside the region's stitches
 * pixelRatio  device px per CSS px (> 0)
 */
export function pictureDrawRects(content, grid, level, region, cellRect, pixelRatio) {
  assertGridSize(grid);
  assertLevel(level);
  if (!Number.isFinite(pixelRatio) || pixelRatio <= 0) {
    throw new RangeError(`pixelRatio must be a positive number, got ${String(pixelRatio)}`);
  }
  const blockSide = 2 ** level;
  const xAt = (stitch) => snappedEdge(stitch, grid.width, content.x, content.width, pixelRatio);
  const yAt = (stitch) => snappedEdge(stitch, grid.height, content.y, content.height, pixelRatio);
  const left = xAt(cellRect.x);
  const top = yAt(cellRect.y);
  return {
    source: {
      x: cellRect.x / blockSide - region.x,
      y: cellRect.y / blockSide - region.y,
      width: cellRect.width / blockSide,
      height: cellRect.height / blockSide,
    },
    destination: {
      x: left,
      y: top,
      width: xAt(cellRect.x + cellRect.width) - left,
      height: yAt(cellRect.y + cellRect.height) - top,
    },
  };
}

// The screen position of stitch boundary `index` (0 … count) along one axis: exact on the
// content border, otherwise rounded to the nearest device pixel.
function snappedEdge(index, count, contentStart, contentLength, pixelRatio) {
  if (index === 0) {
    return contentStart;
  }
  if (index === count) {
    return contentStart + contentLength;
  }
  const exact = contentStart + (index * contentLength) / count;
  return Math.round(exact * pixelRatio) / pixelRatio;
}

function assertIndex(name, value, count) {
  if (!Number.isInteger(value) || value < 0 || value >= count) {
    throw new RangeError(`tile ${name} must be an integer 0–${count - 1}, got ${String(value)}`);
  }
}

function assertGridSize(grid) {
  assertPositiveInteger('grid.width', grid.width);
  assertPositiveInteger('grid.height', grid.height);
}

function assertLevel(level) {
  if (!Number.isInteger(level) || level < 0) {
    throw new RangeError(`level must be an integer ≥ 0, got ${String(level)}`);
  }
}

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer, got ${String(value)}`);
  }
}
