// The application state: its fields and their starting values.
//
// App state (a plain object held by the store from ./store.js)
//   image        the loaded image, or null before the first successful load.
//                Shape: see loadImageFile in ../io/image-loader.js.
//   pattern      null until a pattern exists. Written by ./pattern-generation.js (and cleared by
//                ./image-input.js on a new image); the shape is described in ../core/pattern.js.
//   activeLayer  which view layer the frame shows: 'original', 'dmc' or 'chart'.
//   viewport     { scale, offsetX, offsetY } (see ../core/viewport.js), or null meaning
//                "fit the image as soon as the frame has a size".
//   frame        { width, height } of the view frame in CSS px; written only by ./viewer.js.
//   status       { kind, text }: the message under the frame. kind is 'idle', 'loading',
//                'info' or 'error'; text is shown as is.
//   settings     { targetWidth, maxColors, fabricCount }: the pattern settings, always valid
//                values (see DEFAULT_SETTINGS in ../core/generation-settings.js). Written only
//                by ./settings-form.js.
//   generation   { kind, text }: the pattern generation status shown in the settings form.
//                kind is 'idle', 'running', 'done' or 'error'; text is shown as is.
//                Written only by ./pattern-generation.js.

import { DEFAULT_SETTINGS } from '../core/generation-settings.js';

/** Text shown in the status line before any image is loaded. */
export const IDLE_STATUS_TEXT = 'No image loaded yet.';

/** Returns a fresh starting state: nothing loaded, Original layer, no frame size yet. */
export function createInitialState() {
  return {
    image: null,
    pattern: null,
    activeLayer: 'original',
    viewport: null,
    frame: { width: 0, height: 0 },
    status: { kind: 'idle', text: IDLE_STATUS_TEXT },
    settings: { ...DEFAULT_SETTINGS },
    generation: { kind: 'idle', text: '' },
  };
}
