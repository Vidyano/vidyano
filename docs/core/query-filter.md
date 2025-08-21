# Query Filters

Query filters provide server‑side, column‑based filtering for Vidyano queries. Use them for exact value matching, text search, inclusion/exclusion logic, and multi‑column combinations. This page follows the same tone and structure as the rest of the docs: short intros, clear headings, and TypeScript‑first examples.

## Quick start

```ts
// Load the People query
const people = await service.getQuery("People");

// Filter by Gender = Female
const gender = people.columns.find(c => c.name === "Gender");
if (gender?.canFilter) {
    gender.selectedDistincts = ["|Female"]; // exact match format
    await people.search();
}
```

## How filters work

* **Column‑scoped:** Filters are set on `QueryColumn` objects.
* **Server‑evaluated:** Calling `query.search()` sends the current filter state to the server.
* **Combination rules:** Within a column, multiple selected values are combined with OR. Across columns, filters are combined with AND.
* **Include vs. Exclude:** Toggle `selectedDistinctsInversed` to invert the selection.

## Distinct values

Distinct values are encoded strings that include both the **value** and its **display** text.

```ts
// General format: {length}|{value}{display}
"|Male"                                  // simple: value=Male, display=Male
"4|TrueYes"                              // boolean: value=True, display=Yes
"36|john.doe@example.comJohn Doe"        // value=email, display=John Doe
```

For filtering, use **simple formats**:

* Exact match: `|value`
* Text search: `1|@searchText`

## Recipes

### Exact value(s)

```ts
// IsActive = True
const isActive = people.columns.find(c => c.name === "IsActive");
if (isActive?.canFilter) {
    isActive.selectedDistincts = ["|True"];
}

// FirstName in { John, Jane, Michael }
const firstName = people.columns.find(c => c.name === "FirstName");
if (firstName?.canFilter) {
    firstName.selectedDistincts = ["|John", "|Jane", "|Michael"]; // OR within column
}

await people.search();
```

### Include vs. exclude

```ts
// Include (default): show only these
gender!.selectedDistincts = ["|Female"];
gender!.selectedDistinctsInversed = false;

// Exclude: show everything except these
gender!.selectedDistincts = ["|Female"];
gender!.selectedDistinctsInversed = true;

await people.search();
```

### Text search (strings)

The server controls whether a column uses *contains* or *starts‑with*.

```ts
firstName!.selectedDistincts = ["1|@John"]; // matches John, Johnson, Johnathan (depending on server op)
await people.search();
```

### Pattern search (strings)

```ts
const email = people.columns.find(c => c.name === "Email");
email!.selectedDistincts = ["1|@*gmail.com", "1|@*.edu"]; // wildcards
await people.search();
```

### Date search

```ts
const birthDate = people.columns.find(c => c.name === "BirthDate");

// By year
birthDate!.selectedDistincts = ["1|@1985"]; // all dates in 1985

// By month + year (locale formatting applies)
birthDate!.selectedDistincts = ["1|@3/1985"]; // March 1985

// Specific date (locale dependent)
birthDate!.selectedDistincts = ["1|@15/3/1985"]; // e.g., DD/MM/YYYY

await people.search();
```

### Multiple search terms (OR within a column)

```ts
firstName!.selectedDistincts = ["1|@John", "1|@Jane", "1|@Michael"]; // OR
await people.search();
```

## Loading distincts for UI controls

### Refresh and parse

```ts
// Load distincts for a dropdown
await gender!.refreshDistincts();
const all = [
    ...(gender!.distincts.matching || []),
    ...(gender!.distincts.remaining || [])
];

function parseDistinctValue(distinct: string): { value: string; display: string } {
    if (!distinct) return { value: "", display: "" };
    const pipeIndex = distinct.indexOf("|");
    if (pipeIndex === -1) return { value: distinct, display: distinct };

    const lengthStr = distinct.substring(0, pipeIndex);
    const remainder = distinct.substring(pipeIndex + 1);

    // Simple format: "|value"
    if (lengthStr === "") return { value: remainder, display: remainder };

    const length = parseInt(lengthStr, 10);
    if (isNaN(length)) return { value: remainder, display: remainder };

    const value = remainder.substring(0, length);
    const display = remainder.substring(length) || value;
    return { value, display };
}

const options = all.map(d => {
    const { value, display } = parseDistinctValue(d);
    return { value, label: display || value };
});
```

### `IQueryColumnDistincts`

```ts
interface IQueryColumnDistincts {
    matching: string[];  // values matching current filters
    remaining: string[]; // other available values
    isDirty: boolean;    // whether refresh is needed
    hasMore: boolean;    // there are more values on the server
}
```

