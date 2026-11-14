## MODIFIED Requirements

### Requirement: Stitch dimensions and finished size are always shown
While an image is loaded, the form SHALL show the stitch dimensions and the finished size in
inches and centimetres (one decimal) for the chosen fabric count, updated as soon as a setting
changes. Without an image it SHALL say so. A grid side above 10000 SHALL be explained with the
largest width that fits. A grid wider than the image SHALL get a note that it adds no detail. On a compact screen
with the settings collapsed, the settings summary (see the responsive-layout spec) SHALL show
the stitch dimensions and the finished size in inches instead.

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
- **WHEN** a 41 × 2048 px image is loaded with width 250
- **THEN** the size reads `250 × 12488 stitches is too large: at most 10000 stitches per side. Choose a width of at most 200.`
- **AND** no pattern is generated

#### Scenario: No allowed width fits
- **WHEN** a 1 × 2048 px image is loaded with width 100 (the largest width that fits is 4, below the form minimum of 10)
- **THEN** the size reads `100 × 204800 stitches is too large: at most 10000 stitches per side. This image is too tall and narrow to fit.`
- **AND** no pattern is generated

#### Scenario: Grid as wide as the image
- **WHEN** a 3200 × 4000 px image is loaded with width 3200 and fabric 14 ct
- **THEN** the size reads `3200 × 4000 stitches — 228.6 × 285.7 in (580.6 × 725.7 cm) on 14 ct` with no note

#### Scenario: Grid wider than the image
- **WHEN** the same image is loaded with width 5000
- **THEN** the size reads `5000 × 6250 stitches — 357.1 × 446.4 in (907.1 × 1133.9 cm) on 14 ct. Wider than the image (3200 px), so the extra stitches add no detail.`
- **AND** the text is not styled as an error

#### Scenario: Collapsed settings on a phone
- **WHEN** a 1200 × 800 px image is loaded with width 100 and fabric 14 ct, the screen is 375 CSS px wide and the settings are collapsed
- **THEN** the `Settings` button shows `100 × 67 · max 24 colors · 14 ct · 7.1 × 4.8 in`
