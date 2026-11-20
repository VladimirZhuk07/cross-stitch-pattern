# Design

## Context

- A **Pattern** (`src/core/pattern.js`) is `{ width, height, cells: Int16Array, legend, fingerprint }`.
  Cells are row-major legend indexes or `EMPTY_CELL` (−1). The legend is in number order, with
  `number`, `code`, `name`, `hex` and `stitchCount`. Patterns reach 10,000 × 10,000 stitches.
- The Chart's colors come from `paleTint(hex)` and `EMPTY_CELL_COLOR` (`#E0E0E0`) in
  `src/core/chart-tint.js`. `patternToStitchImage` (`src/core/pattern-image.js`) gives one RGBA
  pixel per stitch, with empty cells transparent.
- The loaded image is `state.image` = `{ bitmap, fileName, width, height, … }`
  (`src/io/image-loader.js`). The bitmap is already capped at 16.7 MP.
- The pattern worker sets the style. A handler module has no worker globals and is tested by direct
  calls. A tiny entry file binds it to `self`. A main-thread client in `io/` creates the worker from
  a factory.
- The shared conventions fix several pieces byte for byte: the Export menu markup and CSS,
  `io/download.js`, `core/file-names.js` and `core/pattern-summary.js` with their tests, and where
  `main.js` groups go.
- Measured in Node 22 for a 1000 × 1000 chart sheet (blocky test data, 30 colors):
  - 33.6 MB of XML, 3.4 MB after deflate;
  - 0.64 s to build the strings, 0.19 s to encode them, 0.51 s to deflate.

## Goals / Non-Goals

**Goals:**
- A file that Excel (Windows/Mac/365) and LibreOffice Calc 7.4+ open with no repair prompt. To get
  there, every part follows the ECMA-376 element order, and the package stays minimal.
- Everything that decides bytes lives in pure, unit-tested `core/` modules. `io/` only encodes PNGs,
  starts the worker and saves the Blob.
- Same input, same bytes in one browser, so tests compare files exactly.

**Non-Goals:**
- A general XLSX library. Writers cover only what these three sheets need: no shared strings,
  formulas, themes, merged cells or ZIP64.
- Progress messages while the workbook is written. The status line shows one busy text, since the
  creation takes at most a few seconds.

## Decisions

### D1. Modules and layers

| Module | Layer | Role |
|---|---|---|
| `src/core/crc32.js` | core | `crc32(bytes, previous = 0)`: CRC-32 as in ZIP, table-driven, chainable |
| `src/core/deflate-raw.js` | core | `canDeflateRaw()`, `deflateRaw(byteChunks)`: raw DEFLATE through `CompressionStream` |
| `src/core/zip.js` | core | `zipArchive(entries)` (layout, sync) and `buildZip(files, options)` (encode, CRC, compress, layout) |
| `src/core/xml.js` | core | `escapeXml(text)`, `columnName(columnNumber)`, `cellReference(column, row)` |
| `src/core/picture-size.js` | core | `fitInside(size, maxSide)`, `stitchBlockSize(size, maxSide)` |
| `src/core/xlsx-styles.js` | core | `workbookStyles(legend)`: the styles part and the style index of every kind of cell |
| `src/core/xlsx-chart-sheet.js` | core | `chartSheetXml(pattern, styles)`: a generator of XML text chunks |
| `src/core/xlsx-summary-sheet.js` | core | `summaryLayout(pictures)`, `summarySheetXml(lines, layout, styles)`, `summaryDrawingXml(layout)` |
| `src/core/xlsx-legend-sheet.js` | core | `legendSheetXml(pattern, styles)` |
| `src/core/xlsx-package.js` | core | the fixed parts, `XLSX_MEDIA_TYPE`, `workbookFiles(pattern, pictures)` |
| `src/core/xlsx-limits.js` | core | thresholds, `workbookSizeCheck(size)`, the user-facing texts |
| `src/core/file-names.js`, `src/core/pattern-summary.js` | core | shared, verbatim |
| `src/workers/xlsx-worker-handler.js`, `src/workers/xlsx.worker.js` | workers | message adapter around `workbookFiles` + `buildZip` |
| `src/io/xlsx-worker-client.js` | io | `createWorkbookInWorker(createWorker, request)` |
| `src/io/summary-pictures.js` | io | `encodeSummaryPictures(image, pattern)`: the two PNGs (OffscreenCanvas) |
| `src/io/download.js` | io | shared, verbatim |
| `src/ui/excel-export.js` | ui | menu item, limits and dialog, status, download |

