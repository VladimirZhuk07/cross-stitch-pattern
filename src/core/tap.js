// Telling a tap (or click) apart from a drag or a pinch on the view frame. Pure: the caller feeds
// pointer positions in CSS px; no DOM. The authoritative description is
// openspec/specs/stitch-progress/spec.md ("A tap or click toggles a stitch").
//
// TapTracker (a plain object, never modified; every function returns a new one)
//   pointerId    the pointer being followed, or null when idle
//   start        { x, y } where it went down
//   isCancelled  true once it moved too far or a second pointer touched

/**
 * How far, in CSS px, a pointer may move between down and up and still count as a tap: the
 * touch slop of Android (8 dp); iOS allows about 10. Further movement is a drag (it pans).
 */
export const TAP_SLOP = 8;

/** A tracker that follows no pointer. */
export function idleTap() {
  return { pointerId: null, start: null, isCancelled: false };
}

/**
 * A pointer went down at point. The first pointer starts a possible tap; any further pointer
 * (a second finger) cancels it, so a pinch never ends in a tap.
 */
export function startTap(tracker, pointerId, point) {
  if (tracker.pointerId === null) {
    return { pointerId, start: { x: point.x, y: point.y }, isCancelled: false };
  }
  return { ...tracker, isCancelled: true };
}

/** A pointer moved to point; the tracked one cancels the tap once it is more than TAP_SLOP away. */
export function moveTap(tracker, pointerId, point) {
  if (tracker.pointerId !== pointerId || tracker.isCancelled) {
    return tracker;
  }
  const distance = Math.hypot(point.x - tracker.start.x, point.y - tracker.start.y);
  return distance > TAP_SLOP ? { ...tracker, isCancelled: true } : tracker;
}

/**
 * A pointer went up at point. Returns { tracker, tapPoint }: for the tracked pointer the tracker
 * becomes idle and tapPoint is point if this was a tap (else null); for any other pointer
 * nothing changes and tapPoint is null.
 */
export function endTap(tracker, pointerId, point) {
  if (tracker.pointerId !== pointerId) {
    return { tracker, tapPoint: null };
  }
  const isTap = !tracker.isCancelled && Math.hypot(point.x - tracker.start.x, point.y - tracker.start.y) <= TAP_SLOP;
  return { tracker: idleTap(), tapPoint: isTap ? { x: point.x, y: point.y } : null };
}

/** The browser took the pointers (pointercancel): forget everything. */
export function cancelTap() {
  return idleTap();
}
