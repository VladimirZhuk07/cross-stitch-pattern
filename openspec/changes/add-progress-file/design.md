# Design

## Context

- `state.progress` is a **Progress** (`src/core/progress.js`): `bits` is a `Uint8Array` of
  `ceil(width × height / 8)` bytes, cell `i` = bit `i & 7` (least significant first) of byte
  `i >> 3`, padding bits 0. `toSavedProgress` makes a **SavedProgress**
  `{ formatVersion: 1, fingerprint, width, height, bits, stitchedCount, totalCount, imageName, savedAt }`.
  `restoreProgress(pattern, saved)` checks fingerprint and size, clears bits of empty cells and
  padding bits, and recounts.
- `pattern.fingerprint` is 14 lowercase hex digits (cyrb53, `src/core/pattern.js`). The largest
  pattern is `MAX_GRID_SIDE`² = 100 million cells, so 12.5 MB of bits.
- `src/ui/progress-persistence.js` holds `saved` (what IndexedDB has), writes `state.progress`
  when it restores, shows the note `[data-role="progress-note"]`, and saves only after toggles
  (`version > 0`, same pattern). `confirmFirstMark()` asks the replace question. `discard()` deletes.
- `src/ui/progress-warning.js`: `createProgressWarning(root).confirm({ text, confirmLabel })`
  drives the one `<dialog>`. `createProgressGuard(progress, warning, persistence)` asks before
  settings and image changes.
- While a pattern is generated, the old pattern stays in `state.pattern` (`pattern-generation.js`).
- `CompressionStream('deflate')` / `DecompressionStream` exist in all evergreen browsers
  (Safari 16.4+, Firefox 113+) and in Node 22, which the tests run on. A truncated stream or
  bytes after its end reject with a `TypeError`.
- The Export menu, `src/io/download.js`, `src/core/file-names.js` and `src/core/compression.js`
  come from the shared conventions of `add-progress-file`, `add-pdf-export` and
  `add-excel-export`. This change merges first and adds them byte for byte. `compression.js`
  provides `compressBytes(bytes, format)`, `decompressBytes(bytes, format, maxLength)` (rejects
  with `RangeError` once the output would exceed `maxLength`, with the platform's `TypeError` for
  damaged input) and `canCompress()`, for the formats `'deflate'` and `'deflate-raw'`.

## Goals / Non-Goals

**Goals:**
- One pure, unit-tested codec in `core/`. `io/` only turns bytes into a Blob or a `File` into
  bytes.
- A file can never mark cells of another pattern, and a bad file never changes anything.
- Reuse the existing dialog, note, saving and restore checks; no second code path for "apply
  saved bits".

**Non-Goals:**
- Byte-identical files across browsers (deflate output may differ by engine; only the inflated
  bits are specified).
- Running the codec in a worker (see Risks).

## Decisions

### D1. File layout (core, `src/core/progress-file.js`)

Little-endian, fixed 30-byte header, then the compressed bits:

| Offset | Bytes | Field |
|---|---|---|
| 0 | 6 | magic, ASCII `STITCH` (`53 54 49 54 43 48`) |
| 6 | 2 | format version, uint16, `PROGRESS_FILE_FORMAT = 1` |
| 8 | 4 | width in stitches, uint32 |
| 12 | 4 | height in stitches, uint32 |
| 16 | 14 | fingerprint, the 14 ASCII lowercase hex digits |
| 30 | rest | zlib deflate (RFC 1950) of the Progress bits, exactly `ceil(width × height / 8)` bytes inflated |

- **Magic.** It tells a `.stitch` file from a renamed photo or text file before anything is
  inflated.
- **Version.** It is placed right after the magic, so a later format can change everything
  after it. Version > 1 gives "newer version", version 0 "damaged".
- **Fingerprint as ASCII.** Keeping the 14 characters (rather than 7 packed bytes) compares
  directly with `pattern.fingerprint`, with no parsing. It costs 7 bytes.
