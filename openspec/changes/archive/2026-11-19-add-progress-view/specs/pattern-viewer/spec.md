# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Layer switcher offers Original, DMC colors and Chart`
- TO: `### Requirement: Layer switcher offers Original, DMC colors, Chart and Progress`

## MODIFIED Requirements

### Requirement: Layer switcher offers Original, DMC colors, Chart and Progress
The app SHALL show a labelled, keyboard-operable layer switcher with exactly four options in
this order: `Original`, `DMC colors`, `Chart`, `Progress`. `Original` SHALL always be selectable.
`DMC colors`, `Chart` and `Progress` SHALL be disabled while no pattern exists and enabled once
one exists.

#### Scenario: No pattern yet
- **WHEN** the app has just started, or an image is loaded but no pattern has been generated
- **THEN** `Original` is selected, and `DMC colors`, `Chart` and `Progress` are visible but disabled

#### Scenario: Pattern becomes available
- **WHEN** a pattern is stored in the application state
- **THEN** `DMC colors`, `Chart` and `Progress` become enabled and can be selected with mouse or keyboard

#### Scenario: Pattern is cleared while Progress is active
- **WHEN** the Progress layer is active and the pattern is cleared (for example by loading a new image)
- **THEN** the Original layer becomes active and `Progress` is disabled
