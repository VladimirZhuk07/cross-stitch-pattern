// Module worker entry: runs pattern generation off the main thread.
// The message protocol is described in ./pattern-worker-handler.js.

import { createPatternWorkerHandler } from './pattern-worker-handler.js';

const handleMessage = createPatternWorkerHandler((message) => self.postMessage(message));

self.addEventListener('message', (event) => {
  const { response, transfer } = handleMessage(event.data);
  self.postMessage(response, transfer);
});
