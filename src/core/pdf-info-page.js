// The content stream of the PDF's first page: title and file name, the original picture and
// the picture in DMC colors side by side, the summary with the finished size, and the page map
// (or a note that it follows on the next pages). Pure; geometry from design D4 and D6.

import { summarizePattern, summaryLines } from './pattern-summary.js';
import { formatFinishedSize } from './generation-settings.js';
import { FONT_BOLD, FONT_REGULAR, fitText } from './pdf-text.js';
import { POINTS_PER_MM, pdfX, pdfY, textAt } from './pdf-content.js';
import { pdfNumber } from './pdf-writer.js';
import { PAGE_MAP_NOTE, pageMapDiagram } from './pdf-page-map.js';

/** The names of the two pictures in the pages' Resources dictionary. */
export const ORIGINAL_PICTURE_NAME = 'Im1';
export const DMC_PICTURE_NAME = 'Im2';

const MARGIN_MM = 10;
const TITLE = 'Cross-stitch pattern';
const TITLE_SIZE = 18;
const TITLE_BASELINE_MM = 17;
const FILE_NAME_SIZE = 11;
const FILE_NAME_BASELINE_MM = 24;
const FILE_NAME_WIDTH = 190 * POINTS_PER_MM;

const CAPTION_SIZE = 9;
const CAPTION_BASELINE_MM = 33;
const PICTURE_BOX_MM = 90;
const PICTURE_TOP_MM = 35;
const ORIGINAL_LEFT_MM = 10;
const DMC_LEFT_MM = 110;

const SUMMARY_SIZE = 10;
const SUMMARY_FIRST_BASELINE_MM = 135;
const SUMMARY_LINE_PITCH_MM = 5.5;
const SUMMARY_VALUE_X_MM = 45;

const MAP_HEADING_SIZE = 12;
const MAP_HEADING_BASELINE_MM = 163;
const MAP_NOTE_SIZE = 9;
const MAP_NOTE_BASELINE_MM = 169;

/**
 * The content stream (ASCII text) of the info page.
 * input  { pattern, plan, fileName, fabricCount, pictures }:
 *   pattern      the Pattern (./pattern.js)
 *   plan         its PdfPagePlan (./pdf-page-plan.js)
 *   fileName     the image file name, shown below the title (cut to 190 mm)
 *   fabricCount  stitches per inch, for the finished size
 *   pictures     { original, dmc }, each { width, height } in px of the embedded JPEGs; they are
 *                drawn as the XObjects ORIGINAL_PICTURE_NAME and DMC_PICTURE_NAME
 */
export function infoPageContent({ pattern, plan, fileName, fabricCount, pictures }) {
  return [
    '0 g',
    textAt(TITLE, FONT_BOLD, TITLE_SIZE, MARGIN_MM, TITLE_BASELINE_MM),
    textAt(fitText(fileName, FONT_REGULAR, FILE_NAME_SIZE, FILE_NAME_WIDTH), FONT_REGULAR, FILE_NAME_SIZE, MARGIN_MM, FILE_NAME_BASELINE_MM),
    textAt('Original', FONT_BOLD, CAPTION_SIZE, ORIGINAL_LEFT_MM, CAPTION_BASELINE_MM),
    textAt('DMC colors', FONT_BOLD, CAPTION_SIZE, DMC_LEFT_MM, CAPTION_BASELINE_MM),
    pictureDrawing(ORIGINAL_PICTURE_NAME, pictures.original, ORIGINAL_LEFT_MM),
    pictureDrawing(DMC_PICTURE_NAME, pictures.dmc, DMC_LEFT_MM),
    summary(pattern, fabricCount),
    pageMapSection(pattern, plan),
  ].join('\n');
}

// Draws a picture fitted into its 90 × 90 mm box by its pixel aspect ratio, centred
// horizontally and top-aligned. An image XObject fills the unit square, so 'cm' scales it.
function pictureDrawing(name, size, boxLeftMm) {
  const scale = PICTURE_BOX_MM / Math.max(size.width, size.height);
  const widthMm = size.width * scale;
  const heightMm = size.height * scale;
  const leftMm = boxLeftMm + (PICTURE_BOX_MM - widthMm) / 2;
  const matrix = [
    widthMm * POINTS_PER_MM, 0, 0, heightMm * POINTS_PER_MM,
    pdfX(leftMm), pdfY(PICTURE_TOP_MM + heightMm),
  ];
  return `q ${matrix.map((value) => pdfNumber(value)).join(' ')} cm /${name} Do Q`;
}

// The shared summary lines (size, stitches, colors) and the finished size on the chosen fabric.
function summary(pattern, fabricCount) {
  const lines = [...summaryLines(summarizePattern(pattern)), ['Finished size', formatFinishedSize(pattern, fabricCount)]];
  const texts = [];
  lines.forEach(([label, value], index) => {
    const baseline = SUMMARY_FIRST_BASELINE_MM + index * SUMMARY_LINE_PITCH_MM;
    texts.push(textAt(label, FONT_BOLD, SUMMARY_SIZE, MARGIN_MM, baseline));
    texts.push(textAt(value, FONT_REGULAR, SUMMARY_SIZE, SUMMARY_VALUE_X_MM, baseline));
  });
  return texts.join('\n');
}

function pageMapSection(pattern, plan) {
  const heading = textAt('Page map', FONT_BOLD, MAP_HEADING_SIZE, MARGIN_MM, MAP_HEADING_BASELINE_MM);
  if (!plan.isMapOnInfoPage) {
    const note = plan.mapPages === 1
      ? 'The page map is on the next page.'
      : `The page map is on the next ${plan.mapPages} pages.`;
    return [heading, textAt(note, FONT_REGULAR, MAP_NOTE_SIZE, MARGIN_MM, MAP_NOTE_BASELINE_MM)].join('\n');
  }
  return [
    heading,
    textAt(PAGE_MAP_NOTE, FONT_REGULAR, MAP_NOTE_SIZE, MARGIN_MM, MAP_NOTE_BASELINE_MM),
    pageMapDiagram(pattern, plan),
  ].join('\n');
}
