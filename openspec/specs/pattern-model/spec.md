# pattern-model Specification

## Purpose

Defines the in-memory cross-stitch pattern that pattern generation produces and the preview
and chart layers consume: a grid of stitches, a numbered DMC legend with stitch counts, and
the rules for building and validating it.

Hex values in the scenarios below are test fixtures, not palette data. Unless stated
otherwise, scenarios use these input colors: `310` "Black" `#000000`, `321` "Red"
`#C72B3B`, `BLANC` "White" `#FFFFFF`. The empty marker is `-1`.

## Requirements

### Requirement: Build input
A pattern SHALL be built from: `width` and `height` (stitches), `cells` (a list of
`width × height` numbers, row-major, each an index into `colors` or the empty marker `-1`),
and `colors` (a list of `{ code, name, hex }` objects that MAY contain unused entries and
repeated DMC codes). Hex input MAY be upper- or lowercase.

#### Scenario: Plain arrays and typed arrays are both accepted
- **WHEN** a 2 × 1 pattern is built with colors `[310]` once with cells `[0, -1]` as a plain array and once as an `Int16Array`
- **THEN** both results are deep-equal, with cells `[0, -1]` and 1 legend entry `310`

### Requirement: Pattern shape
A pattern SHALL consist of a width and height in stitches, a row-major cell grid of
`width × height` entries, and a legend ordered by legend number. Each cell SHALL hold either
the 0-based index of its legend entry or the empty marker `-1`. The cell at column x, row y
SHALL be at position `y × width + x`.

#### Scenario: Grid layout of a 3 × 2 pattern
- **WHEN** a pattern is built with width 3, height 2, colors `[321, 310, BLANC]` and cells `[0, 1, 1, -1, 1, 0]`
- **THEN** the pattern has width 3, height 2 and 6 cells `[1, 0, 0, -1, 0, 1]`
- **AND** the legend has 2 entries: number 1 = `310`, number 2 = `321`

### Requirement: Legend entries
Each legend entry SHALL carry its legend number (1..N), DMC code, name, hex color as
uppercase `#RRGGBB`, and stitch count. Entry at legend position i SHALL have number i + 1.

#### Scenario: Legend entry fields
- **WHEN** the 3 × 2 pattern from "Grid layout of a 3 × 2 pattern" is built
- **THEN** legend entry 1 is `{ number: 1, code: '310', name: 'Black', hex: '#000000', stitchCount: 3 }`
- **AND** legend entry 2 is `{ number: 2, code: '321', name: 'Red', hex: '#C72B3B', stitchCount: 2 }`

#### Scenario: Hex is normalised to uppercase
- **WHEN** a 1 × 1 pattern is built with color `321` "Red" hex `#c72b3b` and cells `[0]`
- **THEN** the legend entry hex is `#C72B3B`

### Requirement: Stitch counts
The stitch count of a legend entry SHALL equal the number of cells that use it. The sum of
all stitch counts SHALL equal the number of non-empty cells.

#### Scenario: Counts exclude empty cells
- **WHEN** a 2 × 2 pattern is built with colors `[310]` and cells `[0, -1, 0, -1]`
- **THEN** the legend has 1 entry `310` with stitch count 2
- **AND** 2 cells are `-1`

### Requirement: Unused colors are dropped
Input colors that no cell uses SHALL NOT appear in the legend.

#### Scenario: Unused BLANC is dropped
- **WHEN** a 2 × 1 pattern is built with colors `[310, BLANC]` and cells `[0, 0]`
- **THEN** the legend has exactly 1 entry, `310` with stitch count 2

### Requirement: Colors with the same DMC code are merged
Input colors that share a DMC code SHALL become one legend entry whose stitch count is the
sum of their stitches. Two input colors with the same code but a different name or hex
(compared case-insensitively) SHALL be rejected with an error naming the code.

