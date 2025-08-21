# Queries

## Basic Query Loading

```ts
import { Service } from "@vidyano/core";

// Initialize service and sign in
const service = new Service("http://localhost:5000");
await service.initialize(true);
await service.signInUsingCredentials("admin", "admin");

// Load a query
const peopleQuery = await service.getQuery('People');
console.log(`Found ${peopleQuery.totalItems} people`);
```

## Core Concepts

### Query Structure

A `Query` represents a dynamic view of data from your backend. It consists of:

- **Columns**: Define the structure and metadata (`QueryColumn`)
- **Items**: The actual data rows (`QueryResultItem`)
- **Item values**: Cell value with metadata such as reference IDs and type hints (`QueryResultItemValue`)
- **Actions**: Operations you can perform on the query or its items
- **Filters**: Column-based filtering capabilities
- **Grouping**: Hierarchical organization of results

### Query Result Items

Each row in a query is a `QueryResultItem` with strongly-typed access to column values:

```ts
const [person] = await peopleQuery.getItemsByIndex(0);

// Access values directly via the values object
const firstName = person.values.FirstName;    // string
const birthDate = person.values.BirthDate;    // Date
const isActive = person.values.IsActive;      // boolean

// Or use getValue() method (returns the same)
const email = person.getValue('Email');       // string

// All values are available
console.log(person.values.FirstName, person.values.Email);
```

### Accessing Full Value Metadata

For advanced scenarios, you can access the full `QueryResultItemValue` object which includes metadata like reference IDs and type hints:

```ts
const [person] = await peopleQuery.getItemsByIndex(0);

// Get the full value object with metadata
const emergencyContactValue = person.getFullValue('EmergencyContact');
if (emergencyContactValue) {
    console.log('Value:', emergencyContactValue.value);                     // Display value
    console.log('Type hints:', emergencyContactValue.typeHints);            // Additional metadata

    // For columns based on reference attributes
    console.log('Object ID:', emergencyContactValue.objectId);              // Id of the reference object
    console.log('Persistent Object ID:', emergencyContactValue.column.persistentObjectId);  // Id of the Persistent Object
}
```

### Lazy Loading Architecture

Vidyano queries use intelligent lazy loading to handle large datasets efficiently. The `query.items` property returns a special `QueryItems` type that extends Array but adds async iteration and helper methods:

```ts
// ✅ Best: Use async iteration for automatic lazy loading
for await (const item of query.items) {
    console.log(item.values.FirstName);
}

// ✅ Good: Use async helper methods
const names = await query.items.mapAsync(item => 
    item.values.FirstName
);

// ✅ Fine: Use getItemsByIndex() for specific items
const [item] = await query.getItemsByIndex(150);
console.log(item.values.FirstName);

// ❌ Avoid: Direct array access may return null for unloaded items
const item = query.items[150]; // May be null!
```

## Working with Query Data

### Async Iteration (Recommended)

The most elegant way to work with query items is using async iteration, which automatically handles lazy loading:

```ts
// Process all items sequentially
for await (const person of peopleQuery.items) {
    const name = `${person.values.FirstName} ${person.values.LastName}`;
    const email = person.values.Email;
    console.log(`${name} - ${email}`);
}

// Stop iteration based on a condition
for await (const person of peopleQuery.items) {
    if (person.values.IsActive === false) {
        console.log('Found first inactive person:', person.values.FirstName);
        break;
    }
}
```

### Async Helper Methods

Query items provide powerful async methods that load data on-demand. **Note:** These methods may load ALL items into memory, so use with care for large datasets. For filtering, prefer server-side column-based filtering when possible:

