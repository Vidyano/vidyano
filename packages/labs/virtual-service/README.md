# @vidyano-labs/virtual-service

A virtual service implementation for testing Vidyano applications without requiring a backend server. Perfect for unit tests, integration tests, and rapid prototyping.

> **Note:** The virtual service uses the exact same DTO types as the real backend, ensuring your tests accurately reflect production behavior.

## Installation

```bash
npm install @vidyano-labs/virtual-service
```

## Peer Dependencies

This package requires `@vidyano/core` as a peer dependency:

```bash
npm install @vidyano/core
```

## Quick Start

```typescript
import { VirtualService } from "@vidyano-labs/virtual-service";

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

```typescript
const service = new VirtualService();
```

**Key methods:**
- `registerPersistentObject(config, actionsClass?)` - Register a mock persistent object type with optional lifecycle class
- `registerQuery(config)` - Register a mock query
- `registerCustomAction(name, handler)` or `registerCustomAction(config, handler)` - Register a custom action
- `registerBusinessRule(name, validator)` - Add custom validation rules
- `initialize()` - Finalize registrations (must call before using service)

> **Important:** All registrations must happen BEFORE calling `initialize()`. Attempting to register after initialization throws an error.

### Registration Order

Dependencies must be registered before the things that reference them:

1. **Actions** first - Custom actions must be registered before PersistentObjects/Queries that reference them
2. **PersistentObjects** - Define the data schema (with optional lifecycle class)
3. **Queries** - Must reference an already-registered PersistentObject type

```typescript
// Correct order
service.registerPersistentObject({ type: "Person", attributes: [...] });
service.registerQuery({ name: "AllPeople", persistentObject: "Person", ... });
await service.initialize();

// Wrong - query references unknown type
service.registerQuery({ name: "AllPeople", persistentObject: "Person" }); // Error!
service.registerPersistentObject({ type: "Person", attributes: [...] });
```

> **Note:** If a PersistentObject has attributes with `lookup` queries or detail `queries`, those queries must be registered first.

## Defining Persistent Objects

Persistent objects are the core data structures in Vidyano. Each represents a type of business entity with attributes, tabs, validation rules, and behaviors.

### Basic Structure

```typescript
service.registerPersistentObject({
    type: "Contact",           // Required: unique type identifier
    label: "Contact",          // Display name (defaults to type)
    attributes: [...],         // Fields that hold data
    tabs: {...},               // Optional: organize attributes into tabs
    queries: [...],            // Optional: detail queries (master-detail)
    stateBehavior: "None"      // Optional: controls edit mode behavior
});
```

### Attributes

Attributes define the fields of a persistent object. Each attribute has a name, type, and optional configuration:

```typescript
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

Common attribute types supported by the virtual service:

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

> **Note:** Use native JavaScript types (boolean, number, Date, etc.) when setting attribute values. The `getValue<T>()` and `setValue<T>()` methods work directly with these types and support generics for type safety (e.g., `getValue<number>()`).

### Attribute Configuration

Full attribute configuration options:

```typescript
{
    name: "Email",                    // Required: attribute name
    type: "String",                   // Data type (default: "String")
    label: "Email Address",           // Display label (defaults to name)
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
    options: ["Option1", "Option2"],  // Predefined options for selection
    typeHints: { "key": "value" },    // Type hints for the attribute
    lookup: "AllContacts",            // Query for reference lookups
    displayAttribute: "Name",         // Display attribute for references
    canAddNewReference: false,        // Allow adding new references
    selectInPlace: false              // Use fixed list for references
}
```

### Attribute Layout

Control how attributes are organized in tabs and groups:

```typescript
service.registerPersistentObject({
    type: "Person",
    tabs: {
        "General": { name: "General", columnCount: 0 },
        "Address": { name: "Address", columnCount: 0 }
    },
    attributes: [
        // General tab, Contact group
        {
            name: "FirstName",
            type: "String",
            tab: "General",             // Tab key
            group: "Contact",           // Group name
            column: 0,                  // Column position
            columnSpan: 2               // Width (default: 4)
        },
        {
            name: "Email",
            type: "String",
            tab: "General",
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

> **Note:** Using an empty string `""` as the tab key creates a "default" tab. However, the tab's displayed label will be the PersistentObject's label (e.g., "Person"), not the tab's `name` property. Use explicit tab keys like `"General"` for predictable labeling.

## Attribute Visibility

Control when attributes appear based on the object's state:

```typescript
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
const newUser = await service.getPersistentObject(null, "User", null, true);

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

