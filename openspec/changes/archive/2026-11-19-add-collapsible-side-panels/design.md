# Design

## Context

- The layout is pure CSS (`styles/main.css`): `.app-main` is a flex row of `.settings`
  (`flex: 0 0 16rem`), `.workspace` (`flex: 1`) and `.legend` (`flex: 0 0 24rem`). Below
  72rem the legend wraps to its own row (`max-height: 40vh`). The compact layout is one
  `@media screen and (width < 48rem), screen and (height < 30rem) and (width < 60rem)` block.
- The phone folding (`improve-mobile-layout`) keeps its state only in each toggle's
  `aria-expanded` (`src/ui/collapsible.js`). CSS reads it with
  `.collapsible:has(> .collapsible__toggle[aria-expanded="false"]) > .collapsible__body`. That
  state is not in the store and resets on every load.
- `src/ui/viewer.js` already watches the frame with a `ResizeObserver` and keeps the centre
  point and zoom on every resize (pattern-viewer "Resizing the frame keeps the view centred").
  A panel that folds is just a frame resize, so no viewer code changes.
- `state.generation.kind` (`src/ui/app-state.js`) already says when a large pattern waits
  (`awaiting-confirmation`) and when generation failed (`error`).
- GitHub Pages serves every repository of a user from one origin (`<user>.github.io`), so
  `localStorage` is shared with the user's other sites. Keys must be namespaced.

## Goals / Non-Goals

**Goals:**
- Fold each panel with one button, using CSS and one `aria-expanded`, the same pattern as
  the phone toggles.
- Remember the state without ever breaking the app when storage is unavailable.

**Non-Goals:**
- No store field for the side state: only CSS and the side-panels module need it.
- No change to `collapsible.js` behaviour on phones, the viewer, or the print layout beyond
  hiding the new buttons.

## Decisions

### D1. A second toggle per panel, separate from the phone toggle

Each panel gets a new `<button type="button" class="side-toggle" data-action="toggle-settings-side">`
(and `toggle-legend-side`) as its first child. `aria-controls` is the panel's own id: the form
gets `id="settings-panel"`, the legend section `id="legend-panel"`. The button contains a
chevron in an `aria-hidden` span and a text span (`Settings` / `Legend`). The text is
visually hidden while the panel is open and written vertically in the rail
(`writing-mode: vertical-rl`) while folded.

*Alternative:* reuse the phone `.collapsible__toggle`. Rejected. The phone panels must
start collapsed on every load, while the side state starts from storage and starts open. One
button would mix two meanings and break the existing compact requirements.

*Alternative:* wrap the panel content in a new element for `aria-controls`. Rejected: the
compact CSS uses child combinators (`.collapsible > .collapsible__body`), and moving the body
one level down would break it.

### D2. CSS decides what "folded" means, only on non-compact screens

All side-panel rules live in one block with the exact complement of the compact query:
`@media screen and (width >= 48rem) and (height >= 30rem), screen and (width >= 60rem)`.
Outside that block `.side-toggle { display: none }`, so compact screens and print never see
the buttons or the folded state. This needs no JS for breakpoints, and the state survives
resizes.
Inside the block:
- `.settings:has(> .side-toggle[aria-expanded="false"])` gets `flex-basis: var(--touch-target)`
  (2.75rem), and every child except `.side-toggle` is hidden. The legend does the same on
  wide screens.
- In the medium range (`max-width: 72rem`) the folded legend becomes a bottom bar
  `height: var(--touch-target)` with a horizontal label. The wrapped flex row cannot do
  this alone: free height in a multi-line flex container is shared between all lines
  (`align-content: stretch`), which left the frame short and a ~300 px gap under the bar.
  So while the visible legend is folded, `.app-main` becomes a grid. The columns are `16rem`
  (or `2.75rem` with folded settings) and `minmax(0, 1fr)`, the rows `minmax(0, 1fr)` and
  `2.75rem`, and the legend spans both columns. The open state keeps today's flex layout.
  *Alternative:* turn the medium layout into a grid in every state. Rejected: it would
  change the layout of open panels, which this change keeps as it is.
