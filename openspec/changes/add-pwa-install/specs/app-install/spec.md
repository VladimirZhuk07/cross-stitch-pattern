# Spec Delta

## Purpose

Lets people install the cross-stitch pattern maker like a native app and use it offline. This
covers the app icon, the web app manifest, the offline service worker, and the install offer
and hint in browsers that allow one, all served from a sub-path with relative URLs only.

Examples use the GitHub Pages address `https://user.github.io/cross-stitch-pattern/`, below
called "the app's sub-path". Sizes are CSS px at the default 16 px root font.

## ADDED Requirements

### Requirement: The app icon is a cross-stitched heart
The app icon SHALL show a heart of 9 × 8 cross stitches (each stitch an X in its cell) in red
with a darker red shade and two white highlight stitches, centred on fabric of color `#F6F4F0`
with a weave grid in `#C9C4BB`. Every icon file SHALL be an opaque PNG (8-bit RGB) with
exactly the size its name and declarations state.

#### Scenario: Icon files and sizes
- **WHEN** the files in `icons/` are read
- **THEN** `icon-192.png` is 192 × 192, `icon-512.png` is 512 × 512, `icon-maskable-512.png` is 512 × 512, `apple-touch-icon.png` is 180 × 180 and `favicon-32.png` is 32 × 32, each with PNG color type 2 and bit depth 8

#### Scenario: Corners show fabric
- **WHEN** the pixel at (0, 0) of `icon-512.png` is read
- **THEN** it is fabric `#F6F4F0` or weave `#C9C4BB`, never a heart color

#### Scenario: Heart in the middle
- **WHEN** the pixel at (256, 234) of `icon-512.png` is read (the centre of the stitch in row 4, column 5 of the heart, counted from 1)
- **THEN** it is the heart red, not fabric

### Requirement: The maskable icon keeps the heart inside the safe zone
The maskable icon SHALL fill its whole square with fabric and SHALL keep every heart pixel
inside the central circle of radius 40 % of the icon size, so that launchers cropping the icon
to a circle, squircle or rounded square never cut a stitch.

#### Scenario: Circle crop
- **WHEN** every pixel of `icon-maskable-512.png` farther than 204.8 px from the centre (256, 256) is checked
- **THEN** none of them has a heart color

#### Scenario: Regular icon is larger
- **WHEN** the heart widths of `icon-512.png` and `icon-maskable-512.png` are compared
- **THEN** the heart in `icon-512.png` is at least 360 px wide and the one in the maskable icon at most 290 px

### Requirement: Small icons use plain squares
At 32 px an X stitch is no longer legible. The 32 px PNG favicon and the SVG favicon SHALL
draw each stitch as a filled square on the fabric color, without the weave grid, with the
heart at least 28 px wide at 32 × 32.

#### Scenario: SVG favicon
- **WHEN** `icons/favicon.svg` is read
- **THEN** it is an `<svg>` with a `viewBox`, one fabric background rectangle and one rectangle per heart stitch (49 stitches), and it contains no URL other than the SVG namespace

#### Scenario: Favicon PNG
- **WHEN** `icons/favicon-32.png` is decoded
- **THEN** it is 32 × 32 and the heart spans at least 28 columns

### Requirement: The page links its icons and manifest with relative URLs
`index.html` SHALL link these, all with relative URLs:
- the manifest `./manifest.webmanifest`;
- the PNG favicon `./icons/favicon-32.png` (sizes `32x32`);
- the SVG favicon `./icons/favicon.svg`;
- the Apple touch icon `./icons/apple-touch-icon.png`;
- a `theme-color` meta tag `#FFFFFF`.

It SHALL no longer use the empty `data:,` icon. No request SHALL go to the origin root, such as
`/favicon.ico`.

#### Scenario: Served under a sub-path
- **WHEN** the site is served under `/cross-stitch-pattern/` and every `<link>` of `index.html` is fetched
- **THEN** the manifest answers 200 with content type `application/manifest+json`, every icon answers 200 with `image/png` or `image/svg+xml`, and every reference resolves inside `/cross-stitch-pattern/`

