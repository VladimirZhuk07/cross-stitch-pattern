# Tasks

## 1. Shared modules, PNG encoding and icon design (core)

- [x] 1.1 Add `tests/unit/core/crc32.test.js` byte for byte from section 8 of
  `shared-export-conventions.md`. Run `node --test tests/unit/core/crc32.test.js` and verify
  that it fails because the module is missing.
- [x] 1.2 Add `src/core/crc32.js` byte for byte from section 8 and verify that 1.1 passes
- [x] 1.3 Add `tests/unit/core/compression.test.js` byte for byte from section 7 of
  `shared-export-conventions.md`. Run `node --test tests/unit/core/compression.test.js` and
  verify that it fails because the module is missing.
- [x] 1.4 Add `src/core/compression.js` byte for byte from section 7 and verify that 1.3 passes
- [x] 1.5 Write failing `tests/unit/core/png.test.js` and verify that it fails. Cover:
  - `await encodePng(...)` of a 2 × 1 RGB image: the signature, the IHDR fields (2, 1, depth 8,
    color type 2, 0, 0, 0), IEND last, and `inflateSync` of the IDAT = `[0, r,g,b, r,g,b]`;
  - every chunk's CRC equals `zlib.crc32` over its type and data, and the IEND CRC is
    `0xAE426082`;
  - `readPngHeader` reads the IHDR back and throws for a wrong signature or a first chunk other
    than IHDR;
  - `encodePng` rejects with a `RangeError` when `rgb.length` ≠ width × height × 3.
- [x] 1.6 Implement `src/core/png.js` using `crc32` from `src/core/crc32.js` and
  `compressBytes(raw, 'deflate')` from `src/core/compression.js` (design D2). It has no CRC or
  compressor of its own. Verify that 1.5 passes.
- [x] 1.7 Write failing `tests/unit/core/app-icon.test.js` and verify that it fails. Cover:
  - `renderIcon(512, 'any')` is 512 × 512 with 786,432 bytes;
  - pixel (0, 0) is fabric or weave, and (256, 234) is red `#C72B3B`;
  - the heart is ≥ 360 px wide in `any`;
  - in `maskable` the heart is ≤ 290 px wide and no heart-colored pixel is farther than
    204.8 px from (256, 256);
  - `renderIcon(32, 'squares')`: the heart spans ≥ 28 columns, and there are no weave pixels;
  - size 15, size 1025 and layout `round` throw;
  - two calls give equal bytes;
  - `iconSvg()` has `viewBox="0 0 32 32"`, 1 + 49 `<rect>`s, and no `http` other than the SVG
    namespace.
- [x] 1.8 Implement `src/core/app-icon.js` (design D1: grid, colors, layouts, X geometry, 4 × 4
  supersampling, `iconSvg`) and verify that 1.7 passes

## 2. Icon files

- [x] 2.1 Write `scripts/make-icons.js` (design D3). Run it and verify that it writes the six
  files of the spec into `icons/`. Look at `icon-512.png`, `icon-maskable-512.png` and
  `favicon.svg` in an image viewer, and commit the script together with the generated icons.
- [x] 2.2 Add `tests/helpers/png-pixels.js` (inflate, filter-0 rows to RGB) and
  `tests/integration/app-icons.test.js`. It checks that each committed PNG has the stated size,
  color type 2 and bit depth 8, and pixels equal to `renderIcon`, and that `favicon.svg` equals
  `iconSvg()`. Verify that it passes, and that it fails while one grid cell is changed locally
  (then revert).

## 3. Manifest and head links

- [x] 3.1 Add a failing case to `tests/integration/serve.test.js`: a `.webmanifest` file is served
  as `application/manifest+json`. Add the entry to `CONTENT_TYPES` in `scripts/serve.js`, and
  verify that the case passes.
- [x] 3.2 Write failing `tests/integration/app-manifest.test.js` and verify that it fails. Cover:
  - `manifest.webmanifest` parses as JSON with the fields of the spec and no `id`;
  - every URL starts with `./`;
  - each icon's IHDR (`readPngHeader`) matches its `sizes`, with purposes `any`, `any` and
    `maskable`;
  - `background_color` = `--color-bg`, and `theme_color` = `--color-surface` = the
    `theme-color` meta tag (read from `styles/main.css` and `index.html`);
  - `index.html` has the five head lines of design D4 and no `href="data:,"`.
- [x] 3.3 Create `manifest.webmanifest` and replace the `data:,` icon in `index.html` with the
  head lines of design D4. Verify that 3.2 passes.

## 4. Finding the app's files (core) and the served-site test

