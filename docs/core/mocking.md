# Mocking

The Vidyano mocking system provides an in-memory virtual backend for testing applications without requiring a real server. It's perfect for unit tests, integration tests, and rapid prototyping.

> **Note:** The mocking system uses the exact same DTO types as the real backend, ensuring your tests accurately reflect production behavior.

## Quick Start

```ts
import { VirtualService } from "@vidyano/core/mocking";

// Create virtual service
const service = new VirtualService();

// Register a mock persistent object type
service.registerPersistentObject({
    type: "Person",
    label: "Person",
    attributes: [
        { name: "FirstName", type: "String", value: "John" },
        { name: "LastName", type: "String", value: "Smith" },
        { name: "Email", type: "String", rules: "IsEmail" }
    ]
});

// Initialize (must be called after all registrations)
await service.initialize();

// Load the mock object - works exactly like the real backend
const person = await service.getPersistentObject(null, "Person", "123");
console.log(person.getAttribute("FirstName").value); // "John"
```

## Core Concepts

### VirtualService

The main class that provides mock backend functionality. It extends `Service` to plug into Vidyano's service layer seamlessly.

```ts
const service = new VirtualService();
```

**Key methods:**
- `registerPersistentObject(config)` - Register a mock persistent object type
- `registerQuery(config)` - Register a mock query
- `registerAction(config)` - Register a custom action handler
- `registerBusinessRule(name, validator)` - Add custom validation rules
- `registerPersistentObjectActions(type, ActionsClass)` - Register lifecycle handlers
- `initialize()` - Finalize registrations (must call before using service)

> **Important:** All registrations must happen BEFORE calling `initialize()`. Attempting to register after initialization throws an error.

### Registration Order

Dependencies must be registered in order:

1. **PersistentObjects** first - Define the data schema
2. **Queries** second - Reference their PersistentObject types
3. **Actions** - Can reference PersistentObjects and Queries
4. **PersistentObjectActions** - Lifecycle handlers for specific types

```ts
// Correct order
service.registerPersistentObject({ type: "Person", ... });
service.registerQuery({ name: "AllPeople", persistentObject: "Person", ... });
await service.initialize();

// Wrong - query references unknown type
service.registerQuery({ name: "AllPeople", persistentObject: "Person" }); // Error!
service.registerPersistentObject({ type: "Person", ... });
```

## Basic Mock Objects

### Defining Attributes

Attributes are the building blocks of persistent objects. Each attribute has a name, type, and optional configuration:

```ts
service.registerPersistentObject({
    type: "Contact",
    attributes: [
        // Minimal attribute - name only (type defaults to "String")
        { name: "FirstName" },

        // With explicit type and initial value
        { name: "Age", type: "Int32", value: 25 },

        // With custom label
        { name: "Email", type: "String", label: "Email Address" },

        // Required field
        { name: "Company", type: "String", isRequired: true },

        // Read-only field
        { name: "CreatedDate", type: "DateTime", isReadOnly: true }
    ]
});
```

### Attribute Types

Common attribute types supported by the mocking system:

| Type | Use For | Example Value |
|------|---------|---------------|
| `String` | Text, names, emails | `"John Doe"` |
| `Int32` | Whole numbers | `42` |
| `Int64` | Large integers | `9007199254740991` |
| `Decimal` | Decimal numbers | `19.99` |
| `Double` | Floating-point numbers | `3.14159` |
| `Boolean` | True/false values | `true` or `"True"` |
| `DateTime` | Dates and times | `"2026-01-23T10:00:00"` |
| `Date` | Dates only | `"2026-01-23"` |
| `Byte` | Small integers (0-255) | `128` |

> **Note:** Values are stored as strings in DTOs but converted to JavaScript types when accessed through `getConvertedValue()`. Boolean attributes accept both native booleans and string values `"True"`/`"False"`.

### Attribute Configuration

Full attribute configuration options:

```ts
{
    name: "Email",                    // Required: attribute name
    type: "String",                   // Data type (default: "String")
    label: "Email Address",           // Display label (auto-humanized from name if omitted)
    value: "default@example.com",     // Initial value
    isRequired: true,                 // Makes attribute required
    isReadOnly: false,                // Makes attribute read-only
    visibility: "Always",             // When attribute is visible
    triggersRefresh: false,           // Triggers onRefresh when changed
    rules: "NotEmpty; IsEmail",       // Validation rules (semicolon-separated)
    tab: "",                          // Tab key (empty string = default tab)
    group: "Contact Info",            // Group within tab
    column: 0,                        // Column position
    columnSpan: 4,                    // Column width (default: 4)
    offset: 0,                        // Sort order offset
    canSort: true,                    // Allow sorting in queries
    lookupQuery: "AllContacts"        // Query for reference lookups
}
```

### Attribute Layout

Control how attributes are organized in tabs and groups:

```ts
service.registerPersistentObject({
    type: "Person",
    tabs: {
        "": { name: "General", columnCount: 0 },
        "Address": { name: "Address", columnCount: 0 }
    },
    attributes: [
        // General tab, Contact group
        {
            name: "FirstName",
            type: "String",
            tab: "",                    // General tab
            group: "Contact",           // Group name
            column: 0,                  // Column position
            columnSpan: 2               // Width (default: 4)
        },
        {
            name: "Email",
            type: "String",
            tab: "",
            group: "Contact",
            column: 2,
            columnSpan: 2
        },

        // Address tab
        {
            name: "Street",
            type: "String",
            tab: "Address",
            group: "Location"
        }
    ]
});
```

## Attribute Visibility

Control when attributes appear based on the object's state:

```ts
service.registerPersistentObject({
    type: "User",
    attributes: [
        // Always visible (default)
        { name: "Username", type: "String", visibility: "Always" },

        // Only when creating new objects
        { name: "Password", type: "String", visibility: "New" },

        // Only when viewing existing objects
        { name: "CreatedDate", type: "DateTime", visibility: "Read" },

        // Only in query columns
        { name: "Status", type: "String", visibility: "Query" },

        // Never visible (for computed/internal fields)
        { name: "InternalId", type: "String", visibility: "Never" }
    ]
});

// New object - Password visible, CreatedDate hidden
const newUser = await service.getPersistentObject(null, "User");

// Existing object - Password hidden, CreatedDate visible
const existingUser = await service.getPersistentObject(null, "User", "123");
```

**Visibility options:**
- `Always` - Visible in all contexts (default)
- `New` - Only visible when creating new objects
- `Read` - Only visible when viewing existing objects
- `Query` - Only visible in query columns
- `Never` - Never visible
- Compound: `"Read, Query"` - Visible in multiple contexts

## Validation

### Built-in Business Rules

The mocking system includes built-in validation rules:

```ts
service.registerPersistentObject({
    type: "Contact",
    attributes: [
        // Single rule
        { name: "Email", type: "String", rules: "IsEmail" },

        // Multiple rules (semicolon-separated)
        {
            name: "Username",
            type: "String",
            rules: "NotEmpty; MinLength(3); MaxLength(20)"
        },

        // Rules with parameters
        { name: "Age", type: "Int32", rules: "MinValue(18); MaxValue(120)" },

        // Required fields (same as NotEmpty rule)
        { name: "FirstName", type: "String", isRequired: true }
    ]
});
```

**Available rules:**

| Rule | Parameters | Description | Example |
|------|-----------|-------------|---------|
| `NotEmpty` | - | Value must not be empty/null | `"NotEmpty"` |
| `Required` | - | Alias for NotEmpty | `"Required"` |
| `IsEmail` | - | Valid email format | `"IsEmail"` |
| `IsUrl` | - | Valid URL format | `"IsUrl"` |
| `MinLength` | (length) | Minimum string length | `"MinLength(8)"` |
| `MaxLength` | (length) | Maximum string length | `"MaxLength(50)"` |
| `MinValue` | (number) | Minimum numeric value | `"MinValue(0)"` |
| `MaxValue` | (number) | Maximum numeric value | `"MaxValue(100)"` |
| `IsBase64` | - | Valid base64 string | `"IsBase64"` |
| `IsRegex` | - | Valid regex pattern | `"IsRegex"` |
| `IsWord` | - | Word characters only (\w+) | `"IsWord"` |

### Validation Flow

Validation runs automatically when the Save action executes:

```ts
const contact = await service.getPersistentObject(null, "Contact");

// Set invalid email
contact.getAttribute("Email").setValue("not-an-email");

// Try to save - validation fails
await contact.save();

// Check validation error
console.log(contact.getAttribute("Email").validationError);
// "Email format is invalid"
```

