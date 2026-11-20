// Checks the markup in index.html that the Progress layer relies on (see
// openspec/specs/stitch-progress/spec.md): the layer option, the counter line, the warning
// dialog and the frame's description of the keys.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let html = '';

// The opening tag of the first element carrying the attribute, e.g. data-role="x".
function tagWith(attribute) {
  const match = html.match(new RegExp(`<[a-z]+\\b[^>]*\\b${attribute}[^>]*>`, 'i'));
  assert.ok(match, `no element with ${attribute}`);
  return match[0];
}

// The whole <dialog data-role="progress-warning"> element.
function warningDialog() {
  const match = /<dialog\b[^>]*data-role="progress-warning"[^>]*>[\s\S]*?<\/dialog>/.exec(html);
  assert.ok(match, 'a <dialog data-role="progress-warning"> exists');
  return match[0];
}

describe('progress markup', () => {
  before(async () => {
    html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  });

  it('offers Progress as a disabled fourth layer', () => {
    const radio = tagWith('value="progress"');
    assert.match(radio, /\bname="layer"/);
    assert.match(radio, /\bdisabled\b/);
    assert.match(html, /value="progress" disabled>\s*<span class="layer-switcher__text">Progress<\/span>/);
  });

  it('has a hidden, polite counter line', () => {
    const counter = tagWith('data-role="progress-summary"');
    assert.match(counter, /^<output\b/);
    assert.match(counter, /\bclass="progress-summary"/);
    assert.match(counter, /\baria-live="polite"/);
    assert.match(counter, /\bhidden\b/);
  });

  it('has a hidden, polite note line right after the counter', () => {
    const note = tagWith('data-role="progress-note"');
    assert.match(note, /^<output\b/);
    assert.match(note, /\bclass="progress-note"/);
    assert.match(note, /\baria-live="polite"/);
    assert.match(note, /\bhidden\b/);
    assert.match(html, /data-role="progress-summary"[^>]*><\/output>\s*(<!--[\s\S]*?-->\s*)?<output\b[^>]*data-role="progress-note"/);
  });

  it('has the warning dialog with its text and two buttons, Keep focused first', () => {
    const dialog = warningDialog();
    assert.match(dialog, /^<dialog\b[^>]*class="confirm-dialog"/);
    assert.match(dialog, /<h2\b[^>]*>Your progress will be lost<\/h2>/);
    assert.match(dialog, /<p\b[^>]*data-role="progress-warning-text"[^>]*><\/p>/);
    assert.match(dialog, /<button type="button" class="[^"]*" data-action="keep-progress" autofocus>Keep my progress<\/button>/);
    assert.match(dialog, /<button type="button" class="[^"]*" data-action="confirm-lose-progress">[^<]*<\/button>/);
    assert.ok(dialog.indexOf('keep-progress') < dialog.indexOf('confirm-lose-progress'), 'Keep comes first');
  });

  it('has the shared Export menu right after the title, before Choose image', () => {
    const header = /<header\b[\s\S]*?<\/header>/.exec(html)[0];
    const title = header.indexOf('<h1 class="app-header__title">');
    const menu = header.indexOf('<details class="export-menu" data-role="export-menu">');
    const picker = header.indexOf('<label class="file-picker">');
    assert.ok(title !== -1 && menu !== -1 && picker !== -1, 'title, menu and picker exist');
    assert.ok(title < menu && menu < picker, 'the menu sits between the title and the picker');
    assert.match(header, /<\/h1>\n {4}<details class="export-menu" data-role="export-menu">/);
    assert.match(header, /<summary class="export-menu__toggle">Export<\/summary>/);
  });

  it('offers only this change\'s two progress items in the Export menu, both disabled', () => {
    const items = /<div class="export-menu__items"[^>]*>([\s\S]*?)<\/div>/.exec(html)[1];
    assert.match(items, /<button class="export-menu__item" type="button" data-action="export-progress" disabled>Save progress \(\.stitch\)<\/button>/);
    assert.match(items, /<label class="export-menu__item export-menu__file">Load progress \(\.stitch\)<input class="export-menu__input" type="file" accept="\.stitch" data-role="progress-file-input" disabled><\/label>/);
    assert.doesNotMatch(items, /export-pdf|export-xlsx/);
  });

  it('tells screen readers how to mark stitches in the frame', () => {
    const label = /aria-label="([^"]*)"/.exec(tagWith('data-role="viewer"'))[1];
    assert.match(label, /Progress view/);
    assert.match(label, /Space or Enter/);
  });
});