- [ ] 4.1 Write failing `tests/unit/core/app-files.test.js`. It covers the extractors that move
  from the test helper, with the cases the served-site test relies on. Add these cases and verify
  that they fail:
  - `extractManifestReferences`: icons `src`, invalid JSON → `[]`;
  - `referencesOf` by extension: `/` → HTML, `.webmanifest`, `.png` → `[]`;
  - `collectAppFiles` with a map-based fake `readText`: it follows HTML → JS → `new URL`
    worker → its imports, HTML → CSS, and manifest → icons; it visits a cycle once; it skips
    `data:` and out-of-scope URLs; it returns sorted absolute URLs including leaves; a
    rejected `readText` rejects.
- [ ] 4.2 Create `src/core/app-files.js` with the moved extractors and the new functions
  (design D5). Delete `tests/helpers/site-references.js` and point
  `tests/integration/served-site.test.js` at core. Verify that 4.1 and the served-site test
  pass.
- [ ] 4.3 Extend `served-site.test.js`:
  - follow `.webmanifest` references through `referencesOf`;
  - expect `application/manifest+json` for `.webmanifest`, `image/png` for `.png` and
    `image/svg+xml` for `.svg`;
  - assert that the crawl reached `manifest.webmanifest` and all five icon files.

  Verify that it passes.

## 5. Offline cache rules (core)

- [ ] 5.1 Write failing `tests/unit/core/offline-cache.test.js` and verify that it fails. Cover:
  - `offlineCacheName('https://user.github.io/cross-stitch-pattern/')` →
    `cross-stitch-pattern-maker:offline-v1:https://user.github.io/cross-stitch-pattern/`;
  - `staleCacheNames`: the spec's "Version bump" scenario keeps the fork's cache and
    `other-app`;
  - `shouldHandleRequest`: true for a GET of `…/cross-stitch-pattern/src/main.js`; false for a
    POST, `https://other.example/x.js`, `https://user.github.io/other-repo/`, `blob:…` and
    `data:…`;
  - `isCacheableResponse`: true only for status 200 with type `basic` (false for 404, 206 and
    `opaque`).
- [ ] 5.2 Implement `src/core/offline-cache.js` (design D6, pure rules) and verify that 5.1
  passes

## 6. Service worker (workers, io)

- [ ] 6.1 Write failing `tests/integration/service-worker.test.js` and verify that it fails. Use
  `scripts/serve.js` on port 0 under `/cross-stitch-pattern/`, the real `fetch`, and an
  in-memory fake `caches` with `open`, `keys`, `delete`, `put` and `match`. Cover:
  - `install()` caches `…/`, `src/main.js`, `src/workers/pattern.worker.js` and its imports,
    `manifest.webmanifest` and all icons, and no URL outside the base path;
  - with a temporary root missing one referenced file, `install()` rejects and nothing is put;
  - `respond`:
    - answers from the network and updates the cache;
    - answers the cached copy when `fetch` rejects;
    - answers the cached `…/` page for a navigation to `…/?from=homescreen`;
    - returns `Response.error()` for an uncached URL offline;
    - returns `null` for a POST, another origin, another path and `blob:`;
  - `activate()` deletes only stale names of this scope;
  - `service-worker.js` and the handler source contain no string literal that starts with `/`
    or `http`.
- [ ] 6.2 Implement `src/workers/service-worker-handler.js` (`install`, `refresh`, `activate`,
  `respond`; design D6) and verify that 6.1 passes
- [ ] 6.3 Create `service-worker.js` at the root (module entry, design D6, header comment with
  the rollback note). Create `src/io/service-worker-registration.js` (design D7). Verify that
  `served-site.test.js` follows the `new URL('../../service-worker.js', import.meta.url)`
  reference once task 8.2 imports it. Until then, verify with
  `node --check service-worker.js`.

## 7. Install offer (core, ui)

- [ ] 7.1 Write failing `tests/unit/core/install-offer.test.js` and verify that it fails. Cover:
  - `isIosSafari` with the spec's iPhone Safari, iPad-as-Mac (`MacIntel`, 5 touch points), Mac
    Safari (0 touch points) and `CriOS` user agents, plus `FxiOS` and an in-app web view
    without `Version/`;
  - `chooseInstallOffer` for all branches, including standalone beating a prompt, and
    dismissed beating iOS;
  - `isOfferDismissed`: true for `'dismissed'`, false for `null` and `'yes'`;
  - the exact texts and the dismiss labels.
- [ ] 7.2 Implement `src/core/install-offer.js` (design D8) and verify that 7.1 passes
- [ ] 7.3 Write failing `tests/integration/install-offer.test.js` with a fake window
  (EventTarget, `matchMedia`, `navigator`), a fake offer DOM and in-memory storage. Verify that
  it fails. Cover:
  - `beforeinstallprompt` → `preventDefault` called, the bar shown with `Install` and `Not now`;
  - `Install` → `prompt()` called synchronously, the bar hidden; outcome `dismissed` stores
    `dismissed`, and `accepted` does not;
  - `Not now` → stores `dismissed` and focuses `Choose image`;
  - a stored `dismissed` → the bar stays hidden, but `preventDefault` is still called;
  - `appinstalled` hides the bar;
  - standalone → never shown;
  - the iOS user agent → hint text with `Got it` and no `Install`;
  - a storage write that returns false → the bar hides, and there is no error.
