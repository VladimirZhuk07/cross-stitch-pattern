# Spec Delta

## Purpose

Lets the DMC colors and Chart layers show a pattern of any size, up to 10000 × 10000 stitches
and beyond, on desktop and phone browsers: within canvas size and memory limits, with
bounded work per frame, and looking the same as a small pattern drawn from one picture.

Terms used below. A **picture** is a bitmap the layer draws from. **Device px per stitch** is
the smaller of a stitch's on-screen width and height in CSS px times the device pixel ratio.
**Detail level k** (k = 0, 1, 2, …) is a picture of the pattern in which one pixel stands for a
block of 2^k × 2^k stitches; level k of a W × H pattern is ceil(W / 2^k) × ceil(H / 2^k)
pixels. "Stitches read" counts pattern cells read to build pictures. Hex values are test
fixtures: `310` `#000000` (chart tint `#B0B0B0`), `321` `#C72B3B` (tint `#FFC0BB`), empty
chart cells `#E0E0E0`.

## ADDED Requirements

### Requirement: Pictures stay within canvas limits
Both pattern layers SHALL draw a pattern whose width and height are at most 2048 stitches
from one level-0 picture. A larger pattern SHALL be drawn from level pictures cut into tiles
of at most 512 × 512 pixels, plus one overview: the level-M picture for the smallest M whose
picture is at most 2048 pixels on each side. No picture SHALL exceed 2048 × 2048 pixels,
whatever the pattern size.

#### Scenario: Pattern within the single-picture limit
- **WHEN** a 2048 × 1000 pattern is shown in the DMC colors layer
- **THEN** it is drawn from one 2048 × 1000 pixel picture and no tiles are made

#### Scenario: 10000 × 10000 pattern
- **WHEN** a 10000 × 10000 pattern is shown
- **THEN** its overview is level 3, 1250 × 1250 pixels
- **AND** level 0 is cut into 20 × 20 tiles, the last column and row 272 pixels wide; level 1 into 10 × 10 tiles; level 2 into 5 × 5 tiles

#### Scenario: Just over the limit
- **WHEN** a 2049 × 2049 pattern is shown
- **THEN** its overview is level 1, 1025 × 1025 pixels, and level 0 is cut into 5 × 5 tiles, the last column and row 1 pixel wide

#### Scenario: Any size, even beyond the generation limit
- **WHEN** a 100000 × 3 pattern is shown
- **THEN** its overview is level 6, 1563 × 1 pixels, and nothing fails

### Requirement: Detail level follows the zoom
For a pattern larger than the single-picture limit, a layer SHALL draw at detail level
k = round(log2(1 / device px per stitch)), limited to 0 … M, so one level pixel covers
between about 0.71 and 1.41 device px. At level M it SHALL draw the overview; below M, the
tiles of level k.

#### Scenario: Fit on a high-DPI screen
- **WHEN** a 10000 × 10000 pattern of a square image is fitted into a 1000 × 800 frame (content 124, 24, 752 × 752 CSS px) at device pixel ratio 2 (0.1504 device px per stitch)
- **THEN** the layer draws the level-3 overview

#### Scenario: Fit on a standard screen
- **WHEN** the same view is shown at device pixel ratio 1 (0.0752 device px per stitch, ideal level 4)
- **THEN** the layer draws the level-3 overview, scaled down by the browser

#### Scenario: Zooming in
- **WHEN** a 10000 × 10000 pattern is shown at 0.3, 0.6, 0.75 and 2 device px per stitch
- **THEN** the layer draws level 2, 1, 0 and 0 tiles

### Requirement: Level pixels average their stitches
A pixel of level k ≥ 1 SHALL average the stitches of its block that lie inside the pattern
(blocks at the right and bottom edges may be partial), per 8-bit channel, rounded to the
nearest integer. In the DMC colors layer empty cells count as fully transparent and colors are
weighted by opacity; in the Chart layer every cell is opaque (tint or empty grey).

#### Scenario: DMC colors block with an empty cell
- **WHEN** level 1 of a 2 × 2 pattern with colors `[310, 321]` and cells `[0, 1, 1, -1]` is built for the DMC colors layer
- **THEN** its single pixel is RGBA `(133, 29, 39, 191)`

#### Scenario: Empty block
- **WHEN** level 1 of a 2 × 2 pattern whose cells are all empty is built for the DMC colors layer
- **THEN** its pixel is RGBA `(0, 0, 0, 0)`

#### Scenario: Chart block
- **WHEN** level 1 of a 2 × 2 pattern with colors `[310, 321]` and cells `[0, 1, -1, 0]` is built for the Chart layer
- **THEN** its pixel is RGBA `(208, 192, 191, 255)`, the average of `#B0B0B0`, `#FFC0BB`, `#E0E0E0` and `#B0B0B0`

