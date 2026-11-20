// Browser glue for .stitch progress files (design D3 of add-progress-file): bytes from
// ../core/progress-file.js become a downloaded Blob, and a chosen File becomes bytes. Nothing
// is uploaded; the format itself lives in core.

import { downloadBlob } from './download.js';

// No MIME type is registered for .stitch files.
const PROGRESS_FILE_TYPE = 'application/octet-stream';

/**
 * Downloads the bytes of a .stitch file (a Uint8Array) as fileName (e.g. 'cat.stitch').
 * doc  the document (default globalThis.document)
 */
export function downloadProgressFile(bytes, fileName, doc = globalThis.document) {
  downloadBlob(new Blob([bytes], { type: PROGRESS_FILE_TYPE }), fileName, doc);
}

/** Resolves to the content of a File (or Blob) chosen by the user, as a new Uint8Array. */
export async function readFileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}
