# Design

## Context

Motivation: see proposal.md (Why). Behavior: `specs/pattern-generation/spec.md`.

Already on `main` and used here unchanged:

- `src/core/pattern.js` — `buildPattern` (merges colors sharing a DMC code, numbers the legend,
  enforces `MAX_PATTERN_COLORS = 99`), `EMPTY_CELL = -1`, `finishedSize`, `FABRIC_COUNTS`,
  `DEFAULT_FABRIC_COUNT = 14`.
- `src/core/color.js` — `srgbToLinear`, `linearRgbToLab`; `src/core/dmc-match.js` —
  `prepareLabPalette`, `nearestDmcColors` (ΔE00, lowest index wins ties);
  `src/data/dmc.js` — `DMC_COLORS` (489 entries).
- `src/io/image-loader.js` — `state.image` is `{ bitmap, fileName, width, height, … }`,
  `bitmap` already capped to 2048 px on the long side.
- `src/ui/image-input.js` — on a new image it sets `pattern: null`, `activeLayer: 'original'`.
- `src/ui/viewer.js` — layer contract and the alignment rule (add-app-shell design D3): a
  W × H grid covers the whole image rectangle, `H = round(W × imageHeight / imageWidth)`.
- `tests/integration/served-site.test.js` already follows `new URL('…', import.meta.url)`, so a
  worker URL written on one line is crawled and checked like any import.

Parallel changes `add-dmc-preview-layer` and `add-stitch-chart-layer` only read
`state.pattern`; they replace `src/ui/layers/*.js`, add a legend at the Legend marker and
probably one line in `main.js`.

## Goals / Non-Goals

**Goals:**
- One pure, deterministic pipeline `pixels + settings → Pattern`, testable in Node.
- Heavy loops off the main thread; the UI stays pannable/zoomable while generating.
- Edits to shared files (`index.html`, `main.js`, `main.css`) small and away from the lines
  the parallel changes touch.

**Non-Goals:**
- No cancellation of a computation already running in the worker (stale results are dropped).
- No re-matching of each cell to the nearest chosen DMC color after clustering (see D5).
- No pixel-perfect equality between browser engines (see Risks).

## Module map

| Module | Layer | Responsibility |
|---|---|---|
| `src/core/random.js` | core | `createSeededRandom(seed)` — mulberry32 PRNG returning numbers in [0, 1) |
| `src/core/stitch-grid.js` | core | `MAX_GRID_SIDE = 500`, `EMPTY_ALPHA_THRESHOLD = 0.5`, `stitchGridSize`, `maxTargetWidth`, `resizeToGrid` |
| `src/core/kmeans.js` | core | `KMEANS_SEED`, `MAX_KMEANS_ITERATIONS = 30`, `kMeansLab(points, maxClusters, seed)` |
| `src/core/generation-settings.js` | core | defaults, form ranges, `parseWholeNumber`, user-facing size/result texts |
| `src/core/pattern-generator.js` | core | `generatePattern(image, settings, palette)` — the pipeline |
| `src/io/image-pixels.js` | io | `readImagePixels(image)` — `ImageBitmap` → RGBA bytes via `OffscreenCanvas` |
| `src/io/pattern-worker-client.js` | io | `createPatternWorkerClient(worker)` — ids, pending requests, transfers |
| `src/workers/pattern-worker-handler.js` | workers | `createPatternWorkerHandler()` — message → response, remembers the image |
| `src/workers/pattern.worker.js` | workers | entry: connects `self` message events to the handler (≈10 lines) |
| `src/ui/settings-form.js` | ui | `setupSettingsForm(root, store)` — inputs, validation messages, size text |
| `src/ui/pattern-generation.js` | ui | `setupPatternGeneration(store, client)` — trigger, debounce, stale guard, status |

Core stays pure: the five core modules import only `core/` and `data/` (only
`pattern-generator.js` imports `data/dmc.js`), use no browser globals or timers, and run in
Node. The worker handler imports only `core/`; it has no `self` reference, so integration
tests import and call it directly. Timers (debounce) live in `ui/`; `OffscreenCanvas` and
`Worker` are touched only by `io/` and `main.js`.

## Data shapes

Described in plain words in a comment next to the creating function (no type annotations);
the spec is authoritative.

