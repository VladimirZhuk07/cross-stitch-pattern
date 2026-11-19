# Spec Delta

## MODIFIED Requirements

### Requirement: Desktop and medium layouts stay unchanged
On wide and medium windows with both side panels open, the app SHALL keep its existing layout:
wide shows settings (16rem), frame and legend (24rem) side by side; medium shows settings and
frame side by side with the legend below them. The compact `Settings` and `Legend` toggle
buttons SHALL NOT be shown there; the only panel controls are the side toggles (see "Side
panels fold to their edge on wide and medium screens"). The settings fields and legend rows
SHALL be visible whenever their panel is open.

#### Scenario: Desktop window
- **WHEN** the window is 1440 × 900 with a pattern and both panels open
- **THEN** the settings column is 256 px wide, the legend 384 px wide, the frame fills the rest, no compact `Settings` or `Legend` toggle is visible, and one side toggle is visible in each panel

#### Scenario: Tablet portrait
- **WHEN** the window is 820 × 1180 (medium) with a pattern and both panels open
- **THEN** settings and frame are side by side and the legend is below them, across the full width, at most 472 px (40 % of the height) tall

## ADDED Requirements

### Requirement: Side panels fold to their edge on wide and medium screens
On wide and medium screens the settings panel SHALL fold to the left edge and the legend to its
own edge: the right edge on wide screens, the bottom edge on medium screens. A folded panel
SHALL shrink to a rail 2.75rem (44 px) wide (a 44 px tall bar for the medium legend). The rail
SHALL show only that panel's side toggle, and the frame SHALL take the freed space. Each panel
folds independently.

#### Scenario: Folding the settings on a desktop
- **WHEN** the window is 1440 × 900 with a pattern, both panels open (frame column 736 px wide), and the user presses the settings side toggle
- **THEN** the settings become a 44 px rail at the left edge showing only `Settings`, the width, color and fabric fields are not visible, and the frame column is 948 px wide

#### Scenario: Both panels folded on a desktop
- **WHEN** the user then also presses the legend side toggle
- **THEN** the legend becomes a 44 px rail at the right edge showing only `Legend`, no legend rows are visible, and the frame column is 1288 px wide

#### Scenario: Folding the legend on a tablet
- **WHEN** the window is 820 × 1180 (medium) with a pattern and the user presses the legend side toggle
- **THEN** the legend becomes a 44 px tall bar across the full width at the bottom of the page content (no gap below it), showing only `Legend`, and the settings and frame fill all the height above it (the frame grows from 406 px to 919 px tall)

#### Scenario: Folding the settings on a tablet
- **WHEN** the window is 820 × 1180 with both panels open (frame column 516 px wide) and the user presses the settings side toggle
- **THEN** the settings become a 44 px rail at the left and the frame column is 728 px wide

#### Scenario: Opening a folded panel
- **WHEN** the settings are folded and the user presses the `Settings` rail toggle
- **THEN** the settings column is 256 px wide again with all fields, the size text and the generation status visible

#### Scenario: No pattern yet
- **WHEN** no pattern exists on a 1440 × 900 window
- **THEN** the settings side toggle is shown and neither the legend nor its side toggle is shown

### Requirement: Side toggles are accessible buttons
Each side toggle SHALL be a native button named `Settings` or `Legend`, SHALL report its state
with `aria-expanded` (`"true"` while the panel is open), and SHALL name its panel with
`aria-controls`. Its tooltip SHALL read `Hide settings` / `Show settings` (`Hide legend` /
`Show legend`) for the current state. Enter, Space or a click SHALL toggle it. Focus SHALL stay
on it after toggling, with a visible focus ring. It SHALL be at least 44 × 44 px on coarse pointers.

#### Scenario: Keyboard folding
- **WHEN** the settings side toggle has focus with `aria-expanded="true"` and the user presses Enter
- **THEN** the settings fold, the toggle keeps focus with a visible focus ring, `aria-expanded` is `"false"` and the tooltip reads `Show settings`; pressing Space opens the panel again and sets `aria-expanded="true"`

#### Scenario: Markup
- **WHEN** `index.html` is read
- **THEN** the settings and legend panels each contain exactly one side toggle `<button type="button">` whose `aria-controls` is the id of the panel that contains it

#### Scenario: Touch tablet
- **WHEN** the window is 1024 × 1366 with a coarse pointer and the legend is folded
- **THEN** the `Legend` rail toggle is at least 44 × 44 px

### Requirement: Folded state is remembered across page loads
The app SHALL store the open/folded state of both side panels in the browser's local storage
under the key `cross-stitch-pattern-maker:side-panels` and SHALL restore it on page load
before the first pattern is shown. Without a stored value, with a value it cannot read, or when
storage is blocked, both panels SHALL start open. No message is shown in these cases. A failed
write SHALL NOT interrupt the app.

#### Scenario: Reloading after folding
- **WHEN** the user folds the legend on a 1440 × 900 window and reloads the page
- **THEN** the stored value is `{"settings":"open","legend":"folded"}`, and once a pattern exists the legend is a folded rail while the settings are open

#### Scenario: First visit
- **WHEN** nothing is stored under the key
- **THEN** both panels start open

#### Scenario: Unreadable stored value
- **WHEN** the stored value is `not json`, or `{"settings":"sideways"}`
- **THEN** both panels start open for the first value; for the second, the settings start open (unknown value) and the legend starts open (missing value)

#### Scenario: Storage blocked
- **WHEN** the browser throws on every local storage access (e.g. storage disabled)
- **THEN** both panels start open, folding still works for the session, and no error is shown

### Requirement: Folding keeps the view centred
When a side panel folds or opens, the zoom SHALL stay the same and the image point at the frame
centre SHALL stay at the frame centre, as for any other frame resize.

#### Scenario: Folding the settings at a fixed zoom
- **WHEN** a pattern is shown at 400 % with stitch (120, 80) at the frame centre and the user folds the settings
- **THEN** the zoom still reads 400 % and stitch (120, 80) is still at the frame centre

### Requirement: Folded settings open when generation needs the user
While the settings panel is folded, it SHALL open by itself (and store the open state) when the
generation status becomes waiting for **Generate** (a large pattern) or failed, so that the
message and the Generate button are visible. Other status changes SHALL NOT open it.

#### Scenario: Large pattern while folded
- **WHEN** the settings are folded, the width is 2001, and a 1000 × 1000 px image is loaded
- **THEN** the settings open, `This pattern has 4,004,001 stitches. … Press Generate to start.` and the Generate button are visible, and the stored settings state is `open`

#### Scenario: Generation error while folded
- **WHEN** the settings are folded and the worker answers with the error `boom`
- **THEN** the settings open and show `Could not generate the pattern: boom`

#### Scenario: Normal generation while folded
- **WHEN** the settings are folded and a 100 × 67 pattern is generated successfully
- **THEN** the settings stay folded

### Requirement: Compact screens and printing ignore the side state
Side toggles SHALL NOT be shown on compact screens or in print. On compact screens the panels
SHALL behave as the compact requirements describe, whatever side state is stored. When
printing, the panels SHALL print as if they were open. The side state SHALL survive a resize to
compact and back.

#### Scenario: Resizing to a phone width and back
- **WHEN** both panels are folded at 1440 × 900, the window is narrowed to 375 × 667, then widened to 1440 × 900 again
- **THEN** at 375 px no side toggle is visible and the compact `Settings` and `Legend` toggles work as before; at 1440 px both panels are folded rails again

#### Scenario: Printing with a folded legend
- **WHEN** the legend is folded on a desktop and the user prints
- **THEN** no side toggle is printed and the legend rows are printed
