# Design

## Context

- A **Pattern** (`src/core/pattern.js`) is `{ width, height, cells (Int16Array, legend index or
  −1), legend [{ number, code, name, hex, stitchCount }], fingerprint }`. Grids reach 10000 × 10000
  (`MAX_GRID_SIDE`), with up to 489 colors.
- The Chart layer's look is already specified and implemented:
  - `paleTint(hex)` and `EMPTY_CELL_COLOR` `#E0E0E0` (`chart-tint.js`);
  - hatch `#909090`, thin lines `#A0A0A0`, bold black lines every 10 stitches (`chart-layer.js`,
    `chart-layout.js`);
  - ruler labels on boundaries that are multiples of 10, and the centre at W / 2, H / 2
    (`chartCenter`);
  - legend texts from `legendRows` (`legend-rows.js`).

  The PDF reuses these rules. It does not reuse the canvas code, because a PDF is vector text,
  not pixels.
- The loaded image is `state.image = { bitmap, fileName, width, height, … }`
  (`io/image-loader.js`). Its bitmap is capped at 4096 × 4096 px. `state.settings.fabricCount`
  holds the fabric count.
- Workers follow one style (`workers/pattern-worker-handler.js`, `io/pattern-worker-client.js`):
  - a handler that uses no worker globals, called directly in tests;
  - a thin entry file;
  - a client that numbers requests, routes progress, and stops a job by `terminate()`.
- The shared pieces (Export menu markup and CSS, `io/download.js`, `core/file-names.js`,
  `core/pattern-summary.js` with tests) are fixed byte for byte by the shared export
  conventions of the three parallel changes. This change adds them as written.
- `core/compression.js` (`compressBytes`, `decompressBytes`, `canCompress`) and its unit test are
  shared byte for byte too (conventions section 7). All three export changes use it instead of
  their own compression code.
- Node 22 has `CompressionStream`, `DecompressionStream` and `node:zlib`, so the tests can write
  and inflate real compressed PDFs without packages.

## Goals / Non-Goals

**Goals:**
- A PDF that every viewer and printer accepts, written by about 150 lines of our own code.
- Every layout rule lives in pure `core/` and is checked by unit tests on the content-stream text.
  A read-back helper checks the file structure in integration tests.
- A 1,000-page export takes seconds in a worker, shows progress, and can be cancelled.

**Non-Goals:**
- A general PDF library: no fonts other than the two standard ones, no images other than JPEG,
  no outlines, links or forms.
- Pixel-identical output with the screen chart. The PDF follows the same rules at print sizes.

## Decisions

### D1. Modules and layers

| Module | Layer | Does |
|---|---|---|
| `core/file-names.js`, `core/pattern-summary.js`, `core/compression.js` | core | shared, verbatim from the conventions |
| `core/pdf-text.js` | core | WinAnsi encoding, Helvetica metrics, `textWidth`, `fitText`, PDF string literals |
| `core/pdf-writer.js` | core | number formatting, objects, xref, trailer → bytes |
| `core/pdf-pictures.js` | core | `readJpegInfo(bytes)`, picture pixel sizes |
| `core/pdf-content.js` | core | a small content-stream builder (colors, rects, paths, text) |
| `core/pdf-page-plan.js` | core | page plan, limits, dialog texts |
| `core/pdf-chart-page.js` | core | content of one chart page |
| `core/pdf-page-map.js` | core | the page map diagram and the page map table pages |
| `core/pdf-legend-pages.js` | core | content of the legend pages |
| `core/pdf-info-page.js` | core | content of page 1 |
| `core/pdf-document.js` | core | assembles everything into the PDF bytes |
| `io/download.js` | io | shared, verbatim |
| `io/pdf-picture-encoder.js` | io | the two JPEGs from canvases |
| `io/pdf-worker-client.js` | io | main-thread side of the PDF worker |
| `workers/pdf-worker-handler.js`, `workers/pdf.worker.js` | workers | message adapter around `buildPdfDocument` |
| `ui/pdf-export.js` | ui | the menu item, the dialog, the flow |

