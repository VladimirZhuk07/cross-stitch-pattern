# Spec Delta

## Purpose

Lets the user tick off the stitches they have sewn on a Progress view of the pattern, see how
much is done, and not lose that work by accident.

## ADDED Requirements

### Requirement: The Progress layer starts as the Chart
The app SHALL offer a `Progress` view layer, available exactly when a pattern exists. A cell
that is not marked as stitched SHALL look exactly as on the Chart layer: tint, number, hatch,
grid lines, rulers and centre marker. A new pattern SHALL start with no stitch marked.

#### Scenario: Fresh pattern
- **WHEN** a 100 × 67 pattern is generated and the user switches to `Progress`
- **THEN** the frame shows the same cells, numbers, lines and rulers as `Chart` at the same zoom, and the counter reads `Stitched 0 of 6,700 (0 %)`

#### Scenario: New pattern resets the marks
- **WHEN** 12 stitches are marked and a new pattern is stored (for example after the user confirmed a width change)
- **THEN** no stitch of the new pattern is marked

### Requirement: A tap or click toggles a stitch
On the Progress layer, a press of the primary mouse button, a pen or one finger that ends within
8 CSS px of where it started, without a second finger touching meanwhile, SHALL toggle the cell
under the release point between not stitched and stitched. Empty cells and points outside the
grid SHALL NOT change. Drags SHALL keep panning and two-finger gestures keep pinch-zooming; they
SHALL NOT toggle anything. On the other layers taps SHALL NOT mark stitches.

#### Scenario: Tapping a cell
- **WHEN** the Progress layer shows a pattern in 20 px cells with its top-left at (0, 0) and the user clicks at (50, 30) without moving
- **THEN** cell (column 2, row 1) becomes stitched and the counter goes up by one; clicking there again makes it not stitched

#### Scenario: Small wobble still counts
- **WHEN** a finger touches at (50, 30), moves to (56, 34) (7.2 px away) and lifts
- **THEN** the cell under (56, 34) is toggled

#### Scenario: A drag pans
- **WHEN** a finger touches at (50, 30), moves to (60, 30) (10 px) and lifts
- **THEN** the view is panned by 10 px and no cell is toggled

#### Scenario: Pinch
- **WHEN** a second finger touches before the first lifts
- **THEN** the view pinch-zooms as before and no cell is toggled when the fingers lift

#### Scenario: Empty cell and outside the grid
- **WHEN** the user clicks an empty (hatched) cell, or the ruler, or the frame outside the grid
- **THEN** nothing is marked and the counter does not change

#### Scenario: Other layers
- **WHEN** the Chart layer is active and the user clicks a cell
- **THEN** nothing is marked

### Requirement: Stitched cells show their DMC color
A stitched cell SHALL be filled with its full DMC color, the same color as on the `DMC colors`
layer, and SHALL show no number. Hatching, grid lines, rulers and the centre marker SHALL be drawn
over it as on the Chart. When a picture pixel covers a block of several stitches (zoomed out on a
large pattern), it SHALL average the DMC colors of the block's stitched cells over the tints. A
fully stitched block shows only DMC colors, a block without stitched cells only tints.

#### Scenario: One stitched cell
- **WHEN** cell (2, 1) of the 3 × 2 pattern, whose legend entry is `321` `#C72B3B`, is stitched and the layer is drawn in 20 px cells
- **THEN** that cell is filled `#C72B3B` with no number, its neighbours keep their tints and numbers, and the grid lines around it are drawn

#### Scenario: Fully stitched block zoomed out
- **WHEN** a 4000 × 4000 pattern whose top-left 8 × 8 stitches are all stitched `310` `#000000` is shown at Fit (one picture pixel per 4 × 4 or 8 × 8 stitches)
- **THEN** the pixels of that corner are `#000000`, and pixels of blocks without stitched cells show the tints as on the Chart

#### Scenario: Marking updates at once
- **WHEN** the user toggles a cell of a 4000 × 4000 pattern
- **THEN** the cell changes in the next painted frame, without rebuilding the pictures of the whole pattern

### Requirement: Stitches can be marked with the keyboard
When the frame receives keyboard focus (`:focus-visible`) on the Progress layer, the layer SHALL
outline the cell at the frame centre with a 2 CSS px marker (black over white, visible on any
color). Space or Enter SHALL toggle that cell, and Shift together with an arrow key SHALL move
the view by exactly one cell. The other keys keep their meaning. The marker SHALL disappear when
the frame loses focus or was focused by a pointer.

#### Scenario: Toggling with Space
- **WHEN** the user tabs to the frame on the Progress layer, the centre is over cell (40, 30), and the user presses Space
- **THEN** a marker outlines cell (40, 30), the cell becomes stitched, and the counter text is announced

