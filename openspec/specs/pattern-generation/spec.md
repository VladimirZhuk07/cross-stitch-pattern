# pattern-generation Specification

## Purpose

Turns the loaded image and the user's pattern settings into a cross-stitch pattern: a stitch
grid sized from the image, reduced to a limited set of DMC flosses, generated off the main
thread, with the settings form that shows the stitch dimensions and finished size.

Pixel values in the scenarios are RGBA bytes `(r, g, b, a)`, 0–255. "Opaque black" is
`(0, 0, 0, 255)`, "opaque white" is `(255, 255, 255, 255)`, "transparent" is `(0, 0, 0, 0)`.
DMC results refer to the bundled 489-color palette: `#000000` is `310` "Black", `#FFFFFF`
is `B5200` "Snow White". The empty marker is `-1`.

## Requirements

### Requirement: Grid width comes from the settings, height from the image
The stitch grid SHALL be `W` stitches wide, `W` being the target width setting, and
`H = round(W × imageHeight / imageWidth)` stitches tall, at least 1, using the image size the
app works with (after the 2048 px cap). The whole image SHALL map onto the grid with no
cropping, so the grid lines up with the image in every view layer.

#### Scenario: Landscape photo
- **WHEN** a 1200 × 800 px image is generated with target width 100
- **THEN** the pattern is 100 × 67 stitches

#### Scenario: Downscaled image uses the capped size
- **WHEN** a 6000 × 4000 px file (used at 2048 × 1365 px) is generated with target width 100
- **THEN** the pattern is 100 × 67 stitches

#### Scenario: Portrait image
- **WHEN** an 800 × 1200 px image is generated with target width 100
- **THEN** the pattern is 100 × 150 stitches

#### Scenario: Very wide image keeps one row
- **WHEN** a 2048 × 1 px image is generated with target width 100
- **THEN** the pattern is 100 × 1 stitches

#### Scenario: Grid wider than the image
- **WHEN** a 1 × 1 px opaque black image is generated with target width 3 and max colors 24
- **THEN** the pattern is 3 × 3 stitches, all 9 cells use legend entry 1 = `310` with stitch count 9

### Requirement: Grid sides are limited to 500 stitches
Neither grid side SHALL exceed 500 stitches. A width/image combination whose height would
exceed 500 SHALL be rejected with an error that states the height, the limit, and the largest
target width that fits this image (or that no width fits).

#### Scenario: Tall image with a large width
- **WHEN** a 41 × 2048 px image is generated with target width 100 (height would be 4995)
- **THEN** generation fails with a range error whose message contains `4995`, `500` and `10`

#### Scenario: Largest width that fits
- **WHEN** a 41 × 2048 px image is generated with target width 10
- **THEN** the pattern is 10 × 500 stitches

### Requirement: Cells average their image area in linear RGB
Each cell's color SHALL be the area-weighted average of the image pixels it covers, including
fractional pixel coverage at cell edges, computed in linear-light RGB (not in sRGB), and
weighted by pixel alpha, so transparent pixels do not darken or tint the cell.

#### Scenario: Black and white average to a light grey
- **WHEN** a 2 × 1 px image of opaque black and opaque white is generated with target width 1 and max colors 24
- **THEN** the single cell has linear RGB `(0.5, 0.5, 0.5)` (sRGB ≈ 187.5, L* ≈ 76.07) and maps to DMC `03` "Tin Medium"
- **AND** not to `169` "Pewter Light", the match for the sRGB midpoint 127.5

#### Scenario: Fractional coverage at cell edges
- **WHEN** a 3 × 1 px opaque image red `(255, 0, 0)`, blue `(0, 0, 255)`, green `(0, 255, 0)` is resized to 2 × 1 cells
- **THEN** cell 0 has linear RGB `(0.6667, 0, 0.3333)` and cell 1 has `(0, 0.6667, 0.3333)` (within 1e-4)

#### Scenario: Transparent pixels do not tint the cell
- **WHEN** a 2 × 1 px image of opaque `(199, 43, 59, 255)` and transparent `(0, 0, 0, 0)` is generated with target width 1
- **THEN** the single cell is stitched, its average alpha is 0.5, and it maps to `321` "Red" (`#C72B3B`), not a darker red

### Requirement: Mostly transparent cells are empty
A cell whose area-weighted average alpha (0–1) is below 0.5 SHALL be empty (`-1`). A cell with
average alpha of 0.5 or more SHALL be stitched. Empty cells SHALL NOT take part in color
reduction or stitch counts.

#### Scenario: One opaque pixel out of four
- **WHEN** a 4 × 1 px image of opaque black and three transparent pixels is generated with target width 1
- **THEN** the pattern is 1 × 1 with cells `[-1]` and an empty legend

#### Scenario: Fully transparent image
- **WHEN** a 4 × 4 px fully transparent image is generated with target width 2
- **THEN** the pattern is 2 × 2 with cells `[-1, -1, -1, -1]` and 0 legend entries

