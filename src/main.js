// Composition root: creates the application state and connects the ui, io and core modules.
// The only module that knows about everything; keep it short.
// Setup calls are grouped with blank lines between groups, so parallel changes that add a
// group (settings form, legend) edit non-adjacent lines.

import { createStore } from './ui/store.js';
import { createInitialState } from './ui/app-state.js';
import { setupStatus } from './ui/status.js';
import { setupImageInput } from './ui/image-input.js';
import { setupSettingsForm } from './ui/settings-form.js';
import { setupPatternGeneration } from './ui/pattern-generation.js';
import { createPatternWorkerClient } from './io/pattern-worker-client.js';
import { setupLayerSwitcher } from './ui/layer-switcher.js';
import { setupViewer } from './ui/viewer.js';
import { setupViewerInput } from './ui/viewer-input.js';
import { setupZoomControls } from './ui/zoom-controls.js';
import { createOriginalLayer } from './ui/layers/original-layer.js';
import { createDmcLayer } from './ui/layers/dmc-layer.js';
import { createChartLayer } from './ui/layers/chart-layer.js';
import { setupLegend } from './ui/legend.js';

const store = createStore(createInitialState());

// The view layers. add-dmc-preview-layer and add-stitch-chart-layer replace the stub files
// behind createDmcLayer and createChartLayer; this list does not change.
const layers = [createOriginalLayer(), createDmcLayer(), createChartLayer()];

// Image input and status line.
setupStatus(document, store);
setupImageInput(document, store);

// Pattern settings and generation (the worker runs the pipeline off the main thread; the
// client creates a fresh worker after a stop, so it gets a factory).
const createPatternWorker = () => new Worker(new URL('./workers/pattern.worker.js', import.meta.url), { type: 'module' });
setupSettingsForm(document, store);
setupPatternGeneration(document, store, createPatternWorkerClient(createPatternWorker));

// The shared view frame and its controls.
setupViewer(document, store, layers);
setupViewerInput(document, store);
setupZoomControls(document, store);
setupLayerSwitcher(document, store, layers);

// The legend next to the frame.
setupLegend(document, store);
