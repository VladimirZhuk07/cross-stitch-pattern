# Tasks

## 1. Seeded random numbers (core)

- [x] 1.1 Write `tests/unit/core/random.test.js`: two generators with the same seed give the same 1000 values; every value is in [0, 1); seeds 1 and 2 give different first values; a non-integer seed throws a `RangeError` naming the value. Verify it fails
- [x] 1.2 Implement `createSeededRandom(seed)` in `src/core/random.js` (mulberry32, source cited, plain-text header comment). Verify `node --test tests/unit/core/random.test.js` passes

## 2. Stitch grid size and resize (core)

- [x] 2.1 Write grid-size tests in `tests/unit/core/stitch-grid.test.js`: `stitchGridSize` 1200 × 800 @100 → 100 × 67, 2048 × 1365 @100 → 100 × 67, 800 × 1200 @100 → 100 × 150, 2048 × 1 @100 → 100 × 1, 41 × 2048 @100 → height 4995; `maxTargetWidth` 41 × 2048 → 10, 10 × 2048 → 2, 1 × 2048 → 0, 1200 × 800 → 500; invalid image sizes (0, 12.5) throw `RangeError`. Verify it fails
- [x] 2.2 Implement `MAX_GRID_SIDE`, `stitchGridSize`, `maxTargetWidth` in `src/core/stitch-grid.js` per design D2. Verify the grid-size tests pass
- [x] 2.3 Add `resizeToGrid` tests: black + white 2 × 1 → 1 cell linear `(0.5, 0.5, 0.5)`; red/blue/green 3 × 1 → 2 cells `(0.6667, 0, 0.3333)` / `(0, 0.6667, 0.3333)` within 1e-4; opaque `(199,43,59)` + transparent → alpha 0.5 and the opaque pixel's linear color exactly; 1 opaque of 4 → alpha 0.25; 1 × 1 → 3 × 3 upscale gives 9 equal cells; fully transparent → all alpha 0 and color 0; wrong buffer length (2 × 2 with 12 bytes) throws `RangeError` containing `16` and `12`; the input buffer is unchanged. Verify they fail
- [x] 2.4 Implement `EMPTY_ALPHA_THRESHOLD = 0.5` and `resizeToGrid` per design D3 (separable overlap spans, 256-entry linear table, alpha-weighted color). Verify `node --test tests/unit/core/stitch-grid.test.js` passes

## 3. k-means in CIELAB (core)

- [x] 3.1 Write `tests/unit/core/kmeans.test.js`: 4 points at two Lab colors with `maxClusters` 24 → exactly 2 centres equal to those colors, assignments grouping them; `maxClusters` 1 → one centre at the mean; 0 points → `{ centres: [], assignments: [] }`; 200 synthetic points with `maxClusters` 8 → at most 8 centres, every assignment a valid index, each centre the mean of its points (1e-9); the same call twice → deep-equal; a different seed may differ but stays valid; `maxClusters` 0 or 1.5 → `RangeError`; points length not a multiple of 3 → `RangeError`; input not modified. Verify it fails
- [x] 3.2 Implement `KMEANS_SEED`, `MAX_KMEANS_ITERATIONS`, `kMeansLab` in `src/core/kmeans.js` per design D4 (k-means++ init with early stop at ΣD² = 0, Lloyd with lowest-index ties, empty cluster keeps its centre). Verify the k-means tests pass

## 4. Settings defaults and texts (core)

- [x] 4.1 Write `tests/unit/core/generation-settings.test.js`: `DEFAULT_SETTINGS` is `{ targetWidth: 100, maxColors: 24, fabricCount: 14 }` and frozen; form ranges width 10–500, colors 1–99; `parseWholeNumber` accepts `'100'`, `' 24 '` and rejects `''`, `'12.5'`, `'5'` (below min), `'600'`, `'abc'` (→ `null`); `formatPatternSize({100, 67}, 14)` and `(…, 18)` give the spec texts; `formatGridTooLarge` gives the 4995/10 text and the "too tall and narrow" text when the max width is below 10; `NO_IMAGE_SIZE_TEXT`; `describeGenerationResult` for 18 colors, 1 color, and an empty legend; the two invalid-field messages. Verify it fails
- [x] 4.2 Implement `src/core/generation-settings.js` per design D10/D11. Verify the settings tests pass

