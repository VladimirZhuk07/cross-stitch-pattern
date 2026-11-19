# Spec Delta

## ADDED Requirements

### Requirement: One legend color can be selected
While a pattern with stitches exists, the user SHALL be able to select one legend color. It is
selected by a click or tap anywhere on its legend row, or by Enter or Space on the row's number
button. At most one color SHALL be selected at a time: selecting another row moves the
selection, and selecting the selected row again clears it. Each number button SHALL report its
state with `aria-pressed`.

#### Scenario: Selecting a row
- **WHEN** the legend of the 3 × 2 pattern (1 = `310`, 2 = `321`) is shown with nothing selected and the user clicks the row of `321`
- **THEN** color 2 is selected, its number button has `aria-pressed="true"` and the button of color 1 has `aria-pressed="false"`

#### Scenario: Moving the selection
- **WHEN** color 2 is selected and the user clicks the row of `310`
- **THEN** color 1 is selected and color 2 is not

#### Scenario: Clearing by selecting again
- **WHEN** color 2 is selected and the user clicks its row again
- **THEN** no color is selected and both buttons have `aria-pressed="false"`

#### Scenario: Keyboard
- **WHEN** the user tabs to the number button `2` and presses Enter, then Space
- **THEN** color 2 is selected after Enter and no color is selected after Space

#### Scenario: Button name
- **WHEN** the legend row of `321` "Red" with number 2 is read by a screen reader
- **THEN** its number button is named `Highlight color 2, DMC 321 Red`

### Requirement: Esc clears the selection
While a color is selected, pressing Esc anywhere on the page SHALL clear the selection. While
no color is selected, Esc SHALL do nothing.

#### Scenario: Esc with a selection
- **WHEN** color 2 is selected, the focus is in the frame and the user presses Esc
- **THEN** no color is selected and the Chart shows no highlighted cell

#### Scenario: Esc without a selection
- **WHEN** no color is selected and the user presses Esc in the `Width (stitches)` field
- **THEN** nothing changes and the field keeps its value

### Requirement: The selection follows the pattern and the view
The selection SHALL be cleared whenever the pattern changes (new image, new width or color
count) and SHALL be kept while the user switches view layers, zooms or pans. Selecting a color
while the `Original` or `DMC colors` layer is shown SHALL switch the view to `Chart`; clearing
the selection SHALL NOT switch the layer.

#### Scenario: New pattern
- **WHEN** color 2 is selected and the user changes the width from 100 to 120, so a new pattern is generated
- **THEN** no color is selected in the new legend and its Chart shows no highlighted cell

#### Scenario: Selecting on another layer
- **WHEN** the `DMC colors` layer is shown and the user clicks the legend row of color 3
- **THEN** the view switches to `Chart` with color 3 highlighted

#### Scenario: Switching layers keeps the selection
- **WHEN** color 3 is selected on the Chart, the user switches to `Original` and back to `Chart`
- **THEN** color 3 is still selected and highlighted, and the `Original` and `DMC colors` layers show no highlight

### Requirement: Highlighted cells are red with white numbers
On the Chart layer every cell of the selected color SHALL be filled with `#B00000` instead of
its pale tint. When numbers are shown, its number SHALL be drawn in bold `#FFFFFF` at the
normal number size. All other cells, empty cells, the hatch, grid lines and rulers SHALL look as
without a selection. White on `#B00000` has a contrast of 7.4:1, and `#B00000` against every
pale tint at least 3.4:1.

#### Scenario: 3 × 2 pattern in 20 px cells
- **WHEN** the 3 × 2 pattern (legend index 0 = `310` at cells (1, 0), (2, 0), (1, 1); index 1 = `321` at (0, 0), (2, 1); (0, 1) empty) is drawn in 20 px cells with color 2 selected
- **THEN** cells (0, 0) and (2, 1) are `#B00000` with a bold white `2`, cells (1, 0), (2, 0), (1, 1) keep the tint `#B0B0B0` with a black `1`, and (0, 1) stays grey and hatched without a number

#### Scenario: Numbers hidden
- **WHEN** the same pattern is drawn in 10 px cells (numbers hidden) with color 2 selected
- **THEN** cells (0, 0) and (2, 1) are filled `#B00000` and no number is drawn

#### Scenario: Contrast
- **WHEN** the contrast is computed with WCAG 2.x relative luminance
- **THEN** white on `#B00000` is at least 7.3:1, and `#B00000` against a tint with luminance 0.436 (the darkest possible tint) is at least 3.4:1

### Requirement: Highlighted stitches stay visible at every zoom
When a stitch is smaller than a device pixel, every device pixel that covers a stitch of the
selected color SHALL show the highlight in full strength (opaque, not averaged with the
surrounding stitches); one highlighted block SHALL be at most 2 × 2 device pixels. A single selected stitch SHALL therefore stay visible at Fit even in the largest
patterns. The highlight SHALL follow the same frame-by-frame build and memory rules as the
cell colors.

#### Scenario: One stitch in a large pattern
- **WHEN** a 4000 × 4000 pattern has exactly one stitch of color 5, at column 1234, row 2345, it is shown at Fit in a 736 × 748 CSS px frame at pixel ratio 1 (0.18 px per stitch), and color 5 is selected
- **THEN** once built, the device pixel at that stitch's position is fully opaque `#B00000`, and so is every device pixel of the square of at most 2 × 2 device pixels that stands for its block

#### Scenario: Zoomed in on a large pattern
- **WHEN** the same pattern is zoomed in to 20 px per stitch around that stitch
- **THEN** that one cell is `#B00000` with a bold white `5`, and its neighbours keep their tints

#### Scenario: Progressive build
- **WHEN** color 5 of a 10000 × 10000 pattern is selected at Fit
- **THEN** the cell colors stay visible while the highlight is being built over the following frames, and no single frame reads more stitches for the highlight than for the cell colors

### Requirement: The selected legend row stands out
The selected row SHALL show its number box in `#B00000` with a bold white number, like its
chart cells, bold text, and a 3 CSS px accent border on its left edge, so the selection is not
shown by color alone. Other rows SHALL keep their normal look.

#### Scenario: Selected row
- **WHEN** color 2 (`321` "Red") is selected
- **THEN** its number box is `#B00000` with a bold white `2`, its texts `321`, `Red` and `2` are bold, it has a 3 px left border, and the row of color 1 looks unchanged

#### Scenario: Selection cleared
- **WHEN** the selection is cleared
- **THEN** every row's number box shows its pale tint with a black number again, and no row has the left border
