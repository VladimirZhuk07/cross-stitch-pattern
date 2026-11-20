# Design

## Context

- The header (`.app-header`) holds the h1, the shared Export menu and the `Choose image` label.
- In the compact layout (below 48rem, or below 30rem high while narrower than 60rem) the h1 is
  `min-width: 0` with a nowrap ellipsis at 1.0625rem (17 px) bold, and the header gap is 0.5rem.
- Measured in headless Chrome on `main`:

| Screen | Room for the title | `Cross-Stitch` needs | Full title needs |
|---|---|---|---|
| 360 × 640 | 91 px | 96 px | 214 px |
| 375 × 667 | 106 px | 96 px | 214 px |
| 414 × 896 | 145 px | 96 px | 214 px |
| 667 × 375 | 214 px | 96 px | 214 px |

## Goals / Non-Goals

**Goals:** no cut-off title on portrait phones, the same accessible name, and CSS only.

**Non-Goals:** no changes to wider layouts or to the header's controls.

## Decisions

### D1. Hide the rest of the words visually, not with `display: none`

The markup is `Cross-Stitch<span class="app-header__title-rest"> Pattern Maker</span>`. Below 32rem
the span gets the existing visually-hidden pattern (absolute, 1 px, `clip-path: inset(50%)`),
so the heading's accessible name stays whole.

*Alternatives:*
- CSS `content` on a pseudo-element: rejected. Screen readers may read it as well as the real
  text.
- Two spans, a short one and a full one: rejected. It duplicates the name and needs
  `aria-hidden`.

### D2. Breakpoint 32rem, measured, not the compact breakpoint

The compact layout includes landscape phones (667 px), where the full title fits (214 of 214 px).
The room grows by 1 px for every px of width (91 px at 360, 145 px at 414). The full title
therefore fits from about 445 px. 32rem (512 px) leaves a margin, and it lies below every
tablet width.

### D3. Header gap 0.25rem below 32rem

The gap shrinks from 0.5rem to 0.25rem below 32rem. This gives 8 px more room, so at 360 px
there are 99 px for 96 px of text. Touch targets are unchanged; only the space between them
shrinks. The ellipsis rule stays as a fallback for larger browser font settings.

## Risks / Trade-offs

- [Users with larger default fonts may still see an ellipsis at 360 px] → That is accepted: it
  is the same fallback as today, and the name stays readable for screen readers.
- [The three tests that pin the h1 markup] → They are updated in the same task as the markup.
