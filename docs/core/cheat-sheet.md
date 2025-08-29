### `@vidyano/core` Coding Cheat Sheet

> **For detailed documentation, see:**
> - **Service**: [`docs/core/getting-started.md`](getting-started.md)
> - **Query**: [`docs/core/query.md`](query.md)
> - **Query Filters**: [`docs/core/query-filter.md`](query-filter.md)
> - **PersistentObject**: [`docs/core/persistent-object.md`](persistent-object.md)
> - **PersistentObjectAttribute**: [`docs/core/persistent-object-attribute.md`](persistent-object-attribute.md)
> - **Actions**: [`docs/core/action.md`](action.md)

#### 1. Service: Setup & Auth

> 📖 See [`getting-started.md`](getting-started.md) for complete Service documentation

```typescript
import { Service, ServiceHooks, Query, PersistentObject, Action } from "@vidyano/core";

// 1. Initialize
const service = new Service("http://localhost:5000");
await service.initialize(true);

// 2. Authenticate
await service.signInUsingCredentials("admin", "admin");

// 3. Get Root Objects
const peopleQuery = await service.getQuery("People", { textSearch: "A*", asLookup: true });
const person = await service.getPersistentObject(null, "Person", "ID_HERE");

// 4. Sign Out
await service.signOut();
```

#### 2. Query: Data Retrieval & Manipulation

> 📖 See [`query.md`](query.md) for complete Query documentation and [`query-filter.md`](query-filter.md) for filtering details

The core pattern is: **1. Modify properties, 2. `await query.search()`**.

##### Filtering & Searching

```typescript
// Global Text Search
peopleQuery.textSearch = "Anna";

// Column Filtering (find column, set distincts)
const genderColumn = peopleQuery.columns.find(c => c.name === 'Gender');
const emailColumn = peopleQuery.columns.find(c => c.name === 'Email');

// A. Get available filter options
await genderColumn.refreshDistincts();
// genderColumn.distincts now has { matching: [], remaining: [], hasMore: boolean }

// B. Set filter values
// Exact Match (Single or Multiple OR'd): Value MUST be prefixed with `|`
genderColumn.selectedDistincts = ['|Female', '|Male'];

// Text Search Match: Value MUST be prefixed with `1|@`
emailColumn.selectedDistincts = ['1|@gmail.com'];

// C. Set Include/Exclude Mode
genderColumn.selectedDistinctsInversed = true; // Acts as a NOT IN filter

// D. Clear filters
genderColumn.selectedDistincts = [];
genderColumn.selectedDistinctsInversed = false;

// Apply All Changes
await peopleQuery.search({ keepSelection: true }); // keepSelection preserves selected items
```
*   Multiple column filters are combined with **AND** logic.
*   Multiple values in a single column's `selectedDistincts` are combined with **OR** logic.
*   Check `query.isFiltering` to see if any filters are active.

##### Pre-filter on Load

```typescript
// Fetch a query with initial filters, text search, and sorting
const people = await service.getQuery("People", {
    columnOverrides: [
        { name: "Gender", includes: ["|Female", "|Male"] }, // exclude "Not Specified"
        { name: "IsActive", includes: ["|True"] },           // only active
        { name: "Country", excludes: ["|US", "|CA"] }       // anything except US/CA
    ],
    textSearch: "FirstName:A*",
    sortOptions: "LastName ASC; BirthDate DESC"
});

// Apply in one round-trip (depending on backend, an extra search may be needed)
await people.search();
```
*   Use `includes` to whitelist values and `excludes` to blacklist them.
*   Batch overrides and call `search()` once to avoid multiple round-trips.

##### Sorting

```typescript
peopleQuery.sortOptions = [
    { name: "LastName", direction: "ASC" },
    { name: "BirthDate", direction: "DESC" },
];
await peopleQuery.search();
```

##### Data Access & Pagination

The `query.items` array lazy-loads data. **Always use `...Async` methods or `for await` loops for iteration.**

```typescript
// Primary Method: for await Loop (Recommended for iteration)
for await (const item of peopleQuery.items) {
    console.log(item.values['FirstName'], item.values['LastName']);
    // Process each item as it's fetched from the server
    // This efficiently handles pagination automatically
}

// Async Methods for Collection Operations
const allItems = await peopleQuery.items.toArrayAsync();
const activePeople = await peopleQuery.items.filterAsync(item => item.values['IsActive']);
const firstMale = await peopleQuery.items.findAsync(item => item.values['Gender'] === 'Male');
const specificRange = await peopleQuery.items.sliceAsync(100, 150);

// Get PersistentObject from an item
const firstItem = allItems[0];
const po = await firstItem.getPersistentObject();

// Low-level/Direct Fetching
const items = await peopleQuery.items.atAsync([0, 5, 10]); // Fetches specific, non-contiguous items

// Properties
// query.items.length: Equals totalItems (NOT the number of loaded items)
// query.totalItems: Total records matching filters
// query.pageSize: Records per page
// query.hasMore: Boolean indicating if more pages exist
```

**Important:** `for await` loops are the most efficient way to iterate over query items as they:
- Fetch data lazily as needed
- Handle pagination automatically
- Avoid loading the entire dataset into memory at once
- Work seamlessly with the async iterator protocol

#### 3. PersistentObject (PO): Record Editing

> 📖 See [`persistent-object.md`](persistent-object.md) for complete PersistentObject documentation

The standard edit lifecycle is essential.