## Multi‑column filters

### Combine across columns (AND)

```ts
const active = people.columns.find(c => c.name === "IsActive");
const birthDate = people.columns.find(c => c.name === "BirthDate");

gender!.selectedDistincts = ["|Female"];    // Gender = Female
active!.selectedDistincts = ["|True"];      // IsActive = True
birthDate!.selectedDistincts = ["1|@1985"]; // Born in 1985

await people.search(); // all conditions must be met (AND)
```

### Complex combinations

```ts
// OR within a column
firstName!.selectedDistincts = ["|John", "|Jane", "|James"]; // OR

// Exclude a value
gender!.selectedDistincts = ["|Not Specified"];
gender!.selectedDistinctsInversed = true; // exclude

// Text search on email domain
email!.selectedDistincts = ["1|@company.com"];

await people.search();
```

### Pre‑filter on initial load

```ts
// Use columnOverrides to set initial filter values
const filteredPeople = await service.getQuery("People", {
    columnOverrides: [
        { name: "Gender", includes: ["|Male", "|Female"] }, // exclude "Not Specified"
        { name: "IsActive", includes: ["|True"] }           // only active
    ]
});

// Then search to apply the filters
await filteredPeople.search();
```

## Saved filters (presets)

```ts
// Note: Query.filters is only available if the server has configured filter support for the query
if (people.filters) {
    // Configure filters
    const gender = people.columns.find(c => c.name === "Gender");
    const birthDate = people.columns.find(c => c.name === "BirthDate");
    const active = people.columns.find(c => c.name === "IsActive");
    
    gender!.selectedDistincts = ["|Male"];
    birthDate!.selectedDistincts = ["1|@1980", "1|@1985", "1|@1990"]; // 80s/90s
    active!.selectedDistincts = ["|True"];
    
    // Save as preset
const preset = await people.filters.createNew();
preset.persistentObject.attributes["Name"].setValue("Active Males from 1980s–90s");
await people.filters.save(preset);

// Later: restore and apply
const presets = people.filters.filters; // Access the filters array
const target = presets.find(p => p.name === "Active Males from 1980s–90s");
    if (target) {
        people.filters.currentFilter = target; // applies all filters
    }
}
```

## Performance tips

1. **Lazy‑load distincts:** Call `refreshDistincts()` only when building UI options.
2. **Batch changes:** Set multiple filters, then call `search()` once.
3. **Watch `hasMore`:** Large distinct lists may be truncated—narrow with search.

```ts
// ❌ Multiple server round‑trips
gender!.selectedDistincts = ["|Male"]; await people.search();
active!.selectedDistincts = ["|True"]; await people.search();
birthDate!.selectedDistincts = ["1|@1985"]; await people.search();

// ✅ Single server round‑trip
gender!.selectedDistincts = ["|Male"];
active!.selectedDistincts = ["|True"];
birthDate!.selectedDistincts = ["1|@1985"];
await people.search();
```

## Utilities

### Clear all filters

```ts
import type { Query } from "@vidyano/core";

async function clearAllFilters(query: Query): Promise<void> {
    // Clear individual columns
    query.columns.forEach(col => {
        col.selectedDistincts = [];
        col.selectedDistinctsInversed = false;
    });

    // If saved filters exist, reset the current filter
    if (query.filters) query.filters.currentFilter = null;

    // Refresh
    await query.search();
}
```

## Examples

### Email domain analysis

```ts
const email = people.columns.find(c => c.name === "Email");
if (email?.canFilter) {
    await email.refreshDistincts();
    const all = [
        ...(email.distincts.matching || []),
        ...(email.distincts.remaining || [])
    ];

    const domains = new Set<string>();
    const parse = (distinct: string) => {
        const pipeIndex = distinct.indexOf("|");
        const lengthStr = distinct.substring(0, pipeIndex);
        const remainder = distinct.substring(pipeIndex + 1);
        if (!lengthStr) return remainder; // "|value"
        const length = parseInt(lengthStr, 10);
        return remainder.substring(0, length);
    };

    all.forEach(d => {
        const value = parse(d);
        const domain = value.split("@")[1];
        if (domain) domains.add(domain);
    });

    const consumer = new Set(["gmail.com", "yahoo.com", "hotmail.com"]);
    const companyDomains = Array.from(domains).filter(d => !consumer.has(d));

    email.selectedDistincts = companyDomains.map(d => `1|@${d}`);
    await people.search();
}
```

## Related topics

* [Query](./query.md)