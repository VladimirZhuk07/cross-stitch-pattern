# stitch-progress Specification

## Purpose

Lets the user tick off the stitches they have sewn on a Progress view of the pattern, see how
much is done, and not lose that work by accident.

## Requirements

### Requirement: The Progress layer starts as the Chart
The app SHALL offer a `Progress` view layer, available exactly when a pattern exists. A cell
that is not marked as stitched SHALL look exactly as on the Chart layer: tint, number, hatch,
grid lines, rulers and centre marker. A new pattern SHALL start with no stitch marked, unless this browser holds saved progress
of a pattern with the same fingerprint (see "Saved progress comes back for the same pattern").

#### Scenario: Fresh pattern
- **WHEN** a 100 × 67 pattern is generated and the user switches to `Progress`
- **THEN** the frame shows the same cells, numbers, lines and rulers as `Chart` at the same zoom, and the counter reads `Stitched 0 of 6,700 (0 %)`

#### Scenario: New pattern resets the marks
- **WHEN** 12 stitches are marked and a new pattern is stored (for example after the user confirmed a width change)
- **THEN** no stitch of the new pattern is marked

### Requirement: A tap or click toggles a stitch
On the Progress layer, a press of the primary mouse button, a pen or one finger that ends within
8 CSS px of where it started, without a second finger touching meanwhile, SHALL toggle the cell
under the release point between not stitched and stitched. Empty cells and points outside the
grid SHALL NOT change. Drags SHALL keep panning and two-finger gestures keep pinch-zooming; they
SHALL NOT toggle anything. On the other layers taps SHALL NOT mark stitches.

#### Scenario: Tapping a cell
- **WHEN** the Progress layer shows a pattern in 20 px cells with its top-left at (0, 0) and the user clicks at (50, 30) without moving
- **THEN** cell (column 2, row 1) becomes stitched and the counter goes up by one; clicking there again makes it not stitched

#### Scenario: Small wobble still counts
- **WHEN** a finger touches at (50, 30), moves to (56, 34) (7.2 px away) and lifts
- **THEN** the cell under (56, 34) is toggled

#### Scenario: A drag pans
- **WHEN** a finger touches at (50, 30), moves to (60, 30) (10 px) and lifts
- **THEN** the view is panned by 10 px and no cell is toggled

#### Scenario: Pinch
- **WHEN** a second finger touches before the first lifts
- **THEN** the view pinch-zooms as before and no cell is toggled when the fingers lift

#### Scenario: Empty cell and outside the grid
- **WHEN** the user clicks an empty (hatched) cell, or the ruler, or the frame outside the grid
- **THEN** nothing is marked and the counter does not change

#### Scenario: Other layers
- **WHEN** the Chart layer is active and the user clicks a cell
- **THEN** nothing is marked

### Requirement: Stitched cells show their DMC color
A stitched cell SHALL be filled with its full DMC color, the same color as on the `DMC colors`
layer, and SHALL show no number. Hatching, grid lines, rulers and the centre marker SHALL be drawn
over it as on the Chart. When a picture pixel covers a block of several stitches (zoomed out on a
large pattern), it SHALL average the DMC colors of the block's stitched cells over the tints. A
fully stitched block shows only DMC colors, a block without stitched cells only tints.

#### Scenario: One stitched cell
- **WHEN** cell (2, 1) of the 3 × 2 pattern, whose legend entry is `321` `#C72B3B`, is stitched and the layer is drawn in 20 px cells
- **THEN** that cell is filled `#C72B3B` with no number, its neighbours keep their tints and numbers, and the grid lines around it are drawn

#### Scenario: Fully stitched block zoomed out
- **WHEN** a 4000 × 4000 pattern whose top-left 8 × 8 stitches are all stitched `310` `#000000` is shown at Fit (one picture pixel per 4 × 4 or 8 × 8 stitches)
- **THEN** the pixels of that corner are `#000000`, and pixels of blocks without stitched cells show the tints as on the Chart

#### Scenario: Marking updates at once
- **WHEN** the user toggles a cell of a 4000 × 4000 pattern
- **THEN** the cell changes in the next painted frame, without rebuilding the pictures of the whole pattern

### Requirement: Stitches can be marked with the keyboard
When the frame receives keyboard focus (`:focus-visible`) on the Progress layer, the layer SHALL
outline the cell at the frame centre with a 2 CSS px marker (black over white, visible on any
color). Space or Enter SHALL toggle that cell, and Shift together with an arrow key SHALL move
the view by exactly one cell. The other keys keep their meaning. The marker SHALL disappear when
the frame loses focus or was focused by a pointer.

