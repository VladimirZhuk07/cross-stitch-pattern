// The page map of the PDF: which chart page shows which columns and rows. Pure.
// Up to 15 × 25 chart pages it is a diagram on the info page (one numbered tile per page, the
// column ranges above and the row ranges left of the tiles); larger grids get a table on extra
// pages instead, because their tiles would be too small to label legibly (design D6).

import { CHART_PAGE_COLUMNS, CHART_PAGE_ROWS, MAP_ENTRIES_PER_PAGE, chartPageArea } from './pdf-page-plan.js';
import { CAP_HEIGHT, FONT_BOLD, FONT_REGULAR } from './pdf-text.js';
import { POINTS_PER_MM, lineWidth, rect, strokeColor, textAt } from './pdf-content.js';

// The diagram's area on the info page (mm): x 10–200, y 173–287, with a 15 mm header for the
// row ranges and a 5 mm header for the column ranges.
const MAP_LEFT_MM = 10;
const MAP_TOP_MM = 173;
const ROW_HEADER_MM = 15;
const COLUMN_HEADER_MM = 5;
const TILE_AREA = { left: MAP_LEFT_MM + ROW_HEADER_MM, top: MAP_TOP_MM + COLUMN_HEADER_MM, width: 175, height: 109 };
const MAX_TILE_WIDTH_MM = 25;
const MAX_TILE_HEIGHT_MM = 16;
const TILE_BORDER_WIDTH = 0.5;
const TILE_NUMBER_SIZE = 7;
const RANGE_SIZE = 6;
const COLUMN_RANGE_GAP_MM = 1.2;
const ROW_RANGE_GAP_MM = 1.5;

// The table pages: 4 blocks of 56 lines in 8 pt; columns Page, Columns and Rows per block.
const TABLE_HEADING_SIZE = 12;
const TABLE_HEADING_BASELINE_MM = 18;
const TABLE_TEXT_SIZE = 8;
const TABLE_COLUMN_HEADING_BASELINE_MM = 26;
const TABLE_FIRST_LINE_MM = 31;
const TABLE_LINE_PITCH_MM = 4.5;
const TABLE_BLOCKS = 4;
const TABLE_LINES_PER_BLOCK = MAP_ENTRIES_PER_PAGE / TABLE_BLOCKS;
const TABLE_BLOCK_WIDTH_MM = 47.5;
const TABLE_COLUMNS = [['Page', 0], ['Columns', 10], ['Rows', 28]];

/** The line under the 'Page map' heading of the info page when the diagram is shown. */
export const PAGE_MAP_NOTE =
  `Each chart page shows up to ${CHART_PAGE_COLUMNS} columns × ${CHART_PAGE_ROWS} rows. Info and legend pages are not numbered.`;

/**
 * The page map diagram (content stream text) for the info page of a Pattern with its
 * PdfPagePlan (./pdf-page-plan.js); only for plan.isMapOnInfoPage. Tiles are uniform, not to
 * scale, so a short last page column still has room for its label.
 */