#### Scenario: Tab icon
- **WHEN** the app is opened in a desktop browser tab
- **THEN** the tab shows the heart icon, not a blank page icon

### Requirement: The manifest describes the app with relative URLs only
`manifest.webmanifest` SHALL be valid JSON with:
- `name` `Cross-Stitch Pattern Maker` and `short_name` `Cross-Stitch`;
- `start_url` `./` and `scope` `./`;
- `display` `standalone` and `lang` `en`;
- `background_color` `#F6F4F0` and `theme_color` `#FFFFFF`;
- `icons`: the 192 and 512 PNGs with purpose `any`, and the maskable 512 PNG with purpose
  `maskable`.

Every URL in it SHALL start with `./`. It SHALL NOT set `id`.

#### Scenario: Resolved under the sub-path
- **WHEN** the browser reads the manifest from `https://user.github.io/cross-stitch-pattern/manifest.webmanifest`
- **THEN** the start URL and scope are `https://user.github.io/cross-stitch-pattern/`, and the app's identity (the default `id`, equal to the start URL) differs from every other app on `https://user.github.io/`

#### Scenario: Icons match their declaration
- **WHEN** each `icons` entry is checked
- **THEN** its `src` starts with `./icons/`, its `type` is `image/png`, and the PNG's width and height equal the numbers in its `sizes`

#### Scenario: Colors follow the page
- **WHEN** `background_color` and `theme_color` are compared with `styles/main.css`
- **THEN** `background_color` equals `--color-bg` (`#F6F4F0`) and `theme_color` equals `--color-surface` (`#FFFFFF`), the header color, and also the `theme-color` meta tag

### Requirement: The service worker controls only the app's sub-path
The app SHALL register `service-worker.js` from the app's root folder with a relative URL as an
ES module worker. Its scope SHALL be the app's sub-path. If the browser lacks service workers
or registration fails, the app SHALL work online exactly as before, and the failure SHALL only
go to the console.

#### Scenario: Registered on GitHub Pages
- **WHEN** the app is opened at `https://user.github.io/cross-stitch-pattern/`
- **THEN** a service worker for scope `https://user.github.io/cross-stitch-pattern/` is active, and pages of other sites under `https://user.github.io/` are not controlled by it

#### Scenario: No service worker support
- **WHEN** `navigator.serviceWorker` is missing (for example, a private window that disables it)
- **THEN** nothing is registered, no error is shown, and choosing an image and generating a pattern work online

### Requirement: The app works offline after the first visit
When the service worker installs, it SHALL save in its cache every file the app can load:
- the page and its stylesheets;
- every module reachable from `./src/main.js`, including the pattern worker and its imports;
- the manifest and all icons.

It collects them by following the references in these files from `./`. The whole set SHALL be
saved or, if any file fails, none of it, so the app is never saved half.

#### Scenario: Offline without ever generating
- **WHEN** the app was opened once online (no image chosen), then the device goes offline and the app is reloaded
- **THEN** the page loads, the user chooses a 1200 × 800 photo and the 100-stitch-wide pattern is generated, as online

#### Scenario: A file is missing during install
- **WHEN** one referenced file answers 404 while the service worker installs
- **THEN** the installation fails, nothing of the new set is cached, and the browser tries again on a later visit

#### Scenario: Installed app offline
- **WHEN** the installed app is started from the home screen in flight mode
- **THEN** it opens in its own window and works as in the browser

### Requirement: Online visits always get the newest files
For a same-origin GET request inside its scope, the service worker SHALL ask the network first
and answer with the network response. It SHALL answer from its cache only when the network
fails. After a page load whose document came from the network, it SHALL refresh the whole saved
set in the background, under the same all-or-nothing rule, so that an offline start never mixes
files from two versions.

#### Scenario: New version deployed
- **WHEN** a new version of `src/ui/legend.js` is published and the user reloads online
- **THEN** the page runs the new `legend.js` on this load, without a second reload and without an update prompt

#### Scenario: Offline fallback
- **WHEN** the device is offline and the page requests `./styles/main.css`
- **THEN** the cached copy is answered

