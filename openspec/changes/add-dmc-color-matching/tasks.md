# Tasks

## 1. Color math (`src/core/color.js`)

- [x] 1.1 Write failing tests in `tests/unit/core/color.test.js` for `hexToRgb`: `'#ff8000'` and `'#FF8000'` → `{ r: 255, g: 128, b: 0 }`; `'#fff'`, `'ff8000'`, `'#gg0000'`, `42` → `TypeError` with the value in the message; verify they fail with `npm run test:unit`
- [x] 1.2 Implement `hexToRgb` in `src/core/color.js`; verify the 1.1 tests pass
- [x] 1.3 Write failing tests for `srgbToLinear` / `linearToSrgb`: channels 0, 10, 128, 255 → 0, 0.0030353, 0.2158605, 1 (±1e-6); round trip of all 0..255 within 1e-6; linear 1.0000001 → 255 and -0.0000001 → 0; `RangeError` for sRGB 256, -1, `NaN` and linear `NaN`; verify they fail
- [x] 1.4 Implement `srgbToLinear` and `linearToSrgb` (IEC 61966-2-1, cite in a comment); verify the 1.3 tests pass
- [x] 1.5 Write failing tests for `rgbToLab` and `linearRgbToLab`: white, black, red, green, blue, grey 128 against reference values taken from one cited source that uses D65 and the design's constants (cite it in the test file; ±0.01); linear grey 0.2158605 equals Lab of sRGB grey 128 (±1e-4); `RangeError` for `(300, 0, 0)`; verify they fail
- [x] 1.6 Implement `rgbToLab` and `linearRgbToLab` with internal `linearRgbToXyz` / `xyzToLab` (Lindbloom matrix, D65 white, ε = 216/24389, κ = 24389/27); verify the 1.5 tests pass
- [x] 1.7 Write failing tests for `deltaE2000`: all 34 pairs of Sharma, Wu & Dalal (2005) copied from the published dataset (download `ciede2000testdata.txt` from the authors' page at development time; cite the paper and URL in the test file, do not type values from memory) within 1e-4; identity = 0; symmetry for `(50, 2.5, 0)` / `(73, 25, -18)` = 27.1492; `TypeError` for `{ L: NaN, a: 0, b: 0 }` and `{ L: 50, a: 0 }`; verify they fail
- [x] 1.8 Implement `deltaE2000` (Sharma et al. 2005, eq. 1–21, cited) with input validation; verify all `tests/unit/core/color.test.js` tests pass

## 2. Matching (`src/core/dmc-match.js`)

- [x] 2.1 Write failing tests in `tests/unit/core/dmc-match.test.js` for `prepareLabPalette`: a 2-color test palette keeps order and gets Lab values equal to `rgbToLab(hexToRgb(hex))`; result is frozen; input array and entries are not mutated; empty palette → `RangeError`; two entries coded `'A'` → `Error` containing `A`; hex `'#12345'` → `TypeError`; verify they fail
- [x] 2.2 Implement `prepareLabPalette`; verify the 2.1 tests pass
- [x] 2.3 Write failing tests for `nearestDmcColor`: palette K `#000000` / W `#FFFFFF` → sRGB `(30,30,30)` gives `K` with ΔE00 6.7765 (±1e-3) and `(200,200,200)` gives `W` with 12.1161 (±1e-3); result has `color`, `index`, `deltaE`; tie palette X/Y `#808080` gives `X`, index 0, on 100 repeated calls; Lab input not mutated; `TypeError` for non-finite Lab; verify they fail
- [ ] 2.4 Implement `nearestDmcColor` (linear scan, strict `<` so the lowest index wins ties); verify the 2.3 tests pass
- [ ] 2.5 Write failing tests for `nearestDmcColors`: 3 inputs give 3 results in input order, each deep-equal to `nearestDmcColor` of that input; empty list → `[]`; verify they fail
- [ ] 2.6 Implement `nearestDmcColors`; verify all `tests/unit/core/dmc-match.test.js` tests pass

## 3. Palette import script (`scripts/import-dmc-palette.js`)

- [ ] 3.1 Write failing tests in `tests/integration/import-dmc-palette.test.js` for `convertSourceEntries` with inline fixtures: `Blanc` → `BLANC`, `Ecru` → `ECRU`, `B5200` and `3865` unchanged, hex upper-cased (`#ffffff` → `#FFFFFF`), `rgb` dropped, order kept; errors naming the entry for `rgb` `[0,0,1]` vs `#000000` on `310`, duplicate `Blanc`/`BLANC`, hex `#00000`, empty name; verify they fail with `npm run test:integration`
- [ ] 3.2 Implement `convertSourceEntries` (pure, exported); verify the 3.1 tests pass
- [ ] 3.3 Write failing tests for `renderPaletteModule`: output starts with a header comment that contains the repo URL, file path, a given 40-character SHA, a given SHA-256, `CC-BY-4.0`, the transformation list and the regenerate command; importing the output through a `data:text/javascript` URL yields `DMC_COLORS` deep-equal to the input and frozen (array and entries); a name containing `'` and `"` survives; verify they fail
- [ ] 3.4 Implement `renderPaletteModule` and the CLI entry (`node scripts/import-dmc-palette.js <source.json> <commit-sha>`: reads the file, hashes it, converts, writes `src/data/dmc.js`, prints every code changed by upper-casing; writes nothing on error); verify the 3.3 tests pass and running with a missing file exits non-zero without creating `src/data/dmc.js`

## 4. DMC palette data (`src/data/dmc.js`)

- [ ] 4.1 Write failing tests in `tests/unit/data/dmc.test.js`: 489 entries, 489 distinct string codes, every hex matches `/^#[0-9A-F]{6}$/`, exactly one `'310'` with `'#000000'`, `'BLANC'`, `'ECRU'`, `'B5200'`, `'3865'` present, no lower-case letter in any code, only keys `code`/`name`/`hex`, non-empty names, strict-mode assignment and `push` throw `TypeError`, file header contains the provenance items from the spec; verify they fail with `npm run test:unit`
- [ ] 4.2 Resolve the commit with `git ls-remote https://github.com/makebead/craft-color-codes HEAD`, download `https://raw.githubusercontent.com/makebead/craft-color-codes/<sha>/data/json/dmc-floss.json` into a new empty temp directory outside the repo, run the import script on it, and report the changed-code list; STOP and ask the user if the script fails or the count is not 489; verify the 4.1 tests pass
- [ ] 4.3 Re-run the import script on the same downloaded file and verify `git diff --exit-code src/data/dmc.js` reports no change and the file's SHA-256 matches the header

## 5. Integration of palette and matching

- [ ] 5.1 Write `tests/integration/dmc-palette-matching.test.js` using the real `DMC_COLORS`: prepared palette has 489 colors in palette order and `'310'` has Lab `(0, 0, 0)` ±0.01; Lab of `#000000` matches `'310'` with ΔE00 < 1e-9; every one of the 489 hex values matches an entry with the same hex, ΔE00 < 1e-9, at its own index or an earlier one with identical hex; 30 Lab inputs (fixed list in the test) give 30 results equal to single matches; `src/core/color.js` and `src/core/dmc-match.js` contain no `window`, `document`, `self`, `fetch`, `localStorage`, or `setTimeout` and import only relative core paths; verify it passes with `npm run test:integration`

## 6. Verification

- [ ] 6.1 Run `npm run test:unit` and verify all unit tests pass
- [ ] 6.2 Run `npm run test:integration` and verify all integration tests pass
- [ ] 6.3 Run `openspec validate add-dmc-color-matching --strict` and verify it passes

No browser smoke check: this change adds no UI or io code.
