// The zoom buttons (−, +, Fit) and the zoom percentage next to them.

import { zoomStepAtCenter, fitToFrame } from './viewer-input.js';

const NO_ZOOM_TEXT = '—';

/**
 * Connects [data-action="zoom-in"], [data-action="zoom-out"] and [data-action="zoom-fit"]
 * and shows the zoom as a whole percentage in [data-role="zoom-level"]
 * (100 % = one CSS px per image px). All three buttons are disabled while no image is loaded.
 * root   element (or document) containing the controls
 * store  the app store from ./store.js
 */
export function setupZoomControls(root, store) {
  const zoomInButton = root.querySelector('[data-action="zoom-in"]');
  const zoomOutButton = root.querySelector('[data-action="zoom-out"]');
  const fitButton = root.querySelector('[data-action="zoom-fit"]');
  const level = root.querySelector('[data-role="zoom-level"]');

  zoomInButton.addEventListener('click', () => zoomStepAtCenter(store, 1));
  zoomOutButton.addEventListener('click', () => zoomStepAtCenter(store, -1));
  fitButton.addEventListener('click', () => fitToFrame(store));

  function render(state) {
    const hasImage = state.image !== null;
    zoomInButton.disabled = !hasImage;
    zoomOutButton.disabled = !hasImage;
    fitButton.disabled = !hasImage;
    level.textContent = state.viewport === null ? NO_ZOOM_TEXT : `${Math.round(state.viewport.scale * 100)} %`;
  }

  render(store.getState());
  store.subscribe((state, previous) => {
    if (state.image !== previous.image || state.viewport !== previous.viewport) {
      render(state);
    }
  });
}