`core/` stays pure. It has no DOM, canvas, timers, network or storage. It does use three standard
globals: `TextEncoder`, `CompressionStream` and stream readers. They exist the same way in
browsers, workers and Node 22, so unit tests run them for real. `core/` imports only from
`core/`: `chart-tint.js`, `pattern.js` and the new modules.

### D2. ZIP writer

- **Layout (`zipArchive`).** Each entry gets a local file header, its data, and then the central
  directory and the end-of-central-directory record (PKWARE APPNOTE 6.3.x §4.3).
  - Version needed 20. Flags 0, because all names are ASCII.
  - Method 0 (stored) or 8 (deflate).
  - DOS time 0 and date `0x0021` (1980-01-01 00:00). There is no clock in `core/`, and the output is
    reproducible.
  - No extra fields and no comment.
- **Entry shape**, which `buildZip` creates: `{ name, method: 0 | 8, crc, size, data }`.
  - `name` is an ASCII path without a leading `/`.
  - `crc` and `size` describe the uncompressed bytes.
  - `data` is the stored or deflated bytes.
- **Checks (no ZIP64).** `zipArchive` throws a `RangeError` with the value when:
  - there are more than 65,535 entries;
  - an entry is 4 GiB or more;
  - the archive reaches 4 GiB.

  It throws a `TypeError` for a non-ASCII, empty or absolute name. At the 1,000,000-cell cap the
  largest entry is about 40 MB.
- **`buildZip(files, { deflate })`** is async.
  - **File shape:** `{ name, content, shouldCompress }`. `content` is a `Uint8Array` or an iterable
    of strings.
  - **Encoding:** it encodes string chunks one at a time with `TextEncoder` and updates the CRC per
    chunk.
  - **Compression:** when `shouldCompress` is true and `deflate` is a function, the chunks stream
    into `deflate` (method 8). Otherwise they are stored (method 0).
  - **Memory:** the 34 MB sheet string is never built in one piece. Peak memory is about one chunk
    plus the compressed output.
- **`deflateRaw(byteChunks)`** writes the chunks into `new CompressionStream('deflate-raw')` while it
  reads the output at the same time. Reading in parallel avoids a back-pressure deadlock. It
  resolves to one `Uint8Array`.
  - `canDeflateRaw()` is `typeof CompressionStream === 'function'`. The stream exists in Chrome 80+,
    Safari 16.4+, Firefox 113+ and Node 18+.
  - Without it, the handler passes `deflate: null`, and every entry is stored. The file is then
    about 10× larger but valid.
- **CRC-32.** Reflected polynomial `0xEDB88320`, start `0xFFFFFFFF`, final XOR. A 256-entry
  `Uint32Array` table is built once on first use. In V8 that is about 0.1 s for 34 MB.
- **Methods per part.** XML is deflated. PNGs are stored, because they are already compressed and
  deflating them again gains nothing.
- *Alternatives:*
  - A JS deflate of our own: rejected. A few hundred lines duplicating a built-in, and slower.
  - Always stored: rejected. 34 MB instead of 3.4 MB at the cap.
  - `CompressionStream('gzip')` and stripping the header: rejected. It needs header parsing for no
    gain.

### D3. Minimal SpreadsheetML package

The package has 13 parts, the minimum for three sheets and pictures:

