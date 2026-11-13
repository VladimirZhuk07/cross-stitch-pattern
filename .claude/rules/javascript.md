---
paths:
  - "**/*.js"
---

# JavaScript style

## Language and modules

- Modern JavaScript (ES2022+) supported by current evergreen browsers. No transpilation.
- Native ES modules only. Always include the `.js` extension in import paths
  (`import { toLab } from './color.js'`) — browsers require it.
- **Named exports only**, no `export default`. One module = one clear responsibility.
- No global variables, no writing to `window`. No side effects at import time
  except in `main.js` and worker entry files.

## Documentation instead of types

- No type annotations: no `// @ts-check`, no `@typedef`, no `{type}` in `@param`/`@returns`,
  no `src/core/types.js`. Correctness comes from tests.
- Every exported function has a short plain-text comment: what it does, what each
  parameter means (units, ranges), and what it returns or throws.
- A data shape shared between modules (e.g. `Pattern`) is described once, in plain words,
  in a comment next to the function that creates it; consumers refer to that module.
  Its OpenSpec spec is the authoritative description.

## Readability

- `const` by default, `let` only when reassigned, never `var`.
- Descriptive names over comments: `nearestDmcColor(lab)` not `find(c)`.
- Early returns instead of nested `if`. No nested ternaries.
- Prefer a plain `for` loop over clever `reduce` chains when it reads better.
- Magic numbers become named constants (`const INCHES_TO_CM = 2.54`).
- Comments explain **why**, not what. Cite sources for formulas
  (e.g. `// CIEDE2000, Sharma et al. 2005, eq. 1–21`).
- `async`/`await` instead of `.then()` chains.
- No `console.log` left in committed code; `console.error` only for genuinely unexpected failures.

## Functions and data

- Pure functions by default: same input → same output, do not mutate arguments.
- Exception: hot loops over pixel buffers may write into a preallocated output typed array —
  name it clearly (`out`) and say so in the function's comment.
- Use typed arrays for pixel/grid data. Do not allocate an object per pixel in hot loops.
- Classes only when there is real long-lived state with behavior (e.g. a worker client).
  Otherwise use functions and plain objects.

## Errors

- `core/` throws `Error` (or `RangeError`/`TypeError`) with a message that states what was
  wrong and the value received: `RangeError('maxColors must be 1–100, got 0')`.
- Validate input at module boundaries (public functions), not in every inner helper.
- `ui/` catches errors and shows a human-readable message to the user. Never swallow errors
  silently (`catch {}` with no handling is forbidden).

## Naming

| Kind | Style | Example |
|---|---|---|
| Files | kebab-case | `color-distance.js`, `pattern.worker.js` |
| Functions, variables | camelCase | `buildPattern`, `targetWidth` |
| Classes, data shape names in docs | PascalCase | `WorkerClient`, `Pattern` |
| Constants | UPPER_SNAKE_CASE | `MAX_COLORS`, `DEFAULT_FABRIC_COUNT` |
| Booleans | `is/has/should` prefix | `isTransparent`, `hasBackstitch` |
