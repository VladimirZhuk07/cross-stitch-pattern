# dmc-color-matching Specification

## Purpose

Provides the DMC floss palette and the color science used to compare colors perceptually
(sRGB → CIELAB, CIEDE2000) and to match any color to its nearest DMC floss, deterministically
and without network access.

## Requirements

### Requirement: Palette provenance is recorded

The DMC palette SHALL come from exactly one documented source: makebead/craft-color-codes,
file `data/json/dmc-floss.json`, pinned to one git commit. The palette data file SHALL start
with a header comment stating the source URL, the full 40-character commit SHA, the license
(CC-BY-4.0) with attribution to the source author, and every transformation applied to the
source data.

#### Scenario: Header names source, commit, license, and transformations

- **WHEN** the palette data file is read as text
- **THEN** its header contains `https://github.com/makebead/craft-color-codes`,
  `data/json/dmc-floss.json`, a 40-character hexadecimal commit SHA, and `CC-BY-4.0`
- **AND** it lists the transformations: codes upper-cased, hex upper-cased, `rgb` field dropped

#### Scenario: Import is reproducible

- **WHEN** the import tool is run again on the source file downloaded from the pinned commit
- **THEN** the generated palette file is byte-for-byte identical to the committed one

### Requirement: Palette entries have a fixed shape

Every palette entry SHALL be an object with exactly three string properties: `code`
(non-empty), `name` (non-empty, taken unchanged from the source), and `hex` (`#` followed by
six upper-case hexadecimal digits, numerically equal to the source color). Entries SHALL keep
the source order. The palette and its entries SHALL be read-only.

#### Scenario: Black floss 310

- **WHEN** the palette is searched for code `'310'`
- **THEN** exactly one entry is found, its `code` is the string `'310'` (not the number 310),
  and its `hex` is `'#000000'`

#### Scenario: Every hex value is well-formed

- **WHEN** every entry's `hex` is tested against `/^#[0-9A-F]{6}$/`
- **THEN** all 489 entries match

#### Scenario: Count and uniqueness

- **WHEN** the palette is loaded
- **THEN** it has 489 entries and 489 distinct codes

#### Scenario: Palette cannot be modified

- **WHEN** code running in strict mode assigns `hex = '#FFFFFF'` to the entry for `'310'`,
  or pushes a new entry onto the palette
- **THEN** a `TypeError` is thrown and the palette is unchanged

### Requirement: DMC codes are normalised to upper case

Codes SHALL be stored as upper-case strings so that letter codes follow the project convention.
Numeric codes and codes that are already upper case SHALL be unchanged.

#### Scenario: Letter codes

- **WHEN** the source contains codes `Blanc`, `Ecru`, and `B5200`
- **THEN** the palette contains codes `'BLANC'`, `'ECRU'`, and `'B5200'`, and no code contains a
  lower-case letter

#### Scenario: Numeric codes are unchanged

- **WHEN** the source contains code `3865`
- **THEN** the palette contains the string `'3865'`

### Requirement: Import rejects inconsistent source data

The import tool SHALL fail with an error that names the offending entry, and SHALL NOT write a
palette file, when a source entry has a missing or empty code or name, a hex value that is not
`#` plus six hexadecimal digits, an `rgb` triple that disagrees with its hex value, or a code that
duplicates another entry's code after normalisation.

#### Scenario: rgb disagrees with hex

- **WHEN** the source contains `{"code":"310","name":"Black","hex":"#000000","rgb":[0,0,1]}`
- **THEN** the import fails with an error message containing `310`

#### Scenario: Duplicate code after normalisation

- **WHEN** the source contains entries with codes `Blanc` and `BLANC`
- **THEN** the import fails with an error message containing `BLANC`

#### Scenario: Malformed hex

- **WHEN** the source contains an entry with code `310` and hex `#00000`
- **THEN** the import fails with an error message containing `310` and `#00000`

### Requirement: Hex colors parse to sRGB

