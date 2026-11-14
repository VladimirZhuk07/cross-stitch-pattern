// Main-thread side of the pattern worker: creates the worker, numbers requests, sends each
// image's pixels once per worker, routes progress and responses to their request, and stops a
// running job by terminating the worker. The message protocol is described in
// ../workers/pattern-worker-handler.js.

/**
 * Rejection reason of requests that were stopped with stop(). Not a failure: a newer request
 * or the user's Stop button made them unnecessary.
 */
export class GenerationStoppedError extends Error {
  constructor() {
    super('The pattern generation was stopped');
    this.name = 'GenerationStoppedError';
  }
}

/**
 * Wraps the pattern worker.
 * createWorker  function returning a new worker that runs ../workers/pattern.worker.js:
 *               anything with postMessage(message, transfer), addEventListener(type, listener)
 *               and terminate(); a module Worker in the browser, a fake in tests. Called on
 *               the first request and again after a stop or a crash.
 * Returns { generate(request, onProgress), stop() }:
 *   generate({ settings, imageKey, readImage }, onProgress)  sends a generate request with the
 *       next id. settings is { targetWidth, maxColors }; imageKey identifies the image (the
 *       loaded-image object); readImage() returns its pixel image and is called only when the
 *       current worker has not received that image yet — the pixel buffer is then transferred,
 *       so it must be a fresh copy. onProgress (optional) receives { phase, done, total } of
 *       this request. Resolves with the Pattern; rejects with an Error carrying the worker's
 *       message, with GenerationStoppedError after stop(), or with "The pattern worker
 *       stopped: …" when the worker fails (error or messageerror event).
 *   stop()  if any request is pending: terminates the worker at once, rejects every pending
 *       request with GenerationStoppedError, and lets the next generate start a fresh worker.
 *       Does nothing while idle. A worker running a synchronous job cannot read a cancel
 *       message, so terminating is the only way to stop it immediately.
 * Deciding which result is still wanted (stale results) is up to the caller.
 */
export function createPatternWorkerClient(createWorker) {
  const pendingById = new Map();
  let lastId = 0;
  let worker = null;
  let imageKeyInWorker = null;

  function rejectAll(error) {
    for (const pending of pendingById.values()) {
      pending.reject(error);
    }
    pendingById.clear();
  }

  function dropWorker() {
    worker = null;
    imageKeyInWorker = null;
  }

  function handleMessage(event) {
    const message = event.data;
    const pending = pendingById.get(message?.id);
    if (pending === undefined) {
      return; // not for one of our pending requests
    }
    if (message.type === 'progress') {
      pending.onProgress?.({ phase: message.phase, done: message.done, total: message.total });
      return;
    }
    pendingById.delete(message.id);
    if (message.type === 'pattern') {
      pending.resolve(message.pattern);
      return;
    }
    pending.reject(new Error(message.message));
  }

  function startWorker() {
    const started = createWorker();
    started.addEventListener('message', (event) => {
      if (started === worker) {
        handleMessage(event);
      }
    });
    const handleFailure = (reason) => {
      if (started !== worker) {
        return; // an already replaced worker
      }
      dropWorker();
      rejectAll(new Error(`The pattern worker stopped: ${reason}`));
    };
    started.addEventListener('error', (event) => handleFailure(event.message || 'unknown error'));
    started.addEventListener('messageerror', () => handleFailure('a message could not be read'));
    return started;
  }

  function generate({ settings, imageKey, readImage }, onProgress) {
    if (worker === null) {
      worker = startWorker();
    }
    lastId += 1;
    const id = lastId;
    const message = { type: 'generate', id, settings };
    const transfer = [];
    if (imageKey !== imageKeyInWorker) {
      const image = readImage();
      message.image = image;
      transfer.push(image.pixels.buffer);
      imageKeyInWorker = imageKey;
    }
    return new Promise((resolve, reject) => {
      pendingById.set(id, { resolve, reject, onProgress });
      worker.postMessage(message, transfer);
    });
  }

  function stop() {
    if (pendingById.size === 0 || worker === null) {
      return;
    }
    worker.terminate();
    dropWorker();
    rejectAll(new GenerationStoppedError());
  }

  return { generate, stop };
}
