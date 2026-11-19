# responsive-layout Specification

## Purpose

Arranges the app for the screen it runs on: the desktop layout on wide windows and a compact,
touch-friendly layout on phones (portrait and landscape), where the frame gets most of the
screen and the settings and legend fold away behind buttons that summarise them.

Sizes are CSS px at the default 16 px root font (1rem = 16 px). "Wide" means a window at
least 72rem (1152 px) wide; "medium" at least 48rem (768 px) and below 72rem; "compact" a
screen narrower than 48rem, or lower than 30rem (480 px) while narrower than 60rem (960 px).
"Compact landscape" is a compact screen in landscape orientation lower than 30rem. The
layouts apply to the screen only, never to printing.

## Requirements

### Requirement: Viewport is set up for phones
The page SHALL declare the viewport as `width=device-width, initial-scale=1, viewport-fit=cover`
and SHALL NOT restrict page zoom (no `maximum-scale`, `minimum-scale` or `user-scalable`).
The page content SHALL be padded by the device's safe-area insets so that nothing is covered
by a notch, rounded corners or the home indicator.

#### Scenario: Viewport meta tag
- **WHEN** `index.html` is read
- **THEN** it has exactly one `<meta name="viewport">` with content `width=device-width, initial-scale=1, viewport-fit=cover`

#### Scenario: Notch in landscape
- **WHEN** the app runs on a phone in landscape with a left safe-area inset of 47 px
- **THEN** the header, the frame and every control start at least 47 px from the left screen edge

#### Scenario: No safe-area insets
- **WHEN** the app runs in a desktop browser (all insets 0)
- **THEN** the page has the same padding as before this change

### Requirement: Desktop and medium layouts stay unchanged
On wide and medium windows with both side panels open, the app SHALL keep its existing layout:
wide shows settings (16rem), frame and legend (24rem) side by side; medium shows settings and
frame side by side with the legend below them. The compact `Settings` and `Legend` toggle
buttons SHALL NOT be shown there; the only panel controls are the side toggles. The settings
fields and legend rows SHALL be visible whenever their panel is open.

#### Scenario: Desktop window
- **WHEN** the window is 1440 × 900 with a pattern and both panels open
- **THEN** the settings column is 256 px wide, the legend 384 px wide, the frame fills the rest, no compact `Settings` or `Legend` toggle is visible, and one side toggle is visible in each panel

#### Scenario: Tablet portrait
- **WHEN** the window is 820 × 1180 (medium) with a pattern and both panels open
- **THEN** settings and frame are side by side and the legend is below them, across the full width, at most 472 px (40 % of the height) tall

