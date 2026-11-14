// Worker protocol: the worker's message handler is called directly in Node with request
// messages; the worker entry file only forwards messages to it.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPatternWorkerHandler } from '../../src/workers/pattern-worker-handler.js';
import { OPAQUE_BLACK, OPAQUE_WHITE, pixelImage, solidImage } from '../helpers/pixel-image.js';

const SETTINGS = { targetWidth: 2, maxColors: 24 };

function legendSummary(pattern) {
  return pattern.legend.map((entry) => [entry.code, entry.stitchCount]);
}

describe('pattern worker handler', () => {
  it('answers the first request, which carries the image, with a pattern', () => {
    const handleMessage = createPatternWorkerHandler();
    const { response, transfer } = handleMessage({
      type: 'generate', id: 7, image: solidImage(2, 2, OPAQUE_BLACK), settings: SETTINGS,
    });
    assert.equal(response.type, 'pattern');
    assert.equal(response.id, 7);
    assert.equal(response.pattern.width, 2);
    assert.equal(response.pattern.height, 2);
    assert.deepEqual(legendSummary(response.pattern), [['310', 4]]);
    assert.deepEqual(transfer, [response.pattern.cells.buffer]);
  });

  it('reuses the remembered image for later requests', () => {
    const handleMessage = createPatternWorkerHandler();
    handleMessage({ type: 'generate', id: 7, image: solidImage(2, 2, OPAQUE_BLACK), settings: SETTINGS });
    const { response } = handleMessage({ type: 'generate', id: 8, settings: { targetWidth: 1, maxColors: 24 } });
    assert.equal(response.type, 'pattern');
    assert.equal(response.id, 8);
    assert.equal(response.pattern.width, 1);
    assert.equal(response.pattern.height, 1);
    assert.deepEqual(legendSummary(response.pattern), [['310', 1]]);
  });

  it('answers with an error when no image has been sent yet', () => {
    const { response, transfer } = createPatternWorkerHandler()({ type: 'generate', id: 1, settings: { targetWidth: 10, maxColors: 24 } });
    assert.equal(response.type, 'error');
    assert.equal(response.id, 1);
    assert.match(response.message, /image/);
    assert.deepEqual(transfer, []);
  });

  it('answers an unknown message type with an error', () => {
    const { response } = createPatternWorkerHandler()({ type: 'resize', id: 3 });
    assert.deepEqual(Object.keys(response).sort(), ['id', 'message', 'type']);
    assert.equal(response.type, 'error');
    assert.equal(response.id, 3);
    assert.match(response.message, /resize/);
  });

  it('turns invalid settings into an error response and keeps working', () => {
    const handleMessage = createPatternWorkerHandler();
    const { response } = handleMessage({
      type: 'generate', id: 4, image: solidImage(2, 2, OPAQUE_BLACK), settings: { targetWidth: 2, maxColors: 490 },
    });
    assert.equal(response.type, 'error');
    assert.equal(response.id, 4);
    assert.match(response.message, /490/);
    assert.match(response.message, /489/);
    const next = handleMessage({ type: 'generate', id: 5, settings: SETTINGS });
    assert.equal(next.response.type, 'pattern');
    assert.equal(next.response.id, 5);
  });

  it('rejects an image whose pixel buffer has the wrong size', () => {
    const image = { width: 2, height: 2, pixels: new Uint8ClampedArray(12) };
    const { response } = createPatternWorkerHandler()({ type: 'generate', id: 6, image, settings: SETTINGS });
    assert.equal(response.type, 'error');
    assert.match(response.message, /16/);
  });

  it('posts throttled progress for each phase before answering', () => {
    const posted = [];
    const handleMessage = createPatternWorkerHandler((message) => posted.push(message));
    const image = pixelImage(2, 200, Array.from({ length: 400 }, (_, index) => (index % 2 === 0 ? OPAQUE_BLACK : OPAQUE_WHITE)));
    const { response } = handleMessage({ type: 'generate', id: 5, image, settings: SETTINGS });
    const postedBeforeAnswer = posted.length;
    assert.equal(response.type, 'pattern');
    assert.equal(response.id, 5);
    assert.ok(postedBeforeAnswer > 0);
    assert.ok(posted.every((message) => message.type === 'progress' && message.id === 5));
    assert.deepEqual([...new Set(posted.map((message) => message.phase))], ['averaging', 'clustering', 'assigning']);
    for (const phase of ['averaging', 'clustering', 'assigning']) {
      const messages = posted.filter((message) => message.phase === phase);
      assert.ok(messages.length >= 1 && messages.length <= 101, `${phase}: ${messages.length} messages`);
      assert.ok(messages.every((message, index) => message.done <= message.total && (index === 0 || message.done > messages[index - 1].done)), phase);
    }
    const lastOf = (phase) => posted.filter((message) => message.phase === phase).at(-1);
    assert.deepEqual(lastOf('averaging'), { type: 'progress', id: 5, phase: 'averaging', done: 200, total: 200 });
    assert.deepEqual(lastOf('clustering'), { type: 'progress', id: 5, phase: 'clustering', done: 30, total: 30 });
    assert.deepEqual(lastOf('assigning'), { type: 'progress', id: 5, phase: 'assigning', done: 200, total: 200 });
  });

  it('posts no progress for a request with invalid settings', () => {
    const posted = [];
    const handleMessage = createPatternWorkerHandler((message) => posted.push(message));
    const { response } = handleMessage({
      type: 'generate', id: 6, image: solidImage(2, 2, OPAQUE_BLACK), settings: { targetWidth: 2, maxColors: 490 },
    });
    assert.equal(response.type, 'error');
    assert.match(response.message, /490/);
    assert.match(response.message, /489/);
    assert.deepEqual(posted, []);
  });

  it('produces responses that survive structured cloning with transfer', () => {
    const { response, transfer } = createPatternWorkerHandler()({
      type: 'generate', id: 9, image: solidImage(2, 2, OPAQUE_BLACK), settings: SETTINGS,
    });
    const copy = structuredClone({ ...response, pattern: { ...response.pattern, cells: Int16Array.from(response.pattern.cells) } });
    const transferred = structuredClone(response, { transfer });
    assert.deepEqual(transferred, copy);
  });
});
