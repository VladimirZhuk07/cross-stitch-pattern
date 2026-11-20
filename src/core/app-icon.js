// The app icon: a pixel-art heart of 9 × 8 cross stitches on Aida fabric, rendered as plain RGB
// pixels (for the PNG icons) or as an SVG string (for the favicon). Pure: scripts/make-icons.js
// writes the files, tests/integration/app-icons.test.js checks that they match this design.
// These are icon colors, not DMC palette data.

/** The icon's colors. Fabric and weave are the page tokens --color-bg and --color-border. */
export const ICON_COLORS = Object.freeze({
  fabric: '#F6F4F0',
  weave: '#C9C4BB',
  red: '#C72B3B',
  darkRed: '#8E1B2A',
  white: '#FFFFFF',
});

// One character per cell: '.' fabric (no stitch), 'R' red, 'D' dark red shade, 'W' highlight.
const HEART_ROWS = [
  '.RRR.RRR.',
  'RRWRRRRRR',
  'RWRRRRRRD',
  'RRRRRRRRD',
  '.RRRRRRD.',
  '..RRRRD..',
  '...RRD...',
  '....D....',
];
const HEART_COLUMNS = HEART_ROWS[0].length;
const STITCH_COLORS = { R: ICON_COLORS.red, D: ICON_COLORS.darkRed, W: ICON_COLORS.white };

// Cell size as a share of the icon size, and how a cell is drawn (design D1).
const LAYOUTS = Object.freeze({
  any: { cellShare: 44 / 512, hasWeave: true, isCross: true },
  maskable: { cellShare: 32 / 512, hasWeave: true, isCross: true },
  squares: { cellShare: 3.5 / 32, hasWeave: false, isCross: false },
});

const MIN_SIZE = 16;
const MAX_SIZE = 1024;
const WEAVE_HALF_WIDTH = 0.03; // weave lines are 0.06 cell wide
const STITCH_INSET = 0.1; // the X starts and ends 0.1 cell inside its cell
const STITCH_HALF_WIDTH = 0.11; // a thread is 0.22 cell wide
const SAMPLES_PER_AXIS = 4; // 4 × 4 samples per pixel smooth the edges

// Color indices used while rendering: 0 fabric, 1 weave, then one per stitch character.
const FABRIC = 0;
const WEAVE = 1;
const PALETTE = [ICON_COLORS.fabric, ICON_COLORS.weave, ...Object.values(STITCH_COLORS)].map(hexToRgb);
const STITCH_INDEX = { R: 2, D: 3, W: 4 };

/**
 * Renders the icon as an IconImage: { width, height, rgb }, where width = height = size (px) and
 * rgb is a Uint8Array with 3 bytes per pixel, row-major, top-left first. Deterministic.
 * size    16–1024, a whole number of pixels
 * layout  'any' (192, 512, Apple touch icon), 'maskable' (smaller heart inside the safe circle)
 *         or 'squares' (filled squares and no weave, for the 32 px favicon)
 * Throws a RangeError for any other size and a TypeError for an unknown layout.
 */
export function renderIcon(size, layout) {
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new RangeError(`size must be a whole number of pixels from ${MIN_SIZE} to ${MAX_SIZE}, got ${size}`);
  }
  if (!Object.hasOwn(LAYOUTS, layout)) {
    throw new TypeError(`layout must be one of ${Object.keys(LAYOUTS).join(', ')}, got ${String(layout)}`);
  }
  const geometry = iconGeometry(size, LAYOUTS[layout]);
  const rgb = new Uint8Array(size * size * 3);
  const sum = [0, 0, 0];
  const sampleCount = SAMPLES_PER_AXIS * SAMPLES_PER_AXIS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      sum.fill(0);
      for (let sy = 0; sy < SAMPLES_PER_AXIS; sy++) {
        for (let sx = 0; sx < SAMPLES_PER_AXIS; sx++) {
          const color = PALETTE[colorIndexAt(x + (sx + 0.5) / SAMPLES_PER_AXIS, y + (sy + 0.5) / SAMPLES_PER_AXIS, geometry)];
          sum[0] += color[0];
          sum[1] += color[1];
          sum[2] += color[2];
        }
      }
      const start = (y * size + x) * 3;
      rgb[start] = Math.round(sum[0] / sampleCount);
      rgb[start + 1] = Math.round(sum[1] / sampleCount);
      rgb[start + 2] = Math.round(sum[2] / sampleCount);
    }
  }
  return { width: size, height: size, rgb };
}

/**
 * The 'squares' layout at 32 × 32 as an SVG document string: one fabric rectangle and one filled
 * rectangle per stitch (49). It references no URL other than the SVG namespace.
 */
export function iconSvg() {
  const size = 32;
  const { cell, originX, originY } = iconGeometry(size, LAYOUTS.squares);
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `  <rect width="${size}" height="${size}" fill="${ICON_COLORS.fabric}"/>`,
  ];
  HEART_ROWS.forEach((row, rowIndex) => {
    [...row].forEach((character, columnIndex) => {
      if (character === '.') {
        return;
      }
      const x = originX + columnIndex * cell;
      const y = originY + rowIndex * cell;
      lines.push(`  <rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${STITCH_COLORS[character]}"/>`);
    });
  });
  lines.push('</svg>');
  return `${lines.join('\n')}\n`;
}

// Cell size and the top-left corner of the centred heart, in px.
function iconGeometry(size, layout) {
  const cell = size * layout.cellShare;
  return {
    ...layout,
    cell,
    originX: (size - HEART_COLUMNS * cell) / 2,
    originY: (size - HEART_ROWS.length * cell) / 2,
  };
}

// The color index at a sample point (px from the icon's top-left corner).
function colorIndexAt(pointX, pointY, geometry) {
  const { cell, originX, originY, hasWeave, isCross } = geometry;
  const gridX = (pointX - originX) / cell;
  const gridY = (pointY - originY) / cell;
  const column = Math.floor(gridX);
  const row = Math.floor(gridY);
  const character = HEART_ROWS[row]?.[column] ?? '.';
  if (character !== '.' && (!isCross || isOnCross(gridX - column, gridY - row))) {
    return STITCH_INDEX[character];
  }
  if (hasWeave && (isNearWholeNumber(gridX) || isNearWholeNumber(gridY))) {
    return WEAVE;
  }
  return FABRIC;
}

// True when a point of a cell (0–1 in both directions) lies on the X: within the inset square
// and close to either diagonal. The edge midpoints therefore stay fabric, as on real Aida.
function isOnCross(cellX, cellY) {
  const isInset = cellX >= STITCH_INSET && cellX <= 1 - STITCH_INSET && cellY >= STITCH_INSET && cellY <= 1 - STITCH_INSET;
  if (!isInset) {
    return false;
  }
  const toDiagonal = Math.abs(cellX - cellY) / Math.SQRT2;
  const toAntiDiagonal = Math.abs(cellX + cellY - 1) / Math.SQRT2;
  return Math.min(toDiagonal, toAntiDiagonal) <= STITCH_HALF_WIDTH;
}

function isNearWholeNumber(value) {
  return Math.abs(value - Math.round(value)) <= WEAVE_HALF_WIDTH;
}

function hexToRgb(hex) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}
