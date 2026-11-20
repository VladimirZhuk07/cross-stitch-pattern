// Unit tests for src/core/pdf-text.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWinAnsi, pdfString, pdfTextString } from '../../../src/core/pdf-text.js';

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
