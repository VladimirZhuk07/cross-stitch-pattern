# Tasks

## 1. Shared export pieces (verbatim from the shared export conventions)

- [x] 1.1 Add `tests/unit/core/file-names.test.js` exactly as in the conventions (section 4) and verify it fails (module missing)
- [x] 1.2 Add `src/core/file-names.js` exactly as in the conventions; verify 1.1 passes
- [x] 1.3 Add `tests/unit/core/pattern-summary.test.js` exactly as in the conventions (section 5) and verify it fails
- [x] 1.4 Add `src/core/pattern-summary.js` exactly as in the conventions; verify 1.3 passes
- [x] 1.5 Add `tests/unit/core/compression.test.js` exactly as in the conventions (section 7) and verify it fails (module missing)
- [x] 1.6 Add `src/core/compression.js` exactly as in the conventions; verify 1.5 passes
- [x] 1.7 Add `src/io/download.js` exactly as in the conventions (section 3); verify `node --check src/io/download.js` succeeds (it is reached by the served-site test once 9.4 imports it)

## 2. Finished size text (core)

- [x] 2.1 Add failing tests to `tests/unit/core/generation-settings.test.js`:
  - `formatFinishedSize({ width: 100, height: 67 }, 14)` → `7.1 × 4.8 in (18.1 × 12.2 cm) on 14 ct`;
  - `formatPatternSize` output is unchanged for the same input.

  Verify they fail.
- [x] 2.2 Extract `formatFinishedSize` in `src/core/generation-settings.js` (design D12) and use it in `formatPatternSize`; verify 2.1 and all existing generation-settings tests pass

## 3. PDF text, writer, pictures and content builder (core)

- [x] 3.1 Add failing tests `tests/unit/core/pdf-text.test.js` for `encodeWinAnsi`, `pdfString` and `pdfTextString`:
  - `café` → bytes `63 61 66 E9`;
  - `–`, `…` and `€` → `96`, `85` and `80`;
  - `Ё` → `?`;
  - `pdfString('a(b)\\c')` → `(a\(b\)\\c)`;
  - `pdfString('é')` → `(\351)`;
  - `pdfTextString('Ёлка')` → `<FEFF0401043B043A0430>`.

  Verify they fail.
- [x] 3.2 Implement the encoding and string functions in `src/core/pdf-text.js` (design D3); verify 3.1 passes
- [x] 3.3 Add failing tests for `textWidth` and `fitText`:
  - digits are 556 in both fonts;
  - `textWidth('489', 'F1', 4.08)` ≈ 6.805;
  - space 278, `W` 944, `i` 222; Bold `W` 944, `i` 278;
  - `'` (code 39) 191 / 238;
  - `é` counts as 1015 / 975;
  - `fitText` returns short text unchanged, and for a 200-character name returns a prefix ending in `…` whose width ≤ the limit;
  - every DMC name from `src/data/dmc.js` at 9 pt, counted at 1015 per character, is ≤ 115 mm.

  Verify they fail.
- [x] 3.4 Add the Helvetica and Helvetica-Bold width tables (codes 32–126, from Adobe Core14 AFM, cited in the header) and `textWidth` and `fitText`; verify 3.3 passes
- [x] 3.5 Write the read-back helper `tests/helpers/pdf-reader.js` and failing tests in `tests/unit/core/pdf-writer.test.js`. The helper:
  - `readPdf(bytes)` parses the header, `startxref`, the xref table, the trailer and the objects, and inflates `/FlateDecode` streams with `node:zlib`;
  - `readContent(text)` tokenizes content streams into fills, strokes and texts with positions.

  The writer tests cover:
  - `pdfNumber(85.03937)` → `85.04`, `pdfNumber(2.5)` → `2.5`, `pdfNumber(-0.001)` → `0`, `pdfNumber(3)` → `3`, and `pdfNumber(NaN)` throws `RangeError`;
  - a writer with 3 objects plus one stream gives `%PDF-1.4`, and xref lines of exactly 20 bytes whose offsets point to `n 0 obj`;
  - `/Size 5`;
  - `%%EOF` at the end;
  - a reserved but unwritten number makes `finish` throw.

  Verify they fail.
