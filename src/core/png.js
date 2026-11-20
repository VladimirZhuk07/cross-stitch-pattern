// A minimal PNG writer and header reader for the app icons (opaque 8-bit RGB, one IDAT chunk,
// filter 0 on every row). Pure: compression comes from the platform's CompressionStream via
// compression.js. Chunk layout: PNG specification (W3C, 2nd edition), sections 5.2–5.4.

import { crc32 } from './crc32.js';
import { compressBytes } from './compression.js';

const SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BYTES_PER_PIXEL = 3;
const BIT_DEPTH = 8;
const COLOR_TYPE_RGB = 2;
const FILTER_NONE = 0;
const IHDR_LENGTH = 13;
// Signature, length, type and the IHDR data: everything readPngHeader needs.
const HEADER_BYTES = SIGNATURE.length + 8 + IHDR_LENGTH;

/**
 * Encodes an IconImage (see app-icon.js: { width, height, rgb }, rgb holding 3 bytes per pixel,
 * row-major, top-left first) as a PNG file.
 * Resolves to a Uint8Array. Rejects with a RangeError when rgb.length is not width × height × 3.
 */
export async function encodePng(image) {
  const { width, height, rgb } = image;
  const expectedLength = width * height * BYTES_PER_PIXEL;
  if (rgb.length !== expectedLength) {
    throw new RangeError(`rgb must hold ${width} × ${height} × 3 = ${expectedLength} bytes, got ${rgb.length}`);
  }
  const header = new Uint8Array(IHDR_LENGTH);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = BIT_DEPTH;
  header[9] = COLOR_TYPE_RGB;
  // Bytes 10–12 stay 0: compression method, filter method, no interlace.
  const compressed = await compressBytes(filteredRows(image), 'deflate');
  return concatBytes([SIGNATURE, chunk('IHDR', header), chunk('IDAT', compressed), chunk('IEND', new Uint8Array(0))]);
}

/**
 * Reads the image header of a PNG file (a Uint8Array).
 * Returns { width, height, bitDepth, colorType }. Throws a TypeError when the bytes are too
 * short, do not start with the PNG signature, or the first chunk is not IHDR.
 */
export function readPngHeader(bytes) {
  if (bytes.length < HEADER_BYTES) {
    throw new TypeError(`a PNG header needs ${HEADER_BYTES} bytes, got a file that is too short (${bytes.length})`);
  }
  for (let index = 0; index < SIGNATURE.length; index++) {
    if (bytes[index] !== SIGNATURE[index]) {
      throw new TypeError('not a PNG file: the signature does not match');
    }
  }
  const type = new TextDecoder().decode(bytes.subarray(12, 16));
  if (type !== 'IHDR') {
    throw new TypeError(`the first PNG chunk must be IHDR, got ${type}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

// Each row becomes the filter byte 0 followed by its pixels.
function filteredRows({ width, height, rgb }) {
  const rowLength = width * BYTES_PER_PIXEL;
  const out = new Uint8Array(height * (rowLength + 1));
  for (let y = 0; y < height; y++) {
    const start = y * (rowLength + 1);
    out[start] = FILTER_NONE;
    out.set(rgb.subarray(y * rowLength, (y + 1) * rowLength), start + 1);
  }
  return out;
}

// One chunk: data length, type, data, and the CRC-32 over type and data.
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concatBytes(parts) {
  let length = 0;
  for (const part of parts) {
    length += part.length;
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
