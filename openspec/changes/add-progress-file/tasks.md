# Tasks

## 1. Shared export pieces (byte for byte from the shared conventions)

- [x] 1.1 Add `tests/unit/core/file-names.test.js` exactly as in the shared conventions (section 4); verify it fails (module missing). Then add `src/core/file-names.js` exactly as written there; verify `node --test tests/unit/core/file-names.test.js` passes
- [x] 1.2 Add `tests/unit/core/compression.test.js` exactly as in the shared conventions (section 7); verify it fails (module missing). Then add `src/core/compression.js` exactly as written there; verify `node --test tests/unit/core/compression.test.js` passes
- [x] 1.3 Add `src/io/download.js` exactly as in the shared conventions (section 3); verify `npm run test:integration` still passes (it is imported in task 6.5, when served-site checks it)
- [x] 1.4 Add a failing check to `tests/integration/progress-markup.test.js`. Then add the Export menu to `index.html` and verify the check passes. The check covers:
  - a `<details class="export-menu" data-role="export-menu">` right after the `<h1>` and before the `file-picker` label;
  - only the `export-progress` button (disabled, text `Save progress (.stitch)`);
  - the `Load progress (.stitch)` label with a disabled `<input type="file" accept=".stitch" data-role="progress-file-input">`.

  The markup is copied byte for byte from section 1 of the conventions, with only this change's two items.
- [x] 1.5 Insert the Export-menu CSS block verbatim after the `.file-picker:has(.file-picker__input:focus-visible)` rule in `styles/main.css`. Append the commented `.export-menu { display: none; }` rule to `styles/print.css`. Add checks to `tests/integration/layout-css.test.js` that `.export-menu__items` exists and that print hides `.export-menu`; verify they pass

## 2. The .stitch codec (core, TDD)

- [x] 2.1 Write failing tests in `tests/unit/core/progress-file.test.js` for `encodeProgressFile` (design D1, D2) and verify they fail. Cover:
  - the 3 × 2 fixture pattern with cells 0 and 4 stitched → bytes 0–15 are `53 54 49 54 43 48 01 00 03 00 00 00 02 00 00 00`, bytes 16–29 are the ASCII fingerprint, and `decompressBytes` of the rest (`compression.js`, format `'deflate'`) gives `[0x11]`;
  - a 1000 × 1000 progress with 100 marks encodes to fewer than 5,000 bytes;
  - it accepts a SavedProgress from `toSavedProgress`;
  - it rejects a fingerprint `'xyz'` (TypeError), width 0 (RangeError) and a bits length off by one (RangeError), naming the value.
- [x] 2.2 Implement `PROGRESS_FILE_EXTENSION`, `PROGRESS_FILE_FORMAT`, `MAX_PROGRESS_FILE_BYTES` and `encodeProgressFile` (header plus `compressBytes(bits, 'deflate')`) in `src/core/progress-file.js`, with a header comment describing the file layout table. Verify 2.1 passes
- [x] 2.3 Write failing tests for a successful `decodeProgressFile(bytes, pattern)` and verify they fail. Cover:
  - a round trip of the 3 × 2 fixture gives cells 0 and 4, `stitchedCount` 2, `version` 0, `lastToggled` null;
  - a 4000 × 4000 round trip with 1,234 marks keeps exactly those cells;
  - a file whose bits set empty cell 3 and padding bit 7 marks only the real cells and recounts;
  - the input bytes are not modified.
- [x] 2.4 Implement the header parsing, the `decompressBytes(data, 'deflate', expectedLength)` call and the `restoreProgress` reuse (design D2); no stream code of its own; verify 2.3 passes
- [x] 2.5 Write failing tests for `ProgressFileError` reasons and verify they fail. Cover:
  - fewer than 30 bytes, wrong magic and `MAX_PROGRESS_FILE_BYTES + 1` bytes → `'not-progress-file'`;
  - version 2 → `'newer-version'`, version 0 → `'damaged'`;
  - width 120 / height 80 against a 100 × 67 pattern → `'other-pattern'` with `fileWidth` 120 and `fileHeight` 80;
  - the same size with another fingerprint → `'other-pattern'`;
  - a cut-short stream, 2 junk bytes after the stream, an inflated length one byte short, and a stream that inflates to 10 MB for the 3 × 2 pattern → `'damaged'` (the last one is stopped by the `maxLength` guard of `decompressBytes` and finishes quickly).
