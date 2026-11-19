# Proposal

## Why

A cross-stitch pattern takes weeks to sew. The user wants to tick off stitches on screen as they
sew them, see what is left, and keep their place. This change adds that view. Keeping progress
across page loads follows in `persist-progress`, and the `.stitch` file in `add-progress-file`.

## What Changes

- **New view layer `Progress`**, a fourth option after `Chart`. Its cells start exactly like
  the Chart: pale tints, numbers, grid, rulers.
- **Marking stitches.** A click or tap on a stitched cell toggles it between stitched and not
  stitched.
  - A drag still pans and a two-finger pinch still zooms. Neither marks anything: a press only
    counts as a tap if the pointer moved at most 8 CSS px.
  - Empty cells and points outside the grid cannot be marked.
- **Look of stitched cells.** A stitched cell shows its full DMC color without a number, as on
  the fabric.
  - Zoomed far out, each picture pixel shows the stitched part of its block. A fully stitched
    area appears in DMC colors, an unstitched one in tints.
  - Grid lines and rulers stay on top.
- **Keyboard.** When the frame is reached with the keyboard on the Progress layer, a marker
  shows the cell at the frame centre. Space or Enter toggles that cell. Shift + an arrow key
  moves the view by exactly one cell.
- **Counter.** On the Progress layer a line under the frame reads, for example,
  `Stitched 1,234 of 6,700 (18.4 %)`. It is announced politely after each change.
- **Highlight on Progress.** A color selected in the legend is highlighted on the Progress
  layer too, but only in its cells that are not stitched yet. Selecting a color while on
  Progress keeps the Progress layer.
- **Warnings before progress is lost.** Once at least one stitch is marked, a dialog asks
  before anything replaces the pattern:
  - a change of width or max colors;
  - choosing or dropping a new image.

  The user can keep the progress or continue. While stitches are marked, the width and max
  colors apply when the field is committed (Enter or leaving it), not on every keystroke. That
  way the dialog appears once, not at every digit.
- Progress belongs to the current pattern and lasts until the page is closed. Every new
  pattern starts with no stitches marked.

### Out of scope

- Saving progress in the browser (IndexedDB) and restoring it after a reload:
  `persist-progress`.
- Export and import of a `.stitch` file, and a "Save progress first" button in the dialog:
  `add-progress-file`.
- Per-color progress in the legend, undo, marking several cells by dragging, and printing
  progress.

## Capabilities

### New Capabilities

- `stitch-progress`: the Progress layer, marking stitches (pointer and keyboard), the look of
  stitched cells, the counter, the highlight on Progress, and the warnings before progress is
  lost.

### Modified Capabilities

- `pattern-viewer`: the layer switcher offers four layers, `Progress` last.
- `responsive-layout`: the compact view switcher has four segments.
- `pattern-generation`: while stitches are marked, the width and max colors apply on commit
  and after confirmation, not 300 ms after typing.

## Impact

- `index.html`: a fourth layer radio, the counter output, the warning `<dialog>`, and the
  frame's `aria-label`. `styles/main.css`: the dialog, the counter, and four segments on phones.
- New core modules:
  - `core/progress.js`: the progress bitset, toggling, the counter text, and the warning text;
  - `core/tap.js`: tap detection;
  - `chart-layout.js`: `cellAtPoint`;
  - `level-pixels.js`: an optional stitched mask in `fillLevelRows`.
- UI:
  - `ui/progress.js`: owns `state.progress`, handles toggles, renders the counter;
  - `ui/progress-warning.js`: the dialog;
  - the Chart layer gains a Progress variant: `layers/stitched-picture.js`, with
    `layers/highlight-picture.js` split out of `chart-layer.js`;
  - `pattern-picture.js` gets `refreshCell`;
  - `viewer-input.js` reports taps and the keyboard toggle;
  - `settings-form.js` and `image-input.js` ask the warning first;
  - `legend.js` stays on Progress.
- No new dependencies, no network.
