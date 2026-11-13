# Design

## Context

Greenfield: there is no `src/` yet. See `proposal.md` for motivation and `specs/dmc-color-matching/spec.md`
for the required behavior. Two sibling changes run in parallel: `add-app-shell` (UI) and
`add-pattern-model`, which also creates `src/core/types.js`. The consumers of this change are
`add-pattern-generation` (#4: resize in linear RGB, k-means in Lab, map ~30 cluster centres to DMC)
and the layer-2 renderer (#5: draw cells in their DMC color).

## Goals / Non-Goals

**Goals:**

- A small, stable public API that #4 and #5 can use without further additions.
- Color math that is exact enough to reproduce published reference data, and readable.
- A palette import that a reviewer can re-run and verify.

**Non-Goals:**

- Typed-array batch variants of the color functions (add in #4 if profiling shows a need).
- Lab → RGB conversion, ΔE76, CIE94, or any other distance.
- Caching or memoising match results.

## Decisions

### Modules and layers

| File | Layer | Imports | Notes |
|---|---|---|---|
| `src/data/dmc.js` | data | nothing at runtime | Generated, committed. JSDoc imports `DmcColor` from `../core/types.js` (type only). Exceeds the ~300-line guideline; accepted for a generated data table. |
| `src/core/types.js` | core | nothing | Typedefs only, plus `export {}`. |
| `src/core/color.js` | core | nothing | Conversions and ΔE00. |
| `src/core/dmc-match.js` | core | `./color.js` | Prepared palette and nearest-color search. |
| `scripts/import-dmc-palette.js` | dev tooling (Node) | `node:fs`, `node:crypto`, `node:url` | Never imported by the app. |

`core/` stays pure: no browser globals, timers, or I/O; functions do not mutate their arguments.
`dmc-match.js` does **not** import `src/data/dmc.js`: the caller passes the palette in. This keeps the
matcher testable with 2–3 color palettes, leaves room for future custom palettes, and avoids work
at import time. #4's core module will call `prepareLabPalette(DMC_COLORS)` once per generation run
(489 conversions, well under 1 ms) or once per worker.

### Typedefs (`src/core/types.js`, own section)

```js
// ===== Color and DMC palette (add-dmc-color-matching) =====
/** sRGB color, integer channels 0–255. @typedef {{ r: number, g: number, b: number }} Rgb */
/** Linear-light RGB, channels 0–1. @typedef {{ r: number, g: number, b: number }} LinearRgb */
/** CIELAB, D65 white; L 0–100. @typedef {{ L: number, a: number, b: number }} Lab */
/** One DMC floss. @typedef {{ code: string, name: string, hex: string }} DmcColor */
/** A palette color with its precomputed Lab. @typedef {{ code: string, name: string, hex: string, lab: Lab }} LabPaletteColor */
/** Prepared palette, palette order kept. @typedef {readonly LabPaletteColor[]} LabPalette */
/** Result of a match. @typedef {{ color: LabPaletteColor, index: number, deltaE: number }} DmcMatch */
// ===== end color and DMC palette =====
```

The section markers make the hand merge with `add-pattern-model` (Pattern, LegendEntry) trivial.
`Lab` uses `L` (capital) because that is the standard CIELAB notation. `LabPaletteColor` is a
structural superset of `DmcColor`, so a match result can be used wherever a `DmcColor` is expected.

### Public API

`src/core/color.js`:

| Function | Signature | Purpose |
|---|---|---|
| `hexToRgb` | `(hex: string) => Rgb` | `#rrggbb`, either case; else `TypeError`. Used by #5. |
| `srgbToLinear` | `(channel: number) => number` | 0–255 → 0–1; out of range → `RangeError`. #4 builds a 256-entry lookup table from it. |
| `linearToSrgb` | `(value: number) => number` | 0–1 → unrounded 0–255; clamps; `NaN` → `RangeError`. |
| `rgbToLab` | `(rgb: Rgb) => Lab` | sRGB → linear → XYZ → Lab. |
| `linearRgbToLab` | `(rgb: LinearRgb) => Lab` | For #4's area-averaged cells, which are already linear. |
| `deltaE2000` | `(lab1: Lab, lab2: Lab) => number` | CIEDE2000, kL = kC = kH = 1. |

`src/core/dmc-match.js`:

| Function | Signature | Purpose |
|---|---|---|
| `prepareLabPalette` | `(colors: readonly DmcColor[]) => LabPalette` | Validates (non-empty, unique codes, valid hex), computes Lab once, returns a frozen array. |
| `nearestDmcColor` | `(lab: Lab, palette: LabPalette) => DmcMatch` | Smallest ΔE00; ties → lowest index. |
| `nearestDmcColors` | `(labs: readonly Lab[], palette: LabPalette) => DmcMatch[]` | Same, for #4's list of cluster centres. |

Input is validated at these public boundaries only; internal helpers (`linearRgbToXyz`,
`xyzToLab`, `assertLab`) are not exported.

### Conversion constants

- sRGB transfer function per IEC 61966-2-1 (threshold 0.04045 / 0.0031308, exponent 2.4).
- sRGB → XYZ matrix with 7 decimals (Lindbloom), D65 white `(0.95047, 1.00000, 1.08883)`.
  The rows sum to the white point, so white maps to `(100, 0, 0)` within 1e-4. The 4-decimal IEC
  matrix was rejected: it leaves white about 0.002 off neutral.
- CIE exact constants ε = 216/24389, κ = 24389/27 instead of the rounded 0.008856 / 903.3, which
  make the Lab `f()` function slightly discontinuous.
- The Lab reference values in tests come from one cited calculator that uses these same constants;
  the tolerance is 0.01 per component so the test does not depend on the last digit of the source.

### Color distance: CIEDE2000, brute force, no pre-filter

ΔE00 is required by the domain rules because it follows perceived difference far better than RGB
or ΔE76 distance, especially in blues and near-neutrals where DMC has many close shades. The
implementation follows Sharma et al. 2005, eq. 1–21, including the notes on hue: `atan2` in
degrees mapped to 0–360, hue 0 when a′ = b = 0, and the mean-hue/Δh′ rules when C′1·C′2 = 0.

Matching is a linear scan over all 489 colors: 30 centres × 489 ≈ 15 000 ΔE00 evaluations, a few
milliseconds. A ΔE76 pre-filter was rejected: the two metrics are not monotonic with each other,
so a top-K pre-filter can drop the true ΔE00 winner unless K is large, which removes the gain. If a
later change needs per-cell matching (e.g. dithering, ~40 000 cells), it can add a cache or a
pre-filter then.

### Deterministic tie-breaking

The scan runs in palette order and replaces the best match only on a strictly smaller ΔE00, so the
lowest index wins exact ties. Exact ties happen when two palette entries share a hex value, which
approximate DMC tables do contain. Palette order is the pinned source order, so results are
reproducible.

### Palette import: committed script, offline

A committed script (`scripts/import-dmc-palette.js`) was chosen over a documented manual
transformation: the transformation is executable, unit-testable with small inline fixtures, and
re-runnable by a reviewer. It is not a build step: it runs once by hand and its output is
committed; the app never runs it.

- Usage: `node scripts/import-dmc-palette.js <path-to-dmc-floss.json> <commit-sha>` writes
  `src/data/dmc.js`.
- The script does no network I/O. The developer first resolves the commit with
  `git ls-remote https://github.com/makebead/craft-color-codes HEAD` and downloads
  `https://raw.githubusercontent.com/makebead/craft-color-codes/<sha>/data/json/dmc-floss.json`
  into a new empty temp directory outside the repo. Tests therefore never touch the network.
- Exported pure functions: `convertSourceEntries(entries) => DmcColor[]` (validate, upper-case
  code, lower-case hex, drop `rgb`, check `rgb` agrees with hex) and
  `renderPaletteModule(colors, provenance) => string`. The CLI part runs only when the file is
  executed directly.
- Header records: source repo URL, file path, commit SHA, SHA-256 of the source file, license
  CC-BY-4.0 with link and author attribution, upstream sources declared by the dataset, the list
  of transformations, and the regenerate command.
- Output: `export const DMC_COLORS = Object.freeze(ENTRIES.map((entry) => Object.freeze(entry)))`
  with one entry per line; strings are written with `JSON.stringify` so names with quotes stay valid.
- Hex is lower-cased so the palette has one canonical form (string equality works in tests,
  legends, and JSON export). This changes notation, not value.

### Tests

| File | Covers |
|---|---|
| `tests/unit/core/color.test.js` | hex, channel conversions, Lab references, all 34 Sharma pairs (cited) |
| `tests/unit/core/dmc-match.test.js` | prepare/validate, nearest, ties, batch, with 2–3 color palettes |
| `tests/unit/data/dmc.test.js` | palette invariants and header provenance (mirrors `src/data/`) |
| `tests/integration/import-dmc-palette.test.js` | conversion and rendering with inline fixtures; render → import via `data:` URL round trip |
| `tests/integration/dmc-palette-matching.test.js` | real palette + color + matcher (310, every color maps to itself, 30-centre batch) |

## Risks / Trade-offs

- [Pinned source has a different entry count than 489, a duplicate code, or `rgb`/hex
  disagreement] → The script fails loudly; apply stops and asks the user. No value is edited by hand.
- [Upper-casing changes codes other than `Blanc`/`Ecru`] → The script prints every code it
  changed; apply reports the list to the user.
- [DMC hex values are approximations] → Accepted (domain rule); provenance is recorded so the
  source can be swapped in a later change.
- [CC-BY-4.0 requires attribution] → Header in the shipped data file. An in-app credit is left to
  a later UI change.
- [`src/core/types.js` conflicts with `add-pattern-model`] → Separate marked section; merge by hand
  on rebase.
- [Object-per-call API allocates in #4's per-cell loop] → Acceptable for ~40 000 cells; #4 may add
  a typed-array variant if profiling shows a need.

## Migration Plan

None (new files only). Rollback is reverting the change's commits.