- **Pixel image** (created by `readImagePixels` in `src/io/image-pixels.js`; tests build them
  by hand): `{ width, height, pixels }`. `width`, `height` positive integers (image px);
  `pixels` a `Uint8ClampedArray` (a `Uint8Array` is also accepted) of `width × height × 4`
  bytes, RGBA, row-major, sRGB, straight (not premultiplied) alpha. Owns its buffer, so it can
  be transferred.
- **Settings** (`state.settings`, initial value `DEFAULT_SETTINGS` from
  `src/core/generation-settings.js`): `{ targetWidth, maxColors, fabricCount }` — stitches
  (integer), colors (integer), stitches per inch. The state only ever holds valid values.
  `generatePattern` reads `targetWidth` and `maxColors`; `fabricCount` affects only the size
  text.
- **Grid size** (created by `stitchGridSize` in `stitch-grid.js`): `{ width, height }` in
  stitches; `height` may exceed `MAX_GRID_SIDE` (callers check, so the UI can explain it).
- **Stitch grid** (created by `resizeToGrid` in `stitch-grid.js`): `{ width, height, linearRgb,
  alpha }`. `linearRgb` is a `Float64Array` of `3 × width × height` linear-light values 0–1
  (r, g, b per cell, row-major), the alpha-weighted mean (0 for a cell with no alpha);
  `alpha` is a `Float64Array` of `width × height` coverage-weighted mean alpha values 0–1.
- **Lab points / k-means result** (`kMeansLab` in `kmeans.js`): input `points` is a
  `Float64Array` of `3 × n` values (L, a, b per point). Result `{ centres, assignments }`:
  `centres` a list of Lab colors `{ L, a, b }` (between 1 and `maxClusters`; `[]` when n = 0);
  `assignments` an `Int32Array` of n centre indexes.
- **Generation status** (`state.generation`, written by `src/ui/pattern-generation.js`):
  `{ kind, text }`, kind `'idle' | 'running' | 'done' | 'error'`, text shown as is.
- **Worker messages** (D7) and **Pattern** (`src/core/pattern.js`, unchanged).

## Decisions

### D1. Pixels are read on the main thread, once per image, and transferred
`readImagePixels(image)` draws `image.bitmap` into `new OffscreenCanvas(width, height)`
(`getContext('2d', { willReadFrequently: true })`) and returns `getImageData(…).data` with the
image size. The pattern-generation module calls it once per new `state.image` and sends the
buffer with the first request, transferring it; the worker remembers it, so setting changes
send only settings. The main thread keeps no copy.
*Cost:* one `getImageData` of at most 2048 × 2048 px (16 MB, typically tens of ms) per image.
*Alternatives:* (a) transfer a copy of the bitmap (`createImageBitmap(bitmap)`) and read it in
the worker — rejected: puts canvas I/O into `workers/`, which must stay thin adapters over
`core/`, for a one-off saving of a few tens of ms; transferring `state.image.bitmap` itself
would detach the Original layer's bitmap. (b) Keep the pixels on the main thread and copy them
per request — rejected: a 16 MB structured clone per setting change, against the
"transfer, don't copy" rule. (c) Read pixels in `image-loader.js` — rejected: changes a finished
module and keeps 16 MB in state for nothing.

### D2. Grid size and the 500-stitch limit
`stitchGridSize(imageWidth, imageHeight, targetWidth)` returns
`{ width: targetWidth, height: max(1, round(targetWidth × imageHeight / imageWidth)) }` —
exactly the viewer's alignment rule, using the capped image size. `MAX_GRID_SIDE = 500`
bounds both sides (500 × 500 = 250 000 cells keeps the worst case at seconds, see Risks).
`maxTargetWidth(imageWidth, imageHeight)` returns the largest width ≤ 500 whose height is
≤ 500 (start from `ceil(500.5 × w / h) − 1`, capped at 500, then step down while the rounded
height is still above 500, so floating-point edge cases cannot break it); it returns 0 when
not even width 1 fits (aspect ratio of 500.5 : 1 or taller). If the result is below the form
minimum of 10, the size text says the image is too tall and narrow instead of suggesting a
width the form rejects. `generatePattern`
throws a `RangeError` naming the height, 500 and that width; the UI checks first and explains
it in the size text without sending a request.
*Alternative:* silently clamp the width — rejected: the form would show a value that is not
used. *Alternative:* interpret the setting as the long side — rejected: the product asks for
a width in stitches and the finished size is usually planned by width.

