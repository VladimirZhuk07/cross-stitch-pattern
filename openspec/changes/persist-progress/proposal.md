# Proposal

## Why

Marked stitches on the Progress layer are lost on every reload, closed tab or crashed phone
browser. For a project that takes weeks this makes the Progress view unusable. The browser
must keep the progress and give it back when the user opens the same picture again.

## What Changes

- **Pattern fingerprint.** Every pattern gets a `fingerprint`: 14 hex digits computed from its
  size, its cells and its DMC codes. The same image with the same settings always gives the
  same pattern (generation is deterministic), so it gives the same fingerprint. A different
  image or different settings give a different one. `add-progress-file` will reuse it to
  check that a `.stitch` file belongs to the loaded picture.
- **Saving.** The marks are saved in the browser's IndexedDB, all on the device:
  - 500 ms after the last toggle, and at once when the page is hidden (tab switch, phone lock);
  - together with the fingerprint, the counts and the image's file name.

  The browser keeps **one** saved progress. Unmarking every stitch deletes it.
- **Restoring.** When a pattern is generated whose fingerprint equals the saved one, its marks
  come back. This happens, for example, after a reload when the same photo is loaded with the
  same settings. A short note under the counter says `Restored your saved progress.`
- **Replacing someone else's progress.** If the saved progress belongs to another pattern, the
  first mark on the current pattern first asks:
  `Start a new progress? This browser keeps one progress: the saved one for cat.png (12 of 6,700 stitches) will be replaced.`
  The buttons are `Keep my progress` and `Start new progress`. Keeping marks nothing.
- **Confirmed losses are final.** Confirming the existing "settings change" or "new image"
  warning also deletes the saved progress, so it cannot come back unexpectedly later.
- **No storage.** If IndexedDB is missing, blocked or full, the note reads:
  `Your marks cannot be saved in this browser; they last until you close the page.` Marking
  keeps working.
- User-visible: the progress survives reloads, plus one new question and one note line on the
  Progress layer.

### Out of scope

- The `.stitch` file, and a "Save progress first" button in the dialogs: `add-progress-file`.
- More than one saved progress (a list of projects) and syncing between devices or tabs. With
  two tabs open, the last write wins.
- Remembering the settings or the image itself across reloads. The user loads the photo again
  and keeps the same settings; the defaults are the same on every load.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pattern-model`: a new requirement for the pattern fingerprint.
- `stitch-progress`: saving in the browser, restoring by fingerprint, one saved progress with a
  replacement question, deleting on confirmed loss, and the storage note. "The Progress layer
  starts as the Chart" changes: a new pattern starts with its saved marks when there are any.

## Impact

- `src/core/pattern.js`: `buildPattern` adds `fingerprint`. Patterns from the worker carry it,
  and the hash is computed in the worker for generated patterns.
- `src/core/progress.js`:
  - `toSavedProgress(progress, imageName, savedAt)` and `restoreProgress(pattern, saved)`,
    pure and validating;
  - the replacement and restore texts.
- New `src/io/progress-store.js`: IndexedDB load, save and clear, with Promises.
- New `src/ui/progress-persistence.js`: debounced saving, restoring, the note, the replacement
  question.
- `src/ui/progress.js`: `toggleAt` can ask first.
- `src/ui/progress-warning.js`: confirmed losses delete the saved progress.
- `index.html`: the note output.
- No new dependencies, no network: IndexedDB is local to the browser.
