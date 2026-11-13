# Design

## Context

Greenfield: the repository has rules (`CLAUDE.md`, `.claude/rules/`) and OpenSpec config, but
no `src/`, no specs, and no dev server. Motivation is in proposal.md; behavior is in
`specs/image-import/spec.md` and `specs/pattern-viewer/spec.md`.

Three other changes are developed in parallel (`add-dmc-color-matching`, `add-pattern-model`)
or right after this one (`add-pattern-generation`, `add-dmc-preview-layer`,
`add-stitch-chart-layer`). This design fixes the seams they plug into so they touch
different files.

## Goals / Non-Goals

**Goals:**
- A working page that loads an image and shows it in a zoomable, pannable frame.
- A documented view-layer interface so the DMC and chart layers are each one file swap.
- A frame coordinate system that layers 2 and 3 can align with exactly.
- A dev server plus a served-site test that would catch GitHub Pages path bugs.

**Non-Goals:**
- No pixel extraction for processing (`ImageBitmap` → RGBA buffer). `add-pattern-generation`
  adds it to `src/io/` together with the worker that needs it.
- No pinch zoom, no inertia, no pan limits (the `Fit` button is the way back).
- No settings in state; `add-pattern-generation` adds a `settings` key.

## Module map

| Module | Layer | Responsibility |
|---|---|---|
| `src/core/image-size.js` | core | `capImageSize(width, height, maxSide)` |
| `src/core/viewport.js` | core | fit, zoom, pan, resize, content rectangle, canvas buffer size |
| `src/io/image-loader.js` | io | `loadImageFile(file, maxSide)` via `createImageBitmap`; `ImageDecodeError` |
| `src/ui/store.js` | ui | `createStore(initial)` → `getState`, `setState`, `subscribe` |
| `src/ui/app-state.js` | ui | `createInitialState()` and the plain-words description of the app state |
| `src/ui/status.js` | ui | renders `state.status` into the status `<output>` |
| `src/ui/image-input.js` | ui | file chooser, drag-and-drop, stale-load guard, error text |
| `src/ui/viewer.js` | ui | canvas, DPR buffer, `ResizeObserver`, rAF rendering, empty state; documents the view-layer contract |
| `src/ui/viewer-input.js` | ui | pointer drag, wheel, keyboard → viewport updates |
| `src/ui/zoom-controls.js` | ui | `+`, `−`, `Fit` buttons and zoom percentage |
| `src/ui/layer-switcher.js` | ui | enable/disable radios, select layer, fallback to Original |
| `src/ui/layers/original-layer.js` | ui | `createOriginalLayer()` |
| `src/ui/layers/dmc-layer.js` | ui | `createDmcLayer()` stub (replaced by `add-dmc-preview-layer`) |
| `src/ui/layers/chart-layer.js` | ui | `createChartLayer()` stub (replaced by `add-stitch-chart-layer`) |
| `src/main.js` | root | creates store and layers, calls each `setup*` |
| `scripts/serve.js` | tooling | static dev server on `node:http` |

`core/image-size.js` and `core/viewport.js` import nothing and use no browser globals, so
core stays pure and runs in Node tests. No module in this change touches `src/workers/`,
`src/data/`, or the core files owned by other changes.

## Data shapes

Shapes are plain objects, documented in plain words in a comment next to the function that
creates them (no type annotations). The specs are authoritative.

- **Viewport** (created by `fitViewport` in `src/core/viewport.js`):
  `{ scale, offsetX, offsetY }`. `scale` is CSS px per image px (1 = zoom 100 %, > 0);
  `offsetX`/`offsetY` are the CSS px position of the image's top-left corner relative to the
  frame's top-left (any real number). Sizes are `{ width, height }`, points `{ x, y }`,
  rectangles `{ x, y, width, height }`, all in CSS px unless stated otherwise. Zoom limits are
  `{ minScale, maxScale }`.
- **Capped size** (created by `capImageSize` in `src/core/image-size.js`):
  `{ width, height, isDownscaled }`, whole pixels ≥ 1.
- **Loaded image** (created by `loadImageFile` in `src/io/image-loader.js`):
  `{ bitmap, fileName, width, height, sourceWidth, sourceHeight, isDownscaled }`. `bitmap` is
  the decoded `ImageBitmap`, already capped; `width`/`height` are its size; `sourceWidth`/
  `sourceHeight` are the size before the cap.
- **App state** (created by `createInitialState` in `src/ui/app-state.js`):
  - `image`: a loaded image, or `null` before the first successful load;
  - `pattern`: `null` until a pattern exists (`add-pattern-generation` fills it; its shape
    is described in `src/core/pattern.js`);
  - `activeLayer`: `'original'`, `'dmc'` or `'chart'`;
  - `viewport`: a viewport, or `null` meaning "fit as soon as the frame has a size";
  - `frame`: frame size `{ width, height }` in CSS px, written only by `viewer.js`;
  - `status`: `{ kind, text }` with `kind` one of `'idle'`, `'loading'`, `'info'`, `'error'`.

