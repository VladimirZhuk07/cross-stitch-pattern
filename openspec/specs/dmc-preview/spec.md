# dmc-preview Specification

## Purpose

Shows a cross-stitch pattern in its DMC colors, one solid block per stitch, in the shared
view frame, so the user sees what the finished embroidery will look like.

Hex values in the scenarios below are test fixtures, not palette data. Unless stated
otherwise, scenarios use these colors: `310` "Black" `#000000`, `321` "Red" `#C72B3B`,
`BLANC` "White" `#FFFFFF`. The empty marker is `-1`. The frame background is `#E4E1DB`.
"Content rectangle" is the shared rectangle defined in `pattern-viewer`.

## Requirements

### Requirement: Stitch image of a pattern
The app SHALL derive from a pattern a stitch image of exactly `width × height` pixels, one
pixel per stitch at the same column and row. A stitched pixel SHALL have the red, green and
blue values of its legend entry's hex color and full opacity (alpha 255). An empty cell's
pixel SHALL be fully transparent (red, green, blue and alpha all 0).

#### Scenario: One stitch
- **WHEN** the stitch image of a 1 × 1 pattern with colors `[321]` and cells `[0]` is derived
- **THEN** it is 1 × 1 pixel with RGBA `(199, 43, 59, 255)`

#### Scenario: Two by two with an empty cell
- **WHEN** the stitch image of a 2 × 2 pattern with colors `[310, BLANC]` and cells `[0, -1, 1, 0]` is derived
- **THEN** the pixels in row-major order are RGBA `(0, 0, 0, 255)`, `(0, 0, 0, 0)`, `(255, 255, 255, 255)`, `(0, 0, 0, 255)`

#### Scenario: Merged clusters
- **WHEN** a 3 × 1 pattern is built with colors `[321, 310, 321]` and cells `[0, 1, 2]` and its stitch image is derived
- **THEN** the pixels are RGBA `(199, 43, 59, 255)`, `(0, 0, 0, 255)`, `(199, 43, 59, 255)`

#### Scenario: Malformed pattern
- **WHEN** the stitch image is derived from a 2 × 1 pattern whose cells are `[0, 1]` but whose legend has only 1 entry
- **THEN** it fails with a RangeError whose message contains the cell position `1` and the value `1`

#### Scenario: Wrong cell count
- **WHEN** the stitch image is derived from a 3 × 2 pattern with 5 cells
- **THEN** it fails with a RangeError whose message contains `6` and `5`

### Requirement: DMC colors layer draws one block per stitch
While the `DMC colors` layer is active, the frame SHALL show every stitched cell of the
current pattern as a solid rectangle in its DMC color, filling the cell's part of the content
rectangle (column c from c/W to (c+1)/W of its width, row r from r/H to (r+1)/H of its
height). The layer SHALL draw nothing outside the content rectangle and no grid lines.

#### Scenario: Two stitches side by side
- **WHEN** a 2 × 1 pattern with colors `[310, 321]` and cells `[0, 1]` is shown with the content rectangle at x 10, y 20, 200 × 100 CSS px
- **THEN** x 10 to 110, y 20 to 120 is `#000000`, x 110 to 210, y 20 to 120 is `#C72B3B`, and the rest of the frame is the frame background

#### Scenario: Grid aligned with the other layers
- **WHEN** a 100 × 67 pattern is shown with the content rectangle at x 10, y 20, 1024 × 682.5 CSS px
- **THEN** stitch (column 0, row 0) covers x 10 to 20.24 and y 20 to about 30.19
- **AND** stitch (column 99, row 66) ends at x 1034 and y 702.5

#### Scenario: Zoom and pan move the blocks with the image
- **WHEN** the `DMC colors` layer is shown at 250 % with the image's top-left at (−300, −120) and the user switches to `Original`
- **THEN** stitch (column 0, row 0) of the DMC colors layer and the image's top-left pixel start at the same screen point (−300, −120)