- `[Content_Types].xml`:
  - Defaults `rels` → `application/vnd.openxmlformats-package.relationships+xml`, `xml` →
    `application/xml`, `png` → `image/png`.
  - Overrides for `/xl/workbook.xml` (`…spreadsheetml.sheet.main+xml`), the three worksheets
    (`…spreadsheetml.worksheet+xml`), `/xl/styles.xml` (`…spreadsheetml.styles+xml`) and
    `/xl/drawings/drawing1.xml` (`application/vnd.openxmlformats-officedocument.drawing+xml`).
- `_rels/.rels`: `rId1` officeDocument → `xl/workbook.xml`.
- `xl/workbook.xml`:
  - `<bookViews><workbookView activeTab="0"/></bookViews>`;
  - `<sheets>` with `Chart` (`sheetId` 1, `r:id` `rId1`), `Summary` (2, `rId2`) and `Legend` (3, `rId3`).
- `xl/_rels/workbook.xml.rels`: `rId1`–`rId3` worksheets, `rId4` styles.
- `xl/worksheets/sheet1.xml` to `sheet3.xml` and `xl/styles.xml`.
- `xl/worksheets/_rels/sheet2.xml.rels`: `rId1` drawing → `../drawings/drawing1.xml`.
- `xl/drawings/drawing1.xml` and `xl/drawings/_rels/drawing1.xml.rels`, with `rId1` and `rId2`
  images → `../media/image1.png` and `../media/image2.png`.

Further choices:

- **Inline strings** (`t="inlineStr"`) instead of a shared-strings part. The text cells are fewer
  than 1,000 in all, so sharing saves nothing. Both programs read inline strings.
- **No `docProps`.** Excel and LibreOffice open packages without it, and a creation date would make
  the output depend on a clock.
- Every part starts with `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`.
- **Element order is the usual cause of repair prompts.** We write elements in schema order:
  - worksheet (CT_Worksheet): `dimension`, `sheetViews`, `sheetFormatPr`, `cols`, `sheetData`,
    `pageMargins`, `ignoredErrors`, `drawing`;
  - stylesheet: `fonts`, `fills`, `borders`, `cellStyleXfs`, `cellXfs`, `cellStyles`;
  - border: `left`, `right`, `top`, `bottom`, `diagonal`.

  Integration tests check these orders.
- Every `count` attribute equals the number of children.
- `escapeXml` replaces `& < > " '`. It drops characters that XML 1.0 forbids, such as control
  characters below U+0020 other than tab, LF and CR. DMC names have none, but test fixtures and
  future texts might.
- Cell references are written on every `<row r>` and `<c r>`. They are optional in the schema, but
  some readers misplace cells without them. Deflate removes most of the cost.
- *Alternative:* a template `.xlsx` saved by Excel and patched. Rejected: it is a binary fixture, it
  carries theme and docProps baggage, and we would still have to write the sheets.

### D4. Styles (`workbookStyles(legend)`)

For N legend colors:

- **Fonts:** 0 is Calibri 11 black (the default), 1 is Calibri 11 bold, 2 is Calibri 9 black
  (chart numbers).
- **Fills:**
  - 0 `none` and 1 `gray125`, both required by Excel;
  - 2 is the empty `#E0E0E0`;
  - 3 … N+2 are `paleTint(legend[i].hex)`;
  - N+3 … 2N+2 are the DMC `hex` values for the swatches.

  All fills are `solid` with `fgColor rgb="FFRRGGBB"`.
- **Borders:** 0 none, then 32 chart borders. Index `1 + v` has no diagonal; index `17 + v` adds
  `diagonalUp` thin `#909090` for empty cells. The variant `v` (0–15) has four bits:
  - bit 0: right edge medium black (column number divisible by 10, or the last column), else thin
    `#A0A0A0`;
  - bit 1: bottom edge medium (row number divisible by 10, or the last row), else thin;
  - bit 2: first column, left edge medium; otherwise no left edge, because the neighbour's right
    edge draws that line;
  - bit 3: first row, top edge medium; otherwise no top edge.

  Each line is defined by exactly one cell, so the two programs never resolve conflicting edges
  differently.
