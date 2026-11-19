// The shared view frame: one canvas showing exactly one view layer at a time.
//
// View-layer contract (the plug-in point for the DMC colors and Chart layers)
//   A view layer is a plain object created by a factory in ./layers/, e.g. createDmcLayer():
//     id           'original', 'dmc' or 'chart' (matches the radio values in index.html)
//     isAvailable(state)
//                  true when the layer can be shown for this app state (see ./app-state.js);
//                  must be pure. Disabled layers cannot be selected.
//     render(ctx, frame, state)
//                  draws the layer. Called only for the active layer, only when an image is
//                  loaded and the frame has a size.
//                  ctx    the canvas 2D context, cleared, already scaled so 1 unit = 1 CSS px,
//                         wrapped in save()/restore() by the viewer
//                  frame  { width, height, pixelRatio, viewport, content }:
//                         width, height  frame size in CSS px
//                         pixelRatio     device px per CSS px (use 1 / pixelRatio for hairlines)
//                         viewport       { scale, offsetX, offsetY } (../core/viewport.js)
//                         content        { x, y, width, height } in CSS px: the image rectangle
//                                        on screen. Every layer paints into exactly this
//                                        rectangle; a W × H stitch grid covers all of it,
//                                        column c spanning c/W … (c+1)/W of its width.
//                  state  the app state (read only)
//                  render must be synchronous, must not change state, and must not add DOM
//                  listeners. It may cache drawings in its factory closure, keyed by the
//                  identity of state.pattern. It may return true when its picture is still
//                  being built (spread over frames): the viewer then paints once more in the
//                  next animation frame; any other return value means "done".

import { fitViewport, recenterOnResize, contentRect, canvasBufferSize } from '../core/viewport.js';

/**
 * Sets up the frame [data-role="viewer"] with its canvas [data-role="viewer-canvas"] and the
 * empty-state text [data-role="viewer-empty"].
 * Measures the frame into state.frame (keeping the view centered on resize), fits the image
 * whenever state.viewport is null, and repaints the active layer at most once per animation
 * frame when the image, pattern, active layer, viewport or frame size changes.
 * root    element (or document) containing the viewer
 * store   the app store from ./store.js
 * layers  the view layers, one per id
 */
export function setupViewer(root, store, layers) {
  const viewer = root.querySelector('[data-role="viewer"]');
  const canvas = root.querySelector('[data-role="viewer-canvas"]');
  const emptyState = root.querySelector('[data-role="viewer-empty"]');
  const ctx = canvas.getContext('2d');
  const layersById = new Map(layers.map((layer) => [layer.id, layer]));
  let isPaintScheduled = false;

  function schedulePaint() {
    if (isPaintScheduled) {
      return;
    }
    isPaintScheduled = true;
    requestAnimationFrame(() => {
      isPaintScheduled = false;
      const needsAnotherFrame = paint(ctx, canvas, store.getState(), layersById);
      if (needsAnotherFrame) {
        schedulePaint();
      }
    });
  }

  function fitIfNeeded(state) {
    const { image, viewport, frame } = state;
    if (image !== null && viewport === null && frame.width > 0 && frame.height > 0) {
      store.setState({ viewport: fitViewport(image, frame) });
    }
  }

  store.subscribe((state, previous) => {
    emptyState.hidden = state.image !== null;
    fitIfNeeded(state);
    if (needsPaint(state, previous)) {
      schedulePaint();
    }
  });

  new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect;
    store.setState(resizedFrameState(store.getState(), { width, height }));
  }).observe(viewer);

  watchPixelRatio(schedulePaint);
  emptyState.hidden = store.getState().image !== null;
}

function needsPaint(state, previous) {
  return state.image !== previous.image
    || state.pattern !== previous.pattern
    || state.activeLayer !== previous.activeLayer
    || state.viewport !== previous.viewport
    || state.frame !== previous.frame
    || state.highlightedColor !== previous.highlightedColor;
}

/** The state change for a new frame size: keep the zoom and the point at the frame center. */
function resizedFrameState(state, newFrame) {
  const oldFrame = state.frame;
  if (oldFrame.width === newFrame.width && oldFrame.height === newFrame.height) {
    return {};
  }
  const hadSize = oldFrame.width > 0 && oldFrame.height > 0;
  const viewport = state.viewport !== null && hadSize
    ? recenterOnResize(state.viewport, oldFrame, newFrame)
    : state.viewport;
  return { frame: newFrame, viewport };
}

// Paints the active layer; returns true when the layer asked for another frame.
function paint(ctx, canvas, state, layersById) {
  const { frame, image, viewport } = state;
  const pixelRatio = window.devicePixelRatio || 1;
  const buffer = canvasBufferSize(frame, pixelRatio);
  if (canvas.width !== buffer.width || canvas.height !== buffer.height) {
    canvas.width = buffer.width;
    canvas.height = buffer.height;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const layer = layersById.get(state.activeLayer);
  if (image === null || viewport === null || frame.width === 0 || frame.height === 0 || !layer) {
    return false;
  }
  ctx.save();
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const layerFrame = {
    width: frame.width,
    height: frame.height,
    pixelRatio,
    viewport,
    content: contentRect(viewport, image),
  };
  const needsAnotherFrame = layer.render(ctx, layerFrame, state) === true;
  ctx.restore();
  return needsAnotherFrame;
}

/**
 * Calls onChange whenever devicePixelRatio changes (browser zoom, moving the window to a
 * screen with another density) so the canvas buffer can be resized even if the frame's CSS
 * size stays the same.
 */
function watchPixelRatio(onChange) {
  const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  query.addEventListener('change', () => {
    onChange();
    watchPixelRatio(onChange);
  }, { once: true });
}