- [x] 2.6 Implement the error class and the checks in the order of design D2; verify 2.5 passes
- [x] 2.7 Write failing tests for the texts and verify they fail. Cover:
  - `formatProgressFileError` for each reason, using the exact sentences of the spec deltas, including the size sentence `It is for a 120 × 80 pattern; this one is 100 × 67.` and the unexpected-error text for a plain `Error`;
  - `formatLoadWarning('cat.stitch', 12, 40, 6700)`;
  - `formatLoadedNote('cat.stitch')` → `Loaded your progress from cat.stitch.`;
  - `formatSavedFileLine('cat.stitch')` → `Saved cat.stitch.`;
  - `SAVE_FAILED_TEXT`;
  - names kept literally (`<b>x</b>.stitch`).
- [x] 2.8 Implement the texts; verify `npm run test:unit` passes
- [x] 2.9 Add `tests/integration/progress-file-format.test.js`: a pattern generated through the real pipeline (as in `pattern-pipeline.test.js`), toggled, encoded and decoded against a second generation of the same input, gives the same marks. A different `maxColors` gives `'other-pattern'`. Verify it passes

## 3. Browser glue (io)

- [x] 3.1 Create `src/io/progress-file.js` with `downloadProgressFile(bytes, fileName, doc)` (uses `downloadBlob`, type `application/octet-stream`) and `readFileBytes(file)` (design D3), with header comments; it is checked by served-site once imported (task 6.5)

## 4. Save progress first in the dialog (ui, markup)

- [x] 4.1 Add failing tests to `tests/integration/progress-warning.test.js` (extend the fake dialog with the new button and note) and verify they fail. Cover:
  - without `saveFirst` the button is hidden;
  - with it the button shows; pressing it calls `saveFirst` once, disables the button while it runs, then shows `Saved cat.stitch.`, keeps the dialog open and leaves the answer pending;
  - a rejecting `saveFirst` shows `Could not save the progress file.`;
  - a new `confirm` clears the line;
  - `createProgressGuard(progress, warning, persistence, saver)` passes `saver.saveCurrent` with the settings and image questions.
- [x] 4.2 Implement the `saveFirst` option in `createProgressWarning` and the `saver` parameter of `createProgressGuard` (design D4); verify 4.1 passes
- [x] 4.3 Extend the dialog check in `tests/integration/progress-markup.test.js` for three buttons in the order Keep (autofocus), `Save progress first` (`data-action="save-progress-first"`), confirm, and the hidden polite note `data-role="progress-warning-note"`. Add them to `index.html`, style `.confirm-dialog__note` in `styles/main.css`, and verify the test passes

## 5. Loaded progress in persistence (ui)

- [x] 5.1 Add failing tests to `tests/integration/progress-persistence.test.js` for `adoptProgress(progress, 'cat.stitch')` and verify they fail. Cover:
  - it sets `state.progress` and `activeLayer: 'progress'`, shows `Loaded your progress from cat.stitch.`, and saves at once (no timer);
  - the note is cleared by the next toggle;
  - a following first mark does not ask, even when another pattern's record was saved;
  - a pending toggle save is cancelled;
  - with storage unavailable the unsaved note stays and nothing is saved;
  - a loaded progress with 0 stitches clears this pattern's record;
  - `confirmFirstMark` passes a `saveFirst` that calls `saver.saveRecord(saved)`.
