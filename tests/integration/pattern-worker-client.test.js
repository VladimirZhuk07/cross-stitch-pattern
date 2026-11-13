// Worker client + worker handler: the client talks to a fake worker that passes messages
// through structured cloning (with transfer, like postMessage) to the real handler.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPatternWorkerClient } from '../../src/io/pattern-worker-client.js';
import { createPatternWorkerHandler } from '../../src/workers/pattern-worker-handler.js';
import { OPAQUE_BLACK, OPAQUE_WHITE, solidImage } from '../helpers/pixel-image.js';

// A stand-in for a Worker. With isAnswering false it accepts requests but never answers.
function createFakeWorker({ isAnswering = true } = {}) {
  const handleMessage = createPatternWorkerHandler();
  const listeners = { message: [], error: [], messageerror: [] };
  const posted = [];

  function emit(type, event) {
    for (const listener of listeners[type]) {
      listener(event);
    }
  }

  return {
    posted,
    addEventListener(type, listener) {
      listeners[type].push(listener);
    },
    postMessage(message, transfer = []) {
      const received = structuredClone(message, { transfer });
      posted.push({ message: received, transfer });
      if (!isAnswering) {
        return;
      }
      setTimeout(() => {
        const { response, transfer: responseTransfer } = handleMessage(received);
        emit('message', { data: structuredClone(response, { transfer: responseTransfer }) });
      }, 0);
    },
    crash(message) {
      emit('error', { message });
    },
  };
}

describe('pattern worker client', () => {
  it('resolves with the generated pattern', async () => {
    const client = createPatternWorkerClient(createFakeWorker());
    const pattern = await client.generate({ image: solidImage(2, 2, OPAQUE_BLACK), settings: { targetWidth: 2, maxColors: 24 } });
    assert.equal(pattern.width, 2);
    assert.deepEqual(pattern.legend.map((entry) => entry.code), ['310']);
    assert.ok(pattern.cells instanceof Int16Array);
  });

  it('gives each request its own id and answer', async () => {
    const worker = createFakeWorker();
    const client = createPatternWorkerClient(worker);
    const first = client.generate({ image: solidImage(2, 2, OPAQUE_WHITE), settings: { targetWidth: 2, maxColors: 24 } });
    const second = client.generate({ settings: { targetWidth: 1, maxColors: 24 } });
    const [firstPattern, secondPattern] = await Promise.all([first, second]);
    assert.equal(firstPattern.width, 2);
    assert.equal(secondPattern.width, 1);
    const ids = worker.posted.map((entry) => entry.message.id);
    assert.equal(new Set(ids).size, 2);
    assert.equal(worker.posted[1].message.image, undefined);
  });

  it('transfers the pixel buffer instead of copying it', async () => {
    const worker = createFakeWorker();
    const client = createPatternWorkerClient(worker);
    const image = solidImage(2, 2, OPAQUE_BLACK);
    const pixelBuffer = image.pixels.buffer;
    const request = client.generate({ image, settings: { targetWidth: 2, maxColors: 24 } });
    assert.deepEqual(worker.posted[0].transfer, [pixelBuffer]);
    assert.equal(pixelBuffer.byteLength, 0, 'the sender no longer owns the transferred buffer');
    await request;
  });

  it('rejects with the message of an error response', async () => {
    const client = createPatternWorkerClient(createFakeWorker());
    await assert.rejects(
      client.generate({ settings: { targetWidth: 10, maxColors: 24 } }),
      (error) => error instanceof Error && /image/.test(error.message),
    );
  });

  it('rejects every pending request when the worker stops', async () => {
    const worker = createFakeWorker({ isAnswering: false });
    const client = createPatternWorkerClient(worker);
    const first = client.generate({ image: solidImage(1, 1, OPAQUE_BLACK), settings: { targetWidth: 1, maxColors: 24 } });
    const second = client.generate({ settings: { targetWidth: 1, maxColors: 24 } });
    worker.crash('script failed');
    for (const request of [first, second]) {
      await assert.rejects(request, (error) => /The pattern worker stopped/.test(error.message) && /script failed/.test(error.message));
    }
  });
});
