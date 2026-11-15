# pattern-viewer Specification

## Purpose

Shows the loaded image and, later, the pattern views in one shared frame where the user
switches between view layers and zooms and pans with a position shared by all layers.

## Requirements

### Requirement: One frame shows exactly one view layer
The app SHALL have a single view frame. Exactly one view layer SHALL be visible in it at a
time; the other layers SHALL not be drawn.

#### Scenario: Original layer is active
- **WHEN** `photo.png` is loaded and the Original layer is active
- **THEN** the frame shows `photo.png` and nothing from the DMC colors or Chart layers

### Requirement: Layer switcher offers Original, DMC colors and Chart
The app SHALL show a labelled, keyboard-operable layer switcher with exactly three options in
this order: `Original`, `DMC colors`, `Chart`. `Original` SHALL always be selectable.
`DMC colors` and `Chart` SHALL be disabled while no pattern exists and enabled once one exists.

#### Scenario: No pattern yet
- **WHEN** the app has just started, or an image is loaded but no pattern has been generated
- **THEN** `Original` is selected, and `DMC colors` and `Chart` are visible but disabled

#### Scenario: Pattern becomes available
- **WHEN** a pattern is stored in the application state
- **THEN** `DMC colors` and `Chart` become enabled and can be selected with mouse or keyboard

### Requirement: An unavailable active layer falls back to Original
If the active layer becomes unavailable, the app SHALL switch to the Original layer.

#### Scenario: Pattern is cleared while Chart is active
- **WHEN** the Chart layer is active and the pattern is cleared (for example by loading a new image)
- **THEN** the Original layer becomes active and `Chart` is disabled

### Requirement: Content can be fitted to the frame
The app SHALL fit the image into the frame with a 24 CSS px margin on each side, as large as
possible while keeping its aspect ratio, and centered. Zoom 100 % means one CSS pixel per
pixel of the image used by the app. Fitting SHALL happen when an image loads, when the user
presses the `Fit` button, and when the user presses `0` while the frame has focus.

#### Scenario: Wide image in a landscape frame
- **WHEN** a 2000 × 1000 px image is fitted into a 1000 × 800 CSS px frame
- **THEN** the zoom is 47.6 % and the image is drawn at x 24, y 162 with size 952 × 476 CSS px

#### Scenario: Small image is enlarged to fit
- **WHEN** a 100 × 50 px image is fitted into a 1000 × 800 CSS px frame
- **THEN** the zoom is 952 % and the image is drawn at x 24, y 162 with size 952 × 476 CSS px

#### Scenario: Frame has no size
- **WHEN** the frame is 0 CSS px wide (for example while hidden)
- **THEN** nothing is drawn and no error is shown

### Requirement: Zoom keeps the point under the cursor in place
The app SHALL zoom in steps of ×1.25 with the `+`/`−` buttons and the `+`/`-` keys (around the
frame center) and with the mouse wheel (around the cursor; one 100 px wheel step = one step).
The image point at the zoom anchor SHALL stay at the same screen position. Zoom SHALL be
limited to between half the fit zoom and the largest of 6400 %, the fit zoom and, while a
pattern exists, the zoom at which one stitch is 64 CSS px wide
(`64 × pattern width / image width`, as a scale). The current zoom SHALL be shown as a whole
percentage.

#### Scenario: Wheel zoom at the cursor
- **WHEN** the zoom is 100 % with the image's top-left at (0, 0) and the user scrolls up one step with the cursor at (100, 50)
- **THEN** the zoom is 125 %, the image's top-left is at (−25, −12.5), and the image point under the cursor stays at (100, 50)

#### Scenario: Zoom-in button
- **WHEN** the zoom is 200 % and the user presses `+`
- **THEN** the zoom is 250 % and the image point at the frame center stays at the center

#### Scenario: Upper zoom limit
- **WHEN** the zoom is 6000 % and the user zooms in one step
- **THEN** the zoom is 6400 %, and further zoom-in steps leave it at 6400 %

