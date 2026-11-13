// Checks the static settings form markup in index.html that src/ui/settings-form.js relies
// on: hooks, ranges, defaults, labels and live outputs.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const INDEX_URL = new URL('../../index.html', import.meta.url);

// Returns the opening tag of the first element carrying the attribute, e.g. data-setting="maxColors".
function tagWith(html, attribute) {
  const match = html.match(new RegExp(`<[a-z]+\\b[^>]*\\b${attribute}[^>]*>`, 'i'));
  assert.ok(match, `no element with ${attribute}`);
  return match[0];
}

function attributeOf(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match === null ? null : match[1];
}

describe('settings form markup', () => {
  let html;
  let form;

  before(async () => {
    html = await readFile(INDEX_URL, 'utf8');
    const match = html.match(/<form\b[^>]*data-role="settings"[^>]*>[\s\S]*?<\/form>/);
    assert.ok(match, 'no settings form');
    form = match[0];
  });

  it('replaces the settings marker and keeps the legend marker', () => {
    assert.ok(!html.includes('Settings form: added here by add-pattern-generation.'));
    assert.ok(html.includes('<!-- Legend: added here by add-stitch-chart-layer. -->'));
  });

  it('groups the settings under the legend "Pattern settings"', () => {
    assert.match(form, /<fieldset\b[^>]*>\s*<legend\b[^>]*>Pattern settings<\/legend>/);
  });

  it('offers a whole-number width from 10 to 500, default 100', () => {
    const input = tagWith(form, 'data-setting="targetWidth"');
    assert.equal(attributeOf(input, 'type'), 'number');
    assert.equal(attributeOf(input, 'min'), '10');
    assert.equal(attributeOf(input, 'max'), '500');
    assert.equal(attributeOf(input, 'step'), '1');
    assert.equal(attributeOf(input, 'value'), '100');
  });

  it('offers 1 to 99 colors, default 24', () => {
    const input = tagWith(form, 'data-setting="maxColors"');
    assert.equal(attributeOf(input, 'type'), 'number');
    assert.equal(attributeOf(input, 'min'), '1');
    assert.equal(attributeOf(input, 'max'), '99');
    assert.equal(attributeOf(input, 'value'), '24');
  });

  it('offers fabric counts 11, 14, 16 and 18 with 14 selected', () => {
    const select = form.match(/<select\b[^>]*data-setting="fabricCount"[^>]*>([\s\S]*?)<\/select>/);
    assert.ok(select, 'no fabric select');
    const options = [...select[1].matchAll(/<option\b[^>]*value="(\d+)"([^>]*)>/g)];
    assert.deepEqual(options.map((option) => option[1]), ['11', '14', '16', '18']);
    const selected = options.filter((option) => /\bselected\b/.test(option[2])).map((option) => option[1]);
    assert.deepEqual(selected, ['14']);
  });

  it('gives every control a visible label', () => {
    for (const setting of ['targetWidth', 'maxColors', 'fabricCount']) {
      const id = attributeOf(tagWith(form, `data-setting="${setting}"`), 'id');
      assert.ok(id, `${setting} has an id`);
      assert.match(form, new RegExp(`<label\\b[^>]*for="${id}"[^>]*>[^<]+`), `${setting} has a label`);
    }
  });

  it('links each number field to its hidden error message', () => {
    for (const setting of ['targetWidth', 'maxColors']) {
      const describedBy = attributeOf(tagWith(form, `data-setting="${setting}"`), 'aria-describedby');
      assert.ok(describedBy, `${setting} has aria-describedby`);
      assert.match(form, new RegExp(`<[a-z]+\\b[^>]*id="${describedBy}"[^>]*\\bhidden\\b`), `${setting} error is hidden`);
    }
  });

  it('has a size output and a polite generation status', () => {
    assert.ok(tagWith(form, 'data-role="pattern-size"').startsWith('<output'));
    const status = tagWith(form, 'data-role="generation-status"');
    assert.ok(status.startsWith('<output'));
    assert.equal(attributeOf(status, 'aria-live'), 'polite');
  });
});
