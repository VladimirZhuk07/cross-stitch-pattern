# Domain: cross-stitch patterns and color

## Vocabulary

| Term | Meaning in this project |
|---|---|
| Stitch / cell | One square of the grid = one full cross stitch = one output "pixel" |
| Pattern (chart) | Grid of cells, each holding a palette index or "empty" |
| Palette / legend | The DMC colors actually used: number, code, name, hex, stitch count |
| Fabric count (ct) | Stitches per inch of fabric. Aida 14 ct is the default; also 11, 16, 18 |
| Floss / thread | DMC stranded cotton, identified by its code (`310`, `BLANC`, `3865`) |

## DMC palette data

- Stored in `src/data/dmc.js` as an array of `{ code: string, name: string, hex: string }`.
  Codes are strings (`'BLANC'`, `'ECRU'`, `'B5200'` are not numbers).
- DMC does not publish official RGB values; all tables are approximations. Use one
  documented source, record it in a comment at the top of the file, and **never invent or
  "guess" codes, names, or colors**. If a value is unknown, leave the entry out and say so.
- Precompute the Lab value of each palette color once, not on every match.

## Color science

- All color comparison happens in **CIELAB**, never by Euclidean RGB distance.
- Conversion: sRGB (0–255) → linear RGB (inverse sRGB gamma) → XYZ (D65) → CIELAB.
- Distance: **CIEDE2000 (ΔE00)** for matching to DMC. ΔE76 is allowed only as a fast
  pre-filter, and the final choice still uses ΔE00.
- Color math lives in `core/` with tests against published reference values
  (Sharma et al. CIEDE2000 test data).

## Pipeline rules

- **Resize first, then match.** Average source pixels into stitch cells (area averaging in
  linear RGB), then work with the small grid.
- **Color limit.** The user chooses a max number of colors (default ~20–30). Reduce colors
  (e.g. k-means or median cut in Lab), then map cluster centers to nearest DMC and merge
  clusters that land on the same DMC code.
- **Dithering** (Floyd–Steinberg) is optional and off by default — it creates many isolated
  single stitches ("confetti"), which are tedious to sew.
- **Transparency.** Cells whose average alpha is below a threshold are "empty" (no stitch).
  Empty is a distinct value, not white.
- Results must be **deterministic** for the same input and settings (seed any randomness,
  e.g. k-means initialization).

## Chart numbers

- Each legend color gets a number 1..N; the chart shows that number in every cell of the
  color.
- Number 1 is the color with the most stitches. Equal stitch counts are ordered by DMC code:
  digit-only codes by numeric value first (`310` before `3865`), then all other codes in
  ordinal string order (`B5200`, `BLANC`, `ECRU`). The order must not depend on the locale.
- At most as many colors as the DMC palette has (489); chart numbers are always sized for 3 digits.
- Chart cells are white with the number in black; never depend on color to read the chart.

## Physical size

- Size in inches = stitches / fabric count; centimeters = inches × 2.54.
- Always show the finished size for the chosen fabric count next to the stitch dimensions.

## Supported input

- Any image the browser decodes via `createImageBitmap` (JPG, PNG, WebP, GIF first frame,
  BMP, AVIF where supported). Show a clear error for unsupported/corrupt files.
- Guard against huge inputs: cap the decode size and tell the user when an image was downscaled.