- **Cell formats (`cellXfs`):**
  - 0 default;
  - 1 bold;
  - 2 `numFmtId 3` (`#,##0`, built in) for stitch counts;
  - 3+i for legend number i: its tint, centred;
  - 3+N+i for swatch i;
  - chart cells from `C = 3 + 2N`: style `C + 16 × slot + v`, where slot 0 is empty (fill 2, border
    17+v) and slot 1+i is legend index i (fill 3+i, border 1+v, font 2, centred both ways).
- **Size.** The total is 3 + 2N + 16(N + 1) formats. For N = 489 that is 8,821, well under Excel's
  64,000 limit.
- *Alternatives:*
  - One style per used combination, collected while writing: rejected. It is more complex and needs
    two passes.
  - No bold lines: rejected. The counting grid is how stitchers read a chart, and fills hide Excel's
    gridlines, so without borders same-colored areas would merge into blobs.

### D5. Square chart cells

- **Width.** In Excel's width formula (ECMA-376 Part 1, §18.3.1.13) the maximum digit width of
  Calibri 11 at 96 dpi is 7 px. A 24 px column holds (24 − 5) / 7 ≈ 2.714 digits, and it is stored
  as width = trunc((2.714 × 7 + 5) / 7 × 256) / 256 = trunc(877.7) / 256. The exact stored value is
  `877/256 = 3.42578125`. Excel displays it as 2.71, and it renders as
  trunc((256 × 3.42578125 + trunc(128/7)) / 256 × 7) = trunc(24.47) = 24 px.
- **Height.** 18 pt = 24 px at 96 dpi.
- **Font.** Calibri 9 pt digits are about 7 × 9/11 ≈ 5.7 px wide. `489` then needs about 17.2 px
  plus Excel's 5 px cell padding, so 22.2 px < 24 px and no `###` appears. 10 pt would need 24.1 px
  and could show `###`. Numbers show `###` rather than overflowing.
- **Writing.** One `<col min="1" max="W" width="3.42578125" customWidth="1"/>`. Every row gets
  `ht="18" customHeight="1"`, which is more reliable in LibreOffice than `sheetFormatPr` alone.
- **Why 24 px.** The on-screen chart shows numbers only from 19 CSS px. 24 px keeps them readable at
  100 % zoom, and Excel's zoom handles the rest.
- **Other programs.** LibreOffice substitutes the metric-compatible Carlito for Calibri, so the cells
  stay square to within a pixel. The Mac's 72-dpi point mapping changes both sides alike.

### D6. Chart sheet

`chartSheetXml(pattern, styles)` is a generator. It yields the head, then batches of whole rows of
at least 65,536 characters, then the tail.

- **Head:** `<dimension ref="A1:{last}"/>`, `<sheetViews><sheetView tabSelected="1"
  workbookViewId="0"/></sheetViews>`, `<sheetFormatPr defaultRowHeight="18" customHeight="1"/>`, and
  the single `<col>`.
- **Stitched cell:** `<c r="B3" s="…"><v>2</v></c>`. **Empty cell:** `<c r="A2" s="…"/>`, with a
  style but no value.
- **Tail:** `</sheetData><pageMargins …/></worksheet>`.
- Column names are precomputed once per column, and the style lookup is arithmetic, so the inner
  loop allocates only the strings.
- At the cap this is about 0.6 s in V8.

### D7. Summary sheet and pictures

- **SummaryPicture**, created by `encodeSummaryPictures` (io) and read by core:
  `{ png: Uint8Array, width, height }`. Width and height are the PNG's size in pixels, positive
  integers. **WorkbookPictures** is `{ original, dmc }`.
