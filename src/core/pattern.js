// The cross-stitch pattern model: building a validated, numbered pattern from per-cell
// colors, plus small lookups that the preview and chart layers need.
// The authoritative description is openspec/specs/pattern-model/spec.md.

// Marks a cell with no stitch (a transparent area). Distinct from every color, including white.
export const EMPTY_CELL = -1;

// At most 99 colors, so a legend number never needs more than 2 digits in a chart cell.
export const MAX_PATTERN_COLORS = 99;

// Stitches per inch of the default fabric (Aida 14 ct) and the counts offered to users.
export const DEFAULT_FABRIC_COUNT = 14;
export const FABRIC_COUNTS = Object.freeze([11, 14, 16, 18]);

const DIGITS_ONLY = /^\d+$/;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

// Sort comparator for DMC codes (strings such as '310', '3865', 'B5200', 'BLANC').
// Digit-only codes come first, by numeric value; all other codes follow in ordinal string
// order. Equal numeric values ('01', '1') fall back to ordinal order.
// Ordinal order (not localeCompare) keeps the result identical in every browser locale.
// Returns a negative number if a sorts first, a positive number if b does, 0 if equal.
export function compareDmcCodes(a, b) {
  const isNumericA = DIGITS_ONLY.test(a);
  const isNumericB = DIGITS_ONLY.test(b);
  if (isNumericA !== isNumericB) {
    return isNumericA ? -1 : 1;
  }
  if (isNumericA) {
    const byValue = Number(a) - Number(b);
    if (byValue !== 0) {
      return byValue;
    }
  }
  return compareOrdinal(a, b);
}

export function buildPattern(input) {
  const { width, height, cells, colors } = input;
  checkPositiveInteger('width', width);
  checkPositiveInteger('height', height);
  checkCellCount(cells, width * height);
  checkColors(colors);
  const stitchCounts = countStitchesPerColor(cells, width, colors.length);
  const legend = buildLegend(colors, stitchCounts);
  return { width, height, cells: remapCells(cells, legend.legendIndexOfColor), legend: legend.entries };
}

// Turns the used input colors into numbered legend entries. Also returns, for every input
// color index, the index of its legend entry (EMPTY_CELL for unused colors).
function buildLegend(colors, stitchCounts) {
  const groups = groupUsedColorsByCode(colors, stitchCounts);
  groups.sort(compareLegendGroups);

  const legendIndexOfColor = new Int32Array(colors.length).fill(EMPTY_CELL);
  const entries = [];
  for (let legendIndex = 0; legendIndex < groups.length; legendIndex++) {
    const { code, name, hex, stitchCount, colorIndexes } = groups[legendIndex];
    entries.push({ number: legendIndex + 1, code, name, hex, stitchCount });
    for (const colorIndex of colorIndexes) {
      legendIndexOfColor[colorIndex] = legendIndex;
    }
  }
  return { entries, legendIndexOfColor };
}

// Several k-means clusters can land on the same DMC color; the chart must list it once.
// Returns one group per used DMC code with the summed stitch count and the input indexes.
function groupUsedColorsByCode(colors, stitchCounts) {
  const groupByCode = new Map();
  for (let i = 0; i < colors.length; i++) {
    if (stitchCounts[i] === 0) {
      continue;
    }
    const { code, name, hex } = colors[i];
    const group = groupByCode.get(code);
    if (group === undefined) {
      groupByCode.set(code, { code, name, hex: hex.toUpperCase(), stitchCount: stitchCounts[i], colorIndexes: [i] });
      continue;
    }
    group.stitchCount += stitchCounts[i];
    group.colorIndexes.push(i);
  }
  return [...groupByCode.values()];
}

// The same DMC code must always mean the same color; differing data points to a bug upstream.
function checkNoConflictingCodes(colors) {
  const firstByCode = new Map();
  for (const color of colors) {
    const first = firstByCode.get(color.code);
    if (first === undefined) {
      firstByCode.set(color.code, color);
      continue;
    }
    if (first.name !== color.name || first.hex.toUpperCase() !== color.hex.toUpperCase()) {
      throw new Error(
        `DMC ${color.code} appears twice with different data: ` +
        `"${first.name}" ${first.hex} vs "${color.name}" ${color.hex}`,
      );
    }
  }
}

// Most stitches first; equal counts by DMC code, so the numbering is deterministic.
function compareLegendGroups(a, b) {
  return b.stitchCount - a.stitchCount || compareDmcCodes(a.code, b.code);
}

function remapCells(cells, legendIndexOfColor) {
  const out = new Int16Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const value = cells[i];
    out[i] = value === EMPTY_CELL ? EMPTY_CELL : legendIndexOfColor[value];
  }
  return out;
}

function checkColors(colors) {
  if (!Array.isArray(colors)) {
    throw new TypeError(`colors must be an array of { code, name, hex }, got ${String(colors)}`);
  }
  for (let i = 0; i < colors.length; i++) {
    checkColor(colors[i], i);
  }
  checkNoConflictingCodes(colors);
}

function checkColor(color, index) {
  const code = color?.code;
  if (typeof code !== 'string' || code === '') {
    throw new TypeError(`colors[${index}].code must be a non-empty string, got ${String(code)}`);
  }
  if (typeof color.name !== 'string' || color.name === '') {
    throw new TypeError(`colors[${index}] (DMC ${code}).name must be a non-empty string, got ${String(color.name)}`);
  }
  if (typeof color.hex !== 'string' || !HEX_COLOR.test(color.hex)) {
    throw new TypeError(`colors[${index}] (DMC ${code}).hex must look like #RRGGBB, got ${String(color.hex)}`);
  }
}

// Validates every cell value and returns how many cells use each input color index.
function countStitchesPerColor(cells, width, colorCount) {
  const counts = new Int32Array(colorCount);
  for (let i = 0; i < cells.length; i++) {
    const value = cells[i];
    if (value === EMPTY_CELL) {
      continue;
    }
    if (!Number.isInteger(value) || value < 0 || value >= colorCount) {
      throw new RangeError(
        `cell ${i} (x ${i % width}, y ${Math.floor(i / width)}) has color index ${String(value)}, ` +
        `expected ${EMPTY_CELL} or 0–${colorCount - 1}`,
      );
    }
    counts[value]++;
  }
  return counts;
}

function checkPositiveInteger(field, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive integer, got ${String(value)}`);
  }
}

function checkCellCount(cells, expectedCount) {
  const count = cells?.length;
  if (count !== expectedCount) {
    throw new RangeError(`cells must have width × height = ${expectedCount} entries, got ${String(count)}`);
  }
}

function compareOrdinal(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
