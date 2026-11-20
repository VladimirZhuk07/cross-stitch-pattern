// The Excel worker's message handler: a thin adapter between worker messages and
// workbookFiles + buildZip (../core/xlsx-package.js, ../core/zip.js). It uses no worker globals,
// so tests call it directly; ./xlsx.worker.js connects it to the real worker.
//
// Messages (plain data; every response echoes the request's id):
//   request   { type: 'xlsx', id, pattern, pictures }
//             pattern   a Pattern (../core/pattern.js), structured-cloned
//             pictures  WorkbookPictures (../core/xlsx-summary-sheet.js); the PNG buffers are
//                       transferred
//   response  { type: 'xlsx', id, bytes }   bytes is the .xlsx file (Uint8Array); its buffer
//                                           is transferred
//             { type: 'error', id, message } for any failure

import { canCompress } from '../core/compression.js';
import { workbookFiles } from '../core/xlsx-package.js';
import { workbookSizeCheck, formatWorkbookTooLarge } from '../core/xlsx-limits.js';
import { buildZip } from '../core/zip.js';

// Creates the handler.
// options.useCompression  default canCompress(); false stores every entry (tests cover the path
//                         of browsers without CompressionStream with it)
// Returns async handleMessage(message) → { response, transfer }: the response message and the
// buffers to transfer with it. Never rejects; errors become error responses.
export function createXlsxWorkerHandler({ useCompression = canCompress() } = {}) {
  async function createWorkbook(message) {
    const { pattern, pictures } = message;
    // The page checks the cap before asking; checked again so a bypassed page gets an answer.
    if (pattern !== null && typeof pattern === 'object' && workbookSizeCheck(pattern) === 'too-large') {
      throw new Error(formatWorkbookTooLarge(pattern));
    }
    const bytes = await buildZip(workbookFiles(pattern, pictures), { useCompression });
    return { response: { type: 'xlsx', id: message.id, bytes }, transfer: [bytes.buffer] };
  }

  return async function handleMessage(message) {
    try {
      if (message?.type !== 'xlsx') {
        throw new Error(`unknown message type "${String(message?.type)}"`);
      }
      return await createWorkbook(message);
    } catch (error) {
      return { response: { type: 'error', id: message?.id, message: error.message }, transfer: [] };
    }
  };
}
