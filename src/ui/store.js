// A small state store: one plain, frozen state object plus change listeners.
// No proxies, no magic. The app's state fields are described in ./app-state.js.

/**
 * Creates a store holding a shallow copy of initialState.
 *
 * Returns { getState, setState, subscribe }:
 *   getState()          the current state (a shallow-frozen plain object; do not mutate)
 *   setState(partial)   merges the fields of partial into a new state object. If every given
 *                       value is identical (===) to the current one, nothing happens.
 *                       Otherwise all listeners are called synchronously, in subscription
 *                       order, with (state, previousState).
 *   subscribe(listener) adds a listener and returns a function that removes it.
 *
 * A listener may call setState itself. The running notification round still finishes with the
 * state it started with; then a new round runs with the newest state, so every listener's
 * last call always sees the final state.
 */
export function createStore(initialState) {
  let state = Object.freeze({ ...initialState });
  const listeners = [];
  let isNotifying = false;

  function getState() {
    return state;
  }

  function setState(partial) {
    if (!hasChanges(state, partial)) {
      return;
    }
    const previous = state;
    state = Object.freeze({ ...state, ...partial });
    if (isNotifying) {
      return; // the running loop below notices the newer state and starts another round
    }
    notifyFrom(previous);
  }

  function notifyFrom(previous) {
    isNotifying = true;
    try {
      let roundPrevious = previous;
      while (roundPrevious !== state) {
        const roundState = state;
        for (const listener of [...listeners]) {
          listener(roundState, roundPrevious);
        }
        roundPrevious = roundState;
      }
    } finally {
      isNotifying = false;
    }
  }

  function subscribe(listener) {
    listeners.push(listener);
    return function unsubscribe() {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }

  return { getState, setState, subscribe };
}

function hasChanges(state, partial) {
  for (const key of Object.keys(partial)) {
    if (state[key] !== partial[key]) {
      return true;
    }
  }
  return false;
}