#### Scenario: Toggling with Space
- **WHEN** the user tabs to the frame on the Progress layer, the centre is over cell (40, 30), and the user presses Space
- **THEN** a marker outlines cell (40, 30), the cell becomes stitched, and the counter text is announced

#### Scenario: Next cell
- **WHEN** the user then presses Shift + Right Arrow and Enter
- **THEN** the view moves left by one cell width, the marker is over cell (41, 30), and that cell becomes stitched

#### Scenario: Mouse focus
- **WHEN** the user clicks into the frame instead
- **THEN** no centre marker is drawn

### Requirement: A counter shows the progress
While the Progress layer is active, a line under the frame SHALL read
`Stitched S of T (P %)`. S is the number of stitched cells and T the number of non-empty cells
of the pattern, both with thousands separators. P is `floor(1000 × S / T) / 10` with one
decimal, or a whole `0` or `100`. The line SHALL be in a polite live region and hidden on the
other layers. A pattern without stitches SHALL read `Nothing to stitch in this pattern.`

#### Scenario: Partly done
- **WHEN** 1234 of 6700 cells are stitched
- **THEN** the line reads `Stitched 1,234 of 6,700 (18.4 %)`

#### Scenario: Almost done
- **WHEN** 6699 of 6700 cells are stitched
- **THEN** the line reads `Stitched 6,699 of 6,700 (99.9 %)`, never `100 %`

#### Scenario: Done and nothing
- **WHEN** all 6700 cells are stitched, or none
- **THEN** the line reads `Stitched 6,700 of 6,700 (100 %)`, respectively `Stitched 0 of 6,700 (0 %)`

#### Scenario: Other layer
- **WHEN** the user switches to `Chart`
- **THEN** the counter line is not shown

### Requirement: The highlight shows the stitches still to do
On the Progress layer, a color selected in the legend SHALL be highlighted as on the Chart, in
red with bold white numbers, but only in its cells that are not stitched. Its stitched cells
SHALL show their DMC color. Selecting a legend color while the Progress layer is shown SHALL keep
the Progress layer.

#### Scenario: Highlight with some cells done
- **WHEN** color 2 of the 3 × 2 pattern (cells (0, 0) and (2, 1)) is selected on Progress and (2, 1) is stitched
- **THEN** cell (0, 0) is `#B00000` with a bold white `2`, and cell (2, 1) is `#C72B3B` without a number

#### Scenario: Selecting on Progress
- **WHEN** the Progress layer is shown and the user clicks a legend row
- **THEN** the color is highlighted and the Progress layer stays active

