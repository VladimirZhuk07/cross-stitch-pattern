// Checks the view-layer contract (described in src/ui/viewer.js) for all three layer modules,
// and that the layer switcher markup in index.html offers exactly these layers.
// Layer modules use no DOM at import time and isAvailable is pure, so this runs in Node.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOriginalLayer } from '../../src/ui/layers/original-layer.js';
import { createDmcLayer } from '../../src/ui/layers/dmc-layer.js';
import { createChartLayer } from '../../src/ui/layers/chart-layer.js';

const STATE_WITHOUT_PATTERN = { image: null, pattern: null, activeLayer: 'original' };
const STATE_WITH_PATTERN = { image: null, pattern: {}, activeLayer: 'original' };

describe('view layers', () => {
  it('have the ids original, dmc and chart and a render function', () => {
    const layers = [createOriginalLayer(), createDmcLayer(), createChartLayer()];
    assert.deepEqual(layers.map((layer) => layer.id), ['original', 'dmc', 'chart']);
    for (const layer of layers) {
      assert.equal(typeof layer.render, 'function', `${layer.id}.render`);
      assert.equal(typeof layer.isAvailable, 'function', `${layer.id}.isAvailable`);
    }
  });

  it('makes Original available with or without a pattern', () => {
    const original = createOriginalLayer();
    assert.equal(original.isAvailable(STATE_WITHOUT_PATTERN), true);
    assert.equal(original.isAvailable(STATE_WITH_PATTERN), true);
  });

  it('makes DMC colors available only once a pattern exists', () => {
    const dmc = createDmcLayer();
    assert.equal(dmc.isAvailable(STATE_WITHOUT_PATTERN), false);
    assert.equal(dmc.isAvailable(STATE_WITH_PATTERN), true);
  });

  it('makes Chart available only once a pattern exists', () => {
    const chart = createChartLayer();
    assert.equal(chart.isAvailable(STATE_WITHOUT_PATTERN), false);
    assert.equal(chart.isAvailable(STATE_WITH_PATTERN), true);
  });
});

describe('layer switcher markup', () => {
  it('offers the radio values original, dmc, chart in this order', async () => {
    const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
    const values = [...html.matchAll(/<input\b[^>]*\bname="layer"[^>]*\bvalue="([^"]+)"/g)]
      .map((match) => match[1]);
    assert.deepEqual(values, ['original', 'dmc', 'chart']);
  });

  it('labels the options Original, DMC colors and Chart', async () => {
    const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
    const labels = [...html.matchAll(/<span class="layer-switcher__text">([^<]+)<\/span>/g)]
      .map((match) => match[1]);
    assert.deepEqual(labels, ['Original', 'DMC colors', 'Chart']);
  });
});
