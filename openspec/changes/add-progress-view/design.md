# Design

## Context

- **View layers** (`src/ui/viewer.js`): objects `{ id, isAvailable, render }`, painted on an
  animation frame from `store.getState()` when a field in `needsPaint` changes. The Chart
  layer paints tints from `createPatternPicture`, then the highlight picture, then hatch,
  numbers, lines and rulers. `pattern-picture.js` builds level pictures row by row within a
  stitch budget per frame. It averages blocks when zoomed out and keeps tiles within a memory
  budget.
- **Pointer input** (`src/ui/viewer-input.js`) pans with one pointer and pinch-zooms with two,
  through `core/pinch-zoom.js`. There is no notion of a tap yet. The keys are `+ = - 0` and the
  arrows (50 px pans).
- **Settings** (`src/ui/settings-form.js`) update `state.settings` on every valid `input`
  event. `pattern-generation.js` regenerates 300 ms after the last change. New images come
  from `src/ui/image-input.js` (file chooser and drop).
- **Pattern size** reaches 10000 × 10000 stitches, so a bitset is 12.5 MB and a full picture
  rebuild takes many frames.

## Goals / Non-Goals

**Goals:**
- Reuse the Chart drawing, the picture pyramid and the highlight. The Progress layer is the
  Chart plus one more picture.
- A toggle shows in the next frame, even on the largest pattern.
- Pure, unit-tested core for everything decidable without the DOM: bits, taps, the cell under
  a point, texts, masked pixels.

**Non-Goals:**
- Persistence (`persist-progress`) and files (`add-progress-file`). The Progress data shape is
  chosen so both can store it as is (bits plus counts).

## Decisions

### D1. Progress data (core, `src/core/progress.js`)

`state.progress` is `null` while there is no pattern, otherwise a **Progress** created by
`createProgress(pattern)`:
- `pattern`: the Pattern it belongs to (identity).
- `bits`: a `Uint8Array` of `ceil(W × H / 8)` bytes. Cell index `i = row × W + column`
  (row-major, as `pattern.cells`) is bit `i & 7`, least significant first, of byte `i >> 3`.
  Padding bits are 0. This layout is the one `persist-progress` and `add-progress-file` will
  store.
- `stitchedCount` and `totalCount`: the stitched cells and the non-empty cells.
- `version`: 0 at creation, +1 per toggle. `lastToggled` is the cell index of the latest toggle,
  or `null`.

Functions:
- `toggleStitch(progress, cellIndex)` returns a **new** Progress with a copied bit array. It
  returns the same object for an empty cell. It throws `RangeError` for an index outside the
  grid. The copy costs ~4 ms at 12.5 MB, once per tap, which keeps the functions pure and the
  store's identity check meaningful. Mutating in place would need a separate change signal.
- `isStitched(progress, cellIndex)`.
- `formatProgressSummary(stitched, total)`: `Stitched 1,234 of 6,700 (18.4 %)`. The percentage
  is `floor(1000 × S / T) / 10`, written `0` or `100` without a decimal. It returns
  `Nothing to stitch in this pattern.` when T is 0.
- `formatSettingsWarning(stitched, total)` and `formatImageWarning(fileName, stitched, total)`:
  the dialog texts from the spec.

`src/ui/progress.js` is the only writer of `state.progress`:
- it creates a fresh Progress whenever `state.pattern` changes (`null` → `null`);
- it applies toggles;
- it renders the counter `<output>`, hidden unless `activeLayer === 'progress'`.

### D2. Taps (core, `src/core/tap.js`) and keyboard (ui, `viewer-input.js`)

- A **TapTracker** is a pure state `{ pointerId, start, isCancelled }`, or idle.
  - `startTap(tracker, pointerId, point)` starts it. A second pointer while one is tracked
    cancels it.
  - `moveTap` cancels once the pointer is more than `TAP_SLOP = 8` CSS px from its start. That
    is Android's touch slop, and iOS uses about 10.
  - `endTap(tracker, pointerId, point)` returns `{ tracker, tapPoint }`. `tapPoint` is `point`
    for a tap and `null` otherwise. `pointercancel` resets the tracker.
- `viewer-input.js` runs the tracker beside the existing pan/pinch gesture, so drags still
  pan. A tap of at most 8 px also pans by at most 8 px. Because the image moves with the
  finger, the cell under the release point is the cell that was pressed.
- `setupViewerInput(root, store, { onTap, onKeyToggle })`. `main.js` passes the progress
  module's handlers. On the Progress layer:
  - Space and Enter call `onKeyToggle()` (`preventDefault`, so Space does not scroll);
  - Shift + an arrow key pans by exactly one cell: `content.width / pattern.width` CSS px.
- `cellAtPoint(content, grid, point)` (core, `chart-layout.js`) returns
  `{ column, row, index }`, or `null` outside the grid. A point on a shared edge belongs to the
  cell right or below.
- **Keyboard marker.** A new state field, `isFrameKeyboardFocused`, is written only by
  `viewer-input.js`:
  - on `focus`, it becomes `viewer.matches(':focus-visible')`;
  - `blur` and `pointerdown` set it to `false`.

  This shows the marker for Tab focus only, not after a click. The layer draws a 4 px white
  rectangle and then a 2 px black one around the centre cell.

### D3. Rendering: the Chart layer with a Progress variant (ui)