## 5. Pipeline (core)

- [x] 5.1 Write `tests/unit/core/pattern-generator.test.js` with a prepared two-color test palette (`K` `#000000`, `W` `#FFFFFF`): black/white 2 × 2 → `K` 2 + `W` 2, cells `[0, 0, 1, 1]`; left column transparent → `[0, -1, 0, -1]`; fully transparent → all `-1`, empty legend; 1 opaque of 4 @1 → `[-1]`; targetWidth 0 / 501 / 12.5 and maxColors 0 / 100 → `RangeError` with field name and value; 41 × 2048 @100 → `RangeError` containing `4995`, `500`, `10`; pixels and settings not modified; same input twice → deep-equal. Verify it fails
- [x] 5.2 Write `tests/integration/pattern-pipeline.test.js` with the real DMC palette (default argument): 2 × 2 black → `310` ×4; black/white rows @24 → `310` (2), `B5200` (2); same @1 → `317` ×4; black + white 2 × 1 @1 → `03`; `(199,43,59)` → `321` with the full legend entry; `(255,0,0)` → `606`; `(199,43,59)` + transparent → `321`; `(0,0,0)` + `(5,5,5)` @2 colors → one `310` entry with 2 stitches, cells `[0, 0]`; 1 × 1 black @3 → 3 × 3, `310` ×9; 41 × 2048 @10 → 10 × 500; 64 × 64 gradient @32 / 8 colors → 32 × 32, 1–8 legend entries, counts sum 1024, deep-equal on a second run. Verify it fails
- [x] 5.3 Implement `generatePattern` in `src/core/pattern-generator.js` per design D5/D6 (lazy prepared DMC palette, imports only `core/` and `data/`). Verify `npm run test:unit` and `node --test tests/integration/pattern-pipeline.test.js` pass

## 6. Worker (workers)

- [x] 6.1 Write `tests/integration/pattern-worker.test.js` calling `createPatternWorkerHandler()` directly: request id 7 with a 2 × 2 black image → `{ type: 'pattern', id: 7 }`, 2 × 2, `310` ×4, `transfer` contains `pattern.cells.buffer`; then id 8 without image @1 → 1 × 1 `310` ×1; fresh handler without image → error id 1 mentioning `image`; `{ type: 'resize', id: 3 }` → error id 3 mentioning `resize`; maxColors 100 → error id 4 with `100` and `99`, and the next valid request still succeeds; a response survives `structuredClone(response, { transfer })`. Verify it fails
- [x] 6.2 Implement `src/workers/pattern-worker-handler.js` per design D7 (no `self`, imports only `core/`). Verify the worker test passes
- [x] 6.3 Create the entry `src/workers/pattern.worker.js` (message listener → handler → `postMessage(response, transfer)`). Verify it imports only `./pattern-worker-handler.js` and `npm run test:integration` passes

## 7. Browser I/O (io)

- [x] 7.1 Write `tests/integration/pattern-worker-client.test.js` with a fake worker that answers via the real handler after `structuredClone(…, { transfer })`: `generate` resolves with the pattern; two concurrent requests get distinct ids and resolve with their own patterns; the image pixel buffer is in the posted transfer list (detached afterwards); an error response rejects with its message; an `error` event rejects all pending requests with `The pattern worker stopped`. Verify it fails
- [x] 7.2 Implement `createPatternWorkerClient(worker)` in `src/io/pattern-worker-client.js` per design D8. Verify the client test passes
- [x] 7.3 Implement `readImagePixels(image)` in `src/io/image-pixels.js` per design D1 (`OffscreenCanvas`, `willReadFrequently`, returns a pixel image). Verify it imports nothing outside `core/` and `npm run test:integration` passes; real pixels are checked in 9.3

## 8. Settings form and generation (ui)