- **Encoding (io, main thread).**
  - **Original:** `fitInside(image, 1024)` sets the size, never enlarged. The bitmap is drawn with
    `imageSmoothingQuality = 'high'` into an `OffscreenCanvas` of that size, then
    `convertToBlob({ type: 'image/png' })`.
  - **DMC colors:** `patternToStitchImage(pattern)` goes into a W × H canvas.
    `stitchBlockSize(pattern, 1024)` = max(1, floor(1024 / max(W, H))) px per stitch sets the
    scale. The picture is redrawn scaled with `imageSmoothingEnabled = false` (sharp blocks), then
    encoded as PNG.
  - **Why PNG:** it keeps transparency and the flat blocks. JPEG would blur edges and drop alpha.
  - **Why the main thread:** `OffscreenCanvas` is already required, since `readImagePixels` needs it
    to generate a pattern at all. PNG encoding is asynchronous in the browser, and the
    `patternToStitchImage` loop takes about 10 ms at the cap.
  - **Why both pictures:** the DMC preview is cheap and shows the stitched result next to the
    photo, which helps a friend who only gets the file. This is a recommendation made for this
    change; dropping it would remove one caption, one picture, `image2.png` and its relationship.
- **Layout (`summaryLayout`).**
  - Rows 1–3 hold the summary lines.
  - A5 holds the caption `Original picture`, with the picture anchored at A6.
  - Display size `fitInside(picture, 480)`.
  - The next caption row is 6 + ceil(displayHeight / 20) + 1, using the default 15 pt = 20 px rows
    (`sheetFormatPr defaultRowHeight="15"`). The DMC picture is anchored in the row below that
    caption.
  - Columns: A 14, B 24 characters.
- **Drawing.** Each picture is an `xdr:oneCellAnchor` (`from` cell with zero offsets, `ext` in EMU,
  9,525 EMU per px). It contains `xdr:pic`:
  - `cNvPr` id 2 and 3, named after the caption, with `descr`;
  - `picLocks noChangeAspect`;
  - `a:blip r:embed`;
  - `a:stretch`;
  - `prstGeom rect`.

  oneCellAnchor needs no column-width arithmetic for the bottom-right corner. Excel and LibreOffice
  both import it, and it is the default of common writers. The alternative, twoCellAnchor, needs
  the `to` cell, and so every row and column size.

### D8. Legend sheet

- **Header:** `No.`, `Color`, `DMC`, `Name`, `Stitches` with style 1.
- **Data rows:**
  - `A{r}` is the number (style 3+i);
  - `B{r}` is an empty swatch (style 3+N+i);
  - `C{r}` is the code, `D{r}` the name, both inline strings;
  - `E{r}` is the stitch count (style 2).
- **Column widths:** A 6, B 8, C 9, D 32 (the longest DMC name has 29 characters), E 12.
- **Codes as text.** Codes stay text (`B5200`, `BLANC`). `<ignoredErrors><ignoredError
  sqref="C2:C{N+1}" numberStoredAsText="1"/></ignoredErrors>` stops Excel's green triangles on
  `310`. LibreOffice ignores it harmlessly. It is omitted when N = 0, because an empty range would
  be invalid.

### D9. Where the writing runs: one module worker per export

- **Why a worker.** At the cap, building, encoding, CRC and deflate take about 1.4 s on a desktop,
  and 3–5× that on a phone. On the main thread that would freeze panning and keep the
  `aria-live` status from updating. The architecture rule also puts loops over every grid cell in
  a worker.
- **One worker per export.** `createWorkbookInWorker(createWorker, request)` creates a worker for
  each export and always terminates it after the response, the error or a failure event. That frees
  the tens of MB at once. Starting a module worker costs a few tens of ms, which is negligible next
  to the export, and no state needs to survive between exports. This is not the long-lived pattern
  worker, so no stop or stale-result logic is needed.
  - It resolves with the `bytes` (`Uint8Array`).
  - It rejects with `Error(message)` for an error response, and with
    `The Excel worker stopped: <reason>` on an `error` or `messageerror` event.
  - It ignores messages that carry another id.
