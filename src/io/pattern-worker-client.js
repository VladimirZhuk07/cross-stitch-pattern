// Main-thread side of the pattern worker: numbers requests, transfers the pixel buffer and
// matches each response to its request. The message protocol is described in
// ../workers/pattern-worker-handler.js.

/**
 * Wraps a worker that runs ../workers/pattern.worker.js.
 * worker  anything with postMessage(message, transfer) and addEventListener(type, listener):
 *         a module Worker in the browser, a fake in tests
 * Returns { generate(request) }:
 *   generate({ settings, image })  sends a generate request with the next id. settings is
 *       { targetWidth, maxColors }; image (optional) is a pixel image whose pixels buffer is
 *       transferred, so the caller must not use it afterwards. Resolves with the Pattern, or
 *       rejects with an Error carrying the worker's message.
 * When the worker fails (an error or messageerror event), every pending request is rejected
 * with "The pattern worker stopped: …".
 * Deciding which result is still wanted (stale results) is up to the caller.
 */
export function createPatternWorkerClient(worker) {
  const pendingById = new Map();
  let lastId = 0;

  worker.addEventListener('message', (event) => {
    const response = event.data;
    const pending = pendingById.get(response?.id);
    if (pending === undefined) {
      return; // not a response to one of our requests
    }
    pendingById.delete(response.id);
    if (response.type === 'pattern') {
      pending.resolve(response.pattern);
      return;
    }
    pending.reject(new Error(response.message));
  });

  function rejectAll(reason) {
    const error = new Error(`The pattern worker stopped: ${reason}`);
    for (const pending of pendingById.values()) {
      pending.reject(error);
    }
    pendingById.clear();
  }

  worker.addEventListener('error', (event) => {
    rejectAll(event.message || 'unknown error');
  });
  worker.addEventListener('messageerror', () => {
    rejectAll('a message could not be read');
  });

  function generate({ settings, image }) {
    lastId += 1;
    const id = lastId;
    const message = { type: 'generate', id, settings };
    const transfer = [];
    if (image !== undefined) {
      message.image = image;
      transfer.push(image.pixels.buffer);
    }
    return new Promise((resolve, reject) => {
      pendingById.set(id, { resolve, reject });
      worker.postMessage(message, transfer);
    });
  }

  return { generate };
}
