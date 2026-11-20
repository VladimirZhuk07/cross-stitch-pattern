// PDF worker protocol: the handler is called directly with request messages, as the worker
// entry (src/workers/pdf.worker.js) does.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readPdf } from '../helpers/pdf-reader.js';
import { fakeJpeg } from '../helpers/fake-jpeg.js';
import { buildPattern } from '../../src/core/pattern.js';
import { createPdfWorkerHandler } from '../../src/workers/pdf-worker-handler.js';

// Test fixtures, not palette data.
const COLORS = [
  { code: '310', name: 'Black', hex: '#000000' },
  { code: '321', name: 'Red', hex: '#C72B3B' },
  { code: '820', name: 'Royal Blue VY DK', hex: '#0E365C' },
];

function patternOfSize(width, height) {
  const cells = Array.from({ length: width * height }, (_, index) => (index % width + Math.floor(index / width)) % 3);
  return buildPattern({ width, height, cells, colors: COLORS });
}

function exportRequest(id, pattern = patternOfSize(120, 90), pictures = { original: fakeJpeg(1200, 900), dmc: fakeJpeg(1200, 900) }) {
  return structuredClone({ type: 'export-pdf', id, pattern, fileName: 'cat.png', fabricCount: 14, pictures });
}

describe('createPdfWorkerHandler', () => {
  it('answers export-pdf with the PDF bytes and transfers their buffer', async () => {
    const handleMessage = createPdfWorkerHandler();
    const { response, transfer } = await handleMessage(exportRequest(7));
    assert.equal(response.type, 'pdf');
    assert.equal(response.id, 7);
    assert.ok(response.bytes instanceof Uint8Array);
    assert.deepEqual(transfer, [response.bytes.buffer]);
    const pdf = readPdf(response.bytes);
    const tree = [...pdf.objects.values()].find((object) => object.dict.includes('/Type /Pages'));
    assert.match(tree.dict, /\/Count 8\b/);
  });

  it('posts progress with the id, in pages, each time the whole percent rises', async () => {
    const progress = [];
    const handleMessage = createPdfWorkerHandler({ postProgress: (message) => progress.push(message) });
    await handleMessage(exportRequest(3));
    assert.equal(progress.length, 8);
    assert.deepEqual(progress.at(-1), { type: 'progress', id: 3, done: 8, total: 8 });
    for (const message of progress) {
      assert.equal(message.id, 3);
    }
  });

  it('posts at most 101 progress messages, in strictly rising percent', async () => {
    const progress = [];
    const handleMessage = createPdfWorkerHandler({ postProgress: (message) => progress.push(message) });
    const pattern = buildPattern({ width: 500, height: 800, cells: new Int16Array(400000), colors: [COLORS[1]] });
    const { response } = await handleMessage(exportRequest(4, pattern));
    assert.equal(response.type, 'pdf');
    assert.equal(progress[0].total, 102);
    assert.ok(progress.length <= 101, `${progress.length} messages`);
    const percents = progress.map((message) => Math.floor((100 * message.done) / message.total));
    for (let index = 1; index < percents.length; index++) {
      assert.ok(percents[index] > percents[index - 1], `percent ${percents[index]} after ${percents[index - 1]}`);
    }
    assert.equal(percents.at(-1), 100);
  });

  it('answers a request above 1,000 pages with an error naming its page count', async () => {
    const handleMessage = createPdfWorkerHandler();
    const pattern = { width: 2000, height: 2000, cells: new Int16Array(0), legend: [], fingerprint: '0' };
    const { response, transfer } = await handleMessage(exportRequest(5, pattern));
    assert.equal(response.type, 'error');
    assert.equal(response.id, 5);
    assert.match(response.message, /1,007 pages/);
    assert.deepEqual(transfer, []);
  });

  it('answers an unknown type with an error echoing the id', async () => {
    const handleMessage = createPdfWorkerHandler();
    const { response } = await handleMessage({ type: 'generate', id: 9 });
    assert.deepEqual(response, { type: 'error', id: 9, message: 'unknown message type "generate"' });
  });

  it('answers a bad JPEG with an error echoing the id', async () => {
    const handleMessage = createPdfWorkerHandler();
    const pictures = { original: new Uint8Array([1, 2, 3]), dmc: fakeJpeg(10, 10) };
    const { response } = await handleMessage(exportRequest(11, patternOfSize(3, 2), pictures));
    assert.equal(response.type, 'error');
    assert.equal(response.id, 11);
    assert.match(response.message, /JPEG/);
  });

  it('never rejects, even for a message that is not an object', async () => {
    const handleMessage = createPdfWorkerHandler();
    const { response } = await handleMessage(null);
    assert.equal(response.type, 'error');
    assert.equal(response.id, undefined);
  });
});
