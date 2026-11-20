// Unit tests for src/core/xlsx-package.js: the parts of the workbook package
// (openspec/changes/add-excel-export/specs/excel-export/spec.md, design D3).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../../src/core/pattern.js';
import { workbookFiles, XLSX_MEDIA_TYPE } from '../../../src/core/xlsx-package.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

// Test fixtures, not palette data (the 3 × 2 pattern of the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const PATTERN = buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
const PICTURES = {
  original: { png: Uint8Array.from([1, 2, 3]), width: 30, height: 20 },
  dmc: { png: Uint8Array.from([4, 5]), width: 30, height: 20 },
};

const PART_NAMES = [
  '[Content_Types].xml',
  '_rels/.rels',
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
  'xl/styles.xml',
  'xl/worksheets/sheet1.xml',
  'xl/worksheets/sheet2.xml',
  'xl/worksheets/sheet3.xml',
  'xl/worksheets/_rels/sheet2.xml.rels',
  'xl/drawings/drawing1.xml',
  'xl/drawings/_rels/drawing1.xml.rels',
  'xl/media/image1.png',
  'xl/media/image2.png',
];

const SHEET_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';

// Each part's text (XML parts) or bytes (PNGs), by name.
function partsOf(files) {
  const parts = new Map();
  for (const file of files) {
    parts.set(file.name, file.content instanceof Uint8Array ? file.content : [...file.content].join(''));
  }
  return parts;
}

// Resolves a relationship target against the folder of the part that owns the .rels file.
function resolveTarget(relsName, target) {
  const ownerFolder = relsName.replace(/_rels\/[^/]+\.rels$/, '');
  const segments = `${ownerFolder}${target}`.split('/');
  const resolved = [];
  for (const segment of segments) {
    if (segment === '..') {
      resolved.pop();
    } else if (segment !== '' && segment !== '.') {
      resolved.push(segment);
    }
  }
  return resolved.join('/');
}

describe('workbookFiles', () => {
  it('returns the 13 parts in a fixed order', () => {
    assert.deepEqual(workbookFiles(PATTERN, PICTURES).map((file) => file.name), PART_NAMES);
  });

  it('compresses the XML parts and stores the PNGs as given', () => {
    const files = workbookFiles(PATTERN, PICTURES);
    for (const file of files) {
      assert.equal(file.shouldCompress, !file.name.endsWith('.png'), file.name);
    }
    assert.equal(files.at(-2).content, PICTURES.original.png);
    assert.equal(files.at(-1).content, PICTURES.dmc.png);
  });

  it('declares the content type of every part', () => {
    const types = partsOf(workbookFiles(PATTERN, PICTURES)).get('[Content_Types].xml');
    assert.match(types, /<Default Extension="rels" ContentType="application\/vnd.openxmlformats-package.relationships\+xml"\/>/);
    assert.match(types, /<Default Extension="xml" ContentType="application\/xml"\/>/);
    assert.match(types, /<Default Extension="png" ContentType="image\/png"\/>/);
    const overrides = Object.fromEntries([...types.matchAll(/<Override PartName="([^"]+)" ContentType="([^"]+)"\/>/g)].map((match) => [match[1], match[2]]));
    assert.deepEqual(overrides, {
      '/xl/workbook.xml': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
      '/xl/worksheets/sheet1.xml': SHEET_TYPE,
      '/xl/worksheets/sheet2.xml': SHEET_TYPE,
      '/xl/worksheets/sheet3.xml': SHEET_TYPE,
      '/xl/styles.xml': 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml',
      '/xl/drawings/drawing1.xml': 'application/vnd.openxmlformats-officedocument.drawing+xml',
    });
  });

  it('lists the sheets Chart, Summary and Legend and opens on the first', () => {
    const workbook = partsOf(workbookFiles(PATTERN, PICTURES)).get('xl/workbook.xml');
    assert.match(workbook, /<bookViews><workbookView activeTab="0"\/><\/bookViews>/);
    const sheets = [...workbook.matchAll(/<sheet name="([^"]+)" sheetId="(\d)" r:id="(rId\d)"\/>/g)].map((match) => match.slice(1));
    assert.deepEqual(sheets, [['Chart', '1', 'rId1'], ['Summary', '2', 'rId2'], ['Legend', '3', 'rId3']]);
  });

  it('points every relationship at a returned part', () => {
    const parts = partsOf(workbookFiles(PATTERN, PICTURES));
    const targets = [];
    for (const [name, text] of parts) {
      if (!name.endsWith('.rels')) {
        continue;
      }
      for (const match of text.matchAll(/<Relationship Id="(rId\d)" Type="([^"]+)" Target="([^"]+)"\/>/g)) {
        targets.push([name, match[1], match[2].split('/').at(-1), resolveTarget(name, match[3])]);
      }
    }
    assert.deepEqual(targets, [
      ['_rels/.rels', 'rId1', 'officeDocument', 'xl/workbook.xml'],
      ['xl/_rels/workbook.xml.rels', 'rId1', 'worksheet', 'xl/worksheets/sheet1.xml'],
      ['xl/_rels/workbook.xml.rels', 'rId2', 'worksheet', 'xl/worksheets/sheet2.xml'],
      ['xl/_rels/workbook.xml.rels', 'rId3', 'worksheet', 'xl/worksheets/sheet3.xml'],
      ['xl/_rels/workbook.xml.rels', 'rId4', 'styles', 'xl/styles.xml'],
      ['xl/worksheets/_rels/sheet2.xml.rels', 'rId1', 'drawing', 'xl/drawings/drawing1.xml'],
      ['xl/drawings/_rels/drawing1.xml.rels', 'rId1', 'image', 'xl/media/image1.png'],
      ['xl/drawings/_rels/drawing1.xml.rels', 'rId2', 'image', 'xl/media/image2.png'],
    ]);
    for (const [, , , part] of targets) {
      assert.ok(parts.has(part), part);
    }
  });

  it('names the xlsx media type', () => {
    assert.equal(XLSX_MEDIA_TYPE, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('throws for malformed pictures', () => {
    assertThrowsWith(() => workbookFiles(PATTERN, { ...PICTURES, dmc: { ...PICTURES.dmc, width: 0 } }), RangeError, 'width', '0');
    assertThrowsWith(() => workbookFiles(PATTERN, { ...PICTURES, original: { ...PICTURES.original, png: [1, 2] } }), TypeError, 'png');
    assertThrowsWith(() => workbookFiles(PATTERN, undefined), TypeError, 'pictures');
  });

  it('throws for a malformed pattern', () => {
    assertThrowsWith(() => workbookFiles(undefined, PICTURES), TypeError, 'pattern');
    assertThrowsWith(() => workbookFiles({ ...PATTERN, cells: new Int16Array(5) }, PICTURES), RangeError, 'cells', '5');
    assertThrowsWith(() => workbookFiles({ ...PATTERN, cells: Int16Array.from([0, 1, 2, -1, 1, 0]) }, PICTURES), RangeError, 'cell 2', '2');
  });
});
