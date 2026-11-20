// Drives src/ui/progress-file.js with the real store and codec, a fake download, a fake Export
// menu, a fake warning and a fake persistence (see openspec/specs/stitch-progress/spec.md,
// "Progress can be saved as a .stitch file" and the requirements after it).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { createProgress, toggleStitch, toSavedProgress, isStitched } from '../../src/core/progress.js';
import { decodeProgressFile, encodeProgressFile, MAX_PROGRESS_FILE_BYTES } from '../../src/core/progress-file.js';
import { createStore } from '../../src/ui/store.js';
import { createInitialState } from '../../src/ui/app-state.js';
import { createProgressFileSaver, setupProgressFileMenu } from '../../src/ui/progress-file.js';
import { fakeElement } from '../helpers/fake-legend-dom.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function solidPattern(width, height) {
  return buildPattern({ width, height, cells: new Int16Array(width * height), colors: [BLACK] });
}

function otherPattern() {
  return buildPattern({ width: 2, height: 2, cells: [0, 0, 0, 0], colors: [BLACK] });
}

function progressWith(pattern, cellIndexes) {
  let progress = createProgress(pattern);
  for (const cellIndex of cellIndexes) {
    progress = toggleStitch(progress, cellIndex);
  }
  return progress;
}

// The cell indexes 0, 1, … count - 1 shifted by first.
function cellRange(first, count) {
  return Array.from({ length: count }, (_, index) => first + index);
}

// A download stand-in that records { bytes, fileName }.
function fakeDownload() {
  const files = [];
  const download = (bytes, fileName) => {
    files.push({ bytes, fileName });
  };
  return { files, download };
}

function storeWith(pattern, cellIndexes, fileName = 'cat.png') {
  return createStore({
    ...createInitialState(),
    image: { fileName },
    pattern,
    progress: progressWith(pattern, cellIndexes),
  });
}

describe('progress file saver', () => {
  it('saves the current progress as cat.stitch for cat.png', async () => {
    const pattern = threeByTwoPattern();
    const { files, download } = fakeDownload();
    const saver = createProgressFileSaver(storeWith(pattern, [0, 4]), download);
    assert.equal(await saver.saveCurrent(), 'cat.stitch');
    assert.equal(files.length, 1);
    assert.equal(files[0].fileName, 'cat.stitch');
    const loaded = await decodeProgressFile(files[0].bytes, pattern);
    assert.equal(loaded.stitchedCount, 2);
    assert.ok(isStitched(loaded, 0) && isStitched(loaded, 4));
  });

  it('names the file after the image', async () => {
    const pattern = threeByTwoPattern();
    for (const [imageName, fileName] of [['IMG_0042.JPG', 'IMG_0042.stitch'], ['cat.photo.png', 'cat.photo.stitch'], ['.png', 'pattern.stitch']]) {
      const { files, download } = fakeDownload();
      await createProgressFileSaver(storeWith(pattern, [0], imageName), download).saveCurrent();
      assert.equal(files[0].fileName, fileName);
    }
  });

  it('saves a record of the browser storage under its image name', async () => {
    const other = otherPattern();
    const { files, download } = fakeDownload();
    const saver = createProgressFileSaver(storeWith(threeByTwoPattern(), []), download);
    const record = toSavedProgress(progressWith(other, [0, 3]), 'dog.png', 1);
    assert.equal(await saver.saveRecord(record), 'dog.stitch');
    assert.equal(files[0].fileName, 'dog.stitch');
    assert.equal((await decodeProgressFile(files[0].bytes, other)).stitchedCount, 2);
    assert.equal(await saver.saveRecord({ ...record, imageName: '' }), 'pattern.stitch');
  });
});

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

// Lets pending promise callbacks run for a while (before asserting that nothing happened).
async function settle() {
  for (let turn = 0; turn < 20; turn++) {
    await nextTurn();
  }
}

