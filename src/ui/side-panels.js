// The side toggles that fold the settings and the legend to their edge on wide and medium
// screens (openspec/specs/responsive-layout/spec.md, "Side panels fold to their edge …").
// As with the phone toggles (./collapsible.js), the state lives in each toggle's aria-expanded
// and CSS decides what it means: styles/main.css shrinks a panel whose side toggle says
// "false" to a rail, and hides side toggles on compact screens and in print. The state is not
// in the app store; this module remembers it in local storage and opens folded settings when
// generation needs the user.

import { parseSidePanelState, serializeSidePanelState, shouldOpenSettings } from '../core/side-panels.js';
import { setupCollapsible } from './collapsible.js';

/** The local storage key, namespaced because all GitHub Pages sites of a user share an origin. */
export const SIDE_PANELS_STORAGE_KEY = 'cross-stitch-pattern-maker:side-panels';

// Per panel: the toggle's data-action and its tooltips for the open and folded state.
const PANELS = {
  settings: { action: 'toggle-settings-side', openTitle: 'Hide settings', foldedTitle: 'Show settings' },
  legend: { action: 'toggle-legend-side', openTitle: 'Hide legend', foldedTitle: 'Show legend' },
};

/**
 * Restores the stored side panel state, wires both side toggles and watches the generation
 * status.
 * root     the document (or any element containing both side toggles)
 * store    the app store (./store.js); only state.generation is read
 * storage  { read, write }: read() returns the stored text or null, write(text) stores it and
 *          returns false when it could not (see ../io/local-preferences.js). A failed write is
 *          ignored: the panels still fold for this page.
 */
export function setupSidePanels(root, store, storage) {
  const state = parseSidePanelState(storage.read());
  const toggles = {};

  for (const [name, panel] of Object.entries(PANELS)) {
    const toggle = root.querySelector(`[data-action="${panel.action}"]`);
    toggles[name] = toggle;
    render(name);
    setupCollapsible(toggle, (isExpanded) => {
      state[name] = isExpanded ? 'open' : 'folded';
      render(name);
      storage.write(serializeSidePanelState(state));
    });
  }

  function render(name) {
    const isOpen = state[name] === 'open';
    const panel = PANELS[name];
    toggles[name].setAttribute('aria-expanded', String(isOpen));
    toggles[name].setAttribute('title', isOpen ? panel.openTitle : panel.foldedTitle);
  }

  store.subscribe((current, previous) => {
    if (current.generation === previous.generation || state.settings === 'open') {
      return;
    }
    if (shouldOpenSettings(previous.generation.kind, current.generation.kind)) {
      state.settings = 'open';
      render('settings');
      storage.write(serializeSidePanelState(state));
    }
  });
}
