# Proposal

## Why

Later pipeline steps (k-means in Lab, mapping cluster centres to floss, rendering in DMC
colors) need two foundations that do not exist yet: a trustworthy DMC palette and perceptual
color math. Building them first as pure, tested `core/` + `data/` code gives the
pattern-generation and renderer changes a fixed API.

## What Changes

- Add `src/data/dmc.js`: the DMC floss palette (489 entries) imported once at development time
  from makebead/craft-color-codes (`data/json/dmc-floss.json`, CC-BY-4.0), pinned to one commit
  SHA, with source, commit, license, and the exact transformation recorded in a header comment.
  Codes are strings normalised to upper case (`Blanc` → `BLANC`), hex is `#RRGGBB`;
  names and colors are never invented or edited.
- Add `scripts/import-dmc-palette.js`: a zero-dependency Node script that converts the
  downloaded source file into `src/data/dmc.js`, so the import is reproducible. It is a
  one-off developer tool, not a build step.
- Add `src/core/color.js`: hex parsing, sRGB ↔ linear RGB, sRGB/linear RGB → XYZ (D65) →
  CIELAB, and CIEDE2000 (ΔE00), verified against Sharma, Wu & Dalal (2005) test data.
- Add `src/core/dmc-match.js`: precompute the palette's Lab values once, find the nearest DMC
  color for a Lab color by ΔE00 with deterministic tie-breaking, and match a list of colors
  in one call.
- Describe the shared data shapes (sRGB, linear RGB, Lab, DMC color, prepared palette, match
  result) in plain-text comments next to the functions that create them.

No user-visible behavior changes: nothing in this change is wired into the UI.

## Out of Scope

- Color reduction (k-means, median cut), resizing, dithering.
- Building a `Pattern` or `LegendEntry`, symbols, numbering (change `add-pattern-model`).
- Web Workers, UI, rendering, export.
- User-uploaded or custom palettes, subsets of the DMC palette, other thread brands.
- Converting Lab back to RGB, and a ΔE76 pre-filter (not needed at this palette size).
- An in-app attribution/credits screen for the palette source.

## Capabilities

### New Capabilities

- `dmc-color-matching`: the DMC floss palette data and how any color is converted to CIELAB,
  compared with CIEDE2000, and matched to the nearest DMC floss.

### Modified Capabilities

(none)

## Impact

- New files: `src/data/dmc.js`, `src/core/color.js`, `src/core/dmc-match.js`,
  `scripts/import-dmc-palette.js`, unit and integration tests.
- No dependencies, no build step, no runtime network access. The palette is downloaded once by
  a developer during apply; the app ships only the generated `src/data/dmc.js`.
- Consumers: `add-pattern-generation` (linear RGB helpers, `rgbToLab`/`linearRgbToLab`,
  `nearestDmcColors`) and the layer-2 renderer (`hexToRgb`).
