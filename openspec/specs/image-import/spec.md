# image-import Specification

## Purpose

Lets the user bring an image from their own device into the app, decoded locally in the
browser, with a size cap for huge inputs and clear feedback when a file cannot be used.

## Requirements

### Requirement: User can choose or drop an image
The app SHALL let the user pick one image file with a labelled file chooser or by dropping
a file onto the view frame. The file SHALL be decoded locally in the browser; no image data
SHALL be sent over the network. While decoding, a status message SHALL say which file is
loading; afterwards it SHALL show the file name and the dimensions used by the app.

#### Scenario: Picking a PNG with the file chooser
- **WHEN** the user picks `photo.png` (1200 × 800 px) with the file chooser
- **THEN** the status first reads `Loading photo.png…`
- **AND** then reads `photo.png — 1200 × 800 px`
- **AND** the Original layer shows the image fitted in the frame

#### Scenario: Dropping several files at once
- **WHEN** the user drops `a.jpg` and `b.png` onto the frame in one drop
- **THEN** only `a.jpg` (the first file) is loaded
- **AND** `b.png` is ignored without an error

#### Scenario: No network traffic for the image
- **WHEN** an image is loaded and shown
- **THEN** the browser makes no network request other than loading the app's own files

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

### Requirement: Unsupported or corrupt files show a clear error
When a file cannot be decoded as an image (wrong type, empty, or corrupt), the app SHALL show
an error message that names the file and lists the supported formats, and SHALL keep the
previously loaded image, layer, and zoom unchanged.

#### Scenario: Text file is chosen
- **WHEN** the user picks `notes.txt`
- **THEN** the status shows the error `Could not open "notes.txt": this browser cannot decode it as an image. Try a JPG, PNG, WebP, GIF, BMP or AVIF file.`

#### Scenario: Empty or truncated image file
- **WHEN** the user picks `empty.png` (0 bytes) or a PNG file cut off after 100 bytes
- **THEN** the same error is shown with that file's name

#### Scenario: Previous image survives a failed load
- **WHEN** `photo.png` is shown at a zoom of 200 % and the user then picks `notes.txt`
- **THEN** `photo.png` stays visible at 200 % and the error is shown

### Requirement: The most recent selection wins
If the user selects a new file while an earlier one is still decoding, the app SHALL show only
the most recently selected file and discard the result of the earlier one.

#### Scenario: Slow decode finishes after a newer selection
- **WHEN** the user picks `huge.jpg` and, before it finishes decoding, picks `small.png`
- **THEN** the frame shows `small.png` and the status names `small.png`
- **AND** the decoded `huge.jpg` is discarded when it finishes

### Requirement: A new image resets the view
After a new image loads successfully, the app SHALL clear any existing pattern, switch to the
Original layer, and fit the new image to the frame.

#### Scenario: Loading a second image while zoomed in
- **WHEN** `a.png` is shown at 400 % and the user loads `b.png`
- **THEN** the Original layer is active, the pattern is cleared, and `b.png` is fitted to the frame
