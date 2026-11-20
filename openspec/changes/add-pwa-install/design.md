# Design

## Context

- `index.html` sets `<link rel="icon" href="data:,">` only to stop the request for
  `/favicon.ico`, which is an absolute path and would break on a sub-path. Apart from that, it
  has no icon and no manifest.
- The pattern worker (`src/workers/pattern.worker.js` and its imports) is created lazily, on
  the first generation (`src/main.js`, `createPatternWorker`). A first visit without choosing an
  image therefore never fetches it.
- `tests/integration/served-site.test.js` serves the repository under `/cross-stitch-pattern/`.
  It follows every `<script src>`, `<link href>`, `<img src>`, static or dynamic `import` and
  `new URL('…', import.meta.url)`, using the regex extractors in
  `tests/helpers/site-references.js`. Every reference must be relative, answer 200 and stay
  inside the base path.
- `scripts/serve.js` sends `Cache-Control: no-store` and has no `.webmanifest` content type.
- Preferences go through `src/io/local-preferences.js` (`readPreference`, `writePreference`,
  which never throw). Keys are namespaced (`cross-stitch-pattern-maker:side-panels`) because all
  GitHub Pages sites of a user share one origin. The same is true for Cache Storage and service
  worker registrations, so cache names and scope must be per app *and* per sub-path.
- Design tokens: `--color-bg #F6F4F0`, `--color-surface #FFFFFF` (the header),
  `--color-border #C9C4BB`, and `--touch-target 2.75rem`. The body is a flex column; compact
  layouts are set in `styles/main.css` by the media queries in `responsive-layout`.
- The parallel export changes add an `Export` menu to the header and append groups to the end
  of `src/main.js` and `styles/print.css`
  (`shared-export-conventions.md`). This change keeps out of the header.

## Goals / Non-Goals

**Goals:**
- Installable in Chromium (Android, desktop) and addable to the home screen on iOS.
- Offline after one online visit, with no hand-maintained file list that could go stale.
- Every decision that can be made purely lives in `core/` with unit tests. Browser glue stays
  thin.

**Non-Goals:**
- Offline support for browsers without module service workers (Chrome < 91, Safari < 15,
  Firefox < 147). There, the app keeps working online.
- An in-app "update available" flow (see D6).

## Decisions

### D1. Icon design: a cross-stitched heart (core, `src/core/app-icon.js`)

The heart grid is written as text, one character per cell. Each character is a color:
`.` fabric, `R` red `#C72B3B`, `D` dark red `#8E1B2A`, `W` white `#FFFFFF`.

```
.RRR.RRR.
RRWRRRRRR
RWRRRRRRD
RRRRRRRRD
.RRRRRRD.
..RRRRD..
...RRD...
....D....
```

That is 9 × 8 cells and 49 stitches. The fabric is `#F6F4F0`, the weave grid `#C9C4BB` (the
`--color-bg` and `--color-border` tokens). These are icon colors, not DMC palette data, and are
never labelled as DMC.

`renderIcon(size, layout)` returns an **IconImage** `{ width, height, rgb }`: width = height =
size (px, 16–1024), and `rgb` is a `Uint8Array` with 3 bytes per pixel, row-major, top-left
first. It throws a `RangeError` for any other size and a `TypeError` for an unknown layout.
There are three layouts:

| layout | cell size | weave grid | stitch shape | used for |
|---|---|---|---|---|
| `any` | size × 44 / 512 (44 px at 512) | yes | X | 192, 512, Apple 180 |
| `maskable` | size × 32 / 512 (32 px at 512) | yes | X | maskable 512 |
| `squares` | size × 3.5 / 32 | no | filled square | favicon 32 |

- **Placement.** The heart is centred: origin = (size − 9·cell) / 2 and (size − 8·cell) / 2. At
  512 `any` that is (58, 80). The heart is 396 × 352 px there, 288 × 256 px in the maskable
  icon, and 31.5 × 28 px in the favicon.
- **Maskable safe zone.** The maskable cell of 32 px keeps the heart's corner at
  √(144² + 128²) ≈ 192.7 px from the centre, inside the safe circle of 204.8 px (40 % of
  512).
- **Weave grid.** The weave grid is drawn as lines 0.06·cell wide at origin + k·cell in both
  directions, over the whole square. Stitches are drawn over it.
