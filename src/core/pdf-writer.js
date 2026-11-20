// A minimal PDF 1.4 file writer: numbered objects and streams, the cross-reference table and the
// trailer, joined into one Uint8Array. Pure. It knows nothing about pages or drawing; see
// ./pdf-document.js for the document built with it.
//
// File layout (ISO 32000-1, section 7.5):
//   %PDF-1.4, then a comment of bytes ≥ 128 so transfer tools treat the file as binary;
//   'n 0 obj\n<body>\nendobj\n' per object, in the order written;
//   'xref', one 20-byte line per object number, 'trailer << … >>', 'startxref', '%%EOF'.

// '%PDF-1.4\n%âãÏÓ\n'
const HEADER = Uint8Array.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
]);
const OFFSET_DIGITS = 10;
const ASCII_LAST = 0x7f;

/**
 * A number in PDF syntax: fixed-point with at most `decimals` decimals (default 2), trailing
 * zeros removed, never an exponent, and '-0' written as '0'. pdfNumber(85.03937) → '85.04'.
 * Throws RangeError for NaN and infinite values.
 */
export function pdfNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`a PDF number must be finite, got ${value}`);
  }
  let text = value.toFixed(decimals);
  if (text.includes('.')) {
    text = text.replace(/0+$/, '').replace(/\.$/, '');
  }
  return text === '-0' ? '0' : text;
}

/**
 * Creates a PDF writer. Returns
 *   reserve()                       hands out the next object number without writing it, so an
 *                                   object (e.g. the page tree) can be referred to before it
 *                                   is written;
 *   addObject(body, number?)        writes 'n 0 obj\n<body>\nendobj\n' under a new number, or
 *                                   under a reserved one; returns the number;
 *   addStream(dict, bytes, number?) writes a stream object: '<< <dict> /Length n >>', then the
 *                                   bytes (a Uint8Array) between 'stream' and 'endstream';
 *                                   returns the number;
 *   finish({ root, info })          writes the xref table and the trailer naming the catalog
 *                                   (root) and the document information (info) object numbers,
 *                                   and returns the whole file as one Uint8Array.
 * body and dict must be ASCII text (RangeError otherwise). Writing a number twice, or one not
 * handed out, throws Error, and so does finish while a reserved number was never written.
 */
export function createPdfWriter() {
  const chunks = [HEADER];
  const offsets = [];
  let length = HEADER.length;
  let nextNumber = 1;

  function claim(number) {
    if (number === undefined) {
      nextNumber += 1;
      return nextNumber - 1;
    }
    if (!Number.isInteger(number) || number < 1 || number >= nextNumber) {
      throw new Error(`object ${number} was not reserved`);
    }
    if (offsets[number] !== undefined) {
      throw new Error(`object ${number} was already written`);
    }
    return number;
  }

  function append(bytes) {
    chunks.push(bytes);
    length += bytes.length;
  }

  function addObject(body, number) {
    const own = claim(number);
    offsets[own] = length;
    append(asciiBytes(`${own} 0 obj\n${body}\nendobj\n`));
    return own;
  }

  function addStream(dict, bytes, number) {
    const own = claim(number);
    offsets[own] = length;
    const entries = dict === '' ? '' : `${dict} `;
    append(asciiBytes(`${own} 0 obj\n<< ${entries}/Length ${bytes.length} >>\nstream\n`));
    append(bytes);
    append(asciiBytes('\nendstream\nendobj\n'));
    return own;
  }

  function finish({ root, info }) {
    const xrefOffset = length;
    let xref = `xref\n0 ${nextNumber}\n0000000000 65535 f\r\n`;
    for (let number = 1; number < nextNumber; number++) {
      if (offsets[number] === undefined) {
        throw new Error(`object ${number} was reserved but never written`);
      }
      xref += `${String(offsets[number]).padStart(OFFSET_DIGITS, '0')} 00000 n\r\n`;
    }
    xref += `trailer\n<< /Size ${nextNumber} /Root ${root} 0 R /Info ${info} 0 R >>\n`;
    xref += `startxref\n${xrefOffset}\n%%EOF\n`;
    append(asciiBytes(xref));
    return joinChunks(chunks, length);
  }

  return { reserve: () => claim(undefined), addObject, addStream, finish };
}

/**
 * The bytes of an ASCII text, one per character. Content streams and dictionaries are ASCII
 * by construction (see pdfString in ./pdf-text.js). Throws RangeError for other characters.
 */
export function asciiBytes(text) {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code > ASCII_LAST) {
      throw new RangeError(`PDF syntax must be ASCII, got U+${code.toString(16).toUpperCase()} at ${index}`);
    }
    bytes[index] = code;
  }
  return bytes;
}

function joinChunks(chunks, length) {
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
