# Spec Delta

## MODIFIED Requirements

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
