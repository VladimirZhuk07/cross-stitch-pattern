// A small well-formedness check for the XML the Excel export writes (not a general XML parser):
// an optional XML declaration, then one root element with balanced tags, quoted unique attributes,
// only the five predefined entities and numeric character references, and no characters that
// XML 1.0 forbids. No comments, CDATA, DOCTYPE or processing instructions are expected.

const NAME = /^[A-Za-z_][\w.:-]*/;
const DECLARATION = /^<\?xml [^?]*\?>/;
const REFERENCE = /^&(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9A-Fa-f]+);/;
const FORBIDDEN = /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u;

/**
 * Checks that text is well-formed XML of the kind described above.
 * Returns the qualified names of all elements in document order, e.g.
 * ['worksheet', 'dimension', 'sheetViews', 'sheetView', …], so tests can assert schema order.
 * Throws an Error with the position and the problem.
 */
export function checkXml(text) {
  const forbidden = FORBIDDEN.exec(text);
  if (forbidden !== null) {
    fail(forbidden.index, `forbidden character U+${forbidden[0].codePointAt(0).toString(16).toUpperCase()}`);
  }
  let position = DECLARATION.exec(text)?.[0].length ?? 0;
  const names = [];
  const open = [];
  let hasRoot = false;
  while (position < text.length) {
    const next = text.indexOf('<', position);
    const textEnd = next === -1 ? text.length : next;
    checkText(text, position, textEnd, open.length === 0);
    if (next === -1) {
      break;
    }
    if (text.startsWith('</', next)) {
      position = readEndTag(text, next, open);
      continue;
    }
    if (open.length === 0 && hasRoot) {
      fail(next, 'a second root element');
    }
    const tag = readStartTag(text, next);
    names.push(tag.name);
    hasRoot = true;
    if (!tag.isEmpty) {
      open.push(tag.name);
    }
    position = tag.end;
  }
  if (open.length > 0) {
    fail(text.length, `unclosed <${open.at(-1)}>`);
  }
  if (!hasRoot) {
    fail(0, 'no root element');
  }
  return names;
}

// Character data between tags: only whitespace outside the root, valid references inside.
function checkText(text, start, end, isOutsideRoot) {
  for (let index = start; index < end; index++) {
    const character = text[index];
    if (isOutsideRoot && !/\s/.test(character)) {
      fail(index, 'text outside the root element');
    }
    if (character === '&' && !REFERENCE.test(text.slice(index, index + 12))) {
      fail(index, 'unknown entity or bare &');
    }
    if (character === '>' && text.startsWith(']]>', index - 2)) {
      fail(index, ']]> in text');
    }
  }
}

function readEndTag(text, start, open) {
  const name = NAME.exec(text.slice(start + 2))?.[0];
  const close = start + 2 + (name?.length ?? 0);
  if (name === undefined || !/^\s*>/.test(text.slice(close))) {
    fail(start, 'malformed end tag');
  }
  const expected = open.pop();
  if (expected !== name) {
    fail(start, `</${name}> closes <${expected}>`);
  }
  return text.indexOf('>', close) + 1;
}

function readStartTag(text, start) {
  const name = NAME.exec(text.slice(start + 1))?.[0];
  if (name === undefined) {
    fail(start, 'malformed start tag (comments, CDATA and DOCTYPE are not expected)');
  }
  let position = start + 1 + name.length;
  const attributes = new Set();
  for (;;) {
    const rest = text.slice(position, position + 2);
    if (rest.startsWith('/>')) {
      return { name, isEmpty: true, end: position + 2 };
    }
    if (rest.startsWith('>')) {
      return { name, isEmpty: false, end: position + 1 };
    }
    const attribute = /^\s+([A-Za-z_][\w.:-]*)\s*=\s*(["'])/.exec(text.slice(position));
    if (attribute === null) {
      fail(position, `malformed attribute in <${name}>`);
    }
    if (attributes.has(attribute[1])) {
      fail(position, `attribute ${attribute[1]} repeated in <${name}>`);
    }
    attributes.add(attribute[1]);
    const valueStart = position + attribute[0].length;
    const valueEnd = text.indexOf(attribute[2], valueStart);
    if (valueEnd === -1) {
      fail(valueStart, `unterminated value of ${attribute[1]}`);
    }
    const value = text.slice(valueStart, valueEnd);
    if (value.includes('<')) {
      fail(valueStart, `< in the value of ${attribute[1]}`);
    }
    checkText(text, valueStart, valueEnd, false);
    position = valueEnd + 1;
  }
}

function fail(position, message) {
  throw new Error(`XML check failed at ${position}: ${message}`);
}
