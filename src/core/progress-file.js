// The .stitch progress file: encoding, decoding and its texts. Pure: no DOM, no storage, no
// network; the compression streams behind ./compression.js are standard globals in browsers,
// workers and Node. The authoritative description is openspec/specs/stitch-progress/spec.md
// ("The .stitch file format"); the choices are explained in design D1–D2 of add-progress-file.
//
// File layout, little-endian, a fixed 30-byte header and then the compressed bits:
//   offset  bytes  field
//   0       6      magic, ASCII 'STITCH' (53 54 49 54 43 48)
//   6       2      format version, uint16, PROGRESS_FILE_FORMAT
//   8       4      width in stitches, uint32
//   12      4      height in stitches, uint32
//   16      14     the pattern fingerprint, 14 ASCII lowercase hex digits (./pattern.js)
//   30      rest   zlib deflate (RFC 1950) of the Progress bits (./progress.js), exactly
//                  ceil(width × height / 8) bytes once inflated
// The file holds no image, no file name and no counts (they are recounted on load).

import { compressBytes, decompressBytes } from './compression.js';
import { restoreProgress, SAVED_PROGRESS_FORMAT } from './progress.js';
import { MAX_GRID_SIDE } from './stitch-grid.js';

/** The file name extension of progress files (without the dot). */
export const PROGRESS_FILE_EXTENSION = 'stitch';

/** The format version this app writes; a file with a higher version is "newer". */
export const PROGRESS_FILE_FORMAT = 1;

/**
 * Files larger than this are refused before they are read. The largest valid file (a
 * 10000 × 10000 pattern with random marks) is 30 + 12,500,000 bytes plus a few kB of deflate
 * overhead.
 */
export const MAX_PROGRESS_FILE_BYTES = 16 * 1024 * 1024;

const MAGIC = 'STITCH';
const VERSION_OFFSET = 6;
const WIDTH_OFFSET = 8;
const HEIGHT_OFFSET = 12;
const FINGERPRINT_OFFSET = 16;
const FINGERPRINT_LENGTH = 14;
const HEADER_LENGTH = FINGERPRINT_OFFSET + FINGERPRINT_LENGTH;
const FINGERPRINT_PATTERN = /^[0-9a-f]{14}$/;
const COMPRESSION_FORMAT = 'deflate';
const BITS_PER_BYTE = 8;

/**
 * Encodes progress as the bytes of a .stitch file.
 * saved  a SavedProgress (../core/progress.js toSavedProgress) or any object with
 *        fingerprint  14 lowercase hex digits
 *        width, height  the pattern size in stitches, integers 1–MAX_GRID_SIDE
 *        bits  a Uint8Array of ceil(width × height / 8) bytes in the Progress layout
 * Resolves to a new Uint8Array. Rejects with TypeError for a bad fingerprint or bits that are
 * not a Uint8Array, RangeError for a bad width, height or bits length.
 */
export async function encodeProgressFile(saved) {
  const { fingerprint, width, height, bits } = saved;
  if (typeof fingerprint !== 'string' || !FINGERPRINT_PATTERN.test(fingerprint)) {
    throw new TypeError(`fingerprint must be 14 lowercase hex digits, got ${String(fingerprint)}`);
  }
  checkSide('width', width);
  checkSide('height', height);
  if (!(bits instanceof Uint8Array)) {
    throw new TypeError(`bits must be a Uint8Array, got ${Object.prototype.toString.call(bits)}`);
  }
  const expectedLength = bitsLength(width, height);
  if (bits.length !== expectedLength) {
    throw new RangeError(`bits must be ${expectedLength} bytes for ${width} × ${height}, got ${bits.length}`);
  }
  const compressed = await compressBytes(bits, COMPRESSION_FORMAT);
  const bytes = new Uint8Array(HEADER_LENGTH + compressed.length);
  const view = new DataView(bytes.buffer);
  bytes.set(asciiBytes(MAGIC), 0);
  view.setUint16(VERSION_OFFSET, PROGRESS_FILE_FORMAT, true);
  view.setUint32(WIDTH_OFFSET, width, true);
  view.setUint32(HEIGHT_OFFSET, height, true);
  bytes.set(asciiBytes(fingerprint), FINGERPRINT_OFFSET);
  bytes.set(compressed, HEADER_LENGTH);
  return bytes;
}

/**
 * Reads the bytes of a .stitch file (a Uint8Array, not modified) for pattern (a Pattern,
 * ./pattern.js). Resolves to a fresh Progress (./progress.js: version 0, lastToggled null) of
 * pattern; bits of empty cells and padding bits in the file are ignored and the stitches are
 * recounted.
 */
export async function decodeProgressFile(bytes, pattern) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(WIDTH_OFFSET, true);
  const height = view.getUint32(HEIGHT_OFFSET, true);
  const fingerprint = asciiText(bytes.subarray(FINGERPRINT_OFFSET, HEADER_LENGTH));
  const expectedLength = bitsLength(width, height);
  const bits = await decompressBytes(bytes.subarray(HEADER_LENGTH), COMPRESSION_FORMAT, expectedLength);
  // restoreProgress is the same check and cleanup as for the browser's saved progress.
  return restoreProgress(pattern, { formatVersion: SAVED_PROGRESS_FORMAT, fingerprint, width, height, bits });
}

function checkSide(name, value) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_GRID_SIDE) {
    throw new RangeError(`${name} must be an integer 1–${MAX_GRID_SIDE}, got ${String(value)}`);
  }
}

function bitsLength(width, height) {
  return Math.ceil((width * height) / BITS_PER_BYTE);
}

// The bytes of an ASCII-only text (the magic and the fingerprint).
function asciiBytes(text) {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

// The text of ASCII bytes; any other byte becomes a character that never matches a fingerprint.
function asciiText(bytes) {
  return String.fromCharCode(...bytes);
}