`core/` stays pure. Its PDF modules take plain data (Pattern, strings, numbers, `Uint8Array`) and
return strings or `Uint8Array`. They use no DOM, canvas, timers, `Blob` or `fetch`. The only
platform API is the one the shared `core/compression.js` uses: `CompressionStream` and
`DecompressionStream`, standard globals in browsers, workers and Node 22.

`buildPdfDocument` is `async` only because it awaits `compressBytes` (see D8). With
`isCompressed: false`, it awaits nothing outside itself. Each module stays under 300 lines; the
chart page is the largest, at about 250.

### D2. PDF file structure (`pdf-writer.js`)

`createPdfWriter()` returns `{ reserve(), addObject(body, number?), addStream(dict, bytes, number?), finish({ root, info }) }`:

- **Objects.**
  - `reserve()` hands out the next object number, so the page tree can be referenced before it
    is written.
  - `addObject` writes `n 0 obj\n<body>\nendobj\n` and records the byte offset of `n 0 obj`.
  - `addStream` writes `<< <dict> /Length <bytes.length> >>\nstream\n<bytes>\nendstream`.
  - Objects are kept as a list of `Uint8Array` chunks, so no big string is ever built.
- **`finish`** writes:
  - the `xref` table: `0000000000 65535 f\r\n`, then one 20-byte line `oooooooooo 00000 n\r\n` per
    object, in number order;
  - the trailer: `<< /Size <count + 1> /Root <root> 0 R /Info <info> 0 R >>`;
  - `startxref`, the xref offset, and `%%EOF`.

  It throws `Error` when a reserved number was never written, then joins the chunks once into
  one `Uint8Array`.
- **Header.** `%PDF-1.4`, then `%âãÏÓ` (bytes ≥ 128), so transfer tools treat the file as binary.
  PDF 1.4 covers everything used here: Flate, DCT and the standard fonts.
- **Numbers.**
  - `pdfNumber(value, decimals = 2)` uses fixed-point notation, strips trailing zeros, and turns
    `-0` into `0`.
  - It throws `RangeError` for values that are not finite.
  - Coordinates use 2 decimals (0.0035 mm); colors 3 (`0.69 0.69 0.69 rg`).
- **Document objects**, in this order:
  1. Catalog;
  2. Pages, written last, with `/Kids`, `/Count` and the shared `/MediaBox [0 0 595.28 841.89]`;
  3. Font F1 `/Helvetica` and font F2 `/Helvetica-Bold`, both `/Type1` `/WinAnsiEncoding`;
  4. Info, with `/Title` (UTF-16BE hex string with BOM, the full file name) and
     `/Creator (Cross-Stitch Pattern Maker)`;
  5. the images Im1 (original) and Im2 (DMC colors);
  6. one shared Resources dictionary;
  7. for each page, a Page object and its content stream.

  There is no `/CreationDate`, because `core/` has no clock and the same input must give the
  same bytes. There is no `/ID`, which is optional without encryption.
- *Alternative:* a cross-reference stream (PDF 1.5) would be smaller but harder to read and to
  test. Rejected; the xref table adds only 20 bytes per object (≈ 40 KB at 1,000 pages).

### D3. Text and fonts (`pdf-text.js`)

- **Fonts.** Helvetica and Helvetica-Bold are among the 14 standard fonts that every PDF viewer
  must supply. So nothing is embedded, and the file stays small and free of licensing questions.
- **Encoding.** WinAnsiEncoding equals Windows-1252:
  - code points U+0020–U+007E and U+00A0–U+00FF map to the same byte;
  - the 27 Windows-1252 characters in 0x80–0x9F map to their bytes (`€`, `…` 0x85, `–` 0x96,
    `—` 0x97, `’`, …);
  - everything else becomes `?`.

  This covers all DMC names (ASCII) and every text of the app (`×` 0xD7, `·` 0xB7, `–`, `…`).