export function pageMapDiagram(pattern, plan) {
  const tileWidth = Math.min(MAX_TILE_WIDTH_MM, TILE_AREA.width / plan.pagesAcross);
  const tileHeight = Math.min(MAX_TILE_HEIGHT_MM, TILE_AREA.height / plan.pagesDown);
  const borders = [];
  const texts = [];
  for (let pageNumber = 1; pageNumber <= plan.chartPages; pageNumber++) {
    const left = TILE_AREA.left + ((pageNumber - 1) % plan.pagesAcross) * tileWidth;
    const top = TILE_AREA.top + Math.floor((pageNumber - 1) / plan.pagesAcross) * tileHeight;
    borders.push(`${rect(left, top, tileWidth, tileHeight)} S`);
    const baseline = top + tileHeight / 2 + capMiddle(TILE_NUMBER_SIZE);
    texts.push(textAt(String(pageNumber), FONT_REGULAR, TILE_NUMBER_SIZE, left + tileWidth / 2, baseline, 'center'));
  }
  for (let pageColumn = 0; pageColumn < plan.pagesAcross; pageColumn++) {
    const area = chartPageArea(plan, pattern, pageColumn + 1);
    const centre = TILE_AREA.left + (pageColumn + 0.5) * tileWidth;
    const range = formatRange(area.columnStart, area.columnEnd);
    texts.push(textAt(range, FONT_REGULAR, RANGE_SIZE, centre, TILE_AREA.top - COLUMN_RANGE_GAP_MM, 'center'));
  }
  for (let pageRow = 0; pageRow < plan.pagesDown; pageRow++) {
    const area = chartPageArea(plan, pattern, pageRow * plan.pagesAcross + 1);
    const baseline = TILE_AREA.top + (pageRow + 0.5) * tileHeight + capMiddle(RANGE_SIZE);
    const range = formatRange(area.rowStart, area.rowEnd);
    texts.push(textAt(range, FONT_REGULAR, RANGE_SIZE, TILE_AREA.left - ROW_RANGE_GAP_MM, baseline, 'right'));
  }
  return [`${lineWidth(TILE_BORDER_WIDTH)} ${strokeColor('#000000')}`, ...borders, '0 g', ...texts].join('\n');
}

/**
 * The content streams of the page map table pages of a Pattern with its PdfPagePlan, one per
 * page (plan.mapPages of them; none when the map fits the info page). Each lists up to 224
 * chart pages as page number, column range and row range, under 'Page map' or
 * 'Page map (continued)'.
 */
export function pageMapTablePages(pattern, plan) {
  const pages = [];
  for (let pageIndex = 0; pageIndex < plan.mapPages; pageIndex++) {
    const heading = pageIndex === 0 ? 'Page map' : 'Page map (continued)';
    const lines = ['0 g', textAt(heading, FONT_BOLD, TABLE_HEADING_SIZE, MAP_LEFT_MM, TABLE_HEADING_BASELINE_MM)];
    for (let block = 0; block < TABLE_BLOCKS; block++) {
      for (const [text, offset] of TABLE_COLUMNS) {
        lines.push(textAt(text, FONT_BOLD, TABLE_TEXT_SIZE, blockLeft(block) + offset, TABLE_COLUMN_HEADING_BASELINE_MM));
      }
    }
    const first = pageIndex * MAP_ENTRIES_PER_PAGE + 1;
    const last = Math.min(plan.chartPages, first + MAP_ENTRIES_PER_PAGE - 1);
    for (let pageNumber = first; pageNumber <= last; pageNumber++) {
      lines.push(tableEntry(pattern, plan, pageNumber, pageNumber - first));
    }
    pages.push(lines.join('\n'));
  }
  return pages;
}

function tableEntry(pattern, plan, pageNumber, slot) {
  const area = chartPageArea(plan, pattern, pageNumber);
  const left = blockLeft(Math.floor(slot / TABLE_LINES_PER_BLOCK));
  const baseline = TABLE_FIRST_LINE_MM + (slot % TABLE_LINES_PER_BLOCK) * TABLE_LINE_PITCH_MM;
  const values = [String(pageNumber), formatRange(area.columnStart, area.columnEnd), formatRange(area.rowStart, area.rowEnd)];
  return values
    .map((value, index) => textAt(value, FONT_REGULAR, TABLE_TEXT_SIZE, left + TABLE_COLUMNS[index][1], baseline))
    .join('\n');
}

function blockLeft(block) {
  return MAP_LEFT_MM + block * TABLE_BLOCK_WIDTH_MM;
}

// A half-open 0-based range as the 1-based text '51–100'.
function formatRange(start, end) {
  return `${start + 1}–${end}`;
}

// How far below a line's middle a baseline goes so the capitals are centred on it (mm).
function capMiddle(size) {
  return ((CAP_HEIGHT / 2) * size) / POINTS_PER_MM;
}