- **Width and height** are checked separately from the fingerprint. The size alone names the
  mismatch in the error (`It is for a 120 × 80 pattern; this one is 100 × 67.`), and it fixes
  the inflated length before inflating.
- **No counts, image name or time.** Counts are recounted on load anyway. The name would leak a
  file name into a shared file, and the image is identified by the fingerprint.
- **`deflate` (zlib).** Its Adler-32 checksum detects damaged data for free. *Alternatives:*
  - `deflate-raw`: no checksum.
  - `gzip`: a larger header and CRC-32, no benefit.
  - Our own run-length code: more code to test, and worse on scattered marks.

  Sparse progress compresses to a few hundred bytes. The worst case (random marks) is about the
  raw size, 12.5 MB.
- `MAX_PROGRESS_FILE_BYTES = 16 * 1024 * 1024`. The largest valid file is 30 + 12,500,000 + the
  deflate overhead (zlib's compressBound: about 3.8 kB), well below. Bigger files are refused
  before they are read.

### D2. Codec API (core, pure)

`src/core/progress-file.js` imports only `./progress.js`, `./stitch-grid.js` (`MAX_GRID_SIDE`)
and the shared `./compression.js`. It works on `Uint8Array` and `DataView` and has no stream code
of its own. The compression streams behind `compression.js` are platform-neutral globals in
browsers, workers and Node; there is no DOM, storage, network or timer. The codec stays async
only because `compressBytes`/`decompressBytes` are.

- `encodeProgressFile(saved)` returns a Promise of a Uint8Array. `saved` is a SavedProgress, or
  any `{ fingerprint, width, height, bits }`. Encoding a SavedProgress lets one function also
  save the IndexedDB record of another picture (D5). It writes the header and appends
  `await compressBytes(bits, 'deflate')`. It throws:
  - `TypeError` for a fingerprint that is not 14 hex digits or bits that are not a Uint8Array;
  - `RangeError` for a width or height outside 1–`MAX_GRID_SIDE` or a wrong bits length.
- `decodeProgressFile(bytes, pattern)` returns a Promise of a fresh Progress (`version` 0) or
  rejects with a `ProgressFileError`. It checks the cheap things first, in this order:
  1. too short, too long or wrong magic → `'not-progress-file'`;
  2. the version → `'newer-version'` or `'damaged'`;
  3. width, height, fingerprint → `'other-pattern'` (the error carries `fileWidth`,
     `fileHeight`);
  4. `decompressBytes(bytes.subarray(30), 'deflate', expectedLength)`, where `expectedLength` is
     `ceil(width × height / 8)`. The shared module stops as soon as the output would be longer, so
     a "zip bomb" never fills memory. Its `RangeError` (too long), the platform's `TypeError`
     (truncated, trailing bytes, wrong checksum) and a result shorter than `expectedLength` all
     become `'damaged'`.

  Then it calls `restoreProgress(pattern, { formatVersion: SAVED_PROGRESS_FORMAT, fingerprint,
  width, height, bits })`. That reuses the clearing of empty cells and padding bits and the
  recount, as specified for the browser storage.
- `class ProgressFileError extends Error` has `reason` (`'not-progress-file' | 'newer-version'
  | 'other-pattern' | 'damaged'`), `fileWidth` and `fileHeight` (null unless known). The
  precedent is `ImageDecodeError` in `io/image-loader.js`.
- Texts (pure functions next to the codec, file names kept literally):
  - `formatProgressFileError(fileName, error, pattern)` gives the spec's four sentences, or
    `Could not load NAME: an unexpected error occurred.` for any other error (a failed file
    read);
  - `formatLoadWarning(fileName, stitched, fileStitched, total)`;
  - `formatLoadedNote(fileName)`;
  - `formatSavedFileLine(fileName)`;
  - the constants `PROGRESS_FILE_EXTENSION = 'stitch'` and
    `SAVE_FAILED_TEXT = 'Could not save the progress file.'`.

### D3. Browser glue (io, `src/io/progress-file.js`)

- `downloadProgressFile(bytes, fileName, doc)` calls `downloadBlob(new Blob([bytes], { type:
  'application/octet-stream' }), fileName, doc)` from the shared `io/download.js`. There is no
  registered MIME type for `.stitch`.
- `readFileBytes(file)` returns `new Uint8Array(await file.arrayBuffer())`.
- It is not unit-tested (browser objects); the smoke check covers it.

### D4. The dialog's third button (ui, `progress-warning.js`, `index.html`)

- `confirm({ text, confirmLabel, saveFirst })`. `saveFirst` is optional: `() => Promise<fileName>`.
  Without it, `[data-action="save-progress-first"]` is hidden, so the module stays generic.
- When pressed:
  1. the button is disabled while the Promise runs (no double downloads);
  2. `[data-role="progress-warning-note"]` (a polite `<p>`) shows `Saved NAME.`, or
     `SAVE_FAILED_TEXT` with one `console.error`;
  3. the button is enabled again.

  The question is not answered and focus stays on the button. Each `confirm` clears the line,
  and a result that arrives after the dialog closed is ignored.
- **Why keep the dialog open** instead of "save and continue": the browser may show a Save-as
  prompt that the user cancels, and the page cannot know whether the download landed. The user
  decides after seeing the file.
- DOM order: `Keep my progress` (autofocus, unchanged), `Save progress first`, then the confirm
  button. The existing `.confirm-dialog__buttons` flex row wraps on phones. The line uses a new
  `.confirm-dialog__note` (muted, small).
- `createProgressGuard(progress, warning, persistence, saver = null)` passes
  `saveFirst: saver?.saveCurrent` with the settings and image questions.

### D5. The saver (ui, `src/ui/progress-file.js`)

`createProgressFileSaver(store, download)` (download = `downloadProgressFile`, injected for
tests) returns:
- `saveCurrent()`: encodes `toSavedProgress(state.progress, state.image.fileName, Date.now())`
  and downloads it as `exportFileName(state.image.fileName, PROGRESS_FILE_EXTENSION)`;
- `saveRecord(saved)`: the same for an IndexedDB record, named after `saved.imageName`
  (`dog.png` → `dog.stitch`, `''` → `pattern.stitch`).

Both resolve to the file name. `main.js` creates the saver in the progress group before
persistence and guard, because both need it.

### D6. How persistence learns about a loaded progress (ui, `progress-persistence.js`)

- `setupProgressPersistence(root, store, storePromise, warning, saver = null)` returns a third
  function, `adoptProgress(progress, fileName)`. It:
  1. cancels a pending save;
  2. sets `approvedPattern` to the progress's pattern (the browser slot is now this pattern's,
     so the next mark must not ask);
  3. writes `{ progress, activeLayer: 'progress' }` to the store;
  4. shows `formatLoadedNote(fileName)`, unless the unavailable note is showing;
  5. calls `saveNow()` at once. With 0 stitches this deletes this pattern's record, as unmarking
     does.
