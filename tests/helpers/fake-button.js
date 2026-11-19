// A minimal stand-in for a <button> in Node: only the attribute and event methods the
// toggle modules use (src/ui/collapsible.js, src/ui/side-panels.js).

/**
 * Returns a fake button that keeps attributes in a Map and calls its 'click' listeners from
 * click(). attributes are the starting attributes, e.g. { 'aria-expanded': 'false' }.
 */
export function fakeButton(attributes = {}) {
  const values = new Map(Object.entries(attributes));
  const listeners = [];
  return {
    getAttribute: (name) => values.get(name) ?? null,
    setAttribute: (name, value) => values.set(name, String(value)),
    addEventListener: (type, listener) => {
      if (type === 'click') {
        listeners.push(listener);
      }
    },
    click() {
      for (const listener of listeners) {
        listener({ type: 'click', currentTarget: this });
      }
    },
  };
}