- **String literals.** `pdfString(text)` returns a literal string `(…)` that is pure ASCII:
  - `(`, `)` and `\` are escaped;
  - bytes outside 0x20–0x7E are written as octal escapes `\ddd`.

  So every content stream is ASCII, and turning it into bytes is a plain char-code loop.
  `pdfTextString(text)` writes UTF-16BE hex `<FEFF…>` for the Info `/Title`, so the metadata
  keeps names like `Ёлка.png`.
- **Metrics.** The advance widths (in 1/1000 em) of codes 32–126 are copied from Adobe's Core14
  AFM files `Helvetica.afm` and `Helvetica-Bold.afm`, cited in the module header. Code 39 is
  WinAnsi `quotesingle` (191 / 238), not StandardEncoding `quoteright`. Code 96 is `grave`
  (333 / 333). Further entries:
  - `–` 556, `·` 278, `×` 584 and `…` 1000 in both fonts (all four are in the same AFM files);
  - any other character counts as the font's widest ASCII glyph (`@`: 1015 and 975), so
    `fitText` never lets a text run over its space.

  All digits are 556 in both fonts. That is what centres the numbers in cells and boxes.
  - `textWidth(text, font, size)` returns points.
  - `fitText(text, font, size, maxWidth)` returns the text unchanged, or the longest prefix plus
    `…` that fits.
- *Alternative:* embedding a TrueType font for full Unicode. Rejected: it needs a font file in
  the repository, subsetting, and `/ToUnicode` maps, all for the file name alone. The metadata
  title keeps the real name (see Open questions).

### D4. Page geometry (A4 portrait, 1 mm = 72 / 25.4 pt)

All pages are 210 × 297 mm with 10 mm margins. Positions below are in mm from the top-left corner
of the page; the code converts them to PDF points (origin at the bottom-left).

**Chart page** (`pdf-chart-page.js`):
- **Cells.** A cell is **3.2 mm** (9.0709 pt). The grid's top-left corner is at x 30 mm,
  y 23 mm, on every chart page, so loose pages line up. 50 columns end at 190 mm. 80 rows end at
  279 mm, which leaves 18 mm at the bottom.
- **Why 50 × 80 at 3.2 mm.** The space for the grid is about 180 × 256 mm. Square cells for
  50 × 80 are limited by the height: 256 / 80 = 3.2 mm. That is larger than the 2.54 mm
  (10 per inch) of most printed charts, so it stays readable.
  - *Alternative:* 50 × 70 at 3.6 mm gives 13 % larger numbers but 14 % more pages. Rejected,
    because the user asked for about 50 × 80.
  - Both page sides are multiples of 10, so every page edge falls on a bold line.
- **Cell numbers.**
  - Font: Helvetica at 0.45 × cell = **4.08 pt**, the screen's `NUMBER_FONT_FRACTION`, sized for
    3 digits (`489` is 6.8 pt wide in the 9.07 pt cell).
  - Centring: x = centre − digits × 0.556 × size / 2. The baseline is at centre − 0.359 × size,
    half the AFM cap height of 718.
- **Lines.** Thin lines are 0.3 pt `#A0A0A0`. Bold lines are 0.9 pt black, on index % 10 = 0 and
  at the pattern's far edges. The hatch is 0.3 pt `#909090`.
- **Rulers.**
  - Top ruler: 5 mm (y 18–23 mm). Column labels are 6 pt, centred on their boundary, with the
    baseline 2.3 mm above the grid.
  - Left ruler: 9 mm (x 21–30 mm). Row labels are right-aligned to x 27.7 mm and centred on
    their boundary (baseline at boundary + 0.359 × 6 pt).
  - The widest label, `10000`, is 16.7 pt (5.9 mm) wide, so it fits from 21.8 mm.
  - Centre triangles are 2.4 mm wide and 1.5 mm deep, black, with the tip on the grid edge.
  - There is no ruler background, which saves ink.
- **Header** (baseline 15.5 mm, 8 pt):
  - the file name at x 30 mm, fitted to 80 mm;
  - `Columns a–b · rows c–d` right-aligned at 190 mm.
- **Footer** (9 pt): `Page n of N`, centred at x 110 mm, baseline 285 mm.

