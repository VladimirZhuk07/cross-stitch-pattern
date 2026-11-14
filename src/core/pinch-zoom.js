// Pinch-zoom math for the shared view frame. Pure: no DOM, no events, no timers.
//
// Turns the movement of one or two fingers (or a trackpad pinch) into a new Viewport, and keeps
// track of which pointers take part in a gesture (PointerGesture, see emptyGesture). Viewports,
// points and zoom limits are the shapes described in ./viewport.js; screen points are CSS px
// relative to the frame's top-left corner. The pattern-viewer spec is authoritative.
//
// A pinch is applied step by step: each pointer move changes the viewport by what the fingers
// did since the previous move. That keeps no "dead zone" after a zoom limit was hit and needs no
// special handling when a finger is added or lifted.

import { zoomAt, panBy } from './viewport.js';

/**
 * Fingers closer together than this (CSS px) only pan: their distance is too small to give a
 * meaningful zoom ratio, and 0 would divide by zero.
 */
export const MIN_PINCH_DISTANCE = 1;

const POINTS_PER_PINCH = 2;

/**
 * Chromium reports a trackpad pinch as Ctrl + wheel events whose vertical delta is about
 * 100 · ln(scale change) CSS px (sign: spreading the fingers gives a negative delta), so
 * e^(−delta / 100) recovers the scale the fingers made.
 */
const TRACKPAD_PINCH_PIXELS = 100;

/**
 * Largest delta (CSS px) one Ctrl + wheel event may count for. Pinch events are a few px each;
 * a Ctrl + mouse-wheel notch (~100 px) would otherwise zoom ×2.7 at once (now ×1.65).
 */
const MAX_TRACKPAD_PINCH_DELTA = 50;

/**
 * Returns the viewport after two fingers moved from previousPoints to currentPoints.
 * The zoom changes by the ratio current distance / previous distance (clamped to limits) around
 * the previous midpoint, and the view then moves by the shift of the midpoint, so the world point
 * that was under the old midpoint ends up under the new one.
 * If either distance is below MIN_PINCH_DISTANCE, the view only pans.
 * viewport        current viewport
 * previousPoints  array of exactly two { x, y } screen points before the move
 * currentPoints   array of exactly two { x, y } screen points after the move
 * limits          { minScale, maxScale } from zoomLimits
 * Throws RangeError if a points array does not hold exactly two points.
 */
export function pinchViewport(viewport, previousPoints, currentPoints, limits) {
  assertTwoPoints('previousPoints', previousPoints);
  assertTwoPoints('currentPoints', currentPoints);

  const previousMidpoint = midpoint(previousPoints);
  const currentMidpoint = midpoint(currentPoints);
  const previousDistance = distance(previousPoints);
  const currentDistance = distance(currentPoints);

  const isPanOnly = previousDistance < MIN_PINCH_DISTANCE || currentDistance < MIN_PINCH_DISTANCE;
  const factor = isPanOnly ? 1 : currentDistance / previousDistance;

  const zoomed = zoomAt(viewport, factor, previousMidpoint, limits);
  return panBy(
    zoomed,
    currentMidpoint.x - previousMidpoint.x,
    currentMidpoint.y - previousMidpoint.y,
  );
}

/**
 * Converts the vertical delta of a Ctrl + wheel event (a trackpad pinch, or Ctrl + mouse wheel)
 * into a zoom factor e^(−delta / 100), with the delta limited to ±MAX_TRACKPAD_PINCH_DELTA.
 * deltaPixels  vertical wheel delta in CSS px (negative = fingers spread = zoom in)
 * Returns a factor > 0 (1 = no zoom).
 */
export function trackpadPinchFactor(deltaPixels) {
  const limitedDelta = Math.min(
    MAX_TRACKPAD_PINCH_DELTA,
    Math.max(-MAX_TRACKPAD_PINCH_DELTA, deltaPixels),
  );
  return Math.exp(-limitedDelta / TRACKPAD_PINCH_PIXELS);
}

/** At most this many pointers take part in a gesture; further fingers are ignored. */
export const MAX_GESTURE_POINTERS = 2;

/**
 * Returns a PointerGesture with no pointers.
 *
 * PointerGesture  { pointers }: the pointers (fingers, mouse, pen) currently held down on the
 *                 frame, 0 to MAX_GESTURE_POINTERS entries { id, x, y } in touch-down order.
 *                 id is the browser's pointerId; x, y the pointer's last position in CSS px
 *                 relative to the frame's top-left corner. Gestures are never modified; every
 *                 function returns a new one (or the same one when nothing changed).
 *                 Used by ui/viewer-input.js; not stored in the app state.
 */
export function emptyGesture() {
  return { pointers: [] };
}

/**
 * Returns the gesture with a newly pressed pointer added at point { x, y }.
 * Returns the same gesture if the id is already tracked or MAX_GESTURE_POINTERS are held.
 */
export function startPointer(gesture, pointerId, point) {
  const isTracked = gesture.pointers.some((pointer) => pointer.id === pointerId);
  if (isTracked || gesture.pointers.length >= MAX_GESTURE_POINTERS) {
    return gesture;
  }
  return { pointers: [...gesture.pointers, { id: pointerId, x: point.x, y: point.y }] };
}

/**
 * Applies a pointer moving to point { x, y } and returns { gesture, viewport }.
 * With one tracked pointer the view pans by its movement; with two it pinches
 * (see pinchViewport). A move of an untracked pointer returns the same gesture and viewport.
 * viewport  current viewport
 * limits    { minScale, maxScale } from zoomLimits
 */
export function movePointer(gesture, pointerId, point, viewport, limits) {
  const index = gesture.pointers.findIndex((pointer) => pointer.id === pointerId);
  if (index === -1) {
    return { gesture, viewport };
  }

  const previous = gesture.pointers;
  const current = previous.map((pointer, i) => (
    i === index ? { id: pointerId, x: point.x, y: point.y } : pointer
  ));

  if (current.length === 1) {
    const moved = panBy(viewport, point.x - previous[0].x, point.y - previous[0].y);
    return { gesture: { pointers: current }, viewport: moved };
  }
  return {
    gesture: { pointers: current },
    viewport: pinchViewport(viewport, previous, current, limits),
  };
}

/**
 * Returns the gesture without the released pointer, or the same gesture if it was not tracked.
 * The remaining pointer keeps its last position, so its next move pans without a jump.
 */
export function endPointer(gesture, pointerId) {
  const remaining = gesture.pointers.filter((pointer) => pointer.id !== pointerId);
  return remaining.length === gesture.pointers.length ? gesture : { pointers: remaining };
}

function midpoint([first, second]) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function distance([first, second]) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function assertTwoPoints(name, points) {
  if (!Array.isArray(points) || points.length !== POINTS_PER_PINCH) {
    const count = Array.isArray(points) ? points.length : points;
    throw new RangeError(`${name} must hold exactly ${POINTS_PER_PINCH} points, got ${count}`);
  }
}
