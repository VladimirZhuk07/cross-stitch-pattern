# Tasks

## 1. Typedefs

- [ ] 1.1 Create `src/core/types.js` with `// @ts-check`, a `// ---- Pattern model (add-pattern-model) ----` section containing the `PatternInput`, `LegendEntry`, `Pattern` and `FinishedSize` typedefs exactly as in design.md, and `export {};`; verify with `node -e "import('./src/core/types.js').then(() => console.log('ok'))"` printing `ok`

## 2. DMC code order

- [ ] 2.1 Write failing tests in `tests/unit/core/pattern.test.js` for `compareDmcCodes`: `'310' < '3865'`, `'3865' < 'B5200'`, `'B5200' < 'BLANC' < 'ECRU'`, `'01' < '1'`, equal codes return 0, sorting `['ECRU','3865','B5200','310','BLANC']` gives `['310','3865','B5200','BLANC','ECRU']`; verify `node --test tests/unit/core/pattern.test.js` fails because the module is missing
- [ ] 2.2 Create `src/core/pattern.js` with the exported constants (`EMPTY_CELL`, `MAX_PATTERN_COLORS`, `DEFAULT_FABRIC_COUNT`, `FABRIC_COUNTS`) and `compareDmcCodes`; verify the 2.1 tests pass

## 3. Building a pattern

- [ ] 3.1 Write failing tests for size and cell-count validation (width 0, height 1.5, negative and non-number sizes, 5 cells for 3 × 2) with `assert.throws` checking `RangeError` and the values in the message; verify they fail
- [ ] 3.2 Implement `buildPattern` input checks for width, height and cell count; verify 3.1 passes
- [ ] 3.3 Write failing tests for color and cell validation: cell index 2 with 2 colors (message has position `1` and value `2`), cell `-2`, cell `0.5`, empty code, non-string name, hex `000000` (`TypeError` with `310` and `000000`); verify they fail
- [ ] 3.4 Implement color and cell-value validation; verify 3.3 passes
- [ ] 3.5 Write failing tests for the "Grid layout of a 3 × 2 pattern", "Legend entry fields", "Counts exclude empty cells", "Unused BLANC is dropped", "Most stitches get number 1", "Ties ordered by DMC code", "Numeric codes compare by value", "Empty is not white", "Fully transparent image" and "Hex is normalised to uppercase" scenarios; verify they fail
- [ ] 3.6 Implement counting, dropping, sorting, numbering, hex normalisation and the remap into a new `Int16Array`; verify 3.5 passes
- [ ] 3.7 Write failing tests for "Two clusters land on DMC 310" and "Conflicting data for one code" (error message contains `310`, `#000000`, `#111111`); verify they fail
- [ ] 3.8 Implement grouping by DMC code with the conflict check; verify 3.7 passes
- [ ] 3.9 Write failing tests for the color limit: 99 distinct codes accepted (numbers 1–99), 100 rejected (`RangeError` with `100` and `99`), 120 input colors sharing 2 codes accepted; verify the 100-color test fails
- [ ] 3.10 Implement the `MAX_PATTERN_COLORS` check on the merged legend; verify 3.9 passes
- [ ] 3.11 Write tests for determinism, input color order independence, non-mutation of input `cells`/`colors`, and `structuredClone(pattern, { transfer: [pattern.cells.buffer] })` (deep-equal to a prior copy; buffer byte length 12, byte offset 0); fix `buildPattern` if any fails; verify all `pattern.test.js` tests pass

## 4. Consumer helpers

- [ ] 4.1 Write failing tests for `legendEntryAt`: (0, 0) of the 3 × 2 pattern returns entry number 2 code `321`, (0, 1) returns `null`, (3, 0), (-1, 0) and (0.5, 0) throw `RangeError`; verify they fail
- [ ] 4.2 Implement `legendEntryAt`; verify 4.1 passes
- [ ] 4.3 Write failing tests for `finishedSize`: 140 × 98 at 14 ct = 10 × 7 in / 25.4 × 17.78 cm (tolerance 1e-9), 28 × 14 with default count = 2 × 1 in, 110 × 55 at 11 ct = 10 × 5 in / 25.4 × 12.7 cm, fabric count 0, -14, `NaN` and `Infinity` throw `RangeError`; verify they fail
- [ ] 4.4 Implement `finishedSize` with a named `INCHES_TO_CM = 2.54` constant; verify 4.3 passes and `pattern.js` stays under ~300 lines with functions under ~40 lines

## 5. Project rules: numbers instead of symbols

- [ ] 5.1 In `.claude/rules/domain.md`, replace the "Symbols" section with "Chart numbers": each legend color gets a number 1..N (1 = most stitches, ties by DMC code: digit-only codes numerically, then others in ordinal order), at most 99 colors so numbers have ≤ 2 digits, cells are white with the number in black, never depend on color to read the chart; and change "symbol" to "number" in the vocabulary table; verify by reading the section
- [ ] 5.2 In `.claude/rules/ui.md`, replace "Two views: color blocks, and symbols" with the three layers (original image, DMC color blocks, number chart: white cells with the legend number, printable in black and white), change the legend accessibility line to "number, DMC code, name, swatch and stitch count", and "symbol chart" in the print rule to "number chart"; verify by reading the changed lines
- [ ] 5.3 In `.claude/rules/architecture.md` (pipeline step 4) and `CLAUDE.md` (intro), replace "symbol" with "number"/"numbered chart"; verify `grep -rni symbol CLAUDE.md .claude/rules` prints nothing

## 6. Verification

- [ ] 6.1 Run `npm run test:unit`; all tests pass (show output)
- [ ] 6.2 Run `npm run test:integration`; it passes (this change adds no integration tests, expect 0 failures)
- [ ] 6.3 Run `openspec validate add-pattern-model --strict`; it reports the change is valid

No browser smoke check: this change touches no UI or io code.
