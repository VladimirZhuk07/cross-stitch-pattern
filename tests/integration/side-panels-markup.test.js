// Checks the side toggle markup in index.html that src/ui/side-panels.js and the folding CSS
// rely on (see openspec/specs/responsive-layout/spec.md, "Side toggles are accessible buttons").

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const INDEX_URL = new URL('../../index.html', import.meta.url);

// The markup from the panel's opening tag (found by id) to the end of the file.
function fromPanel(html, id) {
  const start = html.search(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"`));
  assert.ok(start !== -1, `no element with id="${id}"`);
  return html.slice(start);
}

// The first child element of the panel: the first tag after the panel's opening tag,
// skipping whitespace and comments.
function firstChildButton(panelMarkup) {
  const afterOpeningTag = panelMarkup.slice(panelMarkup.indexOf('>') + 1);
  const withoutLeadingComments = afterOpeningTag.replace(/^(\s|<!--[\s\S]*?-->)*/, '');
  const match = withoutLeadingComments.match(/^<button\b([^>]*)>([\s\S]*?)<\/button>/);
  assert.ok(match, 'the first child of the panel is a <button>');
  return { attributes: match[1], content: match[2] };
}

function attributeOf(attributes, name) {
  const match = attributes.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match === null ? null : match[1];
}

function countOf(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

// The markup of the whole panel element (up to its closing tag; panels do not nest).
function panelElement(html, id, tagName) {
  const markup = fromPanel(html, id);
  return markup.slice(0, markup.indexOf(`</${tagName}>`));
}

function assertSideToggle(html, { id, tagName, action, title, label }) {
  const panel = fromPanel(html, id);
  const { attributes, content } = firstChildButton(panel);
  assert.equal(attributeOf(attributes, 'type'), 'button');
  assert.equal(attributeOf(attributes, 'class'), 'side-toggle');
  assert.equal(attributeOf(attributes, 'data-action'), action);
  assert.equal(attributeOf(attributes, 'aria-expanded'), 'true');
  assert.equal(attributeOf(attributes, 'aria-controls'), id);
  assert.equal(attributeOf(attributes, 'title'), title);
  assert.match(content, /<span\b[^>]*\baria-hidden="true"[^>]*>/, 'the chevron is hidden from screen readers');
  assert.match(content, new RegExp(`<span\\b[^>]*class="side-toggle__label"[^>]*>${label}</span>`));
  assert.equal(countOf(panelElement(html, id, tagName), /class="side-toggle"/g), 1, 'exactly one side toggle');
}

describe('side toggle markup', () => {
  let html;

  before(async () => {
    html = await readFile(INDEX_URL, 'utf8');
  });

  it('starts the settings form with an open settings side toggle', () => {
    assertSideToggle(html, {
      id: 'settings-panel',
      tagName: 'form',
      action: 'toggle-settings-side',
      title: 'Hide settings',
      label: 'Settings',
    });
  });

  it('starts the legend section with an open legend side toggle', () => {
    assertSideToggle(html, {
      id: 'legend-panel',
      tagName: 'section',
      action: 'toggle-legend-side',
      title: 'Hide legend',
      label: 'Legend',
    });
  });

  it('has exactly two side toggles on the page', () => {
    assert.equal(countOf(html, /class="side-toggle"/g), 2);
  });
});