#### Scenario: Partial block at the edge
- **WHEN** level 1 of a 3 × 1 pattern with colors `[310, 321]` and cells `[0, 0, 1]` is built for the DMC colors layer
- **THEN** it is 2 × 1 pixels: `(0, 0, 0, 255)` and `(199, 43, 59, 255)`

### Requirement: Only visible tiles are built and drawn
A layer SHALL build and draw only the tiles of the current level that contain a cell visible
in the frame. Panning or zooming SHALL build only tiles not yet kept.

#### Scenario: Zoomed into the middle
- **WHEN** a 10000 × 10000 pattern is shown at 1 device px per stitch (content −5000, −5000, 10000 × 10000 CSS px, ratio 1) in a 1000 × 800 frame
- **THEN** exactly the 9 level-0 tiles in tile columns 9 to 11 and tile rows 9 to 11 are built and drawn

#### Scenario: Grid outside the frame
- **WHEN** the content rectangle of a 10000 × 10000 pattern lies entirely right of the frame
- **THEN** no tile is built or drawn

### Requirement: Tile memory stays within a budget
Each layer SHALL keep at most 48 MiB of tiles (48 tiles of 512 × 512 pixels), releasing the
tiles drawn longest ago first, but never a tile drawn in the current frame. When the state
holds a different pattern, all pictures of the old pattern SHALL be released.

#### Scenario: Least recently drawn tiles go first
- **WHEN** 50 full tiles T1 … T50 were drawn in this order, one per frame, and the next frame draws T50 and T1
- **THEN** T2 and T3 are released and 48 tiles remain

#### Scenario: A frame needing more than the budget
- **WHEN** one frame draws 56 tiles
- **THEN** all 56 are kept for that frame and released down to 48 later, oldest first, once they are no longer drawn

#### Scenario: New pattern
- **WHEN** the state switches from a 10000 × 10000 pattern to another pattern
- **THEN** every tile and the overview of the first pattern are released before the next redraw ends

### Requirement: Building is spread over frames
A layer SHALL read at most 2,097,152 stitches per frame to build pictures (at least one picture
row, if a single row is larger), building visible tiles first and then the overview. While a
visible tile or the overview is incomplete, the layer SHALL ask for another frame; once all
are complete it SHALL stop asking.

#### Scenario: Small pattern
- **WHEN** a 100 × 67 pattern is shown for the first time
- **THEN** its picture is complete in the first frame and no further frame is requested

#### Scenario: Huge pattern at Fit
- **WHEN** a 10000 × 10000 pattern is first shown at Fit (overview level 3, 80,000 stitches per overview row)
- **THEN** each frame builds 26 overview rows (2,080,000 stitches) and shows the rows built so far
- **AND** the overview is complete after 49 frames and no further frame is requested

#### Scenario: Zoomed in on a new pattern
- **WHEN** a new 10000 × 10000 pattern is shown with the 9 tiles of "Zoomed into the middle" visible
- **THEN** the first frame builds 8 tiles (8 × 262,144 stitches) in row order and the second frame the ninth, then the overview continues in the following frames

### Requirement: Pending tiles show the overview
While a visible tile is not yet built, the layer SHALL draw the overview's part for that tile
in its place, as far as the overview is built; where nothing is built, the frame background
SHALL show.

#### Scenario: Panning to new tiles
- **WHEN** the overview of a 10000 × 10000 pattern is complete and a pan reveals 12 tiles that are not kept
- **THEN** each of the 12 tile areas shows either its built tile or the overview's part for it, and none shows the frame background in place of stitches

### Requirement: Tiles meet without seams
Edges between neighboring tiles SHALL be placed on whole device pixels (rounded to the
nearest), so no background or blended line appears between them. The outer edges of the
content rectangle SHALL keep their exact positions.

#### Scenario: Tile edge at a fractional position
- **WHEN** a 10000 × 10000 pattern is shown with 1 CSS px stitches and the content rectangle's left edge at x 0.3
- **THEN** at device pixel ratio 1 the edge between tile columns 0 and 1 is at x 512 for both tiles, and tile column 0 starts at x 0.3
- **AND** at device pixel ratio 2 that edge is at x 512.5

### Requirement: Chart cell colors follow the sharpness rule
The Chart layer SHALL draw its cell colors with hard edges when one stitch is at least 1
device pixel wide and tall, and with the browser's smoothed (high-quality) downscaling when
a stitch is smaller, the same rule as the DMC colors layer.

#### Scenario: One device pixel per stitch
- **WHEN** a 968 × 484 pattern is shown in the Chart layer in a 484 × 242 CSS px content rectangle at device pixel ratio 2
- **THEN** its cell colors are drawn with hard edges

#### Scenario: Smaller than a device pixel
- **WHEN** a 1000 × 500 pattern is shown in the Chart layer in a 484 × 242 CSS px content rectangle at device pixel ratio 2
- **THEN** its cell colors are drawn smoothed
