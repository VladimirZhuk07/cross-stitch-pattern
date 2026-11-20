// The Summary worksheet (xl/worksheets/sheet2.xml): the pattern facts, then the original picture
// and the pattern in DMC colors under bold captions, placed by a drawing part
// (xl/drawings/drawing1.xml). Pure. Design D7 of add-excel-export.

import { fitInside } from './picture-size.js';
import { BOLD_STYLE } from './xlsx-styles.js';
import {
  XML_DECLARATION,
  SPREADSHEETML_NAMESPACE,
  RELATIONSHIPS_NAMESPACE,
  WORKSHEET_PAGE_MARGINS,
  escapeXml,
  inlineStringCell,
} from './xml.js';

/** Largest displayed side of a picture on the sheet, in px. */
export const SUMMARY_PICTURE_MAX_SIDE = 480;

const ORIGINAL_CAPTION = 'Original picture';
const DMC_CAPTION = 'Pattern in DMC colors';
const FIRST_CAPTION_ROW = 5; // rows 1–3 hold the facts, row 4 stays empty
const DEFAULT_ROW_HEIGHT_PT = 15;
const DEFAULT_ROW_HEIGHT_PX = 20; // 15 pt at 96 dpi
const EMU_PER_PX = 9525; // 914,400 EMU per inch / 96 px per inch
const COLUMN_WIDTHS = [14, 24]; // characters: labels in A, values in B
const DRAWING_NAMESPACE = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const DRAWINGML_NAMESPACE = 'http://schemas.openxmlformats.org/drawingml/2006/main';

// SummaryPicture, created by encodeSummaryPictures (../io/summary-pictures.js):
//   { png: Uint8Array (the PNG file), width, height (its size in px, positive integers) }.
// WorkbookPictures: { original, dmc }, both SummaryPicture.
//
// SummaryLayout, created by summaryLayout: { original, dmc }, each
//   { caption, captionRow, pictureRow (1-based rows), displayWidth, displayHeight (px) }.

/**
 * Where the captions and pictures go for pictures ({ original, dmc } with width and height in
 * px; see WorkbookPictures). Each picture is shown at most 480 × 480 px, never enlarged; the
 * DMC caption follows the rows the original picture covers (default rows of 20 px) plus one.
 * Returns SummaryLayout. Throws RangeError (from fitInside) for non-positive sizes.
 */
export function summaryLayout(pictures) {
  const original = placePicture(ORIGINAL_CAPTION, FIRST_CAPTION_ROW, pictures.original);
  const nextCaptionRow = original.pictureRow + Math.ceil(original.displayHeight / DEFAULT_ROW_HEIGHT_PX) + 1;
  return { original, dmc: placePicture(DMC_CAPTION, nextCaptionRow, pictures.dmc) };
}

function placePicture(caption, captionRow, picture) {
  const display = fitInside(picture, SUMMARY_PICTURE_MAX_SIDE);
  return { caption, captionRow, pictureRow: captionRow + 1, displayWidth: display.width, displayHeight: display.height };
}

/**
 * The Summary sheet's XML. lines  [label, value] text pairs (summaryLines in
 * ./pattern-summary.js), written to rows 1…; layout  SummaryLayout. The sheet refers to its
 * drawing through relationship rId1 (xl/worksheets/_rels/sheet2.xml.rels).
 */
export function summarySheetXml(lines, layout) {
  const rows = lines.map(([label, value], index) => {
    const row = index + 1;
    return `<row r="${row}">${inlineStringCell(`A${row}`, label, BOLD_STYLE)}${inlineStringCell(`B${row}`, value)}</row>`;
  });
  for (const placed of [layout.original, layout.dmc]) {
    const row = placed.captionRow;
    rows.push(`<row r="${row}">${inlineStringCell(`A${row}`, placed.caption, BOLD_STYLE)}</row>`);
  }
  const columns = COLUMN_WIDTHS.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`);
  return `${XML_DECLARATION}<worksheet xmlns="${SPREADSHEETML_NAMESPACE}" xmlns:r="${RELATIONSHIPS_NAMESPACE}">`
    + `<dimension ref="A1:B${layout.dmc.captionRow}"/>`
    + '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
    + `<sheetFormatPr defaultRowHeight="${DEFAULT_ROW_HEIGHT_PT}"/>`
    + `<cols>${columns.join('')}</cols>`
    + `<sheetData>${rows.join('')}</sheetData>`
    + WORKSHEET_PAGE_MARGINS
    + '<drawing r:id="rId1"/></worksheet>';
}

/**
 * The drawing part that shows the two pictures: each a one-cell anchor at column A of its
 * picture row, sized in EMU (9,525 per px). The original refers to image relationship rId1,
 * the DMC picture to rId2 (xl/drawings/_rels/drawing1.xml.rels). layout  SummaryLayout.
 */
export function summaryDrawingXml(layout) {
  const anchors = [
    pictureAnchorXml(layout.original, 2, 'rId1'),
    pictureAnchorXml(layout.dmc, 3, 'rId2'),
  ];
  return `${XML_DECLARATION}<xdr:wsDr xmlns:xdr="${DRAWING_NAMESPACE}" xmlns:a="${DRAWINGML_NAMESPACE}" xmlns:r="${RELATIONSHIPS_NAMESPACE}">`
    + `${anchors.join('')}</xdr:wsDr>`;
}

// shapeId: unique id of the shape in the drawing (1 is reserved for the drawing itself).
function pictureAnchorXml(placed, shapeId, relationshipId) {
  const name = escapeXml(placed.caption);
  return '<xdr:oneCellAnchor>'
    + `<xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${placed.pictureRow - 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
    + `<xdr:ext cx="${placed.displayWidth * EMU_PER_PX}" cy="${placed.displayHeight * EMU_PER_PX}"/>`
    + '<xdr:pic>'
    + `<xdr:nvPicPr><xdr:cNvPr id="${shapeId}" name="${name}" descr="${name}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>`
    + `<xdr:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`
    + '<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>'
    + '</xdr:pic>'
    + '<xdr:clientData/>'
    + '</xdr:oneCellAnchor>';
}
