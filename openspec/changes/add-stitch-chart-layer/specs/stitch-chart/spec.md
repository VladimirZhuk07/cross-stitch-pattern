## Purpose

Shows the pattern as a printable-style number chart in the shared view frame (white cells with
legend numbers, counting grid, rulers, centre marker) and lists the legend that maps each
number to a DMC floss.

Unless stated otherwise, scenarios use the 3 × 2 pattern from the pattern-model spec
("Grid layout of a 3 × 2 pattern"): cells `[1, 0, 0, -1, 0, 1]`, legend number 1 = `310`
"Black" `#000000` (3 stitches), number 2 = `321` "Red" `#C72B3B` (2 stitches). Positions are
CSS px relative to the frame's top-left corner. "Cell size" is the smaller of a cell's width
and height on screen.

## ADDED Requirements

### Requirement: Chart cells are white with their legend number
The Chart layer SHALL draw every stitched cell as a white cell with its legend number (1..N)
in black, centred in the cell, and SHALL NOT fill any cell with its DMC color. Cells SHALL be
placed in the shared content rectangle exactly like the other layers (column c spans c/W to
(c+1)/W of its width, row r spans r/H to (r+1)/H of its height).

#### Scenario: Numbers of the 3 × 2 pattern
- **WHEN** the 3 × 2 pattern is shown in the Chart layer with the content rectangle at x 0, y 0, size 60 × 40 (cells 20 × 20)
- **THEN** row 0 shows `2` centred at (10, 10), `1` at (30, 10), `1` at (50, 10)
- **AND** row 1 shows no number at (10, 30), `1` at (30, 30), `2` at (50, 30)
- **AND** every stitched cell is white and every number is black (`#000000`)

#### Scenario: Chart is aligned with the other layers
- **WHEN** a 100 × 67 pattern is shown with the content rectangle at x 10, y 20, size 1024 × 682.5
- **THEN** the chart cell (column 0, row 0) spans x 10 to 20.24 and y 20 to about 30.19, the same area as in the DMC colors layer

### Requirement: Number size follows the cell size
Cell numbers SHALL use one font size for the whole chart: 0.6 × the cell size in CSS px, so a
two-digit number fits in a cell. The size SHALL follow the zoom.

#### Scenario: 20 px cells
- **WHEN** the cell size is 20 CSS px
- **THEN** numbers are drawn at 12 CSS px, `1` and `99` alike

#### Scenario: Non-square cells use the smaller side
- **WHEN** cells are 24 CSS px wide and 20 CSS px high
- **THEN** numbers are drawn at 12 CSS px

#### Scenario: Large cells
- **WHEN** the cell size is 50 CSS px
- **THEN** numbers are drawn at 30 CSS px

### Requirement: Numbers are hidden in cells smaller than 14 CSS px
When the cell size is below 14 CSS px the Chart layer SHALL draw no cell numbers (only cells,
grid lines and rulers), because the numbers would be illegible. From 14 CSS px up all visible
numbers SHALL be drawn.

#### Scenario: Just below the threshold
- **WHEN** the cell size is 13.9 CSS px
- **THEN** no cell number is drawn and the grid lines are drawn

#### Scenario: At the threshold
- **WHEN** the cell size is 14 CSS px
- **THEN** every visible stitched cell shows its number at 8.4 CSS px

#### Scenario: Zooming in reveals the numbers
- **WHEN** a 100 × 100 pattern is fitted into a 1000 × 800 frame (cell size 7.52) and the user zooms in 4 steps (cell size about 18.36)
- **THEN** the fitted chart shows no numbers and after zooming the numbers are shown at about 11.02 CSS px

### Requirement: Empty cells are grey and unnumbered
Empty (no-stitch) cells SHALL be filled light grey (`#E0E0E0`) and SHALL have no number, so
they are distinguishable from every stitched cell, including white floss, without color.
Grid lines SHALL be drawn over empty cells as over stitched cells.

