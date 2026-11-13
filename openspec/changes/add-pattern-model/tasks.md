# Tasks

## 1. DMC code order

- [x] 1.1 Write failing tests in `tests/unit/core/pattern.test.js` for `compareDmcCodes`: `'310' < '3865'`, `'3865' < 'B5200'`, `'B5200' < 'BLANC' < 'ECRU'`, `'01' < '1'`, equal codes return 0, sorting `['ECRU','3865','B5200','310','BLANC']` gives `['310','3865','B5200','BLANC','ECRU']`; verify `npm run test:unit` fails because the module is missing
- [x] 1.2 Create `src/core/pattern.js` with the exported constants (`EMPTY_CELL`, `MAX_PATTERN_COLORS`, `DEFAULT_FABRIC_COUNT`, `FABRIC_COUNTS`) and `compareDmcCodes` with its plain-text comment; verify the 1.1 tests pass

## 2. Building a pattern

- [x] 2.1 Write failing tests for size and cell-count validation (width 0, height 1.5, negative and non-number sizes, 5 cells for 3 × 2) with `assert.throws` checking `RangeError` and the values in the message; verify they fail
- [ ] 2.2 Implement `buildPattern` input checks for width, height and cell count; verify 2.1 passes
- [ ] 2.3 Write failing tests for color and cell validation: cell index 2 with 2 colors (message has position `1` and value `2`), cell `-2`, cell `0.5`, empty code, non-string name, hex `000000` (`TypeError` with `310` and `000000`); verify they fail
- [ ] 2.4 Implement color and cell-value validation; verify 2.3 passes
- [ ] 2.5 Write failing tests for the "Plain arrays and typed arrays are both accepted", "Grid layout of a 3 × 2 pattern", "Legend entry fields", "Counts exclude empty cells", "Unused BLANC is dropped", "Most stitches get number 1", "Ties ordered by DMC code", "Numeric codes compare by value", "Empty is not white", "Fully transparent image" and "Hex is normalised to uppercase" scenarios; verify they fail
- [ ] 2.6 Implement counting, dropping, sorting, numbering, hex normalisation and the remap into a new `Int16Array`; verify 2.5 passes
- [ ] 2.7 Write failing tests for "Two clusters land on DMC 310" and "Conflicting data for one code" (error message contains `310`, `#000000`, `#111111`); verify they fail
- [ ] 2.8 Implement grouping by DMC code with the conflict check; verify 2.7 passes
- [ ] 2.9 Write failing tests for the color limit: 99 distinct codes accepted (numbers 1–99), 100 rejected (`RangeError` with `100` and `99`), 120 input colors sharing 2 codes accepted; verify the 100-color test fails
- [ ] 2.10 Implement the `MAX_PATTERN_COLORS` check on the merged legend; verify 2.9 passes
- [ ] 2.11 Write tests for determinism, input color order independence, non-mutation of input `cells`/`colors`, and `structuredClone(pattern, { transfer: [pattern.cells.buffer] })` (deep-equal to a prior copy; buffer byte length 12, byte offset 0); fix `buildPattern` if any fails; verify all `pattern.test.js` tests pass
- [ ] 2.12 Add the plain-words description of PatternInput, LegendEntry and Pattern (fields, units, ranges, empty marker, cell order) at the top of `src/core/pattern.js` and a plain-text comment on `buildPattern` (what it does, parameter, returns, throws), matching design.md; no type annotations; verify by reading and `npm run test:unit` still passes

## 3. Consumer helpers

- [ ] 3.1 Write failing tests for `legendEntryAt`: (0, 0) of the 3 × 2 pattern returns entry number 2 code `321`, (0, 1) returns `null`, (3, 0), (-1, 0) and (0.5, 0) throw `RangeError`; verify they fail
- [ ] 3.2 Implement `legendEntryAt` with its plain-text comment; verify 3.1 passes
- [ ] 3.3 Write failing tests for `finishedSize`: 140 × 98 at 14 ct = `{ widthInches: 10, heightInches: 7, widthCm: 25.4, heightCm: 17.78 }` (tolerance 1e-9), 28 × 14 with default count = 2 × 1 in, 110 × 55 at 11 ct = 10 × 5 in / 25.4 × 12.7 cm, fabric count 0, -14, `NaN` and `Infinity` throw `RangeError`; verify they fail
- [ ] 3.4 Implement `finishedSize` with a named `INCHES_TO_CM = 2.54` constant, its plain-text comment and the FinishedSize description; verify 3.3 passes and `pattern.js` stays under ~300 lines with functions under ~40 lines

## 4. Project rules: numbers instead of symbols

- [ ] 4.1 In `.claude/rules/domain.md`, replace the "Symbols" section with "Chart numbers": each legend color gets a number 1..N (1 = most stitches, ties by DMC code: digit-only codes numerically, then others in ordinal order), at most 99 colors so numbers have ≤ 2 digits, cells are white with the number in black, never depend on color to read the chart; and change "symbol" to "number" in the vocabulary table; verify by reading the section
- [ ] 4.2 In `.claude/rules/ui.md`, replace "Two views: color blocks, and symbols" with the three layers (original image, DMC color blocks, number chart: white cells with the legend number, printable in black and white), change the legend accessibility line to "number, DMC code, name, swatch and stitch count", and "symbol chart" in the print rule to "number chart"; verify by reading the changed lines
- [ ] 4.3 In `.claude/rules/architecture.md` (pipeline step 4) and `CLAUDE.md` (intro), replace "symbol" with "number"/"numbered chart"; verify `grep -rni symbol CLAUDE.md .claude/rules` prints nothing and `grep -rniE "typedef|ts-check|types\.js" CLAUDE.md .claude/rules` shows only the "no type annotations" rule in `javascript.md`

## 5. Verification

- [ ] 5.1 Run `npm run test:unit`; all tests pass (show output)
- [ ] 5.2 Run `npm run test:integration`; it passes (this change adds no integration tests, expect 0 failures)
- [ ] 5.3 Run `openspec validate add-pattern-model --strict`; it reports the change is valid

No browser smoke check: this change touches no UI or io code.
