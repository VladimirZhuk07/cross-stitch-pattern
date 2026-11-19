// Turns pointer, wheel and keyboard input on the view frame into viewport changes.
// The math lives in ../core/viewport.js and ../core/pinch-zoom.js; this module only reads events.

import { zoomAt, zoomLimits, panBy, wheelZoomFactor, contentRect, ZOOM_STEP } from '../core/viewport.js';
import { idleTap, startTap, moveTap, endTap, cancelTap } from '../core/tap.js';
import {
  emptyGesture, startPointer, movePointer, endPointer, trackpadPinchFactor,
} from '../core/pinch-zoom.js';

const PROGRESS_LAYER = 'progress';

/** Which way each arrow key scrolls the view: +1 right/down, −1 left/up. */
const ARROW_DIRECTIONS = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/** Distance one arrow-key press scrolls the view, in CSS px. */
const PAN_STEP = 50;

/** CSS px per wheel "line" when the browser reports wheel deltas in lines (deltaMode 1). */
const WHEEL_LINE_HEIGHT = 16;

const DELTA_MODE_LINE = 1;
const DELTA_MODE_PAGE = 2;

/**
 * Makes the frame [data-role="viewer"] navigable:
 *   drag with mouse, pen or one finger   pans
 *   two fingers                          pinch-zoom around their midpoint and pan with it
 *   mouse wheel / trackpad scroll        zooms around the cursor (100 px = one ×1.25 step)
 *   Ctrl + wheel (trackpad pinch)        zooms around the cursor by e^(−delta / 100)
 *   Safari pinch (gesture events)        zooms around the gesture position, not the page
 *   keys while the frame has focus       + or = zoom in, - zoom out, 0 fits,
 *                                        arrow keys scroll the view by 50 CSS px
 *   on the Progress layer                a tap or click (moving at most 8 CSS px, one pointer)
 *                                        calls options.onTap(point); Space or Enter calls
 *                                        options.onKeyToggle(); Shift + arrow scrolls one cell
 * Also writes state.isFrameKeyboardFocused: true while the frame has focus from the keyboard
 * (:focus-visible), false after a pointer press or when it loses focus.
 * Does nothing while no image is shown.
 * root     element (or document) containing the viewer
 * store    the app store from ./store.js
 * options  optional { onTap(point), onKeyToggle() } (point in CSS px from the frame's top-left)
 */
export function setupViewerInput(root, store, options = {}) {
  const viewer = root.querySelector('[data-role="viewer"]');
  const canvas = root.querySelector('[data-role="viewer-canvas"]');
  const hasPointers = setupPointerGestures(viewer, canvas, store, options.onTap);
  setupFocusTracking(viewer, store);
  setupSafariGestures(viewer, canvas, store, hasPointers);

  viewer.addEventListener('wheel', (event) => {
    if (!canNavigate(store.getState())) {
      return;
    }
    event.preventDefault(); // zoom instead of scrolling the page
    const bounds = canvas.getBoundingClientRect();
    const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const deltaPixels = wheelDeltaPixels(event, bounds.height);
    // Chrome, Edge and Firefox report a trackpad pinch as a wheel event with ctrlKey set.
    const factor = event.ctrlKey ? trackpadPinchFactor(deltaPixels) : wheelZoomFactor(deltaPixels);
    zoomBy(store, factor, anchor);
  }, { passive: false });

  viewer.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || !canNavigate(store.getState())) {
      return; // leave browser shortcuts such as Ctrl + '+' alone
    }
    const isHandled = handleProgressKey(event, store, options.onKeyToggle) || handleKey(event.key, store);
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
  store.setState({ viewport: zoomAt(state.viewport, factor, anchor, currentZoomLimits(state)) });
}

/**
 * The zoom range for the current state (with a pattern, a stitch can always reach 64 CSS px);
 * the one place that decides the limits for buttons, keys, wheel, pinch and Safari gestures.
 */
function currentZoomLimits(state) {
  return zoomLimits(state.image, state.frame, state.pattern);
}

function panView(store, dx, dy) {
  const state = store.getState();
  if (!canNavigate(state)) {
    return;
  }
  store.setState({ viewport: panBy(state.viewport, dx, dy) });
}

/**
 * The Progress layer's keys: Space or Enter toggle the stitch under the centre marker, Shift +
 * arrow scrolls the view by exactly one cell. Returns true if the key was handled.
 */
