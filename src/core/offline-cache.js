// The rules of the offline cache: its name, which old caches to delete, and which requests and
// responses the service worker may touch. Pure; src/workers/service-worker-handler.js applies
// them. All GitHub Pages sites of a user share one origin, so every rule is per app *and* per
// scope (the app's sub-path).

/** Raised only when the cache layout changes; activate then deletes the older caches. */
export const OFFLINE_CACHE_VERSION = 1;

const CACHE_NAME_PREFIX = 'cross-stitch-pattern-maker:offline-v';
const STALE_NAME_PATTERN = /^(\d+):(.*)$/s;
const CACHEABLE_STATUS = 200;

/**
 * The cache name for a scope, e.g. for scopeUrl https://user.github.io/cross-stitch-pattern/
 * it is cross-stitch-pattern-maker:offline-v1:https://user.github.io/cross-stitch-pattern/.
 * scopeUrl  the service worker's scope, an absolute URL ending in a slash
 */
export function offlineCacheName(scopeUrl) {
  return `${CACHE_NAME_PREFIX}${OFFLINE_CACHE_VERSION}:${scopeUrl}`;
}

/**
 * The names among cacheNames that belong to this app and exactly this scope but to another
 * version. Caches of other apps and of other copies of this app on the same origin stay.
 * cacheNames  the names from caches.keys()
 * scopeUrl    the service worker's scope
 * version     the current version (default OFFLINE_CACHE_VERSION)
 */
export function staleCacheNames(cacheNames, scopeUrl, version = OFFLINE_CACHE_VERSION) {
  return cacheNames.filter((name) => {
    if (!name.startsWith(CACHE_NAME_PREFIX)) {
      return false;
    }
    const match = name.slice(CACHE_NAME_PREFIX.length).match(STALE_NAME_PATTERN);
    return match !== null && match[2] === scopeUrl && Number(match[1]) !== version;
  });
}

/**
 * True when the service worker answers a request: a GET of an http(s) URL inside scopeUrl.
 * Other methods, other origins, other paths on the same origin, blob: and data: URLs are left
 * to the browser.
 * request   { method, url } (a Request has both)
 * scopeUrl  the service worker's scope
 */
export function shouldHandleRequest(request, scopeUrl) {
  if (request.method !== 'GET') {
    return false;
  }
  const { protocol } = new URL(request.url);
  if (protocol !== 'http:' && protocol !== 'https:') {
    return false;
  }
  return request.url.startsWith(scopeUrl);
}

/**
 * True when a response may be cached: a complete same-origin answer (status 200, type basic).
 * Errors, partial content (206) and opaque or cross-origin responses are never cached.
 * response  { status, type } (a Response has both)
 */
export function isCacheableResponse(response) {
  return response.status === CACHEABLE_STATUS && response.type === 'basic';
}
