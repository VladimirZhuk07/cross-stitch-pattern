# Spec Delta

## REMOVED Requirements

### Requirement: At most 99 colors
**Reason**: The limit is raised to the size of the DMC palette (489); chart numbers are now
always sized for 3 digits, so the 2-digit limit is no longer needed.
**Migration**: See "At most as many colors as the DMC palette" below. Patterns with up to 99
colors behave as before.

## ADDED Requirements

### Requirement: At most as many colors as the DMC palette
A pattern SHALL use at most as many distinct DMC codes as the bundled DMC palette has (489),
so every legend number has at most 3 digits. The limit SHALL be taken from the palette size,
not written down as a separate number, and SHALL apply to the merged legend, not to the number
of input colors.

#### Scenario: 99 colors are accepted
- **WHEN** a 99 × 1 pattern is built with 99 distinct (synthetic) codes, one stitch each
- **THEN** the legend has 99 entries numbered 1 to 99

#### Scenario: 489 colors are accepted
- **WHEN** a 489 × 1 pattern is built with 489 distinct (synthetic) codes, one stitch each
- **THEN** the legend has 489 entries numbered 1 to 489

#### Scenario: The whole DMC palette fits
- **WHEN** a 489 × 1 pattern is built with the 489 colors of the bundled DMC palette, one stitch each
- **THEN** the legend has 489 entries and the highest number is `489` (3 digits)

#### Scenario: 490 colors are rejected
- **WHEN** a 490 × 1 pattern is built with 490 distinct codes, one stitch each
- **THEN** building fails with a RangeError whose message contains `490` and `489`

#### Scenario: Many input colors that merge below the limit
- **WHEN** a 600 × 1 pattern is built with 600 input colors that share 2 DMC codes
- **THEN** the pattern is built with 2 legend entries
