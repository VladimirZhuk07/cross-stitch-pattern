// Worker protocol test of the Excel worker: calls the message handler directly, as the worker
// entry (src/workers/xlsx.worker.js) does (openspec/changes/add-excel-export/design.md, D9).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { createXlsxWorkerHandler } from '../../src/workers/xlsx-worker-handler.js';
import { unzip } from '../helpers/unzip.js';

// Test fixtures, not palette data (the 3 × 2 pattern of the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const PATTERN = buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
const PICTURES = {
  original: { png: Uint8Array.from([1, 2, 3]), width: 30, height: 20 },
  dmc: { png: Uint8Array.from([4, 5, 6]), width: 30, height: 20 },
};

function request(overrides = {}) {
  return { type: 'xlsx', id: 7, pattern: PATTERN, pictures: PICTURES, ...overrides };
}

describe('xlsx worker handler', () => {
  it('answers a request with the workbook bytes and transfers their buffer', async () => {
    const { response, transfer } = await createXlsxWorkerHandler()(request());
    assert.equal(response.type, 'xlsx');
    assert.equal(response.id, 7);
    assert.ok(response.bytes instanceof Uint8Array);
    assert.deepEqual(transfer, [response.bytes.buffer]);
    const { files, methods } = unzip(response.bytes);
    assert.equal(files.size, 13);
    assert.equal(methods.get('xl/workbook.xml'), 8);
  });

  it('stores every entry when created without compression', async () => {
    const { response } = await createXlsxWorkerHandler({ useCompression: false })(request());
    const { files, methods } = unzip(response.bytes);
    assert.equal(files.size, 13);
    assert.ok([...methods.values()].every((method) => method === 0));
  });

  it('answers an unknown message type with an error naming it', async () => {
    const { response, transfer } = await createXlsxWorkerHandler()({ type: 'pdf', id: 3 });
    assert.deepEqual(response, { type: 'error', id: 3, message: 'unknown message type "pdf"' });
    assert.deepEqual(transfer, []);
  });

  it('answers a request without a pattern with an error', async () => {
    const { response } = await createXlsxWorkerHandler()(request({ id: 4, pattern: undefined }));
    assert.equal(response.type, 'error');
    assert.equal(response.id, 4);
    assert.match(response.message, /pattern/);
  });

  it('refuses a pattern above 1,000,000 cells even if the page did not', async () => {
    const huge = { width: 2000, height: 2000, cells: new Int16Array(4_000_000).fill(-1), legend: [] };
    const { response } = await createXlsxWorkerHandler()(request({ id: 5, pattern: huge }));
    assert.equal(response.type, 'error');
    assert.equal(response.id, 5);
    assert.match(response.message, /too large for an Excel workbook: 4,000,000 cells \(2000 × 2000\)/);
  });

  it('never rejects, even for a missing message', async () => {
    const { response } = await createXlsxWorkerHandler()(undefined);
    assert.equal(response.type, 'error');
    assert.equal(response.id, undefined);
  });
});
