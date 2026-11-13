# Cross-Stitch Pattern Maker

A static, browser-only web app that turns an image (JPG, PNG, WebP, GIF, BMP, AVIF —
anything the browser can decode) into a cross-stitch pattern using the DMC embroidery
floss palette: a symbol grid, a color legend with DMC codes, and printable/exportable output.

## Hard constraints

- **Zero dependencies.** No npm packages — runtime or dev. No `npm install`, no `npx`.
  `package.json` may exist only for `"type": "module"` and `scripts`; it must never
  contain `dependencies` or `devDependencies`.
- **No build step.** Source files are served as-is. Native ES modules, no bundler,
  no transpiler, no TypeScript compiler, no type annotations (`// @ts-check`, JSDoc types).
- **Static hosting on GitHub Pages.** The app is served from a sub-path
  (`https://<user>.github.io/<repo>/`), so every URL in HTML/JS/CSS is **relative**
  (`./src/main.js`, never `/src/main.js`).
- **Images never leave the device.** No network requests, no analytics, no CDN fonts or
  scripts. Everything is processed locally in the browser.
- **Readable over clever.** Code is written to be read by a person new to the project.

## Commands

| Task | Command |
|---|---|
| Run all tests | `npm test` |
| Unit / integration only | `npm run test:unit` / `npm run test:integration` |
| Run one test file | `node --test tests/unit/core/color.test.js` |
| Dev server | `node scripts/serve.js` (ES modules do not load over `file://`) |
| OpenSpec status | `openspec list`, `openspec validate <change> --strict` |

Do not run bare `node --test`: it also picks up tests inside `.claude/worktrees/`.

Requires Node.js 22+ (only for tests and the dev server; the app itself needs only a browser).

## Project layout

```
index.html          single page entry, loads ./src/main.js as a module
styles/             plain CSS (screen + print)
src/
  main.js           wires UI to core; the only place that knows about everything
  core/             pure logic: color math, quantization, DMC matching, pattern model
  io/               browser I/O: image decoding, export (PNG, print, JSON)
  ui/               DOM rendering and event handling
  workers/          Web Workers that run core/ off the main thread
  data/dmc.js       the DMC palette (code, name, hex)
tests/
  unit/             mirrors src/core/
  integration/      pipeline, worker protocol, export formats, served site
scripts/serve.js    tiny static dev server on node:http
openspec/
  specs/            current source of truth: what the app does
  changes/          open changes (proposal, spec deltas, design, tasks)
  changes/archive/  finished changes
  config.yaml       project context + artifact rules + apply/archive guidance
```

## Rules

Detailed rules live in `.claude/rules/` and are loaded automatically:

- `architecture.md` — layers, dependency direction, workers, data flow
- `javascript.md` — JS style, documentation comments, naming, error handling
- `ui.md` — HTML, CSS, DOM, accessibility, canvas rendering
- `domain.md` — cross-stitch and color-science rules (DMC, CIELAB, ΔE2000, fabric count)
- `testing.md` — node:test conventions, unit vs integration tests, TDD for core/
- `workflow.md` — OpenSpec change lifecycle in git worktrees, quality gate, merge rules

## Workflow (summary — details in `.claude/rules/workflow.md`)

1. `/opsx:explore` (optional) — think it through on `main`, no writes.
2. New worktree: `git worktree add .claude/worktrees/<name> -b change/<name> main`.
3. `/opsx:propose` inside the worktree → user approves the plan.
4. `/opsx:apply` — TDD, one commit per task.
5. Quality gate: all tasks done, `npm run test:unit`, `npm run test:integration`,
   browser smoke check if UI changed, `openspec validate <name> --strict`.
6. `/opsx:archive` in the branch, rebase on `main`, `npm test` again.
7. Merge `--ff-only` into `main` **only after the user confirms**; remove the worktree.

- Before claiming something works in the browser, run the dev server and check it.
- Commit messages: English, imperative mood, short subject line (`Add CIEDE2000 color distance`).