A hex color string `#RRGGBB` (hex digits in either case) SHALL parse to an sRGB color: an
object `{ r, g, b }` with integer channels 0–255. Any other input SHALL be rejected with a `TypeError` whose message
contains the received value.

#### Scenario: Valid hex

- **WHEN** `'#ff8000'` or `'#FF8000'` is parsed
- **THEN** the result is `{ r: 255, g: 128, b: 0 }`

#### Scenario: Invalid hex

- **WHEN** `'#fff'`, `'ff8000'`, `'#gg0000'`, or the number `42` is parsed
- **THEN** a `TypeError` is thrown and its message contains the received value

### Requirement: sRGB and linear RGB convert both ways

An sRGB channel 0–255 SHALL convert to a linear-light value 0–1 using the IEC 61966-2-1 sRGB
transfer function, and a linear value SHALL convert back to an unrounded sRGB channel 0–255.
sRGB input outside 0–255 or not a finite number SHALL throw a `RangeError`. Linear input SHALL be
clamped to 0–1; a non-finite linear input SHALL throw a `RangeError`.

#### Scenario: Reference channel values

- **WHEN** sRGB channels 0, 10, 128, and 255 are converted to linear
- **THEN** the results are 0, 0.0030353, 0.2158605, and 1 (each within 1e-6)

#### Scenario: Round trip

- **WHEN** every integer channel 0..255 is converted to linear and back
- **THEN** each result is within 1e-6 of the original channel

#### Scenario: Clamping and invalid input

- **WHEN** linear values 1.0000001 and -0.0000001 are converted to sRGB
- **THEN** the results are 255 and 0
- **AND** converting sRGB channel 256, -1, or `NaN` to linear, or linear `NaN` to sRGB, throws a
  `RangeError` whose message contains the received value

### Requirement: Colors convert to CIELAB under D65

An sRGB color and a linear RGB color (`{ r, g, b }`, channels 0–1) SHALL convert to a Lab color
`{ L, a, b }` (L 0–100) via CIE XYZ with the D65 reference white, so that a color reaches the same Lab value through either
path. Invalid channels SHALL throw a `RangeError` as for the channel conversions.

#### Scenario: Published reference values

- **WHEN** sRGB white `(255,255,255)`, black `(0,0,0)`, red `(255,0,0)`, green `(0,255,0)`, blue
  `(0,0,255)`, and grey `(128,128,128)` are converted to Lab
- **THEN** the results are, within 0.01 per component, `(100, 0, 0)`, `(0, 0, 0)`,
  `(53.2408, 80.0925, 67.2032)`, `(87.7347, -86.1827, 83.1793)`, `(32.2970, 79.1875, -107.8602)`,
  and `(53.5850, 0, 0)`

#### Scenario: Linear input gives the same Lab

- **WHEN** linear RGB `(0.2158605, 0.2158605, 0.2158605)` is converted to Lab
- **THEN** the result equals the Lab of sRGB `(128,128,128)` within 1e-4 per component

#### Scenario: Out-of-range channel

- **WHEN** sRGB `(300, 0, 0)` is converted to Lab
- **THEN** a `RangeError` is thrown whose message contains `300`

### Requirement: Color difference uses CIEDE2000

The color difference between two Lab colors SHALL be computed with CIEDE2000 (ΔE00, kL = kC =
kH = 1) and SHALL reproduce all 34 test pairs of Sharma, Wu & Dalal (2005) within 1e-4. Lab input
with a missing or non-finite component SHALL throw a `TypeError`.

#### Scenario: Published test pairs

- **WHEN** ΔE00 is computed for Lab `(50, 2.6772, -79.7751)` vs `(50, 0, -82.7485)`
- **THEN** the result is 2.0425 within 1e-4
- **AND** for `(50, 2.4900, -0.0010)` vs `(50, -2.4900, 0.0009)` it is 7.1792, and vs
  `(50, -2.4900, 0.0011)` it is 7.2195 (hue-angle discontinuity), each within 1e-4

#### Scenario: Identity and symmetry

- **WHEN** ΔE00 is computed for a color with itself, and for the pair `(50, 2.5, 0)` /
  `(73, 25, -18)` in both orders
