# Testing Guide

## Testing Framework
- **ALWAYS** use Playwright for all tests
- **NEVER** create standalone Node.js test scripts
- All tests must be runnable with `npm test`

## Commands
- **Run playwright tests**: `npm test` - Runs all Playwright tests
- **Run specific playwright test**: `npx playwright test tests/core/service.spec.ts:157`

## Style

### Principles

* Deterministic, behavior‑first, minimal.
* One behavior per test; Arrange → Act → Assert.
* Titles: imperative, present tense.
* Exact assertions only (`toBe`, `toEqual`, `toBeInstanceOf`, `toHaveLength`); **no truthy/falsy**.
* **No branching in tests** — never use `if`/`switch`/ternary to gate assertions.

### Determinism

* Tests always start from a known, seeded baseline (due to ResetTest).
* No external network; only the system under test.
* Compare canonical forms (UTC timestamps, normalized strings).
* Don’t rely on implicit ordering; sort or index explicitly.
* Assert stable facts (type/id/state), not transient values.

### Booleans & Types (Blanket Rule)

* **Never use `typeof` checks anywhere.** Examples that are **not allowed**:

  * `expect(typeof canRead).toBe('boolean')`
  * `expect(typeof id).toBe('string')`
  * `expect(typeof count).toBe('number')`
* **Always assert real values instead:**

  * `expect(peopleQuery.canRead).toBe(true)` (or `false` per spec)
  * `expect(firstPerson.id).toBe('…')` when the seed fixes it
  * `expect(count).toBe(3)`
* When working with objects or before operating on them, **prefer `toBeInstanceOf(Class)`** to confirm kind.

### Objects — What to Verify

* **Type guard:** `toBeInstanceOf` for any object you will use.
* **Identity:** correct type/id/context.
* **Attributes:** read/write; honor read‑only; refresh dependencies when needed.
* **Actions:** availability (`canExecute`) and result shape/effect.
* **State flags:** explicit transitions (`isNew`, `isEditing`, `isDirty`, `isReadOnly`, etc.).
* **References (many‑to‑one):** set/change/clear via lookup; consistent display binding.
* **Details (one‑to‑many):** created while parent is editing; follow parent state; mark value changed and dirty.
* **Events:** attach → observe expected notifications → detach (no leakage).

### Fixtures

* Centralize setup (session/reset/common objects/queries).
* Fixtures prepare state only; assertions live in tests.

### Validation & Errors

* Invalid/missing required fields block save and surface attribute‑level errors or object notifications.
* After fixing, save succeeds; ids/effects remain stable.
* One fact per `expect`; avoid compound boolean expressions.

### Working with Query Items

**IMPORTANT**: Query items are lazy-loaded. Always use async methods to ensure items are loaded before making assertions.

#### Core Async Operations

* **`query.items.toArrayAsync()`** - Loads all items and returns as a plain array
* **`query.items.forEachAsync(callback)`** - Iterates through all items, loading as needed
* **`query.items.mapAsync(callback)`** - Maps items to new values, loading on-demand
* **`query.items.filterAsync(predicate)`** - Filters items based on predicate
* **`query.items.sliceAsync(start, end)`** - Returns subset within specified range
* **`query.items.findAsync(predicate)`** - Finds first item matching predicate (stops on match)
* **`query.items.findIndexAsync(predicate)`** - Finds index of first match (stops on match)
* **`query.items.someAsync(predicate)`** - Tests if any item matches (stops on first match)
* **`query.items.everyAsync(predicate)`** - Tests if all items match (stops on first failure)
* **`query.items.includesAsync(element, fromIndex?)`** - Checks if collection includes element
* **`query.items.indexOfAsync(element, fromIndex?)`** - Finds index of specific element
* **`query.items.reduceAsync(reducer, initialValue?)`** - Reduces items to single value

**Avoid** directly accessing `query.items` for iteration since this will only run on items already loaded in memory, which may not include all items if the query is paginated and not fully loaded.

### Anti‑patterns

* `typeof` checks on any value (boolean/string/number/object/function) ❌
* Truthy/falsy or coercion‑based assertions ❌
* Branching in tests (`if`/`switch`/ternary) ❌
* Implicit order assumptions ❌
* Nondeterministic values (now/random/locale) ❌
* Multiple behaviors in one test ❌
* Leaked listeners or global state mutations ❌
* Direct iteration over `query.items` without async methods ❌

### Checking Server Data for Deterministic Testing

When writing tests that depend on specific data from the e2e server, create temporary test files (e.g., `test.random.spec.ts`) to inspect what data is being returned. This helps ensure your tests are deterministic by allowing you to log and examine the actual server responses before writing assertions. Remember to remove these temporary files once you've determined the correct assertions for your actual tests.

## Test Structure

### Core Unit Tests (tests/core/)
Core unit tests run directly in Node.js using Playwright's test runner without browser context. They use Playwright fixtures for test setup and teardown.

#### Required Setup Pattern
```typescript
/// <reference path="../../dist/core/index.d.ts" />
import { test as base, expect } from "@playwright/test";
import { Service, Query, PersistentObject } from "../../dist/core/index";

// Define fixtures for common test objects
type Fixtures = {
    service: Service;
};

// Extend base test with fixtures
const test = base.extend<Fixtures>({
    // Service fixture - initialized and authenticated
    service: async ({}, use) => {
        const service = new Service("http://localhost:5000", undefined, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        // Reset test data before each test
        await service.executeAction("PersistentObject.ResetTest", service.application);
        await use(service);
    }
});

test.describe("Your Test Suite", () => {
    test("should test something", async ({ service }) => {
        const peopleQuery = await service.getQuery("People");

        // Your test code here using the fixtures
        expect(peopleQuery).toBeInstanceOf(Query);
        expect(peopleQuery.name).toBe("People");
    });
});
```

