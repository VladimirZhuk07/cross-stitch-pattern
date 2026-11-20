// Drives src/ui/pdf-export.js with fake DOM elements, a fake PDF worker client, a fake picture
// encoder and a fake download (see openspec/specs/pdf-export/spec.md).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fakeElement } from '../helpers/fake-legend-dom.js';
import { createStore } from '../../src/ui/store.js';
import { setupPdfExport } from '../../src/ui/pdf-export.js';

// The Export menu and the PDF dialog of index.html as fake elements. showModal opens the
// dialog; close closes it and fires 'close', like the native element (Esc closes it too).
function createDom() {
  const button = fakeElement('button', { 'data-action': 'export-pdf' });
  button.disabled = true;
  const menu = fakeElement('details', { 'data-role': 'export-menu' }, [button]);
  menu.open = true;
  const text = fakeElement('p', { 'data-role': 'pdf-export-text' });
  const progress = fakeElement('progress', { 'data-role': 'pdf-export-progress' });
  progress.hidden = true;
  progress.value = 0;
  const cancel = fakeElement('button', { 'data-action': 'cancel-pdf-export' });
  const confirmButton = fakeElement('button', { 'data-action': 'confirm-pdf-export' });
  const dialog = fakeElement('dialog', { 'data-role': 'pdf-export-dialog' }, [text, progress, cancel, confirmButton]);
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
  const root = fakeElement('body', {}, [menu, dialog]);
  return { root, button, menu, text, progress, cancel, confirmButton, dialog, pressEscape: () => dialog.close() };
}

// A promise with its resolve and reject functions.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// A fake PDF worker client whose export the test finishes by hand.
function createFakeClient() {
  const client = {
    requests: [],
    stopCount: 0,
    job: null,
    exportPdf(request, onProgress) {
      client.job = { ...deferred(), onProgress };
      client.requests.push(request);
      return client.job.promise;
    },
    stop() {
      client.stopCount += 1;
    },
  };
  return client;
}

// A pattern-like object of width × height stitches with 24 colors (the plan reads only these).
function fakePattern(width, height) {
  return { width, height, legend: Array.from({ length: 24 }, (_, index) => ({ number: index + 1 })) };
}

const PICTURES = { original: new Uint8Array([1]), dmc: new Uint8Array([2]) };

function setup({ pattern = fakePattern(450, 800), encodePictures = async () => PICTURES } = {}) {
  const dom = createDom();
  const store = createStore({
    image: { fileName: 'cat.png', width: 1200, height: 900 },
    pattern: null,
    settings: { targetWidth: 450, maxColors: 24, fabricCount: 14 },
  });
  const client = createFakeClient();
  const downloads = [];
  const encodeCalls = [];
  const encode = async (image, patternToEncode) => {
    encodeCalls.push({ image, pattern: patternToEncode });
    return encodePictures(image, patternToEncode);
  };
  setupPdfExport(dom.root, store, { client, encodePictures: encode, download: (blob, name) => downloads.push({ blob, name }) });
  store.setState({ pattern });
  return { dom, store, client, downloads, encodeCalls };
}

