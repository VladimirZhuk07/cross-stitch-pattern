// The generation pipeline: image pixels + settings → Pattern.
// Steps: stitch grid size → pass 1: area averaging in linear RGB row by row (./stitch-grid.js),
// empty cells by alpha, a seeded uniform sample of the stitched cells (./reservoir-sample.js)
// → k-means in CIELAB on the sample (./kmeans.js) → nearest DMC floss per cluster by CIEDE2000
// (./dmc-match.js) → pass 2: the same averaging again, every stitched cell joins its nearest
// cluster centre (./nearest-centre.js) → Pattern, merging clusters that land on the same DMC
// code (./pattern.js).
// Nothing is stored per cell except the cluster index (2 bytes), so a 10000 × 10000 grid fits
// in memory; the averages are computed twice instead of being kept (design D4–D7 of
// raise-pattern-limits).
// The authoritative description is openspec/specs/pattern-generation/spec.md.

import { DMC_COLORS } from '../data/dmc.js';
import { linearRgbToLab } from './color.js';
import { nearestDmcColors, prepareLabPalette } from './dmc-match.js';
import { MAX_KMEANS_ITERATIONS, kMeansLab } from './kmeans.js';
import { createNearestCentreSearch } from './nearest-centre.js';
import { EMPTY_CELL, MAX_PATTERN_COLORS, buildPattern } from './pattern.js';
import { createReservoirSampler } from './reservoir-sample.js';
import { EMPTY_ALPHA_THRESHOLD, MAX_GRID_SIDE, createGridAverager, maxTargetWidth, stitchGridSize } from './stitch-grid.js';

// k-means runs on at most this many stitched cells: enough for stable centres even with 489
// colors (about 134 cells per cluster) while keeping k-means well under a second.
// Patterns with at most this many stitched cells are clustered from all of them.
export const KMEANS_SAMPLE_SIZE = 65536;

// Fixed seed of the sample; not a user setting.
export const SAMPLE_SEED = 20261114;

const VALUES_PER_CELL = 4; // linear r, g, b and alpha, see createGridAverager

// The full DMC palette with Lab values, prepared on first use and then reused.
let preparedDmcPalette = null;

function dmcPalette() {
  if (preparedDmcPalette === null) {
    preparedDmcPalette = prepareLabPalette(DMC_COLORS);
  }
  return preparedDmcPalette;
}

// Generates a cross-stitch pattern from an image.
// image     pixel image { width, height, pixels } as described at createGridAverager in
//           ./stitch-grid.js (RGBA bytes, row-major).
// settings  { targetWidth, maxColors }: stitches per row (whole number 1–MAX_GRID_SIDE) and
//           the largest number of DMC colors (whole number 1–MAX_PATTERN_COLORS). Other fields
//           (fabricCount) are ignored.
// options   { palette, onProgress }, both optional:
//   palette     prepared palette (see prepareLabPalette in ./dmc-match.js); defaults to the
//               bundled DMC palette. Tests pass a small palette.
//   onProgress  function called with GenerationProgress { phase, done, total }:
//                 phase  'averaging' (pass 1), 'clustering' (k-means) or 'assigning' (pass 2),
//                        always in this order
//                 done   whole number 1…total; total is the grid height for averaging and
//                        assigning, MAX_KMEANS_ITERATIONS (30) for clustering
//               once per grid row of each pass and once per k-means iteration; clustering
//               always ends with done = total, also when k-means stops early or there is
//               nothing to cluster. Not called at all when the input is invalid.
// Returns a Pattern (see ./pattern.js) of targetWidth × round(targetWidth × height / width)
// stitches with at most maxColors legend entries. Cells whose average alpha is below
// EMPTY_ALPHA_THRESHOLD are empty. Deterministic; does not modify its arguments.
// Throws RangeError for invalid settings, a grid side above MAX_GRID_SIDE, or invalid image
// sizes; TypeError if the pixels are not a byte array.
export function generatePattern(image, settings, options = {}) {
  const { palette = dmcPalette(), onProgress = () => {} } = options;
  checkSettings(settings);
  const size = stitchGridSize(image.width, image.height, settings.targetWidth);
  checkGridFits(image, size);
  const averageRow = createGridAverager(image, size);
  const sample = sampleStitchedCells(averageRow, size, onProgress);
  const centres = clusterSample(sample, settings.maxColors, onProgress);
  const colors = nearestDmcColors(centres, palette).map(({ color }) => ({
    code: color.code,
    name: color.name,
    hex: color.hex,
  }));
  const cells = assignCells(averageRow, size, centres, onProgress);
  return buildPattern({ width: size.width, height: size.height, cells, colors });
}