- [x] 3.6 Implement `src/core/pdf-writer.js` (design D2); verify 3.5 passes
- [x] 3.7 Add failing tests `tests/unit/core/pdf-pictures.test.js`:
  - `readJpegInfo` on hand-made bytes (SOI, APP0, SOF0 1200 × 804 × 3) → `{ width: 1200, height: 804, components: 3 }`;
  - SOF2 (progressive) works;
  - missing SOI and 4 components → `TypeError`;
  - `pictureSize(4000, 3000)` → 1200 × 900, and `pictureSize(800, 600)` → 800 × 600;
  - `dmcPictureScale` → 12 for 100 × 67, 400 for 3 × 2, and 1 (downscaled to 1200 × 960) for 2000 × 1600.

  Verify they fail.
- [x] 3.8 Implement `src/core/pdf-pictures.js` (design D9); verify 3.7 passes
- [x] 3.9 Add failing tests `tests/unit/core/pdf-content.test.js` for the content builder:
  - `fillColor('#FFC0BB')` → `1 0.753 0.733 rg`;
  - a rect in mm-from-top coordinates becomes PDF points from the bottom (x 30 mm, y 23 mm, 3.2 mm → `85.04 767.62 9.07 9.07 re`);
  - text with font, size and position → `BT /F1 4.08 Tf … Tj ET`;
  - the output is ASCII only.

  Verify they fail.
- [x] 3.10 Implement `src/core/pdf-content.js`; verify 3.9 passes

## 4. Page plan and dialog texts (core)

- [x] 4.1 Add failing tests `tests/unit/core/pdf-page-plan.test.js` with the spec's page counts:
  - 3 × 2 → 3;
  - 120 × 90 → 8;
  - 300 × 200 → 20;
  - 450 × 800 → 92;
  - 500 × 800 → 102;
  - 750 × 2000 → 377, map on the info page;
  - 751 × 80 → 19, with 1 map page;
  - 1000 × 1000 → 264;
  - 2000 × 1600 → 806;
  - 2000 × 2000 → 1,007;
  - 10000 × 10000 → 25,114;
  - 489 colors → 10 legend pages;
  - no stitches → 1 legend page.

  Also cover `chartPageArea` for pages 1, 3, 4 and 6 of 120 × 90, and invalid page numbers (`RangeError`). Use small synthetic `{ width, height, legend }` objects for the plan. Verify they fail.
- [x] 4.2 Implement `planPdfPages`, `chartPageArea` and the constants in `src/core/pdf-page-plan.js` (design D5); verify 4.1 passes
- [x] 4.3 Add failing tests for `needsPdfConfirmation` (100 → false, 102 → true), `isPdfTooLarge` (1000 → false, 1001 → true), and the four texts, word for word as in the spec (92, 102, 1,007, 25,114 pages; the error text). Verify they fail.
- [x] 4.4 Implement them; verify 4.3 passes

## 5. Page content (core)

- [x] 5.1 Add failing tests `tests/unit/core/pdf-chart-page.test.js` for cells and numbers, using `readContent`:
  - 3 × 2 page 1: cell (0, 0) at (85.04, 767.62), 9.07 pt, filled `#FFC0BB`, with `2` centred at (89.57, 772.16) within 0.01;
  - the empty cell is `#E0E0E0` with a diagonal (85.04, 758.55) → (94.11, 767.62) and no number;
  - exactly 5 numbers;
  - one fill rectangle per horizontal run (a row `[0, 0, 0]` gives one rect);
  - page 3 of 120 × 90 starts at x 85.04.

  Verify they fail.
- [x] 5.2 Implement the fills, hatch and numbers of `chartPageContent` in `src/core/pdf-chart-page.js` (design D7); verify 5.1 passes
- [x] 5.3 Add failing tests for lines, rulers, the centre and the header and footer:
  - 120 × 90 page 3: 3 bold and 18 thin vertical lines, 9 bold and 72 thin horizontal ones, with widths 0.9 and 0.3;
  - 23 × 12: bold at 0, 10, 20, 23 and at 0, 10, 12;
  - ruler labels of pages 2 and 4;
  - triangles on pages 1, 2, 3 and 5 only, as in the spec;
  - the `10000` label of 50 × 10000 page 125 lies within x 21–27.7 mm;
  - page 6 header `cat.png`, `Columns 101–120 · rows 81–90`, and footer `Page 6 of 6`;
  - a 200-character file name fits 80 mm.

  Verify they fail.
- [x] 5.4 Implement the lines, rulers, triangles, header and footer; verify 5.3 passes, and that `src/core/pdf-chart-page.js` stays under ~300 lines
- [x] 5.5 Add failing tests `tests/unit/core/pdf-legend-pages.test.js`:
  - the 3 × 2 legend rows (box tint `#B0B0B0` and `#FFC0BB`, swatch `#000000` and `#C72B3B`, codes, names, counts) and the column headings;
  - `12,345` right-aligned at 200 mm;
  - 489 entries → 10 pages, the last with 39 rows ending in `489`, and `Legend (continued)` from page 2;
  - no stitches → `This pattern has no stitches.`

  Verify they fail.
