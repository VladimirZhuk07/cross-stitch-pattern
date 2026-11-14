# Proposal

## Why

On a phone the app is just the desktop layout stacked: the settings form and the legend push
the frame down, controls are small mouse targets, and a long file name can widen the page.
Users want to make a pattern from a phone photo, so the frame must get most of the screen and
every control must be easy to tap. Desktop stays as it is.

## What Changes

- New **compact layout** below 48rem (768 px) width, or below 30rem (480 px) height when
  narrower than 60rem (960 px): the frame fills the remaining screen height (`100dvh`, at
  least 10rem); in landscape the settings and legend move to a side column.
- **Settings collapse** behind a `Settings` button (`aria-expanded`) with a one-line summary,
  e.g. `100 × 67 · max 24 colors · 14 ct · 7.1 × 4.8 in`. Collapsed by default.
- **Legend collapses** behind a `Legend · 18 colors` button; expanded, it scrolls inside at
  most 40 % of the screen height.
- **Touch targets** of at least 44 × 44 CSS px (compact layout and any coarse pointer); the
  view switcher becomes a segmented control.
- **Choose image** looks like a button on every width; `accept="image/*"` stays, so phones
  offer gallery and camera.
- Viewport meta gains `viewport-fit=cover`, safe-area insets pad the page, page zoom stays
  allowed. No horizontal scrolling down to 360 px.
- `.claude/rules/ui.md`: phones become a supported target.

User-visible: on phones the layout, panel toggles and control sizes change; on desktop only
the `Choose image` control changes (a button instead of the native file box).

## Capabilities

### New Capabilities
- `responsive-layout`: layouts per screen size, viewport setup, touch targets, collapsible
  settings and legend panels with their summaries, the image button.

### Modified Capabilities
- `stitch-chart`: "Legend is wide and compact" — below 48rem the legend is a collapsible panel.
- `pattern-generation`: "Stitch dimensions and finished size are always shown" — with
  collapsed settings, the summary shows them.

## Impact

- `index.html`: wrappers and toggle buttons around the existing fields, viewport meta.
- `styles/main.css` (compact and coarse-pointer sections replace the 48rem blocks),
  `styles/print.css` (hide toggles).
- New `src/ui/collapsible.js`; small additions to `src/ui/settings-form.js`, `src/ui/legend.js`,
  `src/core/generation-settings.js`, `src/core/legend-rows.js`.
- No dependencies, no build step, no network.

## Out of scope

Pinch zoom and canvas `touch-action` (add-pinch-zoom), rendering speed
(tile-large-pattern-rendering), pattern limits (raise-pattern-limits), printing, remembering
panel state between visits, exposing the dev server to the network.
