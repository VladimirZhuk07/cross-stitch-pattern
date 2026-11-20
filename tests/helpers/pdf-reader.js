// Reads back the PDF files of src/core/pdf-writer.js in tests: the file structure (header,
// xref table, trailer, objects, streams) and the drawing operators of content streams.
// It understands only what our writer produces; it is not a general PDF parser.

import { inflateSync } from 'node:zlib';

const LATIN1 = new TextDecoder('latin1');
const WINDOWS_1252 = new TextDecoder('windows-1252');
const XREF_LINE_LENGTH = 20;

/**
 * Parses a whole PDF (Uint8Array). Returns
 * { header, text, startxref, xrefLines, entries: [{ number, offset, isInUse }], trailer,
 *   objects: Map(number → { number, offset, body, dict, stream, rawStream }) }.
 * body is the text between 'n 0 obj' and 'endobj' (without the stream bytes); dict is the
 * stream dictionary (or the body for other objects); stream holds the stream bytes, inflated
 * when the dictionary has /Filter /FlateDecode; rawStream holds them as stored.
 * Throws Error when the structure is broken.
 */
export function readPdf(bytes) {
  const text = LATIN1.decode(bytes);
  const header = text.slice(0, text.indexOf('\n'));
  const startxrefMatch = /startxref\n(\d+)\n%%EOF\n?$/.exec(text);
  if (startxrefMatch === null) {
    throw new Error('no startxref … %%EOF at the end');
  }
  const startxref = Number(startxrefMatch[1]);
  if (!text.startsWith('xref\n', startxref)) {
    throw new Error(`startxref ${startxref} does not point at xref`);
  }
  const { entries, xrefLines, trailerStart } = readXref(text, startxref);
  const trailerEnd = text.indexOf('\nstartxref', trailerStart);
  const trailer = text.slice(trailerStart, trailerEnd);
  const objects = new Map();
  for (const entry of entries) {
    if (entry.isInUse) {
      objects.set(entry.number, readObject(bytes, text, entry));
    }
  }
  return { header, text, startxref, xrefLines, entries, trailer, objects };
}

function readXref(text, startxref) {
  const subsection = /^xref\n0 (\d+)\n/.exec(text.slice(startxref));
  if (subsection === null) {
    throw new Error('no xref subsection "0 n"');
  }
  const count = Number(subsection[1]);
  let position = startxref + subsection[0].length;
  const entries = [];
  const xrefLines = [];
  for (let number = 0; number < count; number++) {
    const line = text.slice(position, position + XREF_LINE_LENGTH);
    xrefLines.push(line);
    const match = /^(\d{10}) (\d{5}) ([nf])\r\n$/.exec(line);
    if (match === null) {
      throw new Error(`bad xref line ${number}: ${JSON.stringify(line)}`);
    }
    entries.push({ number, offset: Number(match[1]), isInUse: match[3] === 'n' });
    position += XREF_LINE_LENGTH;
  }
  if (!text.startsWith('trailer\n', position)) {
    throw new Error('no trailer after the xref table');
  }
  return { entries, xrefLines, trailerStart: position + 'trailer\n'.length };
}

function readObject(bytes, text, entry) {
  const opening = `${entry.number} 0 obj\n`;
  if (!text.startsWith(opening, entry.offset)) {
    throw new Error(`offset ${entry.offset} of object ${entry.number} does not start "${opening.trim()}"`);
  }
  const start = entry.offset + opening.length;
  const streamAt = text.indexOf('stream\n', start);
  const endobjAt = text.indexOf('endobj\n', start);
  if (streamAt === -1 || streamAt > endobjAt) {
    const body = text.slice(start, endobjAt).trimEnd();
    return { number: entry.number, offset: entry.offset, body, dict: body, stream: null, rawStream: null };
  }
  const dict = text.slice(start, streamAt).trimEnd();
  const length = Number(/\/Length (\d+)/.exec(dict)[1]);
  const dataStart = streamAt + 'stream\n'.length;
  const rawStream = bytes.slice(dataStart, dataStart + length);
  if (!text.startsWith('\nendstream\nendobj\n', dataStart + length)) {
    throw new Error(`object ${entry.number}: /Length ${length} does not end at endstream`);
  }
  const isFlate = dict.includes('/Filter /FlateDecode');
  const stream = isFlate ? new Uint8Array(inflateSync(rawStream)) : rawStream;
  return { number: entry.number, offset: entry.offset, body: dict, dict, stream, rawStream };
}

/** The text of a content stream (Uint8Array, ASCII) as a string. */
export function streamText(stream) {
  return LATIN1.decode(stream);
}

/**
 * Tokenizes a content stream (a string) and follows its graphics state. Returns
 * { fills, fillPaths, strokes, texts, images }:
 *   fills      one { color, x, y, width, height } per 're' filled with 'f'
 *   fillPaths  one { color, points: [[x, y], …] } per 'm'/'l' subpath filled with 'f'
 *   strokes    one { color, width, x1, y1, x2, y2 } per stroked 'm'/'l' segment, and four per
 *              stroked 're'
 *   texts      one { text, font, size, x, y, color } per 'Tj' (text decoded from WinAnsi)
 *   images     one { name, x, y, width, height } per 'Do'
 * Colors are '#RRGGBB'.
 */
