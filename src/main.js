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
import { createProgressLayer } from './ui/layers/progress-layer.js';
import { setupProgress } from './ui/progress.js';
import { createProgressWarning, createProgressGuard } from './ui/progress-warning.js';
import { setupProgressPersistence } from './ui/progress-persistence.js';
import { openProgressStore } from './io/progress-store.js';
import { setupLegend } from './ui/legend.js';
import { setupSidePanels, SIDE_PANELS_STORAGE_KEY } from './ui/side-panels.js';
import { readPreference, writePreference } from './io/local-preferences.js';
import { createProgressFileSaver, setupProgressFileMenu } from './ui/progress-file.js';
import { downloadProgressFile, readFileBytes } from './io/progress-file.js';
import { setupExcelExport } from './ui/excel-export.js';
import { encodeSummaryPictures } from './io/summary-pictures.js';
import { createWorkbookInWorker } from './io/xlsx-worker-client.js';
import { downloadBlob } from './io/download.js';

const store = createStore(createInitialState());

// The view layers. add-dmc-preview-layer and add-stitch-chart-layer replace the stub files
// behind createDmcLayer and createChartLayer; this list does not change.
const progressLayer = createProgressLayer();
const layers = [createOriginalLayer(), createDmcLayer(), createChartLayer(), progressLayer];

// Marked stitches on the Progress layer (taps and keys come from the frame input below), kept
// in this browser (IndexedDB), and the questions asked before they would be lost or replaced
// (each offers to save the progress at risk as a .stitch file first).
const progressWarning = createProgressWarning(document);
const progressFileSaver = createProgressFileSaver(store, downloadProgressFile);
const progressPersistence = setupProgressPersistence(document, store, openProgressStore(), progressWarning, progressFileSaver);
const progress = setupProgress(document, store, progressLayer, { confirmFirstMark: progressPersistence.confirmFirstMark });
const progressGuard = createProgressGuard(progress, progressWarning, progressPersistence, progressFileSaver);

// Image input and status line.
setupStatus(document, store);
setupImageInput(document, store, progressGuard);

// Pattern settings and generation (the worker runs the pipeline off the main thread; the
// client creates a fresh worker after a stop, so it gets a factory).
const createPatternWorker = () => new Worker(new URL('./workers/pattern.worker.js', import.meta.url), { type: 'module' });
setupSettingsForm(document, store, progressGuard);
setupPatternGeneration(document, store, createPatternWorkerClient(createPatternWorker));

// The shared view frame and its controls.
setupViewer(document, store, layers);
setupViewerInput(document, store, { onTap: progress.toggleAt, onKeyToggle: progress.toggleCentre });
setupZoomControls(document, store);
setupLayerSwitcher(document, store, layers);

// The legend next to the frame.
setupLegend(document, store);

// Folding the settings and legend to their edge on wide and medium screens, remembered in
// local storage.
setupSidePanels(document, store, {
  read: () => readPreference(SIDE_PANELS_STORAGE_KEY),
  write: (text) => writePreference(SIDE_PANELS_STORAGE_KEY, text),
});

// Saving and loading the progress as a .stitch file from the Export menu.
setupProgressFileMenu(document, store, {
  saver: progressFileSaver,
  warning: progressWarning,
  persistence: progressPersistence,
  readBytes: readFileBytes,
});

// Excel workbook export (written in a module worker, one per export).
const createXlsxWorker = () => new Worker(new URL('./workers/xlsx.worker.js', import.meta.url), { type: 'module' });
setupExcelExport(document, store, {
  encodePictures: encodeSummaryPictures,
  createWorkbook: (request) => createWorkbookInWorker(createXlsxWorker, request),
  download: (blob, fileName) => downloadBlob(blob, fileName),
});