```ts
// Transform all items
const contacts = await peopleQuery.items.mapAsync(person => ({
    fullName: `${person.values.FirstName} ${person.values.LastName}`,
    email: person.values.Email,
    phone: person.values.PhoneNumber
}));

// Filter items
const activePeople = await peopleQuery.items.filterAsync(person => person.values.IsActive === true);
console.log(`Found ${activePeople.length} active people`);

// Process each item with side effects
await peopleQuery.items.forEachAsync(async (person, index) => {
    console.log(`Processing person ${index + 1}...`);
    await sendEmail(person.values.Email);
});

// Get all items as a regular array
const allPeople = await peopleQuery.items.toArrayAsync();
console.log(`Total: ${allPeople.length} people`);

// Get a slice of items
const firstFive = await peopleQuery.items.sliceAsync(0, 5);
const nextFive = await peopleQuery.items.sliceAsync(5, 10);
```

### Loading Specific Items

For fine-grained control, use `getItemsByIndex()`:

```ts
// Load single item
const [firstPerson] = await peopleQuery.getItemsByIndex(0);

// Load multiple specific items
const items = await peopleQuery.getItemsByIndex(0, 5, 10, 25);
console.log(`Loaded ${items.length} specific items`);

// Load items with spread operator for dynamic indexes
const indexes = [0, 2, 4, 6, 8];
const evenIndexItems = await peopleQuery.getItemsByIndex(...indexes);
```

### Loading Item Ranges

For consecutive items, use `getItems()`:

```ts
// Load first 50 items
const firstPage = await peopleQuery.getItems(0, 50);

// Load next 50 items
const secondPage = await peopleQuery.getItems(50, 50);

// Load remaining items if query has more
if (peopleQuery.hasMore) {
    const currentCount = peopleQuery.items.length;
    const nextBatch = await peopleQuery.getItems(currentCount, peopleQuery.pageSize);
}
```

## Search and Filtering

### Text Search

Use the `textSearch` property for free-text searching across searchable columns:

```ts
// Apply text search
peopleQuery.textSearch = 'John Smith';
await peopleQuery.search();
console.log(`Found ${peopleQuery.totalItems} results for "John Smith"`);

// Clear search
peopleQuery.textSearch = '';
await peopleQuery.search();
console.log('Search cleared, showing all results');
```

### Column-Based Filtering

Filter queries efficiently on the server side using column filters. This is much more performant than client-side filtering with `filterAsync`:

```ts
// Find a filterable column
const genderColumn = peopleQuery.columns.find(c => 
    c.name === 'Gender' && c.canFilter
);

if (genderColumn) {
    // Apply a simple filter
    genderColumn.selectedDistincts = ['|Female'];
    await peopleQuery.search();
    
    console.log(`Filtered to ${peopleQuery.totalItems} female records`);
    
    // Clear the filter
    genderColumn.selectedDistincts = [];
    await peopleQuery.search();
}
```

For comprehensive filtering documentation including distinct values, text search patterns, and building filter UIs, see [Query Filter](./query-filter.md).


### Advanced Search Options

```ts
// Search with options
await peopleQuery.search({
    delay: 300,              // Debounce search
    throwExceptions: true,   // Don't suppress errors
    keepSelection: true      // Maintain selected items
});
```

## Sorting

### Single Column Sorting

```ts
// Sort by last name ascending
peopleQuery.sortOptions = [
    { name: 'LastName', direction: 'ASC' }
];
await peopleQuery.search();

// Sort by birth date descending (newest first)
peopleQuery.sortOptions = [
    { name: 'BirthDate', direction: 'DESC' }
];
await peopleQuery.search();
```

### Multi-Column Sorting

```ts
// Complex sort: Gender ascending, then BirthDate descending, then LastName ascending
peopleQuery.sortOptions = [
    { name: 'Gender', direction: 'ASC' },
    { name: 'BirthDate', direction: 'DESC' },
    { name: 'LastName', direction: 'ASC' }
];
await peopleQuery.search();

console.log('Applied sorts:', peopleQuery.sortOptions.map(s => 
    `${s.name} ${s.direction}`
).join(', '));
```

