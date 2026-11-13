// Decides when a pattern is generated and stores the result: right after a new image has
// loaded, and GENERATION_DELAY_MS after the last change of the width or the max colors.
// The fabric count only changes the finished size, so it never triggers generation.
// Only the newest request's result is kept (see design D9 of add-pattern-generation).

import { GENERATING_TEXT, describeGenerationError, describeGenerationResult } from '../core/generation-settings.js';
import { MAX_GRID_SIDE, stitchGridSize } from '../core/stitch-grid.js';
import { readImagePixels } from '../io/image-pixels.js';

/** Pause after the last width/color change before generating, so typing "12" runs once. */
export const GENERATION_DELAY_MS = 300;

/**
 * Generates patterns through the worker client and writes state.pattern and
 * state.generation ({ kind: 'running' | 'done' | 'error' | 'idle', text }).
 * Every relevant change (new image, width, max colors) counts as a new change; a result is
 * stored only if no change happened after its request was made, so stale results are dropped.
 * While generating, the current pattern stays; on failure it is kept and the error is shown.
 * A grid side above the limit is not requested (the settings form explains it).
 * store   the app store from ./store.js
 * client  the pattern worker client from ../io/pattern-worker-client.js
 */
export function setupPatternGeneration(store, client) {
  let latestChange = 0;
  let timer = null;
  let imageInWorker = null; // the loaded image whose pixels the worker already has

  function scheduleGeneration(delay) {
    latestChange += 1;
    clearTimeout(timer);
    timer = setTimeout(generateLatest, delay);
  }

  async function generateLatest() {
    timer = null;
    const change = latestChange;
    const { image, settings } = store.getState();
    if (image === null) {
      return;
    }
    if (stitchGridSize(image.width, image.height, settings.targetWidth).height > MAX_GRID_SIDE) {
      store.setState({ generation: { kind: 'idle', text: '' } });
      return;
    }
    store.setState({ generation: { kind: 'running', text: GENERATING_TEXT } });
    try {
      const pattern = await client.generate(buildRequest(image, settings));
      if (change === latestChange) {
        store.setState({ pattern, generation: { kind: 'done', text: describeGenerationResult(pattern) } });
      }
    } catch (error) {
      console.error(error);
      if (change === latestChange) {
        store.setState({ generation: { kind: 'error', text: describeGenerationError(error.message) } });
      }
    }
  }

  // The worker remembers the last image it was sent, so pixels are read and sent only once
  // per image.
  function buildRequest(image, settings) {
    const request = { settings: { targetWidth: settings.targetWidth, maxColors: settings.maxColors } };
    if (image !== imageInWorker) {
      request.image = readImagePixels(image);
      imageInWorker = image;
    }
    return request;
  }

  store.subscribe((state, previous) => {
    if (state.image !== previous.image) {
      if (state.image !== null) {
        scheduleGeneration(0);
      }
      return;
    }
    const { settings } = state;
    const old = previous.settings;
    if (settings.targetWidth !== old.targetWidth || settings.maxColors !== old.maxColors) {
      scheduleGeneration(GENERATION_DELAY_MS);
    }
  });
}
