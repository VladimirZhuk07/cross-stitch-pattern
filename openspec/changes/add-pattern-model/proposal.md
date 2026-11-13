# Proposal: add-pattern-model

## Why

Pattern generation (#4) produces a pattern; the DMC preview layer (#5) and the stitch
chart layer (#6) consume it. They are built in parallel, so they need one small, explicit,
validated data contract now: the `Pattern` (grid + legend), with deterministic legend
numbers that the chart prints in every cell.

## What Changes

- New pure `core/` module that builds a `Pattern` from width, height, a per-cell color
  index (or a distinct "empty" marker for transparent cells) and the colors' DMC code, name
  and hex.
- While building: counts stitches per color, drops unused colors, merges colors sharing a
  DMC code, numbers the legend 1..N (most stitches first, ties by DMC code) and remaps cells
  to legend order.
- Clear errors for invalid input: bad size, wrong cell count, out-of-range indices,
  malformed colors, conflicting data for one DMC code, more than 99 colors (a cell number
  never needs more than 2 digits).
- The `Pattern` is plain data (numbers, strings, arrays, one `Int16Array`), so it can be
  cloned or transferred across a Web Worker boundary.
- Helpers for consumers: legend entry of cell (x, y); finished size in inches and cm for a
  fabric count (default 14 ct).
- JSDoc typedefs `PatternInput`, `LegendEntry`, `Pattern`, `FinishedSize` in their own
  section of `src/core/types.js`.
- Project rules switch from chart **symbols** to chart **numbers 1..N** (user decision) in
  `.claude/rules/domain.md`, `ui.md`, `architecture.md` and `CLAUDE.md`. Kept: the chart is
  readable without color; the legend shows number, DMC code, name, swatch, stitch count.

No user-visible behavior changes: this change adds no UI.

## Out of scope

- Color math and DMC palette data (`add-dmc-color-matching`).
- Resizing, quantization, mapping clusters to DMC, Web Workers (`add-pattern-generation`).
- Any rendering: color-block layer, stitch chart, legend UI (`add-dmc-preview-layer`,
  `add-stitch-chart-layer`).
- JSON export/import and its `version` field, printing, PNG export.
- The user-facing "max colors" setting; only the hard limit of 99 is enforced here.

## Capabilities

### New Capabilities

- `pattern-model`: the in-memory cross-stitch pattern: grid of legend indices with an
  empty marker, numbered legend with stitch counts, validation, cell lookup, finished size.

### Modified Capabilities

None (no existing specs).

## Impact

- New: `src/core/pattern.js`, `src/core/types.js` (pattern section),
  `tests/unit/core/pattern.test.js`.
- `src/core/types.js` is also created by `add-dmc-color-matching`; the sections are merged
  by hand on rebase.
- Contract for `add-pattern-generation`, `add-dmc-preview-layer`, `add-stitch-chart-layer`.
- No dependencies, no build step.
