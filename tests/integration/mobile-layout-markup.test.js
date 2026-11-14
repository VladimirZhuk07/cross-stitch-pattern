// Checks the markup in index.html that the phone layout relies on (see
// openspec/specs/responsive-layout/spec.md): the viewport tag, the image chooser and the
// toggle buttons of the collapsible settings and legend panels.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const INDEX_URL = new URL('../../index.html', import.meta.url);

// Returns every opening tag of the given element name, e.g. all '<meta …>' tags.
function tagsNamed(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => match[0]);
}

// Returns the opening tag of the first element carrying the attribute, e.g. data-action="x".
function tagWith(html, attribute) {
  const match = html.match(new RegExp(`<[a-z]+\\b[^>]*\\b${attribute}[^>]*>`, 'i'));
  assert.ok(match, `no element with ${attribute}`);
  return match[0];
}

// Returns the whole element (opening tag to its matching closing tag) with the given id.
// Counts nested elements of the same name, so a <div> holding other <div>s is returned whole.
function elementWithId(html, id) {
  const start = html.search(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"`));
  assert.ok(start !== -1, `no element with id="${id}"`);
  const name = html.slice(start + 1).match(/^[a-z]+/)[0];
  const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, 'g');
  let depth = 0;
  for (const match of html.slice(start).matchAll(tags)) {
    depth += match[1] === '/' ? -1 : 1;
    if (depth === 0) {
      return html.slice(start, start + match.index + match[0].length);
    }
  }
  assert.fail(`element with id="${id}" is not closed`);
}

// Returns the content of the first <button> carrying the attribute.
function buttonContent(html, attribute) {
  const match = html.match(new RegExp(`<button\\b[^>]*\\b${attribute}[^>]*>([\\s\\S]*?)</button>`));
  assert.ok(match, `no button with ${attribute}`);
  return match[1];
}

// Returns the visible text of a piece of markup, with tags removed and spaces collapsed.
function textOf(markup) {
  return markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function attributeOf(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match === null ? null : match[1];
}

// Checks a collapsed toggle button: <button type="button" class="collapsible__toggle"
// aria-expanded="false" aria-controls="<bodyId>"> placed before the body it controls.
function assertCollapsedToggle(panel, action, bodyId) {
  const toggle = tagWith(panel, `data-action="${action}"`);
  assert.ok(toggle.startsWith('<button'), 'the toggle is a button');
  assert.equal(attributeOf(toggle, 'type'), 'button');
  assert.match(attributeOf(toggle, 'class'), /\bcollapsible__toggle\b/);
  assert.equal(attributeOf(toggle, 'aria-expanded'), 'false');
  assert.equal(attributeOf(toggle, 'aria-controls'), bodyId);
  assert.ok(panel.indexOf(toggle) < panel.indexOf(`id="${bodyId}"`), 'the toggle comes before the body');
}

describe('mobile layout markup', () => {
  let html;

  before(async () => {
    html = await readFile(INDEX_URL, 'utf8');
  });

  describe('viewport', () => {
    it('has exactly one viewport tag that fits the device and covers the notch area', () => {
      const viewports = tagsNamed(html, 'meta').filter((tag) => attributeOf(tag, 'name') === 'viewport');
      assert.equal(viewports.length, 1);
      assert.equal(attributeOf(viewports[0], 'content'), 'width=device-width, initial-scale=1, viewport-fit=cover');
    });

    it('never restricts page zoom', () => {
      const viewport = tagsNamed(html, 'meta').find((tag) => attributeOf(tag, 'name') === 'viewport');
      assert.doesNotMatch(viewport, /maximum-scale|minimum-scale|user-scalable/);
    });
  });

  describe('image chooser', () => {
    it('accepts any image and lets phones offer the gallery as well as the camera', () => {
      const input = tagWith(html, 'data-role="file-input"');
      assert.equal(attributeOf(input, 'type'), 'file');
      assert.equal(attributeOf(input, 'accept'), 'image/*');
      assert.doesNotMatch(input, /\bcapture\b/);
    });

    it('sits inside a label reading "Choose image"', () => {
      const labels = html.match(/<label\b[^>]*>[\s\S]*?<\/label>/g);
      const label = labels.find((markup) => markup.includes('data-role="file-input"'));
      assert.ok(label, 'the file input is inside a label');
      assert.equal(textOf(label), 'Choose image');
    });
  });

  describe('settings panel', () => {
    let form;

    before(() => {
      const match = html.match(/<form\b[^>]*data-role="settings"[^>]*>[\s\S]*?<\/form>/);
      assert.ok(match, 'no settings form');
      form = match[0];
    });

    it('marks the form as a collapsible panel', () => {
      assert.match(attributeOf(tagWith(form, 'data-role="settings"'), 'class'), /\bcollapsible\b/);
    });

    it('starts with a collapsed Settings toggle that controls the panel body', () => {
      assertCollapsedToggle(form, 'toggle-settings', 'settings-body');
    });

    it('shows Settings and the summary of the default settings on the toggle', () => {
      const content = buttonContent(form, 'data-action="toggle-settings"');
      assert.match(content, /<span\b[^>]*data-role="settings-summary"[^>]*>Width 100 · max 24 colors · 14 ct<\/span>/);
      assert.equal(textOf(content), 'Settings Width 100 · max 24 colors · 14 ct');
    });

    it('folds the fields and the size text, but not the generation status', () => {
      const body = elementWithId(form, 'settings-body');
      assert.match(attributeOf(body, 'class'), /\bcollapsible__body\b/);
      for (const setting of ['targetWidth', 'maxColors', 'fabricCount']) {
        assert.ok(body.includes(`data-setting="${setting}"`), `${setting} is inside the body`);
      }
      assert.ok(body.includes('data-role="pattern-size"'), 'the size text is inside the body');
      assert.ok(!body.includes('data-role="generation-status"'), 'the generation status stays visible');
      assert.ok(form.includes('data-role="generation-status"'));
    });
  });

  describe('legend panel', () => {
    let section;

    before(() => {
      const match = html.match(/<section\b[^>]*data-role="legend"[^>]*>[\s\S]*?<\/section>/);
      assert.ok(match, 'no legend section');
      section = match[0];
    });

    it('marks the legend as a collapsible panel', () => {
      assert.match(attributeOf(tagWith(section, 'data-role="legend"'), 'class'), /\bcollapsible\b/);
    });

    it('starts with a collapsed Legend toggle, before the heading, that controls the panel body', () => {
      assertCollapsedToggle(section, 'toggle-legend', 'legend-body');
      assert.ok(section.indexOf('data-action="toggle-legend"') < section.indexOf('<h2'), 'the toggle comes before the heading');
    });

    it('shows Legend and an empty summary that the app fills in', () => {
      const content = buttonContent(section, 'data-action="toggle-legend"');
      assert.match(content, /<span\b[^>]*data-role="legend-summary"[^>]*><\/span>/);
      assert.equal(textOf(content), 'Legend');
    });

    it('folds the empty text and the table, but keeps the heading and the row template outside', () => {
      const body = elementWithId(section, 'legend-body');
      assert.match(attributeOf(body, 'class'), /\bcollapsible__body\b/);
      assert.ok(body.includes('data-role="legend-empty"'), 'the empty text is inside the body');
      assert.ok(body.includes('data-role="legend-table"'), 'the table is inside the body');
      assert.ok(!body.includes('id="legend-title"'), 'the heading stays outside');
      assert.ok(!body.includes('data-role="legend-row-template"'), 'the row template stays outside');
    });
  });
});
