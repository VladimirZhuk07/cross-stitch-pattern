// Drives src/ui/excel-export.js with fake elements, a fake <dialog>, fake io dependencies and the
// real store (openspec/changes/add-excel-export/specs/excel-export/spec.md, design D11).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { XLSX_MEDIA_TYPE } from '../../src/core/xlsx-package.js';
import { createStore } from '../../src/ui/store.js';
import { createInitialState } from '../../src/ui/app-state.js';
import { setupExcelExport } from '../../src/ui/excel-export.js';
import { fakeElement } from '../helpers/fake-legend-dom.js';

// Test fixtures, not palette data (the 3 × 2 pattern of the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const PATTERN = buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
const IMAGE = { fileName: 'cat.png', bitmap: {}, width: 1600, height: 1072 };
const PICTURES = { original: { png: new Uint8Array(1), width: 1, height: 1 }, dmc: { png: new Uint8Array(1), width: 1, height: 1 } };
const BYTES = Uint8Array.from([0x50, 0x4b, 5, 6]);

// The size check only reads width and height; the fake deps never look at the cells.
const sizedPattern = (width, height) => ({ ...PATTERN, width, height });

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// The menu, its item and the dialog of index.html as fake elements. The dialog behaves like the
// native one: showModal opens it, close closes it and fires 'close'; Esc fires 'cancel', then closes.
function createDom() {
  const item = fakeElement('button', { 'data-action': 'export-xlsx' });
  item.disabled = true;
  const menu = fakeElement('details', { 'data-role': 'export-menu' }, [item]);
  menu.open = false;
  const text = fakeElement('p', { 'data-role': 'xlsx-warning-text' });
  const cancel = fakeElement('button', { 'data-action': 'cancel-xlsx' });
  const confirm = fakeElement('button', { 'data-action': 'confirm-xlsx' });
  const dialog = fakeElement('dialog', { 'data-role': 'xlsx-warning' }, [text, cancel, confirm]);
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    if (dialog.open) {
      dialog.open = false;
      dialog.dispatch('close');
    }
  };
  const pressEscape = () => {
    dialog.dispatch('cancel');
    dialog.close();
  };
  const root = fakeElement('body', {}, [menu, dialog]);
  return { root, menu, item, dialog, text, cancel, confirm, pressEscape };
}

// Fake io: records calls; createWorkbook resolves with BYTES unless told otherwise.
function createDeps({ createWorkbook } = {}) {
  const calls = { encodePictures: [], createWorkbook: [], download: [] };
  return {
    calls,
    deps: {
      async encodePictures(image, pattern) {
        calls.encodePictures.push({ image, pattern });
        return PICTURES;
      },
      createWorkbook(request) {
        calls.createWorkbook.push(request);
        return createWorkbook === undefined ? Promise.resolve(BYTES) : createWorkbook(request);
      },
      download(blob, fileName) {
        calls.download.push({ blob, fileName });
      },
    },
  };
}

function setup({ pattern = PATTERN, deps: depsOptions } = {}) {
  const dom = createDom();
  const store = createStore(createInitialState());
  const { deps, calls } = createDeps(depsOptions);
  setupExcelExport(dom.root, store, deps);
  if (pattern !== null) {
    store.setState({ image: IMAGE, pattern });
  }
  return { dom, store, calls };
}

describe('Excel workbook menu item', () => {
  it('is disabled without a pattern and enabled with one', () => {
    const { dom, store } = setup({ pattern: null });
    assert.equal(dom.item.disabled, true);
    store.setState({ image: IMAGE, pattern: PATTERN });
    assert.equal(dom.item.disabled, false);
    store.setState({ pattern: null });
    assert.equal(dom.item.disabled, true);
  });

  it('closes the menu when pressed', async () => {
    const { dom } = setup();
    dom.menu.open = true;
    dom.item.dispatch('click');
    assert.equal(dom.menu.open, false);
    await settle();
  });

  it('exports cat.png as cat.xlsx with the status before and after', async () => {
    let finish;
    const { dom, store, calls } = setup({ deps: { createWorkbook: () => new Promise((resolve) => { finish = resolve; }) } });
    const statuses = [];
    store.subscribe((state, previous) => {
      if (state.status !== previous.status) {
        statuses.push(state.status);
      }
    });
    dom.item.dispatch('click');
    await settle();
    assert.deepEqual(statuses, [{ kind: 'loading', text: 'Creating Excel workbook…' }]);
    assert.equal(dom.item.disabled, true, 'disabled while running');
    assert.deepEqual(calls.encodePictures, [{ image: IMAGE, pattern: PATTERN }]);
    assert.deepEqual(calls.createWorkbook, [{ pattern: PATTERN, pictures: PICTURES }]);
    finish(BYTES);
    await settle();
    assert.deepEqual(statuses.at(-1), { kind: 'info', text: 'Excel workbook ready: cat.xlsx' });
    assert.equal(calls.download.length, 1);
    const [{ blob, fileName }] = calls.download;
    assert.equal(fileName, 'cat.xlsx');
    assert.equal(blob.type, XLSX_MEDIA_TYPE);
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), BYTES);
    assert.equal(dom.item.disabled, false, 'enabled again');
  });

  it('exports a 500 × 500 pattern without asking', async () => {
    const { dom, calls } = setup({ pattern: sizedPattern(500, 500) });
    dom.item.dispatch('click');
    await settle();
    assert.equal(dom.dialog.open, false);
    assert.equal(calls.createWorkbook.length, 1);
  });
});

