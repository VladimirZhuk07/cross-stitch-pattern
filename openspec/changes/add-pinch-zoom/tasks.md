# Tasks

## 1. Pinch math (core, TDD)

- [ ] 1.1 Write failing tests in `tests/unit/core/pinch-zoom.test.js` for `pinchViewport` (limits `{ minScale: 0.5, maxScale: 64 }` unless stated, tolerance 1e-9): viewport `{ scale: 1, offsetX: 0, offsetY: 0 }`, points (100, 100)/(200, 100) → (50, 100)/(250, 100) gives `{ 2, −150, −100 }`; → (130, 140)/(230, 140) gives `{ 1, 30, 40 }`; → (80, 150)/(280, 150) gives `{ 2, −120, −50 }`; scale 40 and the spread to 200 px gives `{ 64, −90, −60 }`; scale 0.8 and (125, 100)/(175, 100) gives `{ 0.5, 56.25, 37.5 }`; both previous points at (100, 100) → one moved to (120, 120) gives `{ 1, 10, 10 }`; previous (100, 100)/(120, 120) → both at (120, 120) gives `{ 1, 10, 10 }` (current distance 0, no error); one point or three points throw `RangeError` naming the count; arguments are not modified; verify they fail (module missing)
- [ ] 1.2 Create `src/core/pinch-zoom.js` with `pinchViewport` built on `zoomAt` and `panBy` from `./viewport.js`, constant `MIN_PINCH_DISTANCE = 1`, and a header comment describing the module (design D1, D2); verify 1.1 passes
- [ ] 1.3 Write failing tests for `trackpadPinchFactor`: −40 → 1.4918247 (1e-6), +100 → 0.6065307 (same as +50), −100 → 1.6487213, 0 → 1, −10 → 1.1051709; verify they fail
- [ ] 1.4 Implement `trackpadPinchFactor` with `TRACKPAD_PINCH_PIXELS = 100` and `MAX_TRACKPAD_PINCH_DELTA = 50` and a comment citing why (Chromium reports ≈ 100 · ln(scale)); verify 1.3 passes

## 2. Pointer bookkeeping (core, TDD)

- [ ] 2.1 Write failing tests for `emptyGesture`, `startPointer`, `movePointer`, `endPointer` (same file): empty gesture has no pointers; two `startPointer` calls track ids 1 and 2 with their points; a third id and a repeated id return the gesture unchanged; with one tracked pointer and viewport `{ 1, 16, 158 }`, moving it by (+30, −20) gives `{ 1, 46, 138 }`; spread as two events (id 1 (100, 100) → (50, 100), then id 2 (200, 100) → (250, 100)) from `{ 1, 0, 0 }` gives `{ 2, −150, −100 }`; after `endPointer(1)`, id 2 moving (250, 100) → (270, 90) gives offset (−130, −110), scale 2; both at (100, 100) moving to (120, 120) one after the other gives `{ 1, 20, 20 }`; moving an untracked id (3) returns the same gesture and viewport; `endPointer` of an unknown id returns the gesture unchanged; inputs are never modified; verify they fail
- [ ] 2.2 Implement the four functions and `MAX_GESTURE_POINTERS = 2` in `src/core/pinch-zoom.js`, describing the `PointerGesture` shape in a plain-text comment next to `emptyGesture`; verify 2.1 passes and the file stays under ~300 lines

## 3. Viewer input (ui)

- [ ] 3.1 In `src/ui/viewer-input.js` replace `setupDragPan` with pointer-gesture tracking on the core functions: `pointerdown` (button 0, image shown) → `startPointer` + `setPointerCapture` only when the pointer was accepted; `pointermove` → `movePointer` with frame-relative points and `zoomLimits`, `setState` only when the viewport changed; `pointerup` → `endPointer`; `pointercancel` → `emptyGesture()`; `viewer--panning` while any pointer is tracked; reset the gesture if the image disappears; update the module comment's input table; verify `npm test` passes and, in the dev server, a mouse drag still pans
- [ ] 3.2 In the wheel handler use `trackpadPinchFactor` when `event.ctrlKey` is set, `wheelZoomFactor` otherwise (delta conversion unchanged); verify `npm test` passes
- [ ] 3.3 Add Safari `gesturestart`/`gesturechange`/`gestureend` listeners (design D5): `preventDefault` while an image is shown, `zoomAt` by `scale / lastScale` around the frame-relative `clientX/clientY` (frame center if missing), skip zooming while the pointer gesture tracks any pointer, ignore non-positive or non-finite scales; verify `npm test` passes and `viewer-input.js` stays under ~300 lines