**Info page** (`pdf-info-page.js`):
- **Title.** `Cross-stitch pattern` in Helvetica-Bold 18 pt (baseline 17 mm). Below it, the file
  name at 11 pt (baseline 24 mm), fitted to 190 mm.
- **Pictures.** Captions `Original` and `DMC colors` in bold 9 pt (baseline 33 mm), at x 10 and
  110 mm. The picture boxes are 90 × 90 mm at x 10 and 110 mm, from y 35 mm. Each picture is
  scaled to fit by its JPEG pixel aspect ratio, centred horizontally and top-aligned.
- **Summary** (10 pt, 5.5 mm line pitch from baseline 135 mm):
  - the labels from `summaryLines` in bold at x 10 mm, the values at x 45 mm;
  - a fourth line, `Finished size`, with `formatFinishedSize(pattern, fabricCount)` (D11).
- **Page map.**
  - The heading `Page map` is bold 12 pt (baseline 163 mm).
  - The 9 pt line below it reads `Each chart page shows up to 50 columns × 80 rows. Info and legend pages are not numbered.`,
    or the "next pages" note of the fallback.
  - The map area is x 10–200 mm, y 173–287 mm (see D6).

**Legend pages** (`pdf-legend-pages.js`):
- **Headings.** `Legend` or `Legend (continued)` in bold 14 pt (baseline 18 mm). The column
  headings are bold 8 pt (baseline 26 mm): `No.` at x 10, `Color` 23, `DMC` 35, `Name` 52, and
  `Stitches` right-aligned at 200 mm.
- **Rows.** **50 rows** of 5 mm each, from y 28 mm. Each row has:
  - a number box: 10 × 4 mm, tint fill, 0.5 pt `#A0A0A0` border, 8 pt black number, centred;
  - a swatch: 8 × 4 mm at x 23 mm, hex fill, 0.5 pt `#808080` border;
  - the code at 9 pt (x 35 mm);
  - the name at 9 pt (x 52 mm), fitted to 115 mm;
  - the count from `legendRows`, right-aligned at 200 mm.
- **Fit.** The longest DMC name has 29 characters. Even at 1015/1000 em per character that is
  265 pt at 9 pt, below 115 mm (326 pt). A unit test checks this over the whole palette.
- **Page count.** 489 colors take 10 pages. A pattern without stitches gets one page with
  `This pattern has no stitches.`

### D5. Page plan and limits (`pdf-page-plan.js`)

`planPdfPages(pattern)` returns a **PdfPagePlan**, the shape shared by the UI, the worker and the
page modules:

```
{ pagesAcross, pagesDown,            // A = ceil(W / 50), D = ceil(H / 80)
  chartPages,                        // A × D
  isMapOnInfoPage,                   // A ≤ 15 and D ≤ 25
  mapPages,                          // 0, or ceil(chartPages / 224)
  legendPages,                       // max(1, ceil(N / 50))
  totalPages }                       // 1 + mapPages + legendPages + chartPages
```

- `chartPageArea(plan, pattern, pageNumber)` returns `{ columnStart, columnEnd, rowStart, rowEnd }`.
  The ranges are half-open and 0-based, like `CellRange` in `chart-layout.js`. Page numbers run
  row-major from 1.
- Constants: `CHART_PAGE_COLUMNS` 50, `CHART_PAGE_ROWS` 80, `CONFIRM_PDF_PAGES` 100,
  `MAX_PDF_PAGES` 1000.
- `needsPdfConfirmation(plan)` and `isPdfTooLarge(plan)`.
- Texts: `formatPdfRunning(plan)`, `formatPdfConfirm(plan)`, `formatPdfTooLarge(plan)` and
  `formatPdfError(reason)`, with thousands separators (`en-US`), exactly as in the spec.

The plan is pure arithmetic, so the UI computes it instantly on click, before any picture is
encoded or any data is sent to the worker. The 1,000-page cap is checked again in
`buildPdfDocument` (`RangeError`), so the worker can never start a 25,000-page job.

### D6. Page map (`pdf-page-map.js`)

