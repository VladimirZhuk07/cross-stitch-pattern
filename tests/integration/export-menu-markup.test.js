// Checks the shared Export menu, its Excel workbook item and the Large workbook dialog in
// index.html, and the shared menu CSS (openspec/changes/add-excel-export/specs/excel-export/spec.md,
// design D11 and D13).

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let html = '';
let mainCss = '';
let printCss = '';

// The items of the shared menu in their fixed order; each change adds only its own.
const ITEM_ORDER = ['export-pdf', 'export-xlsx', 'export-progress', 'progress-file-input'];

const MENU_START = [
  '    <h1 class="app-header__title">Cross-Stitch<span class="app-header__title-rest"> Pattern Maker</span></h1>',
  '    <details class="export-menu" data-role="export-menu">',
  '      <summary class="export-menu__toggle">Export</summary>',
  '      <div class="export-menu__items" role="group" aria-label="Export and progress files">',
].join('\n');

const XLSX_ITEM = '        <button class="export-menu__item" type="button" data-action="export-xlsx" disabled>Excel workbook</button>';

function menuBlock() {
  const match = /<details class="export-menu"[\s\S]*?<\/details>/.exec(html);
  assert.ok(match, 'the Export menu exists');
  return match[0];
}

function xlsxDialog() {
  const match = /<dialog\b[^>]*data-role="xlsx-warning"[^>]*>[\s\S]*?<\/dialog>/.exec(html);
  assert.ok(match, 'a <dialog data-role="xlsx-warning"> exists');
  return match[0];
}

describe('Export menu markup', () => {
  before(async () => {
    html = (await readFile(new URL('../../index.html', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
    mainCss = (await readFile(new URL('../../styles/main.css', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
    printCss = (await readFile(new URL('../../styles/print.css', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  });

  it('puts the shared menu right after the title, before the file picker', () => {
    assert.ok(html.includes(MENU_START), 'menu block directly after the <h1>');
    assert.ok(html.indexOf('<details class="export-menu"') < html.indexOf('<label class="file-picker">'));
  });

  it('offers the disabled Excel workbook item', () => {
    assert.ok(menuBlock().includes(`${XLSX_ITEM}\n`), 'the export-xlsx item, indented as in the conventions');
  });

  it('keeps the items in the conventions order', () => {
    const block = menuBlock();
    const present = ITEM_ORDER.filter((name) => block.includes(`"${name}"`));
    const positions = present.map((name) => block.indexOf(`"${name}"`));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, present.join(', '));
  });

  it('has the Large workbook dialog with Cancel focused first', () => {
    const dialog = xlsxDialog();
    assert.match(dialog, /class="confirm-dialog"/);
    assert.match(dialog, /<h2 class="confirm-dialog__title" id="xlsx-warning-title">Large workbook<\/h2>/);
    assert.match(dialog, /aria-labelledby="xlsx-warning-title"/);
    assert.match(dialog, /aria-describedby="xlsx-warning-text"/);
    assert.match(dialog, /<p class="confirm-dialog__text" id="xlsx-warning-text" data-role="xlsx-warning-text"><\/p>/);
    assert.match(dialog, /<button type="button" class="confirm-dialog__button" data-action="cancel-xlsx" autofocus>Cancel<\/button>/);
    assert.match(dialog, /<button type="button" class="confirm-dialog__button confirm-dialog__button--confirm" data-action="confirm-xlsx">Create workbook<\/button>/);
  });

  it('places the dialog after the progress dialog', () => {
    assert.ok(html.indexOf('data-role="progress-warning"') < html.indexOf('data-role="xlsx-warning"'));
  });

  it('adds the shared menu CSS right after the file picker focus rule', () => {
    const anchor = '.file-picker:has(.file-picker__input:focus-visible) {\n  outline: 3px solid var(--color-focus);\n  outline-offset: 2px;\n}\n\n';
    assert.ok(mainCss.includes(`${anchor}/* Export menu (shared by add-pdf-export, add-excel-export, add-progress-file): one "Export"\n`));
    for (const selector of ['.export-menu {', '.export-menu__toggle {', '.export-menu__items {', '.export-menu__item {', '.export-menu__item:disabled,']) {
      assert.ok(mainCss.includes(`\n${selector}`), selector);
    }
  });

  it('keeps the list on screen on compact screens, right after the shared menu block', () => {
    const menuEnd = '.export-menu__file:has(.export-menu__input:focus-visible) {\n  outline: 3px solid var(--color-focus);\n  outline-offset: 2px;\n}\n\n';
    assert.ok(mainCss.includes(`${menuEnd}/* On compact screens the Export button sits in the middle of the header, so its list drops from\n`));
    assert.match(mainCss, /@media screen and \(width < 48rem\), screen and \(height < 30rem\) and \(width < 60rem\) \{\n {2}\.app-header \{\n {4}position: relative;\n {2}\}\n\n {2}\.export-menu \{\n {4}position: static;\n {2}\}\n\n {2}\.export-menu__items \{\n {4}right: var\(--space-2\);\n {2}\}\n\}\n/);
  });

  it('hides the menu in print with the shared rule at the end of print.css', () => {
    assert.ok(printCss.endsWith('/* The Export menu (shared by the export changes). */\n.export-menu {\n  display: none;\n}\n'));
  });
});