- **X stitch.** A pixel point belongs to the stitch in its cell when it lies within
  0.11·cell of either diagonal of the cell, inset by 0.1·cell. The edge midpoints of a cell
  therefore show fabric, as with a real cross stitch on Aida.
- **Smoothing.** Each pixel averages 4 × 4 sample points in sRGB. Gamma-correct mixing is not
  worth it for a flat icon, and the result is deterministic.

`iconSvg()` returns the `squares` layout as an SVG string. It has `viewBox="0 0 32 32"`, one
fabric `<rect>` and 49 stitch `<rect>`s, and no URL other than the SVG namespace. SVG keeps the
favicon sharp at any zoom. The PNG favicon is there for browsers without SVG favicons.

*Alternatives:*
- A photo-like or vector-path icon: rejected. It needs a drawing library or a canvas, and the
  user asked for pixel art.
- Reusing `buildPattern` on a tiny image: rejected. It couples the icon to the DMC matcher.

### D2. PNG encoding (core, `src/core/png.js`, shared `src/core/crc32.js` and `src/core/compression.js`)

Two shared modules are added byte for byte as in sections 7 and 8 of
`shared-export-conventions.md`, together with their unit tests. The export changes add the same
files: `add-excel-export` adds `crc32.js`, and all three export changes add `compression.js`.
Whichever change merges first adds them, and the others' copies are then identical, so a merge
has nothing to resolve.
- `crc32(bytes, previous)` from `src/core/crc32.js` is the IEEE CRC-32 that PNG chunks use (PNG
  spec annex D). `png.js` has no CRC of its own.
- `compressBytes(bytes, 'deflate')` from `src/core/compression.js` writes zlib format
  (RFC 1950), which is exactly what a PNG `IDAT` holds. It uses the standard
  `CompressionStream`, which Node 22 also has, so `core/` imports no Node module and no
  compressor needs to be passed in.

`encodePng(image)` resolves to the PNG of an IconImage as a `Uint8Array`. It is async because
`compressBytes` is. The PNG holds:
- the signature;
- `IHDR`: width, height, bit depth 8, color type 2 (RGB), compression 0, filter 0, interlace 0;
- one `IDAT`: `await compressBytes(raw, 'deflate')`, where each row of `raw` is a filter byte 0
  followed by its pixels;
- `IEND`.

Each chunk's CRC is `crc32` over its type and data.

`readPngHeader(bytes)` returns `{ width, height, bitDepth, colorType }`, and throws for a bad
signature or a first chunk other than `IHDR`. The integration tests use it to read icon sizes.

Trade-offs:
- **Compression level.** `CompressionStream` offers no level setting, and its default level
  makes the icons a few hundred bytes larger than zlib level 9 would. That does not matter for
  six small, mostly flat icons, and it is not worth a third compression path in the code base.
- **RGB only.** The icons are opaque, and iOS paints transparent touch-icon pixels black.
- **Filter 0 only.** The files stay small (large flat areas), and a decoder for the tests is
  trivial.

### D3. Generator script (dev only, `scripts/make-icons.js`)

The header comment says how to run it (`node scripts/make-icons.js`) and that its output is
committed. It imports `src/core/app-icon.js` and `src/core/png.js`, and writes the six files of
the spec into `icons/` with `node:fs`. The browser never loads it. The test
`tests/integration/app-icons.test.js` decodes each committed PNG (inflate, filter-0 rows; helper
`tests/helpers/png-pixels.js`) and compares its pixels with `renderIcon`. A changed grid without
regenerated files fails there. Pixels are compared, not file bytes, because the compressed byte
output may differ between Node versions. The script awaits `encodePng`, and the only Node module
it uses is `node:fs` (and `node:url` for paths).

### D4. Manifest (`manifest.webmanifest`, `scripts/serve.js`)

- **File name.** `.webmanifest` is the extension and media type (`application/manifest+json`)
  of the W3C specification, and GitHub Pages serves it with that type. One line in the dev
  server's `CONTENT_TYPES` keeps local runs equal to production; `serve.test.js` covers it.
  `manifest.json` would avoid that line but would be served as plain JSON.
- **Fields.** As in the spec: `start_url` and `scope` `./`, which resolve against the manifest
  URL to the sub-path. Icon `src` values are `./icons/…`.
