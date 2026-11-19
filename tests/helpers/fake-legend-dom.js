// A minimal fake DOM for driving src/ui/legend.js in Node: only the element features the legend
// module uses (attributes, dataset, textContent, style.setProperty, classList, hidden, a
// querySelector for [attribute="value"] and [attribute] selectors, closest, listeners,
// replaceChildren, and a row template whose content can be cloned). The structure mirrors the
// legend section of index.html.

// Turns 'data-legend-index' into the dataset key 'legendIndex'.
function datasetKey(attribute) {
  return attribute.slice('data-'.length).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function datasetAttribute(key) {
  return `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

// Parses '[name="value"]' or '[name]' into { name, value } (value null for presence only).
function parseSelector(selector) {
  const match = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (match === null) {
    throw new Error(`fake DOM supports only [attribute] selectors, got ${selector}`);
  }
  return { name: match[1], value: match[2] ?? null };
}

/**
 * Creates a fake element. attributes are its starting attributes; children its child elements.
 * Extra fields: listeners (by event type) and dispatch(type, event), which calls the element's
 * listeners and then its ancestors' (bubbling), with event.target set to this element.
 */
export function fakeElement(tagName, attributes = {}, children = []) {
  const values = new Map(Object.entries(attributes));
  const classes = new Set((attributes.class ?? '').split(' ').filter(Boolean));
  const styles = new Map();
  const listeners = new Map();
  const element = {
    tagName: tagName.toUpperCase(),
    parent: null,
    children: [],
    textContent: '',
    hidden: false,
    getAttribute: (name) => values.get(name) ?? null,
    setAttribute: (name, value) => values.set(name, String(value)),
    hasAttribute: (name) => values.has(name),
    dataset: new Proxy({}, {
      get: (_, key) => values.get(datasetAttribute(String(key))),
      set: (_, key, value) => {
        values.set(datasetAttribute(String(key)), String(value));
        return true;
      },
    }),
    style: {
      setProperty: (name, value) => styles.set(name, value),
      getPropertyValue: (name) => styles.get(name) ?? '',
    },
    classList: {
      contains: (name) => classes.has(name),
      toggle(name, force) {
        const shouldHave = force ?? !classes.has(name);
        if (shouldHave) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
        return shouldHave;
      },
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(listener);
    },
    dispatch(type, event = {}) {
      const fullEvent = { type, target: element, ...event };
      for (let node = element; node !== null; node = node.parent) {
        for (const listener of node.listeners.get(type) ?? []) {
          listener(fullEvent);
        }
      }
      return fullEvent;
    },
    listeners,
    matches(selector) {
      const { name, value } = parseSelector(selector);
      return values.has(name) && (value === null || values.get(name) === value);
    },
    querySelector(selector) {
      return element.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector) {
      const found = [];
      const visit = (node) => {
        for (const child of node.children) {
          if (child.matches(selector)) {
            found.push(child);
          }
          visit(child);
        }
      };
      visit(element);
      return found;
    },
    closest(selector) {
      for (let node = element; node !== null; node = node.parent) {
        if (node.matches(selector)) {
          return node;
        }
      }
      return null;
    },
    append(...nodes) {
      for (const node of nodes) {
        const added = node.isFragment ? node.children : [node];
        for (const child of added) {
          child.parent = element;
          element.children.push(child);
        }
      }
    },
    replaceChildren(...nodes) {
      for (const child of element.children) {
        child.parent = null;
      }
      element.children = [];
      element.append(...nodes);
    },
    cloneNode() {
      const copy = fakeElement(tagName, Object.fromEntries(values), element.children.map((child) => child.cloneNode(true)));
      copy.textContent = element.textContent;
      return copy;
    },
  };
  element.append(...children);
  return element;
}

// A fragment: the content of a <template>; cloneNode(true) gives a fragment of copies.
function fakeFragment(children) {
  return {
    isFragment: true,
    children,
    cloneNode: () => fakeFragment(children.map((child) => child.cloneNode(true))),
    querySelector(selector) {
      for (const child of children) {
        if (child.matches(selector)) {
          return child;
        }
        const found = child.querySelector(selector);
        if (found !== null) {
          return found;
        }
      }
      return null;
    },
    get firstElementChild() {
      return children[0] ?? null;
    },
  };
}

/**
 * Builds the legend section of index.html as fake elements, inside a fake document root.
 * Returns { root, panel, rows } where rows is the [data-role="legend-rows"] container.
 * root.dispatch('keydown', { key: 'Escape' }) stands for a key press anywhere on the page.
 */
export function createLegendDom() {
  const rowTemplate = fakeElement('template', { 'data-role': 'legend-row-template' });
  rowTemplate.content = fakeFragment([
    fakeElement('tr', { class: 'legend__row' }, [
      fakeElement('td', {}, [
        fakeElement('button', {
          class: 'legend__number',
          type: 'button',
          'data-action': 'highlight-color',
          'aria-pressed': 'false',
          'data-field': 'number',
        }),
      ]),
      fakeElement('td', {}, [fakeElement('span', { 'data-field': 'swatch' })]),
      fakeElement('td', { 'data-field': 'code' }),
      fakeElement('td', { 'data-field': 'name' }),
      fakeElement('td', { 'data-field': 'stitchCount' }),
    ]),
  ]);
  const rows = fakeElement('tbody', { 'data-role': 'legend-rows' });
  const panel = fakeElement('section', { 'data-role': 'legend' }, [
    fakeElement('button', { 'data-action': 'toggle-legend', 'aria-expanded': 'false' }),
    fakeElement('span', { 'data-role': 'legend-summary' }),
    fakeElement('p', { 'data-role': 'legend-empty' }),
    fakeElement('table', { 'data-role': 'legend-table' }, [rows]),
    rowTemplate,
  ]);
  const root = fakeElement('html', {}, [panel]);
  return { root, panel, rows };
}