## 4. Page-zoom guard (integration)

- [ ] 4.1 Add `tests/integration/viewer-touch-action.test.js`: read `styles/main.css`, assert the `.viewer { … }` block contains `touch-action: none` and no `html`, `body` or `:root` rule sets `touch-action`; verify it passes, then temporarily delete the declaration to see it fail, and restore it (do not commit the deletion)

## 5. Dev server reachable from a phone (scripts)

- [ ] 5.1 Write failing cases in `tests/integration/serve.test.js` for an exported `parseCommandLine(args, env)`: no arguments → host `127.0.0.1`, port 8080, base `/`; `--host 0.0.0.0` → host `0.0.0.0`; `--host` without a value throws an `Error` mentioning `--host`; `--port 0 --base repo` unchanged behavior; the tests never start a server on `0.0.0.0`; verify they fail
- [ ] 5.2 Implement `--host` in `scripts/serve.js` (export `parseCommandLine`, pass `host` to `startServer`, update the usage comment); when the host is not `127.0.0.1`, `::1` or `localhost`, print a warning that the server is reachable by every device on the network and list `http://<IPv4>:<port><base>` for each non-internal IPv4 address from `os.networkInterfaces()`; verify 5.1 passes and `node scripts/serve.js --host 0.0.0.0 --port 8090` prints the warning and at least one LAN URL (stop it with Ctrl+C)

## 6. Verification

- [ ] 6.1 Run `npm run test:unit`; all tests pass (show output)
- [ ] 6.2 Run `npm run test:integration`; all tests pass (show output)
- [ ] 6.3 Browser smoke check (the user runs it; record anything not checked as "not verified", not as passed):
  - **Desktop (Chrome or Edge, Windows):** `node scripts/serve.js`, open `http://127.0.0.1:8080/`, load a photo, generate a pattern. Mouse drag pans; plain wheel zooms ×1.25 per notch around the cursor; `+`, `−`, `0`, arrow keys and Fit behave as before. Ctrl + mouse wheel over the frame zooms the view around the cursor (about ×1.65 per notch) and the browser's page zoom does not change; over the settings panel Ctrl + wheel zooms the page as usual. Touchpad pinch over the frame: the content under the fingers roughly follows them, the page does not zoom, zoom stops at 6400 % and at half the fit zoom. Repeat the touchpad pinch in Firefox. On a Mac with Safari, if available: trackpad pinch zooms the view, not the page.
  - **Phone (same Wi-Fi):** on the PC run `node scripts/serve.js --host 0.0.0.0`, read the warning and the printed LAN URL (e.g. `http://192.168.1.23:8080/`), allow Node for *private* networks if Windows Firewall asks, open the URL on the phone; stop the server with Ctrl+C afterwards. Load a photo from the phone, generate a pattern. One-finger drag pans. Two fingers spread: the view zooms and the spot between the fingers stays under them; pinch in: it shrinks and stops at half the fit zoom; moving both fingers pans while zooming. Lift one finger and keep moving the other: the view pans with no jump; put the second finger back and pinch: no jump. A third finger changes nothing. The page itself never zooms over the frame (settings text keeps its size), a double tap on the frame does nothing, and pinching or scrolling on the settings panel zooms/scrolls the page normally. Switching layers keeps zoom and position. On an iPhone, if available: a 2× spread gives 2× zoom, not 4×.
  - DevTools Console shows no errors; Network shows only the app's own files.
- [ ] 6.4 Run `openspec validate add-pinch-zoom --strict`; it reports the change is valid
