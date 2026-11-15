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
frame center) and with the mouse wheel without the Ctrl key (around the cursor; one 100 px wheel step =
one step). The image point at the zoom anchor SHALL stay at the same screen position. Zoom SHALL be
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

### Requirement: Two-finger pinch zooms and pans around the fingers' midpoint
While two fingers touch the frame, the app SHALL scale the zoom by the ratio of the current to
the previous distance between the fingers, around the midpoint between them, and SHALL move the
view by the movement of that midpoint. The image point under the midpoint SHALL stay under the
midpoint. Zoom SHALL stay within the zoom limits. Fingers less than 1 CSS px apart SHALL only pan.

#### Scenario: Spreading the fingers to twice the distance
- **WHEN** the zoom is 100 % with the image's top-left at (0, 0) and two fingers move from (100, 100) and (200, 100) to (50, 100) and (250, 100)
- **THEN** the zoom is 200 %, the image's top-left is at (−150, −100), and the image point under the midpoint (150, 100) is still drawn at (150, 100)

#### Scenario: Moving both fingers together pans
- **WHEN** the zoom is 100 % with the image's top-left at (0, 0) and two fingers move from (100, 100) and (200, 100) to (130, 140) and (230, 140)
- **THEN** the zoom is still 100 % and the image's top-left is at (30, 40)

#### Scenario: Spreading and moving at the same time
- **WHEN** the zoom is 100 % with the image's top-left at (0, 0) and two fingers move from (100, 100) and (200, 100) to (80, 150) and (280, 150)
- **THEN** the zoom is 200 %, the image's top-left is at (−120, −50), and the image point that was under the old midpoint (150, 100) is drawn under the new midpoint (180, 150)

#### Scenario: Upper zoom limit
- **WHEN** no pattern exists, the zoom is 4000 % with the image's top-left at (0, 0) and two fingers move from (100, 100) and (200, 100) to (50, 100) and (250, 100)
- **THEN** the zoom is 6400 % (not 8000 %), the image's top-left is at (−90, −60), and the image point under the midpoint stays at (150, 100)

#### Scenario: Upper zoom limit of a fine pattern
- **WHEN** a 1000 × 800 px image fitted in a 1000 × 800 CSS px frame has a 10000 × 8000 pattern, the zoom is 40000 % with the image's top-left at (0, 0), and two fingers move from (100, 100) and (200, 100) to (50, 100) and (250, 100)
- **THEN** the zoom is 64000 % (one stitch is 64 CSS px wide; not 80000 %) and the image's top-left is at (−90, −60)

#### Scenario: Lower zoom limit
- **WHEN** the fit zoom is 100 % (lower limit 50 %), the zoom is 80 % with the image's top-left at (0, 0), and two fingers move from (100, 100) and (200, 100) to (125, 100) and (175, 100)
- **THEN** the zoom is 50 % (not 40 %) and the image's top-left is at (56.25, 37.5)

#### Scenario: Fingers reported at the same position
- **WHEN** the zoom is 100 % with the image's top-left at (0, 0) and two touch points both reported at (100, 100) both move to (120, 120)
- **THEN** the zoom is still 100 %, the image's top-left is at (20, 20), and no error is shown

### Requirement: Changing the number of fingers never makes the view jump
Putting down or lifting a finger SHALL NOT change the view by itself. After one of two fingers
is lifted, the remaining finger SHALL pan from its current position. A third or further
simultaneous finger SHALL be ignored. When the browser cancels the touches, the gesture SHALL
end and the view SHALL stay as it was after the last movement.

#### Scenario: Second finger lands during a one-finger pan
- **WHEN** one finger is dragging at (100, 100) and a second finger touches at (200, 100)
- **THEN** the zoom and the image's position are unchanged until a finger moves, and then they follow the two-finger pinch rules

#### Scenario: Lifting one of two fingers
- **WHEN** after a pinch the fingers rest at (50, 100) and (250, 100) with the zoom at 200 % and the image's top-left at (−150, −100), the first finger is lifted, and the second moves from (250, 100) to (270, 90)
- **THEN** the zoom is still 200 % and the image's top-left is at (−130, −110)

