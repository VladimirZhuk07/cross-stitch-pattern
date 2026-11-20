// The PDF worker's message handler: a thin adapter between worker messages and
// buildPdfDocument in ../core/pdf-document.js. It uses no worker globals, so tests call it
// directly; ./pdf.worker.js connects it to the real worker.
//
// Messages (plain data; every response echoes the request's id):
//   request   { type: 'export-pdf', id, pattern, fileName, fabricCount, pictures: { original, dmc } }
//             pattern is a Pattern (../core/pattern.js), copied; original and dmc are JPEG
//             Uint8Arrays whose buffers are transferred.
//   progress  { type: 'progress', id, done, total }   in pages, posted through postProgress
//             only when the whole percent floor(100 × done / total) rises: at most 101.
//   response  { type: 'pdf', id, bytes }   the PDF file; bytes.buffer is transferred
//             { type: 'error', id, message }   for any failure

import { buildPdfDocument } from '../core/pdf-document.js';

/**
 * Creates the handler.
 * postProgress  optional function that sends a progress message to the main thread (the
 *               worker entry passes self.postMessage)
 * Returns async handleMessage(message) → { response, transfer }: the final response and the
 * buffers to transfer with it. Never rejects; errors become error responses.
 */
export function createPdfWorkerHandler({ postProgress = () => {} } = {}) {
  async function exportPdf(message) {
    const { id, pattern, fileName, fabricCount, pictures } = message;
    const onProgress = createThrottledProgress(id, postProgress);
    const bytes = await buildPdfDocument({ pattern, fileName, fabricCount, pictures }, { onProgress });
    return { response: { type: 'pdf', id, bytes }, transfer: [bytes.buffer] };
  }

  return async function handleMessage(message) {
    try {
      if (message?.type !== 'export-pdf') {
        throw new Error(`unknown message type "${String(message?.type)}"`);
      }
      return await exportPdf(message);
    } catch (error) {
      return { response: { type: 'error', id: message?.id, message: error.message }, transfer: [] };
    }
  };
}

// Posts a progress message only when the whole percent rises, so an 806-page PDF sends about
// 100 messages, not 806. Counting percent instead of time keeps the handler free of clocks.
function createThrottledProgress(id, postProgress) {
  let lastPercent = -1;
  return function onProgress({ done, total }) {
    const percent = Math.floor((100 * done) / total);
    if (percent <= lastPercent) {
      return;
    }
    lastPercent = percent;
    postProgress({ type: 'progress', id, done, total });
  };
}
