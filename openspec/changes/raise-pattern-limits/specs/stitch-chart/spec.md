# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Numbers are hidden in cells smaller than 14 CSS px`
- TO: `### Requirement: Numbers are hidden in cells smaller than 19 CSS px`

## MODIFIED Requirements

### Requirement: Number size follows the cell size
Cell numbers SHALL use one font size for the whole chart: 0.45 × the cell size in CSS px, so a
three-digit number (up to `489`) fits in a cell with room to the grid lines, whatever the
number of colors in the pattern. The size SHALL follow the zoom.

#### Scenario: 20 px cells
- **WHEN** the cell size is 20 CSS px
- **THEN** numbers are drawn at 9 CSS px, `1` and `489` alike

#### Scenario: Non-square cells use the smaller side
- **WHEN** cells are 24 CSS px wide and 20 CSS px high
- **THEN** numbers are drawn at 9 CSS px

#### Scenario: Large cells
- **WHEN** the cell size is 50 CSS px
- **THEN** numbers are drawn at 22.5 CSS px

#### Scenario: Same size for a 2-color pattern
- **WHEN** a pattern with 2 legend entries is shown with 20 CSS px cells
- **THEN** its numbers are drawn at 9 CSS px, the same as in a pattern with 489 entries

#### Scenario: Three digits fit the smallest numbered cell
- **WHEN** `489` is drawn in a 19 CSS px cell (font 8.55 CSS px, digits about 0.55 em wide)
- **THEN** the text is about 14.1 CSS px wide and leaves about 2.4 CSS px to each side of the cell

### Requirement: Numbers are hidden in cells smaller than 19 CSS px
When the cell size is below 19 CSS px the Chart layer SHALL draw no cell numbers (only cells,
grid lines and rulers), because a three-digit number would be smaller than 8.55 CSS px and
illegible. From 19 CSS px up all visible numbers SHALL be drawn.

#### Scenario: Just below the threshold
- **WHEN** the cell size is 18.9 CSS px
- **THEN** no cell number is drawn and the grid lines are drawn

#### Scenario: At the threshold
- **WHEN** the cell size is 19 CSS px
- **THEN** every visible stitched cell shows its number at 8.55 CSS px

#### Scenario: Zooming in reveals the numbers
- **WHEN** a 100 × 100 pattern is fitted into a 1000 × 800 frame (cell size 7.52) and the user zooms in 4 steps (cell size about 18.36), then 1 more step (cell size about 22.95)
- **THEN** after 4 steps no numbers are shown and after 5 steps the numbers are shown at about 10.33 CSS px

### Requirement: Legend lists every color in number order
While a pattern exists, the app SHALL show a legend next to the frame with one row per legend
entry in number order, each row showing the number on the color's pale tint (as in the chart),
a color swatch, the DMC code, the DMC name and the stitch count with thousands separators.
All values SHALL be inserted as text. The number boxes SHALL have the same width in every row,
wide enough for a three-digit number.

#### Scenario: Legend of the 3 × 2 pattern
- **WHEN** the 3 × 2 pattern is stored in the application state
- **THEN** the legend has 2 rows: `1` on `#B0B0B0`, swatch `#000000`, `310`, `Black`, `3` and `2` on `#FFC0BB`, swatch `#C72B3B`, `321`, `Red`, `2`

#### Scenario: Large stitch count
- **WHEN** a legend entry has 12345 stitches
- **THEN** its row shows `12,345`

#### Scenario: Name is shown literally
- **WHEN** a legend entry's name is `<b>Red</b>`
- **THEN** the row shows the text `<b>Red</b>` and the page contains no new `b` element

#### Scenario: Three-digit numbers
- **WHEN** a pattern with 150 legend entries is shown
- **THEN** rows `1`, `10` and `150` have number boxes of equal width and `150` fits inside its box without overflowing
