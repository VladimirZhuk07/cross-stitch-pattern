// Compression with the platform's CompressionStream / DecompressionStream, standard globals in
// browsers, Web Workers and Node 22 (no package). Formats: 'deflate' (zlib, RFC 1950: PDF
// FlateDecode, .stitch files) and 'deflate-raw' (RFC 1951: ZIP entries).

/** The formats this module accepts. */
export const COMPRESSION_FORMATS = Object.freeze(['deflate', 'deflate-raw']);

/** True when this platform can compress and decompress (old browsers lack the streams). */
export function canCompress() {
  return typeof globalThis.CompressionStream === 'function' && typeof globalThis.DecompressionStream === 'function';
}

/**
 * Compresses bytes (a Uint8Array) in format ('deflate' or 'deflate-raw').
 * Resolves to a new Uint8Array. Throws RangeError for an unknown format.
 */
export async function compressBytes(bytes, format) {
  assertFormat(format);
  return pipeBytes(bytes, new CompressionStream(format), Infinity);
}

/**
 * Decompresses bytes (a Uint8Array) in format. Stops and rejects with RangeError as soon as the
 * output would exceed maxLength bytes (default: no limit), so a hostile file cannot fill memory.
 * Rejects (TypeError from the platform) for damaged input, including a wrong zlib checksum.
 */
export async function decompressBytes(bytes, format, maxLength = Infinity) {
  assertFormat(format);
  return pipeBytes(bytes, new DecompressionStream(format), maxLength);
}

function assertFormat(format) {
  if (!COMPRESSION_FORMATS.includes(format)) {
    throw new RangeError(`format must be one of ${COMPRESSION_FORMATS.join(', ')}, got ${String(format)}`);
  }
}

// Writes bytes into a transform stream and collects what comes out. The write is not awaited
// before reading: the stream applies backpressure, so awaiting it first could wait forever.
async function pipeBytes(bytes, transform, maxLength) {
  const writer = transform.writable.getWriter();
  const written = writer.write(bytes).then(() => writer.close());
  written.catch(() => {}); // the same error is reported by the reader below
  const reader = transform.readable.getReader();
  const chunks = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    length += value.length;
    if (length > maxLength) {
      await reader.cancel();
      throw new RangeError(`decompressed data is longer than ${maxLength} bytes`);
    }
    chunks.push(value);
  }
  await written;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
