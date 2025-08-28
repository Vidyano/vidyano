# Vidyano Development Guide

## IMPORTANT
**When working with @vidyano/core code**, read `docs/core/cheat-sheet.md` first for quick reference on core concepts and coding patterns.

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
```

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