- **Diagram on page 1.** It is used when A ≤ 15 and D ≤ 25.
  - Layout: a 15 mm left header, a 5 mm top header, and a tile area of 175 × 109 mm. A tile is
    min(25, 175 / A) mm wide and min(16, 109 / D) mm high, each with a 0.5 pt black border.
  - Labels: the page number in 7 pt, centred; column ranges in 6 pt, centred above the tiles;
    row ranges in 6 pt, right-aligned 1.5 mm left of the tiles.
  - The thresholds keep every label readable. With A ≤ 15, a tile is at least 11.7 mm wide, and
    the widest column range (`701–750`, 8.2 mm at 6 pt) fits. With D ≤ 25, a tile is at least
    4.4 mm high, which leaves room for a 7 pt number. The widest row range (`1921–2000`,
    10.6 mm) fits the 15 mm header.
  - Tiles are uniform, not to scale. A short last page column would otherwise get a tile too
    narrow for its label.
- **Table pages, for larger grids.** A wider or taller grid (above 750 columns or 2000 rows)
  cannot be labelled legibly on one portrait page; 200 page columns would give 0.9 mm tiles.
  - The table pages hold 4 blocks of 56 lines each (224 entries per page), in 8 pt. A block is
    47.5 mm wide: `Page` at +0 mm, `Columns` at +10 mm, `Rows` at +28 mm.
  - The headings are `Page map` or `Page map (continued)`.
  - At most 5 table pages occur below the 1,000-page cap.
- *Alternative:* the table only. It is simpler, but a map is what people use to tape pages
  together. *Alternative:* a diagram scaled down without limit. Rejected: its labels would be
  unreadable.

### D7. Chart page content stream (`pdf-chart-page.js`)

The paint order matches the screen layer, and each step writes one compact block:

1. **Fills.** For each legend index used on the page, and for empty cells, set the color once.
   Then write one `re` per **horizontal run** of equal cells, and fill with `f`. Merging runs
   cuts the bytes, and it avoids the hairline seams that viewers draw between touching rectangles.
2. **Hatch.** One path, with one `m`/`l` pair per empty cell, then `S`.
3. **Numbers.** A single `BT … ET` with `/F1 4.08 Tf 0 g`.
   - Each row starts with an absolute `Tm`. Each further number uses `Td` relative to the one
     before it.
   - Positions are rounded to 0.01 pt first. Each `Td` is the difference of two rounded positions
     (rounded again), so the error never accumulates.
4. **Thin lines.** One path of full-width and full-height segments at the boundaries that are not
   bold, then `S`. The bold lines follow in their own path, so bold wins at crossings.
5. **Rulers.** The labels go in one `BT` block at 6 pt; the centre triangles are filled paths.
6. **Header and footer** texts.

`chartPageContent(pattern, plan, pageNumber, fileName)` returns the content as a string. Tints
are computed once per document (`paleTint` for each legend entry) and passed in, not per page.

**Size.** A full page has 4,000 cells: about 75 KB for numbers and 50 KB for fills. That is about
125 KB uncompressed, or roughly 15–25 KB after Deflate. The text is very repetitive.

### D8. Compression: FlateDecode through the shared `core/compression.js`

- **Format.** `compressBytes(bytes, 'deflate')` produces the zlib format (RFC 1950), which is
  exactly what `/FlateDecode` expects. The shared module wraps `CompressionStream`, which is built
  into every current browser, including workers (Chrome 80, Firefox 113, Safari 16.4), and into
  Node 22. So compression costs no dependency, and `core/` stays testable in Node.
- **Why compress.** A 1,000-page PDF is about 125 MB uncompressed, which is too large to save,
  mail or print comfortably. Compressed, it is roughly 15–25 MB.
- **How.** `buildPdfDocument(input, { isCompressed = canCompress(), onProgress })` calls
  `compressBytes(content, 'deflate')` on each page's content as soon as it is built, so only
  compressed bytes are kept, and writes `/Filter /FlateDecode`.
- **Fallback.** Where `canCompress()` is false, the streams are written without `/Filter`. The
  PDF stays valid, only larger. Tests pass `isCompressed: false` to read the operators directly.
