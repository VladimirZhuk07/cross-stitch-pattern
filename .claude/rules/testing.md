---
paths:
  - "tests/**"
  - "src/**"
---

# Testing

## Tooling

- Built-in Node test runner only: `import { describe, it } from 'node:test'` and
  `import assert from 'node:assert/strict'`. No Jest, Vitest, Mocha, or any other package.
- Commands:

  | What | Command |
  |---|---|
  | All tests | `npm test` |
  | Unit only | `npm run test:unit` |
  | Integration only | `npm run test:integration` |
  | One file | `node --test tests/unit/core/color.test.js` |

- Always pass an explicit glob (as the npm scripts do). Bare `node --test` also scans
  `.claude/worktrees/**` and would run tests from other change branches.
- Test files end with `.test.js`. Shared helpers go in `tests/helpers/` (no `.test.js` suffix).

## Unit tests — `tests/unit/`

- Mirror `src/core/`: `src/core/color.js` → `tests/unit/core/color.test.js`.
- Every exported function in `src/core/` has unit tests. `core/` is pure, so tests need no
  DOM, no mocks, no browser.
- Cover: normal cases, boundaries (1 color, 1×1 grid, fully transparent image), and invalid
  input (`assert.throws` with the expected error type/message).

## Integration tests — `tests/integration/`

Test that modules work together, still in Node with no dependencies:

- **Pipeline:** synthetic RGBA buffer → resize → reduce/match → `Pattern`; check grid size,
  legend contents, stitch counts, empty cells.
- **Worker protocol:** import the worker's message handler and call it directly with request
  messages; check response shape, `id` echo, and error responses.
- **Export formats:** pattern → JSON → pattern round-trip; `version` field present.
- **Served site:** start `scripts/serve.js` on a free port (port `0`), `fetch` `index.html`,
  follow every relative `<script>`, `<link>`, and static `import` recursively, and assert each
  responds 200 with the right content type and every import path is relative and ends in `.js`.
  This catches paths that would break on GitHub Pages.

`io/` and `ui/` code is not unit-tested; extract any logic worth testing into `core/`.
Real browser behavior is checked by the manual smoke step in each change's `tasks.md`.

## How to write tests

- TDD for `core/`: write the failing test first, see it fail, then implement.
- Small, hand-written inputs (a 2×2 pixel buffer, a 3-color palette) — no binary image fixtures
  unless unavoidable.
- Floating-point results use a tolerance helper, not `strictEqual`:
  ``assert.ok(Math.abs(actual - expected) < 1e-4, `expected ${expected}, got ${actual}`)``.
- Color math is checked against published reference values (e.g. Sharma et al. CIEDE2000
  test pairs), with the source cited in the test file.
- Test names describe behavior: `it('maps pure white to DMC BLANC')`.
- One behavior per `it`. No shared mutable state between tests. Integration tests that start a
  server close it in `after()`.