- [x] 5.6 Implement `src/core/pdf-legend-pages.js` (design D4); verify 5.5 passes
- [x] 5.7 Add failing tests `tests/unit/core/pdf-page-map.test.js`:
  - the 120 × 90 diagram: 6 tiles numbered 1–6 row-major, column ranges `1–50`, `51–100`, `101–120`, row ranges `1–80`, `81–90`;
  - the 750 × 2000 diagram: 15 × 25 tiles, each label inside its tile or header;
  - the 1000 × 1000 table: 2 pages, 224 entries on the first, first entry `1` `1–50` `1–80`, last `260` `951–1000` `961–1000`, and the headings `Page map` / `Page map (continued)`.

  Verify they fail.
- [x] 5.8 Implement `src/core/pdf-page-map.js` (design D6); verify 5.7 passes
- [x] 5.9 Add failing tests `tests/unit/core/pdf-info-page.test.js`:
  - the title `Cross-stitch pattern` in F2, and the file name, with `Ёлка.png` shown as `????.png`;
  - the captions `Original` and `DMC colors`;
  - the images drawn as `/Im1 Do` and `/Im2 Do`, each 90 mm wide and 60.3 mm high for 1200 × 804 pictures, top-aligned at 35 mm;
  - the four summary lines of the 100 × 67 example at 14 ct;
  - the map note `The page map is on the next 2 pages.` (1000 × 1000) and `…next page.` (751 × 80).

  Verify they fail.
- [x] 5.10 Implement `src/core/pdf-info-page.js` (design D4, D6); verify 5.9 passes

## 6. Document assembly (core) and the export format

- [x] 6.1 Add failing tests `tests/unit/core/pdf-document.test.js` for `buildPdfDocument` with `isCompressed: false` and fake JPEG header bytes, read back with `readPdf`:
  - page order (info, legend, chart) and `/Count 8` for 120 × 90;
  - two fonts with `/WinAnsiEncoding` and no `/FontFile`;
  - two `/DCTDecode` images with the JPEG sizes;
  - the Info `/Title` in UTF-16BE;
  - `onProgress` called once per page, ending at `{ done: 8, total: 8 }`;
  - more than 1,000 pages → `RangeError` before any work.

  Verify they fail.
- [x] 6.2 Implement `src/core/pdf-document.js` (design D2, D8); verify 6.1 passes
- [x] 6.3 Write `tests/integration/pdf-export-format.test.js`, which builds the 120 × 90 PDF with the default `isCompressed` (`canCompress()` is true in Node 22, so content goes through the shared `compressBytes(…, 'deflate')`, design D8) and checks:
  - `%PDF-1.4` … `%%EOF`;
  - `startxref` points at `xref`, and every offset at `n 0 obj`;
  - `/Size` is the object count + 1;
  - every page stream is `/FlateDecode` and inflates with `node:zlib` to the expected operators (chart page 1 has 4,000 numbers);
  - two runs are byte-identical;
  - with `isCompressed: false`, the file is valid, has no `/Filter` on page streams, and is larger.

  Verify `npm run test:integration` passes.

## 7. Worker and client

- [x] 7.1 Write failing `tests/integration/pdf-worker.test.js` for `createPdfWorkerHandler({ postProgress })`:
  - an `export-pdf` request → `{ type: 'pdf', id }` with bytes that `readPdf` reads as 8 pages, and `transfer` equal to `[bytes.buffer]`;
  - progress messages carry the id, grow strictly in percent and number at most 101;
  - a 2000 × 2000 request → an error response with a message naming 1,007 pages;
  - an unknown type, or a bad JPEG → an error response echoing the id.

  Verify it fails.
- [x] 7.2 Implement `src/workers/pdf-worker-handler.js` and the entry `src/workers/pdf.worker.js` (design D10); compression is decided inside `buildPdfDocument` by `canCompress()`. Verify 7.1 passes
- [ ] 7.3 Write failing `tests/integration/pdf-worker-client.test.js` with a fake worker:
  - the request is posted with the picture buffers transferred;
  - progress is routed to `onProgress`;
  - it resolves with the bytes;
  - `stop()` terminates and rejects with `PdfExportStoppedError`;
  - a worker `error` rejects with `The PDF worker stopped: …`;
  - a new export after a stop starts a new worker.

  Verify it fails.
