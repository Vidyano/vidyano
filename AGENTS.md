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

# Testing while npm run dev is running (preferred)
npm run test:dev -- <specs or folders> -x   # Queue a run in the dev supervisor, stream its output

# Testing without the supervisor
npm run test:core           # Run all core tests
npm run test:vidyano        # Run all vidyano tests
npm run test:virtual-service # Run all virtual-service tests

# Run specific test file (use package-specific command or npx directly)
npm run test:core -- path/to/test.spec.ts
npm run test:virtual-service -- packages/labs/virtual-service/tests/validation.spec.ts
npx playwright test --project=core path/to/test.spec.ts
npx playwright test --project=virtual-service packages/labs/virtual-service/tests/validation.spec.ts

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

**Tests**: `npm run test:dev -- <specs or folders> -x` sends the run to the supervisor. It runs everything in one Playwright process and queues concurrent runs, because core tests share the backend's database. Runs wait until the watchers have finished building. The Tests view in the supervisor shows every spec with its results and can start runs too.

**Worktrees**: run `npm run dev` only in the main checkout. Its supervisor finds every git worktree of the repo, runs that worktree's watchers on first use (with `npm ci` when its `node_modules` is missing or stale), and serves its `dev/wwwroot` at `http://localhost:5000/<worktree>/`. `npm run test:dev` inside a worktree runs that worktree's specs against its own build. The worktree's backend C# code does not run: main's backend serves every worktree. Stop a worktree in the supervisor's picker before removing it.

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
- [ ] Start dev server if needed: `npm run dev`
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