### D3. Area averaging in linear RGB with fractional coverage and alpha weighting
Cell (c, r) covers the source rectangle `x ∈ [c·iw/W, (c+1)·iw/W)`, `y ∈ [r·ih/H, (r+1)·ih/H)`;
pixel (px, py) covers `[px, px+1) × [py, py+1)`. A pixel's weight in a cell is the overlap area
(separable: x-overlap × y-overlap). Per cell:
`alpha = Σ w·α / Σ w` and `linear = Σ w·α·lin(rgb) / Σ w·α` with α = byte / 255, `lin` the sRGB
transfer function from a 256-entry table built once from `srgbToLinear`.
Weighting by α is premultiplied-alpha averaging: a transparent pixel's RGB (often black or
garbage) does not darken edge cells. A cell is empty when `alpha < EMPTY_ALPHA_THRESHOLD
(0.5)` — a stitch either exists or not, so a cell becomes a stitch when it is at least half
covered. The overlap spans per column and per row are precomputed once, so the cost is about
`(iw + W) × (ih + H)` weight multiplications — linear in the image size, also when the grid is
larger than the image (upscaling is allowed; each pixel then covers several cells).
*Alternatives:* integer bucketing `floor(x·W/iw)` — rejected: cell borders drift by up to a pixel
and stop matching the viewer's grid on small images; letting the browser downscale with
`drawImage` — rejected: averages in sRGB (too dark), premultiplication and filters differ per
browser; nearest-pixel sampling — rejected: noisy, ignores most pixels.

### D4. Color reduction: seeded k-means++ in CIELAB
Non-empty cells are converted once to Lab (`linearRgbToLab`) and clustered by `kMeansLab`:

1. **Init (k-means++):** `random = createSeededRandom(KMEANS_SEED)` (mulberry32, public domain,
   Tommy Ettinger; fixed seed `KMEANS_SEED = 20261113`, not a user setting). First centre: point
   `floor(random() × n)`. Each next centre: a point drawn with probability proportional to its
   squared distance D² to the nearest chosen centre (walk the cumulative sum up to
   `random() × ΣD²`). If `ΣD² = 0`, every point already coincides with a centre: stop, so an
   image with 2 distinct colors gets 2 clusters even when `maxColors = 24`.
2. **Lloyd iterations:** assign each point to the nearest centre (squared Euclidean distance in
   Lab, i.e. ΔE76²; ties → lowest centre index), then move each centre to the mean of its
   points; a centre with no points keeps its position. Stop when an assignment step changes no
   point, or after `MAX_KMEANS_ITERATIONS = 30` assignment steps; the returned centres are the
   means of the returned assignments.

Everything is deterministic: fixed seed, fixed iteration order, fixed tie rules.
*Why Euclidean Lab inside k-means:* the mean is the point that minimizes squared Euclidean
distance, which is what guarantees Lloyd's iterations converge; ΔE00 has no such mean and
would cost ~10–20× more per comparison. The domain rule "final choice uses ΔE00" is met in D5:
every color that reaches the pattern is chosen from DMC by ΔE00.
*Alternatives:* median cut — deterministic and fast, but its axis-aligned box splits give
visibly worse palettes at small color counts (skin tones, gradients); kept as a possible
future initializer. Popularity (match every cell to DMC, keep the N most frequent) — rejected:
drops small accents (eyes, highlights). Octree — rejected: works in RGB.
*Cost:* `n × k × iterations` distance computations — default 100 × 67 × 24 × 30 ≈ 5 M (a few
ms); worst case 250 000 × 99 × 30 ≈ 740 M (seconds, in the worker, with the busy status).

### D5. DMC mapping and building the pattern
`nearestDmcColors(centres, palette)` maps each centre to its DMC color by ΔE00. The colors
passed to `buildPattern` are `{ code, name, hex }` of those matches, and the cells are the
cluster index per stitched cell or `EMPTY_CELL`; `buildPattern` merges clusters landing on the
same code, drops unused ones, numbers the legend and checks ≤ 99 colors (guaranteed, since
`maxColors ≤ 99`). The prepared DMC palette is created once per module instance
(lazily, on the first `generatePattern` call without a `palette` argument) and reused; tests
can pass a small prepared palette for exact expectations.
*Trade-off:* cells keep their cluster's DMC color even if another chosen DMC color would be
slightly closer for that one cell. Re-matching every cell would cost `n × k` ΔE00 evaluations
(up to ~25 M) for a small gain; it can be added later together with dithering.

