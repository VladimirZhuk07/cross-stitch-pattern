// The offline service worker of the Cross-Stitch Pattern Maker (an ES module worker).
// It lives at the app's root because a worker's scope can be at most its own folder, and GitHub
// Pages cannot send Service-Worker-Allowed. Its scope is therefore the app's sub-path, and it
// never sees other sites on the same origin. The logic is in
// src/workers/service-worker-handler.js; this file only connects it to the worker's events.
//
// Rollback: deleting this file does not remove workers already installed in browsers. To roll
// back, deploy a service-worker.js that deletes its caches and calls
// self.registration.unregister().

import { createServiceWorkerHandler } from './src/workers/service-worker-handler.js';

const handler = createServiceWorkerHandler({
  caches: self.caches,
  fetch: (input, init) => self.fetch(input, init),
  scopeUrl: self.registration.scope,
});

self.addEventListener('install', (event) => {
  // Safe: the worker never pins a file version on a running page (network first).
  self.skipWaiting();
  event.waitUntil(handler.install());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(activateAndClaim());
});

self.addEventListener('fetch', (event) => {
  const response = handler.respond(event.request, (work) => event.waitUntil(work));
  if (response !== null) {
    event.respondWith(response);
  }
});

async function activateAndClaim() {
  await handler.activate();
  await self.clients.claim();
}