### Requirement: Compact portrait layout gives the frame the remaining height
On a compact screen the app SHALL show one column, top to bottom: the header (title and
`Choose image`), the settings toggle with the generation status, the view switcher, the frame,
one row with the status line and the zoom controls, and the legend toggle. The frame SHALL fill
the height left over in the dynamic viewport (which follows the browser's address bar), and
SHALL be at least 10rem (160 px) tall.

#### Scenario: iPhone SE with collapsed panels
- **WHEN** the screen is 375 × 667, a 1200 × 800 image and its pattern are loaded and both panels are collapsed
- **THEN** the page does not scroll vertically and the frame is at least 300 px tall and as wide as the page content

#### Scenario: Address bar hides
- **WHEN** the mobile browser hides its address bar and the visible height grows by 56 px
- **THEN** the frame grows by 56 px and the view stays centred on the same image point

#### Scenario: Both panels expanded on a short screen
- **WHEN** the screen is 375 × 667 and both the settings and the legend are expanded
- **THEN** the frame is at least 160 px tall and the page scrolls vertically to reach the rest

### Requirement: Compact landscape layout puts the panels beside the frame
On a compact landscape screen the app SHALL show the header on top, the frame on the left with
the view switcher, zoom controls and status line in a 9rem (144 px) column right of it, and
the settings and legend panels in a 16rem (256 px) side column at the right edge, scrolling on
their own. The frame SHALL fill the full height below the header.

#### Scenario: iPhone SE in landscape
- **WHEN** the screen is 667 × 375 with a pattern
- **THEN** the settings and legend toggles are in a 256 px column at the right, the frame is at least 280 px tall and at least 220 px wide, and the page does not scroll vertically while the panels are collapsed

#### Scenario: Pixel 7 in landscape
- **WHEN** the screen is 915 × 412 (compact: lower than 480 and narrower than 960)
- **THEN** the compact landscape layout is used, not the medium layout

### Requirement: Nothing scrolls sideways down to 360 px
On screens 360 px wide and wider, the page SHALL NOT scroll horizontally: long texts (file
names, status, size, DMC names) SHALL wrap, and the legend table SHALL fit the width.

#### Scenario: Long file name on a small phone
- **WHEN** the screen is 360 × 640, the legend is expanded, and the status reads `IMG_20261114_134501_HDR_panorama_from_the_phone_camera.jpg — 2048 × 1536 px`
- **THEN** the page's scroll width equals 360 px and the status wraps onto several lines

#### Scenario: Long DMC name
- **WHEN** the legend shows `3865` "Winter White" and `939` "Navy Blue Very Dark" at 360 px
- **THEN** every column is visible without horizontal scrolling and long names wrap inside the Name column

### Requirement: Controls are at least 44 × 44 px on touch screens
On a compact screen, and on any screen whose primary pointer is coarse (touch), every
interactive control SHALL be at least 44 × 44 px: `Choose image`, the panel toggles, each view
option, `−`, `+`, `Fit`, and the settings fields. Settings fields SHALL use a font of at least
16 px. On wide and medium screens with a fine pointer, controls SHALL keep their desktop size.

#### Scenario: iPhone SE
- **WHEN** the screen is 375 × 667
- **THEN** `Choose image`, `Settings`, `Original`, `DMC colors`, `Chart`, `−`, `+`, `Fit` and the legend toggle are each at least 44 × 44 px

#### Scenario: Tablet with touch
- **WHEN** the screen is 820 × 1180 with a coarse pointer
- **THEN** the medium layout is used and `−`, `+`, `Fit` and each view option are at least 44 × 44 px

#### Scenario: Desktop with a mouse
- **WHEN** the window is 1440 × 900 with a fine pointer
- **THEN** the zoom buttons keep their desktop size (36 × 32 px)

#### Scenario: Focusing a field does not zoom the page
- **WHEN** the user taps the `Width (stitches)` field on an iPhone
- **THEN** the field's font is at least 16 px, so the browser does not zoom the page in

### Requirement: View switcher is a segmented control on compact screens
On a compact screen the view switcher SHALL show `Original`, `DMC colors` and `Chart` as three
adjacent segments filling the row, with the selected one marked by a thicker accent border and
bold text (not by color alone). Its `View` caption SHALL stay available to screen readers.
It SHALL remain a radio group operable with the keyboard, with a visible focus ring.

#### Scenario: Selected segment
- **WHEN** a pattern exists at 375 px and the user taps `Chart`
- **THEN** `Chart` is selected, shown with a thicker border and bold text, and the frame shows the Chart layer

#### Scenario: No pattern
- **WHEN** no pattern exists at 375 px
- **THEN** `DMC colors` and `Chart` are visible but disabled, as on desktop

### Requirement: Settings fold into a summary button on compact screens
On a compact screen the settings fields and the size text SHALL be hidden behind a `Settings`
toggle button that reports its state with `aria-expanded` and names the panel with
`aria-controls`. The panel SHALL start collapsed on every page load. Enter, Space or a tap
SHALL toggle it. The generation status SHALL stay visible while it is collapsed.

#### Scenario: First start on a phone
- **WHEN** the app opens at 375 × 667
- **THEN** the `Settings` button shows `aria-expanded="false"` and the width, color and fabric fields are not visible

#### Scenario: Expanding with the keyboard
- **WHEN** the `Settings` button has focus and the user presses Enter
- **THEN** `aria-expanded` becomes `"true"` and the three fields and the size text are visible; pressing Enter again hides them

#### Scenario: Status while collapsed
- **WHEN** the settings are collapsed and a pattern finishes
- **THEN** `Pattern ready: 100 × 67 stitches, 18 DMC colors.` is visible under the `Settings` button and announced politely

#### Scenario: Resizing to desktop and back
- **WHEN** the settings are collapsed at 375 px, the window is widened to 1440 px, then narrowed to 375 px again
- **THEN** at 1440 px the fields are visible and no toggle is shown; at 375 px they are collapsed again

### Requirement: Settings summary text
The `Settings` toggle SHALL show a summary of the settings in use: the stitch dimensions, the
max colors, the fabric count and the finished width × height in inches with one decimal,
joined by ` · `. Without an image it SHALL show the width setting instead of dimensions. A grid
side above the stitch limit SHALL read `too large` instead of a size. The summary SHALL use the
last valid settings, never an invalid typed value.

#### Scenario: Image loaded
- **WHEN** a 1200 × 800 image is loaded with width 100, max colors 24 and fabric 14 ct
- **THEN** the summary reads `100 × 67 · max 24 colors · 14 ct · 7.1 × 4.8 in`

#### Scenario: No image yet
- **WHEN** no image is loaded and the settings are the defaults
- **THEN** the summary reads `Width 100 · max 24 colors · 14 ct`

#### Scenario: One color on 18 ct
- **WHEN** a 1200 × 800 image is loaded with width 100, max colors 1 and fabric 18 ct
- **THEN** the summary reads `100 × 67 · max 1 color · 18 ct · 5.6 × 3.7 in`

#### Scenario: Grid too large
- **WHEN** a 41 × 2048 image is loaded with width 250 (250 × 12488 stitches, above the 10000 limit)
- **THEN** the summary reads `250 × 12488 · too large · max 24 colors · 14 ct` and is shown in the error color

#### Scenario: Grid wider than the image
- **WHEN** a 3200 × 4000 image is loaded with width 5000 and fabric 14 ct
- **THEN** the summary reads `5000 × 6250 · max 24 colors · 14 ct · 357.1 × 446.4 in` and is not shown in the error color (the no-detail note is in the expanded size text)

#### Scenario: Invalid value typed before collapsing
- **WHEN** a 1200 × 800 image is loaded with width 100, the user types `5` into the width and collapses the settings
- **THEN** the summary still reads `100 × 67 · max 24 colors · 14 ct · 7.1 × 4.8 in`

### Requirement: Legend folds into a toggle on compact screens
While a pattern exists on a compact screen, the legend SHALL be hidden behind a toggle button
showing `Legend` and the number of colors, with `aria-expanded` and `aria-controls`. It SHALL
start collapsed on every page load. Expanded in the compact portrait layout, the rows SHALL
scroll inside a panel at most 40 % of the dynamic viewport height, with the column headers
kept visible.

#### Scenario: Collapsed legend
- **WHEN** a pattern with 18 legend entries exists at 375 × 667
- **THEN** a button reading `Legend` and `18 colors` with `aria-expanded="false"` is shown under the frame and no legend rows are visible

#### Scenario: Expanded legend scrolls inside
- **WHEN** the user expands the legend of an 18-color pattern at 375 × 667
- **THEN** the legend panel is at most 267 px tall, its rows scroll inside it with the header row `No. Color DMC Name Stitches` staying visible, and the frame shrinks while staying centred on the same image point

#### Scenario: One color and no stitches
- **WHEN** the pattern has 1 legend entry, or none (fully transparent image)
- **THEN** the toggle shows `1 color`, or `no stitches` respectively

#### Scenario: No pattern
- **WHEN** no pattern exists at 375 px
- **THEN** neither the legend nor its toggle is shown

### Requirement: Choose image is a large button
The image chooser SHALL look like a button labelled `Choose image` on every screen size, hide
the browser's native file box, and still be reachable with Tab and opened with Enter or Space,
with a visible focus ring. It SHALL accept `image/*` without a `capture` attribute, so phones
offer the photo gallery, the camera and files.

#### Scenario: Keyboard
- **WHEN** the user tabs to `Choose image` and presses Space
- **THEN** a focus ring is visible around the button and the browser's file chooser opens

#### Scenario: Phone picker
- **WHEN** the user taps `Choose image` on a phone
- **THEN** the system picker offers the photo library and the camera, and a chosen photo loads as with any other file

#### Scenario: Chooser markup
- **WHEN** `index.html` is read
- **THEN** the file input has `accept="image/*"`, no `capture` attribute, and sits inside a label whose text is `Choose image`

### Requirement: Side panels fold to their edge on wide and medium screens
On wide and medium screens the settings panel SHALL fold to the left edge and the legend to its
own edge: the right edge on wide screens, the bottom edge on medium screens. A folded panel
SHALL shrink to a rail 2.75rem (44 px) wide (a 44 px tall bar for the medium legend). The rail
SHALL show only that panel's side toggle, and the frame SHALL take the freed space. Each panel
folds independently.

#### Scenario: Folding the settings on a desktop
- **WHEN** the window is 1440 × 900 with a pattern, both panels open (frame column 736 px wide), and the user presses the settings side toggle
- **THEN** the settings become a 44 px rail at the left edge showing only `Settings`, the width, color and fabric fields are not visible, and the frame column is 948 px wide

#### Scenario: Both panels folded on a desktop
- **WHEN** the user then also presses the legend side toggle
- **THEN** the legend becomes a 44 px rail at the right edge showing only `Legend`, no legend rows are visible, and the frame column is 1288 px wide

#### Scenario: Folding the legend on a tablet
- **WHEN** the window is 820 × 1180 (medium) with a pattern and the user presses the legend side toggle
- **THEN** the legend becomes a 44 px tall bar across the full width at the bottom of the page content (no gap below it), showing only `Legend`, and the settings and frame fill all the height above it (the frame grows from 406 px to 919 px tall)

#### Scenario: Folding the settings on a tablet
- **WHEN** the window is 820 × 1180 with both panels open (frame column 516 px wide) and the user presses the settings side toggle
- **THEN** the settings become a 44 px rail at the left and the frame column is 728 px wide

#### Scenario: Opening a folded panel
- **WHEN** the settings are folded and the user presses the `Settings` rail toggle
- **THEN** the settings column is 256 px wide again with all fields, the size text and the generation status visible

#### Scenario: No pattern yet
- **WHEN** no pattern exists on a 1440 × 900 window
- **THEN** the settings side toggle is shown and neither the legend nor its side toggle is shown

### Requirement: Side toggles are accessible buttons
Each side toggle SHALL be a native button named `Settings` or `Legend`, SHALL report its state
with `aria-expanded` (`"true"` while the panel is open), and SHALL name its panel with
`aria-controls`. Its tooltip SHALL read `Hide settings` / `Show settings` (`Hide legend` /
`Show legend`) for the current state. Enter, Space or a click SHALL toggle it. Focus SHALL stay
on it after toggling, with a visible focus ring. It SHALL be at least 44 × 44 px on coarse pointers.

#### Scenario: Keyboard folding
- **WHEN** the settings side toggle has focus with `aria-expanded="true"` and the user presses Enter
- **THEN** the settings fold, the toggle keeps focus with a visible focus ring, `aria-expanded` is `"false"` and the tooltip reads `Show settings`; pressing Space opens the panel again and sets `aria-expanded="true"`

#### Scenario: Markup
- **WHEN** `index.html` is read
- **THEN** the settings and legend panels each contain exactly one side toggle `<button type="button">` whose `aria-controls` is the id of the panel that contains it

#### Scenario: Touch tablet
- **WHEN** the window is 1024 × 1366 with a coarse pointer and the legend is folded
- **THEN** the `Legend` rail toggle is at least 44 × 44 px

### Requirement: Folded state is remembered across page loads
The app SHALL store the open/folded state of both side panels in the browser's local storage
under the key `cross-stitch-pattern-maker:side-panels` and SHALL restore it on page load
before the first pattern is shown. Without a stored value, with a value it cannot read, or when
storage is blocked, both panels SHALL start open. No message is shown in these cases. A failed
write SHALL NOT interrupt the app.

#### Scenario: Reloading after folding
- **WHEN** the user folds the legend on a 1440 × 900 window and reloads the page
- **THEN** the stored value is `{"settings":"open","legend":"folded"}`, and once a pattern exists the legend is a folded rail while the settings are open

#### Scenario: First visit
- **WHEN** nothing is stored under the key
- **THEN** both panels start open

#### Scenario: Unreadable stored value
- **WHEN** the stored value is `not json`, or `{"settings":"sideways"}`
- **THEN** both panels start open for the first value; for the second, the settings start open (unknown value) and the legend starts open (missing value)

#### Scenario: Storage blocked
- **WHEN** the browser throws on every local storage access (e.g. storage disabled)
- **THEN** both panels start open, folding still works for the session, and no error is shown

### Requirement: Folding keeps the view centred
When a side panel folds or opens, the zoom SHALL stay the same and the image point at the frame
centre SHALL stay at the frame centre, as for any other frame resize.

#### Scenario: Folding the settings at a fixed zoom
- **WHEN** a pattern is shown at 400 % with stitch (120, 80) at the frame centre and the user folds the settings
- **THEN** the zoom still reads 400 % and stitch (120, 80) is still at the frame centre

### Requirement: Folded settings open when generation needs the user
While the settings panel is folded, it SHALL open by itself (and store the open state) when the
generation status becomes waiting for **Generate** (a large pattern) or failed, so that the
message and the Generate button are visible. Other status changes SHALL NOT open it.

#### Scenario: Large pattern while folded
- **WHEN** the settings are folded, the width is 2001, and a 1000 × 1000 px image is loaded
- **THEN** the settings open, `This pattern has 4,004,001 stitches. … Press Generate to start.` and the Generate button are visible, and the stored settings state is `open`

#### Scenario: Generation error while folded
- **WHEN** the settings are folded and the worker answers with the error `boom`
- **THEN** the settings open and show `Could not generate the pattern: boom`

#### Scenario: Normal generation while folded
- **WHEN** the settings are folded and a 100 × 67 pattern is generated successfully
- **THEN** the settings stay folded

### Requirement: Compact screens and printing ignore the side state
Side toggles SHALL NOT be shown on compact screens or in print. On compact screens the panels
SHALL behave as the compact requirements describe, whatever side state is stored. When
printing, the panels SHALL print as if they were open. The side state SHALL survive a resize to
compact and back.

#### Scenario: Resizing to a phone width and back
- **WHEN** both panels are folded at 1440 × 900, the window is narrowed to 375 × 667, then widened to 1440 × 900 again
- **THEN** at 375 px no side toggle is visible and the compact `Settings` and `Legend` toggles work as before; at 1440 px both panels are folded rails again

#### Scenario: Printing with a folded legend
- **WHEN** the legend is folded on a desktop and the user prints
- **THEN** no side toggle is printed and the legend rows are printed
