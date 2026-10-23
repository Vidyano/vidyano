# Vidyano Development Guide

## IMPORTANT
**When working with @vidyano/core code**, read `packages/core/docs/cheat-sheet.md` first for quick reference on core concepts and coding patterns.

**File Types:** Only work with TypeScript source files (`.ts`). Do NOT modify JavaScript files (`.js`) or TypeScript declaration files (`.d.ts`).

## Quick Reference

### Commands
```bash
# Development
npm run dev          # Start backend + dev supervisor (localhost:5000, blocks terminal)
npm run dev:status   # Print the supervisor's watcher status and problem counts
npm run build        # Build pipeline (only when npm run dev is NOT running)
npm test             # Run ALL Playwright tests (core + vidyano)

# Testing while npm run dev is running (the way to run tests, in the main checkout and in worktrees)
npm run test:dev -- <specs or folders> -x   # Queue a run in the dev supervisor, stream its output

# Testing without the supervisor (CI, or when npm run dev is not running)
npm run test:core           # Run all core tests
npm run test:vidyano        # Run all vidyano tests
npm run test:virtual-service # Run all virtual-service tests

# Run specific test file (use package-specific command or npx directly)
npm run test:core -- path/to/test.spec.ts
npm run test:virtual-service -- packages/labs/virtual-service/tests/validation.spec.ts
npx playwright test --project=core path/to/test.spec.ts
npx playwright test --project=virtual-service packages/labs/virtual-service/tests/validation.spec.ts

# Specs that use the shared dev backend (core) refuse direct runs while npm run dev is running;
# VIDYANO_DIRECT=1 overrides that. Specs that start their own backend run directly any time.

# NOTE: Don't use "npm test -- <file>" - it won't work due to command chaining

# Package-specific builds
npm run build:core      # Build @vidyano/core only
npm run build:vidyano   # Build @vidyano/vidyano only

# Production
npm run dist         # Production build

# Check if backend is running
curl -s -o /dev/null -w '%{http_code}' --head http://localhost:5000
```

### Dev Supervisor
`npm run dev` starts the `dev/` backend, and in Development the backend starts the **Dev Supervisor** (`dev/Service/Supervisor/`). It runs every watcher: TypeScript, Rollup for core, vidyano and virtual-service, and Sass. It shows their status, compiler problems and logs at http://localhost:5000/supervisor/ (localhost only). Edited `.ts` and `.scss` files rebuild on save; the backend restarts itself when a `.cs` file or a model JSON in `dev/` changes. Start order matters and the supervisor enforces it: TypeScript core → core rollup watch (which also bundles `packages/core/dist/index.d.ts`) → the vidyano and virtual-service compiles, with vidyano also waiting for Sass.

**NEVER run `npm run build` while `npm run dev` is running.** The watchers already rebuild on save; a parallel build conflicts with them. Check with `npm run dev:status`.

