// Module worker entry: creates the PDF chart off the main thread, so the page and its progress
// bar stay responsive. The message protocol is described in ./pdf-worker-handler.js.

import { createPdfWorkerHandler } from './pdf-worker-handler.js';

const handleMessage = createPdfWorkerHandler({ postProgress: (message) => self.postMessage(message) });

self.addEventListener('message', async (event) => {
  const { response, transfer } = await handleMessage(event.data);
  self.postMessage(response, transfer);
});
