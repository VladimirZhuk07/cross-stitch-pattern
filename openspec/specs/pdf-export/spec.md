# pdf-export Specification

## Purpose

Exports the current pattern as a printable A4 PDF chart: an info page with the pictures,
summary and page map, legend pages, and numbered chart pages of up to 50 × 80 stitches. The
file is created entirely on the device.

Unless stated otherwise, scenarios use these patterns:
- the **3 × 2 pattern** from the pattern-model spec ("Grid layout of a 3 × 2 pattern"): cells
  `[1, 0, 0, -1, 0, 1]`, legend 1 = `310` "Black" `#000000` (3 stitches), 2 = `321` "Red"
  `#C72B3B` (2 stitches);
- the **120 × 90 pattern**: 120 × 90 stitches, 3 DMC colors, no empty cells, made from `cat.png`.

PDF coordinates are in points (1 pt = 1/72 in, 1 mm = 2.8346 pt), with the origin at the
bottom-left corner of the A4 page (595.28 × 841.89 pt). "Within 0.01" means each number is
compared with a tolerance of 0.01.

## Requirements

### Requirement: The Export menu offers a PDF chart while a pattern exists
The header SHALL contain the shared `Export` menu with a `PDF chart` item. The item SHALL be
enabled exactly while a pattern exists and no PDF export is running. Choosing it SHALL close the
menu and start the export of the current pattern.

#### Scenario: No pattern yet
- **WHEN** an image is loaded but its pattern is still being generated
- **THEN** the `PDF chart` item is disabled

#### Scenario: Pattern ready
- **WHEN** the 120 × 90 pattern is stored and the user opens `Export` and clicks `PDF chart`
- **THEN** the menu closes and the export dialog opens

#### Scenario: Export running
- **WHEN** a PDF export is running
- **THEN** the `PDF chart` item is disabled until the export finishes, fails or is cancelled

### Requirement: The PDF is named after the image
The downloaded file SHALL be named after the loaded image's file name with its last extension
replaced by `.pdf`. A name without a base part SHALL give `pattern.pdf`. The file SHALL be saved
as a download from memory of the page, and nothing SHALL be sent over the network.

#### Scenario: Usual name
- **WHEN** the pattern of `cat.png` is exported
- **THEN** the download is named `cat.pdf` with type `application/pdf`

#### Scenario: Several dots and no base
- **WHEN** the images are named `cat.photo.png` and `.png`
- **THEN** the PDFs are named `cat.photo.pdf` and `pattern.pdf`

### Requirement: The PDF is split into info, legend and chart pages
The PDF SHALL contain, in this order: one info page; page map pages, only when the page map does
not fit the info page; legend pages; and chart pages. The pattern SHALL be cut into chart pages of
50 columns × 80 rows, starting at the top-left corner. The last page column and row MAY be
narrower or shorter. Chart pages SHALL be ordered left to right, then top to bottom.

#### Scenario: 120 × 90 pattern
- **WHEN** the 120 × 90 pattern is exported
- **THEN** the PDF has 8 pages: the info page, one legend page and 6 chart pages
- **AND** chart pages 1–3 cover columns 1–50, 51–100 and 101–120 of rows 1–80, and pages 4–6 the same columns of rows 81–90

#### Scenario: Single small pattern
- **WHEN** the 3 × 2 pattern is exported
- **THEN** the PDF has 3 pages: info, legend and one chart page covering columns 1–3 and rows 1–2

#### Scenario: Page counts of other sizes
- **WHEN** patterns of 300 × 200 (24 colors), 1000 × 1000 (24 colors) and 200 × 150 (489 colors) are planned
- **THEN** they have 20 pages (18 chart pages), 264 pages (2 page map pages, 260 chart pages) and 19 pages (10 legend pages, 8 chart pages)

### Requirement: The page count is shown and large PDFs ask first
Before any page is written, the export dialog SHALL show the PDF's total page count and its number
of chart pages. Up to 100 pages in total, the export SHALL start at once. Above 100 pages, the
dialog SHALL ask `This PDF will have <total> pages (<chart> chart pages). Large PDFs take a while to create and print. Create it?`
with the buttons `Cancel` and `Create PDF`, and SHALL export only after `Create PDF`.

#### Scenario: 92 pages start at once
- **WHEN** a 450 × 800 pattern with 24 colors is exported
- **THEN** the dialog reads `Creating the PDF: 92 pages (90 chart pages)…` and the export starts without a question

#### Scenario: 102 pages ask
- **WHEN** a 500 × 800 pattern with 24 colors is exported
- **THEN** the dialog reads `This PDF will have 102 pages (100 chart pages). Large PDFs take a while to create and print. Create it?`
- **AND** `Cancel` or Esc closes it without exporting, and `Create PDF` starts the export

