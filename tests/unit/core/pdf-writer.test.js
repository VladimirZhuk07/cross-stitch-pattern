// Unit tests for src/core/pdf-writer.js, read back with tests/helpers/pdf-reader.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { asciiBytes, createPdfWriter, pdfNumber } from '../../../src/core/pdf-writer.js';
import { readPdf, streamText } from '../../helpers/pdf-reader.js';

const ascii = (text) => new TextEncoder().encode(text);

describe('pdfNumber', () => {
  it('writes fixed-point numbers with at most 2 decimals and no trailing zeros', () => {
    assert.equal(pdfNumber(85.03937), '85.04');
    assert.equal(pdfNumber(2.5), '2.5');
    assert.equal(pdfNumber(3), '3');
    assert.equal(pdfNumber(-12.345), '-12.35');
  });

  it('turns negative zero into 0', () => {
    assert.equal(pdfNumber(-0.001), '0');
    assert.equal(pdfNumber(-0), '0');
  });

  it('takes the number of decimals', () => {
    assert.equal(pdfNumber(0.69019, 3), '0.69');
    assert.equal(pdfNumber(0.7529, 3), '0.753');
  });

  it('never writes an exponent', () => {
    assert.equal(pdfNumber(123456789.5), '123456789.5');
    assert.equal(pdfNumber(1e-7), '0');
  });

  it('rejects values that are not finite', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      assert.throws(() => pdfNumber(value), RangeError, String(value));
    }
  });
});

describe('createPdfWriter', () => {
  function smallPdf() {
    const writer = createPdfWriter();
    const catalog = writer.reserve();
    const pages = writer.reserve();
    const info = writer.addObject('<< /Title (t) >>');
    const content = writer.addStream('', ascii('0 0 10 10 re f'));
    const page = writer.addObject(`<< /Type /Page /Parent ${pages} 0 R /Contents ${content} 0 R >>`);
    writer.addObject(`<< /Type /Pages /Kids [${page} 0 R] /Count 1 /MediaBox [0 0 595.28 841.89] >>`, pages);
    writer.addObject(`<< /Type /Catalog /Pages ${pages} 0 R >>`, catalog);
    return { bytes: writer.finish({ root: catalog, info }), catalog, info, content };
  }

  it('starts with the PDF 1.4 header and a binary comment', () => {
    const { bytes } = smallPdf();
    assert.equal(readPdf(bytes).header, '%PDF-1.4');
    assert.deepEqual([...bytes.slice(9, 15)], [0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
  });

  it('writes 20-byte xref lines whose offsets point at their objects', () => {
    const pdf = readPdf(smallPdf().bytes);
    assert.equal(pdf.xrefLines.length, 6);
    assert.equal(pdf.xrefLines[0], '0000000000 65535 f\r\n');
    for (const line of pdf.xrefLines) {
      assert.equal(line.length, 20);
    }
    for (const entry of pdf.entries.slice(1)) {
      assert.ok(pdf.text.startsWith(`${entry.number} 0 obj\n`, entry.offset), `object ${entry.number}`);
    }
  });

  it('writes the trailer with /Size, /Root and /Info', () => {
    const { bytes, catalog, info } = smallPdf();
    const pdf = readPdf(bytes);
    assert.match(pdf.trailer, /\/Size 6\b/);
    assert.match(pdf.trailer, new RegExp(`/Root ${catalog} 0 R`));
    assert.match(pdf.trailer, new RegExp(`/Info ${info} 0 R`));
  });

  it('counts the objects of a writer with 3 objects and one stream as /Size 5', () => {
    const writer = createPdfWriter();
    const first = writer.addObject('<< /Type /Catalog >>');
    writer.addObject('<< >>');
    const info = writer.addObject('<< /Title (x) >>');
    writer.addStream('/Subtype /Test', ascii('abc'));
    const pdf = readPdf(writer.finish({ root: first, info }));
    assert.match(pdf.trailer, /\/Size 5\b/);
    assert.equal(pdf.objects.size, 4);
  });

  it('ends with startxref, the xref offset and %%EOF', () => {
    const { bytes } = smallPdf();
    const pdf = readPdf(bytes);
    assert.ok(pdf.text.endsWith(`startxref\n${pdf.startxref}\n%%EOF\n`));
    assert.ok(pdf.text.startsWith('xref\n', pdf.startxref));
  });

  it('writes stream objects with /Length and the bytes as given', () => {
    const { bytes, content } = smallPdf();
    const object = readPdf(bytes).objects.get(content);
    assert.match(object.dict, /\/Length 14\b/);
    assert.equal(streamText(object.stream), '0 0 10 10 re f');
  });

  it('hands out object numbers from 1 in order', () => {
    const writer = createPdfWriter();
    assert.equal(writer.reserve(), 1);
    assert.equal(writer.addObject('<< >>'), 2);
    assert.equal(writer.addStream('', ascii('')), 3);
    assert.equal(writer.addObject('<< >>', 1), 1);
  });

  it('refuses to finish while a reserved number was never written', () => {
    const writer = createPdfWriter();
    const root = writer.reserve();
    const info = writer.addObject('<< >>');
    assert.throws(() => writer.finish({ root, info }), /object 1 was reserved but never written/);
  });

  it('refuses to write a number twice or one never handed out', () => {
    const writer = createPdfWriter();
    const number = writer.addObject('<< >>');
    assert.throws(() => writer.addObject('<< >>', number), Error);
    assert.throws(() => writer.addObject('<< >>', 7), Error);
  });

  it('refuses text that is not ASCII', () => {
    const writer = createPdfWriter();
    assert.throws(() => writer.addObject('<< /Title (é) >>'), RangeError);
  });
});

describe('asciiBytes', () => {
  it('turns ASCII text into one byte per character', () => {
    assert.deepEqual([...asciiBytes('1 0 obj')], [0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a]);
  });

  it('rejects other characters', () => {
    assert.throws(() => asciiBytes('a×b'), /U\+D7 at 1/);
  });
});
