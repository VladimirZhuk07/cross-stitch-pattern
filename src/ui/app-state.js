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
//                kind is one of:
//                  'idle'                   nothing to report
//                  'awaiting-confirmation'  a large pattern waits for the Generate button
//                  'running'                a pattern is being generated (Stop is offered)
//                  'stopped'                the user pressed Stop (Generate is offered)
//                  'done'                   the newest pattern is ready
//                  'error'                  generation failed
//                text is shown as is. Written only by ./pattern-generation.js.
//   highlightedColor  the legend index (0 … N − 1) of the color highlighted on the Chart, or
//                null. Written only by ./legend.js, which clears it whenever the pattern changes.
//   progress     the stitches marked on the Progress layer: a Progress (../core/progress.js) of
//                state.pattern, or null without a pattern. Written by ./progress.js, which
//                starts a fresh one for every new pattern and makes the toggles, and by
//                ./progress-persistence.js, which brings back the saved progress and adopts a
//                progress loaded from a .stitch file.
//   isFrameKeyboardFocused  true while the view frame has focus from the keyboard (Tab), so the
//                Progress layer shows its centre marker. Written only by ./viewer-input.js.

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
    highlightedColor: null,
    progress: null,
    isFrameKeyboardFocused: false,
  };
}
