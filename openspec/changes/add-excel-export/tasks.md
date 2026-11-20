# Tasks

The shared pieces come from `C:/Users/vovas/AppData/Local/Temp/side-smoke/shared-export-conventions.md`
(sections 1–8). Copy them byte for byte. If `add-pdf-export` or `add-progress-file` reached `main`
first, keep the existing files: they must already be identical.

## 1. Shared pieces (core, io)

- [x] 1.1 Add `tests/unit/core/file-names.test.js` verbatim (section 4) and see it fail; add `src/core/file-names.js` verbatim; verify `node --test tests/unit/core/file-names.test.js` passes
- [x] 1.2 Add `tests/unit/core/pattern-summary.test.js` verbatim (section 5) and see it fail; add `src/core/pattern-summary.js` verbatim; verify the test passes
- [x] 1.3 Add `src/io/download.js` verbatim (section 3); verify it is identical to the conventions text (compare with a copy of the section's code block, e.g. `git diff --no-index`, which shows no difference) and that `served-site.test.js` still passes once it is imported (task 8.4)
- [x] 1.4 Add `tests/unit/core/compression.test.js` verbatim (section 7) and see it fail (module missing); add `src/core/compression.js` verbatim; verify `node --test tests/unit/core/compression.test.js` passes
- [x] 1.5 Add `tests/unit/core/crc32.test.js` verbatim (section 8) and see it fail (module missing); add `src/core/crc32.js` verbatim; verify `node --test tests/unit/core/crc32.test.js` passes. The ZIP writer uses this module and has no CRC-32 code of its own.

## 2. XML helpers (core)

- [x] 2.1 Write failing `tests/unit/core/xml.test.js`, then verify it fails. Cover:
  - `escapeXml('Rose & "Wine" <test> \'x\'')` → `Rose &amp; &quot;Wine&quot; &lt;test&gt; &apos;x&apos;`;
  - `escapeXml('a\u0001b\tc')` → `ab\tc`;
  - `columnName` 1 → `A`, 26 → `Z`, 27 → `AA`, 52 → `AZ`, 702 → `ZZ`, 703 → `AAA`, 10000 → `NTP`, 16384 → `XFD`;
  - `columnName(0)` and `columnName(16385)` throw `RangeError` naming the value;
  - `cellReference(3, 2)` → `C2`.
- [x] 2.2 Implement `src/core/xml.js`; verify 2.1 passes

## 3. ZIP writer (core)

- [x] 3.1 Write failing `tests/unit/core/zip.test.js` for `zipArchive`, then verify it fails. Cover:
  - one stored entry `a.txt` = `hi` → the exact expected bytes: local header `50 4B 03 04`, version 20, method 0, time 0, date `0x0021`, CRC, sizes 2/2, name, data, central directory, EOCD with 1 entry and the right offsets (written out byte by byte in the test);
  - two entries → the second local header offset equals the first header + name + data;
  - a method-8 entry keeps its `size` as the uncompressed size;
  - names `''`, `/a.xml`, `ä.xml` throw `TypeError`;
  - 65,536 entries throw `RangeError`.
- [x] 3.2 Implement `zipArchive` in `src/core/zip.js`; verify 3.1 passes
- [x] 3.3 Add failing tests for `buildZip(files, { useCompression })`, then verify they fail. Cover:
  - string-chunk content gets the UTF-8 bytes' CRC and size;
  - `shouldCompress: true` (default `useCompression`, i.e. `canCompress()`) → method 8, and `zlib.inflateRawSync` gives the bytes back;
  - `useCompression: false` → every entry method 0;
  - `Uint8Array` content with `shouldCompress: false` is stored unchanged;
  - two runs give byte-identical archives.
- [x] 3.4 Implement `buildZip` using `compressBytes(bytes, 'deflate-raw')` from `src/core/compression.js` (design D2); verify 3.3 passes and `src/core/zip.js` stays under ~300 lines

## 4. Workbook styles and limits (core)

- [x] 4.1 Write failing `tests/unit/core/xlsx-styles.test.js` for `workbookStyles(legend)`, then verify it fails. Use the 3 × 2 legend (310, 321) and cover:
  - `fills` holds `none`, `gray125`, `FFE0E0E0`, the tints `FFB0B0B0` and `FFFFC0BB`, then `FF000000` and `FFC72B3B` in that order;
  - fonts: Calibri 11, Calibri 11 bold, Calibri 9 color `FF000000`;
  - `chartCellStyle(legendIndex, x, y, width, height)`: for 23 × 12, (9, 0) has a medium right edge, (0, 0) medium left and top, (22, 11) medium right and bottom, (5, 5) thin right and bottom with no left or top, and an empty cell (−1) uses the diagonal-up border;
  - `legendNumberStyle(i)`, `swatchStyle(i)`, `BOLD_STYLE`, `COUNT_STYLE` (numFmtId 3);
  - every `count` attribute equals its child count;
  - for 489 legend entries the cellXfs count is 8,821 (≤ 64,000).
- [x] 4.2 Implement `src/core/xlsx-styles.js` (design D4; element and border child order as in D3); verify 4.1 passes
- [x] 4.3 Write failing `tests/unit/core/xlsx-limits.test.js`, then verify it fails. Cover:
  - `workbookSizeCheck` gives 500 × 500 → `'ok'`, 501 × 500 → `'confirm'`, 1000 × 1000 → `'confirm'`, 2000 × 2000 → `'too-large'`, 10000 × 101 → `'too-large'`;
  - `formatLargeWorkbookQuestion({ width: 800, height: 800 })` and `formatWorkbookTooLarge({ width: 2000, height: 2000 })` → the exact spec texts;
  - `CREATING_WORKBOOK_TEXT` = `Creating Excel workbook…`;
  - `formatWorkbookReady('cat.xlsx')` = `Excel workbook ready: cat.xlsx`;
  - `formatWorkbookError('out of memory')` = `Could not create the Excel workbook: out of memory`.
- [x] 4.4 Implement `src/core/xlsx-limits.js`; verify 4.3 passes

## 5. Sheets and package (core)

- [x] 5.1 Write failing `tests/unit/core/xlsx-chart-sheet.test.js`, then verify it fails. Cover:
  - joining the chunks of `chartSheetXml(3 × 2 pattern, styles)` gives `dimension ref="A1:C2"`, `tabSelected="1"`, one `<col min="1" max="3" width="3.42578125" customWidth="1"/>`, rows with `ht="18" customHeight="1"`, cells `A1`=2, `B1`=1, `C1`=1, `A2` with a style and no `<v>`, `B2`=1, `C2`=2, each with its `chartCellStyle` index;
  - element order dimension → sheetViews → sheetFormatPr → cols → sheetData → pageMargins;
  - a 1000-row pattern yields more than one chunk, and every chunk ends on a row boundary.
- [x] 5.2 Implement `src/core/xlsx-chart-sheet.js` (design D6); verify 5.1 passes
- [x] 5.3 Write failing tests for `fitInside` and `stitchBlockSize` in `tests/unit/core/picture-size.test.js`, then verify they fail. Cover:
  - 1600 × 1072 in 1024 → 1024 × 686;
  - 300 × 200 in 1024 → 300 × 200;
  - 1600 × 1072 in 480 → 480 × 322;
  - 10000 × 100 in 480 → 480 × 5;
  - 10000 × 1 in 480 → 480 × 1 (never 0);
  - block size for 100 × 67 → 10, 1000 × 1000 → 1, 10000 × 100 → 1;
  - non-positive sizes throw `RangeError`.
- [x] 5.4 Implement `src/core/picture-size.js`; verify 5.3 passes
- [x] 5.5 Write failing `tests/unit/core/xlsx-summary-sheet.test.js`, then verify it fails. Cover:
  - `summaryLayout` for pictures 1024 × 686 and 1000 × 670 → original caption row 5, picture row 6, size 480 × 322, DMC caption row 24, picture row 25;
  - `summarySheetXml(summaryLines(…), layout, styles)` has A1:B3 as inline strings with bold labels, A5/A24 bold captions, `<drawing r:id="rId1"/>` after `pageMargins`;
  - `summaryDrawingXml(layout)` has two `xdr:oneCellAnchor` with `from` col 0 / row 5 and col 0 / row 24, `ext cx="4572000" cy="3067050"`, `r:embed` `rId1`/`rId2`, `cNvPr` ids 2 and 3 with the captions;
  - text is escaped.
- [x] 5.6 Implement `src/core/xlsx-summary-sheet.js` (design D7); verify 5.5 passes
- [x] 5.7 Write failing `tests/unit/core/xlsx-legend-sheet.test.js`, then verify it fails. Cover:
  - 3 × 2 pattern → header row with bold `No.` … `Stitches`;
  - row 2 = number 1 (legend number style 0), swatch style 0 without a value, inline `310`, inline `Black`, number 3 with `COUNT_STYLE`;
  - row 3 for `321`;
  - `ignoredError sqref="C2:C3" numberStoredAsText="1"` after `pageMargins`;
  - a pattern without stitches → only the header and no `ignoredErrors`;
  - the name `Rose & "Wine" <test>` is escaped.
- [ ] 5.8 Implement `src/core/xlsx-legend-sheet.js` (design D8); verify 5.7 passes
- [ ] 5.9 Write failing `tests/unit/core/xlsx-package.test.js` for `workbookFiles(pattern, pictures)`, then verify it fails. Cover:
  - it returns the 13 parts of the spec in a fixed order, `[Content_Types].xml` first;
  - XML parts have `shouldCompress: true`, PNGs `false` with the given bytes;
  - content types per part as in design D3;
  - workbook sheets `Chart`/`Summary`/`Legend` with `rId1`–`rId3` and `activeTab="0"`;
  - every relationship target names a returned part;
  - `XLSX_MEDIA_TYPE`;
  - a malformed picture (width 0, `png` not a `Uint8Array`) throws.
- [ ] 5.10 Implement `src/core/xlsx-package.js`; verify 5.9 and `npm run test:unit` pass

## 6. Export format integration tests

- [ ] 6.1 Add `tests/helpers/unzip.js`. It:
  - parses an archive from its EOCD;
  - checks that local and central headers agree;
  - inflates with `zlib.inflateRawSync`;
  - checks every CRC with `zlib.crc32`, with a clear error if it is missing;
  - returns `Map<name, Uint8Array>` plus each entry's method.

  Also add `tests/helpers/xml-check.js`, a well-formedness check that returns the element names in order (design D12). Verify both with a quick self-test inside 6.2.
- [ ] 6.2 Write `tests/integration/excel-workbook.test.js`, which builds workbooks with `workbookFiles` + `buildZip` and the real shared compression. Cover:
  - the 13 parts, all XML well-formed and UTF-8;
  - content types and relationships resolve;
  - Chart values, fills, fonts and borders of the 3 × 2 pattern resolved through `styles.xml`;
  - the 23 × 12 bold-border scenario;
  - the 318-vs-empty scenario;
  - the Summary texts and anchors;
  - the Legend rows;
  - the schema element orders;
  - byte-identical second run;
  - `useCompression: false` → all entries stored and the same unzipped parts.

  Verify `npm run test:integration` passes.
- [ ] 6.3 Add a size and time test to the same file: a synthetic 1000 × 1000 pattern (30 colors, runs of equal cells) gives a workbook under 8 MB in under 10 s in Node; verify it passes

## 7. Worker (workers, io)

- [ ] 7.1 Write failing `tests/integration/xlsx-worker.test.js` for `createXlsxWorkerHandler()` (and `{ useCompression: false }` once), then verify it fails. Cover:
  - a `{ type: 'xlsx', id: 7, pattern, pictures }` request → `{ type: 'xlsx', id: 7, bytes }` with `transfer` = `[bytes.buffer]`, and `bytes` unzips (helper) to the 13 parts;
  - an unknown type, a missing pattern, and a 2000 × 2000 pattern → `{ type: 'error', id, message }` with a message naming the problem;
  - the handler never rejects.
- [ ] 7.2 Implement `src/workers/xlsx-worker-handler.js` and the entry `src/workers/xlsx.worker.js` (design D9); verify 7.1 passes
- [ ] 7.3 Write failing `tests/integration/xlsx-worker-client.test.js` with a fake worker, then verify it fails. Cover `createWorkbookInWorker`:
  - posts one request with the PNG buffers in the transfer list;
  - resolves with the bytes;
  - rejects with the worker's message on an error response;
  - rejects with `The Excel worker stopped: …` on `error`/`messageerror`;
  - terminates the worker in every case;
  - ignores messages with another id.
- [ ] 7.4 Implement `src/io/xlsx-worker-client.js`; verify 7.3 passes
- [ ] 7.5 Implement `src/io/summary-pictures.js`, `encodeSummaryPictures(image, pattern)` (design D7, using `fitInside`, `stitchBlockSize`, `patternToStitchImage`; header comment on why PNG and the main thread). It is not unit-tested (canvas); it is covered by the smoke check. Verify the served-site test passes once it is imported (task 8.4).

## 8. Menu, dialog and UI (index.html, CSS, ui, main.js)

- [ ] 8.1 Write a failing `tests/integration/export-menu-markup.test.js`, then verify it fails. It checks:
  - `index.html` contains the shared `<details class="export-menu" data-role="export-menu">` block right after the `<h1>`, with `<button class="export-menu__item" type="button" data-action="export-xlsx" disabled>Excel workbook</button>` (items in the conventions' order if others exist);
  - the `xlsx-warning` dialog with title `Large workbook`, text paragraph, `Cancel` (autofocus) and `Create workbook`;
  - `styles/main.css` contains the shared block right after the `.file-picker:has(.file-picker__input:focus-visible)` rule;
  - `styles/print.css` ends with the shared `.export-menu { display: none; }` rule.
- [ ] 8.2 Add the markup to `index.html` and the CSS to `styles/main.css` and `styles/print.css` verbatim (conventions sections 1–2), plus the dialog after the progress dialog (design D11). Verify 8.1 passes, and `layout-css.test.js` and the mobile markup tests still pass.
- [ ] 8.3 Write failing `tests/integration/excel-export.test.js` for `setupExcelExport(root, store, deps)` with fake elements (`tests/helpers/fake-legend-dom.js`), a fake dialog as in `progress-warning.test.js`, and fake deps. Cover:
  - the item is disabled without a pattern and enabled with one;
  - a click closes the menu;
  - a 3 × 2 pattern of `cat.png`: the status goes `loading`/`Creating Excel workbook…` → `info`/`Excel workbook ready: cat.xlsx`, `download` gets a Blob of `XLSX_MEDIA_TYPE` named `cat.xlsx`, and the item is disabled while running;
  - 800 × 800: the dialog opens with the spec text; Cancel or Esc → no `createWorkbook` call and the status is unchanged; Create workbook → export;
  - 2000 × 2000 → the error status with the spec text, and no dialog or deps called;
  - a rejected `createWorkbook('out of memory')` → the error text, and the item is enabled again;
  - a newer status set during the export is not overwritten.

  Verify it fails.
- [ ] 8.4 Implement `src/ui/excel-export.js` (design D11) and append the setup group to the end of `src/main.js` (conventions section 6); verify 8.3, `served-site.test.js` (the new worker and modules are reachable, with relative `.js` imports) and `npm run test:integration` pass

## 9. Verification

- [ ] 9.1 Run `npm run test:unit`; all tests pass
- [ ] 9.2 Run `npm run test:integration`; all tests pass
- [ ] 9.3 Browser smoke check with `node scripts/serve.js` (current Chrome or Edge, plus Firefox or Safari):
  - Before loading an image, Export → `Excel workbook` is disabled. Load a photo (for example 1600 × 1072 `cat.png`) at width 100. The item becomes enabled. Click it: the menu closes, the status reads `Creating Excel workbook…`, then `Excel workbook ready: cat.xlsx`, and `cat.xlsx` is downloaded. The DevTools network panel shows no request.
  - Open `cat.xlsx` in Excel (desktop or 365) **and** in LibreOffice Calc 7.4+. Neither shows a repair or "problem with content" prompt. The tabs read `Chart`, `Summary`, `Legend`, and the file opens on `Chart`.
  - In Chart:
    - the cells look square (24 × 24 px at 100 %) with centred black numbers, and no `###`;
    - tints match the on-screen Chart (a dark color such as `310` is `#B0B0B0`, not black);
    - empty cells are grey and hatched;
    - there are thin grey lines, and bold lines every 10 stitches and at the edge;
    - cell values are numbers (the status bar shows a Sum).
  - Summary shows the three lines, the original photo and the sharp DMC-colors picture, neither stretched.
  - Legend shows numbers, swatches in the real DMC colors, codes without green triangles in Excel, names, and stitch counts with thousands separators. These match the on-screen legend.
  - A pattern with 400+ colors (max colors 489, width 300): no `###` in Excel.
  - Width 800 on a square image: the `Large workbook` dialog appears. `Cancel` and Esc do nothing. `Create workbook` produces a file. Width 1000 (1,000,000 cells): the view pans during creation, the file is ready within 10 s and under 8 MB, and it opens in both programs.
  - Width 2000: the refusal message appears in the status line and nothing is downloaded.
  - Load a new image during an export: the newer status is kept. Export works again afterwards. No console errors.
- [ ] 9.4 Run `openspec validate add-excel-export --strict`; it passes