// Lets pending promise callbacks run.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('setupPdfExport', () => {
  it('enables PDF chart exactly while a pattern exists', () => {
    const { dom, store } = setup();
    assert.equal(dom.button.disabled, false);
    store.setState({ pattern: null });
    assert.equal(dom.button.disabled, true);
  });

  it('closes the menu when PDF chart is chosen', () => {
    const { dom } = setup();
    dom.button.dispatch('click');
    assert.equal(dom.menu.open, false);
    assert.equal(dom.dialog.open, true);
  });

  it('starts 92 pages at once, downloads cat.pdf and closes the dialog', async () => {
    const { dom, client, downloads, encodeCalls } = setup();
    dom.button.dispatch('click');
    assert.equal(dom.text.textContent, 'Creating the PDF: 92 pages (90 chart pages)…');
    assert.equal(dom.progress.hidden, false);
    assert.equal(dom.progress.value, 0);
    assert.equal(dom.confirmButton.hidden, true);
    assert.equal(dom.cancel.textContent, 'Cancel');
    assert.equal(dom.button.disabled, true, 'disabled while running');
    await settle();
    assert.equal(encodeCalls.length, 1);
    assert.deepEqual(client.requests[0], { pattern: fakePattern(450, 800), fileName: 'cat.png', fabricCount: 14, pictures: PICTURES });
    client.job.resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    await settle();
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, 'cat.pdf');
    assert.equal(downloads[0].blob.type, 'application/pdf');
    assert.equal(downloads[0].blob.size, 4);
    assert.equal(dom.dialog.open, false);
    assert.equal(dom.button.disabled, false);
  });

  it('asks before 102 pages; Cancel exports nothing', async () => {
    const { dom, client, encodeCalls } = setup({ pattern: fakePattern(500, 800) });
    dom.button.dispatch('click');
    assert.equal(
      dom.text.textContent,
      'This PDF will have 102 pages (100 chart pages). Large PDFs take a while to create and print. Create it?',
    );
    assert.equal(dom.confirmButton.hidden, false);
    assert.equal(dom.confirmButton.textContent, 'Create PDF');
    assert.equal(dom.cancel.textContent, 'Cancel');
    assert.equal(dom.progress.hidden, true);
    dom.cancel.dispatch('click');
    await settle();
    assert.equal(dom.dialog.open, false);
    assert.equal(encodeCalls.length, 0);
    assert.equal(client.requests.length, 0);
  });

  it('asks before 102 pages; Esc exports nothing', async () => {
    const { dom, encodeCalls } = setup({ pattern: fakePattern(500, 800) });
    dom.button.dispatch('click');
    dom.pressEscape();
    await settle();
    assert.equal(encodeCalls.length, 0);
    assert.equal(dom.button.disabled, false);
  });

  it('asks before 102 pages; Create PDF exports', async () => {
    const { dom, client, downloads } = setup({ pattern: fakePattern(500, 800) });
    dom.button.dispatch('click');
    dom.confirmButton.dispatch('click');
    assert.equal(dom.text.textContent, 'Creating the PDF: 102 pages (100 chart pages)…');
    assert.equal(dom.dialog.open, true);
    await settle();
    client.job.resolve(new Uint8Array([1]));
    await settle();
    assert.equal(downloads.length, 1);
  });

  it('refuses 1,007 pages with Close and encodes nothing', async () => {
    const { dom, encodeCalls, client } = setup({ pattern: fakePattern(2000, 2000) });
    dom.button.dispatch('click');
    assert.equal(
      dom.text.textContent,
      'This pattern needs 1,007 PDF pages, but a PDF can have at most 1,000. Choose a smaller width to export a PDF.',
    );
    assert.equal(dom.cancel.textContent, 'Close');
    assert.equal(dom.confirmButton.hidden, true);
    assert.equal(dom.progress.hidden, true);
    dom.cancel.dispatch('click');
    await settle();
    assert.equal(dom.dialog.open, false);
    assert.equal(encodeCalls.length, 0);
    assert.equal(client.requests.length, 0);
  });

  it('shows the progress of 403 of 806 pages as 50', async () => {
    const { dom, client } = setup({ pattern: fakePattern(2000, 1600) });
    dom.button.dispatch('click');
    dom.confirmButton.dispatch('click');
    await settle();
    client.job.onProgress({ done: 403, total: 806 });
    assert.equal(dom.progress.value, 50);
  });

  it('stops the worker on Cancel while running, downloads nothing and enables the item again', async () => {
    const { dom, client, downloads } = setup();
    dom.button.dispatch('click');
    await settle();
    dom.cancel.dispatch('click');
    assert.equal(client.stopCount, 1);
    assert.equal(dom.dialog.open, false);
    assert.equal(dom.button.disabled, false);
    client.job.reject(new Error('The PDF export was stopped'));
    await settle();
    assert.equal(downloads.length, 0);
    assert.equal(dom.dialog.open, false, 'no error shown after a cancel');
  });

  it('stops at once on Cancel although the browser fires close a task later', async () => {
    const { dom, client } = setup();
    dom.dialog.close = () => {
      if (dom.dialog.open) {
        dom.dialog.open = false;
        setTimeout(() => dom.dialog.dispatch('close'), 0);
      }
    };
    dom.button.dispatch('click');
    await settle();
    dom.cancel.dispatch('click');
    assert.equal(client.stopCount, 1);
    assert.equal(dom.button.disabled, false);
    await settle();
    assert.equal(client.stopCount, 1, 'the late close event stops nothing twice');
  });

  it('stops the worker on Esc while running and ignores a late result', async () => {
    const { dom, client, downloads } = setup();
    dom.button.dispatch('click');
    await settle();
    dom.pressEscape();
    assert.equal(client.stopCount, 1);
    client.job.resolve(new Uint8Array([1]));
    await settle();
    assert.equal(downloads.length, 0);
  });

  it('cancels while the pictures are encoded, before the worker starts', async () => {
    const encoding = deferred();
    const { dom, client, downloads } = setup({ encodePictures: () => encoding.promise });
    dom.button.dispatch('click');
    dom.cancel.dispatch('click');
    encoding.resolve(PICTURES);
    await settle();
    assert.equal(client.requests.length, 0);
    assert.equal(downloads.length, 0);
  });

  it('shows the error when the pictures cannot be encoded, with Close', async () => {
    const { dom, client, downloads } = setup({
      encodePictures: async () => {
        throw new Error('this browser cannot encode JPEG pictures');
      },
    });
    dom.button.dispatch('click');
    await settle();
    assert.equal(dom.text.textContent, 'Could not create the PDF: this browser cannot encode JPEG pictures');
    assert.equal(dom.cancel.textContent, 'Close');
    assert.equal(dom.progress.hidden, true);
    assert.equal(dom.dialog.open, true);
    assert.equal(dom.button.disabled, false);
    assert.equal(client.requests.length, 0);
    assert.equal(downloads.length, 0);
    dom.cancel.dispatch('click');
    assert.equal(dom.dialog.open, false);
    assert.equal(client.stopCount, 0);
  });

  it('shows the error when the worker fails', async () => {
    const { dom, client } = setup();
    dom.button.dispatch('click');
    await settle();
    client.job.reject(new Error('The PDF worker stopped: out of memory'));
    await settle();
    assert.equal(dom.text.textContent, 'Could not create the PDF: The PDF worker stopped: out of memory');
  });

  it('exports the pattern and settings of the moment of the click', async () => {
    const { dom, store, client } = setup();
    const pattern = store.getState().pattern;
    dom.button.dispatch('click');
    store.setState({ pattern: fakePattern(10, 10), settings: { targetWidth: 10, maxColors: 24, fabricCount: 18 } });
    await settle();
    assert.equal(client.requests[0].pattern, pattern);
    assert.equal(client.requests[0].fabricCount, 14);
  });
});
