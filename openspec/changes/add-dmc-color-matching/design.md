# Design

## Context

Greenfield: there is no `src/` yet. See `proposal.md` for motivation and `specs/dmc-color-matching/spec.md`
for the required behavior. Two sibling changes run in parallel: `add-app-shell` (UI) and
`add-pattern-model`. Types are not annotated anywhere in the project (no `@ts-check`,
no typedefs); exported functions get plain-text comments and correctness comes from tests. The consumers of this change are
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
| `src/data/dmc.js` | data | nothing at runtime | Generated, committed; header describes the DMC color shape and provenance. Exceeds the ~300-line guideline; accepted for a generated data table. |
| `src/core/color.js` | core | nothing | Conversions and ΔE00. |
| `src/core/dmc-match.js` | core | `./color.js` | Prepared palette and nearest-color search. |
| `scripts/import-dmc-palette.js` | dev tooling (Node) | `node:fs`, `node:crypto`, `node:url` | Never imported by the app. |

`core/` stays pure: no browser globals, timers, or I/O; functions do not mutate their arguments.
`dmc-match.js` does **not** import `src/data/dmc.js`: the caller passes the palette in. This keeps the
matcher testable with 2–3 color palettes, leaves room for future custom palettes, and avoids work
at import time. #4's core module will call `prepareLabPalette(DMC_COLORS)` once per generation run
(489 conversions, well under 1 ms) or once per worker.

### Data shapes (described in plain words, no type annotations)

Each shape is described once, in a comment next to the function that creates it; the spec is the
authoritative description.

| Shape | Fields | Created by (comment lives there) |
|---|---|---|
| sRGB color | `{ r, g, b }`, integers 0–255 | `hexToRgb` in `color.js` |
| Linear RGB color | `{ r, g, b }`, linear-light 0–1 | `color.js` module comment (built by #4 from `srgbToLinear`) |
| Lab color | `{ L, a, b }`, CIELAB with D65 white, L 0–100 | `rgbToLab` / `linearRgbToLab` in `color.js` |
| DMC color | `{ code, name, hex }`, all strings; code upper case, hex `#RRGGBB` upper case | header of `src/data/dmc.js` |
| Prepared palette | frozen array, palette order, of frozen `{ code, name, hex, lab }` | `prepareLabPalette` in `dmc-match.js` |
| Match result | `{ color, index, deltaE }`: prepared-palette color, its index, the ΔE00 | `nearestDmcColor` in `dmc-match.js` |

`Lab` uses `L` (capital) because that is the standard CIELAB notation. A prepared-palette color has
every field of a DMC color, so a match result's `color` can be used wherever a DMC color is expected
(e.g. building a legend in `add-pattern-model`, whose legend also uses upper-case hex).

### Public API

`src/core/color.js`:

| Function | Signature | Purpose |
|---|---|---|
| `hexToRgb` | `hexToRgb(hex)` → sRGB color | `#RRGGBB`, digits in either case; else `TypeError`. Used by #5. |
| `srgbToLinear` | `srgbToLinear(channel)` → number | 0–255 → 0–1; out of range → `RangeError`. #4 builds a 256-entry lookup table from it. |
| `linearToSrgb` | `linearToSrgb(value)` → number | 0–1 → unrounded 0–255; clamps; `NaN` → `RangeError`. |
| `rgbToLab` | `rgbToLab(rgb)` → Lab color | sRGB → linear → XYZ → Lab. |
| `linearRgbToLab` | `linearRgbToLab(linearRgb)` → Lab color | For #4's area-averaged cells, which are already linear. |
| `deltaE2000` | `deltaE2000(lab1, lab2)` → number | CIEDE2000, kL = kC = kH = 1. |

`src/core/dmc-match.js`:

| Function | Signature | Purpose |
|---|---|---|
| `prepareLabPalette` | `prepareLabPalette(colors)` → prepared palette | Validates (non-empty, unique codes, valid hex), computes Lab once, returns a frozen array. |
| `nearestDmcColor` | `nearestDmcColor(lab, palette)` → match result | Smallest ΔE00; ties → lowest index. |
| `nearestDmcColors` | `nearestDmcColors(labs, palette)` → array of match results | Same, for #4's list of cluster centres. |

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
- Exported pure functions: `convertSourceEntries(entries)` → DMC colors (validate, upper-case
  code, upper-case hex, drop `rgb`, check `rgb` agrees with hex) and
  `renderPaletteModule(colors, provenance)` → module source text.
  `readSourceColors(sourceFile)` takes the parsed source file (an object with `license`, `count`,
  `colors`), checks `license` is `CC-BY-4.0` and `count` equals the number of colors, and returns
  `colors`. The CLI part runs only when the file is
  executed directly.
- Header records: source repo URL, file path, commit SHA, SHA-256 of the source file, license
  CC-BY-4.0 with link and author attribution, upstream sources declared by the dataset, the list
  of transformations, and the regenerate command.
- Output: `export const DMC_COLORS = Object.freeze(ENTRIES.map((entry) => Object.freeze(entry)))`
  with one entry per line; strings are written with `JSON.stringify` so names with quotes stay valid.
- Hex is upper-cased (user decision, matching `add-pattern-model`'s legend) so the palette has
  one canonical form (string equality works in tests,
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
- [Object-per-call API allocates in #4's per-cell loop] → Acceptable for ~40 000 cells; #4 may add
  a typed-array variant if profiling shows a need.

## Migration Plan

None (new files only). Rollback is reverting the change's commits.
