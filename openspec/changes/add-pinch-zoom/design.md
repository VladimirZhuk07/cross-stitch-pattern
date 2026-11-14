# Design

## Context

- `src/ui/viewer-input.js` turns input into viewport changes. Its `setupDragPan` tracks one
  pointer (`{ pointerId, x, y }`) and pans by the delta of each `pointermove`; every other
  pointer is ignored. The wheel handler zooms every wheel event by `wheelZoomFactor`
  (×1.25 per 100 px) around the cursor and calls `preventDefault`, so a Ctrl + wheel trackpad
  pinch in Chrome/Edge/Firefox already zooms the view (not the page), only far too slowly.
- `src/core/viewport.js` (pure) has `zoomAt(viewport, factor, anchor, limits)`,
  `panBy(viewport, dx, dy)` and `zoomLimits`. A `Viewport` is `{ scale, offsetX, offsetY }`
  (see that module). This change only imports from it; it adds nothing to it.
- `styles/main.css` already sets `touch-action: none` on `.viewer` (from `add-app-shell`), so
  browsers deliver all touches on the frame as pointer events and never pan or zoom the page
  for them. No CSS edit is needed; the parallel change `improve-mobile-layout` edits that file,
  so a test guards the rule instead.
- `scripts/serve.js` binds `127.0.0.1` only; `startServer({ host })` already accepts a host but
  the command line has no `--host`, so a phone cannot reach the dev server.

## Goals / Non-Goals

**Goals:** all gesture math and the "which pointers count" bookkeeping in `core/`, unit-tested
with TDD; `viewer-input.js` stays a thin event adapter.

**Non-Goals:** a general gesture library, rotation, momentum, rubber-banding at limits,
double-tap zoom (see Decision 7).

## Decisions

### 1. New pure module `src/core/pinch-zoom.js` (layer: core)

Imports only `zoomAt` and `panBy` from `./viewport.js`; no DOM, no events, no timers. Exports:

- `pinchViewport(viewport, previousPoints, currentPoints, limits)` → viewport.
  `previousPoints`/`currentPoints` are arrays of exactly two `{ x, y }` screen points (CSS px,
  frame-relative). Factor = current distance / previous distance; result =
  `panBy(zoomAt(viewport, factor, previousMidpoint, limits), midpoint shift)`. Reusing `zoomAt`
  gives the clamping and "anchor stays fixed" rule for free; the pan then carries that point to
  the new midpoint. If either distance is below `MIN_PINCH_DISTANCE` (1 CSS px) the factor is 1
  (pan only), which also avoids division by zero and `zoomAt`'s RangeError for factor 0.
  Throws RangeError if a points array does not hold exactly two points.
- `trackpadPinchFactor(deltaPixels)` → `Math.exp(−d / 100)` with d clamped to ±50 px.
- Pointer bookkeeping (immutable, returns new objects):
  `emptyGesture()`, `startPointer(gesture, pointerId, point)`,
  `movePointer(gesture, pointerId, point, viewport, limits)` → `{ gesture, viewport }`,
  `endPointer(gesture, pointerId)`.
  With one tracked pointer, a move pans by its delta (today's drag); with two, it calls
  `pinchViewport` with both previous positions and both positions after this move. Moves of
  untracked pointers return the inputs unchanged. `startPointer` ignores a third pointer and a
  repeated id. Lifting a finger just removes it, so the next move of the other finger pans from
  that finger's own last position: no jump, no special case.

**New shared shape — `PointerGesture`** (created by `emptyGesture`/`startPointer` in
`core/pinch-zoom.js`, used only by `ui/viewer-input.js`, never stored in the app store):
`{ pointers }`, an array of 0–2 entries `{ id, x, y }` in touch-down order; `id` is the
browser's `pointerId`, `x`/`y` the pointer's last position in CSS px relative to the frame's
top-left corner.

*Alternative:* keep the bookkeeping in `viewer-input.js`. Rejected: `ui/` is not unit-tested,
and the transition rules (lift, third finger) are exactly what breaks silently.

### 2. Incremental pinch (previous event → current event), not "gesture start → now"

Each move applies the change since the previous move to the current viewport, like the
existing drag pan. Without clamping both give the same result (distance ratios multiply,
midpoint mapping composes). With clamping, a start-anchored pinch has a dead zone: after
over-pinching past 6400 %, pinching back does nothing until the fingers return to where the
limit was hit. Incremental reacts at once. It also needs no re-baselining when a finger is
added or lifted. Floating-point drift over hundreds of events is far below a CSS pixel.

### 3. Pointer Events, not Touch Events

The frame already uses Pointer Events with `setPointerCapture`; they cover mouse, pen and
touch with one code path and are supported by all current browsers including iOS Safari 13+.
Each tracked pointer is captured, so a finger sliding off the frame keeps working. Only
`button === 0` starts tracking (touch contacts and pen tips report 0). `pointercancel` of any
tracked pointer resets to `emptyGesture()` (the browser has taken the touches, e.g. a system
gesture or call); the viewport stays where the last move left it.

### 4. Ctrl + wheel = trackpad pinch, factor `e^(−d/100)`

Chrome/Edge (and Firefox) turn a trackpad pinch into wheel events with `ctrlKey: true`.
Chromium sets the delta to about 100 · ln(scale change), so `e^(−d/100)` recovers the scale
the fingers made and the content follows them; today's ×1.25-per-100-px rate gives only
×1.17 for a 2× spread. A Ctrl + mouse-wheel notch (≈100 px) would become ×2.7 with that formula,
so each event's delta is clamped to ±50 px (×1.65 per notch; pinch events are a few px each and
never hit the clamp). Plain wheel (no Ctrl) is unchanged. *Trade-off:* Ctrl + mouse wheel zooms
faster than plain wheel (×1.65 vs ×1.25); acceptable, Ctrl + wheel means "zoom" in browsers.

