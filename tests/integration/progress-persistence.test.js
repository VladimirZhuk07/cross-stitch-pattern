// Drives src/ui/progress-persistence.js with the real store, mocked timers, an in-memory fake of
// the IndexedDB adapter (src/io/progress-store.js), a fake note and a fake warning (see
// openspec/specs/stitch-progress/spec.md, "Progress is saved in this browser" and the
// requirements after it).

import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { createProgress, toggleStitch, toSavedProgress, RESTORED_NOTE, UNSAVED_NOTE } from '../../src/core/progress.js';
import { createStore } from '../../src/ui/store.js';
import { createInitialState } from '../../src/ui/app-state.js';
import { setupProgressPersistence } from '../../src/ui/progress-persistence.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function otherPattern() {
  return buildPattern({ width: 2, height: 2, cells: [0, 0, 0, 0], colors: [BLACK] });
}

// An in-memory stand-in for the store of openProgressStore: one record, every call recorded.
function fakeProgressStore(initial = null, { failSaves = false } = {}) {
  const calls = [];
  let record = initial;
  return {
    calls,
    get record() {
      return record;
    },
    load: async () => {
      calls.push('load');
      return record;
    },
    save: async (next) => {
      calls.push('save');
      if (failSaves) {
        throw new Error('QuotaExceededError');
      }
      record = next;
    },
    clear: async () => {
      calls.push('clear');
      record = null;
    },
  };
}

// The page parts the module touches: the note output, the document (visibility), the warning.
function setup({ storePromise, state = {}, answer = true, saver = null } = {}) {
  const note = { textContent: '', hidden: true, classList: { toggle: (name, force) => { note.isError = force; } } };
  const pageListeners = {};
  const root = {
    querySelector: (selector) => (selector === '[data-role="progress-note"]' ? note : null),
    addEventListener: (type, listener) => {
      pageListeners[type] = listener;
    },
    visibilityState: 'visible',
  };
  const questions = [];
  const warning = {
    confirm: async (question) => {
      questions.push(question);
      return answer;
    },
  };
  const store = createStore({ ...createInitialState(), activeLayer: 'progress', image: { fileName: 'dog.png' }, ...state });
  const persistence = setupProgressPersistence(root, store, storePromise, warning, saver);
  const hidePage = () => {
    root.visibilityState = 'hidden';
    pageListeners.visibilitychange?.();
  };
  return { store, persistence, note, questions, hidePage };
}

// Lets awaited promises (store calls) settle.
async function settle() {
  for (let round = 0; round < 10; round++) {
    await Promise.resolve();
  }
}

// Stores a pattern and its fresh Progress, as setupProgress does.
function showPattern(store, pattern) {
  store.setState({ pattern, progress: createProgress(pattern) });
}

function toggle(store, index) {
  store.setState({ progress: toggleStitch(store.getState().progress, index) });
}

