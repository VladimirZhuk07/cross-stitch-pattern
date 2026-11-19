// The open/folded state of the two side panels (settings, legend) on wide and medium screens,
// and how it is stored as text. Pure: no DOM, no storage access.
// The authoritative description is openspec/specs/responsive-layout/spec.md ("Side panels
// fold to their edge on wide and medium screens", "Folded state is remembered across page loads").
//
// SidePanelState (a plain object created by parseSidePanelState)
//   settings  'open' or 'folded': the settings panel left of the frame
//   legend    'open' or 'folded': the legend right of (or under) the frame

const OPEN = 'open';
const FOLDED = 'folded';
const PANEL_STATES = [OPEN, FOLDED];
const PANEL_NAMES = ['settings', 'legend'];

/** Both panels open: the layout of a first visit, and the fallback for anything unreadable. */
export const SIDE_PANEL_DEFAULTS = Object.freeze({ settings: OPEN, legend: OPEN });

/**
 * Reads a SidePanelState from stored text.
 * text  the stored string, or null when nothing is stored
 * Returns a new SidePanelState. A panel whose value is missing or unknown, and both panels
 * when the text is not a JSON object, are 'open'. Never throws: a broken preference must
 * never stop the app from starting.
 */
export function parseSidePanelState(text) {
  const stored = parseJsonObject(text);
  const state = { ...SIDE_PANEL_DEFAULTS };
  for (const name of PANEL_NAMES) {
    if (PANEL_STATES.includes(stored[name])) {
      state[name] = stored[name];
    }
  }
  return state;
}

/**
 * Turns a SidePanelState into the text to store (the inverse of parseSidePanelState).
 * state  a SidePanelState; fields other than settings and legend are ignored
 * Returns JSON such as '{"settings":"folded","legend":"open"}'.
 * Throws TypeError when a panel's value is not 'open' or 'folded'.
 */
export function serializeSidePanelState(state) {
  const stored = {};
  for (const name of PANEL_NAMES) {
    if (!PANEL_STATES.includes(state[name])) {
      throw new TypeError(`${name} must be 'open' or 'folded', got ${JSON.stringify(state[name])}`);
    }
    stored[name] = state[name];
  }
  return JSON.stringify(stored);
}

// Returns the parsed object, or an empty object for null, invalid JSON, arrays and non-objects.
function parseJsonObject(text) {
  if (text === null) {
    return {};
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    // Not JSON (e.g. edited by hand or written by another app on the same origin): use defaults.
    return {};
  }
  const isPlainObject = typeof value === 'object' && value !== null && !Array.isArray(value);
  return isPlainObject ? value : {};
}