**Validation behavior:**
- Runs before save handlers execute
- First failing rule stops validation for that attribute
- Validation errors set on the attribute's `validationError` property
- If any attribute fails, the save operation is aborted
- Null and undefined values skip validation (unless using `NotEmpty`/`Required`)

### Custom Business Rules

Register your own validation rules for domain-specific requirements:

```ts
// Register a custom rule (before registerPersistentObject)
service.registerBusinessRule("IsPhoneNumber", (value: any) => {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    if (!phoneRegex.test(String(value)))
        throw new Error("Invalid phone number format");
});

// Use it in your configuration
service.registerPersistentObject({
    type: "Contact",
    attributes: [
        {
            name: "Phone",
            type: "String",
            rules: "NotEmpty; IsPhoneNumber"
        }
    ]
});
```

**Custom rule requirements:**
- Must be registered before `registerPersistentObject()`
- Throw an `Error` with a message if validation fails
- Return nothing (or undefined) if validation passes
- Cannot override built-in rules

## Queries

### Basic Query Registration

Queries allow browsing and searching collections of persistent objects:

```ts
service.registerPersistentObject({
    type: "Person",
    attributes: [
        { name: "Name", type: "String" },
        { name: "Email", type: "String" },
        { name: "Age", type: "Int32" }
    ]
});

service.registerQuery({
    name: "AllPeople",
    persistentObject: "Person",  // Required: links to PO type
    label: "All People",
    data: [
        { Name: "Alice", Email: "alice@example.com", Age: 30 },
        { Name: "Bob", Email: "bob@example.com", Age: 25 },
        { Name: "Charlie", Email: "charlie@example.com", Age: 35 }
    ]
});

await service.initialize();

const query = await service.getQuery("AllPeople");
await query.search();

const items = await query.items.toArrayAsync();
console.log(items.length); // 3
```

### Query Configuration

Full query configuration options:

```ts
{
    name: "AllPeople",                // Required: query name
    persistentObject: "Person",       // Required: linked PO type
    label: "All People",              // Display label
    data: [...],                      // Static data for the query
    autoQuery: true,                  // Execute automatically (default: true)
    allowTextSearch: true,            // Enable text search
    pageSize: 25,                     // Items per page
    disableBulkEdit: false,           // Disable bulk editing
    actions: [                        // Query-level actions
        { name: "ExportAll", handler: ... }
    ],
    itemActions: [                    // Actions on selected items
        { name: "Delete", handler: ... }
    ]
}
```

### Query Columns

Columns are automatically derived from the PersistentObject's attributes:

```ts
service.registerPersistentObject({
    type: "Person",
    attributes: [
        { name: "Name", type: "String", canSort: true },
        { name: "Email", type: "String", canSort: true },
        { name: "InternalId", type: "String", visibility: "Never" }  // Hidden column
    ]
});
```

Column properties inherited from attributes:
- `canSort` - Whether column can be sorted (default: true)
- `isHidden` - Derived from visibility (Never, New = hidden)
- `offset` - Column display order

### Text Search

Queries support case-insensitive text search across visible string columns:

```ts
const query = await service.getQuery("AllPeople");

// Search for "alice"
query.textSearch = "alice";
await query.search();

const results = await query.items.toArrayAsync();
console.log(results.length); // 1
console.log(results[0].values.Name); // "Alice"
```

### Sorting

Sort queries by one or more columns:

```ts
const query = await service.getQuery("AllPeople");

// Sort by age ascending
query.sortOptions = "Age ASC";
await query.search();

// Sort by multiple columns
query.sortOptions = "Age DESC, Name ASC";
await query.search();
```

Sorting is type-aware:
- Strings: Case-insensitive alphabetical
- Numbers: Numeric comparison
- Dates: Chronological order
- Null values sort last

### Pagination

Control page size and navigate results:

```ts
service.registerQuery({
    name: "AllPeople",
    persistentObject: "Person",
    pageSize: 10,  // 10 items per page
    data: [/* 100 items */]
});

const query = await service.getQuery("AllPeople");
await query.search();

// Get first page
const page1 = await query.items.sliceAsync(0, 10);

// Get second page
const page2 = await query.items.sliceAsync(10, 20);
```

