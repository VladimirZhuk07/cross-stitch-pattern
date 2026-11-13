## MODIFIED Requirements

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