### Requirement: PDFs above 1,000 pages are not created
When the PDF would have more than 1,000 pages in total, the export dialog SHALL read
`This pattern needs <total> PDF pages, but a PDF can have at most 1,000. Choose a smaller width to export a PDF.`
with a `Close` button. No page SHALL be written and nothing SHALL be downloaded. A PDF of exactly
1,000 pages SHALL be allowed.

#### Scenario: 2000 × 2000 pattern
- **WHEN** a 2000 × 2000 pattern with 24 colors is exported
- **THEN** the dialog reads `This pattern needs 1,007 PDF pages, but a PDF can have at most 1,000. Choose a smaller width to export a PDF.` and no file is downloaded

#### Scenario: Largest allowed pattern
- **WHEN** a 2000 × 1600 pattern with 24 colors is exported
- **THEN** the dialog asks about 806 pages (800 chart pages), and after `Create PDF` a PDF with 806 pages is downloaded

#### Scenario: Largest grid
- **WHEN** a 10000 × 10000 pattern with 24 colors is exported
- **THEN** the dialog reads `This pattern needs 25,114 PDF pages, but a PDF can have at most 1,000. Choose a smaller width to export a PDF.`

### Requirement: The export shows its progress and can be cancelled
While the PDF is created, the dialog SHALL show a progress bar from 0 to 100 % of the pages
written and a `Cancel` button. The page stays responsive: the work runs off the main thread, and the
modal dialog keeps the settings and the image unchanged meanwhile. `Cancel` or Esc SHALL stop the work at
once, download nothing and close the dialog. When the PDF is ready, it SHALL be downloaded and the
dialog SHALL close. A failure SHALL show `Could not create the PDF: <reason>` with a `Close` button.

#### Scenario: Progress of an 806-page PDF
- **WHEN** the 806-page PDF is being created and 403 pages are written
- **THEN** the progress bar shows 50 %, and the page keeps drawing frames (no gap of a quarter second), while the modal dialog keeps input away from the page behind it

#### Scenario: Cancel
- **WHEN** the user presses `Cancel` while the 806-page PDF is being created
- **THEN** the work stops, no file is downloaded, the dialog closes and `PDF chart` is enabled again

#### Scenario: Failure
- **WHEN** the original picture cannot be encoded as JPEG (the encoder rejects)
- **THEN** the dialog reads `Could not create the PDF: ` followed by the error message, and nothing is downloaded

### Requirement: The info page shows the pictures and the summary
The first page SHALL carry no page number. It SHALL show `Cross-stitch pattern` in bold and the
image file name below it. Side by side, it SHALL show the original picture under `Original` and
the pattern in its DMC colors under `DMC colors`, each fitted into a 90 × 90 mm box, keeping its
aspect ratio. Below them it SHALL list the summary lines `Size`, `Stitches`, `Colors` and
`Finished size` on the fabric count chosen in the settings.

#### Scenario: Summary of a 100 × 67 pattern
- **WHEN** a 100 × 67 pattern of `cat.png` with 21 colors and 6,700 stitches is exported with 14 ct fabric
- **THEN** page 1 shows `cat.png` and the lines `Size` `100 × 67 stitches`, `Stitches` `6,700`, `Colors` `21 DMC colors` and `Finished size` `7.1 × 4.8 in (18.1 × 12.2 cm) on 14 ct`

#### Scenario: Pictures keep their shape
- **WHEN** the 100 × 67 pattern is exported
- **THEN** both pictures are 90 mm wide and about 60.3 mm high, top-aligned in their boxes

#### Scenario: Sharp DMC picture
- **WHEN** the 100 × 67 pattern is exported
- **THEN** the DMC colors picture is a 1200 × 804 px JPEG, 12 × 12 px of one color per stitch, with empty cells white

#### Scenario: Large original picture
- **WHEN** the loaded image is 4000 × 3000 px
- **THEN** the original picture in the PDF is 1200 × 900 px

### Requirement: The info page shows a page map
When the chart pages fit in at most 15 columns of pages and at most 25 rows of pages, the info page
SHALL show a page map below the summary. The map is a grid of one box per chart page with its page
number. Above each column of boxes it SHALL show the column range, and left of each row of boxes the
row range, both counted from 1.

#### Scenario: 120 × 90 pattern
- **WHEN** the 120 × 90 pattern is exported
- **THEN** the page map has 3 × 2 boxes numbered `1`, `2`, `3` in the top row and `4`, `5`, `6` below
- **AND** the column ranges read `1–50`, `51–100`, `101–120` and the row ranges `1–80`, `81–90`

