# Tasks

## 1. Markup and styles

- [x] 1.1 Add a failing test to `tests/integration/layout-css.test.js`: `styles/main.css` has a `@media screen and (width < 32rem)` block in which `.app-header__title-rest` is visually hidden (`position: absolute`, `clip-path: inset(50%)`) and `.app-header` has `gap: var(--space-1)`; verify it fails
- [x] 1.2 Change the h1 in `index.html` to `Cross-Stitch<span class="app-header__title-rest"> Pattern Maker</span>`, add the CSS block (design D1–D3), and update the h1 expectations in `tests/integration/export-menu-markup.test.js`, `pdf-export-markup.test.js` and `progress-markup.test.js` (the heading text is still `Cross-Stitch Pattern Maker`); verify 1.1 and `npm run test:integration` pass

## 2. Verification

- [x] 2.1 Run `npm run test:unit`; all tests pass
- [x] 2.2 Run `npm run test:integration`; all tests pass
- [x] 2.3 Browser smoke check with `node scripts/serve.js` (headless Chrome is fine):
  - 360 × 640 and 414 × 896: the header shows `Cross-Stitch` without an ellipsis, Export and Choose image are fully visible, and there is no sideways scroll.
  - 667 × 375 and 1440 × 900: the full title shows.
  - The accessibility tree (CDP `Accessibility.getFullAXTree`) names the heading `Cross-Stitch Pattern Maker` at 360 px.
- [x] 2.4 Run `openspec validate shorten-phone-title --strict`; it passes
