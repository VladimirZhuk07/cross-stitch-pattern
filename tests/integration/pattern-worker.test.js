// Worker protocol: the worker's message handler is called directly in Node with request
// messages; the worker entry file only forwards messages to it.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPatternWorkerHandler } from '../../src/workers/pattern-worker-handler.js';
import { OPAQUE_BLACK, solidImage } from '../helpers/pixel-image.js';

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

  it('produces responses that survive structured cloning with transfer', () => {
    const { response, transfer } = createPatternWorkerHandler()({
      type: 'generate', id: 9, image: solidImage(2, 2, OPAQUE_BLACK), settings: SETTINGS,
    });
    const copy = structuredClone({ ...response, pattern: { ...response.pattern, cells: Int16Array.from(response.pattern.cells) } });
    const transferred = structuredClone(response, { transfer });
    assert.deepEqual(transferred, copy);
  });
});