- [ ] 7.4 Implement `src/ui/install-offer.js` (design D9) and verify that 7.3 passes

## 8. Markup, styles and wiring

- [ ] 8.1 Add a failing markup check (in `tests/integration/app-manifest.test.js` or a new
  `install-offer-markup.test.js`):
  - the `<aside data-role="install-offer" aria-label="Install the app" hidden>` comes after
    `</main>`, outside `<header>`;
  - it holds two `type="button"` buttons with the spec's labels and an `<img alt="">`;
  - `styles/print.css` hides `.install-offer`;
  - `styles/main.css` has `.install-offer[hidden] { display: none; }` and the 44 px rule for
    the buttons in the compact and coarse queries.

  Add the markup and the CSS (design D10), and verify that the check and
  `tests/integration/layout-css.test.js` pass.
- [ ] 8.2 Append the group `// Offline use and the install offer.` at the end of `src/main.js`.
  It calls `registerServiceWorker()` and
  `setupInstallOffer(document, window, { read, write })` with `INSTALL_OFFER_STORAGE_KEY`.
  Verify that `served-site.test.js` now reaches `service-worker.js` and its imports, and that
  `npm run test:integration` passes.

## 9. Verification

- [ ] 9.1 Run `npm run test:unit`; all tests pass
- [ ] 9.2 Run `npm run test:integration`; all tests pass
- [ ] 9.3 Run the browser smoke check with `node scripts/serve.js --base cross-stitch-pattern`
  (and `--host 0.0.0.0` for the phone checks), in Chrome first and then in other browsers:
  - **Manifest.** Chrome → DevTools → Application → Manifest shows the name, the short name,
    standalone display, the start URL and scope `…/cross-stitch-pattern/`, and three icons
    (the maskable preview shows the whole heart inside the circle). There are no errors and no
    installability warnings. The tab shows the heart favicon. The Network panel shows no
    request to `/favicon.ico` or outside `/cross-stitch-pattern/`.
  - **Service worker.** Application → Service workers shows `service-worker.js` activated with
    scope `…/cross-stitch-pattern/`. Cache storage holds
    `cross-stitch-pattern-maker:offline-v1:…/cross-stitch-pattern/` with `index`, `main.js`,
    `pattern.worker.js` and its imports, the manifest and the icons, and no image.
  - **Offline.** In a fresh profile, open the page once without choosing an image. Set Network
    → Offline and reload: the page loads, a photo can be chosen, and a 100-wide pattern is
    generated. The Console has no errors.
  - **Update.** Back online, edit a text in `src/ui/status.js` and reload once: the new text
    shows. Revert the edit.
  - **Install offer.** In a fresh profile, the bar `Install this app — works offline` appears
    at the bottom, and there is no Chrome mini-infobar on Android.
    - `Not now`: the bar hides, focus is on `Choose image`, and local storage has
      `cross-stitch-pattern-maker:install-offer` = `dismissed`. A reload shows no bar.
    - Clear the key and reload. `Install` opens Chrome's dialog. Cancel hides the bar and
      stores `dismissed`.
    - Clear it again and install: the app opens in its own window without the bar, and the
      title bar is white.
    - Uninstall afterwards.
  - **Layout.** DevTools device mode at 360 × 640, 375 × 667 and 667 × 375 with a pattern and the
    bar shown:
    - the bar is one row at most 64 px tall;
    - the buttons are at least 44 × 44 px;
    - there is no horizontal scroll;
    - the frame is at least 236 px tall in portrait and 216 px in landscape;
    - there is no vertical page scroll with the panels collapsed;
    - Tab reaches `Install` and `Not now` last, each with a visible focus ring;
    - Print preview has no bar.
  - **Lighthouse.** If available, the installability and PWA checks pass.
  - **iOS Safari** (an iPhone on the LAN, or a Safari responsive-design user agent): the hint
    with `Got it` appears, and after `Got it` and a reload it is gone. After Share → Add to
    Home Screen, the home-screen icon is the heart, and the app opens standalone without the
    hint. Chrome on iOS shows no hint.
  - **Firefox desktop:** no bar, the app works, and no console errors.
  - **Cleanup:** unregister the worker for `127.0.0.1:8080` (Application → Service workers →
    Unregister) and clear its storage.
- [ ] 9.4 Run `openspec validate add-pwa-install --strict`; it passes
