# Spec Delta

## ADDED Requirements

### Requirement: Pattern fingerprint
Every pattern SHALL carry a `fingerprint`: a string of 14 lowercase hex digits computed only
from its width, height, cells and the DMC codes of its legend in number order. Equal patterns
SHALL have equal fingerprints; a pattern that differs in any of these SHALL have a different
one (up to the chance of a 53-bit hash collision). Names, hex colors and stitch counts follow
from the codes and cells and are not hashed separately.

#### Scenario: Same input, same fingerprint
- **WHEN** the 3 × 2 pattern (colors `[321, 310, BLANC]`, cells `[0, 1, 1, -1, 1, 0]`) is built twice
- **THEN** both patterns have the same fingerprint, matching `^[0-9a-f]{14}$`

#### Scenario: One cell differs
- **WHEN** a second pattern is built from the same input with cell 3 set to `0` instead of `-1`
- **THEN** its fingerprint differs from the first

#### Scenario: Another DMC code in the same place
- **WHEN** a pattern is built with colors `[326, 310, BLANC]` instead (same cells)
- **THEN** its fingerprint differs from that of the `321` pattern

#### Scenario: Same cells, other size
- **WHEN** the same six cells are built as a 2 × 3 pattern
- **THEN** its fingerprint differs from that of the 3 × 2 pattern

#### Scenario: Generated twice
- **WHEN** the same image is generated twice with the same settings, in a fresh worker each time
- **THEN** both patterns have the same fingerprint