#### Scenario: Third finger is ignored
- **WHEN** two fingers rest at (100, 100) and (200, 100) with the zoom at 100 % and the image's top-left at (0, 0), and a third finger touches at (300, 300) and moves to (340, 300)
- **THEN** the zoom is still 100 % and the image's top-left is still at (0, 0)

#### Scenario: Browser cancels the touches
- **WHEN** during a pinch the zoom is 180 % and the browser cancels the touches (for example because of an incoming call), after which the same fingers keep moving
- **THEN** the zoom stays 180 %, the image does not move, and a new touch starts a new pan or pinch

### Requirement: Touch gestures over the frame do not zoom or scroll the page
The frame SHALL not let the browser pan or zoom the page for touches that start on it, so a
pinch or a double tap there never changes the page zoom. Outside the frame, the browser's own
scrolling and zooming SHALL be unchanged.

#### Scenario: Pinch over the frame on a phone
- **WHEN** an image is shown and the user pinches two fingers apart over the frame
- **THEN** the view zooms, and the page zoom (the visual viewport scale) stays 1 and the page does not scroll

#### Scenario: Double tap on the frame
- **WHEN** the user double-taps the frame
- **THEN** neither the page zoom nor the view's zoom changes

#### Scenario: Pinch outside the frame
- **WHEN** the user pinches two fingers apart over the settings panel
- **THEN** the browser zooms the page as usual

#### Scenario: Touch behavior of the frame and the page
- **WHEN** the app is loaded
- **THEN** the computed `touch-action` of the frame is `none` and that of the page body is `auto`

### Requirement: Trackpad pinch via Ctrl + wheel follows the fingers
A wheel event with the Ctrl key held (how Chrome, Edge and Firefox report a trackpad pinch)
SHALL zoom around the cursor by the factor e^(−d / 100), where d is the event's vertical delta
in CSS px limited to −50 … +50, within the zoom limits. It SHALL NOT zoom the page.

#### Scenario: Pinching out on a trackpad
- **WHEN** the zoom is 100 % with the image's top-left at (0, 0) and a Ctrl + wheel event with a vertical delta of −40 px arrives with the cursor at (100, 50)
- **THEN** the zoom is 149 % (factor 1.4918), the image's top-left is at about (−49.18, −24.59), and the page zoom is unchanged

#### Scenario: Ctrl + mouse-wheel notch is limited
- **WHEN** the zoom is 100 % with the image's top-left at (0, 0) and a Ctrl + wheel event with a vertical delta of +100 px arrives with the cursor at (100, 50)
- **THEN** the delta counts as +50 px: the zoom is 61 % (factor 0.6065) and the image's top-left is at about (39.35, 19.67)

#### Scenario: At the upper limit
- **WHEN** no pattern exists, the zoom is 6400 % and a Ctrl + wheel event with a vertical delta of −40 px arrives
- **THEN** the zoom stays 6400 %

### Requirement: Safari pinch gestures zoom the view, not the page
Safari pinch gesture events over the frame SHALL zoom the view around the gesture position by
the ratio of the gesture's scale to its scale at the previous gesture event, within the zoom
limits, and SHALL NOT zoom the page. While fingers are already tracked as touches, gesture
events SHALL NOT zoom again.

#### Scenario: Mac trackpad pinch in Safari
- **WHEN** the zoom is 100 % with the image's top-left at (0, 0) and a pinch at (100, 50) changes the gesture scale from 1 to 1.5
- **THEN** the zoom is 150 %, the image's top-left is at (−50, −25), and the page zoom is unchanged

#### Scenario: Pinching back in the same gesture
- **WHEN** the zoom is 150 % with the image's top-left at (−50, −25) and the same gesture's scale goes from 1.5 to 1.2 at (100, 50)
- **THEN** the zoom is 120 % and the image's top-left is at (−20, −10)

#### Scenario: Touch pinch on an iPhone is applied once
- **WHEN** on an iPhone the zoom is 100 % and two fingers on the frame spread from 100 px to 200 px apart
- **THEN** the zoom is 200 %, not 400 %
