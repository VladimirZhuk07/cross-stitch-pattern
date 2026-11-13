// Composition root: creates the application state and connects the ui, io and core modules.
// The only module that knows about everything; keep it short.

import { createStore } from './ui/store.js';
import { createInitialState } from './ui/app-state.js';
import { setupStatus } from './ui/status.js';
import { setupImageInput } from './ui/image-input.js';

const store = createStore(createInitialState());

setupStatus(document, store);
setupImageInput(document, store);