## Actions

### Custom Actions

Register actions with custom handlers:

```ts
service.registerAction({
    name: "Approve",
    displayName: "Approve Order",
    isPinned: true,
    handler: async (args: ActionArgs) => {
        // Access context for reading/modifying the object
        args.context.setAttributeValue("Status", "Approved");
        args.context.setNotification("Order approved!", "OK", 3000);

        // Return the updated object (or null for silent completion)
        return args.parent;
    }
});
```

### ActionArgs

Action handlers receive `ActionArgs` with execution context:

```ts
interface ActionArgs {
    parent: PersistentObjectDto | null;       // The PO being acted on
    query: QueryDto | null;                   // The query (for query actions)
    selectedItems: QueryResultItemDto[];      // Selected items in query
    parameters: PersistentObjectDto | null;   // Action parameters
    context: ActionContext;                   // Helper methods
}
```

### ActionContext

The context provides helper methods for modifying the persistent object:

```ts
handler: async (args: ActionArgs) => {
    // Read attribute values
    const email = args.context.getAttributeValue("Email");
    const attr = args.context.getAttribute("Email");

    // Type-safe value access
    const age = args.context.getConvertedValue<number>("Age");

    // Modify attribute values
    args.context.setAttributeValue("Status", "Active");
    args.context.setConvertedValue("Count", 42);

    // Set validation errors
    if (!email.includes("@"))
        args.context.setValidationError("Email", "Invalid email format");

    // Clear validation errors
    args.context.clearValidationError("Email");

    // Show notifications
    args.context.setNotification("Saved successfully", "OK", 3000);
    args.context.setNotification("Warning!", "Warning", 5000);
    args.context.setNotification("Error occurred", "Error");

    return args.parent;
}
```

**Context methods:**

| Method | Description |
|--------|-------------|
| `getAttribute(name)` | Get the full attribute |
| `getAttributeValue(name)` | Get the raw attribute value |
| `getConvertedValue<T>(name)` | Get type-converted value |
| `setAttributeValue(name, value)` | Update raw attribute value |
| `setConvertedValue(name, value)` | Update with type conversion |
| `setValidationError(name, error)` | Set a validation error message |
| `clearValidationError(name)` | Clear validation error |
| `setNotification(msg, type, duration?)` | Show notification to user |

### Query Actions

Actions can operate on query results:

```ts
service.registerAction({
    name: "BulkDelete",
    handler: async (args: ActionArgs) => {
        // Access selected items
        for (const item of args.selectedItems) {
            console.log(`Deleting item: ${item.id}`);
        }

        return null; // Silent completion
    }
});
```

## Lifecycle Hooks

### VirtualPersistentObjectActions

For complex scenarios, create a class extending `VirtualPersistentObjectActions`:

```ts
import { VirtualPersistentObjectActions, VirtualPersistentObject } from "@vidyano/core/mocking";

class PersonActions extends VirtualPersistentObjectActions {
    // Called when any Person DTO is created
    async onConstruct(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
        // Set defaults
        obj.setAttributeValue("CreatedDate", new Date().toISOString());
        return obj;
    }

    // Called when loading an existing Person
    async onLoad(obj: VirtualPersistentObject, parent?: VirtualPersistentObject): Promise<VirtualPersistentObject> {
        // Load additional data based on ID
        const id = obj.objectId;
        console.log(`Loading person: ${id}`);
        return obj;
    }

    // Called when creating a new Person via "New" action
    async onNew(
        obj: VirtualPersistentObject,
        parent?: VirtualPersistentObject,
        query?: VirtualQuery,
        parameters?: VirtualPersistentObject
    ): Promise<VirtualPersistentObject> {
        // Initialize new object
        obj.setAttributeValue("Status", "Draft");
        return obj;
    }

    // Called when saving
    async onSave(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
        obj = await super.onSave(obj);
        console.log("Person saved!");
        return obj;
    }

    // Called for new objects
    async saveNew(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
        obj.setAttributeValue("Id", crypto.randomUUID());
        return obj;
    }

    // Called for existing objects
    async saveExisting(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
        obj.setAttributeValue("ModifiedDate", new Date().toISOString());
        return obj;
    }
}

// Register the actions class
service.registerPersistentObjectActions("Person", PersonActions);
```

### Lifecycle Flow