#### Scenario: Not cached and offline
- **WHEN** the device is offline and a URL inside the scope that was never cached is requested
- **THEN** the request fails as it would without a service worker

#### Scenario: Offline navigation with a query
- **WHEN** the device is offline and `./?from=homescreen` is opened
- **THEN** the cached page `./` is shown

### Requirement: The service worker never touches anything else
The service worker SHALL leave these requests to the browser, without answering or caching
them:
- requests other than GET;
- requests to another origin;
- same-origin requests outside its scope;
- `blob:` and `data:` URLs.

User images never pass through it: they are read from the file input and never fetched. It
SHALL NOT make any request outside its scope.

#### Scenario: Chosen photo
- **WHEN** the user chooses `cat.png` and a pattern is generated
- **THEN** no cache entry and no request contain the image, and the cache holds only files of the app

#### Scenario: Other site on the same origin
- **WHEN** a page at `https://user.github.io/other-repo/` is loaded
- **THEN** this service worker does not see its requests and none of its files enter this app's cache

#### Scenario: Export download
- **WHEN** an export creates a `blob:` URL and downloads it
- **THEN** the service worker does not intercept it

### Requirement: Old caches of this app are removed
The cache SHALL be named `cross-stitch-pattern-maker:offline-v<version>:<scope URL>`, for
example `cross-stitch-pattern-maker:offline-v1:https://user.github.io/cross-stitch-pattern/`.
When a new service worker activates, it SHALL delete only the caches of this app and scope with
another version. Caches of other apps, or of other copies of this app on the same origin, SHALL
stay. The new worker SHALL take control of open pages at once.

#### Scenario: Version bump
- **WHEN** caches `cross-stitch-pattern-maker:offline-v1:https://user.github.io/cross-stitch-pattern/`, `cross-stitch-pattern-maker:offline-v1:https://user.github.io/fork/` and `other-app` exist and the v2 worker for `/cross-stitch-pattern/` activates
- **THEN** only the first is deleted

### Requirement: Chromium browsers show an install offer
When the browser reports the app as installable (`beforeinstallprompt`), the app SHALL suppress
the browser's own mini-infobar and show its install bar with the text
`Install this app — works offline` and the buttons `Install` and `Not now`. It does so unless
the offer was dismissed before or the app runs standalone. `Install` SHALL open the browser's
install dialog.

#### Scenario: First visit in Chrome
- **WHEN** a first-time visitor opens the app in Chrome on Android or desktop and the browser fires `beforeinstallprompt`
- **THEN** the install bar appears at the bottom of the page with `Install` and `Not now`, and no browser mini-infobar is shown

#### Scenario: Install accepted
- **WHEN** the user presses `Install` and accepts the browser's dialog
- **THEN** the bar disappears and the browser installs the app

#### Scenario: Browser dialog cancelled
- **WHEN** the user presses `Install` and cancels the browser's dialog
- **THEN** the bar disappears and is remembered as dismissed, exactly as after `Not now`

#### Scenario: Not installable
- **WHEN** the browser never fires `beforeinstallprompt` (for example Firefox on desktop, or the app is already installed)
- **THEN** no install bar is shown

### Requirement: Not now is remembered
`Not now` (and a cancelled browser install dialog) SHALL hide the bar. It SHALL store
`dismissed` under the local storage key `cross-stitch-pattern-maker:install-offer`, and later
page loads SHALL not show the bar or the iOS hint again. If storage cannot be read or written,
the dismissal SHALL last for the current page only, and the app SHALL work as usual. The
browser's own install menu stays available.

#### Scenario: Reload after Not now
- **WHEN** the user presses `Not now` and reloads the page
- **THEN** local storage holds `cross-stitch-pattern-maker:install-offer` = `dismissed` and no install bar appears, although the browser fires `beforeinstallprompt` again

#### Scenario: Storage blocked
- **WHEN** local storage throws on every access and the user presses `Not now`
- **THEN** the bar hides for this page, no error is shown, and it may appear again on the next load