#### Core Test Files
- `tests/core/service.spec.ts` - Service authentication and initialization tests
- `tests/core/query.spec.ts` - Query loading, pagination, and item access tests
- `tests/core/query.filters.spec.ts` - Query filtering functionality tests
- `tests/core/persistent-object.spec.ts` - PersistentObject CRUD operations tests

### Test Requirements
- Import from compiled distribution: `../../dist/core/index`
- Type information for this import can be found in: `../../dist/core/index.d.ts`
- Use Playwright fixtures for clean setup/teardown
- Always sign in with credentials: `admin` / `admin`
- Reset test data using `PersistentObject.ResetTest` action on `service.application`
- Test against the dev backend (localhost:5000)
- Cover both happy paths and error conditions

## Test Environment

### Dev Server Setup
- **Backend**: .NET Core Vidyano (`dev/` directory)
- **URL**: http://localhost:5000
- **Start command**: `npm run dev` (runs in separate terminal)
- **Health check**: `curl -s -o /dev/null -w '%{http_code}' --head http://localhost:5000`

**Note**: The dev server blocks indefinitely while running. Start it in a separate terminal session, or check if it's already running with the health check command.

### Test Data Model

The dev backend provides a comprehensive data model with three main persistent objects and their relationships.

#### Person Entity
| Attribute | Type | Rules | Notes |
|-----------|------|-------|-------|
| `FirstName` | String | Required | Person's first name |
| `LastName` | String | Required | Person's last name |
| `FullName` | String | ReadOnly | Computed full name |
| `BirthDate` | Date | Required | Date of birth |
| `Gender` | Enum | Required | Gender selection |
| `ContactPreference` | Enum | Required | How they prefer to be contacted |
| `Email` | String | Required, IsEmail | Email address |
| `PhoneNumber` | String | Required | Phone number |
| `EmergencyContact` | Reference | Required | References another Person record |
| `IsActive` | Boolean | Required | Whether the person is active |
| `Languages` | AsDetail | - | Collection of PersonLanguage records |

#### Address Entity
| Attribute | Type | Rules | Notes |
|-----------|------|-------|-------|
| `Street` | String | Required | Street address |
| `City` | String | Required | City name |
| `State` | String | Required | State/province |
| `ZipCode` | String | Required | Postal code |
| `Country` | String | Required | Country |
| `IsPrimary` | Boolean | Required | Whether this is the primary address |

#### PersonLanguage Entity
| Attribute | Type | Rules | Notes |
|-----------|------|-------|-------|
| `Language` | String | Required | Language name |
| `ProficiencyLevel` | String | Required | Level of proficiency |
| `CanSpeak` | Boolean | Required | Can speak the language |
| `CanRead` | Boolean | Required | Can read the language |
| `CanWrite` | Boolean | Required | Can write the language |
| `IsNative` | Boolean | Required | Is this a native language |
| `YearsStudied` | Int32 | Required | Number of years studied |
| `CertificationLevel` | String | Optional | Any certification level |

#### Available Queries
- `People` - Base people query for testing grid components (primary entry point)

#### Working with Related Data
- **Person_Addresses**: Detail query available on Person persistent objects for address management
- **Languages**: AsDetail attribute on Person for in-place language record editing
- **EmergencyContact**: Reference attribute linking to another Person record

#### Available Actions

##### Application Actions
- `ResetTest` - Resets test data changes (available on Application)

##### Query Actions (People)
- `TestCount` - Allows 0 to infinity selected items, returns count as notification, refreshes query after execution
- `TestCountSingle` - Requires exactly 1 selected item, returns count as notification, does not refresh query
- `TestCountMany` - Requires at least 2 selected items, returns count as notification, does not refresh query
- `TestOptions` - Executes with menu options (Option 1, Option 2), can accept custom parameters
- `Delete` - Deletes selected items with confirmation dialog, refreshes query after execution

##### PersistentObject Actions (Person)
- `TestPersonSummary` - Shows person summary in dialog

## Debugging Tests

### Server Communication Debugging

```typescript
class DebugServiceHooks extends Vidyano.ServiceHooks {
    async onFetch(request: Request, response: Response): Promise<Response> {
        const requestBody = await request.clone().text();
        console.log('Request:', {
            url: request.url,
            method: request.method,
            body: requestBody ? JSON.parse(requestBody) : null
        });
        
        const responseBody = await response.clone().text();
        console.log('Response:', {
            status: response.status,
            body: responseBody ? JSON.parse(responseBody) : null
        });
        
        return response;
    }
}

const test = base.extend<Fixtures>({
    // Service fixture - initialized and authenticated
    service: async ({}, use) => {
        
        const service = new Service("http://localhost:5000", new DebugServiceHooks(), false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        // Reset test data before each test
        await service.executeAction("PersistentObject.ResetTest", service.application);
        await use(service);
    }
});
```

**Note**: DTOs are defined in `src/core/typings/service.ts`

## Important Notes

- **Build before testing**: Always run `npm run build` after making changes to library code
- **Use actual entities**: Test with Person, People query, and related entities only
- **Check existing tests**: Review `tests/core/*.spec.ts` for patterns and examples