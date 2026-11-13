import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { DMC_COLORS } from '../../../src/data/dmc.js';

const EXPECTED_COLOR_COUNT = 489;
const PALETTE_FILE = new URL('../../../src/data/dmc.js', import.meta.url);

function findByCode(code) {
  return DMC_COLORS.filter((color) => color.code === code);
}

describe('DMC palette data', () => {
  it(`has ${EXPECTED_COLOR_COUNT} entries`, () => {
    assert.equal(DMC_COLORS.length, EXPECTED_COLOR_COUNT);
  });

  it('has a distinct string code for every entry', () => {
    assert.ok(DMC_COLORS.every((color) => typeof color.code === 'string' && color.code !== ''));
    assert.equal(new Set(DMC_COLORS.map((color) => color.code)).size, EXPECTED_COLOR_COUNT);
  });

  it('has only upper-case #RRGGBB hex values', () => {
    const malformed = DMC_COLORS.filter((color) => !/^#[0-9A-F]{6}$/.test(color.hex));
    assert.deepEqual(malformed, []);
  });

  it('has exactly the keys code, name, and hex on every entry', () => {
    assert.ok(DMC_COLORS.every((color) => Object.keys(color).join(',') === 'code,name,hex'));
  });

  it('has a non-empty name on every entry', () => {
    assert.ok(DMC_COLORS.every((color) => typeof color.name === 'string' && color.name !== ''));
  });

  it("contains exactly one '310', and it is black #000000", () => {
    const matches = findByCode('310');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].hex, '#000000');
  });

  for (const code of ['BLANC', 'ECRU', 'B5200', '3865']) {
    it(`contains code '${code}'`, () => {
      assert.equal(findByCode(code).length, 1);
    });
  }

  it('has no lower-case letter in any code', () => {
    assert.deepEqual(DMC_COLORS.filter((color) => /[a-z]/.test(color.code)), []);
  });

  it('throws a TypeError when an entry is modified', () => {
    const [black] = findByCode('310');
    assert.throws(() => {
      black.hex = '#FFFFFF';
    }, TypeError);
    assert.equal(black.hex, '#000000');
  });

  it('throws a TypeError when an entry is added', () => {
    assert.throws(() => DMC_COLORS.push({ code: 'X', name: 'X', hex: '#000000' }), TypeError);
    assert.equal(DMC_COLORS.length, EXPECTED_COLOR_COUNT);
  });

  it('records source, pinned commit, license, and transformations in its header', async () => {
    const text = await readFile(PALETTE_FILE, 'utf8');
    const header = text.slice(0, text.indexOf('\nconst '));
    assert.ok(header.includes('https://github.com/makebead/craft-color-codes'));
    assert.ok(header.includes('data/json/dmc-floss.json'));
    assert.match(header, /commit [0-9a-f]{40}\n/);
    assert.match(header, /SHA-256 of the source file: [0-9a-f]{64}\n/);
    assert.ok(header.includes('CC-BY-4.0'));
    assert.ok(header.includes('codes upper-cased'));
    assert.ok(header.includes('hex upper-cased'));
    assert.ok(header.includes('rgb field dropped'));
  });
});
