// The one saved progress of this browser, in IndexedDB (openspec/specs/stitch-progress/spec.md,
// "Progress is saved in this browser"). IndexedDB rather than localStorage: the stitched bits
// of a 10000 × 10000 pattern are 12.5 MB, more than localStorage holds, and IndexedDB stores
// a Uint8Array as it is. Everything stays on this device. The record is a SavedProgress
// (../core/progress.js) under one fixed key: a save replaces it.

const DATABASE_NAME = 'cross-stitch-pattern-maker';
const DATABASE_VERSION = 1;
const STORE_NAME = 'progress';
const RECORD_KEY = 'current';

/**
 * Opens the progress store.
 * indexedDBFactory  the IndexedDB factory (default globalThis.indexedDB; tests pass a fake)
 * Resolves to { load(), save(record), clear() }:
 *   load()        resolves to the saved record, or null when nothing is saved
 *   save(record)  stores record (replacing the previous one); resolves when it is written
 *   clear()       deletes the saved record; resolves when it is gone
 * Rejects when IndexedDB is missing or cannot be opened (blocked storage, some private modes);
 * load, save and clear reject when their transaction fails (e.g. quota exceeded).
 */
export async function openProgressStore(indexedDBFactory = globalThis.indexedDB) {
  if (!indexedDBFactory) {
    throw new Error('IndexedDB is not available in this browser');
  }
  const database = await openDatabase(indexedDBFactory);
  return {
    load: () => run(database, 'readonly', (store) => store.get(RECORD_KEY)).then((record) => record ?? null),
    save: (record) => run(database, 'readwrite', (store) => store.put(record, RECORD_KEY)).then(() => undefined),
    clear: () => run(database, 'readwrite', (store) => store.delete(RECORD_KEY)).then(() => undefined),
  };
}

function openDatabase(indexedDBFactory) {
  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened'));
    request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
  });
}

// Runs one request in its own transaction; resolves with the request's result once the
// transaction has completed (so a save is really written), rejects when it fails.
function run(database, mode, makeRequest) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = makeRequest(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('IndexedDB request failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}
