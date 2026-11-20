// Export format test of the Excel workbook: pattern → workbookFiles → buildZip (with the real
// shared compression) → unzip with node:zlib, then every part is read back and checked like a
// spreadsheet program would (openspec/changes/add-excel-export/specs/excel-export/spec.md).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { workbookFiles } from '../../src/core/xlsx-package.js';
import { buildZip } from '../../src/core/zip.js';
import { unzip } from '../helpers/unzip.js';
import { checkXml } from '../helpers/xml-check.js';

// Test fixtures, not palette data (the 3 × 2 pattern of the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const PATTERN = buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
// Picture bytes only need to arrive unchanged here; the smoke check uses real PNGs.
const PICTURES = {
  original: { png: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1]), width: 1024, height: 686 },
  dmc: { png: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 2]), width: 1000, height: 670 },
};

const PART_NAMES = [
  '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
  'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml',
  'xl/worksheets/_rels/sheet2.xml.rels', 'xl/drawings/drawing1.xml', 'xl/drawings/_rels/drawing1.xml.rels',
  'xl/media/image1.png', 'xl/media/image2.png',
];

const MEDIUM = 'medium FF000000';
const THIN = 'thin FFA0A0A0';

async function exportWorkbook(pattern, options) {
  return buildZip(workbookFiles(pattern, PICTURES), options);
}

// Unzips a workbook and decodes the XML parts as strict UTF-8.
async function readWorkbook(pattern, options) {
  const { files, methods } = unzip(await exportWorkbook(pattern, options));
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const texts = new Map();
  for (const [name, bytes] of files) {
    if (!name.endsWith('.png')) {
      texts.set(name, decoder.decode(bytes));
    }
  }
  return { files, methods, texts };
}

const attribute = (text, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(text)?.[1];

// The styles part as plain lists, like a spreadsheet program resolves a cell's s attribute.
function parseStyles(xml) {
  const section = (tag) => new RegExp(`<${tag} count="\\d+">(.*?)</${tag}>`).exec(xml)[1];
  const fonts = [...section('fonts').matchAll(/<font>(.*?)<\/font>/g)].map(([, font]) => ({
    isBold: font.includes('<b/>'),
    size: Number(attribute(font, 'val')),
    rgb: /<color rgb="(\w+)"\/>/.exec(font)?.[1] ?? null,
  }));
  const fills = [...section('fills').matchAll(/<fill>(.*?)<\/fill>/g)].map(([, fill]) => /<fgColor rgb="(\w+)"/.exec(fill)?.[1] ?? attribute(fill, 'patternType'));
  const borders = [...section('borders').matchAll(/<border( diagonalUp="1")?>(.*?)<\/border>/g)].map(([, diagonalUp, border]) => {
    const edges = {};
    for (const [, side, style, rgb] of border.matchAll(/<(left|right|top|bottom|diagonal)(?: style="(\w+)")?(?:\/>|><color rgb="(\w+)"\/><\/\1>)/g)) {
      edges[side] = style === undefined ? null : `${style} ${rgb}`;
    }
    return { ...edges, diagonal: diagonalUp === undefined ? null : edges.diagonal };
  });
  const cellXfs = [...section('cellXfs').matchAll(/<xf ([^>]*?)\/?>(?:<alignment ([^>]*)\/><\/xf>)?/g)].map(([, attributes, alignment]) => ({
    numFmtId: Number(attribute(attributes, 'numFmtId')),
    font: fonts[Number(attribute(attributes, 'fontId'))],
    fill: fills[Number(attribute(attributes, 'fillId'))],
    border: borders[Number(attribute(attributes, 'borderId'))],
    horizontal: alignment === undefined ? null : attribute(alignment, 'horizontal'),
    vertical: alignment === undefined ? null : attribute(alignment, 'vertical') ?? null,
  }));
  return { fonts, fills, borders, cellXfs };
}

// The cells of a worksheet by reference: { style, type, value } (value null without one).
function parseCells(sheetXml, styles) {
  const cells = new Map();
  for (const [, reference, s, type, inner] of sheetXml.matchAll(/<c r="([A-Z]+\d+)"(?: s="(\d+)")?(?: t="(\w+)")?(?:\/>|>(.*?)<\/c>)/g)) {
    let value = null;
    if (inner !== undefined) {
      value = type === 'inlineStr' ? /<t[^>]*>(.*?)<\/t>/.exec(inner)[1] : Number(/<v>(.*?)<\/v>/.exec(inner)[1]);
    }
    cells.set(reference, { format: styles.cellXfs[Number(s ?? 0)], type: type ?? null, value });
  }
  return cells;
}

async function chartCellsOf(pattern) {
  const { texts } = await readWorkbook(pattern);
  const styles = parseStyles(texts.get('xl/styles.xml'));
  return parseCells(texts.get('xl/worksheets/sheet1.xml'), styles);
}

// The element names of an XML part that are children of its root, in order.
function rootChildren(xml) {
  const names = checkXml(xml);
  const depthNames = [];
  let depth = 0;
  for (const match of xml.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g)) {
    const [, isEnd, name, isEmpty] = match;
    if (isEnd === '/') {
      depth -= 1;
      continue;
    }
    if (depth === 1) {
      depthNames.push(name);
    }
    if (isEmpty !== '/') {
      depth += 1;
    }
  }
  assert.ok(names.length >= depthNames.length);
  return depthNames;
}