function handleProgressKey(event, store, onKeyToggle) {
  const state = store.getState();
  if (state.activeLayer !== PROGRESS_LAYER || state.pattern === null) {
    return false;
  }
  if (event.key === ' ' || event.key === 'Enter') {
    onKeyToggle?.();
    return true;
  }
  const direction = ARROW_DIRECTIONS[event.key];
  if (!event.shiftKey || direction === undefined) {
    return false;
  }
  const content = contentRect(state.viewport, state.image);
  const cellWidth = content.width / state.pattern.width;
  const cellHeight = content.height / state.pattern.height;
  // Scrolling the view right moves the content left, as for the plain arrow keys.
  panView(store, -direction.x * cellWidth, -direction.y * cellHeight);
  return true;
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

/**
 * Pans with one pointer and pinch-zooms with two (core/pinch-zoom.js does the bookkeeping).
 * Only the primary button (mouse) or a touch/pen contact starts tracking; a third finger is
 * ignored. pointercancel ends the whole gesture where it is (the browser took the touches).
 * Beside it, a tap tracker (core/tap.js) reports a press that hardly moved to onTap; a press
 * that starts while another pointer is down is never a tap.
 */
function setupPointerGestures(viewer, canvas, store, onTap) {
  let gesture = emptyGesture();
  let tap = idleTap();

  function setGesture(next) {
    gesture = next;
    viewer.classList.toggle('viewer--panning', gesture.pointers.length > 0);
  }

  viewer.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !canNavigate(store.getState())) {
      return;
    }
    if (store.getState().isFrameKeyboardFocused) {
      store.setState({ isFrameKeyboardFocused: false }); // the marker is for keyboard use only
    }
    const point = framePoint(canvas, event);
    if (gesture.pointers.length === 0) {
      tap = startTap(idleTap(), event.pointerId, point);
    } else if (tap.pointerId !== null) {
      tap = startTap(tap, event.pointerId, point); // a second finger: no tap
    }
    const next = startPointer(gesture, event.pointerId, point);
    if (next === gesture) {
      return; // third finger or a pointer that is already tracked
    }
    viewer.setPointerCapture(event.pointerId);
    setGesture(next);
  });

  viewer.addEventListener('pointermove', (event) => {
    if (gesture.pointers.length === 0) {
      return;
    }
    tap = moveTap(tap, event.pointerId, framePoint(canvas, event));
    const state = store.getState();
    if (!canNavigate(state)) {
      setGesture(emptyGesture()); // the image went away mid-gesture
      return;
    }
    const result = movePointer(
      gesture, event.pointerId, framePoint(canvas, event), state.viewport, currentZoomLimits(state),
    );
    gesture = result.gesture;
    if (result.viewport !== state.viewport) {
      store.setState({ viewport: result.viewport });
    }
  });

  viewer.addEventListener('pointerup', (event) => {
    setGesture(endPointer(gesture, event.pointerId));
    const result = endTap(tap, event.pointerId, framePoint(canvas, event));
    tap = result.tracker;
    if (result.tapPoint !== null && onTap) {
      onTap(result.tapPoint);
    }
  });
  viewer.addEventListener('pointercancel', () => {
    setGesture(emptyGesture());
    tap = cancelTap();
  });

  return () => gesture.pointers.length > 0;
}

// Keeps state.isFrameKeyboardFocused: true when the frame got focus from the keyboard.
function setupFocusTracking(viewer, store) {
  viewer.addEventListener('focus', () => {
    store.setState({ isFrameKeyboardFocused: viewer.matches(':focus-visible') });
  });
  viewer.addEventListener('blur', () => {
    store.setState({ isFrameKeyboardFocused: false });
  });
}

/**
 * Safari reports a trackpad pinch only as non-standard gesturestart/gesturechange/gestureend
 * events whose default action zooms the whole page. They zoom the view instead, by the change
 * of event.scale since the previous gesture event. iOS Safari fires them during a touch pinch
 * too; that pinch is already handled by the pointer events, so they never zoom while
 * hasPointers() is true.
 */
function setupSafariGestures(viewer, canvas, store, hasPointers) {
  let lastScale = 1;

  viewer.addEventListener('gesturestart', (event) => {
    lastScale = 1;
    if (canNavigate(store.getState())) {
      event.preventDefault();
    }
  });

  viewer.addEventListener('gesturechange', (event) => {
    if (!canNavigate(store.getState())) {
      return;
    }
    event.preventDefault();
    const scale = event.scale;
    if (!Number.isFinite(scale) || scale <= 0) {
      return;
    }
    const factor = scale / lastScale;
    lastScale = scale;
    if (!hasPointers()) {
      zoomBy(store, factor, gestureAnchor(canvas, event, store.getState().frame));
    }
  });

  viewer.addEventListener('gestureend', (event) => {
    if (canNavigate(store.getState())) {
      event.preventDefault();
    }
  });
}

/** The gesture position in frame coordinates, or the frame center if Safari gave none. */
function gestureAnchor(canvas, event, frame) {
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
    return { x: frame.width / 2, y: frame.height / 2 };
  }
  return framePoint(canvas, event);
}

/** Position of a pointer or gesture event in CSS px relative to the frame's top-left corner. */
function framePoint(canvas, event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
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
