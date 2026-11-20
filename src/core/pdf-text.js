// Text in a PDF: the WinAnsi (Windows-1252) encoding of the standard fonts Helvetica and
// Helvetica-Bold, and PDF string literals. Pure.
//
// Why WinAnsi: the 14 standard PDF fonts need no embedded font file, and WinAnsiEncoding covers
// every text of the app (ASCII DMC names, '×', '·', '–', '…') and most Latin file names. Other
// characters print as '?'; the document title keeps them (see pdfTextString).

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