#### Scenario: Largest map on the info page
- **WHEN** a 750 × 2000 pattern is exported
- **THEN** the info page shows a map of 15 × 25 boxes, and the PDF has no page map pages

### Requirement: Large page maps are listed on extra pages
When the chart pages need more than 15 columns or more than 25 rows of pages, the info page SHALL
read `The page map is on the next <n> pages.` (`next page.` for one). The page map pages SHALL
list every chart page as `<page>`, `<columns>`, `<rows>` under the headings `Page`, `Columns` and
`Rows`, in 4 blocks of 56 lines per page, with no page number.

#### Scenario: 1000 × 1000 pattern
- **WHEN** a 1000 × 1000 pattern is exported
- **THEN** the info page reads `The page map is on the next 2 pages.`
- **AND** the list starts with `1` `1–50` `1–80` and ends with `260` `951–1000` `961–1000`, with 224 entries on the first page map page

#### Scenario: 751 columns
- **WHEN** a 751 × 80 pattern is exported
- **THEN** it needs 16 columns of pages, and the info page reads `The page map is on the next page.`

### Requirement: Legend pages list every color
The legend pages SHALL carry no page number. They SHALL list every legend entry in number order,
50 rows per page, under the heading `Legend` (`Legend (continued)` on later pages) and the column
headings `No.`, `Color`, `DMC`, `Name` and `Stitches`. Each row SHALL show the number in black in a
box filled with the color's pale tint, a swatch of the DMC color with a grey border, the DMC code,
the name, and the stitch count right-aligned with thousands separators.

#### Scenario: Legend of the 3 × 2 pattern
- **WHEN** the 3 × 2 pattern is exported
- **THEN** the legend page has 2 rows: `1` on `#B0B0B0`, swatch `#000000`, `310`, `Black`, `3`, and `2` on `#FFC0BB`, swatch `#C72B3B`, `321`, `Red`, `2`

#### Scenario: 489 colors
- **WHEN** a pattern with 489 legend entries is exported
- **THEN** there are 10 legend pages: 9 with 50 rows and the last with 39 rows, ending with number `489`

#### Scenario: Large count
- **WHEN** a legend entry has 12345 stitches
- **THEN** its row shows `12,345`

#### Scenario: Pattern without stitches
- **WHEN** a 2 × 2 pattern with all cells empty is exported
- **THEN** the one legend page reads `This pattern has no stitches.`, and the summary reads `0 DMC colors` and `0` stitches

### Requirement: Chart cells are pale tints with their legend number
Chart pages SHALL draw every cell as a square of 3.2 mm (9.07 pt). The grid's top-left corner is
at x 30 mm, 23 mm below the page top (x 85.04 pt, y 776.69 pt), on every chart page. A stitched
cell SHALL be filled with the pale tint of its legend color and show its number in black
Helvetica at 4.08 pt, centred in the cell. An empty cell SHALL be `#E0E0E0` with a `#909090`
diagonal from its bottom-left to its top-right corner and no number.

#### Scenario: Cells of the 3 × 2 pattern
- **WHEN** the 3 × 2 pattern is exported
- **THEN** on chart page 1 the cell at column 0, row 0 is a 9.07 × 9.07 pt square with its bottom-left corner at (85.04, 767.62), filled `#FFC0BB`, with a black `2` whose centre is at (89.57, 772.16), all within 0.01
- **AND** the cell at column 0, row 1 is `#E0E0E0` with a diagonal from (85.04, 758.55) to (94.11, 767.62) and no number
- **AND** the page shows exactly 5 numbers: `2`, `1`, `1`, `1`, `2`

#### Scenario: Highlight and progress are not exported
- **WHEN** color 2 is selected in the legend and 3 stitches are marked on the Progress layer while the PDF is exported
- **THEN** every cell still shows its pale tint and black number

#### Scenario: Last page column
- **WHEN** chart page 3 of the 120 × 90 pattern is drawn
- **THEN** its 20 columns start at x 85.04 pt, like on page 1, and the page right of column 120 stays empty

### Requirement: Chart pages have grid lines every stitch and every 10 stitches
A chart page SHALL draw a thin `#A0A0A0` line of 0.3 pt between all cells, and a bold black line of
0.9 pt on every stitch boundary that is a multiple of 10, counted from the pattern's top-left
corner, and along the pattern's far right and bottom edges. Every edge of a page's grid is
therefore bold.

