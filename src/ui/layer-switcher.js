// The Original / DMC colors / Chart radio group that selects the visible view layer.
// The options are static markup in index.html; this module only enables, disables and
// reads them.

const FALLBACK_LAYER = 'original';

/**
 * Connects the radios inside [data-role="layer-switcher"] (values 'original', 'dmc', 'chart')
 * to state.activeLayer. A radio is enabled exactly when its layer's isAvailable(state) is true.
 * If the active layer becomes unavailable, the Original layer is selected instead.
 * root    element (or document) containing the switcher
 * store   the app store from ./store.js
 * layers  the view layers (see the contract in ./viewer.js)
 */
export function setupLayerSwitcher(root, store, layers) {
  const switcher = root.querySelector('[data-role="layer-switcher"]');
  const radios = [...switcher.querySelectorAll('input[type="radio"]')];
  const layersById = new Map(layers.map((layer) => [layer.id, layer]));

  switcher.addEventListener('change', (event) => {
    const radio = event.target;
    if (radio.checked && layersById.has(radio.value)) {
      store.setState({ activeLayer: radio.value });
    }
  });

  function render(state) {
    for (const radio of radios) {
      const layer = layersById.get(radio.value);
      radio.disabled = layer === undefined || !layer.isAvailable(state);
      radio.checked = radio.value === state.activeLayer;
    }
  }

  function fallBackIfUnavailable(state) {
    const active = layersById.get(state.activeLayer);
    if (active === undefined || !active.isAvailable(state)) {
      store.setState({ activeLayer: FALLBACK_LAYER });
    }
  }

  render(store.getState());
  store.subscribe((state) => {
    fallBackIfUnavailable(state);
    render(store.getState());
  });
}
