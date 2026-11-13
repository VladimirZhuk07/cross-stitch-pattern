import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { hexToRgb, rgbToLab } from '../../src/core/color.js';
import { nearestDmcColor, nearestDmcColors, prepareLabPalette } from '../../src/core/dmc-match.js';
import { DMC_COLORS } from '../../src/data/dmc.js';
import { assertCloseFields } from '../helpers/assert-close.js';

const EXACT_MATCH_TOLERANCE = 1e-9;

// 30 fixed sRGB colors spread over the cube, standing in for k-means cluster centres.
function fixedClusterCentres() {
  const centres = [];
  for (let i = 0; i < 30; i += 1) {
    centres.push(rgbToLab({ r: (i * 53) % 256, g: (i * 97 + 40) % 256, b: (i * 151 + 90) % 256 }));
  }
  return centres;
}

describe('DMC palette with color matching', () => {
  const palette = prepareLabPalette(DMC_COLORS);

  it('prepares all 489 colors in palette order', () => {
    assert.equal(palette.length, 489);
    assert.deepEqual(palette.map((color) => color.code), DMC_COLORS.map((color) => color.code));
  });

  it("gives '310' the Lab value (0, 0, 0)", () => {
    const black = palette.find((color) => color.code === '310');
    assertCloseFields(black.lab, { L: 0, a: 0, b: 0 }, ['L', 'a', 'b'], 0.01, 'Lab of 310');
  });

  it("matches #000000 to '310' exactly", () => {
    const match = nearestDmcColor(rgbToLab(hexToRgb('#000000')), palette);
    assert.equal(match.color.code, '310');
    assert.equal(match.color.hex, '#000000');
    assert.ok(match.deltaE < EXACT_MATCH_TOLERANCE, `ΔE00 ${match.deltaE}`);
  });

  it('matches every DMC color to itself or an earlier entry with the same hex', () => {
    DMC_COLORS.forEach((color, index) => {
      const match = nearestDmcColor(rgbToLab(hexToRgb(color.hex)), palette);
      assert.equal(match.color.hex, color.hex, `hex of match for ${color.code}`);
      assert.ok(match.deltaE < EXACT_MATCH_TOLERANCE, `ΔE00 for ${color.code}: ${match.deltaE}`);
      assert.ok(match.index <= index, `index of match for ${color.code}`);
      if (match.index < index) {
        assert.equal(DMC_COLORS[match.index].hex, color.hex);
      }
    });
  });

  it('matches 30 cluster centres in one call, equal to single matches', () => {
    const centres = fixedClusterCentres();
    const matches = nearestDmcColors(centres, palette);
    assert.equal(matches.length, 30);
    for (let i = 0; i < centres.length; i += 1) {
      assert.deepEqual(matches[i], nearestDmcColor(centres[i], palette));
    }
  });

  it('runs without DOM globals', () => {
    assert.equal(typeof globalThis.window, 'undefined');
    assert.equal(typeof globalThis.document, 'undefined');
  });
});

describe('core color modules stay pure', () => {
  const FORBIDDEN = /\b(window|document|self|fetch|localStorage|setTimeout|setInterval|XMLHttpRequest)\b/;

  for (const file of ['color.js', 'dmc-match.js']) {
    it(`src/core/${file} uses no browser globals, timers, or network APIs`, async () => {
      const text = await readFile(new URL(`../../src/core/${file}`, import.meta.url), 'utf8');
      const match = text.match(FORBIDDEN);
      assert.equal(match, null, `found ${match?.[0]}`);
    });

    it(`src/core/${file} imports only relative core modules`, async () => {
      const text = await readFile(new URL(`../../src/core/${file}`, import.meta.url), 'utf8');
      const specifiers = [...text.matchAll(/^import .* from '([^']+)';$/gm)].map((found) => found[1]);
      for (const specifier of specifiers) {
        assert.match(specifier, /^\.\/[a-z-]+\.js$/, `import ${specifier}`);
      }
    });
  }
});