- **THEN** the first result is 0, and both orders give 27.1492 within 1e-4

#### Scenario: Invalid Lab

- **WHEN** ΔE00 is computed with `{ L: NaN, a: 0, b: 0 }` or `{ L: 50, a: 0 }`
- **THEN** a `TypeError` is thrown

### Requirement: Palette Lab values are prepared once

Matching SHALL work on a prepared palette: a read-only list, in palette order, of the entries'
`code`, `name`, `hex` plus their `lab`, computed once at preparation and reused by every match. Preparing SHALL reject an
empty palette with a `RangeError`, duplicate codes with an `Error` naming the code, and an
invalid hex with a `TypeError`.

#### Scenario: Prepared DMC palette

- **WHEN** the DMC palette is prepared
- **THEN** the prepared palette has 489 colors in palette order, and the entry for `'310'` has
  Lab `(0, 0, 0)` within 0.01

#### Scenario: Invalid palettes

- **WHEN** an empty palette, a palette with two entries coded `'A'`, or a palette with an entry
  whose hex is `'#12345'` is prepared
- **THEN** a `RangeError`, an `Error` whose message contains `A`, and a `TypeError` are thrown
  respectively

### Requirement: Nearest DMC color by CIEDE2000

For a Lab color, matching SHALL return `{ color, index, deltaE }`: the prepared-palette color with
the smallest ΔE00 to it, its palette index, and that ΔE00. The final choice SHALL never be
made by RGB distance. A Lab input with a missing or non-finite component SHALL throw a
`TypeError`. Inputs SHALL NOT be modified.

#### Scenario: Black maps to 310

- **WHEN** the Lab of sRGB `#000000` is matched against the prepared DMC palette
- **THEN** the result has code `'310'`, hex `'#000000'`, and ΔE00 below 1e-9

#### Scenario: Every DMC color maps to itself

- **WHEN** the Lab of each of the 489 DMC hex values is matched against the prepared DMC palette
- **THEN** each result has the same hex as the input and ΔE00 below 1e-9, and its index is the
  input's own index or that of an earlier entry with the identical hex

#### Scenario: Small test palette

- **WHEN** a palette of `{ code: 'K', name: 'Test black', hex: '#000000' }` and
  `{ code: 'W', name: 'Test white', hex: '#FFFFFF' }` is prepared and the Lab of sRGB `(30,30,30)` and `(200,200,200)` is matched
- **THEN** the results are `K` (ΔE00 6.7765 within 1e-3) and `W` (ΔE00 12.1161 within 1e-3)

### Requirement: Ties are broken deterministically

When two or more palette colors have exactly the same ΔE00 to the input, matching SHALL return
the one with the lowest palette index. The same input and palette SHALL always give the same
result.

#### Scenario: Identical colors in the palette

- **WHEN** a palette `{ code: 'X', name: 'Grey 1', hex: '#808080' }`,
  `{ code: 'Y', name: 'Grey 2', hex: '#808080' }` is prepared and the Lab of sRGB `(128,128,128)` is matched 100 times
- **THEN** every result is `X` with palette index 0

### Requirement: A list of colors is matched in one call

Matching a list of Lab colors SHALL return one result per input, in input order, each equal to
matching that color on its own. An empty list SHALL return an empty list.

#### Scenario: Thirty cluster centres

- **WHEN** a list of 30 Lab colors is matched against the prepared DMC palette
- **THEN** 30 results are returned and result `i` equals the single-color match of input `i`
  for every `i` from 0 to 29

#### Scenario: Empty list

- **WHEN** an empty list is matched
- **THEN** the result is an empty list

### Requirement: Color matching is pure and offline

Color conversion, color difference, and matching SHALL run without browser globals, timers, or
network access, and SHALL depend only on their inputs and the bundled palette data.

#### Scenario: Runs in plain Node

- **WHEN** the color and matching modules are imported and used in Node 22 with no DOM globals
  defined
- **THEN** all operations above succeed and no network request is made
