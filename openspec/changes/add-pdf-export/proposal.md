# Proposal

## Why

The chart exists only on screen. To stitch from paper, the user needs a printable chart split
into A4 pages, with the legend, that can be kept or shared.

## What Changes

- **Export menu.** The shared `Export` menu appears in the header with a `PDF chart` item. The
  item is enabled while a pattern exists. The file is `<image base name>.pdf`.
- **The PDF** (A4 portrait):
  1. **Info page** (unnumbered):
     - title and file name;
     - the original and DMC-colors pictures side by side;
     - size, stitches, colors and finished size;
     - a page map of which chart page covers which columns and rows. Very large maps become a
       table on extra info pages.
  2. **Legend pages** (unnumbered): 50 colors per page, each with a tinted number box, swatch,
     DMC code, name and stitch count.
  3. **Chart pages**, numbered `Page n of N`:
     - 50 columns × 80 rows of square 3.2 mm cells, each with its pale tint and black number;
       empty cells grey and hatched;
     - thin lines every stitch and bold every 10;
     - absolute rulers, the centre triangles, and a header naming the page's columns and rows.
- **Limits.** A dialog shows the page count and progress, with `Cancel`. It asks first above
  100 pages and refuses above 1,000.
- **Local.** Our own PDF writer runs in a Web Worker with built-in browser
  compression; nothing is uploaded, no library is added.

### Out of scope

- The Excel and `.stitch` exports (their own changes); this change adds only its menu item and
  the shared pieces it needs.
- Other paper sizes, landscape, overlapping pages, symbols, and printing the progress or the
  highlighted color.
- Fonts beyond Helvetica. Characters outside Windows-1252 print as `?`; the PDF title metadata
  keeps the full name.

## Capabilities

### New Capabilities

- `pdf-export`: the PDF chart export: menu item, page plan and limits, page contents,
  file format, progress and cancelling.

### Modified Capabilities

None.

## Impact

- New `core/` modules: the PDF writer, text and fonts, page plan, page contents and assembly,
  plus the shared `file-names.js` and `pattern-summary.js`.
- New `io/` modules: the shared `download.js`, deflate, the JPEG picture encoder, and the PDF
  worker client.
- New `workers/pdf.worker.js` with its handler, and new `ui/pdf-export.js`.
- `formatFinishedSize` is extracted in `generation-settings.js`, with no change in behavior.
- `index.html`, `main.css` and `print.css` get the shared menu and the dialog; `main.js` gets
  one setup group.
- No dependencies and no network.