### D6. The pipeline function
`generatePattern(image, settings, palette = <prepared DMC>)` validates the pixel image and
settings (`targetWidth` integer 1–500, `maxColors` integer 1–99; errors name the field and the
value), computes the grid size (D2), resizes (D3), collects the Lab values of non-empty cells,
returns an all-empty pattern with `colors: []` when there are none, otherwise clusters (D4),
maps and builds (D5). It does not modify its arguments. The core range for `targetWidth`
starts at 1 so tests can use 1 × 1 and 2 × 2 grids; the form offers 10–500 (D10).

### D7. Worker protocol
Requests (main → worker):
`{ type: 'generate', id, settings: { targetWidth, maxColors }, image? }` where `image` is a
pixel image, included with the first request for a new image; its `pixels.buffer` is in the
transfer list. Responses (worker → main):
`{ type: 'pattern', id, pattern }` with `pattern.cells.buffer` transferred, or
`{ type: 'error', id, message }`.

`createPatternWorkerHandler()` returns `handleMessage(message) → { response, transfer }` and
holds one piece of state, the remembered pixel image. It stores `message.image` (after checking
its size) before generating, so later requests can omit it even if this one is stale. It
catches every error and turns it into an error response echoing the id (unknown `type`,
`generate` with no image yet, invalid settings, core errors). `pattern.worker.js` is only:
`self.addEventListener('message', (event) => { const { response, transfer } =
handleMessage(event.data); self.postMessage(response, transfer); })`.
Requests are handled one at a time in arrival order; stale requests are still computed (they
cannot be interrupted) — the debounce (D9) keeps their number low.
*Alternative:* separate `set-image` and `generate` messages — rejected: two message types and a
second response to correlate, with no behavior gain.

### D8. Worker client (io) and wiring
`createPatternWorkerClient(worker)` takes any object with `postMessage` and
`addEventListener` (a real `Worker` in the browser, a fake routed to the handler in tests) and
returns `{ generate({ settings, image }) }`. `generate` assigns the next id, posts the request
(transferring `image.pixels.buffer` when present) and returns a promise that resolves with the
pattern or rejects with `Error(message)`. A worker `error`/`messageerror` event rejects all
pending requests with `The pattern worker stopped: …`. `main.js` creates the worker on one line,
`new Worker(new URL('./workers/pattern.worker.js', import.meta.url), { type: 'module' })`, so
the URL is relative and the served-site test crawls the worker and its imports.

### D9. When a pattern is generated: automatically, debounced, latest wins
`setupPatternGeneration(store, client)` subscribes to the store:

- `state.image` changed to a non-null image → generate now (no delay);
- `settings.targetWidth` or `settings.maxColors` changed → generate 300 ms after the last change
  (`GENERATION_DELAY_MS = 300`, one `setTimeout` reset on each change);
- `settings.fabricCount` changed → nothing (it does not change the pattern).

A counter `latestChange` is incremented on every one of these changes (not when a request is
sent). A run captures the counter, and its result is stored only if the counter is unchanged
when the response arrives — so a result is dropped if the image or a setting changed after
it was requested, even if the newer request has not been sent yet (debounce still pending).
Before sending, the run checks the grid size; if it exceeds 500 the run sets
`generation: { kind: 'idle', text: '' }` and stops (the form explains it). On the first run for
a new image it calls `readImagePixels` and attaches the image. It sets
`generation: running 'Generating pattern…'`, then on success `{ pattern, generation: done … }`,
on failure `generation: error 'Could not generate the pattern: …'` plus `console.error` — the
pattern is left as it was (for a new image it stays `null`, as image-input set it). The active
layer is not changed; the layer switcher enables `DMC colors`/`Chart` from `state.pattern`.
*Alternative:* an explicit Generate button — rejected: an extra step on every tweak, and the
user cannot see what a width or color count does; with the worker the UI stays responsive, and
the debounce plus stale guard keep wasted work small.

