// The content streams of the PDF legend pages: every legend color with its tinted number box,
// swatch, DMC code, name and stitch count, 50 rows per page. Pure. The texts come from
// legendRows (./legend-rows.js), the same as in the legend panel; the geometry is design D4.

import { legendRows } from './legend-rows.js';
import { LEGEND_ROWS_PER_PAGE } from './pdf-page-plan.js';
import { CAP_HEIGHT, FONT_BOLD, FONT_REGULAR, fitText } from './pdf-text.js';
import { POINTS_PER_MM, fillColor, lineWidth, rect, strokeColor, textAt } from './pdf-content.js';

const MARGIN_MM = 10;
const RIGHT_EDGE_MM = 200;
const HEADING_SIZE = 14;
const HEADING_BASELINE_MM = 18;
const COLUMN_HEADING_SIZE = 8;
const COLUMN_HEADING_BASELINE_MM = 26;
const NO_STITCHES_SIZE = 10;
const NO_STITCHES_BASELINE_MM = 34;

const FIRST_ROW_TOP_MM = 28;
const ROW_HEIGHT_MM = 5;
const BOX_HEIGHT_MM = 4;
const BOX_TOP_OFFSET_MM = (ROW_HEIGHT_MM - BOX_HEIGHT_MM) / 2;
const NUMBER_BOX = { x: 10, width: 10 };
const SWATCH = { x: 23, width: 8 };
const CODE_X_MM = 35;
const NAME_X_MM = 52;
const NAME_WIDTH = 115 * POINTS_PER_MM;
const NUMBER_SIZE = 8;
const TEXT_SIZE = 9;
const BORDER_WIDTH = 0.5;
const NUMBER_BOX_BORDER = '#A0A0A0';
const SWATCH_BORDER = '#808080';

const COLUMN_HEADINGS = [
  ['No.', NUMBER_BOX.x],
  ['Color', SWATCH.x],
  ['DMC', CODE_X_MM],
  ['Name', NAME_X_MM],
];

/** The text of the only legend page of a pattern without stitches. */
export const NO_STITCHES_TEXT = 'This pattern has no stitches.';

/**
 * The content streams (ASCII text) of the legend pages of a Pattern (./pattern.js), one per
 * page, in legend number order: LEGEND_ROWS_PER_PAGE rows each, under 'Legend' on the first
 * page and 'Legend (continued)' on the others. A pattern without stitches gets one page with
 * NO_STITCHES_TEXT.
 */
export function legendPageContents(pattern) {
  const rows = legendRows(pattern);
  if (rows.length === 0) {
    return [[heading(0), textAt(NO_STITCHES_TEXT, FONT_REGULAR, NO_STITCHES_SIZE, MARGIN_MM, NO_STITCHES_BASELINE_MM)].join('\n')];
  }
  const pages = [];
  for (let start = 0; start < rows.length; start += LEGEND_ROWS_PER_PAGE) {
    const pageRows = rows.slice(start, start + LEGEND_ROWS_PER_PAGE);
    pages.push([heading(pages.length), columnHeadings(), ...pageRows.map(legendRow)].join('\n'));
  }
  return pages;
}

function heading(pageIndex) {
  const text = pageIndex === 0 ? 'Legend' : 'Legend (continued)';
  return textAt(text, FONT_BOLD, HEADING_SIZE, MARGIN_MM, HEADING_BASELINE_MM);
}

function columnHeadings() {
  const texts = COLUMN_HEADINGS.map(([text, x]) => textAt(text, FONT_BOLD, COLUMN_HEADING_SIZE, x, COLUMN_HEADING_BASELINE_MM));
  texts.push(textAt('Stitches', FONT_BOLD, COLUMN_HEADING_SIZE, RIGHT_EDGE_MM, COLUMN_HEADING_BASELINE_MM, 'right'));
  return texts.join('\n');
}

// One LegendRow (./legend-rows.js) at its place on the page (rowIndex 0..49).
function legendRow(row, rowIndex) {
  const boxTop = FIRST_ROW_TOP_MM + (rowIndex % LEGEND_ROWS_PER_PAGE) * ROW_HEIGHT_MM + BOX_TOP_OFFSET_MM;
  const boxMiddle = boxTop + BOX_HEIGHT_MM / 2;
  const baseline = (size) => boxMiddle + ((CAP_HEIGHT / 2) * size) / POINTS_PER_MM;
  const numberBox = rect(NUMBER_BOX.x, boxTop, NUMBER_BOX.width, BOX_HEIGHT_MM);
  const swatch = rect(SWATCH.x, boxTop, SWATCH.width, BOX_HEIGHT_MM);
  const name = fitText(row.name, FONT_REGULAR, TEXT_SIZE, NAME_WIDTH);
  return [
    `${fillColor(row.tint)} ${numberBox} f`,
    `${fillColor(row.hex)} ${swatch} f`,
    `${lineWidth(BORDER_WIDTH)} ${strokeColor(NUMBER_BOX_BORDER)} ${numberBox} S`,
    `${strokeColor(SWATCH_BORDER)} ${swatch} S`,
    '0 g',
    textAt(row.number, FONT_REGULAR, NUMBER_SIZE, NUMBER_BOX.x + NUMBER_BOX.width / 2, baseline(NUMBER_SIZE), 'center'),
    textAt(row.code, FONT_REGULAR, TEXT_SIZE, CODE_X_MM, baseline(TEXT_SIZE)),
    textAt(name, FONT_REGULAR, TEXT_SIZE, NAME_X_MM, baseline(TEXT_SIZE)),
    textAt(row.stitchCount, FONT_REGULAR, TEXT_SIZE, RIGHT_EDGE_MM, baseline(TEXT_SIZE), 'right'),
  ].join('\n');
}