#### Scenario: Transparent border
- **WHEN** a 2 × 2 px image with opaque black on the left column and transparent on the right is generated with target width 2
- **THEN** the cells are `[0, -1, 0, -1]` and legend entry 1 is `310` with stitch count 2

### Requirement: Colors are reduced to at most the chosen number
The non-empty cells SHALL be grouped into at most `maxColors` clusters by k-means in CIELAB,
started from a fixed seed. When the image has fewer distinct cell colors than `maxColors`,
only as many clusters SHALL be used as there are distinct colors.

#### Scenario: Two colors, generous limit
- **WHEN** a 2 × 2 px image with opaque black on the top row and opaque white on the bottom row is generated with target width 2 and max colors 24
- **THEN** the legend has exactly 2 entries: 1 = `310` (2 stitches), 2 = `B5200` (2 stitches)
- **AND** the cells are `[0, 0, 1, 1]`

#### Scenario: One color for a two-color image
- **WHEN** the same black/white 2 × 2 image is generated with max colors 1
- **THEN** the legend has 1 entry, `317` "Pewter Gray" (the DMC nearest to Lab (50, 0, 0)), with stitch count 4

#### Scenario: Gradient stays within the limit
- **WHEN** a 64 × 64 px opaque image whose pixel (x, y) is `(4x, 4y, 128, 255)` is generated with target width 32 and max colors 8
- **THEN** the pattern is 32 × 32, the legend has between 1 and 8 entries, and the stitch counts sum to 1024

### Requirement: Cluster colors map to the nearest DMC floss by CIEDE2000
Each cluster's mean Lab color SHALL be mapped to the DMC floss with the smallest CIEDE2000
difference (lowest palette index on a tie). Clusters that map to the same DMC code SHALL
become one legend entry whose stitch count is their sum, so the legend never has more entries
than `maxColors`.

#### Scenario: Exact DMC color
- **WHEN** a 1 × 1 px opaque `(199, 43, 59, 255)` image is generated with target width 1
- **THEN** the legend is `[{ number: 1, code: '321', name: 'Red', hex: '#C72B3B', stitchCount: 1 }]`

#### Scenario: Pure red is not in the palette
- **WHEN** a 1 × 1 px opaque `(255, 0, 0, 255)` image is generated with target width 1
- **THEN** the legend entry is `606` "Orange Red Bright" (`#FA3203`)

#### Scenario: Two clusters land on the same floss
- **WHEN** a 2 × 1 px image of opaque `(0, 0, 0, 255)` and `(5, 5, 5, 255)` is generated with target width 2 and max colors 2
- **THEN** the legend has 1 entry, `310` with stitch count 2, and the cells are `[0, 0]`

### Requirement: Generation is deterministic and leaves its input unchanged
Generating twice from equal pixels and settings SHALL give deep-equal patterns, also in a
fresh worker. Generation SHALL NOT modify the pixel data or the settings it is given.

#### Scenario: Same gradient twice
- **WHEN** the 64 × 64 gradient image from "Gradient stays within the limit" is generated twice with target width 32 and max colors 8
- **THEN** both patterns are deep-equal

#### Scenario: Input pixels are not modified
- **WHEN** a pattern is generated from a 2 × 2 px buffer
- **THEN** afterwards the buffer holds the same 16 bytes as before

### Requirement: Invalid generation input is rejected
Generation SHALL fail with an error that names the problem and the received value when the
target width is not an integer from 1 to 500, `maxColors` is not an integer from 1 to 99, the
image width or height is not a positive integer, or the pixel data does not have
`width × height × 4` bytes.

#### Scenario: Width out of range
- **WHEN** generation is requested with target width 0, 501 or 12.5
- **THEN** it fails with a range error whose message contains `targetWidth` and the received value

#### Scenario: Too many colors
- **WHEN** generation is requested with max colors 100
- **THEN** it fails with a range error whose message contains `100` and `99`

#### Scenario: Pixel buffer of the wrong size
- **WHEN** a 2 × 2 image is given with 12 bytes of pixel data
- **THEN** it fails with a range error whose message contains `16` and `12`

### Requirement: Generation runs in a background worker
Generation SHALL run in a Web Worker. Each request SHALL carry a `type` and an `id`; each
response SHALL echo that `id` and be either a pattern or an error with a message. The image
pixels SHALL be sent with the first request for an image and remembered by the worker for
later requests. Pixel and cell buffers SHALL be transferred, not copied.

#### Scenario: First request carries the image
- **WHEN** the worker receives `{ type: 'generate', id: 7, image: { width: 2, height: 2, pixels }, settings: { targetWidth: 2, maxColors: 24 } }` with 4 opaque black pixels
- **THEN** it responds `{ type: 'pattern', id: 7, pattern }` where pattern is 2 × 2 with legend 1 = `310` (4 stitches)
- **AND** the pattern's cell buffer is in the response's transfer list

