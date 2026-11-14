# Spec Delta

## ADDED Requirements

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
- **WHEN** the zoom is 4000 % with the image's top-left at (0, 0) and two fingers move from (100, 100) and (200, 100) to (50, 100) and (250, 100)
- **THEN** the zoom is 6400 % (not 8000 %), the image's top-left is at (−90, −60), and the image point under the midpoint stays at (150, 100)

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
- **WHEN** the zoom is 6400 % and a Ctrl + wheel event with a vertical delta of −40 px arrives
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

## MODIFIED Requirements

### Requirement: Zoom keeps the point under the cursor in place
The app SHALL zoom in steps of ×1.25 with the `+`/`−` buttons and the `+`/`-` keys (around the
frame center) and with the mouse wheel without the Ctrl key (around the cursor; one 100 px wheel
step = one step). The image point at the zoom anchor SHALL stay at the same screen position.
Zoom SHALL be limited to between half the fit zoom and the larger of 6400 % and the fit zoom.
The current zoom SHALL be shown as a whole percentage.

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
