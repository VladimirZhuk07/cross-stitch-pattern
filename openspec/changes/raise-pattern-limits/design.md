# Design

## Context

See proposal.md (Why). The current pipeline (`add-pattern-generation`, design D3–D6) keeps
several full-size per-cell arrays at once: `resizeToGrid` returns `linearRgb` (Float64, 24 B
per cell) and `alpha` (8 B); `generatePattern` builds a JS list of stitched indexes (≈ 8 B),
their Lab values (24 B), and k-means keeps `assignments` (4 B) and k-means++ `distances` (8 B);
then come the cluster cells and the pattern cells (2 + 2 B). That is about 80 bytes per cell:
320 MB at 2000 × 2000 and about 8 GB at 10000 × 10000, which no browser can allocate.
k-means also runs on every stitched cell, with a brute-force nearest-centre search that costs
`cells × colors` per iteration.

Constraints: `core/` stays pure (no timers, no workers, no DOM), results stay deterministic, no
dependencies. Three parallel changes own neighbouring files (see D13).

Timings below were measured in Node 22 on the development machine with a synthetic,
gradient-heavy "gold render" image (bronze → pale yellow ramps, near-black background, ivory
blobs, an orange glow, ±3 noise), using a prototype of D4–D7 outside the repository. A browser
worker runs the same V8 (Chrome) or a comparable engine; expect 1–2 × these times on a
desktop and several times more on phones.

## Goals / Non-Goals

**Goals:**
- Generation memory that does not grow with per-cell color data (D4, D6).
- Generation time dominated by one pass over the cells, not `cells × colors × iterations`
  (D5, D6).
- Small patterns (≤ 65,536 stitched cells) come out exactly as today.
- Long jobs show progress and can be stopped at once.

**Non-Goals:**
- Fast drawing of huge patterns in the DMC colors / Chart layers, ruler labels with 5 digits
  (`tile-large-pattern-rendering`).
- Confetti cleanup, dithering, export, printing.

## Module map

| Module | Layer | Change |
|---|---|---|
| `src/core/pattern.js` | core | `MAX_PATTERN_COLORS = DMC_COLORS.length` (D1) |
| `src/core/image-size.js` | core | `capImageSize(width, height, limits)` with a pixel cap (D3) |
| `src/core/stitch-grid.js` | core | `MAX_GRID_SIDE = 10000`; `createGridAverager` replaces `resizeToGrid` (D4) |
| `src/core/reservoir-sample.js` | core, new | seeded reservoir sampler (D5) |
| `src/core/nearest-centre.js` | core, new | exact nearest-centre search (D6) |
| `src/core/kmeans.js` | core | uses `nearest-centre.js`; optional per-iteration callback (D6, D8) |
| `src/core/pattern-generator.js` | core | two-pass pipeline, options `{ palette, onProgress }` (D7, D8) |
| `src/core/generation-settings.js` | core | new ranges and texts, large-pattern threshold, progress text (D2, D3, D11) |
| `src/core/chart-layout.js` | core | two constants only (D12) |
| `src/core/viewport.js` | core | `zoomLimits(content, frame, grid)`: optional pattern grid raises the max zoom (D14) |
| `src/core/legend-rows.js` | core | comment `'1'..'489'` |
| `src/workers/pattern-worker-handler.js`, `pattern.worker.js` | workers | progress messages (D9) |
| `src/io/image-loader.js` | io | `DECODE_LIMITS` (D3) |
| `src/io/pattern-worker-client.js` | io | worker factory, progress routing, `stop()`, pixels once per worker (D10) |
| `src/ui/pattern-generation.js` | ui | large-pattern confirmation, Generate/Stop buttons, progress, stop on supersede (D10, D11) |
| `src/ui/settings-form.js` | ui | "wider than the image" note (D3) |
| `src/ui/app-state.js` | ui | documents the new generation kinds (D11) |
| `src/ui/viewer-input.js` | ui | one line: passes `state.pattern` to `zoomLimits` (D14) |
| `src/main.js` | — | passes a worker factory and `document` to `setupPatternGeneration` |
| `index.html` | — | settings form only: `max` attributes, Generate and Stop buttons |
| `styles/main.css` | — | `.legend__number` width, `.settings__button` (D12, D13) |