- [ ] 7.4 Implement `src/io/pdf-worker-client.js`; verify 7.3 passes

## 8. Pictures (io)

- [ ] 8.1 Implement `src/io/pdf-picture-encoder.js` (`encodePdfPictures(image, pattern)` → `{ original, dmc }` JPEG `Uint8Array`s; design D9). It uses a white background, the long side capped at 1200 px, and nearest-neighbour upscaling by `dmcPictureScale`. Add a header comment on why the pictures are JPEG. Verify `node --check` succeeds; the browser check in 10.3 covers it.

## 9. Menu, dialog and wiring (ui)

- [ ] 9.1 Add a failing `tests/integration/pdf-export-markup.test.js` for:
  - the shared `<details class="export-menu" data-role="export-menu">` block right after the `<h1>`, with only the `export-pdf` button (disabled, text `PDF chart`);
  - the `pdf-export-dialog` with its title, text, hidden `<progress max="100">` and both buttons;
  - the shared CSS block after the `.file-picker:has(...)` rule, and the `print.css` rule.

  Then add the markup and CSS verbatim (conventions sections 1 and 2), the dialog after the existing `<dialog>`, and `.confirm-dialog__progress`. Verify the test passes, along with `layout-css` and the other markup tests.
- [ ] 9.2 Write failing `tests/integration/pdf-export.test.js` for `setupPdfExport`, with fake DOM elements, a fake client, `encodePictures` and `download`. Cover:
  - the button is disabled without a pattern and enabled with one;
  - a click closes the menu;
  - 92 pages → the running text, then `download` is called with `cat.pdf` and an `application/pdf` Blob, and the dialog closes;
  - 102 pages → the question, where `Cancel` exports nothing and `Create PDF` exports;
  - 1,007 pages → the too-large text and `Close`, with no encode;
  - progress 403 / 806 → the bar at 50;
  - Cancel while running → `client.stop()`, no download, the button enabled again;
  - a rejected `encodePictures` → `Could not create the PDF: …`.

  Verify it fails.
- [ ] 9.3 Implement `src/ui/pdf-export.js` (design D11); verify 9.2 passes
- [ ] 9.4 Append the PDF export group at the end of `src/main.js`, with a one-line comment. It creates the PDF worker, the client, `encodePdfPictures` and `downloadBlob`. Verify `tests/integration/served-site.test.js` reaches `pdf.worker.js` and all new modules with 200 and relative `.js` imports.

## 10. Verification

- [ ] 10.1 Run `npm run test:unit`; all tests pass
- [ ] 10.2 Run `npm run test:integration`; all tests pass
- [ ] 10.3 Browser smoke check with `node scripts/serve.js`:
  - Before any pattern, `Export` → `PDF chart` is disabled. Load a photo (default width 100): it becomes enabled. Click it: the menu closes, a short progress dialog shows `Creating the PDF: … pages`, and `<name>.pdf` downloads. DevTools Network shows no request.
  - Open the PDF in the browser viewer and in one other viewer (Acrobat Reader, macOS Preview or Firefox). Check that:
    - page 1 has the title, the file name, both pictures side by side (DMC picture sharp), the four summary lines with the finished size, and the page map with ranges;
    - the legend page has the tinted number boxes, swatches, codes, names and counts;
    - chart pages have tints, black numbers, grey hatched empty cells, thin and bold lines, rulers with absolute numbers, the centre triangles, the header and `Page n of N`.
  - Print chart page 1 on A4 at 100 % scale: the cells measure 3.2 mm, the numbers are readable, and nothing is clipped.
  - Width 500 on a tall photo (more than 100 pages): the question appears; `Cancel` exports nothing; `Create PDF` shows progress while the view still pans; the download works.
  - Width 2000 (a square photo): the too-large text appears and nothing downloads. Width 1600 (around 800 pages): `Cancel` mid-way stops at once with no download. Run it again to the end and note the file size and the time in the report.
  - A file named with Cyrillic letters: the pages show `?`, and the document title in the viewer shows the real name.
  - Phone width 360 px: the Export menu and the dialog fit with no horizontal scroll. Keyboard: Tab to `Export`, Enter, Tab to `PDF chart`, Enter; Esc cancels the dialog. Print preview of the app hides the Export menu. No console errors.
- [ ] 10.4 Run `openspec validate add-pdf-export --strict`; it passes