### Requirement: Empty cells are transparent
Empty cells SHALL NOT be drawn, so the frame background shows through them, the same way
transparent areas of the image look in the Original layer. An empty cell SHALL never look
like a white (`BLANC`) stitch.

#### Scenario: Empty is not white
- **WHEN** a 2 × 1 pattern with colors `[BLANC]` and cells `[0, -1]` is shown with the content rectangle at x 0, y 0, 200 × 100 CSS px
- **THEN** x 0 to 100 is `#FFFFFF` and x 100 to 200 is the frame background `#E4E1DB`

#### Scenario: Fully empty pattern
- **WHEN** a 2 × 2 pattern with cells `[-1, -1, -1, -1]` and an empty legend is shown
- **THEN** the whole frame is the frame background and no error is shown

### Requirement: Blocks stay sharp at every zoom
When one stitch is at least 1 device pixel wide and at least 1 device pixel tall, the layer
SHALL draw hard block edges: every device pixel fully inside a stitch has exactly that
stitch's color, with no blending with neighbors. Only when a stitch is smaller than 1 device
pixel in either direction SHALL the layer average neighboring stitches.

#### Scenario: Hard edge at fit zoom
- **WHEN** a 2 × 1 pattern with colors `[310, 321]` and cells `[0, 1]` is shown in a content rectangle at x 16, y 158, 968 × 484 CSS px with device pixel ratio 1
- **THEN** device pixel column 499 is `#000000`, column 500 is `#C72B3B`, and no device pixel of the content rectangle has any other color

#### Scenario: Far zoomed in
- **WHEN** the same pattern is shown at 6400 % so each stitch is 64 × 64 CSS px
- **THEN** each stitch is one uniform 64 × 64 CSS px block of its color

#### Scenario: Exactly one device pixel per stitch on a high-DPI screen
- **WHEN** a 968 × 484 pattern is shown in a content rectangle of 484 × 242 CSS px with device pixel ratio 2
- **THEN** each stitch covers 1 × 1 device pixel and blocks are drawn with hard edges

#### Scenario: Stitches smaller than a device pixel
- **WHEN** a 1000 × 500 pattern is shown in a content rectangle of 484 × 242 CSS px with device pixel ratio 2
- **THEN** the blocks are drawn with the browser's smoothed (high-quality) downscaling, so each device pixel shows a blend of the stitches it covers instead of one arbitrarily picked stitch

### Requirement: Redraws reuse the stitch image
The layer SHALL derive the stitch image once per pattern and reuse it for every redraw of
that same pattern (zoom, pan, frame resize, switching layers). When the application state
holds a different pattern, the next redraw SHALL show the new pattern. For a pattern larger
than 2048 stitches on a side, which is drawn from tiles (see `large-pattern-rendering`), each
tile SHALL be built once and reused while it is kept, and rebuilt only after it was released
under the memory budget.

#### Scenario: Zooming and panning one pattern
- **WHEN** pattern P is shown in the `DMC colors` layer and the user zooms in 3 times, pans once and switches to `Original` and back
- **THEN** the stitch image of P is derived exactly once

#### Scenario: A new pattern replaces the old one
- **WHEN** pattern P (cells `[0]`, colors `[310]`) is shown and the state then holds pattern Q (cells `[0]`, colors `[321]`)
- **THEN** the next redraw shows the stitch as `#C72B3B`, and the stitch image is derived a second time, for Q

#### Scenario: Panning back to a kept tile
- **WHEN** a 10000 × 10000 pattern is shown at 1 device px per stitch, the user pans so that tile (9, 9) leaves the frame and pans back while fewer than 48 other tiles were drawn in between
- **THEN** tile (9, 9) is drawn again without being rebuilt

#### Scenario: Panning back to a released tile
- **WHEN** tile (9, 9) of that pattern was released because 48 other tiles were drawn after it, and the user pans back to it
- **THEN** tile (9, 9) is built again and drawn with the same pixels as before