### 5. Safari `gesturestart`/`gesturechange`/`gestureend`: handled

macOS Safari reports trackpad pinch only as these non-standard events, and its default action
zooms the whole page. `viewer-input.js` calls `preventDefault` on them (while an image is
shown) and on `gesturechange` zooms with the existing `zoomAt` by `event.scale / lastScale`
around `(clientX, clientY)` relative to the frame (frame center if missing); `lastScale`
resets to 1 on `gesturestart`. iOS Safari fires the same events during a touch pinch, which
the pointer path already handles — so gesture events never zoom while the `PointerGesture`
tracks any pointer (spec: "applied once"). Non-positive or non-finite scales are ignored.
No new core function: the math is `zoomAt`. *Alternative:* ignore Safari — a Mac pinch would
zoom the page instead of the chart.

### 6. Page zoom suppression stays CSS-only

`touch-action: none` on `.viewer` (only) is the standard way to stop browser pan/zoom for
touches that start there; the rest of the page keeps `auto`. An integration test reads
`styles/main.css` and asserts the `.viewer` block contains `touch-action: none` and that
`html`/`body`/`:root` rules do not set `touch-action`. No `<meta viewport user-scalable=no>`:
that would break accessibility zoom for the whole page.

### 7. Double-tap zoom: out of scope

It needs tap-timing and movement-slop detection that competes with pan start, and Fit, `+`
and pinch already cover the need. Because of `touch-action: none` a double tap on the frame
also does not zoom the page (specced).

### 8. `scripts/serve.js --host <address>` (dev tooling, not app behavior)

`parseCommandLine` gains `--host` (default `127.0.0.1`) and is exported for tests. When the host
is not a loopback address (`localhost`, `::1`, `127.x.x.x`), the script prints a warning
("reachable by every device on this network"); when it listens on all interfaces (`0.0.0.0`
or `::`) it also lists the LAN URLs from `os.networkInterfaces()` (IPv4, non-internal). The served
content is the repo's static files (dotfiles already blocked); images picked on the phone stay
on the phone. Tests only parse arguments and never bind `0.0.0.0` (that would trigger a
Windows firewall prompt). *Alternative:* Chrome DevTools device mode — useful for one-finger
touch, but its Shift + drag pinch emulation is not known to deliver two separate touch
pointers to the page, so it cannot replace a phone check.

## Risks / Trade-offs

- [iOS fires gesture and pointer events for one pinch → double zoom] → gesture zoom is skipped
  while pointers are tracked; smoke check on an iPhone if available.
- [After hitting a zoom limit the content no longer stays exactly under the fingers] →
  inherent to limits; the midpoint rule still holds, only the spread is ignored.
- [On a phone where the frame fills the screen, the page cannot be scrolled by touching the
  frame] → layout question owned by `improve-mobile-layout`; noted there, not solved here.
- [`improve-mobile-layout` rewrites the `.viewer` rule] → the CSS integration test fails on
  rebase and points at it.
- [Firefox's Ctrl + wheel pinch deltas may use another scale than Chromium's] → smoke check
  in Firefox; the clamp bounds the worst case.
- [`--host 0.0.0.0` exposes the dev server on the LAN] → opt-in, warning printed, default
  unchanged; the user stops it with Ctrl+C after the check.
- [Every move re-renders the frame; big patterns may lag during pinch] → same cost as today's
  drag; performance is `tile-large-pattern-rendering`'s scope.

## Migration Plan

None: no stored data or format changes. Rollback = revert the commits.
