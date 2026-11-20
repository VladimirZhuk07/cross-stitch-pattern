// Unit tests for src/core/xlsx-limits.js: when the Excel export asks first or refuses, and its
// status texts (openspec/changes/add-excel-export/specs/excel-export/spec.md).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  XLSX_CONFIRM_CELLS,
  XLSX_MAX_CELLS,
  workbookSizeCheck,
  formatLargeWorkbookQuestion,
  formatWorkbookTooLarge,
  CREATING_WORKBOOK_TEXT,
  formatWorkbookReady,
  formatWorkbookError,
} from '../../../src/core/xlsx-limits.js';

describe('workbookSizeCheck', () => {
  it('has the thresholds of the spec', () => {
    assert.equal(XLSX_CONFIRM_CELLS, 250_000);
    assert.equal(XLSX_MAX_CELLS, 1_000_000);
  });

  it('accepts up to 250,000 cells without a question', () => {
    assert.equal(workbookSizeCheck({ width: 500, height: 500 }), 'ok');
    assert.equal(workbookSizeCheck({ width: 1, height: 1 }), 'ok');
  });

  it('asks above 250,000 cells up to 1,000,000', () => {
    assert.equal(workbookSizeCheck({ width: 501, height: 500 }), 'confirm');
    assert.equal(workbookSizeCheck({ width: 1000, height: 1000 }), 'confirm');
  });

  it('refuses more than 1,000,000 cells', () => {
    assert.equal(workbookSizeCheck({ width: 2000, height: 2000 }), 'too-large');
    assert.equal(workbookSizeCheck({ width: 10000, height: 101 }), 'too-large');
  });
});

describe('texts', () => {
  it('asks about a large workbook', () => {
    assert.equal(
      formatLargeWorkbookQuestion({ width: 800, height: 800 }),
      'This workbook will have 640,000 chart cells (800 × 800). Large workbooks take longer to create and open slowly in spreadsheet programs.',
    );
  });

  it('refuses a too large pattern', () => {
    assert.equal(
      formatWorkbookTooLarge({ width: 2000, height: 2000 }),
      'This pattern is too large for an Excel workbook: 4,000,000 cells (2000 × 2000), at most 1,000,000. Choose a smaller width.',
    );
    assert.match(formatWorkbookTooLarge({ width: 10000, height: 101 }), /: 1,010,000 cells \(10000 × 101\),/);
  });

  it('reports progress, success and failure', () => {
    assert.equal(CREATING_WORKBOOK_TEXT, 'Creating Excel workbook…');
    assert.equal(formatWorkbookReady('cat.xlsx'), 'Excel workbook ready: cat.xlsx');
    assert.equal(formatWorkbookError('out of memory'), 'Could not create the Excel workbook: out of memory');
  });
});
