# Spec Delta

## MODIFIED Requirements

### Requirement: Grid lines every stitch and every 10 stitches
The Chart layer SHALL draw a thin mid-grey (`#A0A0A0`) line between all cells and a bold black
line every 10 stitches counted from the top-left corner and along the grid's outer border.
Thin lines SHALL be omitted when the cell size is below 4 CSS px; bold lines SHALL always be drawn.
When 10 cells are shorter than 8 CSS px, bold lines SHALL be drawn every 100, 1000, …
stitches instead: the first power of ten from 10 up whose spacing is at least 8 CSS px.

#### Scenario: 23 × 12 pattern with 10 px cells
- **WHEN** a 23 × 12 pattern is shown with 10 px cells
- **THEN** vertical lines at stitch boundaries 0, 10, 20 and 23 are bold and the other 20 vertical lines are thin
- **AND** horizontal lines at boundaries 0, 10 and 12 are bold and the other 10 horizontal lines are thin

#### Scenario: Tiny cells
- **WHEN** the same pattern is shown with 3 px cells
- **THEN** only the bold lines (vertical 0, 10, 20, 23; horizontal 0, 10, 12) are drawn

#### Scenario: Thin-line threshold
- **WHEN** the cell size is exactly 4 CSS px
- **THEN** thin lines are drawn

#### Scenario: Bold-line step threshold
- **WHEN** the cell size is 0.8 CSS px, and again 0.79 CSS px
- **THEN** bold lines are every 10 stitches at 0.8 (8 CSS px apart) and every 100 stitches at 0.79

#### Scenario: Fitted 1000 × 1000 pattern
- **WHEN** a 1000 × 1000 pattern is shown with 0.752 CSS px cells
- **THEN** the bold vertical lines are at boundaries 0, 100, 200, …, 1000 (11 lines), and no thin line is drawn

#### Scenario: Fitted 10000 × 10000 pattern
- **WHEN** a 10000 × 10000 pattern is shown with 0.0752 CSS px cells
- **THEN** the bold vertical lines are at boundaries 0, 1000, 2000, …, 10000 (11 lines), and likewise the horizontal ones

#### Scenario: Far border off the step
- **WHEN** a 10050 × 10 pattern is shown with 0.0752 CSS px cells
- **THEN** the bold vertical lines are 0, 1000, …, 10000 and the border 10050

### Requirement: Only visible cells are drawn
The Chart layer SHALL draw only the cells, lines and labels that intersect the frame, so the
drawing work per frame depends on the visible area, not on the pattern size. A grid entirely
outside the frame SHALL draw nothing.

#### Scenario: Panned 100 × 100 pattern
- **WHEN** a 100 × 100 pattern is shown with 10 px cells, the content rectangle's top-left at (−95, −40), in a 400 × 300 frame
- **THEN** only columns 9 to 49 and rows 4 to 33 are drawn

#### Scenario: Large pattern zoomed in
- **WHEN** a 300 × 300 pattern without empty cells is shown with 20 px cells, the content rectangle's top-left at (0, 0), in a 400 × 300 frame
- **THEN** exactly 300 numbers are drawn (columns 0 to 19, rows 0 to 14) out of 90 000 cells

#### Scenario: Grid outside the frame
- **WHEN** the content rectangle's top-left is at (500, 0) in a 400 × 300 frame
- **THEN** no cell, line, ruler or number is drawn

#### Scenario: 10000 × 10000 pattern at Fit
- **WHEN** a 10000 × 10000 pattern with empty cells is shown with the content rectangle at x 124, y 24, size 752 × 752, in a 1000 × 800 frame, once its overview is complete
- **THEN** the cell colors are one picture drawn once, no number and no hatch line is drawn, 11 vertical and 11 horizontal bold lines are drawn, and no cell of the pattern is read during the frame

### Requirement: Ruler labels never overlap
Ruler labels SHALL be drawn every 10 stitches if 10 cells are at least as long as the widest
label plus 4 CSS px; otherwise every 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, …
stitches (the sequence 1, 2, 5 times a power of ten continues without end), the first step
that satisfies the same condition. Both rulers SHALL use the same step.

#### Scenario: Comfortable spacing
- **WHEN** the cell size is 3.2 CSS px and the widest label is 17 CSS px
- **THEN** labels are drawn every 10 stitches (32 ≥ 21)

#### Scenario: Crowded labels
- **WHEN** the cell size is 1.6 CSS px and the widest label is 17 CSS px
- **THEN** labels are drawn every 20 stitches (16 < 21 ≤ 32)

#### Scenario: Very small cells
- **WHEN** the cell size is 0.5 CSS px and the widest label is 17 CSS px
- **THEN** labels are drawn every 50 stitches

#### Scenario: 10000 × 10000 pattern on a phone
- **WHEN** the cell size is 0.0342 CSS px and the widest label is 19.25 CSS px
- **THEN** labels are drawn every 1000 stitches (500 × 0.0342 = 17.1 < 23.25 ≤ 34.2)

#### Scenario: Beyond 500
- **WHEN** the cell size is 0.01 CSS px and the widest label is 17 CSS px
- **THEN** labels are drawn every 5000 stitches (2000 × 0.01 = 20 < 21 ≤ 50)