- **No `id`.** A relative `id` resolves against the start URL's **origin**, so `"./"` would
  become `https://user.github.io/`. That would be the same identity for every PWA of that user,
  and the browser would mix their installs. Without `id`, the identity is the start URL
  `https://user.github.io/cross-stitch-pattern/`, which is unique and needs no absolute URL.
  The cost: changing `start_url` later would change the identity, so it stays `./` for good.
- **Colors.** `theme_color` `#FFFFFF` matches the white header, so the standalone title bar
  blends in. `background_color` `#F6F4F0` (page background) is used for the splash screen.
  `<meta name="theme-color" content="#FFFFFF">` gives the same color to the browser tab.
- **Head links.** `index.html` replaces the `data:,` icon:

  ```html
  <link rel="manifest" href="./manifest.webmanifest">
  <meta name="theme-color" content="#FFFFFF">
  <link rel="icon" href="./icons/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="icon" href="./icons/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
  ```

  A page with any icon link no longer requests `/favicon.ico`.

### D5. Finding the app's files (core, `src/core/app-files.js`)

The extractors move from `tests/helpers/site-references.js` into `core/` unchanged:
`extractHtmlReferences`, `extractJsReferences`, `extractCssReferences` and
`isRelativeReference`. They are pure string functions, and the service worker now needs them
too. The test helper is deleted, and `served-site.test.js` imports from core. New:

- `extractManifestReferences(text)`: the `src` of each `icons` entry. Invalid JSON gives `[]`.
- `referencesOf(url, text)`: chooses the extractor by the URL's extension. A path ending in
  `/` counts as HTML. `.webmanifest` gives the manifest references, any other extension `[]`.
- `collectAppFiles(startUrl, scopeUrl, readText)`, async:
  - breadth first from `startUrl`;
  - for each URL whose kind has references, it awaits `readText(url)` (a function passed in
    that resolves the body text, or rejects) and follows `referencesOf`;
  - it resolves to the sorted, de-duplicated list of absolute URLs inside `scopeUrl`, the leaves
    included (PNG, SVG);
  - `data:` references and references resolving outside the scope are skipped;
  - a rejection of `readText` rejects the whole collection.

This is the "no stale list" decision. The app's own references are the precache list, read
live by the same rules the served-site test enforces. A new module, such as one from the
export changes, is cached as soon as something imports it.

*Alternatives:*
- A hand-written `APP_FILES` array guarded by a test: readable, but every change that adds a
  file must edit the service worker. The three parallel changes would all conflict on it.
- Runtime caching only: the first visit's requests happen before the worker controls the page,
  and the lazily loaded pattern worker would be missing. "Offline after the first visit" would
  fail.

### D6. Service worker strategy (core `src/core/offline-cache.js`, workers `src/workers/service-worker-handler.js`, root `service-worker.js`)

**Pure rules** (`offline-cache.js`):
- `OFFLINE_CACHE_VERSION = 1`.
- `offlineCacheName(scopeUrl)` → `cross-stitch-pattern-maker:offline-v1:<scopeUrl>`.
- `staleCacheNames(names, scopeUrl)` → the names with prefix `cross-stitch-pattern-maker:offline-v`,
  suffix `:<scopeUrl>` and another version.
- `shouldHandleRequest({ method, url }, scopeUrl)`: true only for a GET whose `http(s)` URL
  starts with `scopeUrl`. False for `blob:`, `data:`, other origins and other paths.
- `isCacheableResponse({ status, type })`: true only for status 200 and type `basic`.

**Handler** (`createServiceWorkerHandler({ caches, fetch, scopeUrl })`) gets its browser
objects passed in, so the integration test can drive it in Node with the real `fetch`, the dev
server and an in-memory fake of `caches`:
- `install()`:
  - runs `collectAppFiles(scopeUrl, scopeUrl, …)`;
  - each fetch uses `cache: 'no-cache'`, so it revalidates instead of trusting the HTTP cache;
  - the responses are kept in a map;
  - only when every one succeeded with a cacheable response are they all `put` into the
    current cache;
  - otherwise it rejects, and the browser discards the new worker and retries on a later
    visit.
- `refresh()`: does the same as `install()`, without rejecting outward. A failed refresh keeps
  the old set. While a refresh runs, another one is skipped.
