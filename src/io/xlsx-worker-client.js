// Main-thread side of the Excel worker: starts one worker per export, sends the request and
// terminates the worker when the answer (or a failure) arrives, so the tens of MB it used are
// freed at once. The message protocol is described in ../workers/xlsx-worker-handler.js.

let lastId = 0;

/**
 * Creates an Excel workbook in a fresh worker.
 * createWorker  function returning a new worker that runs ../workers/xlsx.worker.js: anything
 *               with postMessage(message, transfer), addEventListener(type, listener) and
 *               terminate(); a module Worker in the browser, a fake in tests.
 * request       { pattern, pictures }: a Pattern (../core/pattern.js) and WorkbookPictures
 *               (../core/xlsx-summary-sheet.js). The PNG buffers are transferred, so they must
 *               be fresh copies the caller no longer needs; the pattern is copied.
 * Resolves with the .xlsx bytes (Uint8Array). Rejects with an Error carrying the worker's
 * message, or "The Excel worker stopped: …" on an error or messageerror event. The worker is
 * terminated in every case; messages with another id are ignored.
 */
export function createWorkbookInWorker(createWorker, request) {
  lastId += 1;
  const id = lastId;
  const worker = createWorker();
  return new Promise((resolve, reject) => {
    let isSettled = false;
    function settle(finish) {
      if (isSettled) {
        return;
      }
      isSettled = true;
      worker.terminate();
      finish();
    }

    worker.addEventListener('message', (event) => {
      const message = event.data;
      if (message?.id !== id) {
        return;
      }
      if (message.type === 'xlsx') {
        settle(() => resolve(message.bytes));
        return;
      }
      settle(() => reject(new Error(message.message)));
    });
    worker.addEventListener('error', (event) => {
      settle(() => reject(new Error(`The Excel worker stopped: ${event.message || 'unknown error'}`)));
    });
    worker.addEventListener('messageerror', () => {
      settle(() => reject(new Error('The Excel worker stopped: a message could not be read')));
    });

    const { pattern, pictures } = request;
    const transfer = [pictures.original.png.buffer, pictures.dmc.png.buffer];
    try {
      worker.postMessage({ type: 'xlsx', id, pattern, pictures }, transfer);
    } catch (error) {
      settle(() => reject(error)); // e.g. a DataCloneError; the worker must still be stopped
    }
  });
}
