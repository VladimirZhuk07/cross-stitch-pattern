// Worker client + worker handler: the client talks to fake workers that pass messages through
// structured cloning (with transfer, like postMessage) to the real handler, progress included.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GenerationStoppedError, createPatternWorkerClient } from '../../src/io/pattern-worker-client.js';
import { createPatternWorkerHandler } from '../../src/workers/pattern-worker-handler.js';
import { OPAQUE_BLACK, OPAQUE_WHITE, solidImage } from '../helpers/pixel-image.js';

const SETTINGS = { targetWidth: 2, maxColors: 24 };

// A stand-in for a Worker. With isAnswering false it accepts requests but never answers.
function createFakeWorker({ isAnswering = true } = {}) {
  const listeners = { message: [], error: [], messageerror: [] };
  const posted = [];
  let terminateCount = 0;

  function emit(type, event) {
    for (const listener of listeners[type]) {
      listener(event);
    }
  }

  const handleMessage = createPatternWorkerHandler((message) => emit('message', { data: structuredClone(message) }));

  return {
    posted,
    get terminateCount() {
      return terminateCount;
    },
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
    terminate() {
      terminateCount += 1;
    },
    crash(message) {
      emit('error', { message });
    },
  };
}

// A worker factory that records every fake worker it creates.
function createFactory(options) {
  const workers = [];
  return {
    workers,
    createWorker() {
      const worker = createFakeWorker(options);
      workers.push(worker);
      return worker;
    },
  };
}

// A request for the image identified by key; readImage counts how often pixels are read.
function requestFor(key, settings = SETTINGS, rgba = OPAQUE_BLACK) {
  const request = {
    settings,
    imageKey: key,
    readCount: 0,
    readImage() {
      request.readCount += 1;
      return solidImage(2, 2, rgba);
    },
  };
  return request;
}

describe('pattern worker client', () => {
  it('creates the worker on the first request and resolves with the pattern', async () => {
    const factory = createFactory();
    const client = createPatternWorkerClient(factory.createWorker);
    assert.equal(factory.workers.length, 0);
    const pattern = await client.generate(requestFor('a'));
    assert.equal(factory.workers.length, 1);
    assert.equal(pattern.width, 2);
    assert.deepEqual(pattern.legend.map((entry) => entry.code), ['310']);
    assert.ok(pattern.cells instanceof Int16Array);
  });

  it('reads and sends the pixels once per image and worker', async () => {
    const factory = createFactory();
    const client = createPatternWorkerClient(factory.createWorker);
    const first = requestFor('a');
    const second = { ...requestFor('a', { targetWidth: 1, maxColors: 24 }), readImage: first.readImage };
    const [firstPattern, secondPattern] = await Promise.all([client.generate(first), client.generate(second)]);
    assert.equal(first.readCount, 1);
    assert.equal(firstPattern.width, 2);
    assert.equal(secondPattern.width, 1);
    const [firstPost, secondPost] = factory.workers[0].posted;
    assert.notEqual(firstPost.message.id, secondPost.message.id);
    assert.equal(secondPost.message.image, undefined);
    const other = requestFor('b', SETTINGS, OPAQUE_WHITE);
    const otherPattern = await client.generate(other);
    assert.equal(other.readCount, 1);
    assert.deepEqual(otherPattern.legend.map((entry) => entry.code), ['B5200']);
  });

  it('transfers the pixel buffer instead of copying it', async () => {
    const factory = createFactory();
    const client = createPatternWorkerClient(factory.createWorker);
    const image = solidImage(2, 2, OPAQUE_BLACK);
    const pixelBuffer = image.pixels.buffer;
    const request = client.generate({ settings: SETTINGS, imageKey: 'a', readImage: () => image });
    assert.deepEqual(factory.workers[0].posted[0].transfer, [pixelBuffer]);
    assert.equal(pixelBuffer.byteLength, 0, 'the sender no longer owns the transferred buffer');
    await request;
  });

  it('passes progress messages to the matching request only', async () => {
    const factory = createFactory();
    const client = createPatternWorkerClient(factory.createWorker);
    const firstProgress = [];
    const secondProgress = [];
    await Promise.all([
      client.generate(requestFor('a'), (progress) => firstProgress.push(progress)),
      client.generate(requestFor('a', { targetWidth: 1, maxColors: 24 }), (progress) => secondProgress.push(progress)),
    ]);
    assert.deepEqual(firstProgress.at(-1), { phase: 'assigning', done: 2, total: 2 });
    assert.deepEqual(secondProgress.at(-1), { phase: 'assigning', done: 1, total: 1 });
    assert.deepEqual([...new Set(firstProgress.map((progress) => progress.phase))], ['averaging', 'clustering', 'assigning']);
  });

  it('rejects with the message of an error response', async () => {
    const client = createPatternWorkerClient(createFactory().createWorker);
    await assert.rejects(
      client.generate(requestFor('a', { targetWidth: 2, maxColors: 490 })),
      (error) => error instanceof Error && /490/.test(error.message),
    );
  });

  it('stops a running request by terminating its worker', async () => {
    const factory = createFactory({ isAnswering: false });
    const client = createPatternWorkerClient(factory.createWorker);
    const running = client.generate(requestFor('a'));
    client.stop();
    assert.equal(factory.workers[0].terminateCount, 1);
    await assert.rejects(running, (error) => error instanceof GenerationStoppedError && error.name === 'GenerationStoppedError');
  });

  it('uses a fresh worker after a stop and sends the image to it again', async () => {
    const factory = createFactory({ isAnswering: false });
    const client = createPatternWorkerClient(factory.createWorker);
    const request = requestFor('a');
    client.generate(request).catch(() => {});
    client.stop();
    client.generate(request).catch(() => {});
    assert.equal(factory.workers.length, 2);
    assert.equal(request.readCount, 2);
    assert.notEqual(factory.workers[1].posted[0].message.image, undefined);
  });

  it('terminates nothing when stopped while idle', async () => {
    const factory = createFactory();
    const client = createPatternWorkerClient(factory.createWorker);
    client.stop();
    await client.generate(requestFor('a'));
    client.stop();
    assert.equal(factory.workers.length, 1);
    assert.equal(factory.workers[0].terminateCount, 0);
  });

  it('rejects every pending request when the worker crashes and uses a new worker next', async () => {
    const factory = createFactory({ isAnswering: false });
    const client = createPatternWorkerClient(factory.createWorker);
    const first = client.generate(requestFor('a'));
    const second = client.generate(requestFor('a', { targetWidth: 1, maxColors: 24 }));
    factory.workers[0].crash('script failed');
    for (const request of [first, second]) {
      await assert.rejects(request, (error) => /The pattern worker stopped/.test(error.message) && /script failed/.test(error.message));
    }
    const next = requestFor('a');
    client.generate(next).catch(() => {});
    assert.equal(factory.workers.length, 2);
    assert.equal(next.readCount, 1);
  });
});
