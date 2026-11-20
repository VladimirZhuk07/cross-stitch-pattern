# Proposal

## Why

Since the Export menu joined the header, a phone in portrait shows the title as `Cross-Sti…`
(360 px) or `Cross-Stitch Pat…` (414 px). A cut-off name looks broken. The user asked for a
short title on phones.

## What Changes

- On screens narrower than 32rem (512 px), the visible title is `Cross-Stitch`. The words
  ` Pattern Maker` stay in the heading but are visually hidden, so the page title read by
  screen readers is still `Cross-Stitch Pattern Maker`.
- In the same width range the header gap shrinks from 0.5rem to 0.25rem. Measured in headless
  Chrome:
  - at 360 px there are 91 px for the title, and `Cross-Stitch` (17 px bold) needs 96 px;
  - with the smaller gap there are 99 px.
- From 32rem up (landscape phones, tablets, desktop) the full title shows as before; it fits
  there. The ellipsis stays as a fallback for unusual font sizes.
- User-visible: the header on portrait phones reads `Cross-Stitch`.

### Out of scope

- Another title text, a logo in the header, and changing the header's buttons.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `responsive-layout`: a new requirement for the short header title on narrow screens.

## Impact

- `index.html`: the h1 becomes `Cross-Stitch<span class="app-header__title-rest"> Pattern Maker</span>`.
- `styles/main.css`: one `@media screen and (width < 32rem)` block.
- Tests that pin the h1 markup: `export-menu-markup.test.js`, `pdf-export-markup.test.js` and
  `progress-markup.test.js`.
- No JavaScript and no new files.