### Clear Sorting

```ts
// Remove all sorts, will reset to default order
peopleQuery.sortOptions = [];
await peopleQuery.search();
```

## Selection Management

### Basic Selection

```ts
// Select individual items
const [firstPerson, secondPerson] = await peopleQuery.getItemsByIndex(0, 1);
firstPerson.isSelected = true;
secondPerson.isSelected = true;

console.log(`Selected ${peopleQuery.selectedItems.length} items`);

// Batch select items
const itemsToSelect = await peopleQuery.getItemsByIndex(0, 1, 2);
peopleQuery.selectedItems = itemsToSelect;
```

### Range Selection

```ts
// Select range of items (indices 5-10)
const rangeSelected = peopleQuery.selectRange(5, 10);
if (rangeSelected) {
    console.log(`Selected items 5-10: ${peopleQuery.selectedItems.length} items`);
}
```

### Select All

```ts
if (peopleQuery.selectAll.isAvailable) {
    // Select all items
    peopleQuery.selectAll.allSelected = true;
    console.log(`Selected all ${peopleQuery.totalItems} items`);
    
    // Deselect all
    peopleQuery.selectAll.allSelected = false;
    console.log('Cleared all selections');
}
```

### Clear Selection

```ts
// Clear all selections
peopleQuery.selectedItems = [];
console.log('All selections cleared');
```

## Grouping

### Group by Column

```ts
// Group by gender (if column supports grouping)
const genderColumn = peopleQuery.columns.find(c => 
    c.name === 'Gender' && c.canGroup
);

if (genderColumn) {
    await peopleQuery.group(genderColumn);
    
    // Access group information
    if (peopleQuery.groupingInfo) {
        console.log(`Grouped by: ${peopleQuery.groupingInfo.groupedBy}`);
        
        peopleQuery.groupingInfo.groups.forEach(group => {
            console.log(`${group.name}: ${group.count} items`);
        });
    }
}
```

### Group by Column Name

```ts
// Group by birth date (groups by years)
const birthDateColumn = peopleQuery.columns.find(c => 
    c.name === 'BirthDate' && c.canGroup
);

if (birthDateColumn) {
    await peopleQuery.group('BirthDate');
    
    // Display year groups
    peopleQuery.groupingInfo?.groups.forEach(group => {
        console.log(`Birth year ${group.name}: ${group.count} people`);
    });
}
```

### Remove Grouping

```ts
// Remove grouping
await peopleQuery.group(null);
console.log('Grouping removed');
```

## Query Actions

### Standard Actions

```ts
// Get available actions
const actionNames = peopleQuery.actions.map(a => a.name);
console.log('Available actions:', actionNames);

// Access actions directly via the actions object
const newAction = peopleQuery.actions.New;
const refreshAction = peopleQuery.actions.Refresh;
const deleteAction = peopleQuery.actions.Delete;

// Or use getAction() method (returns the same)
const exportAction = peopleQuery.getAction('Export');
```

### Execute Actions

```ts
// Create new item
if (newAction?.canExecute) {
    const newPerson = await newAction.execute();
    console.log('Created new person:', newPerson.type);
}

// Refresh query data
if (refreshAction?.canExecute) {
    await refreshAction.execute();
    console.log('Query refreshed');
}

// Delete items - Option 1: Use selected items
if (deleteAction?.canExecute && peopleQuery.selectedItems.length > 0) {
    await deleteAction.execute();
    console.log(`Deleted ${peopleQuery.selectedItems.length} items`);
}

// Delete items - Option 2: Pass specific items
const itemsToDelete = await peopleQuery.getItemsByIndex(0, 1, 2);
if (deleteAction) {
    await deleteAction.execute({ selectedItems: itemsToDelete });
    console.log(`Deleted ${itemsToDelete.length} items`);
}
```

## Related Topics

- [Query Filter](./query-filter.md)
- [Action](./action.md)