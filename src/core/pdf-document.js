// Assembles the PDF chart of a pattern into the bytes of one PDF 1.4 file: info page, page map
// pages, legend pages and chart pages (design D2 and D8 of add-pdf-export). Pure apart from the
// platform's CompressionStream, used through ./compression.js.

import { canCompress, compressBytes } from './compression.js';
import { asciiBytes, createPdfWriter } from './pdf-writer.js';
import { pdfTextString } from './pdf-text.js';
import { readJpegInfo } from './pdf-pictures.js';
import { MAX_PDF_PAGES, isPdfTooLarge, planPdfPages } from './pdf-page-plan.js';
import { DMC_PICTURE_NAME, ORIGINAL_PICTURE_NAME, infoPageContent } from './pdf-info-page.js';
import { pageMapTablePages } from './pdf-page-map.js';
import { legendPageContents } from './pdf-legend-pages.js';
import { chartPageContent, legendTints } from './pdf-chart-page.js';

/** The /Creator of every PDF. */
export const PDF_CREATOR = 'Cross-Stitch Pattern Maker';

// A4 portrait in points, shared by every page through the page tree.
const MEDIA_BOX = '[0 0 595.28 841.89]';
const COUNT_FORMAT = new Intl.NumberFormat('en-US');

/**
 * Builds the PDF of a pattern. Resolves to the file as a Uint8Array.
 * input    { pattern, fileName, fabricCount, pictures: { original, dmc } }: the Pattern
 *          (./pattern.js), the image file name (page texts and the document title), stitches per
 *          inch, and the two pictures as JPEG bytes (Uint8Array), embedded as they are
 * options  { isCompressed, onProgress }:
 *          isCompressed  deflate page contents (/FlateDecode); default canCompress()
 *          onProgress    called after each page with { done, total } in pages
 * The same input always gives the same bytes (no date, no random ID). Rejects with RangeError
 * above MAX_PDF_PAGES pages before any page is written, and with TypeError when a picture is
 * not a JPEG the PDF can embed (see readJpegInfo).
 */
export async function buildPdfDocument(input, { isCompressed = canCompress(), onProgress = () => {} } = {}) {
  const { pattern, fileName, fabricCount, pictures } = input;
  const plan = planPdfPages(pattern);
  if (isPdfTooLarge(plan)) {
    throw new RangeError(
      `the PDF would have ${COUNT_FORMAT.format(plan.totalPages)} pages, more than ${COUNT_FORMAT.format(MAX_PDF_PAGES)}`,
    );
  }
  const originalInfo = readJpegInfo(pictures.original);
  const dmcInfo = readJpegInfo(pictures.dmc);

  const writer = createPdfWriter();
  const catalog = writer.reserve();
  const pageTree = writer.reserve();
  const regular = writer.addObject(fontDictionary('Helvetica'));
  const bold = writer.addObject(fontDictionary('Helvetica-Bold'));
  const info = writer.addObject(`<< /Title ${pdfTextString(fileName)} /Creator (${PDF_CREATOR}) >>`);
  const original = writer.addStream(imageDictionary(originalInfo), pictures.original);
  const dmc = writer.addStream(imageDictionary(dmcInfo), pictures.dmc);
  const resources = writer.addObject(
    `<< /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> ` +
    `/XObject << /${ORIGINAL_PICTURE_NAME} ${original} 0 R /${DMC_PICTURE_NAME} ${dmc} 0 R >> >>`,
  );

  const pageObjects = [];
  const addPage = async (content) => {
    const bytes = asciiBytes(content);
    const stream = isCompressed
      ? writer.addStream('/Filter /FlateDecode', await compressBytes(bytes, 'deflate'))
      : writer.addStream('', bytes);
    pageObjects.push(writer.addObject(
      `<< /Type /Page /Parent ${pageTree} 0 R /Resources ${resources} 0 R /Contents ${stream} 0 R >>`,
    ));
    onProgress({ done: pageObjects.length, total: plan.totalPages });
  };

  const pictureSizes = { original: originalInfo, dmc: dmcInfo };
  await addPage(infoPageContent({ pattern, plan, fileName, fabricCount, pictures: pictureSizes }));
  for (const content of pageMapTablePages(pattern, plan)) {
    await addPage(content);
  }
  for (const content of legendPageContents(pattern)) {
    await addPage(content);
  }
  const tints = legendTints(pattern);
  for (let pageNumber = 1; pageNumber <= plan.chartPages; pageNumber++) {
    await addPage(chartPageContent(pattern, plan, pageNumber, fileName, tints));
  }

  const kids = pageObjects.map((number) => `${number} 0 R`).join(' ');
  writer.addObject(`<< /Type /Pages /Kids [${kids}] /Count ${pageObjects.length} /MediaBox ${MEDIA_BOX} >>`, pageTree);
  writer.addObject(`<< /Type /Catalog /Pages ${pageTree} 0 R >>`, catalog);
  return writer.finish({ root: catalog, info });
}

// A standard Type 1 font: every viewer supplies it, so nothing is embedded.
function fontDictionary(baseFont) {
  return `<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} /Encoding /WinAnsiEncoding >>`;
}

// A JPEG embedded as it is; size and color space come from its own header bytes.
function imageDictionary(jpeg) {
  const colorSpace = jpeg.components === 1 ? '/DeviceGray' : '/DeviceRGB';
  return `/Type /XObject /Subtype /Image /Width ${jpeg.width} /Height ${jpeg.height} ` +
    `/ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode`;
}
