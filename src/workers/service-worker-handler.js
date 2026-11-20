// The offline service worker's logic: a thin adapter between service worker events and the
// pure rules in ../core/offline-cache.js and ../core/app-files.js. It uses no worker globals
// except Response; the browser objects are passed in, so the integration test drives it in Node
// with the real fetch, the dev server and an in-memory Cache Storage. The entry file
// service-worker.js (at the app's root) connects it to the real events.
//
// Strategy (design D6 of the add-pwa-install change): network first, the cache only when the
// network fails, and the whole set of app files saved all-or-nothing on install and refreshed
// in the background after every page load from the network, so an offline start never mixes
// files of two versions.

import { collectAppFiles } from '../core/app-files.js';
import {
  offlineCacheName,
  staleCacheNames,
  shouldHandleRequest,
  isCacheableResponse,
} from '../core/offline-cache.js';

/**
 * Creates the handler for one scope.
 * caches    the Cache Storage (self.caches in the worker)
 * fetch     the fetch function
 * scopeUrl  the worker's scope, an absolute URL ending in a slash (self.registration.scope)
 * Returns { install, refresh, activate, respond }:
 *   install()   resolves once every app file is saved; rejects, saving nothing, when any file
 *               fails, so the browser discards the new worker and tries again on a later visit
 *   refresh()   the same without rejecting: resolves to true when the new set was saved, false
 *               when it failed and the old set was kept; a call while one runs gets that one
 *   activate()  deletes the caches of this app and scope with another version
 *   respond(request, keepAlive)  null for a request the worker must leave to the browser,
 *               otherwise a promise of the Response; keepAlive(promise) receives background
 *               work (saving the response, the refresh) for event.waitUntil
 */
export function createServiceWorkerHandler({ caches, fetch, scopeUrl }) {
  const cacheName = offlineCacheName(scopeUrl);
  let runningRefresh = null;

  async function fetchAppFile(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!isCacheableResponse(response)) {
      throw new Error(`app file answered ${response.status} (${response.type}): ${url}`);
    }
    return response;
  }

  // Fetches every app file, then saves them all, or rejects before saving anything.
  async function saveAppFiles() {
    const responses = new Map();
    const readText = async (url) => {
      const response = await fetchAppFile(url);
      responses.set(url, response.clone());
      return response.text();
    };
    const urls = await collectAppFiles(scopeUrl, scopeUrl, readText);
    const leaves = urls.filter((url) => !responses.has(url));
    const leafResponses = await Promise.all(leaves.map(fetchAppFile));
    leaves.forEach((url, index) => responses.set(url, leafResponses[index]));
    const cache = await caches.open(cacheName);
    await Promise.all(urls.map((url) => cache.put(url, responses.get(url))));
  }

  async function refreshOnce() {
    try {
      await saveAppFiles();
      return true;
    } catch {
      return false; // offline or a file failed: the previous complete set stays in the cache
    } finally {
      runningRefresh = null;
    }
  }

  function refresh() {
    if (runningRefresh === null) {
      runningRefresh = refreshOnce();
    }
    return runningRefresh;
  }

  async function activate() {
    const stale = staleCacheNames(await caches.keys(), scopeUrl);
    await Promise.all(stale.map((name) => caches.delete(name)));
  }

  async function saveResponse(request, response) {
    try {
      const cache = await caches.open(cacheName);
      await cache.put(request, response);
    } catch (error) {
      console.error('Could not save a response for offline use', error);
    }
  }

  async function fromCache(request) {
    const cache = await caches.open(cacheName);
    const match = await cache.match(request);
    if (match !== undefined) {
      return match;
    }
    if (request.mode === 'navigate') {
      // Any page of the app, with or without a query string, is the cached start page.
      return (await cache.match(scopeUrl)) ?? Response.error();
    }
    return Response.error();
  }

  async function networkFirst(request, keepAlive) {
    let response;
    try {
      response = await fetch(request);
    } catch {
      return fromCache(request); // the network failed: offline use
    }
    if (isCacheableResponse(response)) {
      keepAlive(saveResponse(request, response.clone()));
      if (request.mode === 'navigate') {
        keepAlive(refresh());
      }
    }
    return response;
  }

  function respond(request, keepAlive) {
    if (!shouldHandleRequest(request, scopeUrl)) {
      return null;
    }
    return networkFirst(request, keepAlive);
  }

  return { install: saveAppFiles, refresh, activate, respond };
}
