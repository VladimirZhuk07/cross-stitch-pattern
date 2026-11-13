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
  const { width, height, cells } = input;
  checkPositiveInteger('width', width);
  checkPositiveInteger('height', height);
  checkCellCount(cells, width * height);
  return null;
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
