import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  convertSourceEntries,
  readSourceColors,
  renderPaletteModule,
} from '../../scripts/import-dmc-palette.js';

// Inline fixtures in the shape of makebead/craft-color-codes data/json/dmc-floss.json entries.
// Values are made up for the test; they are not real DMC data.
function sourceEntry(code, hex, rgb, name = `Name of ${code}`) {
  return { code, name, hex, rgb };
}

function assertFailsNaming(entries, ...fragments) {
  assert.throws(() => convertSourceEntries(entries), (error) => {
    assert.ok(error instanceof Error);
    for (const fragment of fragments) {
      assert.ok(error.message.includes(fragment), `"${error.message}" should contain "${fragment}"`);
    }
    return true;
  });
}

describe('convertSourceEntries', () => {
  it('upper-cases letter codes and keeps other codes unchanged', () => {
    const colors = convertSourceEntries([
      sourceEntry('Blanc', '#FCFBF8', [252, 251, 248]),
      sourceEntry('Ecru', '#F0EADA', [240, 234, 218]),
      sourceEntry('B5200', '#FFFFFF', [255, 255, 255]),
      sourceEntry('3865', '#F9F7F1', [249, 247, 241]),
    ]);
    assert.deepEqual(colors.map((color) => color.code), ['BLANC', 'ECRU', 'B5200', '3865']);
  });

  it('upper-cases hex values without changing them', () => {
    const [color] = convertSourceEntries([sourceEntry('1', '#ffffff', [255, 255, 255])]);
    assert.equal(color.hex, '#FFFFFF');
  });

  it('keeps only code, name, and hex, with the name unchanged', () => {
    const [color] = convertSourceEntries([sourceEntry('310', '#000000', [0, 0, 0], 'Black')]);
    assert.deepEqual(color, { code: '310', name: 'Black', hex: '#000000' });
  });

  it('keeps the source order', () => {
    const colors = convertSourceEntries([
      sourceEntry('3', '#030303', [3, 3, 3]),
      sourceEntry('1', '#010101', [1, 1, 1]),
      sourceEntry('2', '#020202', [2, 2, 2]),
    ]);
    assert.deepEqual(colors.map((color) => color.code), ['3', '1', '2']);
  });

  it('fails when rgb disagrees with hex, naming the entry', () => {
    assertFailsNaming([sourceEntry('310', '#000000', [0, 0, 1], 'Black')], '310');
  });

  it('fails on a code that is duplicated after normalisation', () => {
    assertFailsNaming(
      [sourceEntry('Blanc', '#FCFBF8', [252, 251, 248]), sourceEntry('BLANC', '#FFFFFF', [255, 255, 255])],
      'BLANC',
    );
  });

  it('fails on a malformed hex value, naming the entry and the value', () => {
    assertFailsNaming([sourceEntry('310', '#00000', [0, 0, 0])], '310', '#00000');
  });

  it('fails on an empty name, naming the entry', () => {
    assertFailsNaming([sourceEntry('310', '#000000', [0, 0, 0], '')], '310');
  });

  it('fails on an empty or non-string code', () => {
    assertFailsNaming([sourceEntry('', '#000000', [0, 0, 0])], 'code');
    assertFailsNaming([sourceEntry(310, '#000000', [0, 0, 0])], '310');
  });
});

describe('readSourceColors', () => {
  const colors = [sourceEntry('310', '#000000', [0, 0, 0], 'Black')];

  it('returns the colors of a CC-BY-4.0 palette file whose count matches', () => {
    assert.deepEqual(readSourceColors({ license: 'CC-BY-4.0', count: 1, colors }), colors);
  });

  it('fails when the license is not CC-BY-4.0', () => {
    assert.throws(() => readSourceColors({ license: 'MIT', count: 1, colors }), /MIT/);
  });

  it('fails when count does not match the number of colors', () => {
    assert.throws(() => readSourceColors({ license: 'CC-BY-4.0', count: 2, colors }), /2/);
  });

  it('fails when colors is not an array', () => {
    assert.throws(() => readSourceColors({ license: 'CC-BY-4.0', count: 0 }), /colors/);
  });
});

describe('renderPaletteModule', () => {
  const provenance = {
    commitSha: '0123456789abcdef0123456789abcdef01234567',
    sourceSha256: 'a'.repeat(64),
  };
  const colors = [
    { code: '310', name: 'Black', hex: '#000000' },
    { code: 'BLANC', name: `It's a "test" name`, hex: '#FCFBF8' },
  ];

  async function importModule(text) {
    return import(`data:text/javascript,${encodeURIComponent(text)}`);
  }

  it('starts with a header comment recording source, commit, hash, license, and transformations', () => {
    const text = renderPaletteModule(colors, provenance);
    assert.ok(text.startsWith('// '), 'starts with a line comment');
    const header = text.slice(0, text.indexOf('\nconst '));
    for (const expected of [
      'https://github.com/makebead/craft-color-codes',
      'data/json/dmc-floss.json',
      provenance.commitSha,
      provenance.sourceSha256,
      'CC-BY-4.0',
      'MakeBead',
      'codes upper-cased',
      'hex upper-cased',
      'rgb field dropped',
      'node scripts/import-dmc-palette.js',
    ]) {
      assert.ok(header.includes(expected), `header should contain ${expected}`);
    }
  });

  it('produces a module whose DMC_COLORS equals the input colors', async () => {
    const { DMC_COLORS } = await importModule(renderPaletteModule(colors, provenance));
    assert.deepEqual(DMC_COLORS, colors);
  });

  it('freezes the array and every entry', async () => {
    const { DMC_COLORS } = await importModule(renderPaletteModule(colors, provenance));
    assert.ok(Object.isFrozen(DMC_COLORS));
    assert.ok(DMC_COLORS.every((color) => Object.isFrozen(color)));
  });

  it('gives identical text for identical input', () => {
    assert.equal(renderPaletteModule(colors, provenance), renderPaletteModule(colors, provenance));
  });

  it('rejects a commit SHA that is not 40 hex characters', () => {
    assert.throws(() => renderPaletteModule(colors, { ...provenance, commitSha: 'main' }), /main/);
  });

  it('rejects a source hash that is not 64 hex characters', () => {
    assert.throws(() => renderPaletteModule(colors, { ...provenance, sourceSha256: 'abc' }), /abc/);
  });
});