`core/` modules import only `core/` and `data/` (`pattern.js` now imports `../data/dmc.js`,
which the architecture allows). No new module touches the DOM, timers or workers.

## Data shapes

- **Decode limits** `{ maxSide, maxPixels }`: whole numbers, px and pixel count. Created as
  `DECODE_LIMITS = { maxSide: MAX_GRID_SIDE (10000), maxPixels: 16,777,216 }` in
  `src/io/image-loader.js`; consumed by `capImageSize` (`src/core/image-size.js`), which still
  returns `{ width, height, isDownscaled }`.
- **Cell averages of one grid row**: a `Float64Array` of `4 × gridWidth` numbers, per cell in
  turn: linear r, g, b (0–1, alpha-weighted mean, 0 when the cell has no alpha) and mean
  alpha (0–1). Written by the `averageRow(row, out)` function that `createGridAverager(image,
  size)` returns (`src/core/stitch-grid.js`). The caller owns `out` and reuses it for every row.
- **Reservoir sampler**: `createReservoirSampler(capacity, seed)` (`src/core/reservoir-sample.js`)
  returns `nextSlot()`: for the n-th offered item (counting from 0) it returns the slot
  0…capacity−1 where the item must be stored (overwriting the old one), or −1 to skip it.
- **Nearest-centre search**: `createNearestCentreSearch(centres)` (`src/core/nearest-centre.js`)
  takes a `Float64Array` of 3 × k Lab values (k ≥ 1) and returns `nearestCentre(L, a, b)` → the
  index 0…k−1 of the centre with the smallest squared Euclidean Lab distance, lowest index on
  a tie.
- **Generation progress** `{ phase, done, total }`: `phase` is `'averaging'`, `'clustering'` or
  `'assigning'`; `done` and `total` are whole numbers, `1 ≤ done ≤ total` (rows for averaging
  and assigning, k-means iterations with total `MAX_KMEANS_ITERATIONS` = 30 for clustering).
  Created by `generatePattern` (`src/core/pattern-generator.js`) through `options.onProgress`.
- **Worker progress message** `{ type: 'progress', id, phase, done, total }`: created by the
  worker handler, same fields as above plus the request `id`.
- **Generation state** `state.generation = { kind, text }` (`src/ui/app-state.js`): `kind` is
  `'idle'`, `'awaiting-confirmation'`, `'running'`, `'stopped'`, `'done'` or `'error'`; `text` is
  shown as is. Written only by `src/ui/pattern-generation.js`.

## Decisions

### D1. Color limit = DMC palette size; cells stay Int16

`MAX_PATTERN_COLORS = DMC_COLORS.length` (489) in `pattern.js`; `MAX_COLORS_RANGE.max` and the
generator's check use it, and `index.html` says `max="489"` (checked by the markup test against
the constant, so a palette update shows up as a failing test, not a silent mismatch). Clusters
are merged by DMC code, so a real pattern can never exceed the palette anyway; the check
guards synthetic input. `Int16Array` cells still fit (largest index 488, empty −1): 2 bytes per
cell, 200 MB at 10000 × 10000, transferred without copying; `Int8Array` cannot hold 488 and
`Uint16Array` cannot hold −1.

### D2. Grid side limit 10000

`MAX_GRID_SIDE = 10000`; `TARGET_WIDTH_RANGE = { min: 10, max: 10000 }`; `maxTargetWidth` and
the error texts work unchanged with the new constant (e.g. 41 × 2048 px → largest width 200).
Debounce stays 300 ms for every size: large sizes need a Generate press anyway (D11).

### D3. Decode cap: 16,777,216 pixels and 10000 px per side; upscaling allowed with a note

- `capImageSize(width, height, { maxSide, maxPixels })`: `s = min(1, maxSide / long,
  √(maxPixels / (width × height)))`; new long side `floor(long × s)` (exactly `maxSide` when
  the side cap binds), lowered by 1 while `long' × short' > maxPixels`, short side
  `max(1, round(short × long' / long))`. 6000 × 4000 → 5016 × 3344; 3200 × 4000 stays.