#### Scenario: Later request reuses the remembered image
- **WHEN** the same worker then receives `{ type: 'generate', id: 8, settings: { targetWidth: 1, maxColors: 24 } }`
- **THEN** it responds with `id: 8` and a 1 × 1 pattern with legend 1 = `310` (1 stitch)

#### Scenario: No image yet
- **WHEN** a fresh worker receives `{ type: 'generate', id: 1, settings: { targetWidth: 10, maxColors: 24 } }`
- **THEN** it responds `{ type: 'error', id: 1, message }` with a message containing `image`

#### Scenario: Unknown message type
- **WHEN** the worker receives `{ type: 'resize', id: 3 }`
- **THEN** it responds `{ type: 'error', id: 3, message }` with a message containing `resize`

#### Scenario: Invalid settings become an error response
- **WHEN** the worker receives a generate request with `id: 4` and max colors 100
- **THEN** it responds with `type: 'error'`, `id: 4` and a message containing `100` and `99`, and keeps handling later requests

### Requirement: Settings form with sensible defaults
The app SHALL show a labelled **Pattern settings** form with: target width in stitches (whole
number 10–500, default 100), maximum number of colors (whole number 1–99, default 24), and
fabric count (choices 11, 14, 16, 18 ct, default 14). Every control SHALL have a visible label
and work with the keyboard.

#### Scenario: First start
- **WHEN** the app is opened
- **THEN** the form shows width `100`, max colors `24` and fabric `14 ct`

#### Scenario: Invalid width is not used
- **WHEN** the user enters `600` (or `5`, `12.5`, or nothing) as the width
- **THEN** the field is marked invalid with the message `Width must be a whole number from 10 to 500.`
- **AND** no new pattern is generated and the current pattern stays unchanged

#### Scenario: Invalid color count is not used
- **WHEN** the user enters `0` as max colors
- **THEN** the field is marked invalid with the message `Max colors must be a whole number from 1 to 99.` and no new pattern is generated

### Requirement: Stitch dimensions and finished size are always shown
While an image is loaded, the form SHALL show the stitch dimensions and the finished size in
inches and centimetres (one decimal) for the chosen fabric count, updated as soon as a setting
changes. Without an image it SHALL say so. A grid side above 500 SHALL be explained with the
largest width that fits.

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

### Requirement: Patterns are generated automatically
A pattern SHALL be generated, without a button press, as soon as an image has loaded, and again
300 ms after the last valid change of the width or the max colors. Results of a request that
was overtaken by a newer image or setting change SHALL be discarded. While a newer pattern is
generated, the current pattern SHALL stay visible.

#### Scenario: New image
- **WHEN** `photo.png` finishes loading with the default settings
- **THEN** a 100-stitch-wide pattern with at most 24 colors is generated and stored, the `DMC colors` and `Chart` options become enabled, and the Original layer stays active

#### Scenario: Typing a number
- **WHEN** the user types `1` and then `2` into max colors within 300 ms
- **THEN** exactly one new pattern is generated, with at most 12 colors

#### Scenario: Newer setting overtakes a running generation
- **WHEN** a pattern with 24 colors is being generated and the user changes max colors to 12
- **THEN** the 24-color result is discarded when it arrives and the 12-color result is shown

#### Scenario: New image during generation
- **WHEN** `a.png`'s pattern is being generated and the user loads `b.png`
- **THEN** `a.png`'s result is never stored and the pattern of `b.png` is generated

### Requirement: Generation progress and errors are shown
While generating, the app SHALL show `Generating pattern…` in a polite live status and mark the
pattern view busy (`aria-busy="true"`). On success it SHALL show
`Pattern ready: W × H stitches, N DMC colors.` (`1 DMC color` for one; without any stitch
`Pattern ready: the image is fully transparent, so there is nothing to stitch.`). On failure
it SHALL show `Could not generate the pattern: ` plus the reason and keep the current pattern.

#### Scenario: Success
- **WHEN** generation of a 100 × 67 pattern with 18 legend entries finishes
- **THEN** the status reads `Pattern ready: 100 × 67 stitches, 18 DMC colors.` and the view is no longer busy

#### Scenario: One color
- **WHEN** a 10 × 10 pattern with 1 legend entry is generated
- **THEN** the status reads `Pattern ready: 10 × 10 stitches, 1 DMC color.`

#### Scenario: Fully transparent image
- **WHEN** a fully transparent PNG is loaded
- **THEN** the status reads `Pattern ready: the image is fully transparent, so there is nothing to stitch.`

#### Scenario: Worker error
- **WHEN** the worker answers a request with an error message `boom`
- **THEN** the status reads `Could not generate the pattern: boom`, the view is no longer busy, and the previous pattern (or none) is kept
