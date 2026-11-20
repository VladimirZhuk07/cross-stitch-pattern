// A minimal ZIP writer for the Excel export: stored or deflated entries, no ZIP64, no extra
// fields, no comments. Pure: the timestamps are fixed, so the same entries give the same bytes.
// Layout: PKWARE APPNOTE.TXT 6.3.x, §4.3 (local file header, data, central directory, end of
// central directory record).

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_HEADER_LENGTH = 30;
const CENTRAL_HEADER_LENGTH = 46;
const END_OF_CENTRAL_DIRECTORY_LENGTH = 22;

// 2.0: the version that introduced deflate; the high byte 0 says "MS-DOS attributes".
const ZIP_VERSION = 20;
// No clock in core/: every entry is dated 1980-01-01 00:00, the earliest DOS date
// (day 1 | month 1 << 5 | (1980 − 1980) << 9).
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

/** Entry methods: 0 stored, 8 deflate. */
export const METHOD_STORED = 0;
export const METHOD_DEFLATE = 8;

// Without ZIP64 a count is 16 bits and sizes and offsets are 32 bits.
const MAX_ENTRIES = 0xffff;
const MAX_FOUR_BYTE_VALUE = 0xffffffff;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

// ZipEntry, the input of zipArchive (buildZip below creates it):
//   name    the path inside the archive: printable ASCII, not empty, no leading '/'
//           (e.g. 'xl/workbook.xml'); flags stay 0, because no name needs UTF-8.
//   method  METHOD_STORED or METHOD_DEFLATE
//   crc     CRC-32 of the uncompressed bytes, unsigned 32-bit
//   size    length of the uncompressed bytes
//   data    Uint8Array: the bytes as stored in the archive (deflated for METHOD_DEFLATE)

/**
 * Lays out a ZIP archive from entries (a list of ZipEntry, in archive order).
 * Returns a new Uint8Array. Throws TypeError for a bad name or method; RangeError for more than
 * 65,535 entries, an entry of 4 GiB or more, or an archive reaching 4 GiB (no ZIP64).
 */
export function zipArchive(entries) {
  if (entries.length > MAX_ENTRIES) {
    throw new RangeError(`a ZIP without ZIP64 holds at most ${MAX_ENTRIES} entries, got ${entries.length}`);
  }
  const names = entries.map((entry) => checkEntry(entry));
  let localLength = 0;
  let centralLength = 0;
  for (let index = 0; index < entries.length; index++) {
    localLength += LOCAL_HEADER_LENGTH + names[index].length + entries[index].data.length;
    centralLength += CENTRAL_HEADER_LENGTH + names[index].length;
  }
  const totalLength = localLength + centralLength + END_OF_CENTRAL_DIRECTORY_LENGTH;
  if (totalLength > MAX_FOUR_BYTE_VALUE) {
    throw new RangeError(`a ZIP without ZIP64 must stay below 4 GiB, got ${totalLength} bytes`);
  }

  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer);
  const localOffsets = [];
  let offset = 0;
  for (let index = 0; index < entries.length; index++) {
    localOffsets.push(offset);
    offset = writeLocalHeader(view, offset, entries[index], names[index]);
    out.set(entries[index].data, offset);
    offset += entries[index].data.length;
  }
  for (let index = 0; index < entries.length; index++) {
    offset = writeCentralHeader(view, offset, entries[index], names[index], localOffsets[index]);
  }
  writeEndOfCentralDirectory(view, offset, entries.length, centralLength, localLength);
  return out;
}

// Validates one entry and returns its name as bytes.
function checkEntry(entry) {
  const { name, method, size, data } = entry;
  if (typeof name !== 'string' || !PRINTABLE_ASCII.test(name) || name.startsWith('/')) {
    throw new TypeError(`ZIP entry names must be printable ASCII without a leading "/", got ${JSON.stringify(name)}`);
  }
  if (method !== METHOD_STORED && method !== METHOD_DEFLATE) {
    throw new TypeError(`ZIP entry ${name} has method ${String(method)}, expected 0 or 8`);
  }
  if (!(data instanceof Uint8Array)) {
    throw new TypeError(`ZIP entry ${name} data must be a Uint8Array, got ${String(data)}`);
  }
  if (size > MAX_FOUR_BYTE_VALUE || data.length > MAX_FOUR_BYTE_VALUE) {
    throw new RangeError(`ZIP entry ${name} must be smaller than 4 GiB, got ${Math.max(size, data.length)} bytes`);
  }
  return new TextEncoder().encode(name);
}

// The fields that the local and the central header share, from "version needed" to the
// name length. Returns the offset after them.
function writeCommonFields(view, offset, entry, name) {
  view.setUint16(offset, ZIP_VERSION, true);
  view.setUint16(offset + 2, 0, true); // flags
  view.setUint16(offset + 4, entry.method, true);
  view.setUint16(offset + 6, DOS_TIME, true);
  view.setUint16(offset + 8, DOS_DATE, true);
  view.setUint32(offset + 10, entry.crc >>> 0, true);
  view.setUint32(offset + 14, entry.data.length, true);
  view.setUint32(offset + 18, entry.size, true);
  view.setUint16(offset + 22, name.length, true);
  view.setUint16(offset + 24, 0, true); // extra field length
  return offset + 26;
}

function writeLocalHeader(view, offset, entry, name) {
  view.setUint32(offset, LOCAL_HEADER_SIGNATURE, true);
  const nameOffset = writeCommonFields(view, offset + 4, entry, name);
  new Uint8Array(view.buffer).set(name, nameOffset);
  return nameOffset + name.length;
}

function writeCentralHeader(view, offset, entry, name, localOffset) {
  view.setUint32(offset, CENTRAL_HEADER_SIGNATURE, true);
  view.setUint16(offset + 4, ZIP_VERSION, true); // version made by
  const afterCommon = writeCommonFields(view, offset + 6, entry, name);
  view.setUint16(afterCommon, 0, true); // comment length
  view.setUint16(afterCommon + 2, 0, true); // disk number start
  view.setUint16(afterCommon + 4, 0, true); // internal attributes
  view.setUint32(afterCommon + 6, 0, true); // external attributes
  view.setUint32(afterCommon + 10, localOffset, true);
  const nameOffset = afterCommon + 14;
  new Uint8Array(view.buffer).set(name, nameOffset);
  return nameOffset + name.length;
}

function writeEndOfCentralDirectory(view, offset, entryCount, centralLength, centralOffset) {
  view.setUint32(offset, END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
  view.setUint16(offset + 4, 0, true); // number of this disk
  view.setUint16(offset + 6, 0, true); // disk with the central directory
  view.setUint16(offset + 8, entryCount, true);
  view.setUint16(offset + 10, entryCount, true);
  view.setUint32(offset + 12, centralLength, true);
  view.setUint32(offset + 16, centralOffset, true);
  view.setUint16(offset + 20, 0, true); // comment length
}
