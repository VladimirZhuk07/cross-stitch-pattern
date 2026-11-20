// The service worker's handler against the real dev server under a GitHub Pages-like sub-path,
// with the real fetch and an in-memory Cache Storage
// (openspec/changes/add-pwa-install/specs/app-install/spec.md: "The app works offline after the
// first visit", "Online visits always get the newest files", "The service worker never touches
// anything else", "Old caches of this app are removed"; design D6).

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../../scripts/serve.js';
import { offlineCacheName } from '../../src/core/offline-cache.js';
import { createServiceWorkerHandler } from '../../src/workers/service-worker-handler.js';

const BASE_PATH = '/cross-stitch-pattern/';
const REPO_ROOT = new URL('../../', import.meta.url);

// An in-memory stand-in for the browser's CacheStorage: caches by name, entries by URL.
// puts lists every URL ever put, in order.
function createFakeCaches(names = []) {
  const stores = new Map(names.map((name) => [name, new Map()]));
  const puts = [];
  const keyOf = (request) => (typeof request === 'string' ? request : request.url);
  const cacheNamed = (name) => ({
    async put(request, response) {
      puts.push(keyOf(request));
      stores.get(name).set(keyOf(request), response);
    },
    async match(request) {
      return stores.get(name).get(keyOf(request))?.clone();
    },
  });
  return {
    puts,
    urlsIn: (name) => [...(stores.get(name)?.keys() ?? [])].sort(),
    async open(name) {
      if (!stores.has(name)) {
        stores.set(name, new Map());
      }
      return cacheNamed(name);
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
  };
}

// The real fetch, recording each call's URL and cache mode.
function recordingFetch() {
  const calls = [];
  const fetchAndRecord = (input, init) => {
    calls.push({ url: typeof input === 'string' ? input : input.url, cache: init?.cache });
    return fetch(input, init);
  };
  return { fetch: fetchAndRecord, calls };
}

const offlineFetch = async () => {
  throw new TypeError('fetch failed: offline');
};

// A Request that looks like a page navigation (Node's Request refuses mode 'navigate').
function navigationTo(url) {
  return Object.defineProperty(new Request(url), 'mode', { value: 'navigate' });
}

// Collects the background work respond() hands to keepAlive, so a test can wait for it.
function backgroundWork() {
  const promises = [];
  return { keepAlive: (promise) => promises.push(promise), settle: () => Promise.all(promises) };
}

async function repoText(path) {
  return readFile(new URL(path, REPO_ROOT), 'utf8');
}

describe('service worker handler', () => {
  let server;
  let scopeUrl;
  let cacheName;

  before(async () => {
    server = await startServer({ port: 0, basePath: BASE_PATH });
    scopeUrl = server.url;
    cacheName = offlineCacheName(scopeUrl);
  });

  after(async () => {
    await server.close();
  });

  describe('install', () => {
    let caches;
    let calls;

    before(async () => {
      caches = createFakeCaches();
      const recorder = recordingFetch();
      calls = recorder.calls;
      await createServiceWorkerHandler({ caches, fetch: recorder.fetch, scopeUrl }).install();
    });

    it('caches the page, main.js, the pattern worker and its imports, the manifest and every icon', () => {
      const cached = caches.urlsIn(cacheName);
      const expected = [
        '',
        'styles/main.css',
        'styles/print.css',
        'src/main.js',
        'src/workers/pattern.worker.js',
        'src/workers/pattern-worker-handler.js',
        'src/core/pattern-generator.js',
        'src/core/stitch-grid.js',
        'manifest.webmanifest',
        'icons/favicon-32.png',
        'icons/favicon.svg',
        'icons/apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
      ];
      const missing = expected.filter((path) => !cached.includes(`${scopeUrl}${path}`));
      assert.deepEqual(missing, []);
    });

    it('caches and requests nothing outside the base path', () => {
      const outside = [...caches.urlsIn(cacheName), ...calls.map((call) => call.url)].filter((url) => !url.startsWith(scopeUrl));
      assert.deepEqual(outside, []);
    });

    it('revalidates every request instead of trusting the HTTP cache', () => {
      assert.ok(calls.length > 10, `${calls.length} requests`);
      assert.deepEqual(calls.filter((call) => call.cache !== 'no-cache'), []);
    });

    it('requests every file once', () => {
      const urls = calls.map((call) => call.url);
      assert.equal(urls.length, new Set(urls).size);
    });
  });

  describe('install with a missing file', () => {
    let fixtureServer;
    let fixtureRoot;

    before(async () => {
      fixtureRoot = await mkdtemp(join(tmpdir(), 'service-worker-test-'));
      await writeFile(join(fixtureRoot, 'index.html'), '<script type="module" src="./present.js"></script><script type="module" src="./missing.js"></script>');
      await writeFile(join(fixtureRoot, 'present.js'), 'export const present = true;');
      fixtureServer = await startServer({ port: 0, basePath: BASE_PATH, root: fixtureRoot });
    });

    after(async () => {
      await fixtureServer.close();
      await rm(fixtureRoot, { recursive: true, force: true });
    });

    it('rejects and puts nothing when one referenced file answers 404', async () => {
      const caches = createFakeCaches();
      const handler = createServiceWorkerHandler({ caches, fetch, scopeUrl: fixtureServer.url });
      await assert.rejects(handler.install(), /404.*missing\.js/);
      assert.deepEqual(caches.puts, []);
    });
  });

  describe('respond', () => {
    it('answers from the network and updates the cache', async () => {
      const caches = createFakeCaches();
      const handler = createServiceWorkerHandler({ caches, fetch, scopeUrl });
      const work = backgroundWork();
      const response = await handler.respond(new Request(`${scopeUrl}styles/main.css`), work.keepAlive);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), await repoText('styles/main.css'));
      await work.settle();
      assert.deepEqual(caches.urlsIn(cacheName), [`${scopeUrl}styles/main.css`]);
    });

    it('refreshes the whole set after a navigation answered from the network', async () => {
      const caches = createFakeCaches();
      const handler = createServiceWorkerHandler({ caches, fetch, scopeUrl });
      const work = backgroundWork();
      const response = await handler.respond(navigationTo(scopeUrl), work.keepAlive);
      assert.equal(response.status, 200);
      await work.settle();
      assert.ok(caches.urlsIn(cacheName).includes(`${scopeUrl}src/workers/pattern.worker.js`));
    });

    it('answers the cached copy when the network fails', async () => {
      const caches = createFakeCaches();
      await createServiceWorkerHandler({ caches, fetch, scopeUrl }).install();
      const offline = createServiceWorkerHandler({ caches, fetch: offlineFetch, scopeUrl });
      const response = await offline.respond(new Request(`${scopeUrl}styles/main.css`), () => {});
      assert.equal(response.status, 200);
      assert.equal(await response.text(), await repoText('styles/main.css'));
    });

    it('answers the cached page for an offline navigation to ./?from=homescreen', async () => {
      const caches = createFakeCaches();
      await createServiceWorkerHandler({ caches, fetch, scopeUrl }).install();
      const offline = createServiceWorkerHandler({ caches, fetch: offlineFetch, scopeUrl });
      const response = await offline.respond(navigationTo(`${scopeUrl}?from=homescreen`), () => {});
      assert.equal(response.status, 200);
      assert.match(await response.text(), /<title>Cross-Stitch Pattern Maker<\/title>/);
    });

    it('answers a network error for an uncached URL while offline', async () => {
      const offline = createServiceWorkerHandler({ caches: createFakeCaches(), fetch: offlineFetch, scopeUrl });
      const response = await offline.respond(new Request(`${scopeUrl}src/never-cached.js`), () => {});
      assert.equal(response.type, 'error');
    });

    it('does not answer a POST, another origin, another path or a blob: URL', () => {
      const caches = createFakeCaches();
      const handler = createServiceWorkerHandler({ caches, fetch: offlineFetch, scopeUrl });
      const origin = new URL(scopeUrl).origin;
      const requests = [
        new Request(`${scopeUrl}src/main.js`, { method: 'POST', body: 'x' }),
        new Request('https://other.example/x.js'),
        new Request(`${origin}/other-repo/`),
        { method: 'GET', url: `blob:${origin}/0b6c4e5a-4c1d-4b8e-9f00-6f3a1d2e7c11`, mode: 'cors' },
      ];
      for (const request of requests) {
        assert.equal(handler.respond(request, () => {}), null, `${request.method} ${request.url}`);
      }
      assert.deepEqual(caches.puts, []);
    });
  });

  describe('refresh', () => {
    it('keeps the old set and resolves false when a file fails', async () => {
      const caches = createFakeCaches();
      await createServiceWorkerHandler({ caches, fetch, scopeUrl }).install();
      const putsAfterInstall = caches.puts.length;
      const brokenCss = (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        return url.endsWith('/styles/main.css') ? Promise.resolve(new Response('gone', { status: 404 })) : fetch(input, init);
      };
      const handler = createServiceWorkerHandler({ caches, fetch: brokenCss, scopeUrl });
      assert.equal(await handler.refresh(), false);
      assert.equal(caches.puts.length, putsAfterInstall);
    });

    it('resolves true after saving the set, and a second call while it runs gets the running refresh', async () => {
      const handler = createServiceWorkerHandler({ caches: createFakeCaches(), fetch, scopeUrl });
      const first = handler.refresh();
      assert.equal(handler.refresh(), first);
      assert.equal(await first, true);
    });
  });

  describe('activate', () => {
    it('deletes only the caches of this app and scope with another version', async () => {
      const forkScope = `${new URL(scopeUrl).origin}/fork/`;
      const caches = createFakeCaches([
        `cross-stitch-pattern-maker:offline-v0:${scopeUrl}`,
        cacheName,
        `cross-stitch-pattern-maker:offline-v0:${forkScope}`,
        'other-app',
      ]);
      await createServiceWorkerHandler({ caches, fetch: offlineFetch, scopeUrl }).activate();
      assert.deepEqual(await caches.keys(), [cacheName, `cross-stitch-pattern-maker:offline-v0:${forkScope}`, 'other-app']);
    });
  });
});

describe('service worker sources', () => {
  // A string literal starting with a slash or http would point outside the GitHub Pages sub-path.
  const ABSOLUTE_LITERAL = /(['"`])(\/|http)/;

  it('src/workers/service-worker-handler.js has no absolute string literal', async () => {
    const source = await repoText('src/workers/service-worker-handler.js');
    assert.doesNotMatch(source, ABSOLUTE_LITERAL);
  });
});
