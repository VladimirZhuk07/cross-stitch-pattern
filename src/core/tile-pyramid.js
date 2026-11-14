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
//   LevelSize  { width, height } from levelSize: the level-k picture in picture px,
//              ceil(W / 2^k) × ceil(H / 2^k).

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
