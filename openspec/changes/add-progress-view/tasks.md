# Tasks

## 1. Progress data and texts (core)

- [x] 1.1 Write failing `tests/unit/core/progress.test.js` for `createProgress(pattern)`. Cover:
  - the 3 × 2 pattern (one empty cell): `bits` has 1 byte, all 0; `stitchedCount` 0; `totalCount` 5; `version` 0; `lastToggled` null; `pattern` is the same object;
  - a 3 × 3 pattern has 2 bytes;
  - a pattern without stitches has `totalCount` 0;
  - the pattern is not modified.

  Verify it fails because the module is missing.
- [x] 1.2 Create `src/core/progress.js` with `createProgress` and the Progress shape comment from design D1 (bit layout included); verify 1.1 passes
- [x] 1.3 Add failing tests for `toggleStitch(progress, cellIndex)` and `isStitched`:
  - toggling cell 5 of the 3 × 2 pattern sets bit 5 of byte 0 (`0b00100000`), `stitchedCount` 1, `version` 1, `lastToggled` 5, and leaves the old Progress and its bits unchanged;
  - toggling again clears it (`version` 2);
  - toggling the empty cell 3 returns the same object;
  - index 8 on a 3 × 3 pattern uses byte 1, bit 0;
  - `-1`, `6` and `1.5` throw `RangeError` naming the value.

  Verify they fail.
- [x] 1.4 Implement `toggleStitch` and `isStitched`; verify 1.3 passes
- [x] 1.5 Add failing tests for the texts:
  - `formatProgressSummary`: `(1234, 6700)` → `Stitched 1,234 of 6,700 (18.4 %)`; `(6699, 6700)` → `… (99.9 %)`; `(6700, 6700)` → `… (100 %)`; `(0, 6700)` → `Stitched 0 of 6,700 (0 %)`; `(1, 3)` → `… (33.3 %)`; `(0, 0)` → `Nothing to stitch in this pattern.`;
  - `formatSettingsWarning(12, 6700)` → `Change the pattern settings? Your progress on this pattern (12 of 6,700 stitches) will be lost.`;
  - `formatImageWarning('cat.png', 12, 6700)` → `Load cat.png? Your progress on the current pattern (12 of 6,700 stitches) will be lost.`; a name `<b>x</b>.png` is kept literally.

  Verify they fail.
- [x] 1.6 Implement the three formatters (locale-independent thousands separators, as in the existing formatters); verify 1.5 passes and `npm run test:unit` passes

## 2. Taps and cells under a point (core)

- [x] 2.1 Write failing `tests/unit/core/tap.test.js`. Cover:
  - start at (50, 30), end at (50, 30) → tapPoint (50, 30);
  - a move to (56, 34) (7.2 px) and end there → tapPoint (56, 34);
  - a move to (58, 30) then back to (50, 30) → null (cancelled once beyond 8 px);
  - exactly 8 px → still a tap;
  - a second pointer starting before the end → null for both;
  - an end of an untracked pointer → null and the tracker unchanged;
  - `cancelTap` → idle;
  - `TAP_SLOP` is 8.

  Verify it fails.
- [x] 2.2 Create `src/core/tap.js` (`TAP_SLOP`, `idleTap`, `startTap`, `moveTap`, `endTap`, `cancelTap`, pure, with a comment on the slop choice); verify 2.1 passes
- [x] 2.3 Add failing tests to `tests/unit/core/chart-layout.test.js` for `cellAtPoint(content, grid, point)`:
  - 20 px cells at (0, 0): (50, 30) → column 2, row 1, index 5 on a 3 × 2 grid;
  - (40, 20) (shared corner) → column 2, row 1;
  - (60, 10), (-1, 10) and (10, 40) → null;
  - content at (100, 50) offsets the result.

  Then implement it; verify `npm run test:unit` passes.

## 3. Stitched pixels (core)

- [x] 3.1 Add failing tests to `tests/unit/core/level-pixels.test.js` for the `stitched` mask of `fillLevelRows`:
  - level 0 with only cell 5 stitched: pixel 5 is its table color, the others transparent;
  - level 1 on a 2 × 2 block of `#000000` with 1 of 4 stitched → `0, 0, 0, 64`;
  - level 1 with all 4 stitched → `0, 0, 0, 255`;
  - a `null` mask gives exactly the unmasked result for the same input;
  - the return value (stitches read) is unchanged by the mask.

  Verify they fail.
