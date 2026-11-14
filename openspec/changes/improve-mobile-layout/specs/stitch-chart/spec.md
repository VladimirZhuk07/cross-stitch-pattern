## MODIFIED Requirements

### Requirement: Legend is wide and compact
Beside the frame the legend panel SHALL be 24rem (384 CSS px at the default 16 px font) wide,
with compact rows, so DMC names take at most 2 lines. Below a 72rem window width it SHALL move
to its own row under the settings and the frame, at most 40 % of the window height tall. On a
compact screen (narrower than 48rem, or lower than 30rem while narrower than 60rem; see the
responsive-layout spec) it SHALL be a collapsible panel under the frame, or in the side column
in landscape, that starts collapsed.

#### Scenario: Desktop window
- **WHEN** the window is 1440 CSS px wide and the legend lists `939` "Navy Blue Very Dark" and `3865` "Winter White"
- **THEN** the legend panel is 384 CSS px wide and each of the two rows is at most 2 text lines high

#### Scenario: Narrow window
- **WHEN** the window is 1100 CSS px wide (below 72rem)
- **THEN** the legend is shown below the settings and the frame, across the full width

#### Scenario: Phone
- **WHEN** the window is 375 × 667 CSS px and a pattern with 18 legend entries exists
- **THEN** the legend is shown under the frame as a collapsed toggle reading `Legend` and `18 colors`, and its rows appear when the toggle is expanded