### Requirement: No offer inside the installed app
The install bar and the iOS hint SHALL NOT appear while the app runs as an installed app
(display mode `standalone`, or `navigator.standalone` on iOS). They SHALL disappear as soon as
the browser reports the installation (`appinstalled`).

#### Scenario: Started from the home screen
- **WHEN** the installed app is started and matches `(display-mode: standalone)`
- **THEN** neither the install bar nor the iOS hint is shown

#### Scenario: Installed from the browser menu
- **WHEN** the bar is visible and the user installs the app through the browser's own menu
- **THEN** the bar disappears when `appinstalled` fires

### Requirement: iOS Safari shows a hint to add the app to the home screen
On an iPhone, iPad or iPod in Safari, the bar SHALL show the text
`To install this app, tap Share, then Add to Home Screen.` and a single `Got it` button. It
does so unless dismissed before or running standalone. iOS has no install API, so there SHALL
be no `Install` button. The hint SHALL keep showing on each load until `Got it` is pressed,
which is remembered like `Not now`. Other iOS browsers (Chrome, Firefox, Edge, Opera, the
Google app) SHALL NOT show it.

#### Scenario: iPhone Safari
- **WHEN** the user agent is `Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1` and the page is not standalone
- **THEN** the hint appears with `Got it` and without `Install`

#### Scenario: iPad that reports itself as a Mac
- **WHEN** the user agent is `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15`, the platform is `MacIntel` and `maxTouchPoints` is 5
- **THEN** the hint appears

#### Scenario: Mac Safari
- **WHEN** the same Macintosh user agent is reported with `maxTouchPoints` 0
- **THEN** no hint appears

#### Scenario: Chrome on iPhone
- **WHEN** the user agent contains `CriOS/131.0.6778.73` on an iPhone
- **THEN** no hint appears

#### Scenario: Got it
- **WHEN** the user presses `Got it` and reloads
- **THEN** the hint does not appear again

### Requirement: The install bar is unobtrusive and accessible
The bar SHALL be a labelled region (`Install the app`) below the main area, after all other
controls in the tab order, never in the header, and never over the frame or a control. It
SHALL be hidden in print. Its buttons SHALL be real buttons with a visible focus ring. On
compact screens and coarse pointers they SHALL be at least 44 × 44 px. When a bar button hides
the bar, focus SHALL move to `Choose image`. The bar SHALL NOT be a live region.

#### Scenario: Small phone
- **WHEN** the screen is 360 × 640 and the install bar is shown
- **THEN** the text and both buttons fit in one row at most 64 px tall (the text may wrap to two lines), the page's scroll width is 360 px, and `Install` and `Not now` are each at least 44 × 44 px

#### Scenario: Compact landscape
- **WHEN** the screen is 667 × 375 with a pattern and the bar shown
- **THEN** the bar spans the bottom of the page at most 64 px tall, the frame stays at least 216 px tall and the page does not scroll vertically while the panels are collapsed

#### Scenario: Keyboard
- **WHEN** the bar is shown and the user tabs through the page
- **THEN** `Install` and `Not now` come after the legend, each shows a focus ring, and pressing `Not now` with Enter hides the bar and focuses `Choose image`

#### Scenario: Printing
- **WHEN** the page is printed with the bar visible
- **THEN** the bar is not printed

### Requirement: Icons are generated by a dependency-free script
`node scripts/make-icons.js` SHALL write all six files in `icons/` using only Node built-ins,
with no network access and no npm package. Running it again without changing the icon design
SHALL give the same pixels. The committed icons SHALL always match the design in the source.

#### Scenario: Regenerate
- **WHEN** a developer runs `node scripts/make-icons.js` in a fresh clone
- **THEN** it writes `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/apple-touch-icon.png`, `icons/favicon-32.png` and `icons/favicon.svg`, and decoding each PNG gives exactly the pixels of the committed file

#### Scenario: Design changed without regenerating
- **WHEN** a stitch of the heart grid is changed in the source but the icons are not regenerated
- **THEN** the integration test comparing the committed PNG pixels with the rendered grid fails, naming the file
