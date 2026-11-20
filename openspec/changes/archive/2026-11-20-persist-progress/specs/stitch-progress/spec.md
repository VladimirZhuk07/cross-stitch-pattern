# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
fingerprint, the first mark on the current pattern SHALL open the warning dialog with the text
`Start a new progress? This browser keeps one progress: the saved one for NAME (S of T stitches) will be replaced.`
and the buttons `Keep my progress` and `Start new progress`. Only `Start new progress` SHALL
mark the stitch; later marks SHALL not ask again.

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