```
PersistentObject Load:    onConstruct → onLoad
PersistentObject New:     onConstruct → onNew
PersistentObject Save:    (validation) → onSave → (saveNew | saveExisting)
Query Construction:       onConstructQuery
Query Execution:          onExecuteQuery → (text search, sort, paginate)
Attribute Refresh:        onRefresh
Reference Selection:      onSelectReference
Deletion:                 onDelete
```

### Refresh Handling

Handle attribute changes that trigger refresh:

```ts
class OrderActions extends VirtualPersistentObjectActions {
    async onRefresh(
        obj: VirtualPersistentObject,
        attribute?: VirtualPersistentObjectAttribute
    ): Promise<VirtualPersistentObject> {
        // Calculate total when quantity or price changes
        const quantity = obj.getAttributeValue("Quantity") ?? 0;
        const unitPrice = obj.getAttributeValue("UnitPrice") ?? 0;
        obj.setAttributeValue("Total", quantity * unitPrice);

        return obj;
    }
}
```

Mark attributes that should trigger refresh:

```ts
service.registerPersistentObject({
    type: "Order",
    attributes: [
        { name: "Quantity", type: "Int32", triggersRefresh: true },
        { name: "UnitPrice", type: "Decimal", triggersRefresh: true },
        { name: "Total", type: "Decimal", isReadOnly: true }
    ]
});
```

### Query Execution

Provide dynamic query data:

```ts
class PersonActions extends VirtualPersistentObjectActions {
    private database: PersonData[] = [];

    // Provide data for query execution
    async getEntities(
        query: VirtualQuery,
        parent?: VirtualPersistentObject,
        data?: VirtualQueryExecuteResult
    ): Promise<Record<string, any>[]> {
        // Return all entities - framework handles search/sort/pagination
        return this.database;
    }

    // Or fully control query execution
    async onExecuteQuery(
        query: VirtualQuery,
        parent?: VirtualPersistentObject,
        data?: VirtualQueryExecuteResult
    ): Promise<VirtualQueryExecuteResult> {
        // Custom query logic
        const results = this.database.filter(p => p.active);
        return { items: results, totalItems: results.length };
    }
}
```

### Reference Attributes

Handle reference attribute selection:

```ts
class OrderActions extends VirtualPersistentObjectActions {
    async onSelectReference(
        parent: VirtualPersistentObject,
        refAttr: VirtualPersistentObjectAttribute,
        query: VirtualQuery,
        selectedItem: QueryResultItemDto
    ): Promise<void> {
        // Default: sets objectId and value from first column
        await super.onSelectReference(parent, refAttr, query, selectedItem);

        // Custom: also copy related fields
        const customerName = selectedItem.values["Name"];
        parent.setAttributeValue("CustomerName", customerName);
    }
}
```

Configure reference attributes:

```ts
service.registerPersistentObject({
    type: "Order",
    attributes: [
        {
            name: "Customer",
            type: "Reference",
            lookupQuery: "AllCustomers"  // Must be registered
        }
    ]
});

service.registerQuery({
    name: "AllCustomers",
    persistentObject: "Customer",
    data: [...]
});
```

## State Behavior

Control how persistent objects behave after actions:

```ts
service.registerPersistentObject({
    type: "Settings",
    stateBehavior: "StayInEdit",  // Keep form in edit mode after save
    attributes: [
        { name: "Theme", type: "String" },
        { name: "Language", type: "String" }
    ]
});
```

**State behavior options:**
- `None` - Default behavior
- `OpenInEdit` - Open in edit mode by default
- `StayInEdit` - Stay in edit mode after save
- `AsDialog` - Open as a dialog

## Master-Detail Relationships

Configure detail queries for master-detail scenarios:

```ts
service.registerPersistentObject({
    type: "Order",
    attributes: [
        { name: "OrderNumber", type: "String" },
        { name: "Total", type: "Decimal" }
    ],
    detailQueries: {
        "OrderLines": "OrderLines"  // Key = tab name, Value = query name
    }
});

service.registerPersistentObject({
    type: "OrderLine",
    attributes: [
        { name: "Product", type: "String" },
        { name: "Quantity", type: "Int32" },
        { name: "Price", type: "Decimal" }
    ]
});

service.registerQuery({
    name: "OrderLines",
    persistentObject: "OrderLine"
});
```

