# Workflow: OpenSpec changes in git worktrees

Every behavior change goes through an OpenSpec change, developed in its own git worktree.
`main` only ever receives finished, tested, archived changes.

## Lifecycle

```
main --+-- 0. /opsx:explore            optional, read-only, on main
       |
       +-- git worktree add .claude/worktrees/<name> -b change/<name> main
       |     1. /opsx:propose          proposal, spec deltas, design, tasks -> commit
       |                               STOP: user reviews and approves the change
       |     2. /opsx:apply            TDD task by task, one commit per task
       |     3. quality gate           see below
       |     4. /opsx:archive          sync spec deltas into openspec/specs, move change to archive -> commit
       |     5. git rebase main        then npm test again
       |                               STOP: user confirms the merge
       +-- git merge --ff-only change/<name>
             git worktree remove .claude/worktrees/<name>
             git branch -d change/<name>
```

## Rules per step

0. **Explore** (`/opsx:explore`) — thinking only. Runs on `main`, writes nothing. If the user
   asks to capture the result as a change, create the worktree first (step 1) and run
   `openspec new change` / `/opsx:propose` **inside it**, never on `main`.
1. **Start a change**
   - Name: kebab-case verb phrase, e.g. `add-dmc-palette`, `add-image-upload`.
   - Run from the main checkout:
     `git worktree add .claude/worktrees/<name> -b change/<name> main`
   - All further work for this change happens with the worktree as the working directory.
   - Commit the planning artifacts (`Propose <name>`), then present them to the user and
     wait for approval before `/opsx:apply`.
2. **Apply** — follows `operations.apply.guidance` in `openspec/config.yaml`.
   If implementation reveals the plan is wrong, update the artifacts (`/opsx:update`)
   and tell the user, instead of silently diverging from them.
3. **Quality gate** (all must pass, with real output shown to the user):
   - every task in `tasks.md` is checked;
   - `npm run test:unit` and `npm run test:integration` pass;
   - browser smoke check via `node scripts/serve.js` when UI/io changed;
   - `openspec validate <name> --strict` passes.
4. **Archive** (`/opsx:archive`) — inside the worktree, **before** the merge, so code,
   updated `openspec/specs/`, and `openspec/changes/archive/` land on `main` together.
   Commit as `Archive <name>`.
5. **Rebase & merge** — `git rebase main`, re-run `npm test`, report readiness.
   Merge to `main` with `--ff-only` **only after the user confirms**. Then remove the
   worktree and delete the branch.

## Permissions

- Claude may freely commit on `change/*` branches inside their worktrees.
- Claude never commits directly on `main` (except repository setup the user asked for),
  never merges, pushes, force-pushes, or deletes unmerged branches without explicit
  confirmation from the user.
- One change per worktree. Do not mix unrelated work into a change branch — start another change.

## Parallel changes

- Several worktrees may exist at once. Before starting a change that touches the same files
  as an open one, tell the user and suggest finishing or rebasing the other first.
- List open work with `git worktree list` and `openspec list`.