// Pass 1: averages every row and keeps a seeded uniform sample of at most KMEANS_SAMPLE_SIZE
// stitched cells. Only sampled cells are converted to Lab.
// Returns a Float64Array of L, a, b triples (3 × number of sampled cells).
function sampleStitchedCells(averageRow, size, onProgress) {
  const nextSlot = createReservoirSampler(KMEANS_SAMPLE_SIZE, SAMPLE_SEED);
  const sample = new Float64Array(KMEANS_SAMPLE_SIZE * 3);
  const row = new Float64Array(size.width * VALUES_PER_CELL);
  let stitchedCount = 0;
  for (let y = 0; y < size.height; y++) {
    averageRow(y, row);
    for (let x = 0; x < size.width; x++) {
      const offset = x * VALUES_PER_CELL;
      if (row[offset + 3] < EMPTY_ALPHA_THRESHOLD) {
        continue;
      }
      stitchedCount += 1;
      const slot = nextSlot();
      if (slot !== -1) {
        writeLab(row, offset, sample, slot * 3);
      }
    }
    onProgress({ phase: 'averaging', done: y + 1, total: size.height });
  }
  return sample.subarray(0, Math.min(stitchedCount, KMEANS_SAMPLE_SIZE) * 3);
}

// k-means on the sample. Returns the cluster centres as Lab colors { L, a, b } ([] without
// any stitched cell) and reports the clustering phase.
function clusterSample(sample, maxColors, onProgress) {
  let lastReported = 0;
  const reportIteration = (iteration) => {
    lastReported = iteration;
    onProgress({ phase: 'clustering', done: iteration, total: MAX_KMEANS_ITERATIONS });
  };
  const { centres } = kMeansLab(sample, maxColors, undefined, reportIteration);
  if (lastReported < MAX_KMEANS_ITERATIONS) {
    onProgress({ phase: 'clustering', done: MAX_KMEANS_ITERATIONS, total: MAX_KMEANS_ITERATIONS });
  }
  return centres;
}

// Pass 2: averages every row again and gives each stitched cell the index of its nearest
// cluster centre (Euclidean in Lab, lowest index on a tie); empty cells get EMPTY_CELL.
// Returns an Int16Array of width × height cluster indexes, row-major.
function assignCells(averageRow, size, centres, onProgress) {
  const cells = new Int16Array(size.width * size.height).fill(EMPTY_CELL);
  const nearestCentre = centres.length === 0 ? null : createNearestCentreSearch(packLab(centres));
  const row = new Float64Array(size.width * VALUES_PER_CELL);
  const lab = new Float64Array(3);
  for (let y = 0; y < size.height; y++) {
    averageRow(y, row);
    const rowStart = y * size.width;
    for (let x = 0; x < size.width; x++) {
      const offset = x * VALUES_PER_CELL;
      if (row[offset + 3] < EMPTY_ALPHA_THRESHOLD) {
        continue;
      }
      // A cell with exactly the color of its stitched left neighbour joins the same cluster;
      // exact, and it skips most of the work in flat areas and upscaled images.
      if (x > 0 && cells[rowStart + x - 1] !== EMPTY_CELL && hasSameColorAsLeft(row, offset)) {
        cells[rowStart + x] = cells[rowStart + x - 1];
        continue;
      }
      writeLab(row, offset, lab, 0);
      cells[rowStart + x] = nearestCentre(lab[0], lab[1], lab[2]);
    }
    onProgress({ phase: 'assigning', done: y + 1, total: size.height });
  }
  return cells;
}

function hasSameColorAsLeft(row, offset) {
  return row[offset] === row[offset - VALUES_PER_CELL] &&
    row[offset + 1] === row[offset + 1 - VALUES_PER_CELL] &&
    row[offset + 2] === row[offset + 2 - VALUES_PER_CELL];
}

// Converts the linear RGB of the cell at row[offset…offset + 2] to Lab and writes L, a, b to
// out[outOffset…outOffset + 2].
function writeLab(row, offset, out, outOffset) {
  const lab = linearRgbToLab({ r: row[offset], g: row[offset + 1], b: row[offset + 2] });
  out[outOffset] = lab.L;
  out[outOffset + 1] = lab.a;
  out[outOffset + 2] = lab.b;
}

function packLab(labs) {
  const packed = new Float64Array(labs.length * 3);
  labs.forEach((lab, index) => {
    packed[index * 3] = lab.L;
    packed[index * 3 + 1] = lab.a;
    packed[index * 3 + 2] = lab.b;
  });
  return packed;
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