- [x] 3.2 Implement the mask with separate masked loops (design D4); update the doc comment; verify 3.1 and the whole file pass

## 4. Pictures and layers (ui)

- [x] 4.1 Add failing tests to `tests/integration/pattern-picture.test.js` for `refreshCell(pattern, column, row)`. Cover:
  - after a complete single picture of a 4 × 3 pattern, a filler change plus `refreshCell(p, 2, 1)` puts one 1 × 1 ImageData at (2, 1) and only that pixel changes;
  - with SMALL_LIMITS tiles and the overview built, the cell's tile and the overview get one put each, and other tiles none;
  - a cell in a row not built yet gets no put;
  - another pattern → no-op.

  Verify they fail.
- [x] 4.2 Implement `refreshCell` (design D5); verify 4.1 and the file pass
- [x] 4.3 Move the highlight picture out of `chart-layer.js` into `src/ui/layers/highlight-picture.js` (no behaviour change); verify `tests/integration/chart-layer.test.js` passes unchanged
- [x] 4.4 Write failing `tests/integration/progress-layer.test.js` (same helpers as the chart test). Cover:
  - id `progress`, available exactly with a pattern;
  - with a fresh Progress it draws the same images, texts and strokes as the Chart layer;
  - with cell (2, 1) of the 3 × 2 pattern stitched, a third picture is drawn after tints and highlight, whose pixel (2, 1) is `#C72B3B` opaque and all others transparent, and no text `2` is drawn at (50, 30);
  - with `highlightedColor: 1` and (2, 1) stitched, the highlight picture is drawn before the stitched one and the bold white `2` appears only at (10, 10);
  - a Progress with `version + 1` refreshes one pixel (one put) instead of building a new canvas, and a different Progress object of another pattern builds anew;
  - with `isFrameKeyboardFocused: true`, a white 4 px and then a black 2 px rectangle surround the centre cell; without it, no marker;
  - the Chart layer ignores `state.progress`.

  Verify the file fails.
- [x] 4.5 Implement `src/ui/layers/stitched-picture.js`, the `id` / `showsProgress` options and the Progress paint order in `chart-layer.js`, and `src/ui/layers/progress-layer.js` (design D3); keep each file under ~300 lines; verify 4.4 and `tests/integration/chart-layer.test.js` pass

## 5. Progress state, input and counter (ui)

- [x] 5.1 Add `progress: null` and `isFrameKeyboardFocused: false` to `createInitialState`, with descriptions in the header of `src/ui/app-state.js`; add both to `needsPaint` in `src/ui/viewer.js`; verify `npm run test:integration` passes
- [x] 5.2 Write failing `tests/integration/progress.test.js` for `setupProgress(root, store)`, with a fake root holding the counter output and the real store. Cover:
  - a new pattern creates a fresh Progress, and `null` gives `null`;
  - `toggleAt(point)` on the Progress layer at (50, 30) with 20 px cells toggles index 5;
  - `toggleAt` on the Chart layer, on an empty cell or outside the grid changes nothing;
  - `toggleCentre()` toggles the cell at the frame centre;
  - the counter shows `Stitched 1 of 5 (20 %)` on Progress and is hidden on Chart;
  - `hasMarkedStitches()` follows `stitchedCount`.

  Verify it fails.
- [x] 5.3 Implement `src/ui/progress.js` (design D1); verify 5.2 passes
- [x] 5.4 Extend `src/ui/viewer-input.js` (design D2):
  - the options `{ onTap, onKeyToggle }`;
  - the tap tracker beside pan and pinch;
  - Space and Enter on Progress call `onKeyToggle` with `preventDefault`;
  - Shift + arrow pans one cell on Progress;
  - `isFrameKeyboardFocused` on focus, blur and pointerdown.

  Wire it in `src/main.js` with `createProgressLayer` in the layer list. Verify `npm run test:integration` passes, and in the browser a click marks and a drag pans.

