// Decodes the PNGs written by src/core/png.js: 8-bit RGB, one or more IDAT chunks, filter 0 on
// every row. Enough for the icon tests; it rejects anything else instead of guessing.

import { inflateSync } from 'node:zlib';
import { readPngHeader } from '../../src/core/png.js';

const SIGNATURE_LENGTH = 8;
const BYTES_PER_PIXEL = 3;

/**
 * Decodes PNG bytes (a Uint8Array) into { width, height, rgb } with 3 bytes per pixel,
 * row-major, top-left first. Throws for another color type, bit depth or row filter.
 */
export function decodePngPixels(bytes) {
  const { width, height, bitDepth, colorType } = readPngHeader(bytes);
  if (bitDepth !== 8 || colorType !== 2) {
    throw new Error(`only 8-bit RGB is supported, got bit depth ${bitDepth}, color type ${colorType}`);
  }
  const raw = inflateSync(imageData(bytes));
  const rowLength = width * BYTES_PER_PIXEL;
  if (raw.length !== height * (rowLength + 1)) {
    throw new Error(`expected ${height * (rowLength + 1)} bytes of image data, got ${raw.length}`);
  }
  const rgb = new Uint8Array(width * height * BYTES_PER_PIXEL);
  for (let y = 0; y < height; y++) {
    const start = y * (rowLength + 1);
    if (raw[start] !== 0) {
      throw new Error(`row ${y} uses filter ${raw[start]}, only filter 0 is supported`);
    }
    rgb.set(raw.subarray(start + 1, start + 1 + rowLength), y * rowLength);
  }
  return { width, height, rgb };
}

// The concatenated data of all IDAT chunks.
function imageData(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts = [];
  let offset = SIGNATURE_LENGTH;
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
    if (type === 'IDAT') {
      parts.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += 12 + length;
  }
  return Buffer.concat(parts);
}