- [x] 8.1 Add `settings: { ...DEFAULT_SETTINGS }` and `generation: { kind: 'idle', text: '' }` to `createInitialState` in `src/ui/app-state.js`, with their plain-words description in the header comment (design D11). Verify `npm test` passes and `node -e "import('./src/ui/app-state.js').then(m => console.log(m.createInitialState()))"` prints both fields
- [x] 8.2 Change `src/ui/status.js` so the workspace's `aria-busy` is true while `status.kind === 'loading'` or `generation.kind === 'running'`, re-rendering on either change (design D11). Verify `npm run test:integration` passes; the attribute is checked in 9.3
- [x] 8.3 Write `tests/integration/settings-markup.test.js` reading `index.html`: the settings marker is gone; a form `data-role="settings"` with a legend `Pattern settings`; `data-setting="targetWidth"` (number, min 10, max 500, value 100), `maxColors` (min 1, max 99, value 24), `fabricCount` (options 11, 14, 16, 18, 14 selected), each with a `<label>`; outputs `pattern-size` and `generation-status` (`aria-live="polite"`); the Legend marker is still present. Verify it fails
- [x] 8.4 Replace the settings marker in `index.html` with the form (design D10) and add the `/* Settings form */` block after `.toolbar` in `styles/main.css` (design D12). Verify the markup test and `served-site.test.js` pass
- [x] 8.5 Implement `setupSettingsForm(root, store)` in `src/ui/settings-form.js` per design D10 (fill from state, parse on `input`, `aria-invalid` + messages, size text on image/settings change, generation status text and error style, prevent submit). Verify `npm run test:integration` passes; behavior is checked in 9.3
- [x] 8.6 Implement `setupPatternGeneration(store, client)` in `src/ui/pattern-generation.js` per design D9 (immediate on new image, 300 ms debounce for width/colors, nothing for fabric, `latestChange` stale guard, size check, `readImagePixels` once per image, running/done/error states, `console.error` on failure). Verify `npm run test:integration` passes; behavior is checked in 9.3
- [x] 8.7 Wire `src/main.js` per design D12: imports after the `setupImageInput` import; a new "Pattern settings and generation" group after the image-input group that creates the client with `new Worker(new URL('./workers/pattern.worker.js', import.meta.url), { type: 'module' })` on one line and calls both setups. Verify `npm test` passes and the served-site test lists `src/workers/pattern.worker.js` among the crawled files

## 9. Verification

- [ ] 9.1 Run `npm run test:unit` and confirm all unit tests pass
- [ ] 9.2 Run `npm run test:integration` and confirm all integration tests pass
- [ ] 9.3 Manual browser smoke check with `node scripts/serve.js --base cross-stitch-pattern`, open `http://127.0.0.1:8080/cross-stitch-pattern/`:
  - start: the form shows width `100`, max colors `24`, fabric `14 ct`; size reads `Load an image to see the pattern size.`; `DMC colors` and `Chart` disabled
  - pick a ~1200 × 800 JPG: size reads `100 × 67 stitches — 7.1 × 4.8 in (18.1 × 12.2 cm) on 14 ct`; status shows `Generating pattern…` then `Pattern ready: 100 × 67 stitches, N DMC colors.` with N ≤ 24; `DMC colors` and `Chart` become enabled; Original stays active; in DevTools the workspace has `aria-busy="true"` only while generating
  - select fabric `18 ct`: size reads `… 5.6 × 3.7 in (14.1 × 9.5 cm) on 18 ct`; no `Generating pattern…`
  - type `8` into max colors: after a short pause one generation runs and reports N ≤ 8
  - type `600` into width: the field shows `Width must be a whole number from 10 to 500.`; no generation; then `200`: the message disappears, size reads `200 × 133 stitches …`, a 200 × 133 pattern is reported
  - type `0` into max colors: `Max colors must be a whole number from 1 to 99.`; no generation
  - change width quickly 120 → 150 → 180: the final status reports `180 × …` stitches
  - load a 2048 px photo, set width 500 and max colors 99: while `Generating pattern…` the frame still pans and zooms smoothly; the result arrives within a few seconds
  - load a very tall narrow image (e.g. 100 × 4000 px): the size text explains the 500-stitch limit and names a width (or says the image is too tall and narrow); no pattern is generated
  - load a fully transparent PNG: `Pattern ready: the image is fully transparent, so there is nothing to stitch.`
  - load a large photo and immediately a small PNG: the status and the pattern belong to the small PNG
  - DevTools Network: `pattern.worker.js` and its modules load from the app's own path, no external requests; Console: no errors
- [ ] 9.4 Run `openspec validate add-pattern-generation --strict` and confirm it passes
