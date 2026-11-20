// Decisions and texts of the install offer: whether the page shows the Chromium install bar,
// the iOS Safari hint, or nothing. Pure; src/ui/install-offer.js renders the decision.

/** The text stored under the install offer's preference key once it was dismissed. */
export const INSTALL_OFFER_DISMISSED = 'dismissed';

/** The install bar's text where the browser offers an install prompt (Chromium). */
export const INSTALL_OFFER_TEXT = 'Install this app — works offline';

/** The hint's text in iOS Safari, which has no install prompt. */
export const IOS_HINT_TEXT = 'To install this app, tap Share, then Add to Home Screen.';

/** The dismiss button's label for each offer. */
export const DISMISS_LABELS = Object.freeze({ install: 'Not now', 'ios-hint': 'Got it' });

const IOS_DEVICE_PATTERN = /\b(?:iPhone|iPad|iPod)\b/;
// Browsers and apps on iOS that use WebKit but cannot add to the home screen like Safari.
const OTHER_IOS_BROWSER_PATTERN = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|YaBrowser/;

/**
 * True when the stored preference text means the offer was dismissed. Anything else (null when
 * nothing is stored or storage is blocked, or unexpected text) counts as not dismissed.
 */
export function isOfferDismissed(storedText) {
  return storedText === INSTALL_OFFER_DISMISSED;
}

/**
 * True for Safari on an iPhone, iPad or iPod. User-agent sniffing is fragile, but it only
 * decides whether a dismissible hint appears; iOS offers no feature to detect instead.
 * navigatorInfo  { userAgent, platform, maxTouchPoints } (a navigator has all three)
 * An iPad in desktop mode reports itself as a Mac: platform MacIntel with more than one touch
 * point. Safari's user agent has both Version/ and Safari/; in-app web views lack Version/.
 */
export function isIosSafari({ userAgent, platform, maxTouchPoints }) {
  const isIosDevice = IOS_DEVICE_PATTERN.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  if (!isIosDevice) {
    return false;
  }
  const looksLikeSafari = userAgent.includes('Version/') && userAgent.includes('Safari/');
  return looksLikeSafari && !OTHER_IOS_BROWSER_PATTERN.test(userAgent);
}

/**
 * Chooses the offer to show: 'none', 'install' or 'ios-hint'.
 * isStandalone      the app runs installed (display mode standalone)
 * isDismissed       Not now or Got it was pressed before
 * hasInstallPrompt  the browser fired beforeinstallprompt and the event is still usable
 * isIosSafari       see isIosSafari
 */
export function chooseInstallOffer({ isStandalone, isDismissed, hasInstallPrompt, isIosSafari: isIos }) {
  if (isStandalone || isDismissed) {
    return 'none';
  }
  if (hasInstallPrompt) {
    return 'install';
  }
  if (isIos) {
    return 'ios-hint';
  }
  return 'none';
}
