# Tasks

## 1. Dev server and page skeleton

- [x] 1.1 Write `tests/integration/serve.test.js` (server on port 0 over a temporary fixture site, closed in `after()`): `/` → 200 `text/html`; missing file → 404; `/%2e%2e/outside.txt` and `/.git/HEAD` → 404; HEAD → 200 without body; POST → 405; with `basePath: '/repo/'`, `/repo/` → `index.html` and `/index.html` → 404. Verify it fails because `scripts/serve.js` does not exist
- [x] 1.2 Implement `scripts/serve.js` per design D10 (`startServer` export + CLI with `--port`, `--base`, `PORT`; prints the URL with `process.stdout.write`). Verify `npm run test:integration` passes and `node scripts/serve.js` serves on 8080
- [x] 1.3 Write `tests/helpers/site-references.js` (extract HTML, JS, CSS references) and `tests/integration/served-site.test.js` (crawl from `/cross-stitch-pattern/` per D10). Verify it fails because `index.html` is missing
- [x] 1.4 Create `index.html` (static markup: header with labelled file chooser, layer-switcher fieldset with three radios `original`/`dmc`/`chart` with `dmc` and `chart` disabled, zoom buttons and zoom `<output>`, focusable viewer with canvas and empty-state text, status `<output aria-live="polite">`, D11 comment anchors, `<link rel="icon" href="data:,">`), `styles/main.css` (tokens on `:root`, layout, `:focus-visible`, drop-target and error styles), `styles/print.css` (hides controls), and an empty `src/main.js` module. Verify `npm run test:integration` passes

## 2. Image size cap (core)

- [x] 2.1 Write `tests/unit/core/image-size.test.js`: 1200×800 → unchanged, `isDownscaled: false`; 2048×2048 → unchanged; 6000×4000 → 2048×1365; 100×5000 → 41×2048; 10000×3 → 2048×1; `RangeError` for width 0, width 12.5, height −1, maxSide 0. Verify it fails
- [x] 2.2 Implement `capImageSize(width, height, maxSide)` in `src/core/image-size.js` with a plain-words comment describing the returned shape. Verify `npm run test:unit` passes

## 3. Viewport math (core)

- [x] 3.1 Write tests in `tests/unit/core/viewport.test.js` for `fitViewport` and `zoomLimits`: 2000×1000 in 1000×800 → scale 0.484, offset (16, 158); 100×50 in 1000×800 → scale 9.68, offset (16, 158); `RangeError` for a 0-wide frame or content; limits for fit 0.484 → min 0.242, max 64; fit 100 → max 100. Verify they fail
- [x] 3.2 Implement `fitViewport`, `zoomLimits`, `FIT_MARGIN`, `MAX_SCALE` and the plain-words description of the viewport shape in `src/core/viewport.js`. Verify the 3.1 tests pass
- [x] 3.3 Add tests for `zoomAt` and `wheelZoomFactor`: scale 1 offset (0, 0), factor 1.25 at (100, 50) → scale 1.25, offset (−25, −12.5); scale 60 × 1.25 with max 64 → 64 and the anchor point stays fixed; zoom out below min clamps to min; `wheelZoomFactor(-100)` → 1.25, `(100)` → 0.8, `(0)` → 1. Verify they fail
- [x] 3.4 Implement `zoomAt`, `wheelZoomFactor` and `ZOOM_STEP`. Verify the 3.3 tests pass
- [x] 3.5 Add tests for `panBy`, `recenterOnResize`, `contentRect`, `canvasBufferSize`: pan (16, 158) by (30, −20) → (46, 138); resize 1000×800 → 800×800 moves offset (16, 158) → (−84, 158); content 2048×1365 at scale 0.5 offset (10, 20) → rect (10, 20, 1024, 682.5); buffer 800×600 @2 → 1600×1200, 801×601 @1.25 → 1001×751; `RangeError` for pixel ratio 0. Verify they fail
- [x] 3.6 Implement `panBy`, `recenterOnResize`, `contentRect`, `canvasBufferSize`. Verify `npm run test:unit` passes (all viewport tests)

## 4. Application state

- [x] 4.1 Write `tests/unit/ui/store.test.js`: `getState` returns the initial state; `setState` merges shallowly into a new frozen object; listeners get `(state, previous)` in subscription order; no notification when all given values are `===` current; unsubscribe stops calls; a nested `setState` from a listener ends with the newest state. Verify it fails
- [ ] 4.2 Implement `createStore` in `src/ui/store.js` per design D5. Verify the store test passes
- [ ] 4.3 Create `src/ui/app-state.js` with `createInitialState()` and a comment describing every state field in plain words (design: Data shapes) (`image: null`, `pattern: null`, `activeLayer: 'original'`, `viewport: null`, `frame: { width: 0, height: 0 }`, status idle). Verify it imports in Node without a DOM: `node -e "import('./src/ui/app-state.js').then(m => console.log(m.createInitialState()))"`

## 5. Image import (io + ui)