The virtual service includes built-in validation rules:

```typescript
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

Validation runs automatically when saving - `onSave` calls `checkRules()` before delegating to `saveNew`/`saveExisting`:

```typescript
const contact = await service.getPersistentObject(null, "Contact", null, true);

// Set invalid email
contact.getAttribute("Email").setValue("not-an-email");

// Try to save - validation fails
await contact.save();

// Check validation error
console.log(contact.getAttribute("Email").validationError);
// "Email format is invalid"

// Notification is also set on the object
console.log(contact.notification);
// "Some required information is missing or incorrect."
```

**Validation behavior:**
- Runs inside `onSave` via the `checkRules()` method (before `saveNew`/`saveExisting`)
- First failing rule stops validation for that attribute
- Validation errors set on the attribute's `validationError` property
- If any attribute fails, a notification is set and save handlers are not called
- Null and undefined values skip validation (unless using `NotEmpty`/`Required`)

### Overriding Validation

Override `checkRules()` in your `VirtualPersistentObjectActions` class to customize validation:

```typescript
class PersonActions extends VirtualPersistentObjectActions {
    // Custom validation - completely replace default behavior
    checkRules(obj: VirtualPersistentObject): boolean {
        const name = obj.getAttributeValue("Name");
        if (name === "reserved") {
            obj.setValidationError("Name", "This name is reserved");
            obj.setNotification("Validation failed", "Error");
            return false;
        }
        return true;  // Skip default validation
    }
}

// Or combine custom + default validation
class OrderActions extends VirtualPersistentObjectActions {
    checkRules(obj: VirtualPersistentObject): boolean {
        // Custom business logic first
        const total = obj.getAttributeValue("Total");
        const discount = obj.getAttributeValue("Discount");
        if (discount > total) {
            obj.setValidationError("Discount", "Discount cannot exceed total");
            obj.setNotification("Validation failed", "Error");
            return false;
        }

        // Then run default rule-based validation
        return super.checkRules(obj);
    }
}

// Skip validation entirely
class DraftActions extends VirtualPersistentObjectActions {
    checkRules(_obj: VirtualPersistentObject): boolean {
        return true;  // Always valid - skip all validation
    }
}
```

**checkRules behavior:**
- Returns `true` if all validations pass, `false` if any fail
- When returning `false`, `saveNew`/`saveExisting` are not called
- The object passed to `checkRules` is a `VirtualPersistentObject`
- Call `super.checkRules(obj)` to include default rule-based validation

### Custom Business Rules

Register your own validation rules for domain-specific requirements:

```typescript
import type { VirtualPersistentObjectAttribute } from "@vidyano-labs/virtual-service";

