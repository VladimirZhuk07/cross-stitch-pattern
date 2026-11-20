// The install bar at the bottom of the page: the Chromium install offer (Install, Not now), the
// iOS Safari hint (Got it), or nothing. The decision is ../core/install-offer.js; this module
// listens to the browser's install events, renders the bar and remembers a dismissal.
// The bar is deliberately not a live region: announcing an offer on load would interrupt
// screen reader users, and the bar is reachable at the end of the tab order.

import {
  INSTALL_OFFER_DISMISSED,
  INSTALL_OFFER_TEXT,
  IOS_HINT_TEXT,
  DISMISS_LABELS,
  isOfferDismissed,
  isIosSafari,
  chooseInstallOffer,
} from '../core/install-offer.js';

/** The local storage key, namespaced because all GitHub Pages sites of a user share an origin. */
export const INSTALL_OFFER_STORAGE_KEY = 'cross-stitch-pattern-maker:install-offer';

/**
 * Wires the install bar.
 * root         the document (or any element containing the bar and the Choose image input)
 * environment  the window: its beforeinstallprompt and appinstalled events, matchMedia and
 *              navigator (userAgent, platform, maxTouchPoints, standalone)
 * storage      { read, write }: read() returns the stored text or null, write(text) stores it
 *              and returns false when it could not (see ../io/local-preferences.js). A failed
 *              write is ignored: the dismissal then lasts for this page only.
 */
export function setupInstallOffer(root, environment, storage) {
  const bar = root.querySelector('[data-role="install-offer"]');
  const text = root.querySelector('[data-role="install-offer-text"]');
  const installButton = root.querySelector('[data-action="install-app"]');
  const dismissButton = root.querySelector('[data-action="dismiss-install-offer"]');
  const chooseImageInput = root.querySelector('[data-role="file-input"]');

  // Read once: an installed app always opens a new document.
  const isStandalone = environment.matchMedia('(display-mode: standalone)').matches
    || environment.navigator.standalone === true;
  const isIos = isIosSafari(environment.navigator);
  let isDismissed = isOfferDismissed(storage.read());
  let deferredPrompt = null;

  function render() {
    const offer = chooseInstallOffer({ isStandalone, isDismissed, hasInstallPrompt: deferredPrompt !== null, isIosSafari: isIos });
    if (offer === 'none') {
      bar.hidden = true;
      return;
    }
    text.textContent = offer === 'install' ? INSTALL_OFFER_TEXT : IOS_HINT_TEXT;
    dismissButton.textContent = DISMISS_LABELS[offer];
    installButton.hidden = offer !== 'install';
    bar.hidden = false;
  }

  // Hides the bar after one of its buttons, so focus does not fall back to the page body.
  function hideAfterButton() {
    render();
    chooseImageInput.focus();
  }

  function rememberDismissal() {
    isDismissed = true;
    storage.write(INSTALL_OFFER_DISMISSED);
  }

  async function install() {
    const promptEvent = deferredPrompt;
    if (promptEvent === null) {
      return;
    }
    deferredPrompt = null; // a prompt event can be used only once
    // prompt() must run synchronously inside the click, while the user activation is valid.
    const shown = promptEvent.prompt();
    hideAfterButton();
    try {
      await shown;
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'dismissed') {
        rememberDismissal(); // cancelling the browser's dialog counts as Not now
      }
    } catch (error) {
      console.error('The browser could not show its install dialog.', error);
    }
  }

  environment.addEventListener('beforeinstallprompt', (event) => {
    // Always, also when dismissed: Chrome's own mini-infobar must never undo a Not now.
    event.preventDefault();
    deferredPrompt = event;
    render();
  });

  environment.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    render();
  });

  installButton.addEventListener('click', () => {
    install();
  });

  dismissButton.addEventListener('click', () => {
    rememberDismissal();
    hideAfterButton();
  });

  render();
}
