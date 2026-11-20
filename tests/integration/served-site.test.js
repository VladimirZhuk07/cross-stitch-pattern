// Served-site test: serves the repository under a sub-path, exactly like GitHub Pages
// (https://<user>.github.io/<repo>/), then follows every reference from index.html.
// An absolute URL such as '/src/main.js' fails here just as it would in production.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../../scripts/serve.js';
import { referencesOf, isRelativeReference } from '../../src/core/app-files.js';

const BASE_PATH = '/cross-stitch-pattern/';

const EXPECTED_CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// Files the install support needs: the manifest and every icon (app-install spec).
const INSTALL_FILES = [
  'manifest.webmanifest',
  'icons/favicon-32.png',
  'icons/favicon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

function extensionOf(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith('/')) {
    return '.html';
  }
  const dot = pathname.lastIndexOf('.');
  return dot === -1 ? '' : pathname.slice(dot);
}

/**
 * Fetches startUrl and everything it refers to, breadth first.
 * Returns { resources, references }:
 *   resources:  [{ url, status, contentType, body }]
 *   references: [{ from, reference, resolved, kind }]  kind = extension of the referring file
 * data: URLs are recorded but not fetched.
 */
async function crawl(startUrl) {
  const resources = [];
  const references = [];
  const queue = [startUrl];
  const seen = new Set(queue);

  while (queue.length > 0) {
    const url = queue.shift();
    const response = await fetch(url);
    const body = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    resources.push({ url, status: response.status, contentType, body });
    if (!response.ok) {
      continue;
    }

    const kind = extensionOf(url);
    for (const reference of referencesOf(url, body)) {
      const resolved = new URL(reference, url).href;
      references.push({ from: url, reference, resolved, kind });
      if (reference.startsWith('data:') || seen.has(resolved)) {
        continue;
      }
      seen.add(resolved);
      queue.push(resolved);
    }
  }
  return { resources, references };
}

describe('served site under a GitHub Pages-like sub-path', () => {
  let server;
  let site;

  before(async () => {
    server = await startServer({ port: 0, basePath: BASE_PATH });
    site = await crawl(server.url);
  });

  after(async () => {
    await server.close();
  });

  it('loads ./src/main.js as a module script from index.html', () => {
    const index = site.resources[0];
    assert.equal(index.status, 200);
    assert.match(index.body, /<script\s+type="module"\s+src="\.\/src\/main\.js"><\/script>/);
  });

  it('answers 200 for every referenced file', () => {
    const failed = site.resources.filter((resource) => resource.status !== 200);
    assert.deepEqual(failed.map((resource) => `${resource.status} ${resource.url}`), []);
  });

  it('reaches the manifest and every icon file', () => {
    const reached = new Set(site.resources.map((resource) => resource.url));
    const missing = INSTALL_FILES.filter((file) => !reached.has(new URL(file, server.url).href));
    assert.deepEqual(missing, []);
  });

  it('sends the right content type for html, js, css, manifest, png and svg files', () => {
    const wrong = site.resources.filter((resource) => {
      const expected = EXPECTED_CONTENT_TYPES[extensionOf(resource.url)];
      return expected !== undefined && !resource.contentType.startsWith(expected);
    });
    assert.deepEqual(wrong.map((resource) => `${resource.contentType} ${resource.url}`), []);
  });

  it('uses only relative references (or data: URLs)', () => {
    const absolute = site.references.filter(
      (entry) => !isRelativeReference(entry.reference) && !entry.reference.startsWith('data:'),
    );
    assert.deepEqual(absolute.map((entry) => `${entry.reference} in ${entry.from}`), []);
  });

  it('ends every JavaScript import with .js', () => {
    const withoutExtension = site.references.filter(
      (entry) => entry.kind === '.js' && !entry.reference.endsWith('.js'),
    );
    assert.deepEqual(withoutExtension.map((entry) => `${entry.reference} in ${entry.from}`), []);
  });

  it('reaches the PDF worker and the PDF export modules', () => {
    const reached = new Set(site.resources.filter((resource) => resource.status === 200).map((resource) => resource.url));
    const expected = [
      'src/workers/pdf.worker.js',
      'src/workers/pdf-worker-handler.js',
      'src/ui/pdf-export.js',
      'src/io/pdf-worker-client.js',
      'src/io/pdf-picture-encoder.js',
      'src/io/download.js',
      'src/core/pdf-document.js',
      'src/core/pdf-chart-page.js',
      'src/core/pdf-legend-pages.js',
      'src/core/pdf-info-page.js',
      'src/core/pdf-page-map.js',
      'src/core/pdf-page-plan.js',
      'src/core/pdf-content.js',
      'src/core/pdf-text.js',
      'src/core/pdf-writer.js',
      'src/core/pdf-pictures.js',
      'src/core/compression.js',
      'src/core/file-names.js',
      'src/core/pattern-summary.js',
    ];
    const missing = expected.filter((path) => !reached.has(new URL(path, server.url).href));
    assert.deepEqual(missing, []);
  });

  it('never resolves a reference outside the base path', () => {
    const outside = site.references.filter(
      (entry) => !entry.reference.startsWith('data:') && !entry.resolved.startsWith(server.url),
    );
    assert.deepEqual(outside.map((entry) => `${entry.resolved} from ${entry.from}`), []);
  });
});