#### Scenario: Page 3 of the 120 × 90 pattern
- **WHEN** chart page 3 (columns 101–120, rows 1–80) is drawn
- **THEN** the vertical lines at boundaries 100, 110 and 120 are bold and the other 18 are thin
- **AND** the horizontal lines at boundaries 0, 10, …, 80 are bold (9 lines) and the other 72 are thin

#### Scenario: Far edge off the step
- **WHEN** chart page 1 of a 23 × 12 pattern is drawn
- **THEN** the vertical lines at 0, 10, 20 and 23 and the horizontal lines at 0, 10 and 12 are bold

### Requirement: Chart pages have absolute rulers and the centre marker
Each chart page SHALL show a 5 mm ruler above its grid and a 9 mm ruler left of it. Each ruler SHALL
label, in 6 pt text, every boundary on the page that is a multiple of 10 (not 0) with its stitch
count from the pattern's top-left corner. Where the pattern's centre column (W / 2) or centre row
(H / 2) lies on the page, including its edges, a black triangle in that ruler SHALL point at it.

#### Scenario: Rulers of the 120 × 90 pattern
- **WHEN** chart pages 2 and 4 are drawn
- **THEN** page 2 labels the columns `50`, `60`, …, `100` and the rows `10`, `20`, …, `80`
- **AND** page 4 labels the columns `10`, …, `50` and the rows `80` and `90`

#### Scenario: Centre triangles
- **WHEN** the 120 × 90 pattern (centre column 60, centre row 45) is exported
- **THEN** pages 2 and 5 have the top triangle at column boundary 60, pages 1, 2 and 3 have the left triangle at row boundary 45, and pages 4 and 6 have no triangle

#### Scenario: Five-digit row labels
- **WHEN** chart page 125 of a 50 × 10000 pattern is drawn
- **THEN** its last row label is `10000`, which fits inside the 9 mm left ruler

### Requirement: Chart pages are numbered and name their area
Each chart page SHALL show, at the top, the image file name on the left and
`Columns <first>–<last> · rows <first>–<last>` on the right, and at the bottom, centred, `Page <n> of <chart pages>`.
Chart pages are numbered from 1; info, page map and legend pages are not counted.

#### Scenario: Page 6 of the 120 × 90 pattern
- **WHEN** chart page 6 is drawn
- **THEN** it reads `cat.png`, `Columns 101–120 · rows 81–90` and `Page 6 of 6`

### Requirement: Page text uses the standard PDF fonts
All text SHALL be Helvetica or Helvetica-Bold with Windows-1252 (WinAnsi) encoding, without
embedded fonts. A character that this encoding cannot show SHALL print as `?`. A text longer than
its space SHALL end with `…` and fit the space. The PDF's title metadata SHALL be the full image
file name.

#### Scenario: Accented name
- **WHEN** the image is named `café.png`
- **THEN** page 1 shows `café.png`

#### Scenario: Cyrillic name
- **WHEN** the image is named `Ёлка.png`
- **THEN** page 1 shows `????.png`, and the PDF's title metadata is `Ёлка.png`

#### Scenario: Long name
- **WHEN** the image file name is 200 characters long
- **THEN** page 1 shows it cut to end with `…`, no wider than 190 mm, and the chart page header shows it no wider than 80 mm

### Requirement: The PDF file is well formed and compact
The file SHALL be a PDF 1.4 document. It SHALL have a cross-reference table whose every offset
points to its object, and a trailer naming the catalog. Both pictures SHALL be embedded as JPEG
(`DCTDecode`). Page contents SHALL be compressed (`FlateDecode`) where the browser offers
compression, and uncompressed otherwise. The same pattern, pictures, name and fabric count SHALL
always give the same bytes.

#### Scenario: Structure of the 120 × 90 PDF
- **WHEN** the 120 × 90 PDF is read back
- **THEN** it starts with `%PDF-1.4` and ends with `%%EOF`, `startxref` gives the offset of the `xref` table, every in-use entry's offset starts `<n> 0 obj`, the trailer's `/Size` is the number of objects plus one, and the page tree's `/Count` is 8

#### Scenario: Fonts and pictures
- **WHEN** the 120 × 90 PDF is read back
- **THEN** it has exactly two font objects, `/Helvetica` and `/Helvetica-Bold`, both `/Type1` with `/WinAnsiEncoding` and no font file, and two image objects with `/Filter /DCTDecode` whose `/Width` and `/Height` equal those of their JPEGs

#### Scenario: Compressed content
- **WHEN** the 120 × 90 PDF is created where compression is available
- **THEN** every page content stream has `/Filter /FlateDecode` and inflates to text with the operators described above

#### Scenario: Same input, same file
- **WHEN** the same pattern is exported twice with the same pictures, name and fabric count
- **THEN** both files are byte for byte equal
