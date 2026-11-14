# Tasks

## 1. Color limit from the DMC palette (core)

- [x] 1.1 Update the color-limit tests in `tests/unit/core/pattern.test.js`: 99 and 489 synthetic codes accepted (numbers 1..N); the 489 colors of `DMC_COLORS`, one stitch each, give 489 entries with highest number 489; 490 codes → `RangeError` containing `490` and `489`; 600 input colors sharing 2 codes → 2 entries; `MAX_PATTERN_COLORS === DMC_COLORS.length`. Verify they fail
- [x] 1.2 Set `MAX_PATTERN_COLORS = DMC_COLORS.length` in `src/core/pattern.js` (import `../data/dmc.js`, comment: why the palette size and 3-digit numbers) and change the `legend-rows.js` comment to `'1'..'489'` (design D1). Verify `node --test tests/unit/core/pattern.test.js` passes

## 2. Decode cap (core, io)

- [x] 2.1 Rewrite `tests/unit/core/image-size.test.js` for `capImageSize(width, height, { maxSide: 10000, maxPixels: 16777216 })`: 3200 × 4000 unchanged; 6000 × 4000 → 5016 × 3344 (area ≤ cap); 4096 × 4096 unchanged, `isDownscaled` false; 4097 × 4096 → 4096 × 4095; 8000 × 6000 → 4729 × 3547; 100 × 5000 unchanged; 100 × 20000 → 50 × 10000; 30000 × 3 → 10000 × 1; width 0 / 12.5, maxSide 0, maxPixels 0 → `RangeError` naming the value. Verify it fails
- [x] 2.2 Implement the area + side cap in `src/core/image-size.js` per design D3. Verify `node --test tests/unit/core/image-size.test.js` passes
- [x] 2.3 Replace `MAX_DECODE_SIDE` in `src/io/image-loader.js` with `DECODE_LIMITS = { maxSide: MAX_GRID_SIDE, maxPixels: 4096 * 4096 }` (comment: Safari canvas area limit, 64 MB per RGBA copy), default parameter `limits = DECODE_LIMITS`; update the example in `image-input.js`'s comment to `5016 × 3344`. Verify `npm run test:integration` passes (served-site still resolves every import); behavior is checked in 14.3

## 3. Grid limit and settings texts (core)

- [x] 3.1 Update `tests/unit/core/stitch-grid.test.js` grid-size tests: `MAX_GRID_SIDE` is 10000; `maxTargetWidth(41, 2048)` 200 (height 9990, 201 too tall), `(1, 2048)` 4, `(1, 10001)` 0, `(1200, 800)` 10000; `stitchGridSize(41, 2048, 250).height` 12488. Verify they fail
- [x] 3.2 Set `MAX_GRID_SIDE = 10000` with an updated comment (design D2). Verify the grid-size tests pass
- [x] 3.3 Update `tests/unit/core/generation-settings.test.js`: ranges width 10–10000, colors 1–`MAX_PATTERN_COLORS` (489); invalid-field texts `… from 10 to 10000.` / `… from 1 to 489.`; `formatGridTooLarge` gives the 12488/200 and 204800 "too tall and narrow" texts; `formatNoExtraDetailNote(5000, 3200)` → `Wider than the image (3200 px), so the extra stitches add no detail.` and `(3200, 3200)` → `''`; `formatPatternSize({ 3200, 4000 }, 14)` and `({ 5000, 6250 }, 14)` match the spec; `LARGE_PATTERN_STITCHES` 4000000 and `isLargePattern` false for 2000 × 2000, true for 2001 × 2001; `describeLargePattern(4004001)` and `GENERATION_STOPPED_TEXT` match the spec; `describeGenerationProgress` gives the three spec texts (33 %, 20 %, 37 %). Verify it fails
- [x] 3.4 Implement those constants and functions in `src/core/generation-settings.js` (design D3, D11). Verify the settings tests pass

## 4. Streaming area averaging (core)