### Requirement: Changing the pattern settings asks first
While at least one stitch is marked, a committed change of the width or the max colors SHALL
open a modal dialog before any new pattern is generated. It reads
`Change the pattern settings? Your progress on this pattern (S of T stitches) will be lost.`
and has the buttons `Keep my progress` (focused first), `Save progress first` (see "The warning
dialogs offer to save the progress first") and `Change settings`. `Change settings`
SHALL apply the new value. `Keep my progress`, Esc or closing the dialog SHALL put the field
back to the value in use and keep pattern and progress.

#### Scenario: Width change confirmed
- **WHEN** 12 stitches are marked, the user types `120` into the width (in use: 100), presses Enter and then `Change settings`
- **THEN** exactly one 120-wide pattern is generated and no stitch is marked

#### Scenario: Width change cancelled
- **WHEN** the user does the same but presses `Keep my progress` (or Esc)
- **THEN** the width field shows `100` again, no pattern is generated, and the 12 stitches stay marked

#### Scenario: Nothing marked
- **WHEN** no stitch is marked and the user changes the max colors
- **THEN** no dialog appears and the pattern is generated as usual

#### Scenario: Fabric count
- **WHEN** 12 stitches are marked and the user changes the fabric from 14 ct to 16 ct
- **THEN** no dialog appears, the finished size updates, and the stitches stay marked

### Requirement: Loading another image asks first
While at least one stitch is marked, choosing or dropping a new image SHALL first open the same
dialog with the text `Load NAME? Your progress on the current pattern (S of T stitches) will be
lost.` and the buttons `Keep my progress` (focused first), `Save progress first` and `Load image`.
`Load image` SHALL
load the image as usual. `Keep my progress`, Esc or closing SHALL keep image, pattern and
progress and SHALL reset the file chooser, so the same file can be chosen again.

#### Scenario: New photo confirmed
- **WHEN** 12 stitches are marked and the user drops `cat.png` on the frame and presses `Load image`
- **THEN** `cat.png` is loaded, its pattern is generated, and no stitch is marked

#### Scenario: New photo cancelled
- **WHEN** the user chooses `cat.png` with `Choose image` and presses `Keep my progress`
- **THEN** the current image, pattern and 12 marked stitches stay, and choosing `cat.png` again opens the dialog again

#### Scenario: Name shown literally
- **WHEN** the dropped file is named `<b>x</b>.png`
- **THEN** the dialog shows the text `Load <b>x</b>.png? …` and the page contains no new `b` element

### Requirement: Progress is saved in this browser
The marks SHALL be saved in the browser's IndexedDB, never sent anywhere, 500 ms after the
last toggle and at once when the page is hidden. A save SHALL store the pattern's fingerprint,
width, height, the stitched bits, the stitched and total counts, the image file name and the
time. The browser SHALL keep exactly one saved progress: a save replaces it, and unmarking the
last stitch deletes it.

#### Scenario: Debounced save
- **WHEN** the user marks 3 stitches of `cat.png`'s 100 × 67 pattern within one second and then waits 500 ms
- **THEN** exactly one save happens after the last mark, holding 3 stitched cells, total 6,700, the pattern's fingerprint and `cat.png`

#### Scenario: Page hidden
- **WHEN** the user marks a stitch and switches to another tab within 500 ms
- **THEN** the progress is saved at once, without waiting

#### Scenario: Everything unmarked
- **WHEN** the only marked stitch is unmarked and 500 ms pass
- **THEN** the saved progress is deleted

### Requirement: Saved progress comes back for the same pattern
When a pattern is stored whose fingerprint, width and height equal the saved progress, its
stitched cells SHALL be marked again from the saved bits, and a note under the counter SHALL
read `Restored your saved progress.` until the next toggle. Saved bits of empty cells or
outside the grid SHALL be ignored, and the counts SHALL be recounted from the bits, not taken
from the saved record. Saved progress of another fingerprint SHALL be left untouched.

#### Scenario: Reload and the same photo again
- **WHEN** 12 stitches of `cat.png`'s pattern were saved, the page is reloaded, and `cat.png` is loaded with the same settings
- **THEN** the same 12 cells are marked, the counter reads `Stitched 12 of 6,700 (0.1 %)`, and the note reads `Restored your saved progress.`

#### Scenario: Other settings
- **WHEN** `cat.png` is loaded with width 120 instead of 100
- **THEN** no stitch is marked and the saved progress of the 100-wide pattern stays saved

#### Scenario: Damaged record
- **WHEN** the saved record has the right fingerprint but a bit set on an empty cell and a stitched count of 999
- **THEN** that bit is ignored and the counter shows the stitches actually set on non-empty cells

### Requirement: Replacing the saved progress of another pattern asks first
When the browser holds saved progress with at least one stitch of a pattern with another
fingerprint, the first mark on the current pattern, or loading a `.stitch` file while nothing is
marked, SHALL open the warning dialog with the text
`Start a new progress? This browser keeps one progress: the saved one for NAME (S of T stitches) will be replaced.`
and the buttons `Keep my progress`, `Save progress first` and `Start new progress`. Only
`Start new progress` SHALL mark the stitch (or load the file); later marks SHALL not ask again.

#### Scenario: Another photo after a reload
- **WHEN** `cat.png` has 12 saved stitches, the page is reloaded, `dog.png` is loaded, and the user taps a stitch on Progress
- **THEN** the dialog asks with `… the saved one for cat.png (12 of 6,700 stitches) will be replaced.` with `Keep my progress` focused; `Keep my progress` marks nothing and keeps the saved progress; tapping again and choosing `Start new progress` marks the stitch, and its save replaces `cat.png`'s progress

#### Scenario: Nothing saved
- **WHEN** no progress is saved, or the saved one has no stitch
- **THEN** the first mark does not ask

### Requirement: A confirmed loss deletes the saved progress
When the user confirms the dialog before a settings change or a new image (choosing
`Change settings` or `Load image`), the saved progress SHALL be deleted as well, so it cannot
come back later.

#### Scenario: Settings changed on purpose
- **WHEN** 12 stitches are marked and saved, the user changes the width to 120 and confirms, then changes it back to 100
- **THEN** the 100-wide pattern has no stitch marked and nothing is restored

### Requirement: The user is told when progress cannot be saved
When IndexedDB is missing, cannot be opened, or a save fails, a note under the counter on the
Progress layer SHALL read `Your marks cannot be saved in this browser; they last until you close the page.`
Marking SHALL keep working, and the error SHALL not be shown again for every mark.

#### Scenario: Storage blocked
- **WHEN** the browser refuses to open IndexedDB and the user marks a stitch
- **THEN** the stitch is marked, the counter counts it, and the note shows the text above once

#### Scenario: Full storage
- **WHEN** a save fails with a quota error
- **THEN** the note shows the same text and the marks in the page stay as they are

### Requirement: Progress can be saved as a .stitch file
The `Export` menu SHALL offer `Save progress (.stitch)`, enabled while a pattern exists and at
least one stitch is marked. Choosing it SHALL download the current progress as a `.stitch` file
on this device, named like the image with the extension `stitch`, and close the menu. Nothing
SHALL be uploaded.

#### Scenario: Saving 12 marks of cat.png
- **WHEN** `cat.png`'s 100 × 67 pattern has 12 marked stitches and the user chooses `Export` → `Save progress (.stitch)`
- **THEN** the browser downloads `cat.stitch` holding those 12 stitches, the menu closes, and no network request is made

#### Scenario: File names
- **WHEN** the image is `IMG_0042.JPG`, respectively `cat.photo.png`, respectively `.png`
- **THEN** the file is named `IMG_0042.stitch`, respectively `cat.photo.stitch`, respectively `pattern.stitch`

#### Scenario: Nothing to save
- **WHEN** no image is loaded, or a pattern exists with no marked stitch
- **THEN** `Save progress (.stitch)` is disabled; marking one stitch enables it, unmarking it disables it again

#### Scenario: Saving fails
- **WHEN** the browser cannot compress the file (no `CompressionStream`)
- **THEN** the status line reads `Could not save the progress file.` and the marks stay as they are

### Requirement: The .stitch file format
A `.stitch` file SHALL be binary, little-endian: bytes 0–5 the ASCII magic `STITCH`; 6–7 the
format version 1 (uint16); 8–11 the width and 12–15 the height in stitches (uint32); 16–29 the
pattern fingerprint as 14 ASCII lowercase hex digits; from byte 30 to the end the stitched bits
in the Progress layout (`ceil(width × height / 8)` bytes) compressed with zlib deflate
(RFC 1950). The file SHALL hold no image and no file name.

#### Scenario: Header and bits of a small pattern
- **WHEN** the 3 × 2 test pattern with fingerprint F has cells 0 and 4 stitched and is saved
- **THEN** the file starts with `53 54 49 54 43 48 01 00 03 00 00 00 02 00 00 00` followed by the 14 ASCII characters of F, and inflating the rest gives exactly one byte, `0x11`

#### Scenario: Round trip
- **WHEN** a 4000 × 4000 progress with 1,234 stitched cells is saved and the file is loaded for the same pattern
- **THEN** exactly the same 1,234 cells are marked

#### Scenario: Sparse progress is small
- **WHEN** a 1000 × 1000 pattern with 100 stitched cells is saved
- **THEN** the file is smaller than 5,000 bytes (the raw bits would be 125,000 bytes)

### Requirement: Progress can be loaded from a .stitch file
The `Export` menu SHALL offer `Load progress (.stitch)`, a file chooser for `.stitch` files,
enabled while a pattern exists and no pattern is being generated. A file of the current pattern
(same fingerprint, width and height) SHALL become the current progress, with the Progress layer
shown and the note `Loaded your progress from NAME.` until the next toggle. It SHALL be saved in
this browser at once.

#### Scenario: Loading on another device
- **WHEN** `cat.png` is loaded with the settings of `cat.stitch` (12 stitches), nothing is marked, the browser holds no saved progress, and the user loads `cat.stitch`
- **THEN** the same 12 cells are marked, the Progress layer is shown, the counter reads `Stitched 12 of 6,700 (0.1 %)`, the note reads `Loaded your progress from cat.stitch.`, and the browser's saved progress holds those 12 stitches without waiting 500 ms

#### Scenario: Bits of empty cells are ignored
- **WHEN** a file of the 3 × 2 test pattern has the bit of its empty cell 3 and a padding bit set besides cell 0
- **THEN** only cell 0 is marked and the counter counts 1 stitch

#### Scenario: Not available yet
- **WHEN** no pattern exists yet, or a new pattern is being generated
- **THEN** `Load progress (.stitch)` is disabled

#### Scenario: Replacing the browser's progress of another picture
- **WHEN** nothing is marked on `cat.png`'s pattern, the browser holds 30 saved stitches of `dog.png`, and the user loads `cat.stitch`
- **THEN** the question of "Replacing the saved progress of another pattern asks first" is asked; `Keep my progress` loads nothing and keeps `dog.png`'s saved progress, `Start new progress` loads the file

### Requirement: Loading a progress file checks it first
A `.stitch` file SHALL be applied only when it is valid and belongs to the current pattern.
Otherwise the status line SHALL show an error naming the file, and pattern, progress and saved
progress SHALL stay unchanged. Files over 16 MiB SHALL be refused as not a progress file.

#### Scenario: Another picture or other settings
- **WHEN** the current pattern is 100 × 67 and the user loads `cat.stitch`, saved for a 120 × 80 pattern
- **THEN** the status reads `Could not load cat.stitch: it belongs to another picture or other pattern settings. It is for a 120 × 80 pattern; this one is 100 × 67.` and nothing is marked

#### Scenario: Same size, other fingerprint
- **WHEN** `dog.stitch` has the current width and height but another fingerprint
- **THEN** the status reads `Could not load dog.stitch: it belongs to another picture or other pattern settings.`

#### Scenario: Not a progress file
- **WHEN** the user loads `notes.stitch`, which is a text file, or a file shorter than 30 bytes, or a 20 MB file
- **THEN** the status reads `Could not load notes.stitch: it is not a progress file (.stitch).`

#### Scenario: Newer format
- **WHEN** the file has the magic `STITCH` and format version 2
- **THEN** the status reads `Could not load NAME: it was saved by a newer version of this app.`

#### Scenario: Damaged file
- **WHEN** the header matches the current pattern but the compressed part is cut short, has extra bytes after it, or inflates to more or fewer bytes than `ceil(width × height / 8)`
- **THEN** the status reads `Could not load NAME: the file is damaged.` and the 12 marked stitches stay marked

#### Scenario: File name shown literally
- **WHEN** a foreign file named `<b>x</b>.stitch` is loaded
- **THEN** the status shows `Could not load <b>x</b>.stitch: …` as text and the page contains no new `b` element

### Requirement: Loading over marked stitches asks first
While at least one stitch is marked, a valid file of the current pattern SHALL first open the
warning dialog with the text
`Load NAME? Your progress on this pattern (S of T stitches) will be replaced by the file's (F of T stitches).`
and the buttons `Keep my progress` (focused first), `Save progress first` and `Load progress`.
Only `Load progress` SHALL apply the file. An invalid file SHALL show its error without asking.

#### Scenario: Load confirmed
- **WHEN** 12 of 6,700 stitches are marked and the user loads `cat.stitch` with 40 stitches and presses `Load progress`
- **THEN** the dialog read `Load cat.stitch? Your progress on this pattern (12 of 6,700 stitches) will be replaced by the file's (40 of 6,700 stitches).`, and now exactly the file's 40 stitches are marked

#### Scenario: Load cancelled
- **WHEN** the user presses `Keep my progress` (or Esc) instead
- **THEN** the 12 stitches stay marked, and choosing `cat.stitch` again opens the dialog again

### Requirement: The warning dialogs offer to save the progress first
Every warning dialog SHALL show `Save progress first` between `Keep my progress` and the confirm
button. It SHALL download the progress the question is about as a `.stitch` file and keep the
dialog open, with the line `Saved NAME.` in the dialog. Pressing it again saves again. A new
question SHALL start without that line. If the file cannot be made, the line SHALL read
`Could not save the progress file.`

#### Scenario: Save, then change the settings
- **WHEN** 12 stitches of `cat.png` are marked, the user commits width `120`, presses `Save progress first` and then `Change settings`
- **THEN** `cat.stitch` with the 12 stitches is downloaded, the dialog stays open showing `Saved cat.stitch.` until `Change settings` is pressed, and then the 120-wide pattern is generated

#### Scenario: Save, then keep
- **WHEN** the user presses `Save progress first` and then `Keep my progress`
- **THEN** the file is downloaded, and the width and the 12 marks stay as they were

#### Scenario: The saved progress of another picture
- **WHEN** the replace question for `dog.png`'s 30 saved stitches is open and the user presses `Save progress first`
- **THEN** `dog.stitch` with those 30 stitches is downloaded and the line reads `Saved dog.stitch.`
