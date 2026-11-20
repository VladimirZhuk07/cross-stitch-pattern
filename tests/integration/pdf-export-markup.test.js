// Checks the markup and styles the PDF export relies on (openspec/specs/pdf-export/spec.md):
// the shared Export menu with its PDF chart item, the export dialog, and the menu's CSS.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let html = '';
let mainCss = '';
let printCss = '';

function element(pattern, label) {
  const match = pattern.exec(html);
  assert.ok(match, label);
  return match[0];
}

describe('PDF export markup', () => {
  before(async () => {
    html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
    mainCss = await readFile(new URL('../../styles/main.css', import.meta.url), 'utf8');
    printCss = await readFile(new URL('../../styles/print.css', import.meta.url), 'utf8');
  });

  it('puts the shared Export menu right after the title, before the file picker', () => {
    assert.match(
      html,
      /<h1 class="app-header__title">[^<]*<\/h1>\n {4}<details class="export-menu" data-role="export-menu">\n/,
    );
    const menu = element(/<details class="export-menu"[\s\S]*?<\/details>/, 'the Export menu');
    assert.ok(html.indexOf(menu) < html.indexOf('<label class="file-picker">'));
    assert.match(menu, /<summary class="export-menu__toggle">Export<\/summary>/);
    assert.match(menu, /<div class="export-menu__items" role="group" aria-label="Export and progress files">/);
  });

  it('offers the disabled PDF chart item first in the Export menu (the shared order)', () => {
    const menu = element(/<details class="export-menu"[\s\S]*?<\/details>/, 'the Export menu');
    const items = [...menu.matchAll(/<button\b[^>]*>[^<]*<\/button>/g)].map((match) => match[0]);
    assert.equal(items[0], '<button class="export-menu__item" type="button" data-action="export-pdf" disabled>PDF chart</button>');
    assert.equal(items.filter((item) => item.includes('data-action="export-pdf"')).length, 1);
  });

  it('has the PDF export dialog with its title, text, hidden progress bar and two buttons', () => {
    const dialog = element(/<dialog\b[^>]*data-role="pdf-export-dialog"[^>]*>[\s\S]*?<\/dialog>/, 'the PDF dialog');
    assert.match(dialog, /^<dialog class="confirm-dialog"/);
    assert.match(dialog, /<h2\b[^>]*>PDF chart<\/h2>/);
    assert.match(dialog, /<p\b[^>]*data-role="pdf-export-text"[^>]*><\/p>/);
    const progress = /<progress\b[^>]*>/.exec(dialog)[0];
    assert.match(progress, /\bmax="100"/);
    assert.match(progress, /\bhidden\b/);
    assert.match(progress, /\bdata-role="pdf-export-progress"/);
    assert.match(dialog, /<button type="button" class="[^"]*" data-action="cancel-pdf-export">Cancel<\/button>/);
    assert.match(dialog, /<button type="button" class="[^"]*" data-action="confirm-pdf-export">Create PDF<\/button>/);
  });

  it('puts the PDF dialog after the existing progress warning dialog', () => {
    assert.ok(html.indexOf('data-role="pdf-export-dialog"') > html.indexOf('data-role="progress-warning"'));
  });

  it('adds the shared Export menu CSS right after the file picker focus rule', () => {
    const anchor = '.file-picker:has(.file-picker__input:focus-visible) {\n  outline: 3px solid var(--color-focus);\n  outline-offset: 2px;\n}\n\n';
    assert.ok(mainCss.includes(`${anchor}/* Export menu (shared by add-pdf-export, add-excel-export, add-progress-file)`));
    assert.match(mainCss, /\.export-menu__item:disabled,\n\.export-menu__file:has\(\.export-menu__input:disabled\) \{/);
    assert.match(mainCss, /\.export-menu__file:has\(\.export-menu__input:focus-visible\) \{/);
  });

  it('styles the progress bar of the dialog', () => {
    assert.match(mainCss, /\.confirm-dialog__progress \{[^}]*width: 100%;/);
  });

  it('hides the Export menu when printing', () => {
    assert.ok(printCss.endsWith('/* The Export menu (shared by the export changes). */\n.export-menu {\n  display: none;\n}\n'));
  });
});
