// Module worker entry: writes the Excel workbook off the main thread. One worker is started per
// export and terminated afterwards. The message protocol is described in ./xlsx-worker-handler.js.

import { createXlsxWorkerHandler } from './xlsx-worker-handler.js';

const handleMessage = createXlsxWorkerHandler();

self.addEventListener('message', async (event) => {
  const { response, transfer } = await handleMessage(event.data);
  self.postMessage(response, transfer);
});