## Decisions

### D1. One canvas, the active layer repaints it
The frame holds one `<canvas>`. On every relevant state change the viewer clears it and
calls `render` of the active layer only. *Alternative:* one canvas per layer, toggled with
`hidden`. Rejected: three full-size buffers of memory, and hidden layers would still need to
be kept in sync with the viewport. Repainting on switch is cheap (one `drawImage` for layers
1 and 2; layer 3 draws only visible cells).

### D2. Viewport in image-pixel coordinates
World coordinates are pixels of the decoded (capped) image. `Viewport = { scale, offsetX,
offsetY }` maps world → screen: `screen = offset + world × scale`. It is stored in the app
state, not in a layer, so switching layers cannot change it (spec: shared zoom and pan).
All math is pure in `core/viewport.js`:

- `fitViewport(content, frame)`: margin `FIT_MARGIN = 16`, `scale = min((fw − 32)/cw, (fh − 32)/ch)`,
  centered. `RangeError` for non-positive sizes; the viewer skips rendering when the frame is 0.
- `zoomLimits(content, frame)`: `{ minScale: fit / 2, maxScale: max(MAX_SCALE = 64, fit) }`.
  64 CSS px per image px still gives ~38 px stitches when a grid is finer than the image.
- `zoomAt(viewport, factor, anchor, limits)`: clamps the scale, then keeps the world point
  under `anchor` fixed: `offset' = anchor − (anchor − offset) × scale'/scale`.
- `wheelZoomFactor(deltaPixels)`: `ZOOM_STEP ** (−deltaPixels / 100)`, `ZOOM_STEP = 1.25`.
  The UI normalizes `deltaMode` (line × 16 px, page × frame height) first.
- `panBy(viewport, dx, dy)`, `recenterOnResize(viewport, oldFrame, newFrame)`
  (`offset += (new − old) / 2`), `contentRect(viewport, content)`,
  `canvasBufferSize(frame, pixelRatio)` (`Math.round` per side).

*Alternative:* normalized coordinates (0–1) with zoom relative to fit. Rejected: the
percentage shown to the user and the zoom limits are easier to reason about in image pixels.

### D3. Layer alignment rule
Every layer paints into the same `contentRect(viewport, image)`. A pattern of W × H stitches
covers that whole rectangle: column c spans `[c/W, (c+1)/W)` of its width, row r spans
`[r/H, (r+1)/H)` of its height. Contract for `add-pattern-generation`: the resize step maps
the **whole** capped image onto the grid (no cropping), choosing `H = round(W × imageHeight /
imageWidth)`. Cells are then square within rounding: for 2048 × 1365 → 100 × 67 the cell
aspect is 1.0047. *Alternative:* exactly square cells with the grid anchored top-left.
Rejected: the grid would overhang or fall short of the image by up to half a stitch, so the
Original and DMC layers would visibly shift against each other.

### D4. View-layer interface (plug-in point for #5 and #6)
The contract is described once, in plain words, in the header comment of `src/ui/viewer.js`
(the module that calls layers). A **view layer** is a plain object:

- `id`: `'original'`, `'dmc'` or `'chart'`;
- `isAvailable(state)`: returns `true` when the layer can be shown for this app state;
- `render(ctx, frame, state)`: draws the layer. `ctx` is the frame canvas's 2D context;
  `frame` is `{ width, height, pixelRatio, viewport, content }`: frame size in CSS px, device
  px per CSS px (for 1-device-px lines), the current viewport, and the shared content
  rectangle in CSS px.

Rules: `render` is synchronous, gets a cleared context already scaled so 1 unit = 1 CSS px
(wrapped in `save`/`restore` by the viewer), is called only for the active layer with a
loaded image and a non-zero frame, never mutates state, and adds no DOM listeners. A layer may
cache derived drawings in its factory closure, keyed by object identity of `state.pattern`.

`main.js` imports all three factories from day one:
`const layers = [createOriginalLayer(), createDmcLayer(), createChartLayer()];`.
This change ships `dmc-layer.js` and `chart-layer.js` as stubs (`isAvailable: state.pattern
!== null`, `render` writes a centered "not available yet" note). Changes #5 and #6 each
replace one stub file and touch neither `main.js` nor each other's files. *Alternative:*
add an import and a registry line per layer in `main.js`. Rejected: two parallel changes
editing adjacent lines always conflict.

The three radio options (`value="original" | "dmc" | "chart"`) are static markup in
`index.html`; the switcher only enables or disables them from `isAvailable` and writes
`activeLayer`. If the active layer becomes unavailable it sets `activeLayer: 'original'`.