### D10. Settings form and size text
Markup replaces the settings marker in `index.html`: a `<form class="settings"
data-role="settings">` with a `<fieldset>` + `<legend>Pattern settings</legend>`, three
labelled controls with `data-setting="targetWidth" | "maxColors" | "fabricCount"`
(`<input type="number" min="10" max="500" step="1">`, `<input type="number" min="1" max="99"
step="1">`, `<select>` with 11/14/16/18 ct), one error `<span>` per number field (linked via
`aria-describedby`, `hidden` when valid), a size `<output data-role="pattern-size">` and a
`<output data-role="generation-status" aria-live="polite">`. Submitting the form is prevented.

`setupSettingsForm` fills the controls from `state.settings`, and on `input` parses the text with
`parseWholeNumber(text, min, max)` (core; `null` for empty, fractional or out-of-range). Valid →
`setState({ settings: { …settings, field: value } })`, `aria-invalid="false"`, message hidden;
invalid → `aria-invalid="true"`, message shown, settings unchanged. The size output is
re-rendered on image or settings changes using core texts: `formatPatternSize(size,
fabricCount)` → `100 × 67 stitches — 7.1 × 4.8 in (18.1 × 12.2 cm) on 14 ct` (`toFixed(1)` of
`finishedSize`), `formatGridTooLarge(size, maxWidth)`, `NO_IMAGE_SIZE_TEXT`. The generation
status output renders `state.generation.text`, styled as an error for `kind: 'error'`.
`describeGenerationResult(pattern)` produces the "Pattern ready" text. The texts live in core so
they are unit-tested (ui/ has no unit tests).

### D11. State and busy flag
`src/ui/app-state.js` gains `settings: { ...DEFAULT_SETTINGS }` (100, 24, 14) and
`generation: { kind: 'idle', text: '' }`, described in its header comment. Writers: settings →
`settings-form.js`; `pattern` and `generation` → `pattern-generation.js` (image-input keeps
clearing `pattern`). `src/ui/status.js` sets the workspace's `aria-busy` to
`status.kind === 'loading' || generation.kind === 'running'` and re-renders when either
changes — one module owns the attribute, so image loading and generation cannot overwrite each
other's busy state.

### D12. Seams with the parallel changes
- `index.html`: only the settings marker line is replaced.
- `main.js`: imports inserted directly after the `setupImageInput` import (not at the end of the
  import block, where the legend change will append), and one new group after "Image input and
  status line": a comment, the worker client creation, `setupSettingsForm`,
  `setupPatternGeneration`.
- `styles/main.css`: one `/* Settings form */` block inserted after `.toolbar` (not at the end of
  the file); the form is a fixed-width flex item (`flex: 0 0 16rem`) in the existing `.app-main`
  row, with a new narrow-screen media query in the same block, so `.app-main` itself is not
  edited.
- No edits to `src/ui/layers/*`, `viewer.js`, `layer-switcher.js`, `core/pattern.js`, `print.css`.

## Defaults chosen (to confirm with the user)

Width 100 stitches (form 10–500, core 1–500), max colors 24 (1–99), fabric 14 ct, grid side
limit 500, empty below 50 % average alpha, debounce 300 ms, automatic generation, k-means seed
20261113 and at most 30 iterations, Original layer stays active after generation, dithering
deferred to a later change.

## Risks / Trade-offs

- [Worst case 500 × 500 with 99 colors takes seconds] → Runs in the worker with a busy status;
  pan/zoom stay responsive; early stop when assignments settle; the limit is a constant.
- [Stale requests still compute in the worker] → 300 ms debounce; a new image waits behind at
  most the request in progress. Cancellation (terminate + respawn) can come later if needed.
- [Results can differ by an ulp between browser engines (`Math.cbrt`, `**`), rarely flipping a
  tie] → Deterministic per browser and per input, which is what the domain rule needs; tests
  run in Node only.
- [`getImageData` unpremultiplies, losing RGB precision for nearly transparent pixels] → Those
  pixels carry little weight in the alpha-weighted average.
- [`OffscreenCanvas` missing in an old browser] → `readImagePixels` throws; the user sees
  `Could not generate the pattern: …`. All current evergreen browsers support it.
- [Main-thread `getImageData` stall for large images] → Once per image, tens of ms; accepted
  (D1).
- [`main.js`/`index.html`/`main.css` edits next to the parallel changes] → Localized per D12;
  rebase conflicts, if any, are one-hunk.

## Migration Plan

None: new behavior only. `state` gains two fields with defaults; nothing is persisted.
Rollback is reverting the change's commits.