- JPEG data is already compressed and is never deflated.
- *Alternative:* a compression helper of our own in `io/`, injected into core. Rejected now that
  one shared module serves all three exports.

### D9. Pictures (`io/pdf-picture-encoder.js`, `core/pdf-pictures.js`)

- **The rule** is that `io/` makes the JPEG bytes from canvases (`OffscreenCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })`)
  on the main thread, before the worker starts.
- **Original picture.**
  - The size comes from `pictureSize(width, height)` in core: the long side is capped at
    **1200 px** (≈ 340 dpi across 90 mm), never enlarged, and rounded.
  - A white background goes first, because JPEG has no alpha.
- **DMC colors picture.**
  - `dmcPictureScale(pattern)` gives k = floor(1200 / long side) pixels per stitch (at least 1).
    The `patternToStitchImage` pixels are scaled by k with smoothing off, so stitch edges stay
    sharp despite JPEG and viewer smoothing.
  - A pattern whose long side is above 1200 is scaled down smoothly to a 1200 px long side, as on
    screen.
  - Empty cells are white (paper); the chart pages tell empty apart from white floss.
- **`readJpegInfo(bytes)`** checks the SOI marker and walks the segments to the first SOFn. It
  returns `{ width, height, components }`, and throws `TypeError` for anything that is not a
  baseline or progressive JPEG with 1 or 3 components.
  - The image objects take `/Width`, `/Height` and `/ColorSpace /DeviceRGB` (or `/DeviceGray`)
    from these bytes, never from separately passed numbers, so they cannot disagree.
  - Unit tests use hand-made header bytes, not image files.

### D10. Where the work runs: a PDF module worker

- **Why a worker.** A 1,000-page export writes 4 million numbers and rectangles and compresses
  about 125 MB. That is several seconds of CPU, which would freeze the page and its progress bar
  on the main thread. So it runs in `workers/pdf.worker.js`
  (`new Worker(new URL('./workers/pdf.worker.js', import.meta.url), { type: 'module' })`).
- **Why a separate worker.** It is not a new message type of the pattern worker, because:
  - terminating a cancelled export must not kill a pattern generation, or the image that worker
    remembers;
  - the PDF worker is created per export and terminated when it ends, which frees its memory.
- **Protocol**, in the existing style (`workers/pdf-worker-handler.js`):
  - request: `{ type: 'export-pdf', id, pattern, fileName, fabricCount, pictures: { original, dmc } }`.
    `original` and `dmc` are JPEG `Uint8Array`s whose buffers are transferred. The pattern is
    copied (structured clone), because the state keeps it. It holds at most about 4 M cells
    (8 MB) below the cap.
  - progress: `{ type: 'progress', id, done, total }`, in pages, posted only when the whole
    percent rises (at most 101 messages).
  - response: `{ type: 'pdf', id, bytes }`, with `bytes.buffer` transferred, or
    `{ type: 'error', id, message }`.
  - `createPdfWorkerHandler({ postProgress })` returns an async
    `handleMessage(message)` that resolves to `{ response, transfer }` and never rejects.
- **Client** (`io/pdf-worker-client.js`). `createPdfWorkerClient(createWorker)` returns
  `{ exportPdf(request, onProgress), stop() }`:
  - one job at a time;
  - `stop()` terminates the worker and rejects with `PdfExportStoppedError`;
  - a worker `error` or `messageerror` rejects with `The PDF worker stopped: …`.

### D11. UI flow (`ui/pdf-export.js`) and markup

`setupPdfExport(root, store, { client, encodePictures, download })` owns:
- `[data-action="export-pdf"]`;
- the new `<dialog class="confirm-dialog" data-role="pdf-export-dialog">`. It reuses the
  existing dialog styles and adds a single `.confirm-dialog__progress` rule (full width, spacing).
  The dialog holds a title `PDF chart`, `[data-role="pdf-export-text"]`, a hidden
  `<progress max="100">`, `[data-action="cancel-pdf-export"]` and
  `[data-action="confirm-pdf-export"]`.