- **Protocol** (in the style of the pattern worker):
  - Request `{ type: 'xlsx', id, pattern, pictures }`. The PNG buffers are transferred (fresh
    copies). `pattern` is structured-cloned, at most 2 MB of cells at the cap; the main thread keeps
    its own copy.
  - Response `{ type: 'xlsx', id, bytes }`, with `bytes.buffer` transferred.
  - Error `{ type: 'error', id, message }`.
  - The handler is `createXlsxWorkerHandler({ deflate })`, which returns
    `async handleMessage(message) → { response, transfer }`. It never rejects.
  - The entry passes `deflate: canDeflateRaw() ? deflateRaw : null`.
- **Checks.** The handler re-checks the cell cap and the pattern shape. A bypassed UI therefore
  still gets an error response instead of a hang.

### D10. Limits and texts (`xlsx-limits.js`)

- **Thresholds.** `XLSX_CONFIRM_CELLS = 250_000`, `XLSX_MAX_CELLS = 1_000_000`.
  `workbookSizeCheck({ width, height })` returns `'ok'`, `'confirm'` or `'too-large'`. Empty cells
  count, because each one is written.
- **Why 250,000.** About 8 MB of XML, a file under 1 MB, created in well under a second, and Excel
  opens it fast. Above that, opening in LibreOffice takes noticeably long, so the user is asked.
- **Why 1,000,000.** About 34 MB of XML, a 3–4 MB file, a few seconds to write, and long opening
  times in spreadsheet programs. Beyond that LibreOffice becomes unresponsive on cells this heavily
  styled.
- **Texts.** `formatLargeWorkbookQuestion(size)`, `formatWorkbookTooLarge(size)`,
  `CREATING_WORKBOOK_TEXT`, `formatWorkbookReady(fileName)` and `formatWorkbookError(reason)` give
  exactly the spec's texts, with counts formatted `en-US`.

### D11. UI flow (`setupExcelExport(root, store, deps)`)

- **Dependencies.** `deps` is `{ createWorkbook(request), encodePictures(image, pattern),
  download(blob, fileName) }`. `main.js` passes the real `io/` functions, and the integration test
  passes fakes.
- **Enabling.** The module enables `[data-action="export-xlsx"]` while `state.pattern !== null`
  and it is not busy. The busy flag is local to the module: no other module needs it.
- **Click sequence:**
  1. Close the menu (`details.open = false`).
  2. Run the size check. Too large shows the error status. Confirm opens the dialog.
  3. Set the busy flag and the `loading` status. `status.js` then marks the view `aria-busy`.
  4. Encode the pictures, create the workbook, and call
     `download(new Blob([bytes], { type: XLSX_MEDIA_TYPE }), exportFileName(image.fileName, 'xlsx'))`.
  5. Show the `info` status, or the `error` status on failure.
- **Stale status.** The final status is written only if `state.status` is still the object this
  export set. A newer message, such as a new image loading, is never overwritten.
- **Dialog.** `<dialog class="confirm-dialog" data-role="xlsx-warning">` goes right after the
  progress dialog in `index.html`. It has the title `Large workbook`, a text paragraph, and the
  buttons `Cancel` (`autofocus`) and `Create workbook` (`confirm-dialog__button--confirm`). It
  reuses the existing `.confirm-dialog` CSS, so no new CSS is needed. Esc or any other close means
  Cancel.
  - *Alternatives:* reusing the progress dialog was rejected, because its title and keep button
    talk about progress. `window.confirm` was rejected: it is unstyled, blocks the page, and some
    embedded browsers suppress it.
- **Wiring.** `main.js` appends one group at its end:

  ```js
  // Excel workbook export (written in a module worker, one per export).
  const createXlsxWorker = () => new Worker(new URL('./workers/xlsx.worker.js', import.meta.url), { type: 'module' });
  ```

  The group then calls `setupExcelExport(document, store, { createWorkbook, encodePictures, download })`.

### D12. How the tests verify the file in Node

