# Proposal

## Why

On a desktop the settings column (256 px) and the legend (384 px) take about half of a
1440 px window. While stitching or studying the chart the user rarely needs either. Folding
them away gives the frame up to 552 px more width.

## What Changes

- On wide screens each side panel gets a toggle button that folds it to its own edge.
  Settings fold to the left, the legend folds to the right. A folded panel becomes a narrow
  44 px rail that holds only the toggle (`Settings` / `Legend`), so it can be reopened.
- On medium screens (the legend sits under the frame) the settings fold to the left. The
  legend folds down into a 44 px bar along the bottom.
- The frame takes the freed space. Zoom stays the same, and the image point at the frame
  centre stays at the centre.
- The open/folded state of each panel is remembered in `localStorage` across page loads.
  Missing, unreadable or blocked storage falls back to both panels open.
- If generation needs the user while the settings are folded, the settings unfold by
  themselves. This happens when a large pattern waits for **Generate**, or when generation
  fails.
- User-visible: new toggle buttons on wide and medium screens. With both panels open, the
  layout looks as it does today. **BREAKING (spec):** "Desktop and medium layouts stay
  unchanged" no longer forbids panel toggles on those screens.

### Out of scope

- The compact (phone) layout. Its own `Settings`/`Legend` toggles stay exactly as they are,
  and the side state is ignored there.
- Printing. Folded panels print as if they were open, and the toggles are hidden.
- Resizing panels by dragging, keyboard shortcuts for folding, and folding animations.
- Showing generation progress inside a folded rail.

## Capabilities

### New Capabilities

None. Folding panels is part of how the app arranges itself on a screen.

### Modified Capabilities

- `responsive-layout`: the wide/medium layout requirement now allows side toggles. New
  requirements cover folding to the panel's edge, the toggle buttons, remembering the state,
  keeping the view centred, unfolding the settings on demand, and the compact/print
  exemptions.

## Impact

- `index.html`: one side toggle button in the settings form and one in the legend, plus ids
  for `aria-controls`.
- `styles/main.css`: folded rails and bar, limited to non-compact screens. `styles/print.css`:
  hide the side toggles.
- New `src/core/side-panels.js` (pure: parse/serialise the stored state, decide when settings
  must unfold), `src/io/local-preferences.js` (safe `localStorage` read/write),
  `src/ui/side-panels.js` (wiring). `src/ui/collapsible.js` gets an optional change callback.
  `src/main.js` gets one setup call.
- `.claude/rules/ui.md`: "the desktop layout stays as it is" is reworded to allow foldable
  panels.
- No new dependencies, no network.