### D5. Store
`createStore(initial)` keeps one shallow-frozen state object. `setState(partial)` merges into
a new object, skips notification if every given key is `===` to the current value, and calls
listeners synchronously in subscription order with `(state, previous)`. A listener may call
`setState` (the switcher's fallback); the nested update notifies again with the newest state.
Listeners compare the fields they care about. The viewer coalesces repaints with
`requestAnimationFrame`, so frequent `viewport` updates during a drag cost one paint per frame.
*Alternative:* event-per-key emitter. Rejected: more API for no gain at this size.

### D6. Decoding and the size cap
`loadImageFile` rejects 0-byte files, then calls `createImageBitmap(file)` (browsers apply
EXIF orientation by default; GIF yields its first frame). If `capImageSize` reports a
downscale, it creates a second bitmap with `{ resizeWidth, resizeHeight, resizeQuality:
'high' }` and closes the first. Decode failures become `ImageDecodeError` (with `fileName`);
`image-input.js` turns it into the user message. Other errors are logged with
`console.error` and shown as a generic message. `MAX_DECODE_SIDE = 2048` lives in the io
module; the core function takes the limit as a parameter. 2048 px is far above any practical
stitch width (≤ 500) and keeps one RGBA copy at ≤ 16 MB.
*Trade-off:* the first decode is at full size, so a 100-megapixel file briefly needs ~400 MB.
Reading dimensions first through an `<img>` would avoid that but adds a second decode path;
the desktop target makes the simple path acceptable.

### D7. Latest load wins; old bitmaps are freed
`image-input.js` keeps a `latestLoadId` counter. A finished load whose id is not the latest
closes its bitmap and returns. On success it sets `{ image, pattern: null, activeLayer:
'original', viewport: null, status }` and then closes the previous bitmap. The viewer fits
whenever `viewport` is `null`, an image exists, and the frame has a size; `Fit` also sets
`viewport: null`, so fitting has one implementation.

### D8. Input handling
Pointer Events with `setPointerCapture` (mouse, pen, one finger; CSS `touch-action: none`),
`wheel` with `{ passive: false }` to stop page scroll, and keys on the focusable frame
(`tabindex="0"`): `+`/`=`, `-`, `0`, arrows (`PAN_STEP = 50`). Drops outside the frame are
prevented so the browser does not navigate to the file. When `drop` delivers several files,
the first is used.

### D9. High-DPI canvas
Before each paint the viewer compares `canvasBufferSize(frame, devicePixelRatio)` with the
canvas size and resizes the buffer if needed, then sets `ctx.setTransform(dpr, 0, 0, dpr, 0,
0)`. Checking on every paint also catches DPR changes (browser zoom, moving to another
monitor) without extra listeners. The Original layer turns image smoothing off when
`scale ≥ 1` so pixels stay sharp and line up with the stitch grid.

### D10. Dev server and served-site test
`scripts/serve.js` exports `startServer({ port, host = '127.0.0.1', root, basePath = '/' })`
→ `{ url, close() }` and runs as a CLI (`--port`, `--base`, or `PORT`; default 8080). It
serves GET/HEAD only (405 otherwise), maps `basePath` to `index.html`, returns 404 for paths
outside `basePath`, for any segment starting with `.`, and for anything resolving outside
`root`; it sends a content type per extension and `Cache-Control: no-store`.
The served-site test starts it with `port: 0` and `basePath: '/cross-stitch-pattern/'`, so any
absolute URL (`/src/main.js`) fails exactly as it would on GitHub Pages. It crawls
`<script src>`, `<link href>`, static and dynamic `import` specifiers, `new URL('…',
import.meta.url)`, and CSS `url()`/`@import`; it asserts 200, the expected content type,
relative specifiers ending in `.js`, and no `http(s):` or protocol-relative references.
`index.html` uses `<link rel="icon" href="data:,">` so the browser does not request
`/favicon.ico`.

### D11. Seams for wave 2
`index.html` contains comment anchors in separate places: one for the settings form
(`add-pattern-generation`) and one for the legend (`add-stitch-chart-layer`). `main.js`
groups `setup*` calls with a blank line between groups. Unrelated changes therefore edit
non-adjacent lines.

## Risks / Trade-offs

- [Stub layers ship code that is replaced soon] → They are about 15 lines each, and they make
  the contract testable now (an integration test checks all three factories and ids).
- [Shapes are only described in comments, not checked] → Unit tests cover every core
  function that creates or transforms them; the layer-contract integration test checks the
  three layers.
- [Full-size first decode for huge files] → See D6; accepted for a desktop target.
- [Listener fan-out on every pan move] → Listeners compare fields; painting is rAF-coalesced.
- [`createImageBitmap` resize quality differs between browsers] → Only the display and the
  input to area averaging are affected; the result stays deterministic per browser.

## Migration Plan

None: first application code. Rollback is reverting the merge commit range.
