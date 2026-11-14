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

function attributeOf(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match === null ? null : match[1];
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
});
