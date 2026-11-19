# Tasks

## 1. Side panel state (core)

- [x] 1.1 Write failing `tests/unit/core/side-panels.test.js` for `parseSidePanelState`: `null` → `{ settings: 'open', legend: 'open' }`; `'{"settings":"open","legend":"folded"}'` → that object; `'not json'`, `'[]'`, `'null'`, `'42'` → both `'open'`; `'{"settings":"sideways"}'` → both `'open'`; `'{"legend":"folded","extra":1}'` → `{ settings: 'open', legend: 'folded' }` (no `extra`); the result is a fresh object each call (mutating it does not change `SIDE_PANEL_DEFAULTS`); verify `node --test tests/unit/core/side-panels.test.js` fails because the module is missing
- [x] 1.2 Create `src/core/side-panels.js` with `SIDE_PANEL_DEFAULTS` (frozen) and `parseSidePanelState(text)`, plus a header comment describing the SidePanelState shape; verify 1.1 passes
- [x] 1.3 Add failing tests for `serializeSidePanelState`: `{ settings: 'folded', legend: 'open' }` → `'{"settings":"folded","legend":"open"}'`; extra fields are dropped; `{ settings: 'closed', legend: 'open' }` throws `TypeError` whose message names `settings` and `closed`; round-trip `parse(serialize(x))` equals `x` for all four combinations; verify they fail
- [x] 1.4 Implement `serializeSidePanelState(state)`; verify 1.3 passes
- [x] 1.5 Add failing tests for `shouldOpenSettings(previousKind, kind)`: `('running', 'awaiting-confirmation')` → true; `('running', 'error')` → true; `('idle', 'awaiting-confirmation')` → true; `('error', 'error')` → false; `('awaiting-confirmation', 'awaiting-confirmation')` → false; `('running', 'done')`, `('idle', 'running')`, `('running', 'stopped')` → false; verify they fail
- [x] 1.6 Implement `shouldOpenSettings`; verify 1.5 passes and `npm run test:unit` passes

## 2. Storage and toggle wiring (io, ui)

- [x] 2.1 Create `src/io/local-preferences.js` with `readPreference(key)` (string or `null`) and `writePreference(key, text)` (`true`/`false`), both wrapping `localStorage` in `try/catch` with a comment explaining the intended fallback; verify `tests/integration/served-site.test.js` still passes (it is not imported yet) and the file has no other exports
- [x] 2.2 Add a failing test to `tests/integration/collapsible.test.js`: `setupCollapsible(toggle, onToggle)` calls `onToggle(true)` on the first click and `onToggle(false)` on the second, after `aria-expanded` changed; the existing three tests still pass without the callback; then add the optional parameter to `src/ui/collapsible.js` and update its comment; verify the file passes
- [x] 2.3 Write failing `tests/integration/side-panels.test.js` with a fake root (`querySelector` returning fake buttons from the collapsible test pattern, moved to `tests/helpers/fake-button.js`), a fake store (`getState`, `subscribe`) and a fake storage `{ read, write }`. Cover:
  - stored `{"settings":"folded","legend":"open"}` → settings toggle `aria-expanded="false"`, title `Show settings`, legend toggle `"true"`, title `Hide legend`;
  - a click on the legend toggle writes `{"settings":"folded","legend":"folded"}` and sets title `Show legend`;
  - `read` returning `null` → both `"true"`;
  - `write` returning `false` does not throw, and the toggles keep working;
  - while the settings are folded, a store change of `generation.kind` from `running` to `awaiting-confirmation` opens them and writes `"settings":"open"`, from `running` to `error` does the same, and from `running` to `done` leaves them folded.

  Verify the file fails because `src/ui/side-panels.js` is missing.
- [x] 2.4 Create `src/ui/side-panels.js` exporting `setupSidePanels(root, store, storage)` and `SIDE_PANELS_STORAGE_KEY = 'cross-stitch-pattern-maker:side-panels'` as in design D3; verify 2.3 passes
- [x] 2.5 Call `setupSidePanels(document, store, { read: () => readPreference(SIDE_PANELS_STORAGE_KEY), write: (text) => writePreference(SIDE_PANELS_STORAGE_KEY, text) })` in a new group after the legend in `src/main.js` (or let the ui module close over the key, whichever keeps `main.js` shorter); verify `npm run test:integration` passes, including `served-site.test.js`, which now follows the new imports