- `activate()`: deletes `staleCacheNames(await caches.keys(), scopeUrl)`.
- `respond(request)`:
  - returns `null` when `shouldHandleRequest` is false, and the entry file then does not call
    `respondWith`;
  - otherwise it tries `fetch(request)`; a cacheable response is `put` (clone) and returned,
    and a navigation answered from the network also starts `refresh()`;
  - when the network rejects, it answers the cache match for the request; a navigation falls
    back to the cached `scopeUrl` page (a query string is ignored);
  - when there is no match, it answers `Response.error()`.

**Entry** (`service-worker.js`, at the root because a worker's maximum scope is its own
folder, and GitHub Pages cannot send `Service-Worker-Allowed`): a module worker of about
30 lines. It builds the handler from `self.registration.scope`, `caches` and `fetch`.
- `install`: `waitUntil(install())` and `skipWaiting()`.
- `activate`: `waitUntil(activate().then(() => clients.claim()))`.
- `fetch`: `respondWith` when `respond` returns a promise, and `waitUntil` for the background
  refresh.

**Why network first.** Online, every load runs exactly what the server has, so an update
needs no prompt and no second reload. Development with `node scripts/serve.js` shows edits at
once. Offline, the full set from the last online load is used. Refreshing the whole set after
each online navigation keeps it from one version. Otherwise the lazily loaded worker files
could stay older than `main.js`.
- *Cache first / stale-while-revalidate*: faster on bad networks, but it serves the previous
  version after every deploy and mixes versions file by file.
- *Network first with a timeout*: helps on a weak signal, but it brings the mixing back.

**Update behavior.** A changed `service-worker.js` or one of its imports installs a new worker.
Registration uses `updateViaCache: 'none'`, so GitHub Pages' 10-minute HTTP cache does not delay
this. `skipWaiting` and `clients.claim` are safe, because the worker never pins a file version
on a running page. `OFFLINE_CACHE_VERSION` is raised only when the cache layout changes. The
cache then gets a new name, and `activate` deletes the old one.

**Privacy.** The handler only fetches URLs inside its scope that the app's own files reference.
Images come from `<input type="file">` as `File` objects and are never requested, and the
`blob:` URLs of exports are not handled.

### D7. Registration (io, `src/io/service-worker-registration.js`)

`registerServiceWorker(environment = globalThis)`:
- returns at once when `environment.navigator.serviceWorker` is missing;
- otherwise, on the window's `load` event (so the first load is not slowed down), it calls
  `navigator.serviceWorker.register(new URL('../../service-worker.js', import.meta.url),
  { type: 'module', updateViaCache: 'none' })`;
- the scope is left at its default, the folder of the script, which is the app's sub-path;
- a rejection goes to `console.error`, the only trace of it, because the app works without it.

`new URL(…, import.meta.url)` is the form the served-site test follows, so the worker file and
its import graph are checked for relative paths and 200 responses.

### D8. Install offer decisions (core, `src/core/install-offer.js`)

- `INSTALL_OFFER_DISMISSED = 'dismissed'` and `isOfferDismissed(text)`: true only for exactly
  that text, so `null` or garbage counts as not dismissed.
- `isIosSafari({ userAgent, platform, maxTouchPoints })`:
  - **iOS device:** the user agent has `iPhone`, `iPad` or `iPod`, or the platform is
    `MacIntel` with `maxTouchPoints > 1` (iPadOS desktop mode);
  - **Safari:** the user agent has both `Version/` and `Safari/`, and none of `CriOS`, `FxiOS`,
    `EdgiOS`, `OPiOS`, `OPT/`, `GSA/`, `DuckDuckGo`, `YaBrowser`. In-app web views lack
    `Version/…Safari/`.
- `chooseInstallOffer({ isStandalone, isDismissed, hasInstallPrompt, isIosSafari })` returns
  `'none'`, `'install'` or `'ios-hint'`:
  - standalone or dismissed → `'none'`;
  - otherwise an install prompt → `'install'`;
  - otherwise iOS Safari → `'ios-hint'`;
  - else `'none'`.
- Texts:
  - `INSTALL_OFFER_TEXT` = `Install this app — works offline`;
  - `IOS_HINT_TEXT` = `To install this app, tap Share, then Add to Home Screen.`;
  - `DISMISS_LABELS` = `{ install: 'Not now', 'ios-hint': 'Got it' }`.

