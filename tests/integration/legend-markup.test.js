// Checks the legend markup in index.html that src/ui/legend.js relies on
// (see openspec/specs/stitch-chart/spec.md, "Legend lists every color in number order").

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let html = '';

function legendSection() {
  const match = /<section\b[^>]*data-role="legend"[^>]*>([\s\S]*?)<\/section>/.exec(html);
  assert.ok(match !== null, 'a <section data-role="legend"> exists');
  return { openingTag: match[0].slice(0, match[0].indexOf('>') + 1), body: match[1] };
}

// The markup inside the legend's row template.
function rowTemplate() {
  const template = /<template\b[^>]*data-role="legend-row-template"[^>]*>([\s\S]*?)<\/template>/.exec(legendSection().body);
  assert.ok(template !== null, 'a <template data-role="legend-row-template"> exists');
  return template[1];
}

describe('legend markup', () => {
  before(async () => {
    html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  });

  it('replaces the legend placeholder comment', () => {
    assert.ok(!html.includes('Legend: added here by add-stitch-chart-layer.'));
  });

  it('starts hidden, until a pattern exists', () => {
    assert.match(legendSection().openingTag, /\bhidden\b/);
  });

  it('has the column headers No., Color, DMC, Name, Stitches in this order', () => {
    const headers = [...legendSection().body.matchAll(/<th\b[^>]*>([^<]*)<\/th>/g)].map((match) => match[1].trim());
    assert.deepEqual(headers, ['No.', 'Color', 'DMC', 'Name', 'Stitches']);
  });

  it('has an empty row container', () => {
    assert.match(legendSection().body, /<tbody\b[^>]*data-role="legend-rows"[^>]*><\/tbody>/);
  });

  it('has the text for a pattern without stitches', () => {
    assert.match(legendSection().body, /<p\b[^>]*data-role="legend-empty"[^>]*>This pattern has no stitches\.<\/p>/);
  });

  it('has a row template with the fields number, swatch, code, name, stitchCount in order', () => {
    const template = /<template\b[^>]*data-role="legend-row-template"[^>]*>([\s\S]*?)<\/template>/.exec(legendSection().body);
    assert.ok(template !== null, 'a <template data-role="legend-row-template"> exists');
    const fields = [...template[1].matchAll(/data-field="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(fields, ['number', 'swatch', 'code', 'name', 'stitchCount']);
  });

  it('makes the number of a row template a highlight toggle button', () => {
    const number = /<([a-z]+)\b([^>]*\bdata-field="number"[^>]*)>/.exec(rowTemplate());
    assert.ok(number !== null, 'the number field exists');
    assert.equal(number[1], 'button');
    for (const expected of ['type="button"', 'class="legend__number"', 'data-action="highlight-color"', 'aria-pressed="false"']) {
      assert.ok(number[2].includes(expected), `the number button has ${expected}`);
    }
  });

  it('leaves the legend index of a row to the script', () => {
    assert.doesNotMatch(rowTemplate(), /data-legend-index/);
  });
});