#### Scenario: Two clusters land on DMC 310
- **WHEN** a 2 × 2 pattern is built with colors `[310, 321, 310]` and cells `[0, 1, 2, 2]`
- **THEN** the legend is number 1 = `310` (3 stitches), number 2 = `321` (1 stitch)
- **AND** the cells are `[0, 1, 0, 0]`

#### Scenario: Conflicting data for one code
- **WHEN** colors contain `310` "Black" `#000000` and `310` "Black" `#111111`
- **THEN** building fails with an error whose message contains `310`, `#000000` and `#111111`

### Requirement: Legend numbering order
Legend numbers SHALL be assigned by descending stitch count. Equal stitch counts SHALL be
ordered by DMC code: codes made only of digits first, by numeric value; then all other codes
by ordinal (locale-independent) string order. Codes with equal numeric value (`01`, `1`)
SHALL fall back to ordinal string order.

#### Scenario: Most stitches get number 1
- **WHEN** a 3 × 1 pattern is built with colors `[BLANC, 310]` and cells `[0, 1, 1]`
- **THEN** number 1 = `310` (2 stitches), number 2 = `BLANC` (1 stitch)

#### Scenario: Ties ordered by DMC code
- **WHEN** a 5 × 1 pattern is built with colors `ECRU`, `3865`, `B5200`, `310`, `BLANC` and cells `[0, 1, 2, 3, 4]`
- **THEN** the legend order is `310`, `3865`, `B5200`, `BLANC`, `ECRU` with numbers 1 to 5

#### Scenario: Numeric codes compare by value, not as text
- **WHEN** a 2 × 1 pattern is built with colors `[3865, 310]` and cells `[0, 1]`
- **THEN** number 1 = `310` and number 2 = `3865`

### Requirement: Empty cells
Cells marked empty SHALL stay empty in the pattern, SHALL NOT be counted as stitches, and
SHALL be distinct from any color, including white (`BLANC`). A pattern in which every cell is
empty SHALL be valid and have an empty legend.

#### Scenario: Empty is not white
- **WHEN** a 2 × 1 pattern is built with colors `[BLANC]` and cells `[0, -1]`
- **THEN** the cells are `[0, -1]` and the legend has 1 entry `BLANC` with stitch count 1

#### Scenario: Fully transparent image
- **WHEN** a 2 × 2 pattern is built with colors `[]` and cells `[-1, -1, -1, -1]`
- **THEN** the pattern has width 2, height 2, cells `[-1, -1, -1, -1]` and 0 legend entries

### Requirement: At most 99 colors
A pattern SHALL use at most 99 distinct DMC codes, so every legend number has at most 2
digits and fits in one chart cell. The limit SHALL apply to the merged legend, not to the
number of input colors.

#### Scenario: 99 colors are accepted
- **WHEN** a 99 × 1 pattern is built with 99 distinct (synthetic) codes, one stitch each
- **THEN** the legend has 99 entries numbered 1 to 99

#### Scenario: 100 colors are rejected
- **WHEN** a 100 × 1 pattern is built with 100 distinct codes, one stitch each
- **THEN** building fails with a RangeError whose message contains `100` and `99`

#### Scenario: Many input colors that merge below the limit
- **WHEN** a 120 × 1 pattern is built with 120 input colors that share 2 DMC codes
- **THEN** the pattern is built with 2 legend entries

### Requirement: Input validation
Building SHALL fail with a clear error stating what was wrong and the received value when:
width or height is not a positive integer; the cell count is not width × height; a cell value
is not an integer from `-1` to colors count − 1; a color has an empty or non-string code or
name; a hex is not `#RRGGBB`.

#### Scenario: Zero width
- **WHEN** a pattern is built with width 0, height 2
- **THEN** building fails with a RangeError whose message contains `width` and `0`

#### Scenario: Fractional height
- **WHEN** a pattern is built with width 2, height 1.5
- **THEN** building fails with a RangeError whose message contains `height` and `1.5`

#### Scenario: Wrong number of cells
- **WHEN** a 3 × 2 pattern is built with 5 cells
- **THEN** building fails with a RangeError whose message contains `6` and `5`