describe('Excel workbook package', () => {
  it('holds exactly the 13 parts, all XML well-formed UTF-8', async () => {
    const { files, texts } = await readWorkbook(PATTERN);
    assert.deepEqual([...files.keys()], PART_NAMES);
    for (const [name, text] of texts) {
      assert.doesNotThrow(() => checkXml(text), name);
      assert.ok(text.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'), name);
    }
    assert.deepEqual(files.get('xl/media/image1.png'), PICTURES.original.png);
    assert.deepEqual(files.get('xl/media/image2.png'), PICTURES.dmc.png);
  });

  it('gives every part a content type and resolves every relationship', async () => {
    const { files, texts } = await readWorkbook(PATTERN);
    const types = texts.get('[Content_Types].xml');
    for (const name of files.keys()) {
      if (name === '[Content_Types].xml') {
        continue;
      }
      const override = types.includes(`<Override PartName="/${name}" `);
      const extension = name.slice(name.lastIndexOf('.') + 1);
      assert.ok(override || types.includes(`<Default Extension="${extension}" `), name);
    }
    for (const [name, text] of texts) {
      if (!name.endsWith('.rels')) {
        continue;
      }
      const folder = name.replace(/_rels\/[^/]*\.rels$/, '');
      for (const [, target] of text.matchAll(/Target="([^"]+)"/g)) {
        const resolved = new URL(target, `http://package/${folder}`).pathname.slice(1);
        assert.ok(files.has(resolved), `${name} → ${resolved}`);
      }
    }
  });

  it('writes the 3 × 2 chart values, tints and the small black font', async () => {
    const cells = await chartCellsOf(PATTERN);
    const values = Object.fromEntries([...cells].map(([reference, cell]) => [reference, cell.value]));
    assert.deepEqual(values, { A1: 2, B1: 1, C1: 1, A2: null, B2: 1, C2: 2 });
    const fills = Object.fromEntries([...cells].map(([reference, cell]) => [reference, cell.format.fill]));
    assert.deepEqual(fills, { A1: 'FFFFC0BB', B1: 'FFB0B0B0', C1: 'FFB0B0B0', A2: 'FFE0E0E0', B2: 'FFB0B0B0', C2: 'FFFFC0BB' });
    for (const [reference, cell] of cells) {
      assert.equal(cell.type, null, `${reference} is a number`);
      assert.deepEqual(cell.format.font, { isBold: false, size: 9, rgb: 'FF000000' }, reference);
      assert.equal(cell.format.horizontal, 'center', reference);
      assert.equal(cell.format.vertical, 'center', reference);
    }
    const a2 = cells.get('A2').format.border;
    assert.deepEqual(a2, { left: MEDIUM, right: THIN, top: null, bottom: MEDIUM, diagonal: 'thin FF909090' });
  });

  it('draws the medium lines of a 23 × 12 chart every 10 stitches and at the edge', async () => {
    const pattern = buildPattern({ width: 23, height: 12, cells: new Array(23 * 12).fill(0), colors: [BLACK] });
    const cells = await chartCellsOf(pattern);
    const columns = 'ABCDEFGHIJKLMNOPQRSTUVW';
    for (let x = 0; x < 23; x++) {
      for (let y = 0; y < 12; y++) {
        const border = cells.get(`${columns[x]}${y + 1}`).format.border;
        const reference = `${columns[x]}${y + 1}`;
        assert.equal(border.right, [9, 19, 22].includes(x) ? MEDIUM : THIN, `${reference} right`);
        assert.equal(border.left, x === 0 ? MEDIUM : null, `${reference} left`);
        assert.equal(border.bottom, [9, 11].includes(y) ? MEDIUM : THIN, `${reference} bottom`);
        assert.equal(border.top, y === 0 ? MEDIUM : null, `${reference} top`);
        assert.equal(border.diagonal, null, `${reference} diagonal`);
      }
    }
  });

  it('tells grey floss from an empty cell', async () => {
    const steelGray = { code: '318', name: 'Steel Gray Light', hex: '#ABABAB' };
    const pattern = buildPattern({ width: 2, height: 1, cells: [0, -1], colors: [steelGray] });
    const cells = await chartCellsOf(pattern);
    assert.equal(cells.get('A1').value, 1);
    assert.equal(cells.get('A1').format.fill, 'FFE1E1E1');
    assert.equal(cells.get('A1').format.border.diagonal, null);
    assert.equal(cells.get('B1').value, null);
    assert.equal(cells.get('B1').format.fill, 'FFE0E0E0');
    assert.equal(cells.get('B1').format.border.diagonal, 'thin FF909090');
  });

  it('writes the Summary texts and anchors the two pictures', async () => {
    const { texts } = await readWorkbook(PATTERN);
    const styles = parseStyles(texts.get('xl/styles.xml'));
    const cells = parseCells(texts.get('xl/worksheets/sheet2.xml'), styles);
    const text = (reference) => cells.get(reference)?.value;
    assert.deepEqual([text('A1'), text('B1'), text('A2'), text('B2'), text('A3'), text('B3')], ['Size', '3 × 2 stitches', 'Stitches', '5', 'Colors', '2 DMC colors']);
    assert.equal(cells.get('A1').format.font.isBold, true);
    assert.equal(cells.get('B1').format.font.isBold, false);
    assert.equal(text('A5'), 'Original picture');
    assert.equal(text('A24'), 'Pattern in DMC colors');
    const drawing = texts.get('xl/drawings/drawing1.xml');
    const anchors = [...drawing.matchAll(/<xdr:row>(\d+)<\/xdr:row>.*?<xdr:ext cx="(\d+)" cy="(\d+)"\/>.*?r:embed="(rId\d)"/g)].map((match) => match.slice(1));
    assert.deepEqual(anchors, [['5', '4572000', '3067050', 'rId1'], ['24', '4572000', '3067050', 'rId2']]);
  });

  it('writes the Legend rows', async () => {
    const { texts } = await readWorkbook(PATTERN);
    const styles = parseStyles(texts.get('xl/styles.xml'));
    const cells = parseCells(texts.get('xl/worksheets/sheet3.xml'), styles);
    const row = (number) => ['A', 'B', 'C', 'D', 'E'].map((column) => cells.get(`${column}${number}`)?.value);
    assert.deepEqual(row(1), ['No.', 'Color', 'DMC', 'Name', 'Stitches']);
    assert.deepEqual(row(2), [1, null, '310', 'Black', 3]);
    assert.deepEqual(row(3), [2, null, '321', 'Red', 2]);
    assert.equal(cells.get('A2').format.fill, 'FFB0B0B0');
    assert.equal(cells.get('B2').format.fill, 'FF000000');
    assert.equal(cells.get('A3').format.fill, 'FFFFC0BB');
    assert.equal(cells.get('B3').format.fill, 'FFC72B3B');
    assert.equal(cells.get('E2').format.numFmtId, 3);
    assert.equal(cells.get('C2').type, 'inlineStr');
  });

  it('writes the elements of every part in schema order', async () => {
    const { texts } = await readWorkbook(PATTERN);
    assert.deepEqual(rootChildren(texts.get('xl/worksheets/sheet1.xml')), ['dimension', 'sheetViews', 'sheetFormatPr', 'cols', 'sheetData', 'pageMargins']);
    assert.deepEqual(rootChildren(texts.get('xl/worksheets/sheet2.xml')), ['dimension', 'sheetViews', 'sheetFormatPr', 'cols', 'sheetData', 'pageMargins', 'drawing']);
    assert.deepEqual(rootChildren(texts.get('xl/worksheets/sheet3.xml')), ['dimension', 'sheetViews', 'sheetFormatPr', 'cols', 'sheetData', 'pageMargins', 'ignoredErrors']);
    assert.deepEqual(rootChildren(texts.get('xl/styles.xml')), ['fonts', 'fills', 'borders', 'cellStyleXfs', 'cellXfs', 'cellStyles']);
    assert.deepEqual(rootChildren(texts.get('xl/workbook.xml')), ['bookViews', 'sheets']);
    for (const border of texts.get('xl/styles.xml').match(/<border[ >].*?<\/border>/g)) {
      assert.deepEqual(rootChildren(border), ['left', 'right', 'top', 'bottom', 'diagonal']);
    }
  });

  it('gives a byte-identical file for the same pattern', async () => {
    assert.deepEqual(await exportWorkbook(PATTERN), await exportWorkbook(PATTERN));
  });

  it('stores every entry without compression and keeps the same parts', async () => {
    const compressed = await readWorkbook(PATTERN);
    const stored = await readWorkbook(PATTERN, { useCompression: false });
    assert.ok([...stored.methods.values()].every((method) => method === 0));
    assert.equal(compressed.methods.get('xl/worksheets/sheet1.xml'), 8);
    assert.equal(compressed.methods.get('xl/media/image1.png'), 0);
    assert.deepEqual(stored.files, compressed.files);
  });
});

describe('the checks used above', () => {
  it('unzip rejects a damaged entry', async () => {
    const archive = await buildZip([{ name: 'a.xml', content: ['<a>hello</a>'], shouldCompress: false }]);
    archive[30 + 'a.xml'.length] ^= 1; // first data byte
    assert.throws(() => unzip(archive), /a\.xml: CRC-32/);
  });

  it('checkXml rejects malformed XML and returns the element names', () => {
    assert.deepEqual(checkXml('<?xml version="1.0"?><a x="1"><b/>t &amp; u</a>'), ['a', 'b']);
    for (const bad of ['<a><b></a>', '<a x="1" x="2"/>', '<a>&nbsp;</a>', '<a/><b/>', '<a>\u0001</a>', '<a']) {
      assert.throws(() => checkXml(bad), /XML check failed/, bad);
    }
  });
});
