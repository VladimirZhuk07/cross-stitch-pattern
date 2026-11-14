// Decides when a pattern is generated and stores the result: right after a new image has
// loaded, and GENERATION_DELAY_MS after the last change of the width or the max colors —
// automatically up to LARGE_PATTERN_STITCHES stitches, above that only when the user presses
// Generate. The fabric count only changes the finished size, so it never triggers generation.
// Only the newest request's result is kept; a running request that a newer change makes stale
// is stopped at once (the worker is terminated), as is one the user stops with Stop
// (design D10/D11 of raise-pattern-limits).

import {
  GENERATING_TEXT,
  GENERATION_STOPPED_TEXT,
  describeGenerationError,
  describeGenerationProgress,
  describeGenerationResult,
  describeLargePattern,
  isLargePattern,
} from '../core/generation-settings.js';
import { MAX_GRID_SIDE, stitchGridSize } from '../core/stitch-grid.js';
import { readImagePixels } from '../io/image-pixels.js';
import { GenerationStoppedError } from '../io/pattern-worker-client.js';

/** Pause after the last width/color change before generating, so typing "12" runs once. */
export const GENERATION_DELAY_MS = 300;

/**
 * Generates patterns through the worker client and writes state.pattern and
 * state.generation (kinds described in ./app-state.js).
 * Every relevant change (new image, width, max colors) counts as a new change; a result is
 * stored only if no change happened after its request was made, and a request still running
 * at a change is stopped. While generating, the current pattern stays; on failure it is kept
 * and the error is shown. A grid side above the limit is not requested (the settings form
 * explains it); a large pattern waits for the Generate button.
 * Owns the buttons [data-action="generate"] (shown while a large pattern waits or after a
 * stop) and [data-action="stop-generation"] (shown while generating).
 * root    element (or document) containing the settings form with both buttons
 * store   the app store from ./store.js
 * client  the pattern worker client from ../io/pattern-worker-client.js
 */
export function setupPatternGeneration(root, store, client) {
  const generateButton = root.querySelector('[data-action="generate"]');
  const stopButton = root.querySelector('[data-action="stop-generation"]');
  let latestChange = 0;
  let timer = null;
  let runningChange = null; // the change whose request is in the worker, or null

  // Starts a new change: earlier timers and running requests are no longer wanted.
  function startChange() {
    latestChange += 1;
    clearTimeout(timer);
    timer = null;
    if (runningChange !== null) {
      client.stop();
      runningChange = null;
    }
    return latestChange;
  }

  function scheduleGeneration(delay) {
    startChange();
    timer = setTimeout(generateIfSmall, delay);
  }

  function generateIfSmall() {
    timer = null;
    const { image, settings } = store.getState();
    if (image === null) {
      return;
    }
    const size = stitchGridSize(image.width, image.height, settings.targetWidth);
    if (size.height > MAX_GRID_SIDE) {
      store.setState({ generation: { kind: 'idle', text: '' } });
      return;
    }
    if (isLargePattern(size)) {
      const text = describeLargePattern(size.width * size.height);
      store.setState({ generation: { kind: 'awaiting-confirmation', text } });
      return;
    }
    generate(latestChange);
  }

  async function generate(change) {
    const { image, settings } = store.getState();
    runningChange = change;
    store.setState({ generation: { kind: 'running', text: GENERATING_TEXT } });
    const request = {
      settings: { targetWidth: settings.targetWidth, maxColors: settings.maxColors },
      imageKey: image,
      readImage: () => readImagePixels(image),
    };
    const showProgress = (progress) => {
      if (change === latestChange) {
        store.setState({ generation: { kind: 'running', text: describeGenerationProgress(progress) } });
      }
    };
    try {
      const pattern = await client.generate(request, showProgress);
      if (change === latestChange) {
        runningChange = null;
        store.setState({ pattern, generation: { kind: 'done', text: describeGenerationResult(pattern) } });
      }
    } catch (error) {
      if (error instanceof GenerationStoppedError) {
        return; // stopped by a newer change or the Stop button, which set the status
      }
      console.error(error);
      if (change === latestChange) {
        runningChange = null;
        store.setState({ generation: { kind: 'error', text: describeGenerationError(error.message) } });
      }
    }
  }

  generateButton.addEventListener('click', () => {
    if (store.getState().image !== null) {
      generate(startChange());
    }
  });

  stopButton.addEventListener('click', () => {
    startChange();
    store.setState({ generation: { kind: 'stopped', text: GENERATION_STOPPED_TEXT } });
  });

  function renderButtons(generation) {
    generateButton.hidden = generation.kind !== 'awaiting-confirmation' && generation.kind !== 'stopped';
    stopButton.hidden = generation.kind !== 'running';
  }

  renderButtons(store.getState().generation);
  store.subscribe((state, previous) => {
    if (state.generation !== previous.generation) {
      renderButtons(state.generation);
    }
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
