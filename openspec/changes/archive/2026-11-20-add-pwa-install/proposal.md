# Proposal

## Why

The app has no icon (an empty `data:,` favicon) and cannot be installed. People stitch away
from the desk, often offline. Everything already runs on the device; only the app's own files
are missing offline.

## What Changes

- **App icon.** A pixel-art cross-stitched heart: 9 × 8 X stitches on Aida-colored fabric.
  - PNGs at 192, 512, maskable 512, Apple touch 180 and a 32 px favicon, plus an SVG favicon,
    all committed.
  - The dev-only `scripts/make-icons.js` regenerates them with Node built-ins.
  - The icon grid and the PNG encoder are pure `core/` modules with tests.
- **Manifest** `manifest.webmanifest`:
  - "Cross-Stitch Pattern Maker", short name "Cross-Stitch";
  - `standalone` display and the CSS token colors;
  - relative URLs only.
- **Service worker** `service-worker.js` at the app root, scoped to the sub-path:
  - it caches every app file on install by following the app's own references;
  - it answers network first with a cache fallback, and refreshes the set after online loads;
  - it never sees images.
- **Install offer**, a bar at the bottom of the page:
  - Chromium: `Install this app — works offline` with `Install` and `Not now`; `Not now` is
    remembered.
  - iOS Safari: a Share → Add to Home Screen hint until dismissed.
  - Firefox: nothing.
  - Never inside the installed app.
- User-visible: a tab and home-screen icon, the install bar, and the app opening offline.

### Out of scope

- An "update available" prompt (network first already serves new files).
- Offline storage of images or patterns beyond `persist-progress`.
- Push, background sync, share target, shortcuts, and manifest screenshots.
- Install UI in the header or the Export menu.

## Capabilities

### New Capabilities

- `app-install`: icons, the manifest, offline use, and the install offer and iOS hint.

### Modified Capabilities

- `responsive-layout`: the compact layouts make room for the install bar. The frame-height
  scenarios apply while the bar is hidden.

## Impact

- New files:
  - root: `manifest.webmanifest`, `service-worker.js`, `icons/*`, `scripts/make-icons.js`;
  - core: `crc32.js` and `compression.js` (shared byte for byte with the export changes),
    `app-icon.js`, `png.js`, `app-files.js` (extractors moved from
    `tests/helpers/site-references.js`), `offline-cache.js`, `install-offer.js`;
  - other layers: `workers/service-worker-handler.js`, `io/service-worker-registration.js`,
    `ui/install-offer.js`.
- Changed files:
  - `index.html` (head links, offer markup);
  - `styles/main.css` and `styles/print.css`;
  - `scripts/serve.js` (`.webmanifest` type);
  - `src/main.js` (one appended group).
- No dependencies, no build step, and no requests beyond the app's own files.