describe('Large workbook question', () => {
  it('asks before an 800 × 800 workbook', async () => {
    const { dom, calls } = setup({ pattern: sizedPattern(800, 800) });
    dom.item.dispatch('click');
    await settle();
    assert.equal(dom.dialog.open, true);
    assert.equal(dom.text.textContent, 'This workbook will have 640,000 chart cells (800 × 800). Large workbooks take longer to create and open slowly in spreadsheet programs.');
    assert.equal(calls.encodePictures.length, 0);
  });

  for (const [answer, act] of [['Cancel', (dom) => dom.cancel.dispatch('click')], ['Esc', (dom) => dom.pressEscape()]]) {
    it(`does nothing on ${answer}`, async () => {
      const { dom, store, calls } = setup({ pattern: sizedPattern(800, 800) });
      const statusBefore = store.getState().status;
      dom.item.dispatch('click');
      await settle();
      act(dom);
      await settle();
      assert.equal(dom.dialog.open, false);
      assert.equal(calls.encodePictures.length, 0);
      assert.equal(calls.createWorkbook.length, 0);
      assert.equal(store.getState().status, statusBefore);
      assert.equal(dom.item.disabled, false);
    });
  }

  it('exports on Create workbook', async () => {
    const { dom, store, calls } = setup({ pattern: sizedPattern(800, 800) });
    dom.item.dispatch('click');
    await settle();
    dom.confirm.dispatch('click');
    await settle();
    assert.equal(dom.dialog.open, false);
    assert.equal(calls.createWorkbook.length, 1);
    assert.equal(calls.download.length, 1);
    assert.equal(store.getState().status.text, 'Excel workbook ready: cat.xlsx');
  });
});

describe('Excel export limits and failures', () => {
  it('refuses a 2000 × 2000 pattern without a dialog', async () => {
    const { dom, store, calls } = setup({ pattern: sizedPattern(2000, 2000) });
    dom.item.dispatch('click');
    await settle();
    assert.equal(dom.dialog.open, false);
    assert.deepEqual(store.getState().status, {
      kind: 'error',
      text: 'This pattern is too large for an Excel workbook: 4,000,000 cells (2000 × 2000), at most 1,000,000. Choose a smaller width.',
    });
    assert.equal(calls.encodePictures.length, 0);
    assert.equal(calls.createWorkbook.length, 0);
    assert.equal(calls.download.length, 0);
  });

  it('shows the reason of a failure and enables the item again', async () => {
    const { dom, store, calls } = setup({ deps: { createWorkbook: () => Promise.reject(new Error('out of memory')) } });
    dom.item.dispatch('click');
    await settle();
    assert.deepEqual(store.getState().status, { kind: 'error', text: 'Could not create the Excel workbook: out of memory' });
    assert.equal(calls.download.length, 0);
    assert.equal(dom.item.disabled, false);
  });

  it('keeps a newer status set during the export', async () => {
    let finish;
    const { dom, store } = setup({ deps: { createWorkbook: () => new Promise((resolve) => { finish = resolve; }) } });
    dom.item.dispatch('click');
    await settle();
    const newer = { kind: 'loading', text: 'Loading dog.png…' };
    store.setState({ status: newer });
    finish(BYTES);
    await settle();
    assert.equal(store.getState().status, newer);
    assert.equal(dom.item.disabled, false);
  });
});
