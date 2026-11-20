# Proposal

## Why

The browser keeps one saved progress, on one device. Clearing site data, changing devices or
starting a second project loses weeks of marks. The user needs a file they can keep, copy and
load back.

## What Changes

- **Export menu.** The shared `Export` menu gets `Save progress (.stitch)` (enabled with a
  pattern and at least one mark; downloads `cat.stitch` for `cat.png`) and
  `Load progress (.stitch)` (enabled with a pattern while none is being generated).
- **The `.stitch` file.** Binary: magic `STITCH`, format version, size, pattern fingerprint and
  the stitched bits (the browser's layout) compressed with built-in deflate. Nothing is uploaded.
- **Loading.** A file of the loaded pattern (same fingerprint and size) becomes the current
  progress. The view switches to `Progress`, a note reads `Loaded your progress from cat.stitch.`,
  and the browser saves it at once.
- **Errors.** A file of another picture or other settings, a foreign, newer or damaged file
  shows an error naming the file in the status line. Nothing changes.
- **Asking first.** Loading over marks asks with the existing dialog (`Keep my progress` /
  `Load progress`). With no marks, if it would replace the browser's saved progress of another
  picture, it asks the same question as the first mark.
- **Save progress first.** All four warning dialogs get a third button. It downloads the
  progress at risk as `.stitch` and keeps the dialog open with `Saved cat.stitch.`

User-visible: two menu items, a new question, a third dialog button, a note, error texts.

### Out of scope

- The PDF and Excel items (`add-pdf-export`, `add-excel-export`).
- Several saved projects, merging files, undoing a load.
- Storing the image or settings in the file: the user loads the same photo with the same
  settings first, and the fingerprint proves it.
- Other programs' files.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `stitch-progress`: saving and loading `.stitch` files, the format, the checks on load, the
  question before loading over marks, and `Save progress first` in the existing dialogs.

## Impact

- New `src/core/progress-file.js`: encode/decode with `CompressionStream`/`DecompressionStream`
  and the texts (pure, unit-tested).
- New `src/core/file-names.js`, `src/io/download.js`, Export menu markup and CSS: exactly as in
  the shared conventions of the three parallel export changes.
- New `src/io/progress-file.js` (Blob and File glue), `src/ui/progress-file.js` (menu items,
  load flow, saver).
- Changed: `src/ui/progress-warning.js`, `src/ui/progress-persistence.js`, `src/main.js`,
  `index.html`, `styles/main.css`, `styles/print.css`.
- No dependencies, no network.
