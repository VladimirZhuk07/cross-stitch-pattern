// Checks src/ui/install-offer.js with a fake window, a fake install bar and in-memory storage
// (openspec/changes/add-pwa-install/specs/app-install/spec.md: "Chromium browsers show an
// install offer", "Not now is remembered", "No offer inside the installed app", "iOS Safari
// shows a hint to add the app to the home screen", "The install bar is unobtrusive and
// accessible"; design D9).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupInstallOffer, INSTALL_OFFER_STORAGE_KEY } from '../../src/ui/install-offer.js';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const DESKTOP_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// A stand-in for an element: hidden, textContent, focus() and click listeners.
function fakeElement(focusLog, name, { hidden = false, textContent = '' } = {}) {
  const listeners = [];
  return {
    hidden,
    textContent,
    focus: () => focusLog.push(name),
    addEventListener: (type, listener) => {
      if (type === 'click') {
        listeners.push(listener);
      }
    },
    click() {
      for (const listener of listeners) {
        listener({ type: 'click', currentTarget: this });
      }
    },
  };
}

// The install bar as index.html declares it, plus the Choose image input, behind querySelector.
function fakeDocument() {
  const focusLog = [];
  const elements = {
    bar: fakeElement(focusLog, 'bar', { hidden: true }),
    text: fakeElement(focusLog, 'text'),
    install: fakeElement(focusLog, 'install', { hidden: true, textContent: 'Install' }),
    dismiss: fakeElement(focusLog, 'dismiss', { textContent: 'Not now' }),
    fileInput: fakeElement(focusLog, 'file-input'),
  };
  const bySelector = {
    '[data-role="install-offer"]': elements.bar,
    '[data-role="install-offer-text"]': elements.text,
    '[data-action="install-app"]': elements.install,
    '[data-action="dismiss-install-offer"]': elements.dismiss,
    '[data-role="file-input"]': elements.fileInput,
  };
  return { ...elements, focusLog, querySelector: (selector) => bySelector[selector] ?? null };
}

// A window: a real EventTarget with matchMedia and navigator.
function fakeWindow({ isStandalone = false, userAgent = DESKTOP_CHROME, platform = 'Win32', maxTouchPoints = 0, navigatorStandalone } = {}) {
  const environment = new EventTarget();
  environment.matchMedia = (query) => ({ matches: query === '(display-mode: standalone)' && isStandalone });
  environment.navigator = { userAgent, platform, maxTouchPoints, standalone: navigatorStandalone };
  return environment;
}

// In-memory storage over one key; write returns canWrite, like writePreference.
function fakeStorage(storedText = null, { canWrite = true } = {}) {
  const storage = {
    text: storedText,
    writes: [],
    read: () => storage.text,
    write: (text) => {
      storage.writes.push(text);
      if (canWrite) {
        storage.text = text;
      }
      return canWrite;
    },
  };
  return storage;
}

// A beforeinstallprompt event with a stub prompt() and a userChoice that resolves to outcome.
function installPromptEvent(outcome = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.promptCalls = 0;
  event.prompt = () => {
    event.promptCalls += 1;
    return Promise.resolve();
  };
  event.userChoice = Promise.resolve({ outcome, platform: 'web' });
  return event;
}

function setup({ stored = null, canWrite = true, windowOptions } = {}) {
  const document = fakeDocument();
  const environment = fakeWindow(windowOptions);
  const storage = fakeStorage(stored, { canWrite });
  setupInstallOffer(document, environment, storage);
  return { document, environment, storage };
}