- **Why 16,777,216 (4096²):** `readImagePixels` draws the whole image into an `OffscreenCanvas`;
  Safari/iOS refuses canvases above 16,777,216 pixels, so this is the largest cap that works
  in every target browser. One RGBA copy is then at most 64 MB (the 3200 × 4000 reference
  render: 51 MB). Chrome allows about 268 MP, but a 10000 × 10000 image is 400 MB per copy and
  the main thread briefly holds the bitmap and the `getImageData` copy together (800 MB).
- **Why 10000 px per side:** equal to `MAX_GRID_SIDE`, so even the widest grid gets at least
  one image pixel per stitch along a side that long; more pixels per stitch only cost memory.
- **Alternatives:** keep 2048 px (loses detail of 3200 × 4000 renders and any grid above
  2048 stitches); probe the device's canvas limit (the same file would give different
  patterns on different devices, breaking determinism, and probing is fragile).
- **Grid wider than the image:** allowed (existing scenario 1 × 1 → 3 × 3). The size output
  appends `Wider than the image (3200 px), so the extra stitches add no detail.` when the
  grid width exceeds the image width — information, not an error.
  `formatNoExtraDetailNote(gridWidth, imageWidth)` in `generation-settings.js` returns that
  text or `''`; `settings-form.js` joins it after the size text with `. `.
- Decoding still happens at full size first (import design D6): a 50 MP photo is briefly a
  200 MB bitmap before it is resized. Unchanged; out of scope.

### D4. Streaming, separable area averaging

`createGridAverager(image, size)` precomputes the column and row overlap spans as flat typed
arrays and returns `averageRow(row, out)`. For one grid row it sums the alpha-weighted linear
RGB and the alpha of every overlapping source row into a column accumulator
(`Float64Array(4 × imageWidth)`), then sums each cell's overlapping columns. The math is the
current one (area weights with fractional edges, alpha weighting, linear light), only the
summation order differs (results equal within 1e-12). Working memory: accumulator ≤ 320 KB
plus the caller's `out` ≤ 320 KB. Rows can be averaged in any order, so the pipeline can run
two passes without storing cells. Measured: all 10000 rows of a 10000 × 10000 grid from a
4096 × 4096 image in 2.4 s; a 2000 × 1333 grid from 3000 × 2000 px in 0.14 s.
`resizeToGrid` is removed; its unit tests are rewritten against `averageRow`.

### D5. k-means on a seeded reservoir sample of 65,536 stitched cells

Pass 1 averages every row and offers each stitched cell (alpha ≥ 0.5) to a reservoir of
`KMEANS_SAMPLE_SIZE = 65,536` slots (Vitter's Algorithm R, seeded with `SAMPLE_SEED` through
`createSeededRandom`); only a cell that gets a slot is converted to Lab (about 550,000 of
100,000,000 cells in profiling). k-means then runs on the reservoir.

- **Why a sample:** k-means cost is `points × colors × iterations`; full data at 400 × 500 @250
  took 3.7 s versus 1.3 s for the sample, and millions of cells would take minutes. 65,536
  points give about 134 points per cluster even at 489 colors, plenty for stable centres.
- **Why reservoir sampling:** one pass, uniform over stitched cells, deterministic, and it does
  not need the stitched count in advance. A fixed stride aliases with the grid width (stride
  2 on an even width samples only even columns); random grid positions waste samples on
  transparent cells.
- **Small grids unchanged:** with ≤ 65,536 stitched cells every cell gets the next slot in
  row-major order, so k-means sees exactly today's input and the existing scenarios hold.

### D6. Exact nearest-centre search sorted by L*

`createNearestCentreSearch` sorts the centres by L* once; a query binary-searches its L*,
then walks outwards in both directions and stops on a side when `ΔL*²` alone exceeds the best
distance so far (strictly greater, so an equally distant centre with a lower index is still
examined). The result is exactly the brute-force answer with the same lowest-index tie rule.

- Used by k-means' assignment step (rebuilt each iteration, `k log k`) and by pass 2.
- Measured with 489 centres: 30 assignment steps over 65,536 points 0.35 s (whole k-means
  today: 2.4 s); pass 2 for 2000 × 1333 cells 0.5 s versus 1.4 s brute force; 0 differences
  from brute force on 200,000 seeded random queries.
