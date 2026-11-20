// CRC-32 (IEEE 802.3, reflected polynomial 0xEDB88320), the checksum of ZIP entries and PNG
// chunks. Pure. The 256-entry lookup table is computed once when the module is loaded.

const POLYNOMIAL = 0xedb88320;
const TABLE = makeTable();

function makeTable() {
  const table = new Uint32Array(256);
  for (let byte = 0; byte < 256; byte++) {
    let crc = byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) === 1 ? POLYNOMIAL ^ (crc >>> 1) : crc >>> 1;
    }
    table[byte] = crc >>> 0;
  }
  return table;
}

/**
 * The CRC-32 of bytes (a Uint8Array) as an unsigned 32-bit integer.
 * previous  the CRC of the data before these bytes, to continue a running checksum (default 0)
 */
export function crc32(bytes, previous = 0) {
  let crc = (previous ^ 0xffffffff) >>> 0;
  for (let index = 0; index < bytes.length; index++) {
    crc = TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