describe('progress persistence: saving', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  it('saves once, 500 ms after the last of several marks', async () => {
    const fake = fakeProgressStore();
    const { store } = setup({ storePromise: Promise.resolve(fake) });
    const pattern = threeByTwoPattern();
    showPattern(store, pattern);
    await settle();
    toggle(store, 0);
    mock.timers.tick(300);
    toggle(store, 1);
    mock.timers.tick(300);
    toggle(store, 2);
    mock.timers.tick(499);
    await settle();
    assert.equal(fake.calls.filter((call) => call === 'save').length, 0);
    mock.timers.tick(1);
    await settle();
    assert.equal(fake.calls.filter((call) => call === 'save').length, 1);
    assert.equal(fake.record.fingerprint, pattern.fingerprint);
    assert.equal(fake.record.stitchedCount, 3);
    assert.equal(fake.record.totalCount, 5);
    assert.equal(fake.record.imageName, 'dog.png');
  });

  it('deletes the saved progress when the last mark is undone', async () => {
    const fake = fakeProgressStore();
    const { store } = setup({ storePromise: Promise.resolve(fake) });
    showPattern(store, threeByTwoPattern());
    await settle();
    toggle(store, 0);
    mock.timers.tick(500);
    await settle();
    toggle(store, 0);
    mock.timers.tick(500);
    await settle();
    assert.equal(fake.calls.at(-1), 'clear');
    assert.equal(fake.record, null);
  });

  it('saves at once when the page is hidden', async () => {
    const fake = fakeProgressStore();
    const { store, hidePage } = setup({ storePromise: Promise.resolve(fake) });
    showPattern(store, threeByTwoPattern());
    await settle();
    toggle(store, 0);
    hidePage();
    await settle();
    assert.equal(fake.calls.filter((call) => call === 'save').length, 1);
    mock.timers.tick(500);
    await settle();
    assert.equal(fake.calls.filter((call) => call === 'save').length, 1, 'no second save afterwards');
  });

  it('cancels a pending save on discard and deletes the saved progress', async () => {
    const pattern = threeByTwoPattern();
    const fake = fakeProgressStore(toSavedProgress(toggleStitch(createProgress(pattern), 0), 'dog.png', 1));
    const { store, persistence } = setup({ storePromise: Promise.resolve(fake) });
    showPattern(store, pattern);
    await settle();
    toggle(store, 1);
    await persistence.discard();
    mock.timers.tick(500);
    await settle();
    assert.equal(fake.record, null);
    assert.ok(!fake.calls.includes('save'));
  });
});

describe('progress persistence: restoring', () => {
  it('restores the marks of the same pattern and notes it until the next mark', async () => {
    const saved = toSavedProgress(toggleStitch(toggleStitch(createProgress(threeByTwoPattern()), 0), 5), 'cat.png', 1);
    const fake = fakeProgressStore(saved);
    const { store, note } = setup({ storePromise: Promise.resolve(fake) });
    const pattern = threeByTwoPattern();
    showPattern(store, pattern);
    await settle();
    const { progress } = store.getState();
    assert.equal(progress.pattern, pattern);
    assert.equal(progress.stitchedCount, 2);
    assert.equal(note.textContent, RESTORED_NOTE);
    assert.equal(note.hidden, false);
    toggle(store, 1);
    assert.equal(note.hidden, true);
  });

  it('leaves the saved progress of another pattern alone', async () => {
    const saved = toSavedProgress(toggleStitch(createProgress(otherPattern()), 0), 'cat.png', 1);
    const fake = fakeProgressStore(saved);
    const { store, note } = setup({ storePromise: Promise.resolve(fake) });
    showPattern(store, threeByTwoPattern());
    await settle();
    assert.equal(store.getState().progress.stitchedCount, 0);
    assert.equal(fake.record, saved);
    assert.equal(note.hidden, true);
  });

  it('does not restore over marks made while loading', async () => {
    const saved = toSavedProgress(toggleStitch(createProgress(threeByTwoPattern()), 5), 'cat.png', 1);
    let releaseStore;
    const storePromise = new Promise((resolve) => {
      releaseStore = () => resolve(fakeProgressStore(saved));
    });
    const { store } = setup({ storePromise });
    showPattern(store, threeByTwoPattern());
    toggle(store, 0);
    releaseStore();
    await settle();
    assert.equal(store.getState().progress.lastToggled, 0);
    assert.equal(store.getState().progress.stitchedCount, 1);
  });
});

