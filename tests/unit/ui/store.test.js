// The store lives in src/ui/ (architecture.md) but uses no DOM, so it is tested here in Node.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../../src/ui/store.js';

describe('createStore', () => {
  it('returns the initial state from getState', () => {
    const store = createStore({ count: 0, name: 'a' });
    assert.deepEqual(store.getState(), { count: 0, name: 'a' });
  });

  it('does not keep a reference to the initial object', () => {
    const initial = { count: 0 };
    const store = createStore(initial);
    initial.count = 5;
    assert.equal(store.getState().count, 0);
  });

  it('merges a partial update shallowly into a new object', () => {
    const store = createStore({ count: 0, name: 'a' });
    const before = store.getState();
    store.setState({ count: 1 });
    assert.deepEqual(store.getState(), { count: 1, name: 'a' });
    assert.notEqual(store.getState(), before);
  });

  it('freezes the state so modules cannot mutate it directly', () => {
    const store = createStore({ count: 0 });
    assert.ok(Object.isFrozen(store.getState()));
    store.setState({ count: 1 });
    assert.ok(Object.isFrozen(store.getState()));
  });

  it('calls listeners with the new and the previous state, in subscription order', () => {
    const store = createStore({ count: 0 });
    const calls = [];
    store.subscribe((state, previous) => calls.push(['first', state.count, previous.count]));
    store.subscribe((state, previous) => calls.push(['second', state.count, previous.count]));
    store.setState({ count: 1 });
    assert.deepEqual(calls, [['first', 1, 0], ['second', 1, 0]]);
  });

  it('does not notify when every given value is identical to the current one', () => {
    const shared = { x: 1 };
    const store = createStore({ count: 0, shared });
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    store.setState({ count: 0, shared });
    assert.equal(calls, 0);
  });

  it('stops calling a listener after it unsubscribes', () => {
    const store = createStore({ count: 0 });
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls += 1; });
    store.setState({ count: 1 });
    unsubscribe();
    store.setState({ count: 2 });
    assert.equal(calls, 1);
  });

  it('ends with the newest state when a listener calls setState', () => {
    const store = createStore({ count: 0, isEven: true });
    store.subscribe((state) => {
      const isEven = state.count % 2 === 0;
      if (state.isEven !== isEven) {
        store.setState({ isEven });
      }
    });
    const seenByLast = [];
    store.subscribe((state) => seenByLast.push({ ...state }));
    store.setState({ count: 1 });
    assert.deepEqual(store.getState(), { count: 1, isEven: false });
    assert.deepEqual(seenByLast.at(-1), { count: 1, isEven: false });
  });
});
