// Excel worker client: createWorkbookInWorker with fake workers that answer like the real handler
// (openspec/changes/add-excel-export/design.md, D9).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { createWorkbookInWorker } from '../../src/io/xlsx-worker-client.js';
import { createXlsxWorkerHandler } from '../../src/workers/xlsx-worker-handler.js';
import { unzip } from '../helpers/unzip.js';

// Test fixtures, not palette data (the 3 × 2 pattern of the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const PATTERN = buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });

function pictures() {
  return {
    original: { png: Uint8Array.from([1, 2, 3]), width: 30, height: 20 },
    dmc: { png: Uint8Array.from([4, 5, 6]), width: 30, height: 20 },
  };
}

// A stand-in for a Worker. answer(received) returns the messages to send back (structured-cloned),
// or null to stay silent; the real handler answers by default.
function createFakeWorker(answer = null) {
  const listeners = { message: [], error: [], messageerror: [] };
  const handleMessage = createXlsxWorkerHandler();
  const worker = {
    posted: [],
    terminateCount: 0,
    addEventListener(type, listener) {
      listeners[type].push(listener);
    },
    emit(type, event) {
      for (const listener of listeners[type]) {
        listener(event);
      }
    },
    postMessage(message, transfer = []) {
      const received = structuredClone(message, { transfer });
      worker.posted.push({ message: received, transfer });
      setTimeout(async () => {
        if (answer !== null) {
          for (const data of answer(received) ?? []) {
            worker.emit('message', { data });
          }
          return;
        }
        const { response, transfer: responseTransfer } = await handleMessage(received);
        worker.emit('message', { data: structuredClone(response, { transfer: responseTransfer }) });
      }, 0);
    },
    terminate() {
      worker.terminateCount += 1;
    },
  };
  return worker;
}

describe('createWorkbookInWorker', () => {
  it('posts one request with the PNG buffers transferred and resolves with the bytes', async () => {
    const worker = createFakeWorker();
    const request = { pattern: PATTERN, pictures: pictures() };
    const bytes = await createWorkbookInWorker(() => worker, request);
    assert.equal(worker.posted.length, 1);
    const [{ message, transfer }] = worker.posted;
    assert.equal(message.type, 'xlsx');
    assert.equal(typeof message.id, 'number');
    assert.equal(transfer.length, 2);
    assert.equal(request.pictures.original.png.length, 0, 'the original PNG buffer was transferred');
    assert.equal(request.pictures.dmc.png.length, 0, 'the DMC PNG buffer was transferred');
    assert.ok(bytes instanceof Uint8Array);
    assert.equal(unzip(bytes).files.size, 13);
    assert.equal(worker.terminateCount, 1);
  });

  it('rejects with the message of an error response and terminates the worker', async () => {
    const worker = createFakeWorker((received) => [{ type: 'error', id: received.id, message: 'out of memory' }]);
    await assert.rejects(createWorkbookInWorker(() => worker, { pattern: PATTERN, pictures: pictures() }), { message: 'out of memory' });
    assert.equal(worker.terminateCount, 1);
  });

  it('rejects when the worker fails and terminates it', async () => {
    const worker = createFakeWorker(() => null);
    const result = createWorkbookInWorker(() => worker, { pattern: PATTERN, pictures: pictures() });
    worker.emit('error', { message: 'script error' });
    await assert.rejects(result, { message: 'The Excel worker stopped: script error' });
    assert.equal(worker.terminateCount, 1);
  });

  it('rejects when a message cannot be read', async () => {
    const worker = createFakeWorker(() => null);
    const result = createWorkbookInWorker(() => worker, { pattern: PATTERN, pictures: pictures() });
    worker.emit('messageerror', {});
    await assert.rejects(result, { message: 'The Excel worker stopped: a message could not be read' });
    assert.equal(worker.terminateCount, 1);
  });

  it('ignores messages with another id', async () => {
    const bytes = Uint8Array.from([1, 2]);
    const worker = createFakeWorker((received) => [
      { type: 'error', id: received.id + 1, message: 'not ours' },
      { type: 'xlsx', id: received.id, bytes },
    ]);
    assert.deepEqual(await createWorkbookInWorker(() => worker, { pattern: PATTERN, pictures: pictures() }), bytes);
    assert.equal(worker.terminateCount, 1);
  });
});
