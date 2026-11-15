# Spec Delta

## MODIFIED Requirements

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
