// Size limits of the Excel export and its user-facing texts. Pure.
// Thresholds and their reasons: design D10 of add-excel-export.

const COUNT_FORMAT = new Intl.NumberFormat('en-US');

/** Above this many chart cells (empty cells included) the user is asked first. */
export const XLSX_CONFIRM_CELLS = 250_000;

/** Above this many chart cells no workbook is created. */
export const XLSX_MAX_CELLS = 1_000_000;

/** Status text while the workbook is created. */
export const CREATING_WORKBOOK_TEXT = 'Creating Excel workbook…';

/**
 * How the export treats a pattern of size { width, height } (stitches): 'ok' (just export),
 * 'confirm' (ask first) or 'too-large' (refuse). Every cell counts, because each is written.
 */
export function workbookSizeCheck(size) {
  const cellCount = size.width * size.height;
  if (cellCount > XLSX_MAX_CELLS) {
    return 'too-large';
  }
  return cellCount > XLSX_CONFIRM_CELLS ? 'confirm' : 'ok';
}

/** The question of the Large workbook dialog for a pattern of size { width, height }. */
export function formatLargeWorkbookQuestion(size) {
  return `This workbook will have ${COUNT_FORMAT.format(size.width * size.height)} chart cells `
    + `(${size.width} × ${size.height}). Large workbooks take longer to create and open slowly in spreadsheet programs.`;
}

/** The error shown instead of exporting a pattern of size { width, height } above the cap. */
export function formatWorkbookTooLarge(size) {
  return `This pattern is too large for an Excel workbook: ${COUNT_FORMAT.format(size.width * size.height)} cells `
    + `(${size.width} × ${size.height}), at most ${COUNT_FORMAT.format(XLSX_MAX_CELLS)}. Choose a smaller width.`;
}

/** Status text after the workbook fileName (e.g. 'cat.xlsx') was handed to the download. */
export function formatWorkbookReady(fileName) {
  return `Excel workbook ready: ${fileName}`;
}

/** Status text when creating the workbook failed; reason is the error message. */
export function formatWorkbookError(reason) {
  return `Could not create the Excel workbook: ${reason}`;
}