## 3. Markup (index.html)

- [x] 3.1 Add failing tests to `tests/integration/mobile-layout-markup.test.js` (or a new `side-panels-markup.test.js` in the same regex style): the settings form has `id="settings-panel"` and its first child is `<button type="button" class="side-toggle" data-action="toggle-settings-side" aria-expanded="true" aria-controls="settings-panel" title="Hide settings">` with a text span `Settings`; the legend section has `id="legend-panel"` with the same kind of button (`toggle-legend-side`, `aria-controls="legend-panel"`, `title="Hide legend"`, text `Legend`); each panel has exactly one `.side-toggle`; the chevron span is `aria-hidden="true"`; verify they fail
- [x] 3.2 Add the two buttons and ids to `index.html` without touching the existing compact toggles or fields; verify 3.1, `settings-markup.test.js`, `legend-markup.test.js` and `mobile-layout-markup.test.js` pass

## 4. Styles (main.css, print.css)

- [x] 4.1 Add failing checks to `tests/integration/layout-css.test.js`:
  - `styles/main.css` has a rule `.side-toggle { display: none }` outside any `@media` block;
  - exactly one `@media` condition equals `screen and (width >= 48rem) and (height >= 30rem), screen and (width >= 60rem)`;
  - every rule that mentions `.side-toggle[aria-expanded` is inside that block;
  - `styles/print.css` hides `.side-toggle`.

  Verify they fail.
- [x] 4.2 Add the base rule and the non-compact block: visible `.side-toggle` (chevron pointing to the panel's edge, visually hidden label while open, `:focus-visible` ring); folded settings and wide legend at `flex-basis: var(--touch-target)` with every child but `.side-toggle` hidden and a vertical label; no transitions. Add `.side-toggle { display: none }` to `print.css`. Verify 4.1 passes and, in the browser at 1440 × 900 with a pattern, the frame column is 736 → 948 → 1288 px as settings and then legend fold
- [x] 4.3 Inside the block, add the medium (`max-width: 72rem`) folded legend as a full-width bar `height: var(--touch-target)` with a horizontal label and the chevron pointing down; verify at 820 × 1180 the legend folds to a 44 px bar and the frame grows taller, and folding the settings gives a 728 px frame column
- [x] 4.4 Make the toggles at least 44 × 44 px under `(pointer: coarse)` on non-compact screens; verify in DevTools at 1024 × 1366 with touch emulation that the `Legend` bar and the `Settings` rail toggle are ≥ 44 × 44 px

## 5. Documentation

- [x] 5.1 In `.claude/rules/ui.md`, reword "the desktop layout stays as it is" to: the desktop/medium layout stays as it is with both panels open, and the settings and legend may fold to their edge there (CSS decides, from `aria-expanded` on the side toggle); verify `git diff .claude/rules/ui.md` shows only that sentence changed
- [ ] 5.2 Update the header comments of `src/ui/settings-form.js` and `src/ui/legend.js` that say "on wider screens the panels are always open", and the matching comment above `.collapsible__toggle` in `styles/main.css`; verify `grep -rn "always open" src styles` finds nothing outdated

## 6. Verification

- [ ] 6.1 Run `npm run test:unit`; all tests pass
- [ ] 6.2 Run `npm run test:integration`; all tests pass
- [ ] 6.3 Browser smoke check with `node scripts/serve.js`:
  - 1440 × 900: load a photo; both panels open, as on `main`. Fold the settings: a 44 px `Settings` rail, a wider frame, and the zoom and centre stitch unchanged. Fold the legend: a right rail. Reload: both still folded once the pattern shows. Tab to each rail toggle: a focus ring appears, and Enter/Space toggle it.
  - Set width 2001 and fold the settings. Load a 1000 × 1000 image: the settings open with the Generate prompt.
  - 820 × 1180: the legend folds to a bottom bar and the settings to a left rail.
  - 375 × 667 with both folded on desktop: no side toggles, and the compact toggles work as before. Widen again: both folded.
  - Print preview with a folded legend: no toggles, and the legend rows are printed.
  - 200 % page zoom at 1440 × 900: the rail labels are readable and not clipped.
  - DevTools → Application → Local Storage: the key `cross-stitch-pattern-maker:side-panels` holds the expected JSON. Set it to `garbage` and reload: both panels are open.
- [ ] 6.4 Run `openspec validate add-collapsible-side-panels --strict`; it passes