- [x] 4.1 Rewrite the resize tests in `tests/unit/core/stitch-grid.test.js` for `createGridAverager(image, size)` → `averageRow(row, out)` (4 values per cell): black + white 2 × 1 → linear `(0.5, 0.5, 0.5)`, alpha 1; red/blue/green 3 × 1 → `(0.6667, 0, 0.3333)` / `(0, 0.6667, 0.3333)` within 1e-4; `(199,43,59)` + transparent → alpha 0.5 and the opaque color within 1e-12; 1 opaque of 4 → alpha 0.25; 1 × 1 → 3 × 3 gives equal rows; fully transparent → alpha 0 and color 0; rows in any order and a reused `out` give the same values; wrong buffer length → `RangeError` with `16` and `12`; input unchanged. Verify they fail
- [x] 4.2 Implement `createGridAverager` per design D4 (flat span arrays, column accumulator, 256-entry linear table) and remove `resizeToGrid`. Verify `node --test tests/unit/core/stitch-grid.test.js` passes

## 5. Reservoir sampling (core)

- [x] 5.1 Write `tests/unit/core/reservoir-sample.test.js`: the first `capacity` calls return 0…capacity−1 in order; later calls return −1 or a slot below capacity; the same seed gives the same 10,000-call sequence; after 1000 offers into 10 slots over 200 seeds each item's inclusion rate is 1 % ± 0.5 %; capacity 0 or 1.5 and a non-integer seed → `RangeError`. Verify it fails
- [x] 5.2 Implement `createReservoirSampler(capacity, seed)` in `src/core/reservoir-sample.js` (Algorithm R, source cited, uses `createSeededRandom`), design D5. Verify the test passes

## 6. Exact nearest-centre search and faster k-means (core)

- [x] 6.1 Write `tests/unit/core/nearest-centre.test.js`: equals a brute-force search for 10,000 seeded random Lab queries against 489 seeded random centres; two identical centres → the lower index; a query equidistant from centres 2 and 5 → 2; a single centre → 0; an empty or non-multiple-of-3 centre list → `RangeError`. Verify it fails
- [x] 6.2 Implement `createNearestCentreSearch(centres)` in `src/core/nearest-centre.js` per design D6. Verify the test passes
- [x] 6.3 Add `kMeansLab` tests in `tests/unit/core/kmeans.test.js`: `onIteration` is called with 1, 2, … in order, at most 30 times; results with and without the callback are deep-equal; all existing k-means tests still pass unchanged. Verify the new tests fail
- [x] 6.4 Use the nearest-centre search in the assignment step and add the optional 4th parameter `onIteration` in `src/core/kmeans.js` (design D6, D8). Verify `node --test tests/unit/core/kmeans.test.js` passes

## 7. Two-pass pipeline with progress (core)

- [x] 7.1 Update `tests/unit/core/pattern-generator.test.js`: pass the test palette as `{ palette }`; targetWidth 0 / 10001 / 12.5 and maxColors 0 / 490 → `RangeError` with field and value (`490`, `489`); 1 × 2048 @5 → `RangeError` with `10240`, `10000`, `4`; 1 × 10001 @1 → `no target width`; `onProgress` receives phases in the order averaging → clustering → assigning, `done` rising to `total` (rows = grid height; clustering ends at 30 / 30); invalid settings call `onProgress` never; existing black/white, transparency, determinism and non-mutation tests still pass. Verify the new tests fail
- [x] 7.2 Update `tests/integration/pattern-pipeline.test.js` (real DMC palette): 1 × 2048 black @4 → 4 × 8192; 200 × 1 image (100 black | 100 white pixels) @10000 / 489 colors → 10000 × 50, `310` and `B5200` with 250,000 stitches each, columns 0–4999 entry 0 and 5000–9999 entry 1 in every row (kept small so `npm test` stays fast); 300 × 300 gradient @300 / 8 → 1–8 entries summing to 90,000, deep-equal on a second run; 400 × 500 gold gradient @400 / 489 → 1–489 distinct codes summing to 200,000, deep-equal on a second run; all existing small scenarios unchanged. Verify the new tests fail
- [x] 7.3 Implement `generatePattern(image, settings, { palette, onProgress } = {})` per design D5, D7, D8 (pass 1 averaging + reservoir of `KMEANS_SAMPLE_SIZE` with `SAMPLE_SEED`, k-means on the sample, DMC match, pass 2 with the left-neighbour shortcut into `Int16Array`, `buildPattern`). Verify `npm run test:unit` and `node --test tests/integration/pattern-pipeline.test.js` pass

## 8. Worker progress (workers)

