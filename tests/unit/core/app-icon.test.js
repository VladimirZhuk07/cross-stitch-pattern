// Unit tests for src/core/app-icon.js (openspec/changes/add-pwa-install/specs/app-install/spec.md:
// "The app icon is a cross-stitched heart", "The maskable icon keeps the heart inside the safe
// zone", "Small icons use plain squares"; design D1).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';
import { ICON_COLORS, renderIcon, iconSvg } from '../../../src/core/app-icon.js';

function rgbOf(hex) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

const FABRIC = rgbOf(ICON_COLORS.fabric);
const WEAVE = rgbOf(ICON_COLORS.weave);

function pixelAt(image, x, y) {
  const start = (y * image.width + x) * 3;
  return [...image.rgb.subarray(start, start + 3)];
}

// True when a pixel is fabric, weave, or a smoothed mix of only those two: it then lies on the
// line from fabric to weave (each channel within 1.6 of it, allowing for rounding).
function isBackground([red, green, blue]) {
  const share = (FABRIC[0] - red) / (FABRIC[0] - WEAVE[0]);
  if (share < -0.02 || share > 1.02) {
    return false;
  }
  const expectedGreen = FABRIC[1] - share * (FABRIC[1] - WEAVE[1]);
  const expectedBlue = FABRIC[2] - share * (FABRIC[2] - WEAVE[2]);
  return Math.abs(green - expectedGreen) <= 1.6 && Math.abs(blue - expectedBlue) <= 1.6;
}

// The columns that hold at least one heart pixel: { first, last, width }.
function heartColumns(image) {
  let first = Infinity;
  let last = -Infinity;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!isBackground(pixelAt(image, x, y))) {
        first = Math.min(first, x);
        last = Math.max(last, x);
      }
    }
  }
  return { first, last, width: last - first + 1 };
}

describe('ICON_COLORS', () => {
  it('uses the page tokens for the fabric and the weave and fixed heart colors', () => {
    assert.deepEqual(ICON_COLORS, {
      fabric: '#F6F4F0',
      weave: '#C9C4BB',
      red: '#C72B3B',
      darkRed: '#8E1B2A',
      white: '#FFFFFF',
    });
  });
});