describe('progress persistence: replacing the saved progress of another pattern', () => {
  it('asks before the first mark, with the saved image and counts', async () => {
    const saved = toSavedProgress(toggleStitch(createProgress(otherPattern()), 0), 'cat.png', 1);
    const { store, persistence, questions } = setup({ storePromise: Promise.resolve(fakeProgressStore(saved)), answer: false });
    showPattern(store, threeByTwoPattern());
    await settle();
    assert.equal(await persistence.confirmFirstMark(), false);
    assert.deepEqual(questions, [{
      text: 'Start a new progress? This browser keeps one progress: the saved one for cat.png (1 of 4 stitches) will be replaced.',
      confirmLabel: 'Start new progress',
    }]);
  });

  it('remembers a yes for the pattern', async () => {
    const saved = toSavedProgress(toggleStitch(createProgress(otherPattern()), 0), 'cat.png', 1);
    const { store, persistence, questions } = setup({ storePromise: Promise.resolve(fakeProgressStore(saved)), answer: true });
    showPattern(store, threeByTwoPattern());
    await settle();
    assert.equal(await persistence.confirmFirstMark(), true);
    assert.equal(await persistence.confirmFirstMark(), true);
    assert.equal(questions.length, 1);
  });

  it('does not ask when nothing, or this pattern, is saved', async () => {
    const own = toSavedProgress(toggleStitch(createProgress(threeByTwoPattern()), 0), 'dog.png', 1);
    for (const initial of [null, own]) {
      const { store, persistence, questions } = setup({ storePromise: Promise.resolve(fakeProgressStore(initial)) });
      showPattern(store, threeByTwoPattern());
      await settle();
      assert.equal(await persistence.confirmFirstMark(), true);
      assert.equal(questions.length, 0);
    }
  });
});

describe('progress persistence: no storage', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  it('tells the user once when the store cannot be opened, and marking still works', async () => {
    const errors = mock.method(console, 'error', () => {});
    const { store, note, persistence } = setup({ storePromise: Promise.reject(new Error('blocked')) });
    showPattern(store, threeByTwoPattern());
    await settle();
    toggle(store, 0);
    mock.timers.tick(500);
    await settle();
    assert.equal(note.textContent, UNSAVED_NOTE);
    assert.equal(note.hidden, false);
    assert.equal(note.isError, true);
    assert.equal(store.getState().progress.stitchedCount, 1);
    assert.equal(await persistence.confirmFirstMark(), true);
    assert.equal(errors.mock.callCount(), 1);
    errors.mock.restore();
  });

  it('stops saving after a failed save and says so', async () => {
    const errors = mock.method(console, 'error', () => {});
    const fake = fakeProgressStore(null, { failSaves: true });
    const { store, note } = setup({ storePromise: Promise.resolve(fake) });
    showPattern(store, threeByTwoPattern());
    await settle();
    toggle(store, 0);
    mock.timers.tick(500);
    await settle();
    toggle(store, 1);
    mock.timers.tick(500);
    await settle();
    assert.equal(fake.calls.filter((call) => call === 'save').length, 1);
    assert.equal(note.textContent, UNSAVED_NOTE);
    errors.mock.restore();
  });
});

// A Progress of pattern with the given cells stitched and version 0, as decodeProgressFile gives.
function loadedProgress(pattern, cellIndexes) {
  let progress = createProgress(pattern);
  for (const cellIndex of cellIndexes) {
    progress = toggleStitch(progress, cellIndex);
  }
  return { ...progress, version: 0, lastToggled: null };
}

