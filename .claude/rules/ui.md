---
paths:
  - "**/*.html"
  - "**/*.css"
  - "src/ui/**"
  - "src/main.js"
---

# UI: HTML, CSS, DOM

## HTML

- One page: `index.html`. Load the app with `<script type="module" src="./src/main.js"></script>`.
- Semantic elements (`header`, `main`, `section`, `form`, `fieldset`, `button`, `output`).
  Buttons are `<button type="button">`, never clickable `div`s.
- All paths relative (`./styles/main.css`). No external resources (fonts, CDNs, icons from the web).
- Reusable markup lives in `<template>` elements and is cloned from JS.

## DOM in JavaScript

- Create elements with `document.createElement` / `template.content.cloneNode(true)`
  and set text with `textContent`.
- **Never** put user-controlled data (file names, imported JSON) into `innerHTML`.
  `innerHTML` is allowed only for static, hard-coded markup.
- Query elements once at module setup; use `data-*` attributes as JS hooks
  (`[data-action="export-png"]`), not CSS classes.
- Use event delegation for lists (legend rows, palette entries).
- UI modules export a setup function, e.g. `setupLegend(root, store)`, which attaches listeners
  and subscribes to the store. No work at import time.

## Rendering the pattern

- Draw the stitch grid on `<canvas>`, never as one DOM element per cell
  (a 300×300 pattern is 90 000 cells).
- Account for `devicePixelRatio` so the grid stays crisp.
- Grid conventions: thin line every stitch, bold line every 10 stitches, row/column numbers
  every 10. Show a center marker.
- Four switchable layers in one shared frame: the original image, the image in DMC colors
  as color blocks, the number chart (every cell white with its legend number 1..N in
  black; printable in black and white), and Progress (the chart on which tapped stitches show
  their DMC color). Numbers must remain legible without color.

## Accessibility

- Every input has a visible `<label>`. Group related settings in `fieldset` + `legend`.
- Everything works with the keyboard; focus is always visible (`:focus-visible`).
- Color is never the only carrier of information — the legend always shows the number,
  DMC code, name, swatch and stitch count.
- Long operations show progress/busy state (`aria-busy`, a status `output` with `aria-live="polite"`).

## CSS

- Plain CSS in `styles/`. No frameworks, no preprocessors.
- Design tokens as custom properties on `:root` (`--color-bg`, `--space-2`, `--radius`).
- Simple, flat class names (`.legend`, `.legend__row`). Avoid IDs and deep selectors in CSS.
- No inline styles except values computed at runtime (e.g. a swatch background color via
  `element.style.setProperty('--swatch', hex)`).
- Layout with flexbox/grid. Phones (from 360 px wide, portrait and landscape) are a supported
  target; the desktop and medium layout stays as it is with both panels open, and there the
  settings and legend may fold to their edge (CSS reads `aria-expanded` on the side toggle).
  CSS alone decides the layout: the compact layout
  applies below 48rem width, or below 30rem height while narrower than 60rem, on `screen` only
  (never in print). No horizontal page scroll down to 360 px.
- Touch targets are at least 44 × 44 CSS px in the compact layout and on coarse pointers.
- Never disable page zoom in the viewport meta tag (no `maximum-scale`/`user-scalable`).
- `@media print` stylesheet: hide controls, print the number chart and legend on clean pages.