- [x] 5.2 Implement `adoptProgress`, the `saver` parameter and the generalised transient note (design D6); verify 5.1 and the existing persistence tests pass

## 6. Menu items and load flow (ui, wiring)

- [x] 6.1 Write failing `tests/integration/progress-file.test.js` for `createProgressFileSaver(store, fakeDownload)` and verify it fails. Cover:
  - `saveCurrent()` with image `cat.png` downloads `cat.stitch` whose bytes decode back to the marks, and resolves `'cat.stitch'`;
  - `saveRecord` of a `dog.png` record gives `dog.stitch`, and one with `imageName: ''` gives `pattern.stitch`.
- [x] 6.2 Implement `createProgressFileSaver` in `src/ui/progress-file.js` (design D5); verify 6.1 passes
- [x] 6.3 Add failing tests to the same file for `setupProgressFileMenu` with a fake menu, fake warning, fake persistence and fake `readBytes`, and verify they fail. Cover:
  - enabling of both items for: no pattern, pattern with 0 marks, 1 mark, and generation running;
  - a save click closes the menu and calls `saveCurrent`; a failing save sets status `Could not save the progress file.`;
  - a valid file with no marks calls `confirmFirstMark`, then `adoptProgress(loaded, 'cat.stitch')`;
  - with 12 marks it asks with `formatLoadWarning` and `Load progress`; no leaves the progress alone;
  - another pattern's file sets the status error naming the file, without asking or adopting;
  - a file over 16 MiB is refused without calling `readBytes`;
  - a pattern change while reading adopts nothing;
  - the input value is reset after each choice.
- [x] 6.4 Implement `setupProgressFileMenu` (design D7); verify 6.3 passes
- [ ] 6.5 Wire `src/main.js`:
  - the progress group creates the saver and passes it to `setupProgressPersistence` and `createProgressGuard`;
  - a new commented group at the end calls `setupProgressFileMenu`.

  Update the `progress` comment in `src/ui/app-state.js`. Verify `npm run test:integration` passes, including `served-site.test.js` (new modules reachable, relative `.js` imports)

## 7. Verification

- [ ] 7.1 Run `npm run test:unit`; all tests pass
- [ ] 7.2 Run `npm run test:integration`; all tests pass
- [ ] 7.3 Browser smoke check with `node scripts/serve.js` (desktop width and a 360 px phone viewport in DevTools):
  - Before an image: `Export` opens with both progress items disabled.
  - Load `cat.png`. Load is enabled, Save disabled. Mark 12 stitches: Save is enabled. Save downloads `cat.stitch` and the menu closes. No network request appears in DevTools → Network.
  - Unmark all and reload, then load `cat.png` again. Use Load progress → `cat.stitch`: the 12 marks come back, the view is Progress, the note reads `Loaded your progress from cat.stitch.`, and IndexedDB holds the record at once.
  - With marks, load `cat.stitch` again: the load question appears with three buttons. Keep changes nothing; Load progress applies.
  - Change the width to 120: the dialog shows `Save progress first`. Press it: a file downloads, `Saved cat.stitch.` appears, and the dialog stays open. Then Keep: the width goes back to 100.
  - With width 120, load `cat.stitch`: the status reads the other-pattern error with `It is for a 100 × 67 pattern; this one is 120 × 80.` (or the actual sizes); nothing is marked.
  - Load a renamed `.png` as `x.stitch`: `it is not a progress file (.stitch).` Load a `.stitch` with its last bytes cut off (e.g. with a hex editor or `head -c`): `the file is damaged.`
  - Load `dog.png`, then tap the first stitch: the replace question shows `Save progress first`, and pressing it downloads `cat.stitch` from the saved record.
  - 4000-wide pattern: mark, save, reload, load the file back within a few seconds. Keyboard: Tab to `Export`, open it with Enter, Tab to both items, and focus is visible. Print preview hides the menu. No console errors.
- [ ] 7.4 Run `openspec validate add-progress-file --strict`; it passes