- The loaded note behaves like `RESTORED_NOTE`: cleared by the next toggle or a new pattern. The
  check `noteText === RESTORED_NOTE` becomes "any note but `UNSAVED_NOTE`".
- `confirmFirstMark()` passes `saveFirst: () => saver.saveRecord(saved)` with the replace question.
- *Alternatives:*
  - Give the loaded Progress `version: 1` so the toggle path saves it: rejected, because it
    abuses `version`, waits 500 ms and shows no note.
  - Let `progress.js` apply it: rejected, because persistence already writes `state.progress`
    for restores and owns the note and the slot.

### D7. Menu items and the load flow (ui, `setupProgressFileMenu`)

`setupProgressFileMenu(root, store, { saver, warning, persistence, readBytes })` is in the same
module.

**Enabling** (on every state change):
- `export-progress` is enabled while `state.pattern !== null` and `state.progress.stitchedCount > 0`;
- `progress-file-input` is enabled while `state.pattern !== null` and `state.generation.kind !== 'running'`.

The shared conventions say items are enabled "exactly while a pattern exists". For the save item
this change adds "and at least one mark", as the user suggested: a file without marks is never
useful.

**Save** (click): close the menu (`details.open = false`), then `saver.saveCurrent()`. A failure
shows `SAVE_FAILED_TEXT` in the status line.