#### Scenario: Lower zoom limit
- **WHEN** the fit zoom is 48.4 % and the user zooms out repeatedly
- **THEN** the zoom stops at 24.2 %

#### Scenario: Huge pattern from a small image
- **WHEN** a 1000 × 800 px image has a 10000 × 8000 pattern and the user zooms in repeatedly
- **THEN** the zoom stops at 64000 % (scale 640), where one stitch is 64 CSS px wide

#### Scenario: Pattern coarser than the image keeps 6400 %
- **WHEN** a 1000 × 800 px image has a 100 × 80 pattern and the user zooms in repeatedly
- **THEN** the zoom stops at 6400 % (one stitch is then 640 CSS px wide)

#### Scenario: No pattern yet
- **WHEN** a 1000 × 800 px image is loaded and no pattern exists
- **THEN** the zoom stops at 6400 %

### Requirement: The view can be panned
The app SHALL pan the view when the user drags in the frame with a mouse, pen, or one finger,
and by 50 CSS px per press of an arrow key while the frame has focus.

#### Scenario: Dragging the image
- **WHEN** the image's top-left is at (16, 158) and the user drags by (+30, −20) CSS px
- **THEN** the image's top-left is at (46, 138) and the zoom is unchanged

#### Scenario: Arrow key
- **WHEN** the image's top-left is at (16, 158) and the user presses ArrowRight
- **THEN** the view scrolls right: the image's top-left is at (−34, 158)

### Requirement: Zoom and pan are shared by all layers
Zoom and pan SHALL belong to the frame, not to a layer. Switching layers SHALL keep the zoom
and the image's position on screen unchanged.

#### Scenario: Switching to DMC colors and back
- **WHEN** a pattern exists, the Original layer is shown at 250 % with the image's top-left at (−300, −120), and the user selects `DMC colors` and then `Original`
- **THEN** both layers are drawn at 250 % with the image's top-left at (−300, −120)

### Requirement: Resizing the frame keeps the view centered
When the frame changes size, the app SHALL keep the zoom and keep the image point that was at
the frame center at the new frame center.

#### Scenario: Window becomes narrower
- **WHEN** the frame shrinks from 1000 × 800 to 800 × 800 CSS px with the image's top-left at (16, 158)
- **THEN** the zoom is unchanged and the image's top-left is at (−84, 158)

### Requirement: Rendering is crisp on high-DPI screens
The frame canvas SHALL have a drawing buffer of the frame's CSS size multiplied by the
device pixel ratio, rounded to whole pixels, and SHALL update it when either changes.

#### Scenario: Retina screen
- **WHEN** the frame is 800 × 600 CSS px and the device pixel ratio is 2
- **THEN** the canvas drawing buffer is 1600 × 1200 px and it is displayed at 800 × 600 CSS px

#### Scenario: Fractional ratio
- **WHEN** the frame is 801 × 601 CSS px and the device pixel ratio is 1.25
- **THEN** the canvas drawing buffer is 1001 × 751 px

### Requirement: All layers paint into the same content rectangle
Every layer SHALL draw into one shared content rectangle: the image rectangle transformed by
the current zoom and pan. A pattern grid of W × H stitches SHALL cover this whole rectangle,
column c spanning c/W to (c+1)/W of its width and row r spanning r/H to (r+1)/H of its height.

#### Scenario: Grid aligned with the image
- **WHEN** the image is 2048 × 1365 px, the zoom is 50 % and the image's top-left is at (10, 20)
- **THEN** the content rectangle is x 10, y 20, 1024 × 682.5 CSS px for every layer
- **AND** for a 100 × 67 stitch grid, stitch (column 0, row 0) spans x 10 to 20.24 and y 20 to about 30.19

### Requirement: Empty frame invites the user to load an image
While no image is loaded, the frame SHALL show the text `Choose an image or drop it here`, and
the zoom and Fit controls SHALL be disabled.

#### Scenario: First start
- **WHEN** the app is opened for the first time
- **THEN** the frame shows `Choose an image or drop it here` and the `+`, `−` and `Fit` buttons are disabled