The flow on click:
1. Close the menu (`details.open = false`).
2. Take `state.pattern`, `state.image.fileName` and `state.settings.fabricCount` as a snapshot,
   then compute `planPdfPages`.
3. Branch on the plan:
   - too large: the dialog shows the text with `Close` (the cancel button relabelled);
   - more than 100 pages: it shows the question with `Cancel` and `Create PDF`;
   - otherwise: go straight to step 4.
4. Run:
   - the text becomes `formatPdfRunning(plan)`, the progress bar is shown at 0, and the button
     reads `Cancel`;
   - `encodePictures`, then `client.exportPdf`, which updates the bar;
   - `download(new Blob([bytes], { type: 'application/pdf' }), exportFileName(fileName, 'pdf'))`,
     then close the dialog.
5. Cancel and Esc (the dialog's `close` event) call `client.stop()`. A cancelled run ignores any
   result that arrives late.
6. Errors show `formatPdfError(error.message)` with `Close`.

The item is enabled while `state.pattern !== null` and no run is active. "Active" is a flag local
to this module: it is transient UI state that no other module reads, like the open question in
`progress-warning.js`. The dialog is modal, so settings and image cannot change during an export;
the snapshot also guards against an automatic regeneration.

`main.js` appends one group at the end:
`setupPdfExport(document, store, { client: createPdfWorkerClient(createPdfWorker), encodePictures: encodePdfPictures, download: downloadBlob })`.

### D12. Finished size text (`core/generation-settings.js`)

`formatFinishedSize(size, fabricCount)` returns `'7.1 × 4.8 in (18.1 × 12.2 cm) on 14 ct'`.
`formatPatternSize` becomes `` `${w} × ${h} stitches — ${formatFinishedSize(…)}` ``, with the same
output as before. The domain rules ask for the finished size next to the stitch size, and
`summaryLines` (shared, fixed) has no fabric count, so the PDF adds this line itself.

## Risks / Trade-offs

- [Wrong AFM widths would mis-centre numbers or let names overflow] → The widths are copied from
  the cited AFM files. Unit tests pin known values (digits 556, space 278, `W` 944, `i` 222;
  Bold `W` 944, `i` 278). Numbers use only digits, which are 556 in both fonts.
- [4.08 pt numbers are small on paper] → They are the same rule as on screen, on cells larger
  than standard charts. The smoke check prints one page. The alternative 50 × 70 at 3.6 mm is
  noted in D4.
- [Viewers smooth the DMC picture] → It is upscaled by an integer factor before JPEG encoding,
  so blocks stay sharp at normal zoom.
- [Merge conflicts with the parallel changes in `index.html`, `main.css`, `print.css`, `main.js`]
  → The shared pieces are byte for byte identical. The PDF dialog goes after the existing
  `<dialog>` at the end of `<body>`. The `main.js` group is appended at the end.
- [A browser without `OffscreenCanvas.convertToBlob` for JPEG] → It is supported by all target
  browsers. A failure shows the error text and exports nothing.
- [Very large outputs (≈ 15–25 MB at 1,000 pages) use memory twice while joining chunks] → That is
  bounded by the cap. Joining happens once, in the worker, and the buffer is transferred, not
  copied.

## Migration Plan

New feature, no stored data. Rollback means removing the menu item and the modules.

## Open Questions

These decisions are recorded here and need the user's confirmation; none blocks the plan.

1. **Up to 100 pages, no question.** The count shows in the progress dialog, and the export
   starts at once. Recommended: keep it, since it saves a click on every export.
2. **File name characters outside Windows-1252** print as `?` on the pages; the metadata title
   keeps them. Recommended: accept it, rather than embedding a font.
3. **Page map fallback.** Above 15 × 25 page tiles, the map becomes a table on extra info pages.
   Recommended: keep it.
4. **`Finished size` line.** It is added to page 1 because of the domain rule. Recommended: keep it.
5. **Rulers only on the top and left** of each page, and no overlap rows between pages.
   Recommended: keep it; it matches the screen.