- **Unit tests** cover every exported `core/` function:
  - CRC-32 vectors: `''` → `00000000`, `'a'` → `E8B7BE43`, `'123456789'` → `CBF43926`,
    `'The quick brown fox jumps over the lazy dog'` → `414FA339`, and chaining `'12345'` +
    `'6789'` = `CBF43926`;
  - the exact header bytes of a one-entry stored ZIP;
  - column names `1` → `A`, `26` → `Z`, `27` → `AA`, `702` → `ZZ`, `703` → `AAA`, `10000` →
    `NTP`, `16384` → `XFD`;
  - style indexes, sheet XML of the 3 × 2 pattern, layout numbers, limits and texts.
- **`tests/helpers/unzip.js`** parses our archive from the end-of-central-directory record.
  - Inflating uses Node's built-in `zlib.inflateRawSync`.
  - Each CRC is checked against `zlib.crc32` (Node 22.2+), a reference independent of our CRC code.
  - It also checks that local and central headers agree.
- **`tests/helpers/xml-check.js`** is a small well-formedness checker for the XML we write:
  - one root element;
  - balanced tags;
  - quoted, unique attributes;
  - only the five predefined entities and numeric references;
  - no forbidden characters.

  It also returns the element sequence, so tests can assert the schema orders of D3.
- **`tests/integration/excel-workbook.test.js`** builds workbooks through `workbookFiles` and
  `buildZip` with real `deflateRaw`, and with `deflate: null`. It checks:
  - the 13 part names;
  - content types for each part;
  - that every relationship target exists;
  - the cell values of the 3 × 2 pattern;
  - fills, fonts and borders resolved through `styles.xml`;
  - the 23 × 12 border pattern;
  - Summary and Legend cells;
  - the drawing anchors and EMU sizes;
  - byte-identical output on a second run.
- **Worker handler and client tests** follow the pattern-worker tests: direct handler calls, and a
  fake worker for the client.
- **`tests/integration/excel-export.test.js`** drives the UI module with fake DOM elements, fake
  deps and a real store.
- **Markup test.** The shared menu block and the dialog are checked in `index.html`.
- **Served-site test.** The existing test follows `new URL('./workers/…', import.meta.url)`, so
  the new worker and its imports are covered.
- **Browser check.** Only a real spreadsheet program can confirm "opens without repair", so the
  smoke checklist covers Excel and LibreOffice.

### D13. Shared pieces

`io/download.js`, `core/file-names.js` with its test, and `core/pattern-summary.js` with its test
are copied byte for byte from the shared conventions. So are the Export menu block (with only the
`export-xlsx` item), the CSS block after the `.file-picker:has(...)` rule, and the `print.css`
rule. Merging after `add-pdf-export` then sees identical files. The only difference is the menu
item lines, and the items follow the fixed order in the conventions.

## Risks / Trade-offs

- [A program asks to repair the file because of one wrong element order or count] → Writers follow
  the schema order. Tests assert the orders and counts, and the smoke check opens real files in
  Excel and LibreOffice before archive.
- [LibreOffice before 7.4 allows only 1,024 columns and drops wider charts] → The spec targets
  7.4+, released in 2022. Most charts are narrower than 1,024. This is noted in the smoke check.
- [Deflate bytes differ between browsers] → Determinism is promised only within one browser. Tests
  compare files written by the same Node runtime.
- [`zlib.crc32` needs Node 22.2+] → The project requires Node 22. The helper fails with a clear
  message if `zlib.crc32` is missing.
- [Square cells depend on the font and dpi of the viewer] → Exact at 96 dpi with Calibri or Carlito.
  Elsewhere the error is a pixel or two on both sides.
- [Merge conflict with `add-pdf-export` if it also adds a dialog after the progress dialog] → The
  dialog lines are adjacent insertions and easy to resolve. This is flagged in the report for the
  merge order.
- [Peak memory at the cap] → About 50–80 MB in the worker, briefly, plus the Blob. The worker is
  terminated right after.

## Migration Plan

Additive. Nothing is stored and no format changes. Rollback is reverting the change.
