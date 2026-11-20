// Registers the offline service worker (service-worker.js at the app's root). The worker's URL
// is built relative to this module, so it stays inside the GitHub Pages sub-path, and its scope
// is left at the default: the folder of the worker script, which is the app's folder.

/**
 * Registers the service worker as an ES module worker once the page has loaded, so the first
 * load is not slowed down. Does nothing when the browser has no service workers (old browsers,
 * some private windows, pages not served over HTTPS or localhost). A failed registration only
 * goes to the console: the app works online without it.
 * environment  the window (default globalThis): navigator, document and addEventListener
 */
export function registerServiceWorker(environment = globalThis) {
  const container = environment.navigator?.serviceWorker;
  if (container === undefined) {
    return;
  }
  if (environment.document?.readyState === 'complete') {
    register(container);
    return;
  }
  environment.addEventListener('load', () => register(container), { once: true });
}

async function register(container) {
  try {
    // updateViaCache 'none': GitHub Pages' 10-minute HTTP cache must not delay worker updates.
    await container.register(new URL('../../service-worker.js', import.meta.url), {
      type: 'module',
      updateViaCache: 'none',
    });
  } catch (error) {
    console.error('Offline use is not available: the service worker could not be registered.', error);
  }
}
