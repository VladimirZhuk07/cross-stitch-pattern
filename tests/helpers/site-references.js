// Extracts the URLs a served file refers to, for the served-site integration test.
// Regular expressions are enough here: the app's own files are small and hand-written,
// and the test only needs the references that make the browser load something.

/**
 * Returns every value of <script src>, <link href> and <img src> in an HTML document,
 * in document order, e.g. ['./styles/main.css', './src/main.js'].
 */
export function extractHtmlReferences(html) {
  const pattern = /<(?:script|img)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']|<link\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi;
  return [...html.matchAll(pattern)].map((match) => match[1] ?? match[2]);
}

/**
 * Returns the module specifiers a JavaScript file loads: static `import … from '…'`,
 * bare `import '…'`, `export … from '…'`, dynamic `import('…')`, and
 * `new URL('…', import.meta.url)` (used for workers). Order follows the source.
 */
export function extractJsReferences(source) {
  const patterns = [
    /\b(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bnew\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
  ];
  const found = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      found.push({ index: match.index, specifier: match[1] });
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found.map((entry) => entry.specifier);
}

/** Returns the targets of `url(…)` and `@import '…'` in a stylesheet. */
export function extractCssReferences(css) {
  const urlPattern = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/g;
  const importPattern = /@import\s+['"]([^'"]+)['"]/g;
  return [
    ...[...css.matchAll(urlPattern)].map((match) => match[1]),
    ...[...css.matchAll(importPattern)].map((match) => match[1]),
  ];
}

/** True for './x' and '../x' — the only form that keeps working under a GitHub Pages sub-path. */
export function isRelativeReference(reference) {
  return reference.startsWith('./') || reference.startsWith('../');
}