#### Scenario: Cell index out of range
- **WHEN** a 2 × 1 pattern is built with colors `[310, 321]` and cells `[0, 2]`
- **THEN** building fails with a RangeError whose message contains the cell position `1` and the value `2`

#### Scenario: Index below the empty marker
- **WHEN** a 1 × 1 pattern is built with colors `[310]` and cells `[-2]`
- **THEN** building fails with a RangeError whose message contains `-2`

#### Scenario: Malformed hex
- **WHEN** a color `310` has hex `000000`
- **THEN** building fails with a TypeError whose message contains `310` and `000000`

### Requirement: Deterministic and non-mutating
Building SHALL return equal patterns for equal input, SHALL NOT depend on the order of the
input colors beyond the indices the cells reference, and SHALL NOT modify its input.

#### Scenario: Same input twice
- **WHEN** the 3 × 2 pattern from "Grid layout of a 3 × 2 pattern" is built twice
- **THEN** both results are deep-equal

#### Scenario: Input color order does not change the result
- **WHEN** one pattern is built with colors `[321, 310]` and cells `[0, 1, 1]`, and another with colors `[310, 321]` and cells `[1, 0, 0]`
- **THEN** both results are deep-equal: legend 1 = `310` (2), 2 = `321` (1), cells `[1, 0, 0]`

#### Scenario: Input is not modified
- **WHEN** a pattern is built from a cells array `[0, 1, 1]` and colors `[321, 310]`
- **THEN** afterwards the input cells are still `[0, 1, 1]` and the colors array and objects are unchanged

### Requirement: Plain, transferable data
A pattern SHALL contain only numbers, strings, plain objects, arrays, and one `Int16Array`
for the cells that owns its whole buffer, so it survives structured cloning and its cell
buffer can be transferred to or from a Web Worker.

#### Scenario: Structured clone with transfer
- **WHEN** the 3 × 2 pattern is cloned with `structuredClone(pattern, { transfer: [pattern.cells.buffer] })`
- **THEN** the clone is deep-equal to a copy taken before the transfer
- **AND** the original cell buffer has byte length 12 before the transfer (2 bytes × 6 cells, byte offset 0)

### Requirement: Cell lookup
The model SHALL provide a lookup that returns the legend entry of the cell at (x, y), or
`null` for an empty cell, and fails with a RangeError for coordinates outside the grid or
not integers.

#### Scenario: Looking up stitched and empty cells
- **WHEN** cells (0, 0) and (0, 1) of the 3 × 2 pattern are looked up
- **THEN** (0, 0) returns the entry with number 2, code `321`
- **AND** (0, 1) returns `null`

#### Scenario: Out of bounds
- **WHEN** cell (3, 0) of the 3 × 2 pattern is looked up
- **THEN** the lookup fails with a RangeError whose message contains `3`

### Requirement: Finished size
The model SHALL compute the finished size of a grid for a fabric count: inches = stitches /
fabric count, centimeters = inches × 2.54. The fabric count SHALL default to 14 and MUST be
a positive finite number. The supported choices offered to users SHALL be 11, 14, 16, 18.
The result SHALL have the fields `widthInches`, `heightInches`, `widthCm`, `heightCm`,
unrounded.

#### Scenario: 140 × 98 stitches on 14 ct Aida
- **WHEN** the finished size of width 140, height 98 is computed for fabric count 14
- **THEN** it is `{ widthInches: 10, heightInches: 7, widthCm: 25.4, heightCm: 17.78 }` (within 1e-9)

#### Scenario: Default fabric count
- **WHEN** the finished size of width 28, height 14 is computed without a fabric count
- **THEN** it is 2 × 1 inches

#### Scenario: 11 ct fabric
- **WHEN** the finished size of width 110, height 55 is computed for fabric count 11
- **THEN** it is 10 × 5 inches and 25.4 × 12.7 cm

#### Scenario: Invalid fabric count
- **WHEN** the finished size is computed for fabric count 0
- **THEN** it fails with a RangeError whose message contains `0`
