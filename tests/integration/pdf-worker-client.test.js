// PDF worker client with fake workers: requests, transfers, progress, results, stop and crashes.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PdfExportStoppedError, createPdfWorkerClient } from '../../src/io/pdf-worker-client.js';

// A stand-in for a Worker that records what is posted; the test answers through emit().
function createFakeWorker() {
  const listeners = { message: [], error: [], messageerror: [] };
  const worker = {
    posted: [],
    terminateCount: 0,
    addEventListener(type, listener) {
      listeners[type].push(listener);
    },
    postMessage(message, transfer = []) {
      worker.posted.push({ message, transfer });
    },
    terminate() {
      worker.terminateCount += 1;
    },
    emit(type, event) {
      for (const listener of listeners[type]) {
        listener(event);
      }
    },
    reply(data) {
      worker.emit('message', { data });
    },
  };
  return worker;
}

function createFactory() {
  const workers = [];
  return {
    workers,
    createWorker() {
      const worker = createFakeWorker();
      workers.push(worker);
      return worker;
    },
  };
}

function request() {
  return {
    pattern: { width: 3, height: 2, cells: new Int16Array(6), legend: [] },
    fileName: 'cat.png',
    fabricCount: 14,
    pictures: { original: new Uint8Array([1, 2]), dmc: new Uint8Array([3, 4]) },
  };
}

describe('createPdfWorkerClient', () => {
  it('posts an export-pdf request with the picture buffers transferred', () => {
    const factory = createFactory();
    const client = createPdfWorkerClient(factory.createWorker);
    const job = request();
    client.exportPdf(job);
    assert.equal(factory.workers.length, 1);
    const [{ message, transfer }] = factory.workers[0].posted;
    assert.equal(message.type, 'export-pdf');
    assert.equal(typeof message.id, 'number');
    assert.equal(message.fileName, 'cat.png');
    assert.equal(message.fabricCount, 14);
    assert.equal(message.pattern, job.pattern);
    assert.deepEqual(transfer, [job.pictures.original.buffer, job.pictures.dmc.buffer]);
  });

  it('routes progress to onProgress and resolves with the bytes, then ends the worker', async () => {
    const factory = createFactory();
    const client = createPdfWorkerClient(factory.createWorker);
    const progress = [];
    const result = client.exportPdf(request(), (step) => progress.push(step));
    const worker = factory.workers[0];
    const { id } = worker.posted[0].message;
    worker.reply({ type: 'progress', id, done: 403, total: 806 });
    worker.reply({ type: 'progress', id: id + 99, done: 1, total: 2 });
    const bytes = new Uint8Array([0x25, 0x50]);
    worker.reply({ type: 'pdf', id, bytes });
    assert.equal(await result, bytes);
    assert.deepEqual(progress, [{ done: 403, total: 806 }]);
    assert.equal(worker.terminateCount, 1, 'the worker is freed after the export');
  });

  it('rejects with the worker error message', async () => {
    const factory = createFactory();
    const client = createPdfWorkerClient(factory.createWorker);
    const result = client.exportPdf(request());
    const worker = factory.workers[0];
    worker.reply({ type: 'error', id: worker.posted[0].message.id, message: 'not a JPEG: the SOI marker is missing' });
    await assert.rejects(result, { message: 'not a JPEG: the SOI marker is missing' });
  });

  it('stops by terminating the worker and rejects with PdfExportStoppedError', async () => {
    const factory = createFactory();
    const client = createPdfWorkerClient(factory.createWorker);
    const result = client.exportPdf(request());
    client.stop();
    await assert.rejects(result, PdfExportStoppedError);
    assert.equal(factory.workers[0].terminateCount, 1);
    factory.workers[0].reply({ type: 'pdf', id: factory.workers[0].posted[0].message.id, bytes: new Uint8Array(1) });
  });

  it('does nothing on stop while idle', () => {
    const factory = createFactory();
    const client = createPdfWorkerClient(factory.createWorker);
    client.stop();
    assert.equal(factory.workers.length, 0);
  });

  it('rejects with "The PDF worker stopped: …" when the worker fails', async () => {
    const factory = createFactory();
    const client = createPdfWorkerClient(factory.createWorker);
    const crashed = client.exportPdf(request());
    factory.workers[0].emit('error', { message: 'out of memory' });
    await assert.rejects(crashed, { message: 'The PDF worker stopped: out of memory' });
    const unreadable = client.exportPdf(request());
    factory.workers[1].emit('messageerror', {});
    await assert.rejects(unreadable, { message: 'The PDF worker stopped: a message could not be read' });
  });

  it('starts a new worker for an export after a stop', async () => {
    const factory = createFactory();
    const client = createPdfWorkerClient(factory.createWorker);
    const first = client.exportPdf(request());
    client.stop();
    await assert.rejects(first, PdfExportStoppedError);
    const second = client.exportPdf(request());
    assert.equal(factory.workers.length, 2);
    const worker = factory.workers[1];
    const bytes = new Uint8Array([1]);
    worker.reply({ type: 'pdf', id: worker.posted[0].message.id, bytes });
    assert.equal(await second, bytes);
  });

  it('runs one export at a time', async () => {
    const factory = createFactory();
    const client = createPdfWorkerClient(factory.createWorker);
    client.exportPdf(request());
    await assert.rejects(client.exportPdf(request()), /already running/);
    assert.equal(factory.workers.length, 1);
  });
});