- **Shortcut:** in pass 2 a cell whose averaged linear RGB equals its left neighbour's exactly
  reuses that neighbour's cluster. Exact; 13 % hits on an upscaled photo, nearly 100 % on
  flat areas (backgrounds, pixel art, the 10000 × 50 two-color scenario).
- **Alternatives:** k-d tree (more code, little gain for k ≤ 489 in 3-D); a cache keyed by
  8-bit sRGB (fast but not exact: shifts colors by up to about 0.3 ΔE and changes today's
  results); ΔE00 for assignment (no mean, 10 × slower; ΔE00 stays for the DMC match).

### D7. Two-pass pipeline

`generatePattern(image, settings, { palette, onProgress } = {})`:

1. validate settings and grid size (limits from D1/D2);
2. pass 1 — average rows, fill the reservoir (D5);
3. `kMeansLab(sample, maxColors, KMEANS_SEED, onIteration)`; no stitched cell → no clustering;
4. `nearestDmcColors(centres, palette)` (ΔE00, 489 × 489 comparisons ≈ 0.1 s);
5. pass 2 — average rows again, Lab, nearest centre (D6) into `Int16Array(W × H)`, −1 for
   empty cells;
6. `buildPattern` (counts, merges, numbers, copies to legend indexes).

Recomputing the averages in pass 2 costs 2.4 s at 100 M cells; storing them instead would need
12 bytes per cell even as Float32 Lab (1.2 GB). After k-means stops (converged or 30
iterations) every cell, sampled or not, joins its nearest final centre; for a converged run
this is the same assignment as today.

**Peak memory in the worker** = image pixels (≤ 64 MB) + 2 bytes per cell (cluster cells) +
2 bytes per cell (pattern cells built by `buildPattern`) + under 5 MB fixed (row buffers,
reservoir 1.5 MB, k-means arrays on the sample, palette):

| Grid | Cells | Today's design | This design |
|---|---|---|---|
| 2000 × 2000 | 4 M | ≈ 64 + 320 = 384 MB | ≈ 64 + 16 + 5 = 85 MB |
| 10000 × 10000 | 100 M | ≈ 8 GB (fails) | ≈ 64 + 400 + 5 = 470 MB |

After the response the cluster cells are garbage and the 200 MB pattern cells move to the
main thread by transfer (no copy). Remapping in place would save 200 MB at the extreme but
breaks `buildPattern`'s "input is not modified" rule; rejected.

**Expected time** (Node 22, gold-gradient synthetic image, 489 colors):

| Grid | Averaging | k-means | DMC match | Assigning | Total |
|---|---|---|---|---|---|
| 400 × 500 (from 3200 × 4000) | 0.1 s | ≈ 0.4 s | 0.06 s | 0.1 s | < 1 s |
| 2000 × 1333 (from 3000 × 2000) | 0.14 s | ≈ 0.5 s | 0.1 s | 0.5 s | ≈ 1.3 s |
| 10000 × 10000 (from 4096 × 4096) | 2.4 s | ≈ 0.5 s | 0.1 s | 15.7 s | ≈ 20 s (+ ≈ 1 s build) |

In a desktop browser: about 1–3 s for 2000 × 1333 and 20–40 s for 10000 × 10000. Pass 2 at
100 M cells is about 6 s of Lab conversion and 9 s of search.

### D8. Progress from core without timers

`generatePattern` calls `onProgress({ phase, done, total })` after every row of pass 1 and
pass 2 and after every k-means iteration (`kMeansLab` gets an optional 4th parameter
`onIteration(iteration)`), and finally `{ phase: 'clustering', done: 30, total: 30 }` when
k-means stops early or is skipped. A plain callback keeps core pure and testable. The options
object replaces the positional `palette` parameter (tests that pass a test palette change to
`{ palette }`).

### D9. Worker protocol: throttled progress

`createPatternWorkerHandler(postProgress)` passes an `onProgress` that posts
`{ type: 'progress', id, phase, done, total }` only when `floor(100 × done / total)` rises
within a phase (≤ 101 messages per phase, ≤ 303 per job). Throttling by percent instead of by
clock keeps the handler free of timers and its tests deterministic. `pattern.worker.js` passes
`(message) => self.postMessage(message)`. Errors before the first row (invalid settings) send
no progress. Final responses are unchanged.

