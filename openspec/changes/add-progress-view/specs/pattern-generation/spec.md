# Spec Delta

## MODIFIED Requirements

### Requirement: Patterns are generated automatically
A pattern of at most 4,000,000 stitches SHALL be generated, without a button press, as soon as
an image has loaded, and again 300 ms after the last valid change of the width or the max
colors. While stitches are marked on the Progress layer, a width or max colors change SHALL
instead apply only when the field is committed (Enter or leaving the field) and the user has
confirmed losing the progress (see the stitch-progress spec). A request that is overtaken by a
newer image or setting change SHALL be stopped at once and its result never shown. While a newer pattern is generated, the current pattern SHALL stay
visible.

#### Scenario: New image
- **WHEN** `photo.png` finishes loading with the default settings
- **THEN** a 100-stitch-wide pattern with at most 24 colors is generated and stored, the `DMC colors` and `Chart` options become enabled, and the Original layer stays active

#### Scenario: Typing a number
- **WHEN** the user types `1` and then `2` into max colors within 300 ms
- **THEN** exactly one new pattern is generated, with at most 12 colors

#### Scenario: Newer setting overtakes a running generation
- **WHEN** a pattern with 24 colors is being generated and the user changes max colors to 12
- **THEN** the 24-color job is stopped (its worker is terminated and a fresh worker receives the image again), no 24-color result is ever shown, and the 12-color result is shown

#### Scenario: New image during generation
- **WHEN** `a.png`'s pattern is being generated and the user loads `b.png`
- **THEN** `a.png`'s job is stopped, its result is never stored, and the pattern of `b.png` is generated

#### Scenario: Typing while stitches are marked
- **WHEN** 12 stitches are marked and the user types `1`, `2`, `0` into the width (in use: 100), waiting 1 s between keys
- **THEN** no pattern is generated and no dialog opens while typing; pressing Enter opens the progress dialog once, for the value 120
