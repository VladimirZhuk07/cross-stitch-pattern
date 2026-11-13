# Tasks

## 1. Stitch image (core)

- [x] 1.1 Write failing unit tests in `tests/unit/core/pattern-image.test.js` for `patternToStitchImage` (patterns built with `buildPattern`): 1 × 1 `321` → `{ width: 1, height: 1 }`, data `[199, 43, 59, 255]`; 2 × 2 `[310, BLANC]` cells `[0, -1, 1, 0]` → `[0,0,0,255, 0,0,0,0, 255,255,255,255, 0,0,0,255]`; `BLANC` vs empty (2 × 1, `[0, -1]`) differ in alpha; merged clusters `[321, 310, 321]` cells `[0, 1, 2]`; fully empty 2 × 2 → 16 zero bytes; `data` is a `Uint8ClampedArray` of length `width × height × 4`; the pattern is not modified. Errors: hand-built 2 × 1 pattern with cells `[0, 1]` and a 1-entry legend → RangeError containing `1`; 3 × 2 with 5 cells → RangeError containing `6` and `5`; a cell `-2` → RangeError containing `-2`. Verify `node --test tests/unit/core/pattern-image.test.js` fails because the module does not exist
- [x] 1.2 Implement `patternToStitchImage` in `src/core/pattern-image.js` (design D1; StitchImage described in a comment next to it; RGB per legend entry computed once with `hexToRgb`; imports only `./color.js` and `./pattern.js`). Verify the tests from 1.1 pass
- [x] 1.3 Write failing unit tests for `isStitchSmallerThanDevicePixel(pattern, content, pixelRatio)`: 2 × 1 in 968 × 484 CSS px at ratio 1 → false; 968 × 484 in 484 × 242 at ratio 2 → false (exactly 1 device px); 1000 × 500 in 484 × 242 at ratio 2 → true; 10 × 500 in 484 × 242 at ratio 2 → true (height only); 969 × 10 in 484 × 242 at ratio 2 → true (width only). Verify they fail
- [x] 1.4 Implement `isStitchSmallerThanDevicePixel` in `src/core/pattern-image.js` (design D3). Verify `npm run test:unit` passes

## 2. DMC colors layer (ui)

- [ ] 2.1 Write failing `tests/integration/dmc-preview-layer.test.js` (design D7): stub `globalThis.OffscreenCanvas` (records size and `putImageData` data; restored in `after()`) and a fake 2D context recording `drawImage` arguments, `imageSmoothingEnabled` and any other drawing call. With patterns from `buildPattern` check: `isAvailable` true for a built pattern, false for `null`; a 2 × 1 `[310, 321]` pattern with content x 10, y 20, 200 × 100 → exactly one `drawImage(bitmap, 10, 20, 200, 100)`, bitmap 2 × 1 with data `[0,0,0,255, 199,43,59,255]`, smoothing false, no `fillText`/`fillRect`/`stroke`; 1000 × 500 pattern in 484 × 242 at ratio 2 → smoothing true; five renders of the same pattern with different content rectangles → one `OffscreenCanvas`; a new pattern Q `[321]` → a second bitmap whose data is `[199,43,59,255]`; fully empty 2 × 2 pattern renders without throwing. Verify it fails against the stub
- [ ] 2.2 Replace the stub in `src/ui/layers/dmc-layer.js` with the real layer (design D2–D6): keep `createDmcLayer` and id `'dmc'`, `isAvailable: state.pattern !== null`, cache `{ pattern, bitmap }` in the closure, build the bitmap with `patternToStitchImage` + `new ImageData` + `OffscreenCanvas.putImageData`, set smoothing via `isStitchSmallerThanDevicePixel`, one `drawImage` into `frame.content`; remove the "not available yet" note and update the header comment. Verify `npm run test:integration` passes, including the unchanged `view-layers.test.js`

## 3. Verification

- [ ] 3.1 Run `npm run test:unit` and confirm all unit tests pass
- [ ] 3.2 Run `npm run test:integration` and confirm all integration tests pass
- [ ] 3.3 Manual browser smoke check. Precondition: add-pattern-generation (#4) is merged into `main` and this branch is rebased onto it (before that `state.pattern` is always `null` and `DMC colors` stays disabled, so this check cannot run). Start `node scripts/serve.js --base cross-stitch-pattern`, open `http://127.0.0.1:8080/cross-stitch-pattern/`:
  - load a photo and generate a pattern (e.g. 100 stitches wide, 20 colors): `DMC colors` becomes enabled
  - select `DMC colors`: the image appears as solid stitch blocks, no "not available yet" note, no grid lines
  - zoom in far (`+` repeatedly, up to 6400 %): each stitch is a crisp, uniform square with hard edges, no blur
  - switch between `Original`, `DMC colors` and back at 250 %: zoom and position stay the same and blocks line up with the image
  - pan and wheel-zoom on `DMC colors`: smooth, no visible re-computation delay
  - load a PNG with transparent areas and generate: transparent areas show the frame background, white areas are clearly white
  - zoom out to the minimum on a wide pattern: the picture is smoothed rather than missing stitches
  - set browser zoom to 200 %: block edges stay sharp
  - DevTools Console: no errors; Network: no external requests
- [ ] 3.4 Run `openspec validate add-dmc-preview-layer --strict` and confirm it passes