describe('progress persistence: a loaded progress file', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  it('becomes the progress on the Progress layer, with a note, and is saved at once', async () => {
    const fake = fakeProgressStore();
    const { store, persistence, note } = setup({ storePromise: Promise.resolve(fake), state: { activeLayer: 'chart' } });
    const pattern = threeByTwoPattern();
    showPattern(store, pattern);
    await settle();
    const loaded = loadedProgress(pattern, [0, 4]);
    persistence.adoptProgress(loaded, 'cat.stitch');
    assert.equal(store.getState().progress, loaded);
    assert.equal(store.getState().activeLayer, 'progress');
    assert.equal(note.textContent, 'Loaded your progress from cat.stitch.');
    assert.equal(note.hidden, false);
    await settle();
    assert.equal(fake.calls.filter((call) => call === 'save').length, 1, 'saved without a timer');
    assert.equal(fake.record.stitchedCount, 2);
    assert.equal(fake.record.fingerprint, pattern.fingerprint);
  });

  it('clears the loaded note with the next mark', async () => {
    const { store, persistence, note } = setup({ storePromise: Promise.resolve(fakeProgressStore()) });
    const pattern = threeByTwoPattern();
    showPattern(store, pattern);
    await settle();
    persistence.adoptProgress(loadedProgress(pattern, [0]), 'cat.stitch');
    toggle(store, 1);
    assert.equal(note.hidden, true);
    assert.equal(note.textContent, '');
  });

  it('clears the loaded note with a new pattern', async () => {
    const { store, persistence, note } = setup({ storePromise: Promise.resolve(fakeProgressStore()) });
    const pattern = threeByTwoPattern();
    showPattern(store, pattern);
    await settle();
    persistence.adoptProgress(loadedProgress(pattern, [0]), 'cat.stitch');
    showPattern(store, otherPattern());
    assert.equal(note.hidden, true);
  });

  it('does not ask before the next first mark, even with another pattern saved', async () => {
    const saved = toSavedProgress(toggleStitch(createProgress(otherPattern()), 0), 'dog.png', 1);
    const fake = fakeProgressStore(saved);
    const { store, persistence, questions } = setup({ storePromise: Promise.resolve(fake) });
    const pattern = threeByTwoPattern();
    showPattern(store, pattern);
    await settle();
    persistence.adoptProgress(loadedProgress(pattern, []), 'empty.stitch');
    await settle();
    assert.equal(await persistence.confirmFirstMark(), true);
    assert.equal(questions.length, 0);
    assert.equal(fake.record, saved, "a file without marks leaves another pattern's record alone");
  });

  it('cancels a pending save of the marks it replaces', async () => {
    const fake = fakeProgressStore();
    const { store, persistence } = setup({ storePromise: Promise.resolve(fake) });
    const pattern = threeByTwoPattern();
    showPattern(store, pattern);
    await settle();
    toggle(store, 1);
    persistence.adoptProgress(loadedProgress(pattern, [0, 4, 5]), 'cat.stitch');
    await settle();
    mock.timers.tick(500);
    await settle();
    assert.equal(fake.calls.filter((call) => call === 'save').length, 1);
    assert.equal(fake.record.stitchedCount, 3);
  });

  it('keeps the unsaved note and saves nothing without storage', async () => {
    const errors = mock.method(console, 'error', () => {});
    const { store, persistence, note } = setup({ storePromise: Promise.reject(new Error('blocked')) });
    const pattern = threeByTwoPattern();
    showPattern(store, pattern);
    await settle();
    const loaded = loadedProgress(pattern, [0]);
    persistence.adoptProgress(loaded, 'cat.stitch');
    await settle();
    assert.equal(store.getState().progress, loaded);
    assert.equal(note.textContent, UNSAVED_NOTE);
    assert.equal(note.hidden, false);
    errors.mock.restore();
  });

  it("deletes this pattern's saved progress when the file has no stitch", async () => {
    const pattern = threeByTwoPattern();
    const fake = fakeProgressStore(toSavedProgress(toggleStitch(createProgress(pattern), 0), 'cat.png', 1));
    const { store, persistence } = setup({ storePromise: Promise.resolve(fake) });
    showPattern(store, pattern);
    await settle();
    persistence.adoptProgress(loadedProgress(pattern, []), 'cat.stitch');
    await settle();
    assert.equal(fake.calls.at(-1), 'clear');
    assert.equal(fake.record, null);
  });
});

describe('progress persistence: Save progress first in the replace question', () => {
  it("offers to save the other pattern's record as a file", async () => {
    const saved = toSavedProgress(toggleStitch(createProgress(otherPattern()), 0), 'dog.png', 1);
    const records = [];
    const saver = { saveRecord: async (record) => { records.push(record); return 'dog.stitch'; } };
    const { store, persistence, questions } = setup({ storePromise: Promise.resolve(fakeProgressStore(saved)), answer: false, saver });
    showPattern(store, threeByTwoPattern());
    await settle();
    await persistence.confirmFirstMark();
    assert.equal(questions.length, 1);
    assert.equal(questions[0].confirmLabel, 'Start new progress');
    assert.equal(await questions[0].saveFirst(), 'dog.stitch');
    assert.deepEqual(records, [saved]);
  });
});
