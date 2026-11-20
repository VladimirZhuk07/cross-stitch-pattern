# Design

## Context

- `state.progress` is a **Progress**: `{ pattern, bits, stitchedCount, totalCount, version,
  lastToggled }`, bits row-major with the least significant bit first (`src/core/progress.js`).
  `src/ui/progress.js` owns it and creates a fresh one for every new pattern. Toggles come from
  `toggleAt` and `toggleCentre`. `createProgressGuard` in `progress-warning.js` asks before
  settings or image changes.
- Patterns come from `buildPattern` (`src/core/pattern.js`). For generated patterns that runs
  inside the worker (`pattern-generator.js`), and the result is posted with its cell buffer
  transferred. Generation is deterministic.
- `state.image.fileName` holds the image name. The browser APIs live in `src/io/`, and `core/`
  stays pure.
- Bits reach 12.5 MB (10000 × 10000), which IndexedDB stores without trouble. `localStorage`
  (about 5 MB, strings only) cannot, and the rules keep it for small preferences.

## Goals / Non-Goals

**Goals:**
- Restore exactly the marks of the same pattern, and never apply marks to a different pattern.
- Everything that can be decided purely (hash, record checks, texts) lives in `core/` with unit
  tests. IndexedDB stays a thin `io/` adapter.

**Non-Goals:**
- Several saved projects, or merging across tabs.

## Decisions

### D1. Fingerprint in `buildPattern` (core)

`buildPattern` adds `fingerprint: string` to the Pattern. The hash is **cyrb53**, a public-domain
53-bit hash over 32-bit inputs using `Math.imul`. It is fed:
- a format tag `1`;
- width and height;
- every cell value (legend index or −1), in row order;
- for each legend entry in number order, the code's character codes followed by a separator 0.

The result is the 53-bit value as 14 lowercase hex digits, zero-padded.

- **Where it runs.** `buildPattern` runs in the worker for generated patterns, so even
  100 million cells (about 0.3 s) cost nothing on the main thread. It is a single pass next to
  the existing stitch counting.
- **Why only codes and cells.** Names and hex colors follow from the code (the palette data),
  and stitch counts follow from the cells. Hashing them would add nothing.
- *Alternatives:*
  - SHA-256 via `crypto.subtle`: rejected, because it is async and unavailable in `core/`
    (no browser APIs).
  - A 32-bit FNV hash: rejected, because collisions are too likely over years of use (about
    1 in 77k at 1,000 patterns).

The `pattern-model` Pattern shape comment documents the new field.

### D2. The saved record (core, `progress.js`)

**SavedProgress**, created by `toSavedProgress(progress, imageName, savedAt)`:

```
{ formatVersion: 1, fingerprint, width, height, bits (a Uint8Array copy),
  stitchedCount, totalCount, imageName, savedAt (ms since epoch) }
```

- `restoreProgress(pattern, saved)` returns a Progress, or `null`. It returns `null` when:
  - `saved` is not an object;
  - `formatVersion` is not 1;
  - the fingerprint, width or height differ from the pattern;
  - `bits` is not a Uint8Array of the right length.

  Otherwise it copies the bits, clears every bit of an empty cell and every padding bit, and
  recounts `stitchedCount`. The result has `version` 0 and `lastToggled` null, like a fresh
  Progress. So a damaged or foreign record can never mark wrong cells or claim wrong counts.
- `isSavedProgressOf(saved, pattern)` is a cheap fingerprint check used before asking.
- Texts: `formatReplaceWarning(imageName, stitched, total)`, and the constants
  `RESTORED_NOTE` and `UNSAVED_NOTE` with the spec's sentences.

### D3. IndexedDB adapter (io, `src/io/progress-store.js`)

`openProgressStore(indexedDBFactory = globalThis.indexedDB)` resolves to
`{ load(), save(record), clear() }`, each a Promise:
- the database is `cross-stitch-pattern-maker`, version 1, with one object store `progress`
  and the fixed key `current`;
- `load` resolves to the record or `null`;
- `save` resolves after the transaction completes;
- `clear` deletes the key.

The factory is missing in some private modes, and `open` rejects when storage is blocked. In
both cases `openProgressStore` rejects and the UI shows the note. It is not unit-tested (no
IndexedDB in Node, and no packages may be added). The browser smoke check covers it, including
a blocked case, by stubbing `indexedDB.open` in DevTools.

### D4. Saving, restoring, asking (ui, `src/ui/progress-persistence.js`)

`setupProgressPersistence(root, store, storePromise, warning)` (the dialog of
`createProgressWarning`, for the replace question) keeps:
- `saved`: what is in storage (from the first `load`, then after every save or clear);
- `isUnavailable`.

It returns `{ confirmFirstMark(), discard() }`, which `main.js` passes to `setupProgress` and to
`createProgressGuard`. Its parts:

- **Restore.** On every new non-null `state.pattern` it awaits the store, then loads. If
  `restoreProgress(pattern, saved)` is not null, it is applied, provided the state still has
  that pattern and the user has not marked anything meanwhile. The note shows `RESTORED_NOTE`
  until the next progress version.
- **Save.** On a `state.progress` change caused by a toggle (`version > 0`), a 500 ms timer is
  restarted.
  - When it fires: with `stitchedCount > 0` it calls
    `save(toSavedProgress(progress, state.image.fileName, Date.now()))`;
    with 0, and the saved record being this pattern's, it calls `clear()`.
  - `visibilitychange` to `hidden` and `pagehide` flush the timer at once. IndexedDB writes
    started then usually complete; a lost last mark is the accepted worst case.
- **Ask before replacing.** `confirmFirstMark()` resolves true at once in these cases:
  - the current progress already has marks;
  - nothing with stitches is saved;
  - the saved record is this pattern's;
  - this pattern was already approved.

  Otherwise it asks through the warning dialog (`formatReplaceWarning`, confirm label
  `Start new progress`) and remembers a yes for this pattern.
- **Discard.** `discard()` cancels the timer and calls `clear()`. `createProgressGuard` calls it
  after the user confirms the settings or image warning.
- **Failure.** Any rejection of open, save or clear sets `isUnavailable` and shows `UNSAVED_NOTE`
  once in `[data-role="progress-note"]`. Further saves are skipped while unavailable, and errors
  are logged with `console.error` once, as genuinely unexpected.

`progress.js` changes `toggleAt(point)`: before toggling a cell while the progress has no
marks, it awaits `confirmFirstMark()`, then re-checks that pattern and progress are unchanged.

### D5. The note (markup, CSS)

There is one `<output class="progress-note" data-role="progress-note" aria-live="polite" hidden>`
after the counter. It is shown only on the Progress layer and when it has text. It uses the
muted color, and the error color for `UNSAVED_NOTE`.

## Risks / Trade-offs

- [Two tabs on the same pattern overwrite each other] → Out of scope. The last write wins, as
  stated in the proposal.
- [A crash within 500 ms of a mark loses that mark] → The page-hidden flush covers tab switches
  and phone locks. A real crash loses at most half a second of marks.
- [12.5 MB written on every save for the largest patterns] → It is debounced, so a burst of
  taps writes once. A structured clone of a Uint8Array is a fast copy.
- [Fingerprint collision between two different patterns] → 53 bits. With a single saved slot
  the chance is negligible, and the dimensions are checked too.
- [Settings are not remembered, so after a reload the user must enter the same width again] →
  Stated as out of scope. The defaults restore automatically. A later change could remember
  the settings.

## Migration Plan

Nothing is stored before this change. The record carries `formatVersion: 1`, so a later format
can be told apart and ignored (restore returns `null`).
