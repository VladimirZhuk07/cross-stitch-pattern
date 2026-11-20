// Text in a PDF: the WinAnsi (Windows-1252) encoding of the standard fonts Helvetica and
// Helvetica-Bold, their text widths, and PDF string literals. Pure.
//
// Why WinAnsi: the 14 standard PDF fonts need no embedded font file, and WinAnsiEncoding covers
// every text of the app (ASCII DMC names, '×', '·', '–', '…') and most Latin file names. Other
// characters print as '?'; the document title keeps them (see pdfTextString).
//
// Widths: advance widths in 1/1000 em, copied from Adobe's Core14 AFM files "Helvetica.afm" and
// "Helvetica-Bold.afm" (Copyright 1985–1997 Adobe Systems Incorporated, UniqueID 43054 and
// 43052, AFM 4.1), the metrics every PDF viewer uses for these two fonts. Codes 32–126 in
// WinAnsi order: code 39 is quotesingle and code 96 is grave.

/** The resource name of Helvetica in every page's Resources dictionary. */
export const FONT_REGULAR = 'F1';
/** The resource name of Helvetica-Bold. */
export const FONT_BOLD = 'F2';

/** Cap height of both fonts as a fraction of the font size (AFM CapHeight 718). */
export const CAP_HEIGHT = 0.718;

/** The text that ends a cut text. */
export const ELLIPSIS = '…';

const FIRST_TABLE_CODE = 32;

const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // 32–47
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 48–63
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // 64–79
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // 80–95
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // 96–111
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // 112–126
];

const HELVETICA_BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, // 32–47
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, // 48–63
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, // 64–79
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, // 80–95
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, // 96–111
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, // 112–126
];

// endash, periodcentered, multiply and ellipsis: the same in both AFM files.
const EXTRA_WIDTHS = new Map([['–', 556], ['·', 278], ['×', 584], ['…', 1000]]);

// Any other character counts as the widest ASCII glyph ('at'), so a fitted text never runs over
// its space whatever the real glyph is.
const FONT_METRICS = new Map([
  [FONT_REGULAR, { widths: HELVETICA_WIDTHS, fallback: 1015 }],
  [FONT_BOLD, { widths: HELVETICA_BOLD_WIDTHS, fallback: 975 }],
]);

const UNITS_PER_EM = 1000;

/** The byte that replaces a character WinAnsiEncoding cannot show. */
const REPLACEMENT_BYTE = 0x3f; // '?'

// The 27 characters that Windows-1252 places in 0x80–0x9F (the other five codes are unused).
const HIGH_CONTROL_RANGE = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
  [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
  [0x017e, 0x9e], [0x0178, 0x9f],
]);

const PRINTABLE_FIRST = 0x20;
const PRINTABLE_LAST = 0x7e;
const LATIN1_FIRST = 0xa0;
const LATIN1_LAST = 0xff;

/**
 * The WinAnsi byte of one Unicode code point, or REPLACEMENT_BYTE ('?') when the encoding has
 * no such character.
 */
function winAnsiByte(codePoint) {
  if (codePoint >= PRINTABLE_FIRST && codePoint <= PRINTABLE_LAST) {
    return codePoint;
  }
  if (codePoint >= LATIN1_FIRST && codePoint <= LATIN1_LAST) {
    return codePoint;
  }
  return HIGH_CONTROL_RANGE.get(codePoint) ?? REPLACEMENT_BYTE;
}

/**
 * Encodes text in WinAnsiEncoding (Windows-1252), one byte per code point: 'café' → 63 61 66 E9.
 * Characters outside the encoding (and control characters) become '?'. Returns a Uint8Array.
 */
export function encodeWinAnsi(text) {
  const bytes = [];
  for (const character of text) {
    bytes.push(winAnsiByte(character.codePointAt(0)));
  }
  return Uint8Array.from(bytes);
}

/**
 * A PDF literal string '(…)' for text shown in a standard font, in pure ASCII: '(', ')' and
 * '\' are escaped, and WinAnsi bytes outside 0x20–0x7E are written as octal '\ddd'.
 * pdfString('é') → '(\351)'.
 */
export function pdfString(text) {
  let out = '(';
  for (const byte of encodeWinAnsi(text)) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      out += `\\${String.fromCharCode(byte)}`;
    } else if (byte < PRINTABLE_FIRST || byte > PRINTABLE_LAST) {
      out += `\\${byte.toString(8).padStart(3, '0')}`;
    } else {
      out += String.fromCharCode(byte);
    }
  }
  return `${out})`;
}

/**
 * A PDF text string for metadata (the document title) that keeps every Unicode character:
 * UTF-16BE hex with a byte order mark. pdfTextString('Ёлка') → '<FEFF0401043B043A0430>'.
 */
export function pdfTextString(text) {
  let hex = '<FEFF';
  for (let index = 0; index < text.length; index++) {
    hex += text.charCodeAt(index).toString(16).toUpperCase().padStart(4, '0');
  }
  return `${hex}>`;
}

/**
 * The width in points of text set in font (FONT_REGULAR or FONT_BOLD) at size points.
 * Throws RangeError for another font name.
 */
export function textWidth(text, font, size) {
  const metrics = FONT_METRICS.get(font);
  if (metrics === undefined) {
    throw new RangeError(`font must be ${FONT_REGULAR} or ${FONT_BOLD}, got ${String(font)}`);
  }
  let units = 0;
  for (const character of text) {
    units += characterWidth(character, metrics);
  }
  return (units * size) / UNITS_PER_EM;
}

function characterWidth(character, metrics) {
  const tableIndex = character.codePointAt(0) - FIRST_TABLE_CODE;
  if (tableIndex >= 0 && tableIndex < metrics.widths.length) {
    return metrics.widths[tableIndex];
  }
  return EXTRA_WIDTHS.get(character) ?? metrics.fallback;
}

/**
 * Fits text into maxWidth points in font at size points: returns the text unchanged when it
 * fits, otherwise its longest prefix (whole characters) followed by '…' that fits, or '' when
 * not even '…' fits.
 */
export function fitText(text, font, size, maxWidth) {
  if (textWidth(text, font, size) <= maxWidth) {
    return text;
  }
  const characters = [...text];
  let width = textWidth(ELLIPSIS, font, size);
  if (width > maxWidth) {
    return '';
  }
  let count = 0;
  while (count < characters.length) {
    const next = width + textWidth(characters[count], font, size);
    if (next > maxWidth) {
      break;
    }
    width = next;
    count += 1;
  }
  return `${characters.slice(0, count).join('')}${ELLIPSIS}`;
}
