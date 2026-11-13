// Composition root: creates the application state and connects the ui, io and core modules.
// The only module that knows about everything; keep it short.

import { createStore } from './ui/store.js';
import { createInitialState } from './ui/app-state.js';
import { setupStatus } from './ui/status.js';
import { setupImageInput } from './ui/image-input.js';
import { setupViewer } from './ui/viewer.js';
import { createOriginalLayer } from './ui/layers/original-layer.js';
import { createDmcLayer } from './ui/layers/dmc-layer.js';
import { createChartLayer } from './ui/layers/chart-layer.js';

const store = createStore(createInitialState());

// The view layers. add-dmc-preview-layer and add-stitch-chart-layer replace the stub files
// behind createDmcLayer and createChartLayer; this list does not change.
const layers = [createOriginalLayer(), createDmcLayer(), createChartLayer()];

setupStatus(document, store);
setupImageInput(document, store);

setupViewer(document, store, layers);
