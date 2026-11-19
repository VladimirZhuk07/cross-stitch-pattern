# Proposal

## Why

While stitching, the user often looks for one color: "where do all the 7s go?". On a chart with
20–30 pale tints and small numbers, the cells of one color are hard to find by eye, and at a
zoom where numbers are hidden they cannot be found at all.

## What Changes

- **Select a color in the legend.** A row of the legend can be selected by a click or tap on
  the row, or with the keyboard on its number button. Only one color is selected at a time.
  Selecting another row moves the selection. Clicking the selected row, or pressing Esc,
  clears it.
- **Highlight on the Chart.** Every cell of the selected color is filled with a strong red
  (`#B00000`), and its number is drawn in bold white. Grid lines, hatching and rulers stay as
  they are.
- **Visible at every zoom.** The highlight stays visible when numbers are hidden. When a
  stitch is smaller than a device pixel, any block that contains a selected stitch is drawn
  fully red, so a single stitch of a rare color is never averaged away.
- **Selected row.** It is marked with a pressed number button. Its number box turns red with
  a white number, just like its chart cells, and the row gets a light red background and a
  thick left border, so the state is not shown by color alone. Row sizes do not change.
- **Switching layers.** Selecting a color while `Original` or `DMC colors` is shown switches
  the view to `Chart`. The selection survives later layer switches. It is cleared whenever the
  pattern changes (a new image or new settings).
- User-visible: legend rows become selectable; the Chart shows highlighted cells.

### Out of scope

- Highlighting on the `Original` and `DMC colors` layers. The planned Progress view will reuse
  the highlight; that is a later change.
- Selecting several colors, selecting by clicking a cell in the chart, and a "next highlighted
  cell" navigation.
- Remembering the selection across page loads, and printing the highlight.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `stitch-chart`: new requirements for selecting one legend color, the highlight of its cells
  (colors, numbers, every zoom level), clearing the selection, and the selected row's look.

## Impact

- `src/ui/app-state.js`: new state field `highlightedColor` (a legend index or `null`).
- `src/ui/legend.js`: the selection (delegated clicks, Esc, clear on a new pattern, switch to
  Chart). `index.html`: the number in the row template becomes a `<button>`.
  `styles/main.css`: the selected-row look.
- `src/ui/layers/chart-layer.js`: draws a highlight overlay and white bold numbers.
  `src/ui/layers/pattern-picture.js`: an optional custom row filler and a `release()`.
- New pure `src/core/highlight.js`: the highlight colour, the toggle rule, and the "any stitch
  in the block" overlay pixels.
- `src/ui/viewer.js`: repaint when `highlightedColor` changes.
- No new dependencies, no network.