### D10. Stopping: terminate the worker; pixels once per worker

A worker running a synchronous job cannot read a "cancel" message until it finishes. A shared
cancel flag would need `SharedArrayBuffer`, which requires cross-origin isolation headers that
GitHub Pages cannot send; splitting the job into async chunks would make core impure. So the
client terminates the worker: immediate, and it frees the job's memory. Cost of a restart:
a new module worker (≈ 50 ms) and reading the pixels again (≤ 64 MB `getImageData`, ≈ 100 ms).

- `createPatternWorkerClient(createWorker)` creates the worker lazily through the factory.
  `generate({ settings, imageKey, readImage }, onProgress)` sends `readImage()`'s pixels only
  when the current worker has not yet received `imageKey` (the loaded-image object), so the
  "once per image" rule now lives where worker restarts are known. Progress messages go to the
  pending request's `onProgress`.
- `stop()` terminates the worker if a request is pending, rejects pending requests with
  `GenerationStoppedError` (exported; `name` `'GenerationStoppedError'`) and forgets the
  worker; the next `generate` creates a fresh one. A crash (`error`/`messageerror`) rejects
  all pending requests as today and also drops the worker.
- `pattern-generation.js` calls `stop()` on every relevant change (new image, width, max
  colors) while a request is running, and on the Stop button. Stopped requests are silent
  (the newer change already owns the status) except for the Stop button, which shows
  `Generation stopped.`.

### D11. Large-pattern confirmation and the Generate/Stop buttons

`LARGE_PATTERN_STITCHES = 4,000,000` (`generation-settings.js`). Up to it (2000 × 2000)
generation takes about 1–3 s and 85 MB, fine to run while the user experiments. Above it, time
and memory grow towards 20–40 s and 0.5 GB, and an accidental job (e.g. typing a width) would
block the worker; a longer debounce would not prevent that, a button does.

- `pattern-generation.js` sets `{ kind: 'awaiting-confirmation', text:
  describeLargePattern(cells) }` instead of generating. Every change re-evaluates, so each new
  large setting needs a new press.
- `setupPatternGeneration(root, store, client)` owns the two buttons in the settings form
  (`[data-action="generate"]`, `[data-action="stop-generation"]`, both `type="button"` and
  `hidden` in the markup): Generate is shown for `awaiting-confirmation` and `stopped` and
  generates the current settings; Stop is shown for `running`. Status texts come from core:
  `GENERATING_TEXT`, `describeGenerationProgress(progress)` (`Generating pattern… step 2 of
  3: reducing colors, 20 %`), `describeLargePattern(cells)`, `GENERATION_STOPPED_TEXT`.
  `status.js` keeps `aria-busy` true only for `running`.

### D12. Chart numbers sized for 3 digits

With digits about 0.55 em wide (the measuring rule the chart tests already use), three digits
at font `f × cell` take `1.65 f` of the cell width. `NUMBER_FONT_FRACTION = 0.45` → 74 % of
the width and 32 % of the height, leaving 2.4 px per side in a 19 px cell where a bold line
covers 1 px. 0.5 would leave 0.65 px next to a bold line. `MIN_NUMBERED_CELL_SIZE = 19` keeps
the smallest number at 8.55 px, no smaller than today's 8.4 px floor (18 px cells would give
8.1 px). Numbers are sized for 3 digits for every pattern, so the size does not jump when the
color count passes 99. `numberFontSize(cellSize)` keeps its signature and return contract.

The legend's number box gets `min-width: calc(3ch + 0.5rem)` (was `1.5rem`): every box has
the width of 3 tabular digits plus padding, equal in every row.

### D13. Seams with the parallel changes

- `tile-large-pattern-rendering` owns `src/ui/layers/*`, `src/core/pattern-image.js` and
  cell-image drawing. This change edits only the two number constants in `chart-layout.js`
  (signatures unchanged) and the expected number font sizes in
  `tests/integration/chart-layer.test.js` (the 20 px → 9 px and 14 px → 19 px threshold
  cases). Whichever merges second rebases those few lines.
