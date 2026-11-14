# Proposal

## Why

On phones and tablets the view frame only pans with one finger; spreading two fingers does
nothing, and on a laptop trackpad a pinch zooms about 4× slower than the fingers move. Users
expect to zoom a chart by pinching ("so I can enlarge it with two fingers").

## What Changes

User-visible behavior:

- **Two-finger pinch on a touch screen** zooms the view around the midpoint between the
  fingers; the content under the midpoint stays under it, and moving both fingers pans at the
  same time. Zoom limits are the existing ones (half the fit zoom … 6400 %).
- **Changing the number of fingers never makes the view jump**: lifting one of two fingers
  continues as a one-finger pan, a third finger is ignored, and a cancelled touch ends the
  gesture where it is.
- **The page itself does not zoom** while pinching over the frame; outside the frame the page
  scrolls and zooms as before (the frame already has `touch-action: none`; now specced and
  guarded by a test).
- **Trackpad pinch on desktop** follows the fingers: Chrome, Edge and Firefox report it as a
  Ctrl + wheel event, which now zooms by `e^(−deltaY / 100)` (the scale the browser measured)
  instead of the ×1.25-per-100-px wheel step. Safari's `gesturechange` events are handled too,
  so pinching on a Mac does not zoom the page.
- Dev tooling: opt-in `node scripts/serve.js --host 0.0.0.0` to open the app on a phone in
  the same Wi-Fi (default stays `127.0.0.1`).

## Out of scope

- Double-tap to zoom, inertia/fling after a pan, rubber-band effects at the zoom limits,
  rotation.
- Mobile page layout and `index.html` structure (owned by the parallel change
  `improve-mobile-layout`), rendering speed while zooming (`tile-large-pattern-rendering`),
  pattern size limits (`raise-pattern-limits`).
- Changing the plain mouse wheel, `+`/`−`, keyboard or Fit behavior.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pattern-viewer`: adds two-finger pinch zoom and pan, finger-count transitions, page-zoom
  suppression over the frame, and trackpad pinch; the wheel-zoom requirement is narrowed to the
  wheel without Ctrl.

## Impact

- New pure module `src/core/pinch-zoom.js` (+ `tests/unit/core/pinch-zoom.test.js`).
- `src/ui/viewer-input.js`: multi-pointer tracking, Ctrl + wheel, Safari gesture events.
- `scripts/serve.js`: `--host` option (+ cases in `tests/integration/serve.test.js`).
- New integration test that `styles/main.css` keeps `touch-action: none` on the frame.
  `styles/main.css`, `src/core/viewport.js`, `viewer.js` and the layers are not edited.
- No new dependencies, no network access.