## 6. Markup and dialog (index.html, ui)

- [x] 6.1 Add failing markup checks to a new `tests/integration/progress-markup.test.js`:
  - a fourth radio `value="progress"` labelled `Progress`, disabled, after `chart`;
  - `<output class="progress-summary" data-role="progress-summary" aria-live="polite" hidden>`;
  - `<dialog class="confirm-dialog" data-role="progress-warning">` with a heading, `[data-role="progress-warning-text"]`, `<button type="button" data-action="keep-progress" autofocus>Keep my progress</button>` and `<button type="button" data-action="confirm-lose-progress">`;
  - the frame's `aria-label` mentions Space or Enter on the Progress view.

  Then change `index.html` and update `tests/integration/view-layers.test.js` for four options. Verify the markup tests pass.
- [x] 6.2 Write failing `tests/integration/progress-warning.test.js` with a fake `<dialog>` (`showModal`, `close`, `returnValue`, `cancel` event). Cover:
  - `confirm({ text, confirmLabel })` sets the text and label, opens the dialog, and resolves `true` on the confirm button;
  - it resolves `false` on Keep and on `cancel`;
  - the text is set as text.

  Then implement `src/ui/progress-warning.js`; verify it passes.
- [ ] 6.3 Guard the settings (design D6):
  - `setupSettingsForm(root, store, guard)`: while `guard.hasMarkedStitches()`, number fields only validate on `input`, and on `change` a valid new value awaits `guard.confirmSettings()`, then updates or restores the field;
  - fabric is never guarded;
  - wire the guard in `main.js` with `formatSettingsWarning`.

  Verify in the browser: with 12 marks, typing `120` + Enter opens the dialog once; Keep restores `100`; Change generates one 120-wide pattern.
- [ ] 6.4 Guard the image input: `setupImageInput(root, store, guard)` awaits `guard.confirmImage(file.name)` before loading a chosen or dropped file (only while stitches are marked), and resets the file input on "keep"; wire it with `formatImageWarning`. Verify in the browser that dropping a file with marks opens the dialog, Keep leaves everything as is, and choosing the same file again re-opens it.
- [ ] 6.5 In `src/ui/legend.js` switch to Chart only from `original` and `dmc`; add a test to `tests/integration/legend-highlight.test.js` that a click on Progress keeps `activeLayer: 'progress'`; verify it passes

## 7. Styles and documentation

- [ ] 7.1 Add the CSS:
  - `.confirm-dialog`: centred, max 28rem, buttons at least 44 px on coarse pointers, the confirm button in the accent color, and a `::backdrop`;
  - `.progress-summary`: under the frame on desktop, and as its own row in the compact portrait and landscape grids;
  - compact segments: four, `font-size: 0.875rem`.

  Verify in the browser at 1440 × 900, 375 × 667, 360 × 640 (no sideways scroll, one-line labels, segments ≥ 44 px) and 667 × 375.
- [ ] 7.2 In `.claude/rules/ui.md`, change "Three switchable layers" to four, describing the Progress layer in one clause; verify the `git diff` shows only that bullet changed

## 8. Verification

- [ ] 8.1 Run `npm run test:unit`; all tests pass
- [ ] 8.2 Run `npm run test:integration`; all tests pass
- [ ] 8.3 Browser smoke check with `node scripts/serve.js`:
  - 1440 × 900, photo at width 100, Progress: click cells. They turn into their DMC color without a number, and the counter counts. A click again unmarks. A drag pans without marking.
  - Zoom out to Fit: stitched areas show DMC colors.
  - Select a legend color: only its unstitched cells are red.
  - Tab to the frame: the centre marker shows. Space marks, and Shift + Right then Enter marks the next cell.
  - With marks:
    - type `120` + Enter in the width: the dialog appears. Keep restores the field; Change gives a new pattern with 0 marks.
    - drop a new image: the dialog appears. Keep leaves everything; Load replaces it.
  - Width 4000 on a large photo: marking a cell shows within a frame. No console errors.
  - 375 × 667 touch: a tap marks, a pinch does not, four segments.
- [ ] 8.4 Run `openspec validate add-progress-view --strict`; it passes