- No transitions: a frame that animates its width would make the `ResizeObserver` re-render
  tiles on every frame.

`:has()` is already used by the stylesheet, so it adds no new browser requirement.

### D3. Layers and data shape

- `src/core/side-panels.js` (**core**, pure, no DOM/storage):
  - `SIDE_PANEL_DEFAULTS = { settings: 'open', legend: 'open' }`.
  - `parseSidePanelState(text)`: takes the stored string or `null`. Returns a fresh
    `{ settings, legend }` whose values are `'open'` or `'folded'`. Anything missing, unknown
    or not valid JSON becomes `'open'`. It never throws.
  - `serializeSidePanelState(state)`: returns `JSON.stringify({ settings, legend })`. It
    throws `TypeError` for a value other than `'open'`/`'folded'`.
  - `shouldOpenSettings(previousKind, kind)`: returns `true` when `kind` is
    `awaiting-confirmation` or `error` and differs from `previousKind`, so that a re-render
    with the same status does not reopen a panel the user just folded.

  The SidePanelState shape `{ settings: 'open' | 'folded', legend: 'open' | 'folded' }` is
  described once, next to `parseSidePanelState`.
- `src/io/local-preferences.js` (**io**): `readPreference(key)` returns the string or `null`,
  and `writePreference(key, text)` returns `true`/`false`. Both wrap `localStorage` in
  `try/catch`, because Safari private mode and blocked storage throw on access. A failure
  falls back to defaults on purpose, and the comment says why. This is not a silent
  swallow: the spec requires no message.
- `src/ui/side-panels.js` (**ui**): `setupSidePanels(root, store, storage)`. `storage` is
  `{ read, write }` (the io functions; tests pass fakes). It does three things:
  1. It reads and parses the state and sets each toggle's `aria-expanded` and `title`.
  2. It wires each toggle with `setupCollapsible(toggle, onToggle)`. After every flip
     `onToggle` writes the new state and updates `title`.
  3. It subscribes to the store. When `shouldOpenSettings` is true and the settings are
     folded, it sets them open and writes the state.

  `main.js` calls it after `setupLegend`, with the key `cross-stitch-pattern-maker:side-panels`
  defined in the ui module.
- `src/ui/collapsible.js` gets an optional second parameter, `onToggle(isExpanded)`, called
  after the attribute flips. Existing callers pass nothing, so the phone behaviour is unchanged.

### D4. Restoring before the first paint is "good enough"

The module runs at startup with the rest of `main.js` (module scripts are deferred). Before
that runs, the panels are open for one frame at most. No pattern can exist that early, and
the legend is still `hidden`, so a stored folded legend never flashes. A folded settings
panel may flash open for one frame. A blocking inline script would avoid it, but it would
duplicate parsing logic and go against the "load only `./src/main.js`" rule.

## Risks / Trade-offs

- [The user folds the settings during a small generation and cannot see its progress] →
  The frame is `aria-busy`, and errors and large-pattern prompts open the panel again (spec).
  Progress in the rail is out of scope.
- [The Stop button is hidden while the settings are folded] → Long jobs start only from the
  Generate button, so the panel is open when they start. Folding during a job is a deliberate
  user action and can be undone with one click.
- [`localStorage` is shared with the user's other GitHub Pages sites] → Namespaced key, and
  the parser accepts only the two known values.
- [The vertical label in the rail could be clipped with large font settings] → The rail is
  2.75rem, so it scales with the root font. The smoke check includes a 150 % page zoom (200 % of a 1440 px window is already the compact layout).

## Migration Plan

No data to migrate: without a stored value both panels start open, which is today's layout.
Rollback is removing the change. A stale key in `localStorage` is then simply ignored.