- [x] 8.1 Update `tests/integration/pattern-worker.test.js`: `createPatternWorkerHandler(postProgress)` with a recording `postProgress`; a 2 × 200 two-color image @2 as `id: 5` → progress messages with `id: 5`, phases in order, at most 101 per phase, rising `done`, last averaging/assigning `done = total = 200`, last clustering 30 / 30, all recorded before the pattern response is returned; maxColors 490 as `id: 6` → no progress, error with `490` and `489`; existing protocol tests still pass. Verify the new tests fail
- [x] 8.2 Implement percent-throttled progress in `src/workers/pattern-worker-handler.js` and pass `(message) => self.postMessage(message)` in `pattern.worker.js` (design D9). Verify `node --test tests/integration/pattern-worker.test.js` passes

## 9. Worker client: factory, progress, stop (io)

- [x] 9.1 Update `tests/integration/pattern-worker-client.test.js` with a fake-worker factory (fake gets `terminate()` and forwards progress): the first `generate` creates the worker; `readImage` is called once for two requests with the same `imageKey` and again for a new key; progress messages reach the matching request's `onProgress` only; `stop()` with a pending request calls `terminate()` once, rejects it with `GenerationStoppedError`, and the next `generate` creates a new worker and calls `readImage` again; `stop()` while idle terminates nothing; a crash rejects pending requests with `The pattern worker stopped` and the next request uses a new worker. Verify the new tests fail
- [x] 9.2 Implement `createPatternWorkerClient(createWorker)` per design D10 in `src/io/pattern-worker-client.js`. Verify the client test passes

## 10. Settings form, Generate and Stop (ui)

- [x] 10.1 Document the generation kinds `idle`, `awaiting-confirmation`, `running`, `stopped`, `done`, `error` in `src/ui/app-state.js` (design data shapes). Verify `npm test` passes
- [x] 10.2 Update `tests/integration/settings-markup.test.js`: width `max` equals `MAX_GRID_SIDE` (10000), max colors `max` equals `MAX_PATTERN_COLORS` (489); the form contains `button[type="button"][data-action="generate"]` with text `Generate` and `[data-action="stop-generation"]` with text `Stop`, both `hidden`, after the status output. Verify it fails
- [x] 10.3 Edit `index.html` inside the settings form only (two `max` attributes, the two buttons with class `settings__button`) and add the `.settings__button` rule after `.settings__status` in `styles/main.css` (design D13). Verify the markup and served-site tests pass
- [x] 10.4 Show the "wider than the image" note in `src/ui/settings-form.js` (design D3). Verify `npm run test:integration` passes; text is checked in 14.3
- [x] 10.5 Rework `src/ui/pattern-generation.js` as `setupPatternGeneration(root, store, client)` per design D10/D11: auto-generate up to 4,000,000 stitches, otherwise `awaiting-confirmation`; `client.stop()` on every relevant change while running; progress text through `describeGenerationProgress`; Generate/Stop buttons shown by kind; Stop → `stopped` with `Generation stopped.`; `GenerationStoppedError` from a superseded request changes nothing. Verify `npm run test:integration` passes; behavior is checked in 14.3
- [x] 10.6 Update `src/main.js`: `createPatternWorkerClient(() => new Worker(new URL('./workers/pattern.worker.js', import.meta.url), { type: 'module' }))` and `setupPatternGeneration(document, store, client)`. Verify `npm test` passes and the served-site test still crawls `src/workers/pattern.worker.js`

## 11. Chart numbers for 3 digits (core, ui)

- [x] 11.1 Update `numberFontSize` tests in `tests/unit/core/chart-layout.test.js`: 20 → 9, 50 → 22.5, 19 → 8.55, 18.9 → `null`, 18.359375 → `null`, 22.94921875 → 10.3271484375, 7.52 → `null`; `NUMBER_FONT_FRACTION` 0.45, `MIN_NUMBERED_CELL_SIZE` 19. Verify they fail
- [x] 11.2 Change the two constants and their comments in `src/core/chart-layout.js` (design D12; signatures unchanged). Verify the chart-layout tests pass
- [x] 11.3 Update the number expectations in `tests/integration/chart-layer.test.js`: 3 × 2 pattern in 20 px cells at font 9; no numbers at 18.9 px; 5 numbers at 8.55 px in 19 px cells (first at x 9.5). Verify `node --test tests/integration/chart-layer.test.js` passes
- [x] 11.4 Set `.legend__number { min-width: calc(3ch + 0.5rem) }` in `styles/main.css` (design D12). Verify `npm run test:integration` passes; widths are checked in 14.3