// Lets the awaited prompt() and userChoice settle.
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('setupInstallOffer', () => {
  it('uses the namespaced storage key', () => {
    assert.equal(INSTALL_OFFER_STORAGE_KEY, 'cross-stitch-pattern-maker:install-offer');
  });

  it('keeps the bar hidden until the browser reports the app as installable', () => {
    const { document } = setup();
    assert.equal(document.bar.hidden, true);
  });

  it('suppresses the mini-infobar and shows Install and Not now on beforeinstallprompt', () => {
    const { document, environment } = setup();
    const event = installPromptEvent();
    environment.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(document.bar.hidden, false);
    assert.equal(document.text.textContent, 'Install this app — works offline');
    assert.equal(document.install.hidden, false);
    assert.equal(document.dismiss.textContent, 'Not now');
  });

  it('calls prompt() synchronously inside the Install click and hides the bar', () => {
    const { document, environment } = setup();
    const event = installPromptEvent();
    environment.dispatchEvent(event);
    document.install.click();
    assert.equal(event.promptCalls, 1);
    assert.equal(document.bar.hidden, true);
    assert.deepEqual(document.focusLog, ['file-input']);
  });

  it('does not remember an accepted install as dismissed', async () => {
    const { document, environment, storage } = setup();
    environment.dispatchEvent(installPromptEvent('accepted'));
    document.install.click();
    await settle();
    assert.deepEqual(storage.writes, []);
  });

  it('remembers a cancelled browser dialog exactly like Not now', async () => {
    const { document, environment, storage } = setup();
    environment.dispatchEvent(installPromptEvent('dismissed'));
    document.install.click();
    await settle();
    assert.deepEqual(storage.writes, ['dismissed']);
    environment.dispatchEvent(installPromptEvent());
    assert.equal(document.bar.hidden, true);
  });

  it('uses each prompt event once', () => {
    const { document, environment } = setup();
    const event = installPromptEvent();
    environment.dispatchEvent(event);
    document.install.click();
    document.install.click();
    assert.equal(event.promptCalls, 1);
  });

  it('stores dismissed, hides the bar and focuses Choose image on Not now', () => {
    const { document, environment, storage } = setup();
    environment.dispatchEvent(installPromptEvent());
    document.dismiss.click();
    assert.deepEqual(storage.writes, ['dismissed']);
    assert.equal(document.bar.hidden, true);
    assert.deepEqual(document.focusLog, ['file-input']);
  });

  it('keeps the bar hidden after a reload when dismissed was stored, but still suppresses the mini-infobar', () => {
    const { document, environment } = setup({ stored: 'dismissed' });
    const event = installPromptEvent();
    environment.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(document.bar.hidden, true);
  });

  it('hides the bar when the browser reports the installation', () => {
    const { document, environment } = setup();
    environment.dispatchEvent(installPromptEvent());
    environment.dispatchEvent(new Event('appinstalled'));
    assert.equal(document.bar.hidden, true);
  });

  it('never shows the bar in display mode standalone', () => {
    const { document, environment } = setup({ windowOptions: { isStandalone: true } });
    environment.dispatchEvent(installPromptEvent());
    assert.equal(document.bar.hidden, true);
  });

  it('shows the iOS hint with Got it and without Install in iPhone Safari', () => {
    const { document } = setup({ windowOptions: { userAgent: IPHONE_SAFARI, platform: 'iPhone', maxTouchPoints: 5 } });
    assert.equal(document.bar.hidden, false);
    assert.equal(document.text.textContent, 'To install this app, tap Share, then Add to Home Screen.');
    assert.equal(document.dismiss.textContent, 'Got it');
    assert.equal(document.install.hidden, true);
  });

  it('remembers Got it and shows no hint on the next load', () => {
    const iphone = { userAgent: IPHONE_SAFARI, platform: 'iPhone', maxTouchPoints: 5 };
    const first = setup({ windowOptions: iphone });
    first.document.dismiss.click();
    assert.equal(first.document.bar.hidden, true);
    assert.deepEqual(first.storage.writes, ['dismissed']);
    const reload = setup({ stored: first.storage.text, windowOptions: iphone });
    assert.equal(reload.document.bar.hidden, true);
  });

  it('shows no iOS hint in the app started from the home screen (navigator.standalone)', () => {
    const { document } = setup({ windowOptions: { userAgent: IPHONE_SAFARI, platform: 'iPhone', maxTouchPoints: 5, navigatorStandalone: true } });
    assert.equal(document.bar.hidden, true);
  });

  it('still hides the bar for this page when storage cannot be written', () => {
    const { document, environment, storage } = setup({ canWrite: false });
    environment.dispatchEvent(installPromptEvent());
    assert.doesNotThrow(() => document.dismiss.click());
    assert.equal(document.bar.hidden, true);
    environment.dispatchEvent(installPromptEvent());
    assert.equal(document.bar.hidden, true);
    assert.equal(storage.text, null);
  });
});
