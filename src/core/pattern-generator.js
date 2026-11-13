// The generation pipeline: image pixels + settings → Pattern.
// Steps: stitch grid size → area averaging in linear RGB (./stitch-grid.js) → empty cells by
// alpha → k-means in CIELAB (./kmeans.js) → nearest DMC floss per cluster by CIEDE2000
// (./dmc-match.js) → Pattern, merging clusters that land on the same DMC code (./pattern.js).
// The authoritative description is openspec/specs/pattern-generation/spec.md.

import { DMC_COLORS } from '../data/dmc.js';
import { linearRgbToLab } from './color.js';
import { nearestDmcColors, prepareLabPalette } from './dmc-match.js';
import { kMeansLab } from './kmeans.js';
import { EMPTY_CELL, MAX_PATTERN_COLORS, buildPattern } from './pattern.js';
import { EMPTY_ALPHA_THRESHOLD, MAX_GRID_SIDE, maxTargetWidth, resizeToGrid, stitchGridSize } from './stitch-grid.js';

// The full DMC palette with Lab values, prepared on first use and then reused.
let preparedDmcPalette = null;

function dmcPalette() {
  if (preparedDmcPalette === null) {
    preparedDmcPalette = prepareLabPalette(DMC_COLORS);
  }
  return preparedDmcPalette;
}

// Generates a cross-stitch pattern from an image.
// image     pixel image { width, height, pixels } as described at resizeToGrid in
//           ./stitch-grid.js (RGBA bytes, row-major).
// settings  { targetWidth, maxColors }: stitches per row (whole number 1–500) and the largest
//           number of DMC colors (whole number 1–99). Other fields (fabricCount) are ignored.
// palette   prepared palette (see prepareLabPalette in ./dmc-match.js); defaults to the
//           bundled DMC palette. Tests pass a small palette.
// Returns a Pattern (see ./pattern.js) of targetWidth × round(targetWidth × height / width)
// stitches with at most maxColors legend entries. Cells whose average alpha is below
// EMPTY_ALPHA_THRESHOLD are empty. Deterministic; does not modify its arguments.
// Throws RangeError for invalid settings, a grid side above MAX_GRID_SIDE, or invalid image
// sizes; TypeError if the pixels are not a byte array.
export function generatePattern(image, settings, palette = dmcPalette()) {
  checkSettings(settings);
  const size = stitchGridSize(image.width, image.height, settings.targetWidth);
  checkGridFits(image, size);
  const grid = resizeToGrid(image, size);
  const stitched = stitchedCells(grid.alpha);
  const cells = new Int16Array(size.width * size.height).fill(EMPTY_CELL);
  if (stitched.length === 0) {
    return buildPattern({ width: size.width, height: size.height, cells, colors: [] });
  }
  const { centres, assignments } = kMeansLab(labOfCells(grid.linearRgb, stitched), settings.maxColors);
  const colors = nearestDmcColors(centres, palette).map(({ color }) => ({
    code: color.code,
    name: color.name,
    hex: color.hex,
  }));
  for (let i = 0; i < stitched.length; i++) {
    cells[stitched[i]] = assignments[i];
  }
  return buildPattern({ width: size.width, height: size.height, cells, colors });
}

// Indexes of the cells that get a stitch.
function stitchedCells(alpha) {
  const stitched = [];
  for (let cell = 0; cell < alpha.length; cell++) {
    if (alpha[cell] >= EMPTY_ALPHA_THRESHOLD) {
      stitched.push(cell);
    }
  }
  return stitched;
}

// Lab values (L, a, b triples) of the given cells, for clustering.
function labOfCells(linearRgb, cellIndexes) {
  const points = new Float64Array(cellIndexes.length * 3);
  for (let i = 0; i < cellIndexes.length; i++) {
    const offset = cellIndexes[i] * 3;
    const lab = linearRgbToLab({ r: linearRgb[offset], g: linearRgb[offset + 1], b: linearRgb[offset + 2] });
    points[i * 3] = lab.L;
    points[i * 3 + 1] = lab.a;
    points[i * 3 + 2] = lab.b;
  }
  return points;
}

function checkSettings(settings) {
  checkWholeNumberInRange('targetWidth', settings?.targetWidth, 1, MAX_GRID_SIDE);
  checkWholeNumberInRange('maxColors', settings.maxColors, 1, MAX_PATTERN_COLORS);
}

function checkWholeNumberInRange(field, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${field} must be a whole number from ${min} to ${max}, got ${String(value)}`);
  }
}

function checkGridFits(image, size) {
  if (size.height <= MAX_GRID_SIDE) {
    return;
  }
  const largestWidth = maxTargetWidth(image.width, image.height);
  const advice = largestWidth === 0
    ? `no target width fits this ${image.width} × ${image.height} image`
    : `the largest target width that fits this ${image.width} × ${image.height} image is ${largestWidth}`;
  throw new RangeError(
    `the pattern would be ${size.height} stitches tall at target width ${size.width}, ` +
    `at most ${MAX_GRID_SIDE} are allowed; ${advice}`,
  );
}