**Load** (`change` on the input):
1. Take the file and reset `input.value` (the same file can be chosen again). Close the menu.
2. If `file.size > MAX_PROGRESS_FILE_BYTES`, give a `'not-progress-file'` error without reading.
3. `bytes = await readBytes(file)`, then `loaded = await decodeProgressFile(bytes, pattern)`.
   Any error → status `{ kind: 'error', text: formatProgressFileError(file.name, error, pattern) }`.
   The file is checked **before** any question, so an invalid file never asks.
4. If `state.pattern` changed meanwhile, stop.
5. Ask:
   - with marks: `warning.confirm({ text: formatLoadWarning(…), confirmLabel: 'Load progress',
     saveFirst: saver.saveCurrent })`;
   - without marks: `persistence.confirmFirstMark()`, which asks only when it would replace
     another picture's saved progress.

   No → stop.
6. If `state.progress` is no longer the one asked about, stop. Otherwise call
   `persistence.adoptProgress(loaded, file.name)`.

Status-line errors reuse `state.status` as `image-input.js` does. The status line is visible on
every layer; the progress note is only visible on Progress.

### D8. Markup, CSS, main.js

- `index.html`: the shared `<details class="export-menu">` block with only the
  `export-progress` button and the `Load progress` label, byte for byte, after the `<h1>`.
- `index.html` dialog: `<button type="button" class="confirm-dialog__button"
  data-action="save-progress-first">Save progress first</button>` between the two buttons, and
  `<p class="confirm-dialog__note" data-role="progress-warning-note" aria-live="polite" hidden></p>`
  after the text.
- `styles/main.css`: the shared Export-menu block verbatim, plus `.confirm-dialog__note`.
  `styles/print.css`: the shared `.export-menu { display: none; }` rule.
- `src/main.js`:
  - the progress group creates `progressFileSaver` and passes it to persistence and guard;
  - a new group at the end calls `setupProgressFileMenu`.
- `app-state.js`: the `progress` comment names `progress-persistence.js` as the second writer
  (restore and loaded files).

## Risks / Trade-offs

- [Decoding a 100-million-cell file runs `restoreProgress` on the main thread (about 0.3 s), and
  inflating 12.5 MB holds 2–3 copies in memory] → Same cost as the existing restore after a
  reload. Inflating itself is native and streamed. A worker would add a protocol for a rare,
  user-started action.
- [`CompressionStream` missing in old browsers (`canCompress()` false)] → Saving shows `Could not save the progress
  file.` and loading the unexpected-error text. Marking and IndexedDB saving keep working.
- [Different engines produce different compressed bytes] → Only the header and the inflated
  bits are specified and tested, never the compressed bytes.
- [The user loads a file into the wrong photo that happens to give the same pattern] → Equal
  fingerprint and size means equal cells and DMC codes, so the marks fit exactly; that is
  correct, not a risk.
- [Save stays disabled with 0 marks, with no tooltip explaining why] → Accepted. The shared
  menu markup is fixed, and the item enables with the first mark.
- [`Save progress first` cannot tell whether the browser really stored the file] → The line says
  `Saved NAME.` after the download started; the dialog stays open, so the user can check.

## Migration Plan

New file format, version 1. Nothing stored changes: IndexedDB records keep
`SAVED_PROGRESS_FORMAT` 1. A later file format bumps `PROGRESS_FILE_FORMAT`; this version then
reports "newer version" instead of guessing.

## Open Questions

None that block the tasks. The user-visible choices made here (save enabled only with marks,
switching to the Progress layer after a load, asking the replace question before a load with
no marks, keeping the dialog open after `Save progress first`) are listed for review.