describe('renderIcon', () => {
  it('returns a 512 × 512 RGB image of 786,432 bytes for layout any', () => {
    const image = renderIcon(512, 'any');
    assert.equal(image.width, 512);
    assert.equal(image.height, 512);
    assert.ok(image.rgb instanceof Uint8Array);
    assert.equal(image.rgb.length, 786432);
  });

  it('shows fabric or weave in the top-left corner', () => {
    const corner = pixelAt(renderIcon(512, 'any'), 0, 0);
    assert.ok([FABRIC, WEAVE].some((color) => color.join() === corner.join()), `got ${corner}`);
  });

  it('shows the heart red at (256, 234), the centre of the stitch in row 4, column 5', () => {
    assert.deepEqual(pixelAt(renderIcon(512, 'any'), 256, 234), rgbOf(ICON_COLORS.red));
  });

  it('shows a white highlight stitch at the centre of row 2, column 3', () => {
    // Cell 44 px, origin (58, 80): the centre of column 3 is x = 58 + 2.5 × 44 = 168, row 2 is y = 146.
    assert.deepEqual(pixelAt(renderIcon(512, 'any'), 168, 146), rgbOf(ICON_COLORS.white));
  });

  it('shows the dark red shade at the centre of the bottom stitch (row 8, column 5)', () => {
    assert.deepEqual(pixelAt(renderIcon(512, 'any'), 256, 410), rgbOf(ICON_COLORS.darkRed));
  });

  it('leaves the edge midpoints of a stitch cell as fabric, as with a real cross stitch', () => {
    // Top edge midpoint of the cell in row 4, column 5: (256, 212) is 0.5 cell above the centre.
    assert.ok(isBackground(pixelAt(renderIcon(512, 'any'), 256, 213)));
  });

  it('draws the weave grid outside the heart in layout any', () => {
    // A vertical weave line is centred on x = 58 (the heart origin), 2.64 px wide.
    assert.deepEqual(pixelAt(renderIcon(512, 'any'), 57, 10), WEAVE);
  });

  it('draws a heart at least 360 px wide in layout any at 512', () => {
    const { width } = heartColumns(renderIcon(512, 'any'));
    assert.ok(width >= 360, `heart is ${width} px wide`);
  });

  it('draws the heart centred horizontally', () => {
    const { first, last } = heartColumns(renderIcon(512, 'any'));
    assert.ok(Math.abs(first - (511 - last)) <= 1, `first ${first}, last ${last}`);
  });

  it('draws a heart at most 290 px wide in layout maskable at 512', () => {
    const { width } = heartColumns(renderIcon(512, 'maskable'));
    assert.ok(width <= 290, `heart is ${width} px wide`);
  });

  it('keeps every heart pixel of the maskable icon within 204.8 px of the centre', () => {
    const image = renderIcon(512, 'maskable');
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const distance = Math.hypot(x + 0.5 - 256, y + 0.5 - 256);
        if (distance > 204.8) {
          assert.ok(isBackground(pixelAt(image, x, y)), `heart pixel at (${x}, ${y}), ${distance.toFixed(1)} px out`);
        }
      }
    }
  });

  it('fills the corners of the maskable icon with fabric or weave', () => {
    const image = renderIcon(512, 'maskable');
    for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) {
      assert.ok(isBackground(pixelAt(image, x, y)), `corner (${x}, ${y})`);
    }
  });

  it('draws square stitches spanning at least 28 columns in layout squares at 32', () => {
    const { width } = heartColumns(renderIcon(32, 'squares'));
    assert.ok(width >= 28, `heart spans ${width} columns`);
  });

  it('fills a stitch cell completely in layout squares', () => {
    // Cell 3.5 px, origin (0.25, 2): row 4, column 5 covers x 14.25–17.75, y 12.5–16.
    assert.deepEqual(pixelAt(renderIcon(32, 'squares'), 15, 13), rgbOf(ICON_COLORS.red));
  });

  it('draws no weave grid in layout squares', () => {
    const image = renderIcon(32, 'squares');
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        assert.notDeepEqual(pixelAt(image, x, y), WEAVE, `weave at (${x}, ${y})`);
      }
    }
    assert.deepEqual(pixelAt(image, 0, 0), FABRIC);
  });

  it('renders the smallest and largest allowed sizes, 16 and 1024', () => {
    assert.equal(renderIcon(16, 'squares').rgb.length, 16 * 16 * 3);
    assert.equal(renderIcon(1024, 'any').width, 1024);
  });

  it('gives the same bytes on every call', () => {
    assert.deepEqual(renderIcon(192, 'any').rgb, renderIcon(192, 'any').rgb);
  });

  it('throws a RangeError for size 15, 1025 and 100.5', () => {
    assertThrowsWith(() => renderIcon(15, 'any'), RangeError, '16', '1024', '15');
    assertThrowsWith(() => renderIcon(1025, 'any'), RangeError, '1025');
    assertThrowsWith(() => renderIcon(100.5, 'any'), RangeError, '100.5');
  });

  it('throws a TypeError for the unknown layout round', () => {
    assertThrowsWith(() => renderIcon(512, 'round'), TypeError, 'round', 'any', 'maskable', 'squares');
  });
});

describe('iconSvg', () => {
  it('is an svg element with viewBox 0 0 32 32', () => {
    const svg = iconSvg();
    assert.match(svg, /^<svg [^>]*viewBox="0 0 32 32"/);
    assert.match(svg.trim(), /<\/svg>$/);
  });

  it('holds one fabric rectangle and one rectangle per stitch, 50 in all', () => {
    const rects = iconSvg().match(/<rect /g);
    assert.equal(rects.length, 1 + 49);
    assert.match(iconSvg(), new RegExp(`<rect width="32" height="32" fill="${ICON_COLORS.fabric}"/>`));
  });

  it('uses the heart colors: 2 white, 6 dark red and 41 red stitches', () => {
    const svg = iconSvg();
    const count = (hex) => svg.split(`fill="${hex}"`).length - 1;
    assert.equal(count(ICON_COLORS.white), 2);
    assert.equal(count(ICON_COLORS.darkRed), 6);
    assert.equal(count(ICON_COLORS.red), 41);
  });

  it('contains no URL other than the SVG namespace', () => {
    const svg = iconSvg().replace('xmlns="http://www.w3.org/2000/svg"', '');
    assert.doesNotMatch(svg, /http|\/\/|href/);
  });
});
