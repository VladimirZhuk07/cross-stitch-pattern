// Unit tests for src/core/install-offer.js (openspec/changes/add-pwa-install/specs/app-install/
// spec.md: "Chromium browsers show an install offer", "Not now is remembered", "No offer inside
// the installed app", "iOS Safari shows a hint to add the app to the home screen"; design D8).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTALL_OFFER_DISMISSED,
  INSTALL_OFFER_TEXT,
  IOS_HINT_TEXT,
  DISMISS_LABELS,
  isOfferDismissed,
  isIosSafari,
  chooseInstallOffer,
} from '../../../src/core/install-offer.js';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1';
const IPHONE_FIREFOX = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_WEB_VIEW = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const IPAD_SAFARI = 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const NOTHING = { isStandalone: false, isDismissed: false, hasInstallPrompt: false, isIosSafari: false };

describe('texts', () => {
  it('uses the texts and dismiss labels of the spec', () => {
    assert.equal(INSTALL_OFFER_TEXT, 'Install this app — works offline');
    assert.equal(IOS_HINT_TEXT, 'To install this app, tap Share, then Add to Home Screen.');
    assert.deepEqual(DISMISS_LABELS, { install: 'Not now', 'ios-hint': 'Got it' });
    assert.equal(INSTALL_OFFER_DISMISSED, 'dismissed');
  });
});

describe('isOfferDismissed', () => {
  it('is true only for the stored text dismissed', () => {
    assert.equal(isOfferDismissed('dismissed'), true);
    assert.equal(isOfferDismissed(null), false);
    assert.equal(isOfferDismissed('yes'), false);
    assert.equal(isOfferDismissed('Dismissed'), false);
  });
});

describe('isIosSafari', () => {
  it('recognises Safari on an iPhone', () => {
    assert.equal(isIosSafari({ userAgent: IPHONE_SAFARI, platform: 'iPhone', maxTouchPoints: 5 }), true);
  });

  it('recognises Safari on an iPad', () => {
    assert.equal(isIosSafari({ userAgent: IPAD_SAFARI, platform: 'iPad', maxTouchPoints: 5 }), true);
  });

  it('recognises an iPad that reports itself as a Mac (MacIntel with 5 touch points)', () => {
    assert.equal(isIosSafari({ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 5 }), true);
  });

  it('does not take Safari on a Mac (0 touch points) for iOS', () => {
    assert.equal(isIosSafari({ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 }), false);
  });

  it('rejects Chrome (CriOS) and Firefox (FxiOS) on an iPhone', () => {
    assert.equal(isIosSafari({ userAgent: IPHONE_CHROME, platform: 'iPhone', maxTouchPoints: 5 }), false);
    assert.equal(isIosSafari({ userAgent: IPHONE_FIREFOX, platform: 'iPhone', maxTouchPoints: 5 }), false);
  });

  it('rejects other iOS browsers and apps: Edge, Opera, the Google app, DuckDuckGo, Yandex', () => {
    for (const marker of ['EdgiOS/131.0', 'OPiOS/16.0', 'OPT/5.0', 'GSA/343.0', 'DuckDuckGo/7', 'YaBrowser/24.1']) {
      const userAgent = IPHONE_SAFARI.replace('Safari/604.1', `${marker} Safari/604.1`);
      assert.equal(isIosSafari({ userAgent, platform: 'iPhone', maxTouchPoints: 5 }), false, marker);
    }
  });

  it('rejects an in-app web view without Version/ and Safari/', () => {
    assert.equal(isIosSafari({ userAgent: IPHONE_WEB_VIEW, platform: 'iPhone', maxTouchPoints: 5 }), false);
  });

  it('rejects Chrome on Android', () => {
    assert.equal(isIosSafari({ userAgent: ANDROID_CHROME, platform: 'Linux armv8l', maxTouchPoints: 5 }), false);
  });
});

describe('chooseInstallOffer', () => {
  it('offers nothing by default (Firefox desktop: no prompt, not iOS)', () => {
    assert.equal(chooseInstallOffer(NOTHING), 'none');
  });

  it('offers install when the browser has an install prompt', () => {
    assert.equal(chooseInstallOffer({ ...NOTHING, hasInstallPrompt: true }), 'install');
  });

  it('shows the iOS hint in iOS Safari', () => {
    assert.equal(chooseInstallOffer({ ...NOTHING, isIosSafari: true }), 'ios-hint');
  });

  it('prefers the install prompt over the iOS hint', () => {
    assert.equal(chooseInstallOffer({ ...NOTHING, hasInstallPrompt: true, isIosSafari: true }), 'install');
  });

  it('offers nothing while standalone, even with a prompt', () => {
    assert.equal(chooseInstallOffer({ ...NOTHING, isStandalone: true, hasInstallPrompt: true }), 'none');
    assert.equal(chooseInstallOffer({ ...NOTHING, isStandalone: true, isIosSafari: true }), 'none');
  });

  it('offers nothing once dismissed, neither install nor the iOS hint', () => {
    assert.equal(chooseInstallOffer({ ...NOTHING, isDismissed: true, hasInstallPrompt: true }), 'none');
    assert.equal(chooseInstallOffer({ ...NOTHING, isDismissed: true, isIosSafari: true }), 'none');
  });
});