// Waits until isDone() is true. The (de)compression streams take a varying number of turns,
// so the tests wait for what they observe instead of counting turns.
async function waitFor(isDone, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!isDone()) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${isDone}`);
    }
    await nextTurn();
  }
}

// The Export menu of index.html with this change's two items, as fake elements.
function createMenuDom() {
  const saveItem = fakeElement('button', { 'data-action': 'export-progress' });
  saveItem.disabled = true;
  const fileInput = fakeElement('input', { 'data-role': 'progress-file-input' });
  fileInput.disabled = true;
  fileInput.value = '';
  fileInput.files = [];
  const menu = fakeElement('details', { 'data-role': 'export-menu' }, [saveItem, fileInput]);
  menu.open = false;
  const root = fakeElement('body', {}, [menu]);
  // The user picks file in the chooser opened from the menu.
  const choose = (file) => {
    menu.open = true;
    fileInput.value = `fakepath/${file.name}`;
    fileInput.files = [file];
    fileInput.dispatch('change');
  };
  return { root, menu, saveItem, fileInput, choose };
}

// A File stand-in: the module reads only name and size; the bytes come through readBytes.
const fakeFile = (name, bytes) => ({ name, size: bytes.length, bytes });

async function fileOf(pattern, cellIndexes) {
  const { fingerprint, width, height } = pattern;
  return encodeProgressFile({ fingerprint, width, height, bits: progressWith(pattern, cellIndexes).bits });
}

// Sets up the menu with recording fakes. answer is the reply of the warning and of
// confirmFirstMark.
function setupMenu(state, { answer = true, saveFails = false } = {}) {
  const store = createStore({ ...createInitialState(), image: { fileName: 'cat.png' }, ...state });
  const dom = createMenuDom();
  const calls = { saveCurrent: 0, confirmFirstMark: 0, adopted: [], questions: [], reads: 0 };
  const saver = {
    saveCurrent: async () => {
      calls.saveCurrent += 1;
      if (saveFails) {
        throw new Error('no CompressionStream');
      }
      return 'cat.stitch';
    },
  };
  const warning = {
    confirm: async (question) => {
      calls.questions.push(question);
      return answer;
    },
  };
  const persistence = {
    confirmFirstMark: async () => {
      calls.confirmFirstMark += 1;
      return answer;
    },
    adoptProgress: (progress, fileName) => {
      calls.adopted.push({ progress, fileName });
    },
  };
  const readBytes = async (file) => {
    calls.reads += 1;
    return file.bytes;
  };
  setupProgressFileMenu(dom.root, store, { saver, warning, persistence, readBytes });
  return { store, dom, calls, saver };
}

describe('Export menu progress items: enabling', () => {
  it('disables both items without a pattern', () => {
    const { dom } = setupMenu({});
    assert.equal(dom.saveItem.disabled, true);
    assert.equal(dom.fileInput.disabled, true);
  });

  it('enables Load but not Save without marks, and Save while a stitch is marked', () => {
    const pattern = threeByTwoPattern();
    const { store, dom } = setupMenu({ pattern, progress: createProgress(pattern) });
    assert.equal(dom.saveItem.disabled, true);
    assert.equal(dom.fileInput.disabled, false);
    store.setState({ progress: toggleStitch(store.getState().progress, 0) });
    assert.equal(dom.saveItem.disabled, false);
    store.setState({ progress: toggleStitch(store.getState().progress, 0) });
    assert.equal(dom.saveItem.disabled, true);
  });

  it('disables Load while a pattern is being generated', () => {
    const pattern = threeByTwoPattern();
    const { store, dom } = setupMenu({ pattern, progress: progressWith(pattern, [0]) });
    store.setState({ generation: { kind: 'running', text: 'Generating…' } });
    assert.equal(dom.fileInput.disabled, true);
    assert.equal(dom.saveItem.disabled, false);
    store.setState({ generation: { kind: 'done', text: '' } });
    assert.equal(dom.fileInput.disabled, false);
  });
});

describe('Export menu progress items: saving', () => {
  it('closes the menu and saves the current progress', async () => {
    const pattern = threeByTwoPattern();
    const { dom, calls } = setupMenu({ pattern, progress: progressWith(pattern, [0]) });
    dom.menu.open = true;
    dom.saveItem.dispatch('click');
    assert.equal(dom.menu.open, false);
    await waitFor(() => calls.saveCurrent === 1);
    assert.equal(calls.saveCurrent, 1);
  });

  it('shows the failure in the status line and keeps the marks', async (t) => {
    t.mock.method(console, 'error', () => {});
    const pattern = threeByTwoPattern();
    const { store, dom } = setupMenu({ pattern, progress: progressWith(pattern, [0]) }, { saveFails: true });
    dom.saveItem.dispatch('click');
    await waitFor(() => store.getState().status.kind === 'error');
    assert.deepEqual(store.getState().status, { kind: 'error', text: 'Could not save the progress file.' });
    assert.equal(store.getState().progress.stitchedCount, 1);
  });
});

describe('Export menu progress items: loading', () => {
  it('asks the first-mark question without marks, then adopts the file', async () => {
    const pattern = threeByTwoPattern();
    const { dom, calls } = setupMenu({ pattern, progress: createProgress(pattern) });
    dom.choose(fakeFile('cat.stitch', await fileOf(pattern, [0, 4])));
    assert.equal(dom.menu.open, false);
    await waitFor(() => calls.adopted.length === 1);
    assert.equal(calls.confirmFirstMark, 1);
    assert.equal(calls.questions.length, 0);
    assert.equal(calls.adopted.length, 1);
    assert.equal(calls.adopted[0].fileName, 'cat.stitch');
    assert.equal(calls.adopted[0].progress.pattern, pattern);
    assert.equal(calls.adopted[0].progress.stitchedCount, 2);
  });

  it('adopts nothing when the first-mark question is answered no', async () => {
    const pattern = threeByTwoPattern();
    const { dom, calls } = setupMenu({ pattern, progress: createProgress(pattern) }, { answer: false });
    dom.choose(fakeFile('cat.stitch', await fileOf(pattern, [0])));
    await waitFor(() => calls.confirmFirstMark === 1);
    await settle();
    assert.equal(calls.adopted.length, 0);
  });

  it('asks before replacing 12 marks, offering Save progress first', async () => {
    const pattern = solidPattern(10, 10);
    const { dom, calls, saver } = setupMenu({ pattern, progress: progressWith(pattern, cellRange(0, 12)) });
    dom.choose(fakeFile('cat.stitch', await fileOf(pattern, cellRange(50, 40))));
    await waitFor(() => calls.adopted.length === 1);
    assert.equal(calls.confirmFirstMark, 0);
    assert.equal(calls.questions.length, 1);
    assert.equal(calls.questions[0].text, "Load cat.stitch? Your progress on this pattern (12 of 100 stitches) will be replaced by the file's (40 of 100 stitches).");
    assert.equal(calls.questions[0].confirmLabel, 'Load progress');
    assert.equal(calls.questions[0].saveFirst, saver.saveCurrent);
    assert.equal(calls.adopted.length, 1);
    assert.equal(calls.adopted[0].progress.stitchedCount, 40);
  });

  it('leaves the marks alone when the user keeps them', async () => {
    const pattern = solidPattern(10, 10);
    const { store, dom, calls } = setupMenu({ pattern, progress: progressWith(pattern, [1, 2]) }, { answer: false });
    const before = store.getState().progress;
    dom.choose(fakeFile('cat.stitch', await fileOf(pattern, [5])));
    await waitFor(() => calls.questions.length === 1);
    await settle();
    assert.equal(calls.adopted.length, 0);
    assert.equal(store.getState().progress, before);
  });

  it("shows the error of another pattern's file without asking", async () => {
    const pattern = solidPattern(100, 67);
    const { store, dom, calls } = setupMenu({ pattern, progress: progressWith(pattern, [1]) });
    dom.choose(fakeFile('cat.stitch', await fileOf(solidPattern(120, 80), [0])));
    await waitFor(() => store.getState().status.kind === 'error');
    assert.deepEqual(store.getState().status, {
      kind: 'error',
      text: 'Could not load cat.stitch: it belongs to another picture or other pattern settings. It is for a 120 × 80 pattern; this one is 100 × 67.',
    });
    assert.equal(calls.questions.length + calls.confirmFirstMark + calls.adopted.length, 0);
  });

  it('keeps the file name as text in the error', async () => {
    const pattern = threeByTwoPattern();
    const { store, dom } = setupMenu({ pattern, progress: createProgress(pattern) });
    dom.choose(fakeFile('<b>x</b>.stitch', new TextEncoder().encode('not a progress file at all, just some notes')));
    await waitFor(() => store.getState().status.kind === 'error');
    assert.equal(store.getState().status.text, 'Could not load <b>x</b>.stitch: it is not a progress file (.stitch).');
  });

  it('refuses a file over 16 MiB without reading it', async () => {
    const pattern = threeByTwoPattern();
    const { store, dom, calls } = setupMenu({ pattern, progress: createProgress(pattern) });
    dom.choose({ name: 'big.stitch', size: MAX_PROGRESS_FILE_BYTES + 1, bytes: null });
    await waitFor(() => store.getState().status.kind === 'error');
    assert.equal(calls.reads, 0);
    assert.equal(store.getState().status.text, 'Could not load big.stitch: it is not a progress file (.stitch).');
  });

  it('adopts nothing when the pattern changes while the file is read', async () => {
    const pattern = threeByTwoPattern();
    const { store, dom, calls } = setupMenu({ pattern, progress: createProgress(pattern) });
    const bytes = await fileOf(pattern, [0]);
    let release;
    const pending = new Promise((resolve) => {
      release = () => resolve(bytes);
    });
    dom.choose({ name: 'cat.stitch', size: bytes.length, bytes: pending });
    await waitFor(() => calls.reads === 1);
    const next = otherPattern();
    store.setState({ pattern: next, progress: createProgress(next) });
    release();
    await settle();
    assert.equal(calls.confirmFirstMark + calls.adopted.length, 0);
    assert.notEqual(store.getState().status.kind, 'error');
  });

  it('resets the chooser after every choice, so the same file can be chosen again', async () => {
    const pattern = threeByTwoPattern();
    const { dom, calls } = setupMenu({ pattern, progress: progressWith(pattern, [1]) }, { answer: false });
    const file = fakeFile('cat.stitch', await fileOf(pattern, [0]));
    dom.choose(file);
    assert.equal(dom.fileInput.value, '');
    await waitFor(() => calls.questions.length === 1);
    dom.choose(file);
    assert.equal(dom.fileInput.value, '');
    await waitFor(() => calls.questions.length === 2);
    assert.equal(calls.questions.length, 2);
  });
});
