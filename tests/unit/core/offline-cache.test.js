// Unit tests for src/core/offline-cache.js (openspec/changes/add-pwa-install/specs/app-install/
// spec.md: "Old caches of this app are removed", "The service worker never touches anything
// else"; design D6).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFLINE_CACHE_VERSION,
  offlineCacheName,
  staleCacheNames,
  shouldHandleRequest,
  isCacheableResponse,
} from '../../../src/core/offline-cache.js';

const SCOPE = 'https://user.github.io/cross-stitch-pattern/';
const FORK_SCOPE = 'https://user.github.io/fork/';

describe('offlineCacheName', () => {
  it('names the cache after the app, the version and the scope', () => {
    assert.equal(OFFLINE_CACHE_VERSION, 1);
    assert.equal(offlineCacheName(SCOPE), 'cross-stitch-pattern-maker:offline-v1:https://user.github.io/cross-stitch-pattern/');
  });

  it('gives another copy of the app on the same origin its own cache', () => {
    assert.notEqual(offlineCacheName(SCOPE), offlineCacheName(FORK_SCOPE));
  });
});

describe('staleCacheNames', () => {
  it('returns only caches of this app and scope with another version (the Version bump scenario)', () => {
    // The v2 worker sees the v1 cache of its own scope, a fork's v1 cache and another app's cache.
    const names = [
      `cross-stitch-pattern-maker:offline-v1:${SCOPE}`,
      `cross-stitch-pattern-maker:offline-v1:${FORK_SCOPE}`,
      'other-app',
    ];
    assert.deepEqual(staleCacheNames(names, SCOPE, 2), [`cross-stitch-pattern-maker:offline-v1:${SCOPE}`]);
  });

  it('keeps the cache of the current version', () => {
    const names = [offlineCacheName(SCOPE), `cross-stitch-pattern-maker:offline-v0:${SCOPE}`];
    assert.deepEqual(staleCacheNames(names, SCOPE), [`cross-stitch-pattern-maker:offline-v0:${SCOPE}`]);
  });

  it('does not take a cache of a deeper scope for this scope', () => {
    const deeper = `cross-stitch-pattern-maker:offline-v0:${SCOPE}nested/`;
    assert.deepEqual(staleCacheNames([deeper], SCOPE), []);
  });

  it('returns [] when there are no caches', () => {
    assert.deepEqual(staleCacheNames([], SCOPE), []);
  });
});

describe('shouldHandleRequest', () => {
  it('handles a GET of a file inside the scope', () => {
    assert.equal(shouldHandleRequest({ method: 'GET', url: `${SCOPE}src/main.js` }, SCOPE), true);
  });

  it('handles a GET of the scope itself, also with a query', () => {
    assert.equal(shouldHandleRequest({ method: 'GET', url: SCOPE }, SCOPE), true);
    assert.equal(shouldHandleRequest({ method: 'GET', url: `${SCOPE}?from=homescreen` }, SCOPE), true);
  });

  it('leaves a POST inside the scope alone', () => {
    assert.equal(shouldHandleRequest({ method: 'POST', url: `${SCOPE}src/main.js` }, SCOPE), false);
  });

  it('leaves another origin alone', () => {
    assert.equal(shouldHandleRequest({ method: 'GET', url: 'https://other.example/x.js' }, SCOPE), false);
  });

  it('leaves another site on the same origin alone', () => {
    assert.equal(shouldHandleRequest({ method: 'GET', url: 'https://user.github.io/other-repo/' }, SCOPE), false);
    assert.equal(shouldHandleRequest({ method: 'GET', url: 'https://user.github.io/cross-stitch-pattern-old/' }, SCOPE), false);
  });

  it('leaves blob: and data: URLs alone', () => {
    assert.equal(shouldHandleRequest({ method: 'GET', url: 'blob:https://user.github.io/0b6c4e5a-4c1d-4b8e-9f00-6f3a1d2e7c11' }, SCOPE), false);
    assert.equal(shouldHandleRequest({ method: 'GET', url: 'data:text/plain,hello' }, SCOPE), false);
  });
});

describe('isCacheableResponse', () => {
  it('accepts status 200 of type basic', () => {
    assert.equal(isCacheableResponse({ status: 200, type: 'basic' }), true);
  });

  it('rejects 404, a partial 206 and an opaque response', () => {
    assert.equal(isCacheableResponse({ status: 404, type: 'basic' }), false);
    assert.equal(isCacheableResponse({ status: 206, type: 'basic' }), false);
    assert.equal(isCacheableResponse({ status: 0, type: 'opaque' }), false);
    assert.equal(isCacheableResponse({ status: 200, type: 'cors' }), false);
  });
});