Access detail queries:

```ts
const order = await service.getPersistentObject(null, "Order", "123");
const linesQuery = order.queries.find(q => q.name === "OrderLines");
await linesQuery.search();
```

## VirtualPersistentObject Helpers

The `VirtualPersistentObject` type provides convenient helper methods:

```ts
// In lifecycle hooks, objects are wrapped with helpers
async onSave(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
    // Get attribute by name
    const attr = obj.getAttribute("Email");

    // Get/set values
    const email = obj.getAttributeValue("Email");
    obj.setAttributeValue("Email", "new@example.com");

    // Validation errors
    obj.setValidationError("Email", "Invalid format");
    obj.clearValidationError("Email");

    // Notifications
    obj.setNotification("Saved!", "OK", 3000);

    return obj;
}
```

## Testing with Mocks

### Unit Test Example

```ts
import { test, expect } from "@playwright/test";
import { VirtualService } from "@vidyano/core/mocking";

test("validates email format", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Contact",
        attributes: [
            { name: "Email", type: "String", rules: "IsEmail" }
        ]
    });

    await service.initialize();

    const contact = await service.getPersistentObject(null, "Contact");
    contact.getAttribute("Email").setValue("not-an-email");

    await contact.save();

    expect(contact.getAttribute("Email").validationError).toBe("Email format is invalid");
});
```

### Integration Test Example

```ts
test("complete order workflow", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Order",
        attributes: [
            { name: "Status", type: "String", value: "Draft" },
            { name: "Total", type: "Decimal", value: 0 }
        ]
    });

    service.registerAction({
        name: "Submit",
        handler: async (args) => {
            args.context.setAttributeValue("Status", "Submitted");
            return args.parent;
        }
    });

    service.registerAction({
        name: "Approve",
        handler: async (args) => {
            const status = args.context.getAttributeValue("Status");
            if (status !== "Submitted") {
                args.context.setNotification("Order must be submitted first", "Error");
                return args.parent;
            }
            args.context.setAttributeValue("Status", "Approved");
            return args.parent;
        }
    });

    await service.initialize();

    const order = await service.getPersistentObject(null, "Order", "123");
    expect(order.getAttribute("Status").value).toBe("Draft");

    // Submit order
    await order.getAction("Submit").execute();
    expect(order.getAttribute("Status").value).toBe("Submitted");

    // Approve order
    await order.getAction("Approve").execute();
    expect(order.getAttribute("Status").value).toBe("Approved");
});
```

### Query Test Example

```ts
test("search and sort query results", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Name", type: "String" },
            { name: "Age", type: "Int32" }
        ]
    });

    service.registerQuery({
        name: "AllPeople",
        persistentObject: "Person",
        data: [
            { Name: "Alice", Age: 30 },
            { Name: "Bob", Age: 25 },
            { Name: "Charlie", Age: 35 }
        ]
    });

    await service.initialize();

    const query = await service.getQuery("AllPeople");

    // Test search
    query.textSearch = "alice";
    await query.search();
    let items = await query.items.toArrayAsync();
    expect(items.length).toBe(1);

    // Test sort
    query.textSearch = "";
    query.sortOptions = "Age ASC";
    await query.search();
    items = await query.items.toArrayAsync();
    expect(items[0].values.Name).toBe("Bob"); // Youngest first
});
```

## Best Practices

- **Register in order** - PersistentObjects first, then Queries, then initialize
- **Use lifecycle hooks** - Prefer `VirtualPersistentObjectActions` for complex logic over inline handlers
- **Validate early** - Use built-in rules for common validations, custom rules for domain-specific
- **Test comprehensively** - Cover validation, actions, queries, and edge cases
- **Keep data realistic** - Use production-like test data to catch real issues
- **Leverage type safety** - Use `getConvertedValue<T>()` for type-safe value access
- **Handle null values** - Check for null/undefined, especially in calculations

## Related Topics

- [Service](./getting-started.md) - Setting up and using the Service class
- [PersistentObject](./persistent-object.md) - Working with persistent objects
- [PersistentObjectAttribute](./persistent-object-attribute.md) - Understanding attributes
- [Query](./query.md) - Working with queries
- [Action](./action.md) - Executing actions
- [Testing Guide](../../tests/core/README.md) - Writing tests with Playwright
