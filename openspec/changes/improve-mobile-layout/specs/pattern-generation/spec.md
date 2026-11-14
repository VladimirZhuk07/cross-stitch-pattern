## MODIFIED Requirements

### Requirement: Stitch dimensions and finished size are always shown
While an image is loaded, the form SHALL show the stitch dimensions and the finished size in
inches and centimetres (one decimal) for the chosen fabric count, updated as soon as a setting
changes. Without an image it SHALL say so. A grid side above 500 SHALL be explained with the
largest width that fits. On a compact screen with the settings collapsed, the settings summary
(see the responsive-layout spec) SHALL show the stitch dimensions and the finished size in
inches instead.

#### Scenario: 1200 × 800 image on 14 ct
- **WHEN** a 1200 × 800 px image is loaded with width 100 and fabric 14 ct
- **THEN** the size reads `100 × 67 stitches — 7.1 × 4.8 in (18.1 × 12.2 cm) on 14 ct`

#### Scenario: Changing the fabric
- **WHEN** the fabric is changed to 18 ct for the same image and width
- **THEN** the size reads `100 × 67 stitches — 5.6 × 3.7 in (14.1 × 9.5 cm) on 18 ct`
- **AND** no new pattern is generated (fabric count does not change the pattern)

#### Scenario: No image yet
- **WHEN** no image is loaded
- **THEN** the size reads `Load an image to see the pattern size.`

#### Scenario: Grid too tall
- **WHEN** a 41 × 2048 px image is loaded with width 100
- **THEN** the size reads `100 × 4995 stitches is too large: at most 500 stitches per side. Choose a width of at most 10.`
- **AND** no pattern is generated

#### Scenario: No allowed width fits
- **WHEN** a 10 × 2048 px image is loaded with width 100 (the largest width that fits is 2, below the form minimum of 10)
- **THEN** the size reads `100 × 20480 stitches is too large: at most 500 stitches per side. This image is too tall and narrow to fit.`
- **AND** no pattern is generated

#### Scenario: Collapsed settings on a phone
- **WHEN** a 1200 × 800 px image is loaded with width 100 and fabric 14 ct, the screen is 375 CSS px wide and the settings are collapsed
- **THEN** the `Settings` button shows `100 × 67 · max 24 colors · 14 ct · 7.1 × 4.8 in`