**Tests**: `npm run test:dev -- <specs or folders> -x` sends the run to the supervisor. It runs everything in one Playwright process, waits until the watchers have finished building, and passes the run `VIDYANO_BACKEND_URL` (the shared dev backend) and `VIDYANO_DEV_URL` (where it serves this checkout's build). The Tests view in the supervisor shows every spec with its results and can start runs too. Runs of all checkouts queue in one line, first come first served, and a waiting run says what it waits for ("Waiting for run #3 in main to finish"):
- Runs that only hold vidyano component specs (outside `query-grid`) or virtual-service specs run in parallel with other runs: those specs start their own backends on a port the OS picks, or need none.
- Runs that hold core or query-grid specs, or anything the supervisor cannot tell, use the shared dev backend and its data, so they run one at a time.
- Inside one run the projects run at the same time, and core specs reset the shared data (`PersistentObject.ResetTest`, user store) under the query-grid specs. Run core and query-grid in separate runs, e.g. `npm run test:dev -- --project=core` and then `npm run test:dev -- --project=query-grid`.
- Perf runs (a perf project, or only specs under a `perf` folder) run alone: they wait until no other run runs and no watcher builds. Perf specs are left out of every other run (its output says so); run them on their own, e.g. `npm run test:dev -- packages/vidyano/tests/query-grid/perf`. Perf results go to `<checkout>/perf-results/` (gitignored), since Playwright empties `test-results/` on every run.
- One checkout runs one run at a time.
- A run whose `npm run test:dev` is gone (no poll for 30 seconds) is cancelled, and a run ends after 90 minutes.

**Worktrees**: the main checkout is a clean host on `v5.0` that runs `npm run dev`: nobody edits files in it or switches its branch, and all work happens in worktrees. Changes reach it only when the user merges them into `v5.0` there. Create them under a short root outside `%TEMP%` (which Windows cleans up) and outside `.claude/`, e.g. `git worktree add C:\Users\<you>\Documents\Projects\vidyano.wt\<name> -b <branch> v5.0`, with names of at most 20 characters (`[a-z0-9-]`) to stay below Windows' path length limit. The supervisor finds every git worktree of the repo, runs that worktree's watchers on first use (with `npm ci` when its `package-lock.json` differs from its last install; one worktree installs at a time, and runs of a worktree whose install failed fail at once), and serves its `dev/wwwroot` at `http://localhost:5000/<worktree>/`. `npm run test:dev` inside a worktree runs that worktree's specs against its own build.
- **Never run `npm run dev` or `npm run build` in a worktree**: main's supervisor runs its watchers.
- The worktree's backend C# code does not run: main's backend serves every worktree, and worktrees do not have backends of their own yet. C# changes in `dev/` are only tested once they are in the main checkout. A backend restart there waits for active test runs (at most 10 minutes).
- Stop a worktree in the supervisor's picker before `git worktree remove`.

### Documentation Map
| Component | Documentation | Tests |
|-----------|--------------|-------|
| Action | `packages/core/docs/action.md` | `packages/core/tests/action.spec.ts` |
| Query | `packages/core/docs/query.md` | `packages/core/tests/query.spec.ts` |
| QueryFilter | `packages/core/docs/query-filter.md` | `packages/core/tests/query-filter.spec.ts` |
| PersistentObject | `packages/core/docs/persistent-object.md` | `packages/core/tests/persistent-object.spec.ts` |
| PersistentObjectAttribute | `packages/core/docs/persistent-object-attribute.md` | `packages/core/tests/persistent-object-attribute.spec.ts` |
| Service | `packages/core/docs/getting-started.md` | `packages/core/tests/service.spec.ts` |
| Testing Guide | `packages/core/tests/README` | - |

### Project Structure
```
.
├─ packages/
│  ├─ core/            # @vidyano/core - Platform-agnostic core library
│  │  ├─ src/          # Source code
│  │  ├─ docs/         # Documentation
│  │  └─ tests/        # Playwright tests
│  ├─ vidyano/         # @vidyano/vidyano - Dynamic UI components (Polymer/Lit)
│  │  ├─ src/          # Source code
│  │  ├─ docs/         # Documentation (migration guides, etc.)
│  │  └─ tests/        # Playwright tests
│  └─ labs/            # Experimental packages
│     └─ virtual-service/  # @vidyano-labs/virtual-service
└─ dev/                # .NET backend for development
```

### Vidyano Components Structure
Components in `packages/vidyano/src/` follow this pattern:
- Each component is in a folder named after the component (e.g., `packages/vidyano/src/web-components/my-component/`)
- Component folders can be nested deeper in the directory structure
- Each component folder contains:
  - **`.ts` file** - TypeScript source (required)
  - **`.scss` file** - Component styles (required)
  - **`.html` file** - Component template (optional)

# Development Workflow

## Core Rule
**Complete each task and mark it [x] before moving to the next.**

## Step 1: Create Plan File
Create `plans/[plan-name]-YYYYMMDD-HHMMSS-plan.md` with:

```markdown
# Plan: [Name]

## Investigation
- [ ] Read the relevant source code
- [ ] Check how it currently works
- [ ] Find the test files
- [ ] Understand the dependencies

## Planning
- [ ] List what needs to change
- [ ] Decide implementation order
- [ ] Define test cases

## Implementation
- [ ] Start dev server if needed: `npm run dev` (in the main checkout only)
- [ ] Write tests first
- [ ] Write code to pass tests
- [ ] Refactor if needed
- [ ] Run all tests: `npm run test:dev` (or `npm test` without the supervisor)

## Validation
- [ ] All tests pass
- [ ] Manual testing done
- [ ] No console errors

## Notes
[Add findings and decisions here as you work]
```

## Step 2: Work Through Tasks

Work IN the plan file, marking tasks complete.
Example:

```markdown
# Task: Add User Auth

## Investigation
- [x] Read the relevant source code
- [x] Check how it currently works
- [ ] Find the test files
- [ ] Understand the dependencies

## Notes
- Auth uses JWT tokens
- Found existing auth module in /src/auth
```

## Key Principles

1. **One task at a time** - Never skip ahead
2. **Mark complete with [x]** - Before moving on
3. **Test first (TDD)** - Write failing tests before implementing code changes when tests already exist for the component or when adding significant new behavior
4. **Document as you go** - Add notes while working
5. **Build only when needed** - For library changes only

## Code Style

**Block Statements:**
- Single-line block bodies should omit braces and place the statement on a new line
- When a conditional block (if/else) is followed by additional statements, ensure exactly one blank line separates them

## Commit Message Guidelines

**Format:** `<type>: <description>`

**Rules:**
- Maximum 80 characters total (including type and colon)
- No scopes - keep it simple and unscoped
- Use imperative mood ("Add" not "Added" or "Adds")
- Capitalize first letter of description
- No period at the end

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `perf` - Performance improvement
- `test` - Adding or updating tests
- `docs` - Documentation changes
- `chore` - Maintenance tasks, dependencies, tooling, formatting, style changes