# Spec Delta

## ADDED Requirements

### Requirement: The header title is short on narrow screens
On screens narrower than 32rem (512 px) the header SHALL show the title `Cross-Stitch` in full
(not cut off) next to the Export menu and `Choose image`; the words ` Pattern Maker` SHALL stay
in the heading, visually hidden, so its accessible name remains `Cross-Stitch Pattern Maker`.
From 32rem up the full title SHALL be shown. A title that still does not fit SHALL end in an
ellipsis rather than overflow.

#### Scenario: Small phone
- **WHEN** the screen is 360 × 640
- **THEN** the header shows `Cross-Stitch` without an ellipsis, the Export menu and `Choose image` are fully visible, and the page's scroll width is 360 px

#### Scenario: Large phone
- **WHEN** the screen is 414 × 896
- **THEN** the header shows `Cross-Stitch` without an ellipsis

#### Scenario: Screen reader
- **WHEN** the heading is read by a screen reader on a 360 px screen
- **THEN** its name is `Cross-Stitch Pattern Maker`

#### Scenario: Landscape phone and desktop
- **WHEN** the screen is 667 × 375, or 1440 × 900
- **THEN** the header shows `Cross-Stitch Pattern Maker` in full
