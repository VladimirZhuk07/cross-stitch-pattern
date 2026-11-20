// Finds the files the app loads by following the references in its own files: the page, its
// stylesheets, every module (including workers) and the manifest. The service worker caches
// this list for offline use, and the served-site test checks the same references, so there is
// no hand-written file list to go stale. Pure: reading a file is a function passed in.
//
// Regular expressions are enough here: the app's own files are small and hand-written, and only
// the references that make the browser load something matter. Because this module is itself
// crawled, its comments never quote an example module path (the extractors would follow it).

const HTML_REFERENCE_PATTERN = /<(?:script|img)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']|<link\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi;

/**
 * Returns every value of script src, link href and img src attributes in an HTML document,
 * in document order (the relative paths as written in the attributes).
 */
export function extractHtmlReferences(html) {
  return [...html.matchAll(HTML_REFERENCE_PATTERN)].map((match) => match[1] ?? match[2]);
}

/**
 * Returns the module specifiers a JavaScript file loads, in source order: static imports,
 * side-effect-only imports, re-exports, dynamic imports with a string literal, and URLs built
 * with the new URL constructor relative to import.meta.url (used for workers).
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

/** Returns the targets of url() and @import rules in a stylesheet. */
export function extractCssReferences(css) {
  const urlPattern = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/g;
  const importPattern = /@import\s+['"]([^'"]+)['"]/g;
  return [
    ...[...css.matchAll(urlPattern)].map((match) => match[1]),
    ...[...css.matchAll(importPattern)].map((match) => match[1]),
  ];
}

/**
 * Returns the src of every entry in a web app manifest's icons list (text, JSON).
 * Invalid JSON, a missing list or a src that is not a string give no references.
 */
export function extractManifestReferences(text) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    return []; // a broken manifest refers to nothing; the browser reports it on its own
  }
  if (!Array.isArray(manifest?.icons)) {
    return [];
  }
  return manifest.icons.map((icon) => icon?.src).filter((src) => typeof src === 'string');
}

/**
 * True for references starting with ./ or ../ — the only form that keeps working under a
 * GitHub Pages sub-path.
 */
export function isRelativeReference(reference) {
  return reference.startsWith('./') || reference.startsWith('../');
}

/**
 * The references in a file's text, read with the extractor for its kind. The kind comes from
 * the extension of the URL's path: a path ending in a slash is a page (HTML), then .html, .js,
 * .css and .webmanifest. Any other file (images) has no references.
 * url   absolute URL of the file
 * text  its contents
 */
export function referencesOf(url, text) {
  const extension = extensionOf(url);
  if (extension === '.html') {
    return extractHtmlReferences(text);
  }
  if (extension === '.js') {
    return extractJsReferences(text);
  }
  if (extension === '.css') {
    return extractCssReferences(text);
  }
  if (extension === '.webmanifest') {
    return extractManifestReferences(text);
  }
  return [];
}

/**
 * Collects every file the app can load, breadth first from startUrl.
 * startUrl  absolute URL of the page, usually equal to scopeUrl
 * scopeUrl  absolute URL of the app's folder, ending in a slash; references resolving outside
 *           it (other sites, other paths, other origins) and data: URLs are skipped
 * readText  async function (url) → the file's text; called once for each file that can hold
 *           references (pages, scripts, stylesheets, the manifest), never for images
 * Resolves to the sorted list of absolute URLs, images included. Rejects as soon as readText
 * rejects, so a missing file never yields a partial list.
 */
export async function collectAppFiles(startUrl, scopeUrl, readText) {
  const seen = new Set([startUrl]);
  const queue = [startUrl];
  while (queue.length > 0) {
    const url = queue.shift();
    if (!canHoldReferences(url)) {
      continue;
    }
    for (const reference of referencesOf(url, await readText(url))) {
      if (reference.startsWith('data:')) {
        continue;
      }
      const resolved = new URL(reference, url);
      resolved.hash = '';
      if (!resolved.href.startsWith(scopeUrl) || seen.has(resolved.href)) {
        continue;
      }
      seen.add(resolved.href);
      queue.push(resolved.href);
    }
  }
  return [...seen].sort();
}

function canHoldReferences(url) {
  return ['.html', '.js', '.css', '.webmanifest'].includes(extensionOf(url));
}

// The lower-case extension of a URL's path, with '.html' for a path ending in a slash.
function extensionOf(url) {
  const { pathname } = new URL(url);
  if (pathname.endsWith('/')) {
    return '.html';
  }
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  const dot = lastSegment.lastIndexOf('.');
  return dot === -1 ? '' : lastSegment.slice(dot).toLowerCase();
}
