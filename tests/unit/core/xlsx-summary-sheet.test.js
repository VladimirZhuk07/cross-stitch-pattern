// Unit tests for src/core/xlsx-summary-sheet.js: the Summary worksheet and its drawing with the two
// pictures (openspec/changes/add-excel-export/specs/excel-export/spec.md, design D7).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summaryLines } from '../../../src/core/pattern-summary.js';
import { BOLD_STYLE } from '../../../src/core/xlsx-styles.js';
import { summaryLayout, summarySheetXml, summaryDrawingXml } from '../../../src/core/xlsx-summary-sheet.js';

// A 100 × 67 pattern of a 1600 × 1072 photo: the PNGs are 1024 × 686 and 1000 × 670 px.
const PICTURES = {
  original: { png: new Uint8Array(1), width: 1024, height: 686 },
  dmc: { png: new Uint8Array(1), width: 1000, height: 670 },
};
const LINES = summaryLines({ width: 100, height: 67, totalStitches: 6700, colorCount: 21 });

describe('summaryLayout', () => {
  it('puts each caption above its picture and the DMC picture below the original', () => {
    const layout = summaryLayout(PICTURES);
    assert.deepEqual(layout.original, {
      caption: 'Original picture', captionRow: 5, pictureRow: 6, displayWidth: 480, displayHeight: 322,
    });
    assert.deepEqual(layout.dmc, {
      caption: 'Pattern in DMC colors', captionRow: 24, pictureRow: 25, displayWidth: 480, displayHeight: 322,
    });
  });

  it('never enlarges a small picture', () => {
    const layout = summaryLayout({ original: { width: 300, height: 200 }, dmc: { width: 300, height: 200 } });
    assert.equal(layout.original.displayWidth, 300);
    assert.equal(layout.original.displayHeight, 200);
    assert.equal(layout.dmc.captionRow, 6 + 10 + 1);
  });
});

describe('summarySheetXml', () => {
  const xml = summarySheetXml(LINES, summaryLayout(PICTURES));

  it('writes the summary lines as text with bold labels', () => {
    assert.match(xml, new RegExp(`<c r="A1" s="${BOLD_STYLE}" t="inlineStr"><is><t>Size</t></is></c>`));
    assert.match(xml, /<c r="B1" t="inlineStr"><is><t>100 × 67 stitches<\/t><\/is><\/c>/);
    assert.match(xml, /<c r="A2" s="1" t="inlineStr"><is><t>Stitches<\/t><\/is><\/c><c r="B2" t="inlineStr"><is><t>6,700<\/t><\/is><\/c>/);
    assert.match(xml, /<c r="B3" t="inlineStr"><is><t>21 DMC colors<\/t><\/is><\/c>/);
  });

  it('writes the bold captions in A5 and A24', () => {
    assert.match(xml, /<row r="5"><c r="A5" s="1" t="inlineStr"><is><t>Original picture<\/t><\/is><\/c><\/row>/);
    assert.match(xml, /<row r="24"><c r="A24" s="1" t="inlineStr"><is><t>Pattern in DMC colors<\/t><\/is><\/c><\/row>/);
  });

  it('sets the column widths and refers to the drawing after the page margins', () => {
    assert.match(xml, /<cols><col min="1" max="1" width="14" customWidth="1"\/><col min="2" max="2" width="24" customWidth="1"\/><\/cols>/);
    assert.match(xml, /<pageMargins [^>]*\/><drawing r:id="rId1"\/><\/worksheet>$/);
    assert.match(xml, /xmlns:r="http:\/\/schemas.openxmlformats.org\/officeDocument\/2006\/relationships"/);
  });

  it('writes the worksheet elements in schema order', () => {
    const tags = ['<dimension', '<sheetViews', '<sheetFormatPr', '<cols', '<sheetData', '<pageMargins', '<drawing'];
    const positions = tags.map((tag) => xml.indexOf(tag));
    assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), String(positions));
  });

  it('escapes the texts', () => {
    const escaped = summarySheetXml([['A & B', '<1>']], summaryLayout(PICTURES));
    assert.match(escaped, /<t>A &amp; B<\/t>/);
    assert.match(escaped, /<t>&lt;1&gt;<\/t>/);
  });
});

describe('summaryDrawingXml', () => {
  const xml = summaryDrawingXml(summaryLayout(PICTURES));

  it('anchors each picture at its cell with its display size in EMU', () => {
    const anchors = xml.match(/<xdr:oneCellAnchor>.*?<\/xdr:oneCellAnchor>/g);
    assert.equal(anchors.length, 2);
    assert.match(anchors[0], /<xdr:from><xdr:col>0<\/xdr:col><xdr:colOff>0<\/xdr:colOff><xdr:row>5<\/xdr:row><xdr:rowOff>0<\/xdr:rowOff><\/xdr:from>/);
    assert.match(anchors[1], /<xdr:row>24<\/xdr:row>/);
    for (const anchor of anchors) {
      assert.match(anchor, /<xdr:ext cx="4572000" cy="3067050"\/>/);
      assert.match(anchor, /<a:picLocks noChangeAspect="1"\/>/);
      assert.match(anchor, /<a:stretch><a:fillRect\/><\/a:stretch>/);
      assert.match(anchor, /<a:prstGeom prst="rect"><a:avLst\/><\/a:prstGeom>/);
      assert.match(anchor, /<xdr:clientData\/><\/xdr:oneCellAnchor>$/);
    }
  });

  it('names the pictures after their captions and embeds image relationships rId1 and rId2', () => {
    assert.match(xml, /<xdr:cNvPr id="2" name="Original picture" descr="Original picture"\/>.*<a:blip r:embed="rId1"\/>/);
    assert.match(xml, /<xdr:cNvPr id="3" name="Pattern in DMC colors" descr="Pattern in DMC colors"\/>.*<a:blip r:embed="rId2"\/>/);
  });

  it('starts with the XML declaration and the drawing namespaces', () => {
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'));
    assert.match(xml, /<xdr:wsDr xmlns:xdr="http:\/\/schemas.openxmlformats.org\/drawingml\/2006\/spreadsheetDrawing" xmlns:a="http:\/\/schemas.openxmlformats.org\/drawingml\/2006\/main" xmlns:r="/);
  });
});