- `createChartLayer(options)` gains `id` (default `'chart'`) and `showsProgress` (default
  `false`). `layers/progress-layer.js` exports
  `createProgressLayer(options) = createChartLayer({ ...options, id: 'progress', showsProgress: true })`.
- `chart-layer.js` is at 278 lines, so the highlight picture moves to
  `layers/highlight-picture.js` and the new stitched picture lives in
  `layers/stitched-picture.js`. The Chart layer keeps the paint order.
- Progress paint order:
  1. tints;
  2. highlight;
  3. **stitched picture** (smoothing as for tints);
  4. hatch;
  5. numbers, where stitched cells are skipped in both passes, so a stitched highlighted cell
     shows its DMC color with no number;
  6. lines;
  7. rulers;
  8. the keyboard marker.

  Drawing the stitched picture **over** the highlight gives "highlight only what is left"
  without a second highlight filler.
- `render` returns `true` while any picture is still incomplete.

### D4. Stitched pixels: a mask in `fillLevelRows` (core, `level-pixels.js`)

`fillLevelRows(grid, table, level, region, rowStart, rowEnd, out, stitched = null)` gains an
optional Progress `bits` mask. A cell whose bit is 0 counts as table entry 0. The stitched
picture's table has transparent empty cells and the DMC hex colors, as on the DMC colors layer.
So at level 0 a stitched cell is its DMC color and others are transparent. At level k the
existing premultiplied box average gives the DMC colors of the stitched part, with alpha equal
to the stitched share. That is exactly "DMC where stitched, tints show through elsewhere".

The masked case has its own copies of the two inner loops, so the unmasked hot path is not
slowed by a per-stitch check.

*Alternative:* a separate `fillStitchedRows`. Rejected: it would duplicate the average and its
rounding rules.

### D5. Updating one cell: `refreshCell` in `pattern-picture.js` (ui)

`picture.refreshCell(pattern, column, row)` refills one pixel per built picture of that pattern
whose region contains the cell. For each such picture:
- it calls `fillRows` for the 1 × 1 region at `(floor(column / 2^level), floor(row / 2^level))`
  into a 4-byte buffer;
- it `putImageData`s a 1 × 1 ImageData at the local position if that row is already built.
  Rows still to be built read the new bits anyway.

The cost is one block per level: at most `4^level` stitches, e.g. 4096 for the overview of a
4000-wide pattern.

The stitched picture keeps `{ pattern, version }`:
- for the same pattern and `progress.version === version + 1`, it calls
  `refreshCell(lastToggled)`;
- for any other jump (a new Progress object, a future file import), it `release()`s and
  rebuilds.

### D6. Warnings (ui, `progress-warning.js`; markup `<dialog>`)

`index.html` gets one `<dialog class="confirm-dialog" data-role="progress-warning">`. It holds
a heading `Your progress will be lost`, a `<p data-role="progress-warning-text">`, a
`Keep my progress` button (autofocus) and a confirm button whose label is set per use.

`createProgressWarning(root)` returns `confirm({ text, confirmLabel })`, a Promise that
resolves `true` only for the confirm button. Esc (the native `cancel`) and the Keep button
resolve `false`. The text is set with `textContent`. A native modal dialog handles the focus
trap, Esc and the backdrop, with no extra code.

- **`settings-form.js`** gets a `guard` with `hasMarkedStitches()` and `confirmSettings()`.
  - While `hasMarkedStitches()` is true, the `input` handler only validates and shows errors.
  - The commit happens on `change` (Enter or blur): if the value is valid and different, it
    awaits `confirmSettings()`. It then updates `state.settings`, or writes the value in use
    back into the field.
  - Without marked stitches the behaviour is unchanged.
- **`image-input.js`** gets a guard with `confirmImage(fileName)`. It is awaited before
  `loadImageFile`. On "keep", `fileInput.value = ''` so the same file can be chosen again.
- `main.js` builds both guards from `ui/progress.js` and `ui/progress-warning.js`.

### D7. Legend and switcher

- `legend.js` switches to Chart only from `original` and `dmc`, so Progress stays.
- `index.html` gets a fourth radio, `value="progress"`, labelled `Progress`.
- The frame's `aria-label` adds: "On the Progress view, click a stitch or press Space or Enter
  to mark the stitch at the centre."
- On compact screens the four segments get `font-size: 0.875rem` and less padding. 360 px
  leaves 86 px per segment and `DMC colors` needs about 76 px at 14 px. This is checked in the
  browser, and the spec requires one line per label.

## Risks / Trade-offs

- [12.5 MB copied per tap on the largest pattern] → It is ~4 ms and only on a tap. Persistence
  (next change) will write the bits debounced, not per tap.
- [A finger that wobbles more than 8 px pans instead of marking] → 8 px matches platform touch
  slop; zooming in makes cells larger than the wobble.
- [Settings apply only on commit while stitches are marked] → This is a visible behaviour
  change, limited to that state and specified in pattern-generation. Without marks nothing
  changes.
- [The labels of four segments might wrap at 360 px] → A smaller segment font, a browser check
  at 360 × 640, and the spec requires one line.
- [Progress is lost on reload until `persist-progress`] → Stated in the proposal. The dialogs
  already protect against the in-app ways of losing it.

## Migration Plan

Nothing is stored yet, so there is nothing to migrate.