#### Scenario: Next cell
- **WHEN** the user then presses Shift + Right Arrow and Enter
- **THEN** the view moves left by one cell width, the marker is over cell (41, 30), and that cell becomes stitched

#### Scenario: Mouse focus
- **WHEN** the user clicks into the frame instead
- **THEN** no centre marker is drawn

### Requirement: A counter shows the progress
While the Progress layer is active, a line under the frame SHALL read
`Stitched S of T (P %)`. S is the number of stitched cells and T the number of non-empty cells
of the pattern, both with thousands separators. P is `floor(1000 × S / T) / 10` with one
decimal, or a whole `0` or `100`. The line SHALL be in a polite live region and hidden on the
other layers. A pattern without stitches SHALL read `Nothing to stitch in this pattern.`

#### Scenario: Partly done
- **WHEN** 1234 of 6700 cells are stitched
- **THEN** the line reads `Stitched 1,234 of 6,700 (18.4 %)`

#### Scenario: Almost done
- **WHEN** 6699 of 6700 cells are stitched
- **THEN** the line reads `Stitched 6,699 of 6,700 (99.9 %)`, never `100 %`

#### Scenario: Done and nothing
- **WHEN** all 6700 cells are stitched, or none
- **THEN** the line reads `Stitched 6,700 of 6,700 (100 %)`, respectively `Stitched 0 of 6,700 (0 %)`

#### Scenario: Other layer
- **WHEN** the user switches to `Chart`
- **THEN** the counter line is not shown

### Requirement: The highlight shows the stitches still to do
On the Progress layer, a color selected in the legend SHALL be highlighted as on the Chart, in
red with bold white numbers, but only in its cells that are not stitched. Its stitched cells
SHALL show their DMC color. Selecting a legend color while the Progress layer is shown SHALL keep
the Progress layer.

#### Scenario: Highlight with some cells done
- **WHEN** color 2 of the 3 × 2 pattern (cells (0, 0) and (2, 1)) is selected on Progress and (2, 1) is stitched
- **THEN** cell (0, 0) is `#B00000` with a bold white `2`, and cell (2, 1) is `#C72B3B` without a number

#### Scenario: Selecting on Progress
- **WHEN** the Progress layer is shown and the user clicks a legend row
- **THEN** the color is highlighted and the Progress layer stays active

### Requirement: Changing the pattern settings asks first
While at least one stitch is marked, a committed change of the width or the max colors SHALL
open a modal dialog before any new pattern is generated. It reads
`Change the pattern settings? Your progress on this pattern (S of T stitches) will be lost.`
and has the buttons `Keep my progress` (focused first) and `Change settings`. `Change settings`
SHALL apply the new value. `Keep my progress`, Esc or closing the dialog SHALL put the field
back to the value in use and keep pattern and progress.

#### Scenario: Width change confirmed
- **WHEN** 12 stitches are marked, the user types `120` into the width (in use: 100), presses Enter and then `Change settings`
- **THEN** exactly one 120-wide pattern is generated and no stitch is marked

#### Scenario: Width change cancelled
- **WHEN** the user does the same but presses `Keep my progress` (or Esc)
- **THEN** the width field shows `100` again, no pattern is generated, and the 12 stitches stay marked

#### Scenario: Nothing marked
- **WHEN** no stitch is marked and the user changes the max colors
- **THEN** no dialog appears and the pattern is generated as usual

#### Scenario: Fabric count
- **WHEN** 12 stitches are marked and the user changes the fabric from 14 ct to 16 ct
- **THEN** no dialog appears, the finished size updates, and the stitches stay marked

### Requirement: Loading another image asks first
While at least one stitch is marked, choosing or dropping a new image SHALL first open the same
dialog with the text `Load NAME? Your progress on the current pattern (S of T stitches) will be
lost.` and the buttons `Keep my progress` (focused first) and `Load image`. `Load image` SHALL
load the image as usual. `Keep my progress`, Esc or closing SHALL keep image, pattern and
progress and SHALL reset the file chooser, so the same file can be chosen again.

#### Scenario: New photo confirmed
- **WHEN** 12 stitches are marked and the user drops `cat.png` on the frame and presses `Load image`
- **THEN** `cat.png` is loaded, its pattern is generated, and no stitch is marked

#### Scenario: New photo cancelled
- **WHEN** the user chooses `cat.png` with `Choose image` and presses `Keep my progress`
- **THEN** the current image, pattern and 12 marked stitches stay, and choosing `cat.png` again opens the dialog again

#### Scenario: Name shown literally
- **WHEN** the dropped file is named `<b>x</b>.png`
- **THEN** the dialog shows the text `Load <b>x</b>.png? …` and the page contains no new `b` element
