# Vidyano Development Guide

## IMPORTANT
**When working with @vidyano/core code**, read `docs/core/cheat-sheet.md` first for quick reference on core concepts and coding patterns.

**File Types:** Only work with TypeScript source files (`.ts`). Do NOT modify JavaScript files (`.js`) or TypeScript declaration files (`.d.ts`).

## Quick Reference

### Commands
```bash
# Development
npm run dev          # Start backend (localhost:5000, blocks terminal)
npm run build        # Build pipeline (only after src/ changes, NOT for test changes)
npm test             # Run Playwright tests

# Production
npm run dist         # Production build

# Check if backend is running
curl -s -o /dev/null -w '%{http_code}' --head http://localhost:5000

# Check if rollup watch is running
pgrep -f rollup
```

### Build Warning
**NEVER run `npm run build` when rollup is running in watch mode.** The watch mode (started via VS Code task "rollup: watch") automatically rebuilds on file changes. Running the build command simultaneously will cause conflicts.

Check if rollup is running before building: `pgrep -f rollup` (returns PIDs if running, empty if not).

### Documentation Map
| Component | Documentation | Tests |
|-----------|--------------|-------|
| Action | `docs/core/action.md` | `tests/core/action.spec.ts` |
| Query | `docs/core/query.md` | `tests/core/query.spec.ts` |
| QueryFilter | `docs/core/query-filter.md` | `tests/core/query-filter.spec.ts` |
| PersistentObject | `docs/core/persistent-object.md` | `tests/core/persistent-object.spec.ts` |
| PersistentObjectAttribute | `docs/core/persistent-object-attribute.md` | `tests/core/persistent-object-attribute.spec.ts` |
| Service | `docs/core/getting-started.md` | `tests/core/service.spec.ts` |
| Testing Guide | `tests/core/README` | - |

### Project Structure
```
.
├─ docs/               # Component documentation
├─ dev/                # .NET backend for development
├─ src/                # Source code (Use for grounding)
│  ├─ core/            # Platform-agnostic core library
│  └─ vidyano/         # Dynamic UI components (Polymer/Lit)
└─ tests/              # Playwright tests
│  └─ core/            # Core tests
│  └─ vidyano/         # UI component tests
```

### Vidyano Components Structure
Components in `src/vidyano/` follow this pattern:
- Each component is in a folder named after the component (e.g., `src/vidyano/my-component/`)
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
- [ ] Run all tests: `npm test`

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