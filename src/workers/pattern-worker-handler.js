// The pattern worker's message handler: a thin adapter between worker messages and
// generatePattern in ../core/pattern-generator.js. It uses no worker globals, so tests call
// it directly; ./pattern.worker.js connects it to the real worker.
//
// Messages (plain data; every response echoes the request's id):
//   request   { type: 'generate', id, settings: { targetWidth, maxColors }, image? }
//             image is a pixel image { width, height, pixels } (see createGridAverager in
//             ../core/stitch-grid.js). It is sent with the first request for a new image,
//             with pixels.buffer transferred, and remembered for later requests.
//   progress  { type: 'progress', id, phase, done, total }   while generating, posted through
//             postProgress; phase, done and total as in GenerationProgress
//             (../core/pattern-generator.js). Sent only when the whole percent
//             floor(100 × done / total) of the phase rises: at most 101 per phase.
//   response  { type: 'pattern', id, pattern }   pattern.cells.buffer is transferred
//             { type: 'error', id, message }     for any failure; the worker keeps running

import { generatePattern } from '../core/pattern-generator.js';
import { checkPixelImage } from '../core/stitch-grid.js';

// Creates a handler with its own remembered image (none at first).
// postProgress  optional function that sends a progress message to the main thread while a
//               request is handled (the worker entry passes self.postMessage)
// Returns handleMessage(message) → { response, transfer }: the final response message and the
// list of buffers to transfer with it. Never throws; errors become error responses.
export function createPatternWorkerHandler(postProgress = () => {}) {
  let rememberedImage = null;

  function generate(message) {
    if (message.image !== undefined) {
      // Remembered before generating, so later requests can rely on it even if this one
      // fails because of its settings.
      rememberedImage = null;
      checkPixelImage(message.image);
      rememberedImage = message.image;
    }
    if (rememberedImage === null) {
      throw new Error('no image has been sent to the pattern worker yet');
    }
    const onProgress = createThrottledProgress(message.id, postProgress);
    const pattern = generatePattern(rememberedImage, message.settings, { onProgress });
    return { response: { type: 'pattern', id: message.id, pattern }, transfer: [pattern.cells.buffer] };
  }

  return function handleMessage(message) {
    try {
      if (message?.type !== 'generate') {
        throw new Error(`unknown message type "${String(message?.type)}"`);
      }
      return generate(message);
    } catch (error) {
      return { response: { type: 'error', id: message?.id, message: error.message }, transfer: [] };
    }
  };
}

// Turns every GenerationProgress report into a progress message, but posts only when the whole
// percent of the phase rises, so a 10000-row grid sends about 100 messages per phase, not 10000.
// Counting percent instead of time keeps the handler free of clocks and its tests exact.
function createThrottledProgress(id, postProgress) {
  let lastPhase = null;
  let lastPercent = -1;
  return function onProgress({ phase, done, total }) {
    const percent = Math.floor((100 * done) / total);
    if (phase === lastPhase && percent <= lastPercent) {
      return;
    }
    lastPhase = phase;
    lastPercent = percent;
    postProgress({ type: 'progress', id, phase, done, total });
  };
}
