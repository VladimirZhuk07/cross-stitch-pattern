// Turns pointer, wheel and keyboard input on the view frame into viewport changes.
// The math lives in ../core/viewport.js; this module only reads events.

import { zoomAt, zoomLimits, panBy, wheelZoomFactor, ZOOM_STEP } from '../core/viewport.js';

/** Distance one arrow-key press scrolls the view, in CSS px. */
const PAN_STEP = 50;

/** CSS px per wheel "line" when the browser reports wheel deltas in lines (deltaMode 1). */
const WHEEL_LINE_HEIGHT = 16;

const DELTA_MODE_LINE = 1;
const DELTA_MODE_PAGE = 2;

/**
 * Makes the frame [data-role="viewer"] navigable:
 *   drag with mouse, pen or one finger   pans
 *   mouse wheel / trackpad scroll        zooms around the cursor (100 px = one ×1.25 step)
 *   keys while the frame has focus       + or = zoom in, - zoom out, 0 fits,
 *                                        arrow keys scroll the view by 50 CSS px
 * Does nothing while no image is shown.
 * root   element (or document) containing the viewer
 * store  the app store from ./store.js
 */
export function setupViewerInput(root, store) {
  const viewer = root.querySelector('[data-role="viewer"]');
  const canvas = root.querySelector('[data-role="viewer-canvas"]');
  setupDragPan(viewer, store);

  viewer.addEventListener('wheel', (event) => {
    if (!canNavigate(store.getState())) {
      return;
    }
    event.preventDefault(); // zoom instead of scrolling the page
    const bounds = canvas.getBoundingClientRect();
    const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    zoomBy(store, wheelZoomFactor(wheelDeltaPixels(event, bounds.height)), anchor);
  }, { passive: false });

  viewer.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || !canNavigate(store.getState())) {
      return; // leave browser shortcuts such as Ctrl + '+' alone
    }
    const isHandled = handleKey(event.key, store);
    if (isHandled) {
      event.preventDefault();
    }
  });
}

/**
 * Zooms one step in (direction 1) or out (direction −1) around the frame center.
 * Does nothing while no image is shown. Also used by the zoom buttons.
 */
export function zoomStepAtCenter(store, direction) {
  const { frame } = store.getState();
  const center = { x: frame.width / 2, y: frame.height / 2 };
  zoomBy(store, ZOOM_STEP ** direction, center);
}

/** Fits the image to the frame again (the viewer fits whenever the viewport is null). */
export function fitToFrame(store) {
  store.setState({ viewport: null });
}

/** True when an image is shown, so zooming and panning make sense. */
export function canNavigate(state) {
  return state.image !== null && state.viewport !== null
    && state.frame.width > 0 && state.frame.height > 0;
}

function zoomBy(store, factor, anchor) {
  const state = store.getState();
  if (!canNavigate(state)) {
    return;
  }
  const limits = zoomLimits(state.image, state.frame, state.pattern);
  store.setState({ viewport: zoomAt(state.viewport, factor, anchor, limits) });
}

function panView(store, dx, dy) {
  const state = store.getState();
  if (!canNavigate(state)) {
    return;
  }
  store.setState({ viewport: panBy(state.viewport, dx, dy) });
}

/** Returns true if the key was one of the frame's shortcuts. */
function handleKey(key, store) {
  switch (key) {
    case '+':
    case '=':
      zoomStepAtCenter(store, 1);
      return true;
    case '-':
      zoomStepAtCenter(store, -1);
      return true;
    case '0':
      fitToFrame(store);
      return true;
    case 'ArrowLeft':
      panView(store, PAN_STEP, 0); // scrolling the view left moves the image right
      return true;
    case 'ArrowRight':
      panView(store, -PAN_STEP, 0);
      return true;
    case 'ArrowUp':
      panView(store, 0, PAN_STEP);
      return true;
    case 'ArrowDown':
      panView(store, 0, -PAN_STEP);
      return true;
    default:
      return false;
  }
}

/** Pans while the primary button (or one finger) is held down; other pointers are ignored. */
function setupDragPan(viewer, store) {
  let drag = null; // { pointerId, x, y } of the pointer currently dragging

  viewer.addEventListener('pointerdown', (event) => {
    if (drag !== null || event.button !== 0 || !canNavigate(store.getState())) {
      return;
    }
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    viewer.setPointerCapture(event.pointerId);
    viewer.classList.add('viewer--panning');
  });

  viewer.addEventListener('pointermove', (event) => {
    if (drag === null || event.pointerId !== drag.pointerId) {
      return;
    }
    panView(store, event.clientX - drag.x, event.clientY - drag.y);
    drag = { pointerId: drag.pointerId, x: event.clientX, y: event.clientY };
  });

  function endDrag(event) {
    if (drag === null || event.pointerId !== drag.pointerId) {
      return;
    }
    drag = null;
    viewer.classList.remove('viewer--panning');
  }
  viewer.addEventListener('pointerup', endDrag);
  viewer.addEventListener('pointercancel', endDrag);
}

/** Converts a wheel event's vertical delta to CSS px, whatever unit the browser reports. */
function wheelDeltaPixels(event, pageHeight) {
  if (event.deltaMode === DELTA_MODE_LINE) {
    return event.deltaY * WHEEL_LINE_HEIGHT;
  }
  if (event.deltaMode === DELTA_MODE_PAGE) {
    return event.deltaY * pageHeight;
  }
  return event.deltaY;
}
