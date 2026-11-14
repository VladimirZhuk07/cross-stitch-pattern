// The pattern settings form: width in stitches, max colors and fabric count, plus the stitch
// size / finished size text and the generation status. Writes only state.settings, and only
// valid values; the texts come from ../core/generation-settings.js.

import {
  MAX_COLORS_INVALID_TEXT,
  MAX_COLORS_RANGE,
  NO_IMAGE_SIZE_TEXT,
  TARGET_WIDTH_INVALID_TEXT,
  TARGET_WIDTH_RANGE,
  formatGridTooLarge,
  formatNoExtraDetailNote,
  formatPatternSize,
  parseWholeNumber,
} from '../core/generation-settings.js';
import { FABRIC_COUNTS } from '../core/pattern.js';
import { MAX_GRID_SIDE, maxTargetWidth, stitchGridSize } from '../core/stitch-grid.js';

const NUMBER_FIELDS = {
  targetWidth: { range: TARGET_WIDTH_RANGE, invalidText: TARGET_WIDTH_INVALID_TEXT },
  maxColors: { range: MAX_COLORS_RANGE, invalidText: MAX_COLORS_INVALID_TEXT },
};

/**
 * Connects the settings form [data-role="settings"] to the store.
 * Number fields [data-setting="targetWidth" | "maxColors"] are parsed on every input: a valid
 * whole number in range updates state.settings; anything else marks the field aria-invalid,
 * shows its message ([data-error-for="…"]) and leaves the settings unchanged. The fabric
 * select [data-setting="fabricCount"] updates settings.fabricCount.
 * The size output [data-role="pattern-size"] follows the image and settings; the status
 * output [data-role="generation-status"] shows state.generation.
 * root   element (or document) containing the form
 * store  the app store from ./store.js
 */
export function setupSettingsForm(root, store) {
  const form = root.querySelector('[data-role="settings"]');
  const sizeOutput = form.querySelector('[data-role="pattern-size"]');
  const statusOutput = form.querySelector('[data-role="generation-status"]');
  const fabricSelect = form.querySelector('[data-setting="fabricCount"]');

  form.addEventListener('submit', (event) => {
    event.preventDefault(); // settings apply as they are typed; Enter must not reload the page
  });

  for (const [field, rules] of Object.entries(NUMBER_FIELDS)) {
    const input = form.querySelector(`[data-setting="${field}"]`);
    const message = form.querySelector(`[data-error-for="${field}"]`);
    input.value = String(store.getState().settings[field]);
    input.addEventListener('input', () => {
      const value = parseWholeNumber(input.value, rules.range);
      showFieldError(input, message, value === null ? rules.invalidText : '');
      if (value !== null) {
        updateSetting(store, field, value);
      }
    });
  }

  fabricSelect.value = String(store.getState().settings.fabricCount);
  fabricSelect.addEventListener('change', () => {
    const fabricCount = Number(fabricSelect.value);
    if (FABRIC_COUNTS.includes(fabricCount)) {
      updateSetting(store, 'fabricCount', fabricCount);
    }
  });

  function render(state) {
    const size = describeSize(state.image, state.settings);
    sizeOutput.textContent = size.text;
    sizeOutput.classList.toggle('settings__size--error', size.isTooLarge);
    statusOutput.textContent = state.generation.text;
    statusOutput.classList.toggle('settings__status--error', state.generation.kind === 'error');
  }

  render(store.getState());
  store.subscribe((state, previous) => {
    if (state.image !== previous.image || state.settings !== previous.settings || state.generation !== previous.generation) {
      render(state);
    }
  });
}

function updateSetting(store, field, value) {
  const { settings } = store.getState();
  if (settings[field] !== value) {
    store.setState({ settings: { ...settings, [field]: value } });
  }
}

/** Shows text as the field's error message, or clears it when text is empty. */
function showFieldError(input, message, text) {
  const isInvalid = text !== '';
  input.setAttribute('aria-invalid', String(isInvalid));
  message.textContent = text;
  message.hidden = !isInvalid;
}

/**
 * The size text for an image (or null) and settings, and whether the grid is too large.
 * A grid wider than the image gets a note that the extra stitches add no detail.
 */
function describeSize(image, settings) {
  if (image === null) {
    return { text: NO_IMAGE_SIZE_TEXT, isTooLarge: false };
  }
  const size = stitchGridSize(image.width, image.height, settings.targetWidth);
  if (size.height > MAX_GRID_SIDE) {
    return { text: formatGridTooLarge(size, maxTargetWidth(image.width, image.height)), isTooLarge: true };
  }
  const sizeText = formatPatternSize(size, settings.fabricCount);
  const note = formatNoExtraDetailNote(size.width, image.width);
  return { text: note === '' ? sizeText : `${sizeText}. ${note}`, isTooLarge: false };
}
