# Architecture

## Layers and dependency direction

```
main.js ──► ui/ ──► core/ ◄── workers/
   │                  ▲
   └──► io/ ──────────┘
data/ ◄── core/
```

- `core/` is **pure**: no `window`, `document`, `self`, `fetch`, `localStorage`, canvas,
  or timers. Input is plain data (numbers, arrays, typed arrays, plain objects); output is
  plain data. This makes it unit-testable in Node and runnable inside a Web Worker.
- `core/` may import only from `core/` and `data/`. It must never import from `ui/`,
  `io/`, `workers/`, or `main.js`.
- `io/` talks to browser APIs (`createImageBitmap`, `OffscreenCanvas`, `Blob`, downloads)
  and converts between browser objects and `core/` plain data (e.g. `ImageData` → pixels).
- `ui/` owns the DOM. It renders state and turns user events into calls. It does not
  contain image-processing or color math — it calls `core/` (directly or via a worker).
- `workers/` are thin message adapters around `core/` functions. No logic of their own.
- `main.js` is the composition root: it creates state, connects UI modules, io, and workers.
  Keep it short; if it grows, extract a module.

## Data flow (pipeline)

1. **Load** (`io/`): file → `ImageBitmap` → pixels (`Uint8ClampedArray`, RGBA).
2. **Resize** (`core/`): pixels → stitch grid of the target width/height (area averaging,
   one cell = one stitch).
3. **Reduce & match** (`core/`): grid colors → at most N DMC colors (see `domain.md`).
4. **Build pattern** (`core/`): `Pattern` = grid of palette indices + legend
   (DMC code, name, hex, symbol, stitch count).
5. **Render / export** (`ui/`, `io/`): canvas preview, printable chart, PNG, JSON.

Each step is a separate function with typed input/output so it can be tested and reused.

## State

- One application state object, owned by a small store module (`src/ui/store.js`):
  `getState()`, `setState(partial)`, `subscribe(listener)`. Plain object, no proxies/magic.
- State holds settings (target size, max colors, fabric count, dithering) and results
  (current `Pattern`). Derived values are computed, not stored twice.
- UI modules read state and re-render; they never mutate state directly.

## Web Workers

- Anything that loops over every pixel of a full-size image or every grid cell × palette
  (resize, quantization, matching) runs in a module worker:
  `new Worker(new URL('./workers/pattern.worker.js', import.meta.url), { type: 'module' })`.
- Messages are plain data. Transfer large buffers (`postMessage(msg, [buffer])`) instead of copying.
- Every message has a `type` and a request `id`; responses echo the `id`. Stale results
  (an older `id` than the latest request) are ignored.

## Persistence

- Optional: save/load a pattern as JSON (`io/`). Keep a `version` field in the format.
- `localStorage` only for small user preferences, accessed only from `ui/`/`io/`.

## Size guidelines

- A file does one thing and stays under ~300 lines. A function stays under ~40 lines.
  Over that is a signal to split, not a hard error.