#### Scenario: Empty is not white floss
- **WHEN** a 2 × 1 pattern with colors `[BLANC]` and cells `[0, -1]` is shown with 20 px cells
- **THEN** cell (0, 0) is white with the number `1`
- **AND** cell (1, 0) is `#E0E0E0` with no number

#### Scenario: Pattern without stitches
- **WHEN** a 2 × 2 pattern with all cells empty is shown in the Chart layer
- **THEN** all four cells are `#E0E0E0`, no number is drawn, and the grid lines and rulers are drawn

### Requirement: Grid lines every stitch and every 10 stitches
The Chart layer SHALL draw a thin mid-grey (`#A0A0A0`) line between all cells and a bold black
line every 10 stitches counted from the top-left corner and along the grid's outer border.
Thin lines SHALL be omitted when the cell size is below 4 CSS px; bold lines SHALL always be drawn.

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

### Requirement: Grid lines are crisp at any pixel ratio
A thin line SHALL be the device pixel ratio rounded to a whole number of device pixels wide
(at least 1), a bold line twice as wide. Each line SHALL cover whole device pixels: an
odd-width line is centred on the middle of the device pixel containing its position, an
even-width line on the device pixel edge nearest to it.

#### Scenario: Line widths per pixel ratio
- **WHEN** the device pixel ratio is 1, 1.25, 2 or 3
- **THEN** thin lines are 1, 1, 2 or 3 device px wide and bold lines 2, 2, 4 or 6 device px

#### Scenario: Snapping a line at x 10.3 CSS px
- **WHEN** a stitch boundary falls at x 10.3 CSS px
- **THEN** at pixel ratio 1 the thin line covers device pixel column 10 and the bold line columns 9 and 10
- **AND** at pixel ratio 2 the thin line covers device pixel columns 20 and 21
- **AND** at pixel ratio 1.25 the thin line covers device pixel column 12

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

### Requirement: Rulers number every 10th row and column
The Chart layer SHALL draw a 24 CSS px ruler along the top and the left edge of the grid,
spanning the grid's visible extent, labelling each bold line that is a multiple of 10 (not 0)
with its stitch count from the top-left: column numbers in the top ruler, row numbers in the
left ruler, in 10 CSS px text on an opaque background.

#### Scenario: Labels of a 100 × 67 pattern
- **WHEN** a 100 × 67 pattern is shown with the content rectangle at x 24, y 100, size 1000 × 670, in a 1048 × 870 frame
- **THEN** the top ruler spans x 24 to 1024, y 76 to 100 and shows `10`, `20`, …, `100` centred at x 124, 224, …, 1024
- **AND** the left ruler spans x 0 to 24, y 100 to 770 and shows `10`, `20`, …, `60` centred at y 200, 300, …, 700
- **AND** no label `0` or `67` is shown

#### Scenario: Widest row label does not fit at 10 px
- **WHEN** the widest row label measures 20 CSS px at 10 px while the left ruler has 16 CSS px of room for labels
- **THEN** all ruler labels are drawn at 8 CSS px; if the computed size is below 7 CSS px they are drawn at 7 CSS px

### Requirement: Rulers stay visible while panning
Each ruler SHALL sit directly outside its grid edge. When that edge is scrolled past the frame
edge, the ruler SHALL stick to the frame edge and cover the grid beneath it. Where both rulers
meet, a blank square SHALL cover them.

#### Scenario: Fitted wide pattern
- **WHEN** the content rectangle's top-left is at (24, 162)
- **THEN** the top ruler spans y 138 to 162 and the left ruler spans x 0 to 24, neither covering a cell

#### Scenario: Zoomed into the middle
- **WHEN** the content rectangle's top-left is at (−300, −120)
- **THEN** the top ruler spans y 0 to 24 and the left ruler x 0 to 24, both over the grid, with a blank 24 × 24 square at (0, 0)
- **AND** the labels shown are those of the bold lines inside the frame

