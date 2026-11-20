// Small builders for PDF content stream operators (ISO 32000-1, sections 8 and 9): colors,
// rectangles, line segments and single texts. Pure; every function returns ASCII text.
//
// Page modules place things in mm from the top-left corner of an A4 page, as on paper. PDF
// measures in points (1/72 in) from the bottom-left corner; pdfX and pdfY convert.

import { pdfNumber } from './pdf-writer.js';
import { pdfString, textWidth } from './pdf-text.js';

/** Points per millimetre (72 points per inch, 25.4 mm per inch). */
export const POINTS_PER_MM = 72 / 25.4;
/** A4 portrait in points: 210 × 297 mm, as in the page tree's /MediaBox. */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const COLOR_DECIMALS = 3;
const ALIGNMENTS = new Set(['left', 'center', 'right']);

/** Points from the left page edge of x mm from the left edge. */
export function pdfX(xMm) {
  return xMm * POINTS_PER_MM;
}

/** Points from the bottom page edge of y mm from the top edge. */
export function pdfY(yMm) {
  return PAGE_HEIGHT - yMm * POINTS_PER_MM;
}

/** The fill color operator for hex '#RRGGBB': fillColor('#FFC0BB') → '1 0.753 0.733 rg'. */
export function fillColor(hex) {
  return `${rgbComponents(hex)} rg`;
}

/** The stroke color operator for hex '#RRGGBB': '… RG'. */
export function strokeColor(hex) {
  return `${rgbComponents(hex)} RG`;
}

function rgbComponents(hex) {
  if (!HEX_COLOR.test(hex)) {
    throw new TypeError(`a color must be #RRGGBB, got ${String(hex)}`);
  }
  const components = [];
  for (let index = 1; index < 7; index += 2) {
    components.push(pdfNumber(parseInt(hex.slice(index, index + 2), 16) / 255, COLOR_DECIMALS));
  }
  return components.join(' ');
}

/** The line width operator for width points: lineWidth(0.3) → '0.3 w'. */
export function lineWidth(width) {
  return `${pdfNumber(width)} w`;
}

/**
 * A rectangle path ('re') for a box whose top-left corner is x, y mm from the page's top-left
 * corner, width × height mm: rect(30, 23, 3.2, 3.2) → '85.04 767.62 9.07 9.07 re'.
 */
export function rect(xMm, yMm, widthMm, heightMm) {
  const values = [pdfX(xMm), pdfY(yMm + heightMm), widthMm * POINTS_PER_MM, heightMm * POINTS_PER_MM];
  return `${values.map((value) => pdfNumber(value)).join(' ')} re`;
}

/** A straight path segment ('m', 'l') from x1, y1 to x2, y2, all in mm from the top-left. */
export function segment(x1Mm, y1Mm, x2Mm, y2Mm) {
  return `${point(x1Mm, y1Mm)} m ${point(x2Mm, y2Mm)} l`;
}

function point(xMm, yMm) {
  return `${pdfNumber(pdfX(xMm))} ${pdfNumber(pdfY(yMm))}`;
}

/**
 * One text in its own text block: font ('F1' or 'F2', see ./pdf-text.js) at size points, with
 * its baseline at y mm from the top. align 'left' (default) starts the text at x mm, 'right'
 * ends it there and 'center' centres it there, by the font's widths.
 * textAt('2', 'F1', 4.08, 30, 23) → 'BT /F1 4.08 Tf 85.04 776.69 Td (2) Tj ET'.
 */
export function textAt(text, font, size, xMm, yMm, align = 'left') {
  if (!ALIGNMENTS.has(align)) {
    throw new RangeError(`align must be left, center or right, got ${String(align)}`);
  }
  let x = pdfX(xMm);
  if (align === 'right') {
    x -= textWidth(text, font, size);
  } else if (align === 'center') {
    x -= textWidth(text, font, size) / 2;
  }
  return `BT /${font} ${pdfNumber(size)} Tf ${pdfNumber(x)} ${pdfNumber(pdfY(yMm))} Td ${pdfString(text)} Tj ET`;
}