export function readContent(content) {
  const state = {
    fill: '#000000', stroke: '#000000', lineWidth: 1, font: null, size: 0,
    matrix: [1, 0, 0, 1, 0, 0], saved: [],
    lineX: 0, lineY: 0, rects: [], subpaths: [],
  };
  const result = { fills: [], fillPaths: [], strokes: [], texts: [], images: [] };
  const operands = [];
  for (const token of tokenize(content)) {
    if (token.kind === 'operator') {
      applyOperator(token.value, operands, state, result);
      operands.length = 0;
    } else {
      operands.push(token.value);
    }
  }
  return result;
}

function applyOperator(operator, operands, state, result) {
  const numbers = operands.map(Number);
  switch (operator) {
    case 'rg': state.fill = rgbHex(numbers); break;
    case 'RG': state.stroke = rgbHex(numbers); break;
    case 'g': state.fill = rgbHex([numbers[0], numbers[0], numbers[0]]); break;
    case 'G': state.stroke = rgbHex([numbers[0], numbers[0], numbers[0]]); break;
    case 'w': state.lineWidth = numbers[0]; break;
    case 're': state.rects.push(numbers); break;
    case 'm': state.subpaths.push([[numbers[0], numbers[1]]]); break;
    case 'l': state.subpaths.at(-1).push([numbers[0], numbers[1]]); break;
    case 'h': break;
    case 'f': fillPath(state, result); break;
    case 'S': strokePath(state, result); break;
    case 'n': clearPath(state); break;
    case 'q': state.saved.push(state.matrix); break;
    case 'Q': state.matrix = state.saved.pop(); break;
    case 'cm': state.matrix = numbers; break;
    case 'Do': {
      const [a, , , d, e, f] = state.matrix;
      result.images.push({ name: operands[0], x: e, y: f, width: a, height: d });
      break;
    }
    case 'BT': state.lineX = 0; state.lineY = 0; break;
    case 'ET': break;
    case 'Tf': state.font = operands[0].slice(1); state.size = numbers[1]; break;
    case 'Tm': state.lineX = numbers[4]; state.lineY = numbers[5]; break;
    case 'Td': state.lineX += numbers[0]; state.lineY += numbers[1]; break;
    case 'Tj':
      result.texts.push({
        text: operands[0], font: state.font, size: state.size,
        x: round(state.lineX), y: round(state.lineY), color: state.fill,
      });
      break;
    default:
      throw new Error(`unknown operator ${operator}`);
  }
}

function fillPath(state, result) {
  for (const [x, y, width, height] of state.rects) {
    result.fills.push({ color: state.fill, x, y, width, height });
  }
  for (const points of state.subpaths) {
    result.fillPaths.push({ color: state.fill, points });
  }
  clearPath(state);
}

function strokePath(state, result) {
  const stroke = (x1, y1, x2, y2) => {
    result.strokes.push({ color: state.stroke, width: state.lineWidth, x1, y1, x2, y2 });
  };
  for (const points of state.subpaths) {
    for (let index = 1; index < points.length; index++) {
      stroke(points[index - 1][0], points[index - 1][1], points[index][0], points[index][1]);
    }
  }
  for (const [x, y, width, height] of state.rects) {
    stroke(x, y, x + width, y);
    stroke(x + width, y, x + width, y + height);
    stroke(x + width, y + height, x, y + height);
    stroke(x, y + height, x, y);
  }
  clearPath(state);
}

function clearPath(state) {
  state.rects = [];
  state.subpaths = [];
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function rgbHex(components) {
  const hex = components.map((value) => Math.round(value * 255).toString(16).toUpperCase().padStart(2, '0'));
  return `#${hex.join('')}`;
}

// Splits content into numbers, names, strings and operators.
function* tokenize(content) {
  let index = 0;
  while (index < content.length) {
    const character = content[index];
    if (/\s/.test(character)) {
      index += 1;
    } else if (character === '(') {
      const { value, end } = readLiteral(content, index);
      yield { kind: 'string', value };
      index = end;
    } else {
      const match = /^[^\s()]+/.exec(content.slice(index, index + 64));
      const word = match[0];
      const isOperand = /^[-+.\d]/.test(word) || word.startsWith('/');
      yield { kind: isOperand ? 'operand' : 'operator', value: word };
      index += word.length;
    }
  }
}

// Reads a literal string starting at '(' and decodes its escapes from WinAnsi.
function readLiteral(content, start) {
  const bytes = [];
  let index = start + 1;
  let depth = 1;
  for (;;) {
    const character = content[index];
    if (character === '\\') {
      const octal = /^[0-7]{1,3}/.exec(content.slice(index + 1, index + 4));
      if (octal !== null) {
        bytes.push(parseInt(octal[0], 8));
        index += 1 + octal[0].length;
        continue;
      }
      bytes.push(content.charCodeAt(index + 1));
      index += 2;
      continue;
    }
    if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth === 0) {
        break;
      }
    }
    bytes.push(content.charCodeAt(index));
    index += 1;
  }
  return { value: WINDOWS_1252.decode(Uint8Array.from(bytes)), end: index + 1 };
}