### Requirement: Ruler labels never overlap
Ruler labels SHALL be drawn every 10 stitches if 10 cells are at least as long as the widest
label plus 4 CSS px; otherwise every 20, 50, 100, 200 or 500 stitches, the first step that
satisfies the same condition (500 if none does). Both rulers SHALL use the same step.

#### Scenario: Comfortable spacing
- **WHEN** the cell size is 3.2 CSS px and the widest label is 17 CSS px
- **THEN** labels are drawn every 10 stitches (32 ≥ 21)

#### Scenario: Crowded labels
- **WHEN** the cell size is 1.6 CSS px and the widest label is 17 CSS px
- **THEN** labels are drawn every 20 stitches (16 < 21 ≤ 32)

#### Scenario: Very small cells
- **WHEN** the cell size is 0.5 CSS px and the widest label is 17 CSS px
- **THEN** labels are drawn every 50 stitches

### Requirement: Centre marker
The Chart layer SHALL mark the centre of the grid (W/2 stitches from the left, H/2 from the
top) with a black triangle in each ruler, in the 5 CSS px next to the grid edge and pointing at
the grid. Ruler labels SHALL NOT overlap the triangles.

#### Scenario: 100 × 67 pattern
- **WHEN** a 100 × 67 pattern is shown with the content rectangle at x 24, y 100, size 1000 × 670
- **THEN** the top ruler's triangle points down at x 524 (on the bold line 50) with its tip at y 100
- **AND** the left ruler's triangle points right at y 435 (the middle of row 33) with its tip at x 24

#### Scenario: Single-cell pattern
- **WHEN** a 1 × 1 pattern is shown with the content rectangle at x 24, y 100, size 20 × 20
- **THEN** the triangles point at x 34 and y 110, the middle of the only cell

### Requirement: Legend lists every color in number order
While a pattern exists, the app SHALL show a legend next to the frame with one row per legend
entry in number order, each row showing the number, a color swatch, the DMC code, the DMC name
and the stitch count with thousands separators. All values SHALL be inserted as text.

#### Scenario: Legend of the 3 × 2 pattern
- **WHEN** the 3 × 2 pattern is stored in the application state
- **THEN** the legend has 2 rows: `1`, swatch `#000000`, `310`, `Black`, `3` and `2`, swatch `#C72B3B`, `321`, `Red`, `2`

#### Scenario: Large stitch count
- **WHEN** a legend entry has 12345 stitches
- **THEN** its row shows `12,345`

#### Scenario: Name is shown literally
- **WHEN** a legend entry's name is `<b>Red</b>`
- **THEN** the row shows the text `<b>Red</b>` and the page contains no new `b` element

### Requirement: Legend is shown on every layer while a pattern exists
The legend SHALL be hidden while no pattern exists and SHALL be visible on all three layers
once one exists. When the pattern changes, its rows SHALL be replaced, not appended. A pattern
without stitches SHALL show `This pattern has no stitches.` instead of rows.

#### Scenario: No pattern
- **WHEN** an image is loaded but no pattern exists
- **THEN** the legend is not shown

#### Scenario: Switching layers keeps the legend
- **WHEN** a pattern exists and the user switches between `Original`, `DMC colors` and `Chart`
- **THEN** the legend stays visible with the same rows

#### Scenario: New pattern replaces the rows
- **WHEN** a pattern with 2 legend entries is replaced by one with 5 entries
- **THEN** the legend has exactly 5 rows

#### Scenario: Pattern without stitches
- **WHEN** a 2 × 2 pattern with all cells empty is stored
- **THEN** the legend shows `This pattern has no stitches.` and no rows

### Requirement: Legend is readable without color
The legend SHALL never rely on color alone: every row SHALL show its number, DMC code and name
as text, and every swatch SHALL have a visible border so light colors such as `BLANC` stand out
from the background. Legend numbers SHALL equal the numbers printed in the chart cells.

#### Scenario: White floss swatch
- **WHEN** the legend shows `BLANC` "White" `#FFFFFF`
- **THEN** its swatch has a 1 CSS px border in a non-white color and the row shows `BLANC` and `White`
