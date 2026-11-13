# Design: add-pattern-model

## Context

Greenfield: there is no `src/` yet. See proposal.md (Why) for the motivation and
`specs/pattern-model/spec.md` for the behavior. Three later changes are designed against this
contract in parallel: `add-pattern-generation` (#4, producer, runs in a Web Worker),
`add-dmc-preview-layer` (#5) and `add-stitch-chart-layer` (#6) (consumers on the main thread).
`add-dmc-color-matching` (#2) creates `src/core/types.js` in parallel with `Rgb`, `Lab`,
`DmcColor`.

## Goals / Non-Goals

**Goals:**
- One small, explicit data shape that is cheap to transfer and trivial to render from.
- All legend rules (counting, dropping, merging, numbering, limit) live in one place, so
  producer and consumers cannot disagree.
- No dependency on #2: the model treats a DMC code as an opaque string and carries name/hex
  itself.

**Non-Goals:**
- No mutation API (editing single stitches, recolouring). A new pattern is built instead.
- No `version` field in the in-memory `Pattern`; the JSON export change owns its file format
  and version (architecture.md: "Keep a `version` field in the format").
- No back-stitch, half stitches or multiple strands.

## Layers

| Module | Layer | Notes |
|---|---|---|
| `src/core/types.js` (pattern section) | core | typedefs only, `export {}` so it is a module |
| `src/core/pattern.js` | core | pure; imports nothing at runtime (only JSDoc `import()` types) |
| `tests/unit/core/pattern.test.js` | test | `node:test` + `node:assert/strict` |

`core/` stays pure: no DOM, `self`, timers or I/O; input and output are plain data. Callers in
`workers/` (#4) and `ui/` (#5, #6) import `pattern.js` directly.

## Data shapes (`src/core/types.js`)

Placed under a banner comment `// ---- Pattern model (add-pattern-model) ----` so the
hand-merge with #2's section is mechanical. Both changes need `export {};` once.

```js
/**
 * Input for buildPattern. Colors are structurally compatible with DmcColor from
 * add-dmc-color-matching, so palette entries can be passed as-is.
 * @typedef {object} PatternInput
 * @property {number} width  stitches per row, positive integer
 * @property {number} height rows, positive integer
 * @property {ArrayLike<number>} cells row-major, length width * height; each value is an
 *   index into `colors` or EMPTY_CELL (-1). Use a signed array (number[], Int16Array,
 *   Int32Array) so -1 is representable.
 * @property {ReadonlyArray<{ code: string, name: string, hex: string }>} colors
 *   may contain unused entries and several entries with the same DMC code
 */

/**
 * One row of the legend. `number` is what the chart prints in each cell.
 * @typedef {object} LegendEntry
 * @property {number} number      1..N, equals legend position + 1
 * @property {string} code        DMC code, e.g. '310', 'BLANC', 'B5200'
 * @property {string} name        DMC color name, e.g. 'Black'
 * @property {string} hex         '#RRGGBB', uppercase
 * @property {number} stitchCount cells using this color, >= 1
 */

/**
 * A finished cross-stitch pattern. Plain data: safe for structuredClone/postMessage;
 * transfer `cells.buffer` to avoid a copy.
 * @typedef {object} Pattern
 * @property {number} width
 * @property {number} height
 * @property {Int16Array} cells row-major, length width * height, owns its whole buffer;
 *   each value is a 0-based index into `legend` or EMPTY_CELL (-1)
 * @property {LegendEntry[]} legend ordered by number: most stitches first,
 *   ties by compareDmcCodes
 */

/**
 * @typedef {object} FinishedSize
 * @property {number} widthInches
 * @property {number} heightInches
 * @property {number} widthCm
 * @property {number} heightCm
 */
```

## Public API (`src/core/pattern.js`)

```js
export const EMPTY_CELL = -1;
export const MAX_PATTERN_COLORS = 99;
export const DEFAULT_FABRIC_COUNT = 14;
export const FABRIC_COUNTS = Object.freeze([11, 14, 16, 18]);

/** @param {PatternInput} input @returns {Pattern} */
export function buildPattern(input) {}

/** @param {string} a @param {string} b @returns {number} negative, 0 or positive */
export function compareDmcCodes(a, b) {}

/** @param {Pattern} pattern @param {number} x @param {number} y
 *  @returns {LegendEntry | null} null for an empty cell */
export function legendEntryAt(pattern, x, y) {}

/** @param {{ width: number, height: number }} size  a Pattern or target dimensions
 *  @param {number} [fabricCount=DEFAULT_FABRIC_COUNT] @returns {FinishedSize} */
export function finishedSize(size, fabricCount) {}
```

## Decisions

### Cells hold 0-based legend indices; empty is -1
`legend[cells[i]]` is the natural lookup for the color layer, and the chart prints
`cells[i] + 1`. One sentinel, `EMPTY_CELL = -1`, is used for both input and output, so
producer and consumers learn one convention.
- *Alternative:* store the 1-based number with 0 = empty in a `Uint8Array`. Prints directly,
  but every color lookup needs `- 1` and input and output would use different conventions.
- *Alternative:* `Uint16Array` with `0xFFFF` as empty. Unsigned, but a magic sentinel.

### `Int16Array` for cells
Signed (so -1 works), 2 bytes per cell (300 × 300 = 180 KB), transferable. The array is
created fresh by `buildPattern` so it owns its buffer; transferring it never ships unrelated
memory. `Int8Array` would suffice for 99 colors but leaves no headroom if the limit changes.

### Build algorithm
1. Validate width, height, cell count, colors (all entries, used or not).
2. One pass over cells: validate each value and count stitches per input color index
   (`Int32Array` of length `colors.length`).
3. Group used input colors by code; reject a code whose name or hex differ; sum counts.
4. Reject more than `MAX_PATTERN_COLORS` groups.
5. Sort groups by `stitchCount` descending, then `compareDmcCodes`; assign numbers 1..N.
6. Build a remap table input index → legend index and fill a new `Int16Array`.

Cost: O(cells + colors · log colors), two passes over the cells, no per-cell objects. Fast
enough for 90 000 cells on the main thread or in the worker.

### DMC code order for ties
Digit-only codes first, by numeric value (`310` < `3865`, not text order); then other codes
by ordinal string order (`B5200` < `BLANC` < `ECRU`); equal numeric value falls back to
ordinal order (`01` < `1`). Numbered threads are the large majority and are looked up by
number, so numeric order matches how stitchers scan a legend. Ordinal comparison (`<`) is
used instead of `localeCompare`/`Intl.Collator`, which can vary by browser locale and would
break determinism.

### Limit of 99 colors
Two digits fit legibly in one chart cell at print size; three do not. The model enforces the
hard limit so no consumer has to handle 3-digit numbers. The user-facing max-colors setting
(#4, domain default ~20–30) must stay ≤ 99.

### Validation and errors
`RangeError` for out-of-range numbers (size, cell count, indices, color limit, coordinates,
fabric count), `TypeError` for malformed color fields, `Error` for a code conflict. Messages
state the field and received value, e.g. `RangeError('cell 4 (x 1, y 1) has color index 3,
expected -1 or 0–2')`. Validation is at the public functions only.

### Hex normalised to uppercase
Duplicate detection compares hex case-insensitively, and consumers get one canonical form.

### `finishedSize` takes `{ width, height }`
A `Pattern` satisfies it, and settings UI can show the size of target dimensions before a
pattern exists. Any positive finite count is accepted (e.g. 28 ct evenweave over two);
`FABRIC_COUNTS` is the list offered in the UI. Returns raw numbers; rounding is a display
concern.

## Risks / Trade-offs

- [Parallel `types.js` creation with #2 causes a rebase conflict] → separate banner sections;
  the later change to rebase merges both and keeps one `export {}`.
- [A producer passes a `Uint8Array` and cannot express -1] → JSDoc states a signed array is
  required; validation rejects out-of-range indices, and a 255 would be reported clearly.
- [99 may be too low for photo-realistic charts] → single constant; raising it to 999 would
  only affect the chart's font sizing, the `Int16Array` already has room.
- [Consumers mutate `pattern.cells`] → documented as read-only; no defensive freezing
  (typed arrays cannot be frozen) to keep transfer cheap.

## Migration Plan

None: new code. Rollback = drop the branch.
