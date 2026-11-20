# Proposal

## Why

Stitchers who plan in a spreadsheet want the pattern as an Excel workbook: to zoom, color the
cells they have done, print parts, and share it with someone who does not use the app.

## What Changes

- **Export menu.** The header gets the shared `Export` disclosure with the item
  `Excel workbook`. The item is enabled while a pattern exists and saves
  `<image base name>.xlsx` (`cat.png` → `cat.xlsx`).
- **Sheet `Chart`:**
  - one square cell (24 × 24 px at 100 %) per stitch;
  - the value is the legend number (a number), centred and black;
  - the fill is the Chart's pale tint (`310` → `#B0B0B0`);
  - empty cells are `#E0E0E0`, hatched, with no value;
  - thin grey borders, and medium black borders every 10 stitches and at the edge.
- **Sheet `Summary`:** size, stitches and colors, then the original picture and the pattern in
  DMC colors as embedded images.
- **Sheet `Legend`:** number, a swatch in the real DMC color, code, name, stitch count.
- **Limits.** Above 250,000 cells a dialog asks first. Above 1,000,000 cells the export is
  refused with a message.
- **Responsive page.** A module worker writes the file. The status line reports progress, the
  result or the error.
- **Own writers.** Our own ZIP writer and SpreadsheetML writer live in `core/`, with deflate
  through the built-in `CompressionStream`. Nothing is uploaded.
- **Shared pieces.** The change adds `io/download.js`, `core/file-names.js`,
  `core/pattern-summary.js` and the menu CSS, exactly as the shared conventions give them.

### Out of scope

- PDF and `.stitch` files (`add-pdf-export`, `add-progress-file`).
- Marked progress, formulas, page setup, frozen panes, and stitch rulers in the workbook.
  Excel's own row numbers stay.
- Importing `.xlsx`.
- More than 1,000,000 cells, and ZIP64.

## Capabilities

### New Capabilities

- `excel-export`: the Excel workbook export. It covers:
  - the menu item and the file name;
  - the sheet contents, styles and cell sizes;
  - the size limits and the status messages;
  - a container that Excel and LibreOffice open without repair.

### Modified Capabilities

None. Tints, numbers and legend order are reused unchanged.

## Impact

- New `core/` modules: CRC-32, ZIP, XML helpers, styles, sheets, package parts, limits, and the
  shared `file-names.js` and `pattern-summary.js`.
- New `workers/xlsx.worker.js` and its handler, `io/xlsx-worker-client.js`,
  `io/summary-pictures.js`, `io/download.js` and `ui/excel-export.js`.
- `index.html` gets the menu and a confirm dialog. The CSS files get the shared menu rules.
  `main.js` gets one setup group.
- No dependencies, no network.
