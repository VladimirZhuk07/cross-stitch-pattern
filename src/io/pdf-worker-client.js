// Main-thread side of the PDF worker: starts a worker for each export, sends the request with
// the pictures transferred, routes progress, and stops a running export by terminating the
// worker. The worker is ended after every export, which frees its memory. The message protocol
// is described in ../workers/pdf-worker-handler.js.

/** Rejection reason of an export stopped with stop() (the user's Cancel). Not a failure. */
export class PdfExportStoppedError extends Error {
  constructor() {
    super('The PDF export was stopped');
    this.name = 'PdfExportStoppedError';
  }
}

/**
 * Wraps the PDF worker.
 * createWorker  function returning a new worker that runs ../workers/pdf.worker.js: anything
 *               with postMessage(message, transfer), addEventListener(type, listener) and
 *               terminate(); a module Worker in the browser, a fake in tests.
 * Returns { exportPdf(request, onProgress), stop() }:
 *   exportPdf({ pattern, fileName, fabricCount, pictures: { original, dmc } }, onProgress)
 *       sends an export-pdf request to a new worker, transferring the two JPEG buffers (they
 *       are unusable afterwards). onProgress (optional) receives { done, total } in pages.
 *       Resolves with the PDF bytes (Uint8Array); rejects with an Error carrying the worker's
 *       message, with PdfExportStoppedError after stop(), with "The PDF worker stopped: …" when
 *       the worker fails, or at once when another export is still running.
 *   stop()  terminates a running export's worker and rejects it with PdfExportStoppedError.
 *       Does nothing while idle.
 */
export function createPdfWorkerClient(createWorker) {
  let lastId = 0;
  let running = null; // { worker, id, resolve, reject, onProgress }

  function finish(job) {
    if (running === job) {
      running = null;
      job.worker.terminate();
    }
  }

  function handleMessage(job, message) {
    if (running !== job || message?.id !== job.id) {
      return;
    }
    if (message.type === 'progress') {
      job.onProgress?.({ done: message.done, total: message.total });
      return;
    }
    finish(job);
    if (message.type === 'pdf') {
      job.resolve(message.bytes);
      return;
    }
    job.reject(new Error(message.message));
  }

  function handleFailure(job, reason) {
    if (running !== job) {
      return;
    }
    finish(job);
    job.reject(new Error(`The PDF worker stopped: ${reason}`));
  }

  function exportPdf({ pattern, fileName, fabricCount, pictures }, onProgress) {
    if (running !== null) {
      return Promise.reject(new Error('A PDF export is already running'));
    }
    lastId += 1;
    const id = lastId;
    const worker = createWorker();
    return new Promise((resolve, reject) => {
      const job = { worker, id, resolve, reject, onProgress };
      running = job;
      worker.addEventListener('message', (event) => handleMessage(job, event.data));
      worker.addEventListener('error', (event) => handleFailure(job, event.message || 'unknown error'));
      worker.addEventListener('messageerror', () => handleFailure(job, 'a message could not be read'));
      const message = { type: 'export-pdf', id, pattern, fileName, fabricCount, pictures };
      worker.postMessage(message, [pictures.original.buffer, pictures.dmc.buffer]);
    });
  }

  function stop() {
    if (running === null) {
      return;
    }
    const job = running;
    finish(job);
    job.reject(new PdfExportStoppedError());
  }

  return { exportPdf, stop };
}
