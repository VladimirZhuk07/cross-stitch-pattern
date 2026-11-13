// The pattern worker's message handler: a thin adapter between worker messages and
// generatePattern in ../core/pattern-generator.js. It uses no worker globals, so tests call
// it directly; ./pattern.worker.js connects it to the real worker.
//
// Messages (plain data; every response echoes the request's id):
//   request   { type: 'generate', id, settings: { targetWidth, maxColors }, image? }
//             image is a pixel image { width, height, pixels } (see resizeToGrid in
//             ../core/stitch-grid.js). It is sent with the first request for a new image,
//             with pixels.buffer transferred, and remembered for later requests.
//   response  { type: 'pattern', id, pattern }   pattern.cells.buffer is transferred
//             { type: 'error', id, message }     for any failure; the worker keeps running

import { generatePattern } from '../core/pattern-generator.js';
import { checkPixelImage } from '../core/stitch-grid.js';

// Creates a handler with its own remembered image (none at first).
// Returns handleMessage(message) → { response, transfer }: the response message and the
// list of buffers to transfer with it. Never throws; errors become error responses.
export function createPatternWorkerHandler() {
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
    const pattern = generatePattern(rememberedImage, message.settings);
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
