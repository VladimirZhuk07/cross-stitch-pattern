// Unit tests for src/core/pdf-document.js: whole documents built without compression and read
// back with tests/helpers/pdf-reader.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readPdf, streamText } from '../../helpers/pdf-reader.js';
import { fakeJpeg } from '../../helpers/fake-jpeg.js';
import { buildPattern } from '../../../src/core/pattern.js';
import { pdfTextString } from '../../../src/core/pdf-text.js';
import { buildPdfDocument } from '../../../src/core/pdf-document.js';

// Test fixtures, not palette data.
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const BLUE = { code: '820', name: 'Royal Blue VY DK', hex: '#0E365C' };

function patternOfSize(width, height) {
  const cells = Array.from({ length: width * height }, (_, index) => (index % width + Math.floor(index / width)) % 3);
  return buildPattern({ width, height, cells, colors: [BLACK, RED, BLUE] });
}

function input(pattern = patternOfSize(120, 90), fileName = 'cat.png') {
  return { pattern, fileName, fabricCount: 14, pictures: { original: fakeJpeg(1200, 900), dmc: fakeJpeg(1200, 900) } };
}

// The objects whose dictionary contains text, in object number order.
function objectsWith(pdf, text) {
  return [...pdf.objects.values()].filter((object) => object.dict.includes(text));
}

function pageContents(pdf) {
  const tree = objectsWith(pdf, '/Type /Pages')[0];
  const kids = [...tree.dict.matchAll(/(\d+) 0 R/g)].map((match) => Number(match[1]));
  return kids.map((number) => {
    const page = pdf.objects.get(number);
    const contents = Number(/\/Contents (\d+) 0 R/.exec(page.dict)[1]);
    return streamText(pdf.objects.get(contents).stream);
  });
}

describe('buildPdfDocument', () => {
  it('orders the 8 pages of 120 × 90 as info, legend and 6 chart pages', async () => {
    const pdf = readPdf(await buildPdfDocument(input(), { isCompressed: false }));
    assert.match(objectsWith(pdf, '/Type /Pages')[0].dict, /\/Count 8\b/);
    const contents = pageContents(pdf);
    assert.equal(contents.length, 8);
    assert.ok(contents[0].includes('(Cross-stitch pattern)'));
    assert.ok(contents[1].includes('(Legend)'));
    for (let chartPage = 1; chartPage <= 6; chartPage++) {
      assert.ok(contents[chartPage + 1].includes(`(Page ${chartPage} of 6)`), `chart page ${chartPage}`);
    }
  });

  it('puts the page map pages between the info page and the legend', async () => {
    const pattern = buildPattern({ width: 751, height: 1, cells: new Int16Array(751), colors: [RED] });
    const pdf = readPdf(await buildPdfDocument(input(pattern), { isCompressed: false }));
    const contents = pageContents(pdf);
    assert.equal(contents.length, 1 + 1 + 1 + 16);
    assert.ok(contents[1].includes('(Page map)'));
    assert.ok(contents[2].includes('(Legend)'));
  });

  it('uses Helvetica and Helvetica-Bold with WinAnsiEncoding and embeds no font', async () => {
    const pdf = readPdf(await buildPdfDocument(input(), { isCompressed: false }));
    const fonts = objectsWith(pdf, '/Type /Font');
    assert.equal(fonts.length, 2);
    assert.match(fonts[0].dict, /\/Subtype \/Type1 \/BaseFont \/Helvetica \/Encoding \/WinAnsiEncoding/);
    assert.match(fonts[1].dict, /\/Subtype \/Type1 \/BaseFont \/Helvetica-Bold \/Encoding \/WinAnsiEncoding/);
    assert.ok(!pdf.text.includes('/FontFile'));
  });

  it('embeds both pictures as DCTDecode images of their JPEG size', async () => {
    const document = input();
    document.pictures.dmc = fakeJpeg(1200, 804);
    const pdf = readPdf(await buildPdfDocument(document, { isCompressed: false }));
    const images = objectsWith(pdf, '/Subtype /Image');
    assert.equal(images.length, 2);
    assert.match(images[0].dict, /\/Width 1200 \/Height 900 .*\/Filter \/DCTDecode/);
    assert.match(images[1].dict, /\/Width 1200 \/Height 804 .*\/Filter \/DCTDecode/);
    assert.match(images[0].dict, /\/ColorSpace \/DeviceRGB/);
    assert.deepEqual(images[1].stream, document.pictures.dmc);
  });

  it('names the pictures and fonts in one shared Resources dictionary', async () => {
    const pdf = readPdf(await buildPdfDocument(input(), { isCompressed: false }));
    const pages = objectsWith(pdf, '/Type /Page ');
    const resources = new Set(pages.map((page) => /\/Resources (\d+) 0 R/.exec(page.dict)[1]));
    assert.equal(resources.size, 1);
    const shared = pdf.objects.get(Number([...resources][0])).dict;
    assert.match(shared, /\/Font << \/F1 \d+ 0 R \/F2 \d+ 0 R >>/);
    assert.match(shared, /\/XObject << \/Im1 \d+ 0 R \/Im2 \d+ 0 R >>/);
  });

  it('keeps the full file name in the UTF-16 title', async () => {
    const pdf = readPdf(await buildPdfDocument(input(patternOfSize(3, 2), 'Ёлка.png'), { isCompressed: false }));
    const info = pdf.objects.get(Number(/\/Info (\d+) 0 R/.exec(pdf.trailer)[1]));
    assert.ok(info.dict.includes(`/Title ${pdfTextString('Ёлка.png')}`), info.dict);
    assert.ok(info.dict.includes('/Creator (Cross-Stitch Pattern Maker)'));
    assert.ok(pageContents(pdf)[0].includes('(????.png)'));
  });

  it('reports progress once per page, ending at 8 of 8', async () => {
    const progress = [];
    await buildPdfDocument(input(), { isCompressed: false, onProgress: (step) => progress.push(step) });
    assert.equal(progress.length, 8);
    assert.deepEqual(progress[0], { done: 1, total: 8 });
    assert.deepEqual(progress.at(-1), { done: 8, total: 8 });
  });

  it('refuses more than 1,000 pages before any work', async () => {
    const pattern = { width: 2000, height: 2000, cells: new Int16Array(0), legend: [] };
    let calls = 0;
    await assert.rejects(
      buildPdfDocument(input(pattern), { isCompressed: false, onProgress: () => { calls += 1; } }),
      (error) => error instanceof RangeError && error.message.includes('1,007'),
    );
    assert.equal(calls, 0);
  });

  it('rejects a picture that is not a JPEG', async () => {
    const document = input();
    document.pictures.original = new Uint8Array([1, 2, 3]);
    await assert.rejects(buildPdfDocument(document, { isCompressed: false }), TypeError);
  });

  it('writes no page stream filter without compression', async () => {
    const pdf = readPdf(await buildPdfDocument(input(), { isCompressed: false }));
    assert.equal(objectsWith(pdf, '/FlateDecode').length, 0);
  });
});
