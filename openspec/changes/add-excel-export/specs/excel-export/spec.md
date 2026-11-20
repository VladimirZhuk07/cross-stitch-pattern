# Spec Delta

## Purpose

Lets the user save the pattern as an Excel workbook (.xlsx): a numbered chart sheet in the chart's
pale tints, a summary sheet with the pictures, and a legend sheet. The file is written in the
browser and opens without repair in Excel and LibreOffice Calc.

Unless stated otherwise, scenarios use the 3 × 2 pattern from the pattern-model spec ("Grid
layout of a 3 × 2 pattern"): cells `[1, 0, 0, -1, 0, 1]`, legend number 1 = `310` "Black"
`#000000` (3 stitches), number 2 = `321` "Red" `#C72B3B` (2 stitches), made from an image named
`cat.png`. "Cell A1" is the worksheet cell in column A, row 1; pattern cell (x, y) is worksheet
column x + 1, row y + 1.

## ADDED Requirements

### Requirement: Excel workbook item in the Export menu
The header's Export menu SHALL offer the button `Excel workbook`. It SHALL be enabled exactly while
a pattern exists and no workbook is being created. Pressing it SHALL close the menu and start the
export of the current pattern.

#### Scenario: No pattern yet
- **WHEN** the page has loaded and no image is chosen
- **THEN** `Excel workbook` is disabled

#### Scenario: Pattern ready
- **WHEN** a pattern has been generated for `cat.png`
- **THEN** `Excel workbook` is enabled, and pressing it closes the Export menu and starts the export

#### Scenario: Pattern cleared by a new image
- **WHEN** a pattern exists and the user loads another image, so the pattern is cleared
- **THEN** `Excel workbook` is disabled until the new pattern is ready

### Requirement: The workbook is saved under the image's name
The workbook SHALL be downloaded as the image's file name with its last extension replaced by
`xlsx`, or `pattern.xlsx` when that name has no base. Its media type SHALL be
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

#### Scenario: Ordinary name
- **WHEN** the pattern of `cat.png` is exported
- **THEN** the downloaded file is named `cat.xlsx`

#### Scenario: Several dots and upper case
- **WHEN** the patterns of `cat.photo.png` and `IMG_0042.JPG` are exported
- **THEN** the files are named `cat.photo.xlsx` and `IMG_0042.xlsx`

#### Scenario: Name without a base
- **WHEN** the pattern of an image named `.png` is exported
- **THEN** the file is named `pattern.xlsx`

### Requirement: Three sheets in a fixed order
The workbook SHALL contain exactly three worksheets, in this order: `Chart`, `Summary`, `Legend`.
It SHALL open on `Chart`.

#### Scenario: Sheet tabs
- **WHEN** the exported workbook is opened in a spreadsheet program
- **THEN** the tabs read `Chart`, `Summary`, `Legend`, and `Chart` is shown

### Requirement: Chart sheet cells hold the legend numbers
On the `Chart` sheet, each pattern cell (x, y) SHALL be the worksheet cell in column x + 1, row y + 1.
A stitched cell SHALL hold its legend number as a numeric value, centred horizontally and vertically,
in black (`#000000`) Calibri 9 pt. An empty cell SHALL hold no value. The used range SHALL be
exactly W columns × H rows.

#### Scenario: Values of the 3 × 2 pattern
- **WHEN** the 3 × 2 pattern is exported
- **THEN** A1 = 2, B1 = 1, C1 = 1, A2 has no value, B2 = 1, C2 = 2; all values are numbers (not text) and black
- **AND** the used range is A1:C2

#### Scenario: Wide pattern columns
- **WHEN** a 10,000 × 100 pattern is exported
- **THEN** its last column is `NTP` and its used range is A1:NTP100

### Requirement: Chart sheet fills are the chart's pale tints
On the `Chart` sheet, each stitched cell SHALL be filled with the pale tint of its DMC color, the
same color as on the on-screen Chart ("Pale tint of a DMC color" in the stitch-chart spec). An empty
cell SHALL be filled `#E0E0E0` and crossed by one thin `#909090` diagonal line from its bottom-left
to its top-right corner, so it differs from grey floss.

#### Scenario: Tints of the 3 × 2 pattern
- **WHEN** the 3 × 2 pattern is exported
- **THEN** B1, C1 and B2 are filled `#B0B0B0` (tint of `310`), A1 and C2 `#FFC0BB` (tint of `321`)
- **AND** A2 is filled `#E0E0E0` with a `#909090` diagonal from bottom-left to top-right and no value

#### Scenario: Grey floss is not empty
- **WHEN** a 2 × 1 pattern with colors `[318 "Steel Gray Light" #ABABAB]` and cells `[0, -1]` is exported
- **THEN** A1 is filled `#E1E1E1` with the value 1 and no diagonal, and B1 is `#E0E0E0` with the diagonal and no value

#### Scenario: Dark floss stays readable
- **WHEN** a cell of `310` `#000000` is exported
- **THEN** its fill is `#B0B0B0`, not `#000000`, and its number is black (contrast 9.68:1)

### Requirement: Chart sheet cells are square
Every column of the `Chart` sheet SHALL be 3.42578125 character units wide, which is 24 px with
Calibri 11 at 96 dpi. Every row SHALL be 18 pt high (24 px). A three-digit legend number in 9 pt
SHALL fit inside a cell, so no cell shows `###`.

#### Scenario: Column and row size
- **WHEN** the 3 × 2 pattern is exported
- **THEN** columns A to C have a custom width of 3.42578125 and rows 1 and 2 a custom height of 18 pt
- **AND** at 100 % zoom in Excel on a 96 dpi screen every cell measures 24 × 24 px

#### Scenario: Largest number fits
- **WHEN** a pattern with 489 legend colors is exported and opened at 100 % zoom
- **THEN** a cell with `489` shows the digits `489`, not `###`

### Requirement: Chart sheet grid lines every stitch and every 10 stitches
Every `Chart` cell SHALL have a thin `#A0A0A0` border. Medium `#000000` borders SHALL mark every
10th stitch from the top-left, as on the on-screen Chart: the right edge of columns 10, 20, … and the
bottom edge of rows 10, 20, …. The grid's outer edge SHALL also be medium black: the left of column
A, the top of row 1, the right of the last column and the bottom of the last row.

#### Scenario: 23 × 12 pattern
- **WHEN** a 23 × 12 pattern is exported
- **THEN** the right edges of columns J (10), T (20) and W (23) and the left edge of column A are medium black, and all other vertical cell edges are thin `#A0A0A0`
- **AND** the bottom edges of rows 10 and 12 and the top edge of row 1 are medium black, and all other horizontal edges are thin `#A0A0A0`

#### Scenario: Borders on empty cells
- **WHEN** the 3 × 2 pattern is exported
- **THEN** the empty cell A2 has a medium black left and bottom edge, a thin right edge, and its diagonal

### Requirement: Summary sheet lists the pattern facts
The `Summary` sheet SHALL show the pattern summary in rows 1 to 3. Column A SHALL hold the label in
bold and column B the value, both as text: `Size` with `W × H stitches`, `Stitches` with the number
of stitched cells, and `Colors` with `N DMC colors` (`1 DMC color` for one color). Numbers SHALL use
comma thousands separators.

#### Scenario: Summary of the 3 × 2 pattern
- **WHEN** the 3 × 2 pattern is exported
- **THEN** A1:B3 read `Size` / `3 × 2 stitches`, `Stitches` / `5`, `Colors` / `2 DMC colors`

#### Scenario: Large numbers and one color
- **WHEN** a 1,200 × 800 pattern with 960,000 stitches in 1 color is summarized
- **THEN** the values read `1,200 × 800 stitches`, `960,000` and `1 DMC color`

#### Scenario: Pattern without stitches
- **WHEN** a 2 × 2 pattern with all cells empty is exported
- **THEN** the summary reads `2 × 2 stitches`, `0` and `0 DMC colors`

### Requirement: Summary sheet shows the original picture and the DMC colors picture
Below the facts, the `Summary` sheet SHALL show two embedded PNG pictures, each under a bold caption.
`Original picture` SHALL show the loaded image, at most 1024 px on its longer side, with its
transparency. `Pattern in DMC colors` SHALL show one block per stitch in its DMC color, empty
cells transparent. Each picture SHALL be displayed at most 480 × 480 px, keeping its aspect ratio,
and never enlarged.

#### Scenario: Layout for a 1600 × 1072 photo and a 100 × 67 pattern
- **WHEN** a 100 × 67 pattern of a 1600 × 1072 image is exported
- **THEN** A5 reads `Original picture` and a 1024 × 686 px PNG is shown at 480 × 322 px with its top-left corner at A6
- **AND** A24 reads `Pattern in DMC colors` and a 1000 × 670 px PNG (10 × 10 px per stitch, sharp block edges) is shown at 480 × 322 px from A25

#### Scenario: Small image is not enlarged
- **WHEN** the pattern of a 300 × 200 image is exported
- **THEN** the original picture is a 300 × 200 px PNG shown at 300 × 200 px

#### Scenario: Large pattern picture
- **WHEN** a 1000 × 1000 pattern is exported
- **THEN** the DMC colors picture is a 1000 × 1000 px PNG (1 px per stitch) shown at 480 × 480 px

### Requirement: Legend sheet lists every DMC color
The `Legend` sheet SHALL have a bold header row `No.`, `Color`, `DMC`, `Name`, `Stitches`. Below it
comes one row per legend entry, in number order:
- the number as a numeric value, filled with its pale tint;
- an empty cell filled with the real DMC color as a swatch;
- the DMC code as text;
- the name as text;
- the stitch count as a numeric value shown with thousands separators.

#### Scenario: Legend of the 3 × 2 pattern
- **WHEN** the 3 × 2 pattern is exported
- **THEN** row 1 reads `No.`, `Color`, `DMC`, `Name`, `Stitches`
- **AND** row 2 reads 1, a swatch filled `#000000`, `310`, `Black`, 3, with A2 filled `#B0B0B0`
- **AND** row 3 reads 2, a swatch filled `#C72B3B`, `321`, `Red`, 2, with A3 filled `#FFC0BB`

#### Scenario: Codes stay text
- **WHEN** a pattern using `310`, `B5200` and `BLANC` is exported
- **THEN** column C holds the texts `310`, `B5200` and `BLANC`, and no "number stored as text" warning is shown for them in Excel

#### Scenario: Thousands separators
- **WHEN** a color has 12,345 stitches
- **THEN** its Stitches cell holds the number 12345 and shows `12,345`

#### Scenario: Names with special characters
- **WHEN** a test color named `Rose & "Wine" <test>` is exported
- **THEN** the Name cell reads exactly `Rose & "Wine" <test>`

#### Scenario: Pattern without stitches
- **WHEN** a 2 × 2 pattern with all cells empty is exported
- **THEN** the `Legend` sheet has only the header row

### Requirement: Large workbooks ask first
When the pattern has more than 250,000 cells (width × height, empty cells included) and at most
1,000,000, the app SHALL ask before creating the workbook. A modal dialog titled `Large workbook`
SHALL give the text below and the buttons `Cancel` (focused) and `Create workbook`. Only
`Create workbook` SHALL start the export.

The text: `This workbook will have <cells> chart cells (<W> × <H>). Large workbooks take longer to
create and open slowly in spreadsheet programs.`

#### Scenario: At the threshold
- **WHEN** a 500 × 500 pattern (250,000 cells) is exported
- **THEN** no question is asked and the export starts

#### Scenario: Above the threshold
- **WHEN** an 800 × 800 pattern is exported
- **THEN** the dialog reads `This workbook will have 640,000 chart cells (800 × 800). Large workbooks take longer to create and open slowly in spreadsheet programs.`

#### Scenario: Cancel
- **WHEN** the user presses `Cancel` or Esc in that dialog
- **THEN** no workbook is created and the status line is unchanged

#### Scenario: Confirm
- **WHEN** the user presses `Create workbook`
- **THEN** the export starts

### Requirement: Patterns above 1,000,000 cells are refused
When the pattern has more than 1,000,000 cells the app SHALL NOT create a workbook. It SHALL show
this error in the status line instead: `This pattern is too large for an Excel workbook: <cells>
cells (<W> × <H>), at most 1,000,000. Choose a smaller width.` The limit keeps the file size and the
creation time manageable. Excel's own column limit is above the 10,000-stitch maximum.

#### Scenario: At the cap
- **WHEN** a 1000 × 1000 pattern is exported and the user confirms
- **THEN** the workbook is created

#### Scenario: Above the cap
- **WHEN** a 2000 × 2000 pattern is exported
- **THEN** no dialog opens, no file is downloaded, and the status line shows the error `This pattern is too large for an Excel workbook: 4,000,000 cells (2000 × 2000), at most 1,000,000. Choose a smaller width.`

#### Scenario: Wide but short
- **WHEN** a 10,000 × 101 pattern (1,010,000 cells) is exported
- **THEN** it is refused with `1,010,000 cells (10000 × 101)` in the message

### Requirement: Export status and responsiveness
While the workbook is created, the status line SHALL read `Creating Excel workbook…`, the view
SHALL be marked busy, the `Excel workbook` item SHALL be disabled, and the page SHALL keep reacting
to input. Afterwards the status line SHALL read `Excel workbook ready: <file name>`, or
`Could not create the Excel workbook: <reason>` on failure.

#### Scenario: Successful export
- **WHEN** the pattern of `cat.png` is exported
- **THEN** the status line reads `Creating Excel workbook…`, then `Excel workbook ready: cat.xlsx`, and `cat.xlsx` is downloaded

#### Scenario: Panning during a large export
- **WHEN** a 1000 × 1000 workbook is being created and the user drags the view
- **THEN** the view pans without freezing, and the workbook is ready within 10 s on a current desktop browser

#### Scenario: Failure
- **WHEN** creating the workbook fails with the reason `out of memory`
- **THEN** the status line shows the error `Could not create the Excel workbook: out of memory`, no file is downloaded, and `Excel workbook` is enabled again

### Requirement: The file is a valid Office Open XML workbook
The file SHALL be a ZIP archive, without ZIP64, that holds exactly these parts:
- `[Content_Types].xml` and `_rels/.rels`;
- `xl/workbook.xml` and `xl/_rels/workbook.xml.rels`;
- `xl/styles.xml`;
- `xl/worksheets/sheet1.xml` (Chart), `xl/worksheets/sheet2.xml` (Summary) and
  `xl/worksheets/sheet3.xml` (Legend);
- `xl/worksheets/_rels/sheet2.xml.rels`;
- `xl/drawings/drawing1.xml` and `xl/drawings/_rels/drawing1.xml.rels`;
- `xl/media/image1.png` and `xl/media/image2.png`.

Each entry's CRC-32 SHALL match its content. XML parts SHALL be deflated when the browser can
compress, and stored otherwise. PNGs SHALL be stored. Excel and LibreOffice Calc 7.4 or later SHALL
open the file without a repair prompt.

#### Scenario: Parts and content types
- **WHEN** the workbook of the 3 × 2 pattern is unzipped
- **THEN** it holds exactly the 13 parts listed above, every XML part is well-formed UTF-8, and `[Content_Types].xml` gives each part its SpreadsheetML, drawing or `image/png` content type

#### Scenario: Checksums
- **WHEN** every entry is decompressed
- **THEN** each entry's CRC-32 and size equal those of its content, with CRC-32 as in ZIP (`123456789` → `CBF43926`)

#### Scenario: Same pattern, same file
- **WHEN** the same pattern with the same pictures is exported twice in the same browser
- **THEN** both files are byte-identical (fixed entry timestamps of 1980-01-01 00:00)

#### Scenario: Browser without compression
- **WHEN** the browser has no `CompressionStream`
- **THEN** the workbook is still created, with every entry stored, and opens without repair

#### Scenario: Opening in spreadsheet programs
- **WHEN** a 100 × 67 workbook is opened in Excel and in LibreOffice Calc
- **THEN** neither program reports a problem or offers a repair, and both show the three sheets as described

### Requirement: The workbook is created on the device
Creating the workbook SHALL NOT send any network request. The image, the pattern and the file
SHALL stay in the browser until the user's download saves the file.

#### Scenario: No requests
- **WHEN** a workbook is exported with the browser's network panel open
- **THEN** no request is made except the download of the in-memory file itself
