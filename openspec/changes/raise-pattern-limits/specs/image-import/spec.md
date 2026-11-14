# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Decoded images are capped at 2048 px on the long side`
- TO: `### Requirement: Decoded images are capped at 16.7 megapixels and 10000 px per side`

## MODIFIED Requirements

### Requirement: Decoded images are capped at 16.7 megapixels and 10000 px per side
If the decoded image has more than 16,777,216 pixels (4096 × 4096) or a side longer than
10000 px, the app SHALL downscale it, keeping the aspect ratio: the new long side is
`floor(long × s)` with `s = min(10000 / long, √(16,777,216 / (width × height)))`, lowered by
1 px while the area still exceeds 16,777,216; the short side is `short × newLong / long`
rounded to the nearest whole pixel, at least 1 px. Smaller images SHALL be used at their
original size. A downscale SHALL be reported to the user.

#### Scenario: Detailed render is used at full size
- **WHEN** the user loads `ref.jpg` with 3200 × 4000 px (12,800,000 pixels)
- **THEN** the app uses the image at 3200 × 4000 px
- **AND** the status reads `ref.jpg — 3200 × 4000 px`

#### Scenario: Large landscape photo is downscaled
- **WHEN** the user loads `big.jpg` with 6000 × 4000 px (24,000,000 pixels)
- **THEN** the app uses the image at 5016 × 3344 px (16,773,504 pixels)
- **AND** the status reads `big.jpg — 5016 × 3344 px (downscaled from 6000 × 4000 px)`

#### Scenario: Just above the pixel cap
- **WHEN** the user loads an image with 4097 × 4096 px
- **THEN** the app uses it at 4096 × 4095 px

#### Scenario: Image exactly at the cap is not changed
- **WHEN** the user loads an image with 4096 × 4096 px
- **THEN** the app uses it at 4096 × 4096 px
- **AND** the status does not mention downscaling

#### Scenario: Tall image below the cap is not changed
- **WHEN** the user loads an image with 100 × 5000 px
- **THEN** the app uses it at 100 × 5000 px

#### Scenario: Tall image is downscaled
- **WHEN** the user loads an image with 100 × 20000 px (2,000,000 pixels, side above 10000 px)
- **THEN** the app uses it at 50 × 10000 px

#### Scenario: Extremely thin image keeps at least one pixel
- **WHEN** the user loads an image with 30000 × 3 px (90,000 pixels)
- **THEN** the app uses it at 10000 × 1 px

#### Scenario: Invalid dimensions are rejected
- **WHEN** the size cap is computed for a width of 0, a width of 12.5, a maximum side of 0 or a maximum pixel count of 0
- **THEN** it fails with a range error naming the invalid value (for example `width must be a positive integer, got 0`)
