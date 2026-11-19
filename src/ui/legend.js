// The legend panel beside or under the frame: one row per pattern color, in legend-number
// order. The markup (section, table, row template) is static in index.html; this module only
// fills it. On phones the rows fold behind a Legend button showing the number of colors
// (see ./collapsible.js); on wider screens the whole panel can fold to its edge (see
// ./side-panels.js).
// A click on a row (or Enter/Space on its number button) selects that color for the Chart
// highlight, a second click or Esc clears it (state.highlightedColor, see ./app-state.js and
// openspec/specs/stitch-chart/spec.md). One delegated listener on the rows container serves
// every row.

import { formatHighlightLabel, formatLegendSummary, legendRows } from '../core/legend-rows.js';
import { toggleHighlight } from '../core/highlight.js';
import { setupCollapsible } from './collapsible.js';

const SELECTED_ROW_CLASS = 'legend__row--selected';
const CHART_LAYER = 'chart';

/**
 * Renders the legend of state.pattern into [data-role="legend"] and keeps it up to date.
 * The panel is hidden while there is no pattern and shown on every view layer once one
 * exists. A pattern without stitches shows the [data-role="legend-empty"] text instead of rows.
 * Rows are rebuilt only when the pattern object changes. The toggle [data-action="toggle-legend"]
 * folds the rows on phones; its [data-role="legend-summary"] shows the number of colors.
 * Owns state.highlightedColor: sets it from row clicks (switching to the Chart layer when a
 * color is selected on another layer), clears it on Esc and whenever the pattern changes.
 * root   the document (Esc is listened for on it), or an element containing the legend
 * store  the app store from ./store.js
 */
export function setupLegend(root, store) {
  const panel = root.querySelector('[data-role="legend"]');
  const rowsContainer = panel.querySelector('[data-role="legend-rows"]');
  const emptyText = panel.querySelector('[data-role="legend-empty"]');
  const table = panel.querySelector('[data-role="legend-table"]');
  const rowTemplate = panel.querySelector('[data-role="legend-row-template"]');
  const summary = panel.querySelector('[data-role="legend-summary"]');
  let rowElements = [];

  setupCollapsible(panel.querySelector('[data-action="toggle-legend"]'));

  function render(pattern) {
    panel.hidden = pattern === null;
    if (pattern === null) {
      rowElements = [];
      rowsContainer.replaceChildren();
      return;
    }
    const rows = legendRows(pattern);
    emptyText.hidden = rows.length > 0;
    table.hidden = rows.length === 0;
    summary.textContent = formatLegendSummary(rows.length);
    const fragments = rows.map((row, index) => createRow(rowTemplate, row, index));
    rowElements = fragments.map((fragment) => fragment.firstElementChild);
    rowsContainer.replaceChildren(...fragments);
  }

  function renderSelection(highlightedColor) {
    rowElements.forEach((row, index) => {
      const isSelected = index === highlightedColor;
      row.classList.toggle(SELECTED_ROW_CLASS, isSelected);
      row.querySelector('[data-action="highlight-color"]').setAttribute('aria-pressed', String(isSelected));
    });
  }

  rowsContainer.addEventListener('click', (event) => {
    const row = event.target.closest('[data-legend-index]');
    if (row === null) {
      return;
    }
    const state = store.getState();
    const highlightedColor = toggleHighlight(state.highlightedColor, Number(row.dataset.legendIndex));
    const switchesToChart = highlightedColor !== null && state.activeLayer !== CHART_LAYER;
    store.setState(switchesToChart ? { highlightedColor, activeLayer: CHART_LAYER } : { highlightedColor });
  });

  // Esc anywhere on the page clears the highlight; without one it is left alone entirely.
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && store.getState().highlightedColor !== null) {
      store.setState({ highlightedColor: null });
    }
  });

  render(store.getState().pattern);
  renderSelection(store.getState().highlightedColor);
  store.subscribe((state, previous) => {
    if (state.pattern !== previous.pattern) {
      render(state.pattern);
      renderSelection(state.highlightedColor);
      if (state.highlightedColor !== null) {
        store.setState({ highlightedColor: null }); // the old pattern's numbering no longer applies
      }
      return;
    }
    if (state.highlightedColor !== previous.highlightedColor) {
      renderSelection(state.highlightedColor);
    }
  });
}

// Clones the row template and fills it with one LegendRow (see ../core/legend-rows.js) at
// legend index `index`. Values are set as text or attributes only, never as markup.
function createRow(rowTemplate, row, index) {
  const fragment = rowTemplate.content.cloneNode(true);
  const field = (name) => fragment.querySelector(`[data-field="${name}"]`);
  fragment.firstElementChild.dataset.legendIndex = String(index);
  field('number').textContent = row.number;
  field('number').style.setProperty('--tint', row.tint);
  field('number').setAttribute('aria-label', formatHighlightLabel(row));
  field('code').textContent = row.code;
  field('name').textContent = row.name;
  field('stitchCount').textContent = row.stitchCount;
  field('swatch').style.setProperty('--swatch', row.hex);
  return fragment;
}