- [ ] 5.1 Implement `src/io/image-loader.js` per design D6 (`MAX_DECODE_SIDE`, `LoadedImage`, `ImageDecodeError`, `loadImageFile`). Verify `npm run test:integration` passes and the module imports nothing outside `core/`
- [ ] 5.2 Implement `src/ui/status.js` (`setupStatus(root, store)`: text via `textContent`, error class for `kind: 'error'`). Verify `npm run test:integration` passes (the module is reachable from `main.js`); the idle text is checked in 7.3
- [ ] 5.3 Implement `src/ui/image-input.js` file-chooser path per design D7: loading text `Loading <name>…`, summary `<name> — W × H px` plus `(downscaled from W × H px)`, the exact error text from the spec, `latestLoadId` stale guard, closing replaced and stale bitmaps, resetting `pattern`, `activeLayer`, `viewport`. Verify `npm run test:integration` passes; the texts are checked in 7.3
- [ ] 5.4 Add drag-and-drop to `image-input.js` (first file only, drop-target highlight, prevent navigation on drops outside the frame). Verify `npm run test:integration` passes; dropping is checked in 7.3

## 6. Viewer and layers (ui)

- [ ] 6.1 Write `tests/integration/view-layers.test.js`: the three factories return layers with ids `original`, `dmc`, `chart` and `render` functions; `original.isAvailable` is true without a pattern; `dmc` and `chart` are false with `pattern: null` and true with `pattern: {}`; the radio values in `index.html` are exactly `original, dmc, chart` in that order. Verify it fails
- [ ] 6.2 Create `src/ui/layers/original-layer.js` (draws the bitmap into `frame.content`, smoothing off when `scale ≥ 1`). Verify the original-layer part of 6.1 passes
- [ ] 6.3 Create the stubs `src/ui/layers/dmc-layer.js` and `src/ui/layers/chart-layer.js` (`isAvailable: state.pattern !== null`, centered "not available yet" note). Verify `npm run test:integration` passes
- [ ] 6.4 Implement `src/ui/viewer.js` (`setupViewer(root, store, layers)`, header comment with the view-layer contract from design D4): `ResizeObserver` → `frame` and `recenterOnResize`; fit when `viewport` is null; rAF-coalesced repaint of the active layer only; DPR buffer check per paint (D9); empty-state text toggle; skip painting for a 0-size frame. Verify `npm run test:integration` passes; fit and resize are checked in 7.3
- [ ] 6.5 Implement `src/ui/viewer-input.js` (`setupViewerInput(root, store)`) per design D8: drag pan, wheel zoom at the cursor with `deltaMode` normalization, keys `+`/`=`, `-`, `0`, arrows. Verify `npm run test:integration` passes; zoom at the cursor is checked in 7.3
- [ ] 6.6 Implement `src/ui/zoom-controls.js` (`+`, `−`, `Fit` around the frame center; zoom shown as a whole percentage; all disabled without an image). Verify `npm run test:integration` passes; the buttons are checked in 7.3
- [ ] 6.7 Implement `src/ui/layer-switcher.js` (`setupLayerSwitcher(root, store, layers)`): enable/disable from `isAvailable`, write `activeLayer` on change, fall back to `original` when the active layer becomes unavailable. Verify `npm run test:integration` passes; disabled radios are checked in 7.3
- [ ] 6.8 Wire everything in `src/main.js` (store, `const layers = [createOriginalLayer(), createDmcLayer(), createChartLayer()]`, `setup*` groups per D11). Verify `npm test` passes and the page loads without console errors

## 7. Verification

- [ ] 7.1 Run `npm run test:unit` and confirm all unit tests pass
- [ ] 7.2 Run `npm run test:integration` and confirm all integration tests pass
- [ ] 7.3 Manual browser smoke check with `node scripts/serve.js --base /cross-stitch-pattern/`, open `http://127.0.0.1:8080/cross-stitch-pattern/`:
  - start: frame shows `Choose an image or drop it here`; `+`, `−`, `Fit` disabled; `DMC colors` and `Chart` disabled, `Original` selected
  - pick a ~1200×800 JPG: status `<name> — 1200 × 800 px`, image fitted and centered
  - pick a photo larger than 2048 px: status names the 2048 px size and `(downscaled from …)`
  - pick a PNG with transparency: transparent areas show the frame background
  - wheel over a detail: the detail stays under the cursor; `+` from 200 % shows 250 %; `Fit` refits
  - drag to pan; Tab to the frame (visible focus ring), then arrows pan and `+`/`-`/`0` zoom
  - resize the window: zoom stays, the center point stays centered; set browser zoom to 200 %: image edges stay sharp
  - drop two files on the frame: the first loads; drop a file outside the frame: the page does not navigate
  - pick `notes.txt`: the spec error text appears and the previous image stays at its zoom
  - pick a large photo then quickly a small PNG: the small PNG is shown
  - DevTools Network: only the app's own files load (no favicon, no external requests); Console: no errors
- [ ] 7.4 Run `openspec validate add-app-shell --strict` and confirm it passes
