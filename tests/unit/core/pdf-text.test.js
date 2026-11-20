// Unit tests for src/core/pdf-text.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose } from '../../helpers/assert-close.js';
import { DMC_COLORS } from '../../../src/data/dmc.js';
import {
  FONT_BOLD,
  FONT_REGULAR,
  encodeWinAnsi,
  fitText,
  pdfString,
  pdfTextString,
  textWidth,
} from '../../../src/core/pdf-text.js';

const MM = 72 / 25.4;

describe('encodeWinAnsi', () => {
  it('keeps ASCII and Latin-1 letters as their own bytes', () => {
    assert.deepEqual([...encodeWinAnsi('café')], [0x63, 0x61, 0x66, 0xe9]);
    assert.deepEqual([...encodeWinAnsi('×·')], [0xd7, 0xb7]);
  });

  it('maps the Windows-1252 characters of 0x80–0x9F to their bytes', () => {
    assert.deepEqual([...encodeWinAnsi('–…€')], [0x96, 0x85, 0x80]);
    assert.deepEqual([...encodeWinAnsi('—’Ÿ')], [0x97, 0x92, 0x9f]);
  });

  it('writes ? for characters the encoding cannot show', () => {
    assert.deepEqual([...encodeWinAnsi('Ё')], [0x3f]);
    assert.deepEqual([...encodeWinAnsi('a😀b')], [0x61, 0x3f, 0x62], 'one ? per code point');
    assert.deepEqual([...encodeWinAnsi('\u0007\u0081')], [0x3f, 0x3f], 'controls and unused codes');
  });
});

describe('pdfString', () => {
  it('escapes parentheses and backslashes', () => {
    assert.equal(pdfString('a(b)\\c'), '(a\\(b\\)\\\\c)');
  });

  it('writes bytes outside printable ASCII as octal escapes', () => {
    assert.equal(pdfString('é'), '(\\351)');
    assert.equal(pdfString('1–2'), '(1\\2262)');
  });

  it('writes ? for characters outside Windows-1252', () => {
    assert.equal(pdfString('Ёлка.png'), '(????.png)');
  });
});

describe('pdfTextString', () => {
  it('writes UTF-16BE hex with a byte order mark', () => {
    assert.equal(pdfTextString('Ёлка'), '<FEFF0401043B043A0430>');
    assert.equal(pdfTextString(''), '<FEFF>');
  });

  it('writes surrogate pairs as two code units', () => {
    assert.equal(pdfTextString('😀'), '<FEFFD83DDE00>');
  });
});

// Expected widths are from Adobe's Core14 AFM files Helvetica.afm and Helvetica-Bold.afm.
describe('textWidth', () => {
  it('names the two fonts F1 and F2', () => {
    assert.equal(FONT_REGULAR, 'F1');
    assert.equal(FONT_BOLD, 'F2');
  });

  it('gives every digit 556 units in both fonts', () => {
    for (const font of [FONT_REGULAR, FONT_BOLD]) {
      for (const digit of '0123456789') {
        assert.equal(textWidth(digit, font, 1000), 556, `${font} ${digit}`);
      }
    }
  });

  it('measures a three-digit cell number at 4.08 pt', () => {
    assertClose(textWidth('489', FONT_REGULAR, 4.08), 6.805, 0.001, 'width of 489');
  });

  it('uses the AFM widths of space, W and i', () => {
    assert.equal(textWidth(' ', FONT_REGULAR, 1000), 278);
    assert.equal(textWidth('W', FONT_REGULAR, 1000), 944);
    assert.equal(textWidth('i', FONT_REGULAR, 1000), 222);
    assert.equal(textWidth('W', FONT_BOLD, 1000), 944);
    assert.equal(textWidth('i', FONT_BOLD, 1000), 278);
  });

  it('reads code 39 as quotesingle and code 96 as grave', () => {
    assert.equal(textWidth("'", FONT_REGULAR, 1000), 191);
    assert.equal(textWidth("'", FONT_BOLD, 1000), 238);
    assert.equal(textWidth('`', FONT_REGULAR, 1000), 333);
    assert.equal(textWidth('`', FONT_BOLD, 1000), 333);
  });

  it('knows the en dash, middle dot, multiplication sign and ellipsis', () => {
    for (const font of [FONT_REGULAR, FONT_BOLD]) {
      assert.equal(textWidth('–·×…', font, 1000), 556 + 278 + 584 + 1000, font);
    }
  });

  it('counts any other character as the widest ASCII glyph', () => {
    assert.equal(textWidth('é', FONT_REGULAR, 1000), 1015);
    assert.equal(textWidth('é', FONT_BOLD, 1000), 975);
    assert.equal(textWidth('Ё', FONT_REGULAR, 1000), 1015);
  });

  it('scales with the font size and sums the characters', () => {
    assertClose(textWidth('Wi', FONT_REGULAR, 10), 11.66, 1e-9, 'Wi at 10 pt');
    assert.equal(textWidth('', FONT_REGULAR, 10), 0);
  });

  it('rejects an unknown font', () => {
    assert.throws(() => textWidth('a', 'F3', 10), RangeError);
  });
});

describe('fitText', () => {
  it('returns text that fits unchanged', () => {
    assert.equal(fitText('cat.png', FONT_REGULAR, 8, 80 * MM), 'cat.png');
  });

  it('cuts a long text to the longest prefix plus an ellipsis that fits', () => {
    const name = `${'a'.repeat(196)}.png`;
    const limit = 80 * MM;
    const fitted = fitText(name, FONT_REGULAR, 8, limit);
    assert.ok(fitted.endsWith('…'), fitted);
    assert.ok(textWidth(fitted, FONT_REGULAR, 8) <= limit);
    const prefix = fitted.slice(0, -1);
    assert.ok(name.startsWith(prefix));
    const oneMore = `${name.slice(0, prefix.length + 1)}…`;
    assert.ok(textWidth(oneMore, FONT_REGULAR, 8) > limit, 'longest prefix');
  });

  it('keeps surrogate pairs whole', () => {
    const fitted = fitText('😀'.repeat(50), FONT_REGULAR, 10, 50);
    assert.ok(fitted.endsWith('…'));
    assert.ok(!/[�-�]…$/.test(fitted), 'no lone high surrogate');
  });

  it('returns an empty text when not even the ellipsis fits', () => {
    assert.equal(fitText('abc', FONT_REGULAR, 10, 1), '');
  });
});

describe('DMC names in the legend', () => {
  it('fit 115 mm at 9 pt even when every character counts 1015 units', () => {
    const limit = 115 * MM;
    for (const color of DMC_COLORS) {
      const worstCase = [...color.name].length * 1015 * 9 / 1000;
      assert.ok(worstCase <= limit, `${color.code} ${color.name}: ${worstCase} pt`);
      assert.ok(textWidth(color.name, FONT_REGULAR, 9) <= limit, color.code);
    }
  });
});