// Register a custom rule (before registerPersistentObject)
service.registerBusinessRule("IsPhoneNumber", (value: any, attr: VirtualPersistentObjectAttribute) => {
    if (value == null || value === "") return;
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

**Attribute parameter:**
The `attr` parameter is the `VirtualPersistentObjectAttribute` being validated, which provides access to:
- `attr.service` - The VirtualService instance (use for `getMessage()` translations)
- `attr.persistentObject` - The persistent object being validated
- `attr.getValue()` / `attr.setValue()` - Get/set the attribute value
- All DTO properties (`name`, `type`, `rules`, etc.)

This allows cross-field validation:

```typescript
// Validate password confirmation matches password
service.registerBusinessRule("MatchesPassword", (value: any, attr: VirtualPersistentObjectAttribute) => {
    if (!value) return;

    const passwordValue = attr.persistentObject.getAttributeValue("Password");
    if (value !== passwordValue)
        throw new Error(attr.service.getMessage("MatchesPassword"));
});

service.registerPersistentObject({
    type: "User",
    attributes: [
        { name: "Password", type: "String" },
        {
            name: "ConfirmPassword",
            type: "String",
            rules: "MatchesPassword"
        }
    ]
});
```

**Custom rule requirements:**
- Must be registered before `registerPersistentObject()`
- Receives two parameters: `value` (the converted attribute value) and `attr` (the attribute being validated)
- Throw an `Error` with a message if validation fails
- Return nothing (or undefined) if validation passes
- Cannot override built-in rules

### Translating Validation Messages

Customize validation error messages by setting the static `VirtualService.messages` property:

```typescript
import { VirtualService } from "@vidyano-labs/virtual-service";

// Set custom messages (e.g., Dutch translations)
VirtualService.messages = {
    "Required": "Dit veld is verplicht",
    "NotEmpty": "Dit veld mag niet leeg zijn",
    "IsEmail": "E-mailformaat is ongeldig",
    "MaxLength": "Maximale lengte is {0} tekens",
    "MinLength": "Minimale lengte is {0} tekens",
    "MaxValue": "Maximale waarde is {0}",
    "MinValue": "Minimale waarde is {0}",
    "IsBase64": "Waarde moet een geldige base64 string zijn",
    "IsRegex": "Waarde moet een geldige reguliere expressie zijn",
    "IsWord": "Waarde mag alleen woordtekens bevatten",
    "IsUrl": "Waarde moet een geldige URL zijn",
    "ValidationRulesFailed": "Sommige vereiste informatie ontbreekt of is onjuist."
};

const service = new VirtualService();

service.registerPersistentObject({
    type: "Person",
    attributes: [
        {
            name: "Email",
            type: "String",
            rules: "Required; MaxLength(100); IsEmail"
        }
    ]
});

await service.initialize();

const person = await service.getPersistentObject(null, "Person", null, true);
await person.save();

// Error message uses custom translation
console.log(person.getAttribute("Email").validationError);
// "Dit veld is verplicht"
```

**How it works:**
1. Set `VirtualService.messages` with your custom messages before creating services
2. Messages use `{0}`, `{1}` placeholders for positional parameters
3. The `getMessage(key, ...params)` method formats messages with the provided parameters
4. If a key is not found in the messages dictionary, the key itself is returned

**Custom rules can also use getMessage:**

```typescript
import type { VirtualPersistentObjectAttribute } from "@vidyano-labs/virtual-service";

// Set custom messages including your custom rule keys
VirtualService.messages = {
    ...VirtualService.messages,  // Keep default messages
    "MinimumAge": "L'âge minimum est {0}",
    "MatchesPassword": "Les mots de passe ne correspondent pas"
};

const service = new VirtualService();

// Custom rule using getMessage via attr.service
service.registerBusinessRule("MinimumAge", (value: any, attr: VirtualPersistentObjectAttribute, minAge: number) => {
    if (!value)
        return;

    const age = Number(value);
    if (age < minAge)
        throw new Error(attr.service.getMessage("MinimumAge", minAge));
});

// Custom rule can still throw direct error strings
service.registerBusinessRule("IsPhoneNumber", (value: any, _attr: VirtualPersistentObjectAttribute) => {
    if (!value)
        return;

    const phoneRegex = /^\+?[\d\s-()]+$/;
    if (!phoneRegex.test(String(value)))
        throw new Error("Invalid phone number format");  // Direct string, not translated
});
```

**Built-in message keys:**
- `Required` - Field is required (no params)
- `NotEmpty` - Field cannot be empty (no params)
- `IsEmail` - Invalid email format (no params)
- `IsUrl` - Invalid URL format (no params)
- `MaxLength` - Maximum length exceeded (param: max length)
- `MinLength` - Minimum length not met (param: min length)
- `MaxValue` - Maximum value exceeded (param: max value)
- `MinValue` - Minimum value not met (param: min value)
- `IsBase64` - Invalid base64 string (no params)
- `IsRegex` - Invalid regex pattern (no params)
- `IsWord` - Invalid word characters (no params)
- `ValidationRulesFailed` - Notification message when validation fails (no params)

## Queries

### Basic Query Registration

Queries allow browsing and searching collections of persistent objects:

```typescript
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

```typescript
{
    name: "AllPeople",                // Required: query name
    persistentObject: "Person",       // Required: linked PO type
    label: "All People",              // Display label
    data: [...],                      // Static data for the query
    autoQuery: true,                  // Execute automatically (default: true)
    allowTextSearch: true,            // Enable text search (default: true)
    pageSize: 20,                     // Items per page (default: 20)
    disableBulkEdit: false,           // Disable bulk editing
    actions: ["New", "Export"],       // Query-level actions (by name)
    itemActions: ["Edit", "Delete"]   // Actions on selected items (by name)
}
```

### Query Columns

Columns are automatically derived from the PersistentObject's attributes:

```typescript
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

```typescript
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

```typescript
const query = await service.getQuery("AllPeople");

// Sort by age ascending
query.sortOptions = [{ name: "Age", direction: "ASC" }];
await query.search();

// Sort by multiple columns
query.sortOptions = [
    { name: "Age", direction: "DESC" },
    { name: "Name", direction: "ASC" }
];
await query.search();
```

Sorting is type-aware:
- Strings: Case-insensitive alphabetical
- Numbers: Numeric comparison
- Dates: Chronological order
- Null values sort first

### Pagination

Control page size and navigate results:

```typescript
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

Register actions with custom handlers. You can use either a simple string name or a full config object:

```typescript
// Simple: just the action name
service.registerCustomAction("Approve", async (args) => {
    args.parent.setAttributeValue("Status", "Approved");
    return args.parent;
});

// Full config: with displayName, isPinned, etc.
service.registerCustomAction(
    {
        name: "Approve",
        displayName: "Approve Order",
        isPinned: true
    },
    async (args) => {
        args.parent.setAttributeValue("Status", "Approved");
        args.parent.setNotification("Order approved!", "OK", 3000);
        return args.parent;
    }
);
```

### ActionArgs

Action handlers receive an `args` object with execution context:

```typescript
// args parameter contains:
// - parent: VirtualPersistentObject | null   // The PO being acted on
// - query?: VirtualQuery                     // The query (for query actions)
// - selectedItems?: VirtualQueryResultItem[] // Selected items in query
// - parameters?: Record<string, any>         // Action parameters
```


### Working with Parent in Action Handlers

Since `args.parent` is a `VirtualPersistentObject`, you can use its methods directly:

```typescript
handler: async (args) => {
    // Get an attribute
    const emailAttr = args.parent.getAttribute("Email");

    // Read attribute values (type-converted)
    const email = args.parent.getAttributeValue("Email");

    // Read from the attribute directly
    const age = emailAttr?.getValue();

    // Modify attribute values
    args.parent.setAttributeValue("Status", "Active");

    // Set via attribute directly
    emailAttr?.setValue("new@example.com");

    // Set validation errors
    if (!email?.includes("@"))
        args.parent.setValidationError("Email", "Invalid email format");

    // Clear validation errors (pass null or empty string)
    args.parent.setValidationError("Email", null);

    // Show notifications
    args.parent.setNotification("Saved successfully", "OK", 3000);
    args.parent.setNotification("Warning!", "Warning", 5000);
    args.parent.setNotification("Error occurred", "Error");

    return args.parent;
}
```

See [VirtualPersistentObject Methods](#virtualpersistentobject-methods) for the full list.

### Query Actions

Actions can operate on query results:

```typescript
service.registerCustomAction("BulkDelete", async (args) => {
    // Access selected items
    for (const item of args.selectedItems || []) {
        console.log(`Deleting item: ${item.id}`);
        // Use getValue to read column values
        const name = item.getValue("Name");
        console.log(`  Name: ${name}`);
    }

    return null; // Silent completion
});
```

**VirtualQueryResultItem methods:**

| Method | Description |
|--------|-------------|
| `getValue(columnName)` | Get a value from the item by column name |
| `query` | Reference to the parent VirtualQuery |
| `service` | Reference to the VirtualService instance |

## Lifecycle Hooks

### VirtualPersistentObjectActions

For complex scenarios, create a class extending `VirtualPersistentObjectActions`:

```typescript
import { VirtualPersistentObjectActions, VirtualQuery } from "@vidyano-labs/virtual-service";
import type { VirtualPersistentObject, VirtualPersistentObjectAttribute } from "@vidyano-labs/virtual-service";

class PersonActions extends VirtualPersistentObjectActions {
    // Called after the object is built
    onConstruct(obj: VirtualPersistentObject): void {
        obj.setAttributeValue("CreatedDate", new Date().toISOString());
    }

    // Called when loading an existing Person
    async onLoad(
        objectId: string,
        parent: VirtualPersistentObject | null
    ): Promise<VirtualPersistentObject> {
        const obj = await super.onLoad(objectId, parent);

        // Load additional data based on ID
        console.log(`Loading person: ${objectId}`);

        return obj;
    }

    // Called when creating a new Person via "New" action
    async onNew(
        parent: VirtualPersistentObject | null,
        query: VirtualQuery | null,
        parameters: Record<string, string> | null
    ): Promise<VirtualPersistentObject> {
        const obj = await super.onNew(parent, query, parameters);

        // Initialize new object
        obj.setAttributeValue("Status", "Draft");

        return obj;
    }

    // Called when saving
    async onSave(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
        // Calls checkRules, then saveNew or saveExisting based on obj.isNew
        return await super.onSave(obj);
    }

    // Called for new objects (protected)
    protected async saveNew(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
        obj.setAttributeValue("Id", crypto.randomUUID());
        return obj;
    }

    // Called for existing objects (protected)
    protected async saveExisting(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
        obj.setAttributeValue("ModifiedDate", new Date().toISOString());
        return obj;
    }
}

// Register with the actions class
service.registerPersistentObject({
    type: "Person",
    attributes: [
        { name: "FirstName", type: "String" },
        { name: "CreatedDate", type: "DateTime" },
        { name: "ModifiedDate", type: "DateTime" },
        { name: "Status", type: "String" }
    ]
}, PersonActions);
```

### Lifecycle Flow

```
PersistentObject Load:    onLoad (calls onConstruct internally)
PersistentObject New:     onNew (calls onConstruct internally)
PersistentObject Save:    onSave → checkRules → (saveNew | saveExisting)
Query Get:                onGetQuery (calls onConstructQuery internally)
Query Execution:          onExecuteQuery → getEntities
Attribute Refresh:        onRefresh
Reference Selection:      onSelectReference
Deletion:                 onDelete
```

### Refresh Handling

Handle attribute changes that trigger refresh:

```typescript
class OrderActions extends VirtualPersistentObjectActions {
    async onRefresh(
        obj: VirtualPersistentObject,
        attribute: VirtualPersistentObjectAttribute | undefined
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

```typescript
service.registerPersistentObject({
    type: "Order",
    attributes: [
        { name: "Quantity", type: "Int32", triggersRefresh: true },
        { name: "UnitPrice", type: "Decimal", triggersRefresh: true },
        { name: "Total", type: "Decimal", isReadOnly: true }
    ]
});
```

### Query Retrieval

Customize how queries are retrieved:

```typescript
class PersonActions extends VirtualPersistentObjectActions {
    // Called when a query is requested
    async onGetQuery(
        queryName: string,
        parent: VirtualPersistentObject | null
    ): Promise<VirtualQuery> {
        const query = await super.onGetQuery(queryName, parent);

        // Custom post-processing
        console.log(`Query ${queryName} loaded with ${query.totalItems} items`);

        return query;
    }
}
```

### Query Execution

Provide dynamic query data:

```typescript
class PersonActions extends VirtualPersistentObjectActions {
    private database: PersonData[] = [];

    // Provide data for query execution
    // Framework handles text search, sort, and pagination automatically
    async getEntities(
        query: VirtualQuery,
        parent: VirtualPersistentObject | null,
        data: Record<string, any>[]
    ): Promise<Record<string, any>[]> {
        // Return all entities - framework handles search/sort/pagination
        return this.database;
    }

    // Or fully control query execution
    async onExecuteQuery(
        query: VirtualQuery,
        parent: VirtualPersistentObject | null,
        data: Record<string, any>[]
    ): Promise<VirtualQueryExecuteResult> {
        // Custom query logic - you handle everything
        const results = this.database.filter(p => p.active);
        return { items: results, totalItems: results.length };
    }
}
```

### Reference Attributes

Handle reference attribute selection:

```typescript
class OrderActions extends VirtualPersistentObjectActions {
    async onSelectReference(
        parent: VirtualPersistentObject,
        referenceAttribute: VirtualPersistentObjectAttribute,
        query: VirtualQuery,
        selectedItem: VirtualQueryResultItem | null
    ): Promise<void> {
        // Default: sets objectId and value from displayAttribute
        await super.onSelectReference(parent, referenceAttribute, query, selectedItem);

        // Custom: also copy related fields
        if (selectedItem) {
            const customerName = selectedItem.getValue("Name");
            parent.setAttributeValue("CustomerName", customerName);
        }
    }
}
```

Configure reference attributes:

```typescript
// Customer PO and lookup query must be registered first
service.registerPersistentObject({
    type: "Customer",
    attributes: [
        { name: "Name", type: "String" },
        { name: "Email", type: "String" }
    ]
});

service.registerQuery({
    name: "AllCustomers",
    persistentObject: "Customer",
    data: [
        { Name: "Acme Corp", Email: "contact@acme.com" },
        { Name: "Globex", Email: "info@globex.com" }
    ]
});

// Now Order can reference the lookup query
service.registerPersistentObject({
    type: "Order",
    attributes: [
        { name: "OrderNumber", type: "String" },
        {
            name: "Customer",
            type: "Reference",
            lookup: "AllCustomers",        // References registered query
            displayAttribute: "Name"       // Column to display
        }
    ]
});
```

## State Behavior

Control how persistent objects behave after actions:

```typescript
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

```typescript
// 1. First register the detail PersistentObject
service.registerPersistentObject({
    type: "OrderLine",
    attributes: [
        { name: "Product", type: "String" },
        { name: "Quantity", type: "Int32" },
        { name: "Price", type: "Decimal" }
    ]
});

// 2. Then register the detail query
service.registerQuery({
    name: "OrderLines",
    persistentObject: "OrderLine"
});

// 3. Finally register the master PersistentObject with the query reference
service.registerPersistentObject({
    type: "Order",
    attributes: [
        { name: "OrderNumber", type: "String" },
        { name: "Total", type: "Decimal" }
    ],
    queries: ["OrderLines"]  // Attach query as detail
});
```

Access detail queries:

```typescript
const order = await service.getPersistentObject(null, "Order", "123");
const linesQuery = order.queries.find(q => q.name === "OrderLines");
await linesQuery.search();
```

### Detail Query Pre-Execution

By default, detail queries are pre-executed when the parent PersistentObject is loaded. This means the client immediately has access to the query results without needing to call `search()`.

You can control this behavior in `onConstruct` by setting `isIncludedInParentObject`:

```typescript
class OrderActions extends VirtualPersistentObjectActions {
    onConstruct(obj: VirtualPersistentObject): void {
        // Exclude OrderLines from being pre-executed (lazy load instead)
        const orderLinesQuery = obj.queries!.find(q => q.name === "OrderLines")!;
        orderLinesQuery.isIncludedInParentObject = false;
    }
}
```

**Behavior:**
- `isIncludedInParentObject = true` (default) - Query is executed before returning the PersistentObject; results are immediately available
- `isIncludedInParentObject = false` - Query is not pre-executed; client must call `search()` to load results

This is useful for optimizing performance when detail queries contain large datasets that aren't always needed immediately.

## VirtualPersistentObject Methods

The `VirtualPersistentObject` type provides these methods:

```typescript
async onSave(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
    // Get attribute by name
    const attr = obj.getAttribute("Email");

    // Get/set values
    const email = obj.getAttributeValue("Email");
    obj.setAttributeValue("Email", "new@example.com");

    // Validation errors (pass null/empty to clear)
    obj.setValidationError("Email", "Invalid format");
    obj.setValidationError("Email", null);  // Clear error

    // Access the service
    const message = obj.service.getMessage("CustomKey");

    // Notifications
    obj.setNotification("Saved!", "OK", 3000);

    return obj;
}
```

**VirtualPersistentObject methods:**

| Method | Description |
|--------|-------------|
| `getAttribute(name)` | Get attribute by name |
| `getAttributeValue<T>(name)` | Get attribute value |
| `setAttributeValue<T>(name, value)` | Set attribute value |
| `setValidationError(name, error)` | Set validation error (pass `null`/empty to clear) |
| `setNotification(msg, type, duration?)` | Set notification |
| `service` | Reference to the VirtualService instance |

**VirtualPersistentObjectAttribute methods:**

| Method | Description |
|--------|-------------|
| `getValue<T>()` | Get value |
| `setValue<T>(value)` | Set value |
| `setValidationError(error)` | Set validation error (pass `null`/empty to clear) |
| `persistentObject` | Reference to the parent VirtualPersistentObject |
| `service` | Reference to the VirtualService instance |


## Testing Examples

### Unit Test Example

```typescript
import { test, expect } from "@playwright/test";
import { VirtualService } from "@vidyano-labs/virtual-service";

test("validates email format", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Contact",
        attributes: [
            { name: "Email", type: "String", rules: "IsEmail" }
        ]
    });

    await service.initialize();

    const contact = await service.getPersistentObject(null, "Contact", null, true);
    contact.getAttribute("Email").setValue("not-an-email");

    await contact.save();

    expect(contact.getAttribute("Email").validationError).toBe("Email format is invalid");
});
```

### Integration Test Example

```typescript
import { test, expect } from "@playwright/test";
import { VirtualService } from "@vidyano-labs/virtual-service";

test("complete order workflow", async () => {
    const service = new VirtualService();

    service.registerCustomAction("Submit", async (args) => {
        args.parent.setAttributeValue("Status", "Submitted");
        return args.parent;
    });

    service.registerCustomAction("Approve", async (args) => {
        const status = args.parent.getAttributeValue("Status");
        if (status !== "Submitted") {
            args.parent.setNotification("Order must be submitted first", "Error");
            return args.parent;
        }
        args.parent.setAttributeValue("Status", "Approved");
        return args.parent;
    });

    service.registerPersistentObject({
        type: "Order",
        attributes: [
            { name: "Status", type: "String", value: "Draft" },
            { name: "Total", type: "Decimal", value: "0" }
        ],
        actions: ["Submit", "Approve"]  // Actions must be listed here
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

```typescript
import { test, expect } from "@playwright/test";
import { VirtualService } from "@vidyano-labs/virtual-service";

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
    query.sortOptions = [{ name: "Age", direction: "ASC" }];
    await query.search();
    items = await query.items.toArrayAsync();
    expect(items[0].values.Name).toBe("Bob"); // Youngest first
});
```

## API Reference

### VirtualService

| Method | Description |
|--------|-------------|
| `constructor(hooks?)` | Create service with optional custom hooks |
| `registerPersistentObject(config, actionsClass?)` | Register a PersistentObject type with optional lifecycle class |
| `registerQuery(config)` | Register a Query |
| `registerCustomAction(name, handler)` | Register a custom action (simple) |
| `registerCustomAction(config, handler)` | Register a custom action (with config) |
| `registerBusinessRule(name, validator)` | Register a validation rule |
| `getMessage(key, ...params)` | Get a formatted message by key |
| `initialize()` | Finalize registrations |

| Static Property | Description |
|-----------------|-------------|
| `VirtualService.messages` | Get/set the global messages dictionary for translations |

### VirtualPersistentObjectActions

| Method | Description |
|--------|-------------|
| `onConstruct(obj: VirtualPersistentObject)` | Called after the object is built (synchronous) |
| `onLoad(objectId: string, parent)` | Called when loading an existing object - call `super.onLoad()` to build |
| `onNew(parent, query: VirtualQuery, params)` | Called when creating a new object - call `super.onNew()` to build |
| `onGetQuery(queryName: string, parent)` | Called when retrieving a query - call `super.onGetQuery()` to build |
| `onSave(obj)` | Called when saving (calls checkRules, then saveNew/saveExisting) |
| `checkRules(obj)` | Validates attributes against rules (overridable) |
| `saveNew(obj)` | Called for new objects (protected) |
| `saveExisting(obj)` | Called for existing objects (protected) |
| `onRefresh(obj, attribute: VirtualPersistentObjectAttribute)` | Called when refreshing |
| `onDelete(parent, query: VirtualQuery, items: VirtualQueryResultItem[])` | Called when deleting items |
| `onConstructQuery(query: VirtualQuery, parent)` | Called after query is built (synchronous) |
| `onExecuteQuery(query: VirtualQuery, parent, data)` | Called when executing a query |
| `getEntities(query: VirtualQuery, parent, data)` | Provide query data |
| `onSelectReference(parent, attr: VirtualPersistentObjectAttribute, query: VirtualQuery, item: VirtualQueryResultItem)` | Called when selecting a reference |

## Best Practices

- **Register in order** - PersistentObjects first, then Queries, then initialize
- **Use lifecycle hooks** - Prefer `VirtualPersistentObjectActions` for complex logic over inline handlers
- **Validate early** - Use built-in rules for common validations, custom rules for domain-specific
- **Test comprehensively** - Cover validation, actions, queries, and edge cases
- **Keep data realistic** - Use production-like test data to catch real issues
- **Leverage type safety** - Use `getValue()` for type-safe value access
- **Handle null values** - Check for null/undefined, especially in calculations

## License

MIT