User-agent sniffing is fragile, but it only decides whether a dismissible hint appears. iOS
offers no feature to detect instead.

### D9. Install offer UI (ui, `src/ui/install-offer.js`)

`setupInstallOffer(root, environment, storage)`:
- **Arguments.** `environment` is the window: events, `matchMedia`, `navigator`. `storage` is
  `{ read, write }` over `readPreference` and `writePreference` with the key
  `INSTALL_OFFER_STORAGE_KEY = 'cross-stitch-pattern-maker:install-offer'`, exported from this
  module, as `side-panels.js` does.
- **Standalone.** `isStandalone` = `matchMedia('(display-mode: standalone)').matches ||
  navigator.standalone === true`, read once (an installed app opens a new document).
- **Rendering.** It renders `chooseInstallOffer(...)` at setup (iOS hint) and again on each
  change. `'none'` sets `hidden`. Otherwise it sets the text, the dismiss label, and shows
  `Install` only for `'install'`.
- **`beforeinstallprompt`.** It always calls `preventDefault()`, also when dismissed, so
  Chrome's mini-infobar never undoes a `Not now`. It keeps the event as the deferred prompt and
  renders.
- **`Install`.** It calls `deferred.prompt()` synchronously inside the click, while the user
  activation is valid. Then it hides, awaits `userChoice`, and drops the event (it is single
  use). `outcome === 'dismissed'` is treated like `Not now`: the user declined twice, and Chrome
  fires the event again on later loads.
- **`Not now` / `Got it`.** These write `dismissed` (a failed write is ignored, so the
  dismissal lasts for this page) and hide.
- **`appinstalled`.** It drops the prompt and hides.
- **Focus.** When a bar button hides the bar, focus moves to the `Choose image` input, so it
  does not fall to `<body>`.
- **Announcements.** The bar is not a live region. Announcing an offer on load would interrupt
  screen reader users, and the region is reachable at the end of the tab order.

`main.js` appends one group at the end, after the side panels, as in the shared conventions:
`// Offline use and the install offer.` followed by `registerServiceWorker()` and
`setupInstallOffer(...)`.

### D10. Placement and styles (`index.html`, `styles/main.css`, `styles/print.css`)

The markup goes right after `</main>`, before the progress dialog:

```html
<aside class="install-offer" data-role="install-offer" aria-label="Install the app" hidden>
  <img class="install-offer__icon" src="./icons/icon-192.png" alt="" width="32" height="32">
  <p class="install-offer__text" data-role="install-offer-text"></p>
  <button class="install-offer__button install-offer__button--primary" type="button" data-action="install-app" hidden>Install</button>
  <button class="install-offer__button" type="button" data-action="dismiss-install-offer">Not now</button>
</aside>
```

- **Why at the bottom, in the page flow.** The header will hold the Export menu. A fixed
  overlay would cover the legend toggle on phones, or the frame. As the last flex item of the
  body column, the bar takes its own row and the main area shrinks by its height while it is
  shown. This is the `responsive-layout` delta.
- **Styles.**
  - It is a flex row: `align-items: center`, `gap: var(--space-2)`,
    `padding: var(--space-2) var(--space-3)`, a top border `--color-border`, and background
    `--color-surface`.
  - The text has `flex: 1` and `min-width: 0`, so it wraps.
  - `Install` is filled with the accent color, like `Choose image`. `Not now` is outlined.
  - `.install-offer[hidden] { display: none; }` is needed because `display: flex` would
    otherwise beat the `hidden` attribute.
- **Compact screens** (the existing compact media query): the icon is hidden, the text is
  0.875rem, and the buttons are `min-height`/`min-width: var(--touch-target)`. On coarse
  pointers the buttons are added to the existing 44 px list. At 360 px the row is the text
  (about 160 px, two lines of about 40 px) and the two buttons (about 170 px). Its height is
  44 + 2 × 8 + 1 = 61 px, under the 64 px of the spec. In compact landscape, the body is
  already `100dvh` and `.app-main` is a grid, so the bar's 61 px come out of the frame row
  (280 → at least 216).
- **Print.** `print.css` appends `.install-offer { display: none; }` at the end with its own
  comment, like the export changes. Appending keeps the merge trivial.

