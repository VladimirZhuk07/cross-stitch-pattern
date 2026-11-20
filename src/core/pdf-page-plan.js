// The page plan of the PDF chart: how many info, page map, legend and chart pages a pattern
// needs, which stitches each chart page shows, the page limits, and the texts of the export
// dialog. Pure arithmetic, so the dialog knows the page count at once, before any work starts.

/** Stitches per chart page: 50 columns × 80 rows of 3.2 mm cells fill an A4 page. */
export const CHART_PAGE_COLUMNS = 50;
export const CHART_PAGE_ROWS = 80;

/** Above this many pages in total the export asks first. */
export const CONFIRM_PDF_PAGES = 100;
/** Above this many pages in total no PDF is made. */
export const MAX_PDF_PAGES = 1000;

/** The page map stays on the info page up to this many page columns and page rows. */
export const MAX_MAP_PAGES_ACROSS = 15;
export const MAX_MAP_PAGES_DOWN = 25;
/** Chart pages listed per page map page: 4 blocks of 56 lines. */
export const MAP_ENTRIES_PER_PAGE = 224;
/** Legend rows per legend page. */
export const LEGEND_ROWS_PER_PAGE = 50;

/**
 * The PdfPagePlan of a Pattern (src/core/pattern.js; only width, height and legend are read),
 * a plain object shared by the export dialog, the worker and the page modules:
 *   pagesAcross, pagesDown  chart pages per row and per column of pages (ceil(W / 50), ceil(H / 80))
 *   chartPages              pagesAcross × pagesDown
 *   isMapOnInfoPage         true when the page map fits the info page (≤ 15 × 25 pages)
 *   mapPages                0, or the extra page map pages (224 chart pages each)
 *   legendPages             legend pages, 50 colors each, at least 1
 *   totalPages              1 info page + mapPages + legendPages + chartPages
 * Pages come in that order; only chart pages are numbered.
 */
export function planPdfPages(pattern) {
  const pagesAcross = Math.ceil(pattern.width / CHART_PAGE_COLUMNS);
  const pagesDown = Math.ceil(pattern.height / CHART_PAGE_ROWS);
  const chartPages = pagesAcross * pagesDown;
  const isMapOnInfoPage = pagesAcross <= MAX_MAP_PAGES_ACROSS && pagesDown <= MAX_MAP_PAGES_DOWN;
  const mapPages = isMapOnInfoPage ? 0 : Math.ceil(chartPages / MAP_ENTRIES_PER_PAGE);
  const legendPages = Math.max(1, Math.ceil(pattern.legend.length / LEGEND_ROWS_PER_PAGE));
  const totalPages = 1 + mapPages + legendPages + chartPages;
  return { pagesAcross, pagesDown, chartPages, isMapOnInfoPage, mapPages, legendPages, totalPages };
}

/**
 * The stitches on chart page pageNumber (1..plan.chartPages, row-major from the top-left) as
 * half-open, 0-based ranges { columnStart, columnEnd, rowStart, rowEnd }, like CellRange in
 * ./chart-layout.js. The last page column and row may be narrower or shorter.
 * Throws RangeError for another page number.
 */
export function chartPageArea(plan, pattern, pageNumber) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > plan.chartPages) {
    throw new RangeError(`pageNumber must be 1–${plan.chartPages}, got ${pageNumber}`);
  }
  const pageColumn = (pageNumber - 1) % plan.pagesAcross;
  const pageRow = Math.floor((pageNumber - 1) / plan.pagesAcross);
  const columnStart = pageColumn * CHART_PAGE_COLUMNS;
  const rowStart = pageRow * CHART_PAGE_ROWS;
  return {
    columnStart,
    columnEnd: Math.min(pattern.width, columnStart + CHART_PAGE_COLUMNS),
    rowStart,
    rowEnd: Math.min(pattern.height, rowStart + CHART_PAGE_ROWS),
  };
}

// The UI is in English; a fixed locale keeps the texts the same in every browser.
const COUNT_FORMAT = new Intl.NumberFormat('en-US');

/** True when a PdfPagePlan has more than CONFIRM_PDF_PAGES pages, so the export asks first. */
export function needsPdfConfirmation(plan) {
  return plan.totalPages > CONFIRM_PDF_PAGES;
}

/** True when a PdfPagePlan has more than MAX_PDF_PAGES pages, so no PDF is made. */
export function isPdfTooLarge(plan) {
  return plan.totalPages > MAX_PDF_PAGES;
}

/** The dialog text while the PDF of a PdfPagePlan is created. */
export function formatPdfRunning(plan) {
  return `Creating the PDF: ${describePageCounts(plan)}…`;
}

/** The dialog question before a PDF of more than CONFIRM_PDF_PAGES pages is created. */
export function formatPdfConfirm(plan) {
  return `This PDF will have ${describePageCounts(plan)}. Large PDFs take a while to create and print. Create it?`;
}

/** The dialog text for a PdfPagePlan above MAX_PDF_PAGES pages. */
export function formatPdfTooLarge(plan) {
  return `This pattern needs ${COUNT_FORMAT.format(plan.totalPages)} PDF pages, ` +
    `but a PDF can have at most ${COUNT_FORMAT.format(MAX_PDF_PAGES)}. Choose a smaller width to export a PDF.`;
}

/** The dialog text when creating the PDF failed; reason is the error message. */
export function formatPdfError(reason) {
  return `Could not create the PDF: ${reason}`;
}

// '92 pages (90 chart pages)'; one chart page in the singular.
function describePageCounts(plan) {
  const chart = plan.chartPages === 1 ? '1 chart page' : `${COUNT_FORMAT.format(plan.chartPages)} chart pages`;
  return `${COUNT_FORMAT.format(plan.totalPages)} pages (${chart})`;
}
