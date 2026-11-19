// The legend panel beside or under the frame: one row per pattern color, in legend-number
// order. The markup (section, table, row template) is static in index.html; this module only
// fills it. On phones the rows fold behind a Legend button showing the number of colors
// (see ./collapsible.js); on wider screens the whole panel can fold to its edge (see
// ./side-panels.js). Rows have no actions yet; a future row action (e.g. highlighting a color) should use
// one delegated listener on the rows container.

import { formatLegendSummary, legendRows } from '../core/legend-rows.js';
import { setupCollapsible } from './collapsible.js';

/**
 * Renders the legend of state.pattern into [data-role="legend"] and keeps it up to date.
 * The panel is hidden while there is no pattern and shown on every view layer once one
 * exists. A pattern without stitches shows the [data-role="legend-empty"] text instead of rows.
 * Rows are rebuilt only when the pattern object changes. The toggle [data-action="toggle-legend"]
 * folds the rows on phones; its [data-role="legend-summary"] shows the number of colors.
 * root   element (or document) containing the legend
 * store  the app store from ./store.js
 */
export function setupLegend(root, store) {
  const panel = root.querySelector('[data-role="legend"]');
  const rowsContainer = panel.querySelector('[data-role="legend-rows"]');
  const emptyText = panel.querySelector('[data-role="legend-empty"]');
  const table = panel.querySelector('[data-role="legend-table"]');
  const rowTemplate = panel.querySelector('[data-role="legend-row-template"]');
  const summary = panel.querySelector('[data-role="legend-summary"]');

  setupCollapsible(panel.querySelector('[data-action="toggle-legend"]'));

  function render(pattern) {
    panel.hidden = pattern === null;
    if (pattern === null) {
      rowsContainer.replaceChildren();
      return;
    }
    const rows = legendRows(pattern);
    emptyText.hidden = rows.length > 0;
    table.hidden = rows.length === 0;
    summary.textContent = formatLegendSummary(rows.length);
    rowsContainer.replaceChildren(...rows.map((row) => createRow(rowTemplate, row)));
  }

  render(store.getState().pattern);
  store.subscribe((state, previous) => {
    if (state.pattern !== previous.pattern) {
      render(state.pattern);
    }
  });
}

// Clones the row template and fills it with one LegendRow (see ../core/legend-rows.js).
// Values are set as text only, never as markup.
function createRow(rowTemplate, row) {
  const fragment = rowTemplate.content.cloneNode(true);
  const field = (name) => fragment.querySelector(`[data-field="${name}"]`);
  field('number').textContent = row.number;
  field('number').style.setProperty('--tint', row.tint);
  field('code').textContent = row.code;
  field('name').textContent = row.name;
  field('stitchCount').textContent = row.stitchCount;
  field('swatch').style.setProperty('--swatch', row.hex);
  return fragment;
}