### D11. Tests

- **Unit (`tests/unit/core/`):**
  - `app-icon.test.js`: sizes, layouts, centre and corner pixels, the maskable circle, and
    square favicon spans; the SVG has 49 stitch rects;
  - `crc32.test.js` and `compression.test.js`: the shared tests, byte for byte;
  - `png.test.js`: the `encodePng` signature, IHDR bytes, chunk CRCs (checked with
    `zlib.crc32` in the test, including `IEND` → `0xAE426082`), a round trip through
    `inflateSync`, and `readPngHeader` errors;
  - `app-files.test.js`: the moved extractors, the manifest extractor, `referencesOf`, and
    `collectAppFiles` with a map-based fake `readText` (cycles, scope filter, `data:`,
    rejection);
  - `offline-cache.test.js`, `install-offer.test.js`: the spec's names, URLs and user agents.
- **Integration:**
  - `app-manifest.test.js`: valid JSON, the fields, only `./` URLs, no `id`, colors equal to
    the CSS tokens and the meta tag, each icon file's IHDR size equal to `sizes`;
  - `app-icons.test.js`: the six files exist, and the PNG pixels equal `renderIcon`;
  - `service-worker.test.js`, with the dev server under `/cross-stitch-pattern/`, the real
    `fetch` and a fake `caches`:
    - install caches `index.html` (as `…/`), `src/main.js`, `src/workers/pattern.worker.js`
      and its imports, the manifest and all icons, and nothing outside the base path;
    - a 404 caches nothing;
    - `respond` goes network first, falls back to the cache, and returns `null` for POST,
      another origin, another path and `blob:`;
    - `activate` deletes only stale names of this scope;
    - the source of `service-worker.js` and of the handler has no string literal starting
      with `/` or `http`;
  - `install-offer.test.js`: `setupInstallOffer` with a fake window and DOM covers the
    Chromium flow, `Not now`, a cancelled dialog, `appinstalled`, standalone, the iOS hint,
    `Got it`, storage failure, and focus;
  - `served-site.test.js`: imports from core, follows `.webmanifest` references, and expects
    `application/manifest+json`, `image/png` and `image/svg+xml`.

## Risks / Trade-offs

- **[Stale or mixed caches]** An offline start mixes files of two versions.
  - Mitigation: network first online, an all-or-nothing install and refresh, and a refresh
    after every online navigation.
- **[Slow networks]** Network first waits for a weak connection before it falls back.
  - Accepted, because correctness beats speed here. Offline (no connection at all) fails fast.
- **[Sub-path mistakes]**
  - Mitigations:
    - the worker URL is built from `import.meta.url`;
    - the scope is the default;
    - there is no manifest `id`;
    - cache names include the scope;
    - the served-site and service-worker tests run under `/cross-stitch-pattern/`.
- **[Dev server on a shared port]** A worker registered on `http://127.0.0.1:8080/` also
  controls other projects served later on that port.
  - It is network first and caches only what our crawl finds, so it is mostly invisible.
    The smoke check says how to unregister it (DevTools → Application → Service workers).
- **[Older engines]** Without module service worker support, registration rejects.
  - The app works online, and the error is logged once.
- **[UA sniffing]** A wrong guess shows or hides a dismissible hint. Nothing else depends on
  it.
- **[`beforeinstallprompt` is Chromium-only and non-standard]** Elsewhere the code path never
  runs.
- **[Parallel changes]** Each has one appended group in `main.js` and one appended rule in
  `print.css`, so their conflicts are trivial on rebase. The head links do not touch the
  header. Their new modules are cached automatically (D5).
- **[Rollback]** Deleting `service-worker.js` does not remove installed workers.
  - Rollback means deploying a `service-worker.js` that calls `self.registration.unregister()`
    and deletes its caches. This is noted in the file's header comment.

## Migration Plan

None. The first visit after deployment registers the worker, and nothing stored needs
converting.

## Open Questions

Each is recorded here with the chosen default and can be changed later without touching the
approach:
- The offer shows as soon as the browser reports the app as installable. An alternative is to
  wait until the first pattern is generated.
- `Not now` is permanent. An alternative is to offer again after, for example, 30 days.
- The iOS hint shows until `Got it`, rather than only on the very first load.