## 12. Max zoom follows the cell size (core, ui)

- [x] 12.1 Add `zoomLimits` tests in `tests/unit/core/viewport.test.js`: content 1000 × 800 with grid 10000 × 8000 → maxScale 640; grid 100 × 80 → 64; no grid, `null` or `undefined` → 64 as before; a grid whose 64 px scale is below the fit scale → the fit scale; `MAX_ZOOM_CELL_SIZE` is 64; a grid with width 0 → `RangeError`; existing tests unchanged. Verify the new tests fail
- [x] 12.2 Implement the optional `grid` parameter and `MAX_ZOOM_CELL_SIZE` in `src/core/viewport.js` (design D14). Verify `node --test tests/unit/core/viewport.test.js` passes
- [x] 12.3 Change the one `zoomLimits(state.image, state.frame)` call in `src/ui/viewer-input.js` to pass `state.pattern` (one line, design D13/D14). Verify `npm test` passes; behavior is checked in 14.3

## 13. Project rules

- [x] 13.1 In `.claude/rules/domain.md` replace "At most 99 colors per pattern, so a number never needs more than 2 digits in a cell." with "At most as many colors as the DMC palette has (489); chart numbers are always sized for 3 digits." Verify `grep -n "99 colors" .claude/rules/domain.md` finds nothing

## 14. Verification

- [x] 14.1 Run `npm run test:unit` and confirm all unit tests pass
- [x] 14.2 Run `npm run test:integration` and confirm all integration tests pass
- [ ] 14.3 Manual browser smoke check with `node scripts/serve.js --base cross-stitch-pattern`, open `http://127.0.0.1:8080/cross-stitch-pattern/` (desktop Chrome; use the 3200 × 4000 reference JPEG from outside the repository, never commit it):
  - form: type width `10000` and colors `489` → accepted; `10001` → `Width must be a whole number from 10 to 10000.`; `490` → `Max colors must be a whole number from 1 to 489.`; reset to `100` / `24`
  - load the 3200 × 4000 JPEG → status `… — 3200 × 4000 px` (no downscale); a 6000 × 4000 photo → `… — 5016 × 3344 px (downscaled from 6000 × 4000 px)`
  - with the reference image: width 400, colors 250 → 400 × 500 generated automatically, status shows `step 1 of 3` … `step 3 of 3` then `Pattern ready: 400 × 500 stitches, N DMC colors.`; colors 489 → N ≤ 489; then set colors back to 250
  - legend: rows `1`, `10` and a 3-digit number (if N ≥ 100) have equal-width number boxes, 3 digits fit
  - Chart layer: zoom in until numbers appear at cell size ≥ 19 px; 3-digit numbers stay inside their cells and clear the bold lines
  - width 2000 → `This pattern has 5,000,000 stitches. …` and a Generate button, no generation; press Generate → Stop appears, progress runs, pattern ready within about 10 s; repeat with colors 489 (2000 × 2500 @ 489) and note the time
  - width 5000 → size ends with `Wider than the image (3200 px), so the extra stitches add no detail.` (not red); press Generate, then Stop mid-way → `Generation stopped.`, Generate shown, previous pattern still visible, `aria-busy="false"` on the workspace
  - width 1000 (auto) and change colors while it is generating → the old job stops (DevTools: a new worker appears), only the new result is shown
  - load a 41 × 2048 px image, width 250 → `250 × 12488 stitches is too large: at most 10000 stitches per side. Choose a width of at most 200.`
  - zoom: with a 400-wide pattern of a 3200 px image, zoom in until it stops → 6400 %; set a grid more than 3.37 × wider than a small image (e.g. a 1000 px image at width 5000, Generate) → zoom continues to 32000 %, where chart cells are 64 px and numbers show
  - largest pattern: a square image of at least 4096 × 4096 px (used at 4096 × 4096), width 10000 and 489 colors, stay on the Original layer → Generate → all 3 steps, pattern ready within about 1 minute, the tab survives; note worker memory in the DevTools Memory panel (expect ≤ 600 MB)
- [x] 14.4 Run `openspec validate raise-pattern-limits --strict` and confirm it passes
