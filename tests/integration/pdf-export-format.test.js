// Integration test of the PDF export format: the 120 × 90 PDF as built for the browser (with
// the shared compression module), read back with node:zlib and tests/helpers/pdf-reader.js.

import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readContent, readPdf, streamText } from '../helpers/pdf-reader.js';
import { fakeJpeg } from '../helpers/fake-jpeg.js';
import { buildPattern } from '../../src/core/pattern.js';
import { buildPdfDocument } from '../../src/core/pdf-document.js';

// Test fixtures, not palette data.
const COLORS = [
  { code: '310', name: 'Black', hex: '#000000' },
  { code: '321', name: 'Red', hex: '#C72B3B' },
  { code: '820', name: 'Royal Blue VY DK', hex: '#0E365C' },
];

function catInput() {
  const cells = Array.from({ length: 120 * 90 }, (_, index) => (index % 120 + Math.floor(index / 120)) % 3);
  return {
    pattern: buildPattern({ width: 120, height: 90, cells, colors: COLORS }),
    fileName: 'cat.png',
    fabricCount: 14,
    pictures: { original: fakeJpeg(1200, 900), dmc: fakeJpeg(1200, 900) },
  };
}

function pageStreams(pdf) {
  const tree = [...pdf.objects.values()].find((object) => object.dict.includes('/Type /Pages'));
  const kids = [...tree.dict.matchAll(/(\d+) 0 R/g)].map((match) => Number(match[1]));
  return kids.map((number) => pdf.objects.get(Number(/\/Contents (\d+) 0 R/.exec(pdf.objects.get(number).dict)[1])));
}

describe('PDF export format (120 × 90, compressed)', () => {
  let bytes;
  let pdf;

  before(async () => {
    bytes = await buildPdfDocument(catInput());
    pdf = readPdf(bytes);
  });

  it('starts with %PDF-1.4 and ends with %%EOF', () => {
    assert.equal(pdf.header, '%PDF-1.4');
    assert.ok(pdf.text.endsWith('%%EOF\n'));
  });

  it('points startxref at the xref table and every offset at its object', () => {
    assert.ok(pdf.text.startsWith('xref\n', pdf.startxref));
    for (const entry of pdf.entries.filter((item) => item.isInUse)) {
      assert.ok(pdf.text.startsWith(`${entry.number} 0 obj\n`, entry.offset), `object ${entry.number}`);
    }
  });

  it('names the object count plus one as /Size and the catalog as /Root', () => {
    const size = Number(/\/Size (\d+)/.exec(pdf.trailer)[1]);
    assert.equal(size, pdf.objects.size + 1);
    const root = Number(/\/Root (\d+) 0 R/.exec(pdf.trailer)[1]);
    assert.match(pdf.objects.get(root).dict, /\/Type \/Catalog/);
  });

  it('compresses every page stream with FlateDecode, inflating to the drawing operators', () => {
    const streams = pageStreams(pdf);
    assert.equal(streams.length, 8);
    for (const stream of streams) {
      assert.match(stream.dict, /\/Filter \/FlateDecode/);
      assert.ok(stream.rawStream.length < stream.stream.length, 'smaller than its content');
    }
    const chartPage1 = readContent(streamText(streams[2].stream));
    assert.equal(chartPage1.texts.filter((text) => text.size === 4.08).length, 4000);
    assert.ok(chartPage1.texts.some((text) => text.text === 'Page 1 of 6'));
  });

  it('gives the same bytes for the same input', async () => {
    const again = await buildPdfDocument(catInput());
    assert.deepEqual(again, bytes);
  });

  it('writes a valid, larger file without compression and without page filters', async () => {
    const plain = await buildPdfDocument(catInput(), { isCompressed: false });
    const plainPdf = readPdf(plain);
    assert.ok(plain.length > bytes.length, `${plain.length} > ${bytes.length}`);
    for (const stream of pageStreams(plainPdf)) {
      assert.ok(!stream.dict.includes('/Filter'));
    }
    assert.deepEqual(pageStreams(plainPdf).map((stream) => streamText(stream.stream)), pageStreams(pdf).map((stream) => streamText(stream.stream)));
  });
});