```typescript
const person = await service.getPersistentObject(null, "Person", "1");

// 1. Start Editing
person.beginEdit(); // Or: person.getAction("Edit").execute();
// person.isEditing is now true

// 2. Modify Attributes
await person.setAttributeValue("FirstName", "John");
// person.isDirty is now true

// 3. Save or Cancel
try {
    const success = await person.save(); // Returns true/false.
} catch (validationError) {
    // Check person.notification or attribute.validationError
}
// OR
person.cancelEdit(); // Discards changes.

// New Objects
const newAction = peopleQuery.getAction("New");
const newPerson = await newAction.execute(); // Already in edit mode (isNew: true, isEditing: true)
// ... set attributes ...
await newPerson.save();

// Freezing (temp read-only)
person.freeze();
await person.setAttributeValue("FirstName", "WontWork"); // This change will be ignored
person.unfreeze();

// Key State Flags
// person.isNew, person.isEditing, person.isDirty, person.isReadOnly, person.isFrozen

// Structural Properties
// person.breadcrumb: Display string for the object (e.g., "John Smith")
// person.tabs: Array of PersistentObjectAttributeTab or PersistentObjectQueryTab
```

#### 4. PersistentObject Attributes: Field-Level Operations

> 📖 See [`persistent-object-attribute.md`](persistent-object-attribute.md) for complete Attribute documentation

Access attributes via `po.getAttribute("AttributeName")`.

##### Attribute Types & Value Setting

```typescript
// Standard Value
const emailAttr = person.getAttribute("Email");
emailAttr.value = "new@example.com"; // Must be in edit mode

// Reference (Many-to-One)
const contactAttr = person.getAttribute("EmergencyContact");
const lookupQuery = contactAttr.lookup; // Query to find items to link
const contactItem = await lookupQuery.items.atAsync(0);
await contactAttr.changeReference(contactItem ? [contactItem] : []); // Set or clear reference
await contactAttr.changeReference([]); // Clear reference

// AsDetail (One-to-Many)
const languagesAttr = person.getAttribute("Languages");
if (!person.isEditing) person.beginEdit(); // Parent must be in edit mode
const newLangPO = await languagesAttr.newObject(); // Create new child PO
await newLangPO.setAttributeValue("Language", "Spanish");
languagesAttr.objects.push(newLangPO); // Add to parent's collection, then save parent PO
```

##### Metadata & State

```typescript
const attr = person.getAttribute("FirstName");

// attr.value: The raw value
// attr.displayValue: Formatted string for UI (e.g., dates)
// attr.label: "First Name"
// attr.type: "String", "Date", "Enum", "Reference", "AsDetail"
// attr.isRequired, attr.isReadOnly, attr.isValueChanged
// attr.rules: "NotEmpty; IsEmail"
// attr.options: ["Male", "Female"] (for Enums)
// attr.validationError: Message string if invalid after save attempt.
// attr.getTypeHint("inputtype", "text"): Get hints for UI rendering
```

##### Dependencies & Refresh

For attributes that affect others (e.g., a dropdown that shows/hides fields).

```typescript
const contactPrefAttr = person.getAttribute("ContactPreference");
// contactPrefAttr.triggersRefresh is true

// This will automatically refresh the PO and update dependencies (e.g., isRequired on Email/Phone)
await person.setAttributeValue("ContactPreference", "Phone");

// To defer the refresh:
await person.setAttributeValue("ContactPreference", "Phone", false); // The `false` defers
// ... other changes ...
await person.triggerAttributeRefresh(contactPrefAttr); // Manually trigger the refresh
```

#### 5. Actions: Executing Commands

> 📖 See [`action.md`](action.md) for complete Action documentation

Actions exist on `Query` and `PersistentObject` via `.actions.Name` or `.getAction(Name)`.

```typescript
// On a Query
const deleteAction = peopleQuery.getAction("Delete");
const firstItem = await peopleQuery.items.atAsync(0);
firstItem!.isSelected = true; // Selection rules determine canExecute

if (deleteAction.canExecute) { // ALWAYS check canExecute
    await deleteAction.execute();
}
// Action side effects: query may refresh, notification may be set.

// On a PersistentObject
const sendEmailAction = person.getAction("SendEmail");
if (sendEmailAction.canExecute) {
    const result = await sendEmailAction.execute(); // Can return null, new PO, etc.
}

// Actions with Menu Options and/or Parameters
const optionsAction = peopleQuery.getAction("TestOptions");
await optionsAction.execute({ menuOption: 0, parameters: { foo: "bar" } });

// UI Properties
// action.group: The ActionGroup it belongs to
// action.isPinned: If it should be displayed prominently
```

#### 6. Events & Notifications

```typescript
// Query Notifications
query.setNotification("Operation complete.", "OK"); // Types: "", "OK", "Notice", "Warning", "Error"
query.setNotification(null); // Clear notification

// Observable Property Changes (Advanced)
const disposer = po.propertyChanged.attach((sender, args) => {
    // args = { propertyName: "isDirty", oldValue: false, newValue: true }
});
disposer(); // Detach listener
```

#### 7. ServiceHooks: Headless Interception

Create a class extending `ServiceHooks` and pass it to the `Service` constructor.

```typescript
class HeadlessHooks extends ServiceHooks {
    async onActionConfirmation(action: Action, option: number): Promise<boolean> {
        return action.name === "Delete"; // Auto-confirm deletions
    }
    async onMessageDialog(title, message, rich, ...actions): Promise<number> {
        return 0; // Auto-press the first button (e.g., "OK")
    }
    async onFetch(request: Request): Promise<Response> {
        // Intercept fetch requests, e.g., for logging or modifying headers
        return super.onFetch(request);
    }
}
const serviceWithHooks = new Service("http://...", new HeadlessHooks());
```
