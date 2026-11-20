// Unit tests for src/core/pdf-content.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose } from '../../helpers/assert-close.js';
import { readContent } from '../../helpers/pdf-reader.js';
import {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  POINTS_PER_MM,
  fillColor,
  lineWidth,
  pdfX,
  pdfY,
  rect,
  segment,
  strokeColor,
  textAt,
} from '../../../src/core/pdf-content.js';

describe('page geometry', () => {
  it('is A4 in points, 72 / 25.4 points per mm', () => {
    assert.equal(PAGE_WIDTH, 595.28);
    assert.equal(PAGE_HEIGHT, 841.89);
    assertClose(POINTS_PER_MM, 2.834646, 1e-6, 'points per mm');
  });

  it('turns mm from the top-left corner into points from the bottom-left corner', () => {
    assertClose(pdfX(30), 85.039, 0.001, 'x');
    assertClose(pdfY(23), 776.693, 0.001, 'y');
    assertClose(pdfY(0), 841.89, 1e-9, 'top');
  });
});

describe('colors and lines', () => {
  it('writes fill colors as rg with 3 decimals', () => {
    assert.equal(fillColor('#FFC0BB'), '1 0.753 0.733 rg');
    assert.equal(fillColor('#000000'), '0 0 0 rg');
    assert.equal(fillColor('#b0b0b0'), '0.69 0.69 0.69 rg');
  });

  it('writes stroke colors as RG', () => {
    assert.equal(strokeColor('#A0A0A0'), '0.627 0.627 0.627 RG');
  });

  it('rejects a color that is not #RRGGBB', () => {
    assert.throws(() => fillColor('red'), TypeError);
  });

  it('writes line widths in points', () => {
    assert.equal(lineWidth(0.3), '0.3 w');
  });
});

describe('rect and segment', () => {
  it('turns a rect given in mm from the top into a re in points from the bottom', () => {
    assert.equal(rect(30, 23, 3.2, 3.2), '85.04 767.62 9.07 9.07 re');
  });

  it('turns a segment given in mm into m and l', () => {
    assert.equal(segment(30, 23, 190, 23), '85.04 776.69 m 538.58 776.69 l');
  });
});

describe('textAt', () => {
  it('writes a text block with font, size and position', () => {
    assert.equal(textAt('2', 'F1', 4.08, 30, 23), 'BT /F1 4.08 Tf 85.04 776.69 Td (2) Tj ET');
  });

  it('aligns right and centre by the text width', () => {
    const right = readContent(textAt('Page', 'F2', 10, 200, 20, 'right')).texts[0];
    assertClose(right.x, pdfX(200) - (667 + 556 + 611 + 556) / 100, 0.01, 'right x');
    const centre = readContent(textAt('10', 'F1', 6, 100, 20, 'center')).texts[0];
    assertClose(centre.x, pdfX(100) - 556 * 6 / 1000, 0.01, 'centre x');
  });

  it('writes non-ASCII characters as escapes, so the output is ASCII only', () => {
    const content = textAt('café – Ёлка', 'F1', 11, 10, 24);
    assert.ok(/^[\x20-\x7e]*$/.test(content), content);
    assert.equal(readContent(content).texts[0].text, 'café – ????');
  });

  it('rejects an unknown alignment', () => {
    assert.throws(() => textAt('a', 'F1', 8, 0, 0, 'justify'), RangeError);
  });
});