- `improve-mobile-layout` owns CSS and layout markup. Here: `index.html` edits stay inside the
  settings form (two `max` attributes, two buttons after the status output); CSS gets one
  changed declaration in `.legend__number` and a new `.settings__button` rule placed right
  after `.settings__status` (styled like `.zoom-controls__button`, no `display`, so `hidden`
  works).
- `add-pinch-zoom` owns `src/ui/viewer-input.js`; this change edits only the existing `zoomLimits(state.image, state.frame)` call (one line, adds `state.pattern`). New pinch call sites should pass `state.pattern` too when that change rebases; without it they keep the old 6400 % cap, nothing breaks.
- `.claude/rules/domain.md`: the line "At most 99 colors per pattern, so a number never needs
  more than 2 digits in a cell." becomes "At most as many colors as the DMC palette has (489);
  chart numbers are always sized for 3 digits."

### D14. Max zoom follows the pattern's cell size

With the fixed 6400 % cap a stitch is at most `64 × imageWidth / gridWidth` CSS px, below the
19 px number threshold (D12) as soon as the grid is more than 3.37 × wider than the image —
e.g. 10000 stitches from a 1000 px image give 6.4 px cells, and the chart numbers could never
be shown. `zoomLimits(content, frame, grid)` gets an optional third parameter, the pattern
(`{ width, height }` in stitches, or null/undefined): `maxScale = max(MAX_SCALE, fit,
MAX_ZOOM_CELL_SIZE × grid.width / content.width)` with `MAX_ZOOM_CELL_SIZE = 64` CSS px. The
cell width is used, as the viewer aligns columns exactly (`chartCellGeometry`); rows differ only
by rounding. Calls without a pattern behave exactly as today, so `add-pinch-zoom`'s calls keep
working. Alternatives: a new helper beside `zoomLimits` (two functions for one rule, and the
call site would still need the pattern); raising `MAX_SCALE` globally (6400 % × 10 makes no
sense for a plain image and does not cover every ratio).

## Risks / Trade-offs

- [Patterns with more than 65,536 stitched cells (above about 256 × 256) differ slightly from
  today's, because k-means sees a sample] → Deterministic; centres from 65,536 points are
  stable; small patterns are unchanged.
- [k-means stopped by the 30-iteration limit: pass 2 assigns cells to the final centres, which
  can differ from today's last assignment] → Arguably better (consistent with the centres);
  the existing exact-result tests use inputs that converge.
- [Browsers slower than Node, phones much slower; a 10000 × 10000 job needs ≈ 470 MB in the
  worker plus 200 MB + 64 MB on the main thread] → Confirmation text mentions memory, progress
  and Stop are always available, a worker crash shows `Could not generate the pattern: The
  pattern worker stopped: …` and the next request uses a fresh worker.
- [At 64000 % the Original layer draws a 1000 px image as 640,000 CSS px] → The browser clips `drawImage` to the canvas; only the scale grows, not the work. Lowering the pattern later leaves a too-large zoom until the next zoom step clamps it (no error).
- [Until `tile-large-pattern-rendering` lands, the DMC colors layer allocates a W × H RGBA
  image (400 MB at 10000 × 10000)] → The smoke check for the largest pattern stays on the
  Original layer; rendering is that change's job.
- [Restarting the worker re-reads pixels, ≈ 150 ms per superseded job] → Only when a job is
  actually running; typing within the debounce never starts one.
- [Smaller chart numbers at a given zoom (0.45 instead of 0.6 of the cell)] → Constant across
  patterns; zoom one step further for larger numbers.

## Migration Plan

No stored data changes (patterns are not persisted). Rollback is reverting the change's
commits.

## Defaults chosen (to confirm with the user)

1. Decode cap 16,777,216 pixels / 10000 px per side (3200 × 4000 kept, 6000 × 4000 →
   5016 × 3344).
2. Patterns over 4,000,000 stitches need a Generate press, again after every change.
3. A Stop button, and stopping (terminating) a running job on every superseding change.
4. Chart numbers 0.45 × cell, shown from 19 px cells (8.55 px font).
5. k-means sample of 65,536 cells.
6. Small CSS edits in `improve-mobile-layout`'s territory (legend number width, settings button).
7. Max zoom lets a stitch reach 64 CSS px (approved: fixed in this change, D14).
