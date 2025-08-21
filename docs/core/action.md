# Action

## Basic Action Execution

```ts
import { Service } from "@vidyano/core";

// Initialize service and sign in
const service = new Service("http://localhost:5000");
await service.initialize(true);
await service.signInUsingCredentials("admin", "admin");

// Load a query and execute an action
const peopleQuery = await service.getQuery('People');
const testCountAction = peopleQuery.getAction('TestCount');
if (testCountAction?.canExecute) {
    await testCountAction.execute();
}
```

## Core Concepts

```ts
import { Action } from "@vidyano/core";
```

### Action Structure

An `Action` represents an executable operation in Vidyano. Actions consist of:

- **Name**: The internal identifier used to reference the action
- **Display Name**: The localized label shown to users
- **State Properties**: Runtime state like `canExecute`, `isVisible`, `isBusy`
- **Selection Rules**: Define how many items must be selected
- **Confirmation**: Whether user confirmation is required before execution

### Action Types

Actions are available on two types of objects:

1. **Query**: Operate on query results items
2. **PersistentObject**: Operate on individual objects

## Working with Actions

### Accessing Actions

```ts
// Get a specific action by name
const deleteActionByName = persistentObject.getAction("Delete");

// Direct property access
const deleteActionDirect = persistentObject.actions.Delete;

// Iterate all actions
for (const action of persistentObject.actions) {
    console.log(action.name, action.isVisible, action.canExecute);
}

// Filter actions by criteria
const pinnedActions = persistentObject.actions.filter(a => a.isPinned);
```

### Checking Action State

Always verify an action's state before execution:

```ts
const deleteAction = peopleQuery.getAction("Delete");

if (deleteAction?.canExecute) {
    await deleteAction.execute({
        selectedItems: await peopleQuery.items.sliceAsync(0, 2) // Select first two items
    });
}
```

### Action Properties

Key properties available on every action:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Internal identifier used to reference the action |
| `displayName` | string | Localized label shown to users |
| `icon` | string \| null | Icon identifier for UI display |
| `options` | string[] \| null | Available execution options/menu items |
| `isVisible` | boolean | Whether the action should be shown in UI |
| `canExecute` | boolean | Whether the action can currently be executed |
| `isPinned` | boolean | Whether the action is pinned to toolbar |
| `isBusy` | boolean | Whether the action is currently executing |
| `confirmation` | string \| null | Confirmation type required (e.g., "OK", "YesNo") |
| `selectionRule` | Function \| null | Function that evaluates item selection requirements |

```ts
const action = persistentObject.getAction("Submit");

// Access properties
console.log(action.name);          // "Submit"
console.log(action.displayName);   // "Submit for Approval"
console.log(action.canExecute);    // true/false
```

## Executing Actions

### Basic Execution

```ts
// Simple execution without parameters
const testCountAction = query.getAction("TestCount");
await testCountAction.execute();

// Execution with selected items
const deleteAction = query.getAction("Delete");
const [item1, item2] = await query.getItemsByIndex(0, 1);
item1.isSelected = true;
item2.isSelected = true;
await deleteAction.execute();

// Execution with menu option
const testOptionsAction = query.getAction("TestOptions");
await testOptionsAction.execute({
    menuOption: 0,  // Select "Option 1"
    parameters: {
        customData: "value"
    }
});
```

### Handling Execution Results

Actions return a PersistentObject or null:

```ts
try {
    const result = await action.execute();
    
    if (result instanceof PersistentObject) {
        // Action returned a new/modified object
        console.log("Object returned:", result.breadcrumb);
    } else if (result === null) {
        // Action completed but returned no object
        // (e.g., Delete, Refresh, or action with notification)
        console.log("Action completed");
    }
} catch (error) {
    console.error("Action failed:", error);
    
    // Check for server notification
    if (persistentObject.notification) {
        console.error("Server error:", persistentObject.notification);
    }
}
```

### Action Confirmation

Some actions require user confirmation:

```ts
const deleteAction = persistentObject.getAction("Delete");

// Check if confirmation is required
if (deleteAction.confirmation) {
    console.log("Confirmation type:", deleteAction.confirmation);
    // Types: "OK", "OKCancel", "YesNo", "YesNoCancel"
}

// Customize confirmation handling via ServiceHooks
class MyServiceHooks extends ServiceHooks {
    async onActionConfirmation(action: Action, option: number): Promise<boolean> {
        if (action.name === "Delete") {
            return await confirm(`Delete this ${action.parent.type}?`);
        }

        return false;
    }
}
```

## Selection Rules

Actions on queries can define rules that determine whether they can be executed based on the number of items selected. The `selectionRule` property is a function (`(count: number) => boolean`) that evaluates these rules internally.

You do not need to call this function directly. Instead, the `action.canExecute` property automatically updates whenever the selection changes, reflecting the current validity of the action.

Here are the common selection rule behaviors:

-   **None**: No items are required. The action is always executable regardless of selection.
-   **Single**: Exactly one item must be selected.
-   **AtLeastOne**: One or more items must be selected.
-   **AtLeastTwo**: Two or more items must be selected.
-   **MultipleOrNone**: Any number of items can be selected, including none.

### Correct Usage

Instead of checking `selectionRule` directly, you should always check the `canExecute` property, which automatically evaluates the selection rule and other conditions.

```ts
const peopleQuery = await service.getQuery("People");

// Example 1: Backend defined the selection rule as >0 (e.g., Delete)
const deleteAction = peopleQuery.getAction("Delete");

// With 0 items selected
console.log(`Can execute Delete with 0 items? ${deleteAction.canExecute}`); // false

// Select one item
const [person1, person2] = await peopleQuery.getItemsByIndex(0, 1);
person1.isSelected = true;
console.log(`Can execute Delete with 1 item? ${deleteAction.canExecute}`); // true

// Example 2: Backend defined the selection rule as 1 (e.g., TestCountSingle)
const singleAction = peopleQuery.getAction("TestCountSingle");

// With 1 item selected
console.log(`Can execute TestCountSingle with 1 item? ${singleAction.canExecute}`); // true

// Select a second item
person2.isSelected = true;
console.log(`Can execute TestCountSingle with 2 items? ${singleAction.canExecute}`); // false

// To execute, ensure the condition is met
if (singleAction.canExecute) {
    // This block will not be reached with 2 items selected
    await singleAction.execute();
} else {
    // Unselect one item to meet the rule
    person2.isSelected = false;
    if (singleAction.canExecute) {
        console.log("Now executing TestCountSingle...");
        // await singleAction.execute();
    }
}
```

## Action Options

Actions can provide multiple options:

```ts
const testOptionsAction = query.getAction("TestOptions");

// TestOptions has two menu options: "Option 1" and "Option 2"
// Execute with specific option
try {
    await testOptionsAction.execute({ 
        menuOption: 0  // Select "Option 1"
    });
    // Returns: {"MenuOption":"0","MenuLabel":"Option 1"}
} catch (error) {
    // Throws "Option is required" if menuOption not provided
    console.error(query.notification); // "Option is required"
}
```

## Action Dependencies

Action availability changes based on object state:

```ts
const person = await service.getPersistentObject(null, "Person", personId);

// Before editing
console.log("Can EndEdit:", person.actions.EndEdit?.canExecute);        // false
console.log("Can CancelEdit:", person.actions.CancelEdit?.canExecute);  // false

// Start editing
person.beginEdit();

// After entering edit mode
console.log("Can EndEdit:", person.actions.EndEdit?.canExecute);        // true
console.log("Can CancelEdit:", person.actions.CancelEdit?.canExecute);  // true

// Make changes
person.getAttribute("Email").value = "new@example.com";

// Object is now dirty
console.log("Is Dirty:", person.isDirty);                        // true
```

## Action Groups

Actions can be organized into groups for better organization in the UI.

```ts
const persistentObject = await service.getPersistentObject(null, "Dev.Order", orderId);

// Test actions are grouped under "TestActionsGroup"
const testActions = peopleQuery.actions.filter(a => 
    a.name.startsWith("TestCount")
);

testActions.forEach(action => {
    console.log(action.group?.definition.name); // "TestActionsGroup"
});

// Access all action groups
const groups = peopleQuery.actionGroups;
groups.forEach(group => {
    console.log(`Group: ${group.name}`);
    group.actions.forEach(action => {
        console.log(`  - ${action.displayName}`);
    });
});
```

## Pinned Actions

Quick-access actions typically shown in toolbars:

```ts
// Get all pinned actions
const pinnedActions = persistentObject.actions.filter(a => a.isPinned);

// Separate pinned from regular actions
const regularActions = persistentObject.actions.filter(a => !a.isPinned);
```

## Error Handling

Comprehensive error handling pattern:

```ts
async function safeExecuteAction(action: Action, options?: any) {
    if (!action?.canExecute) {
        return { success: false, error: "Action not available" };
    }
    
    try {
        const result = await action.execute(options);
        return { success: true, result };
    } catch (error) {
        console.error(`Action ${action.name} failed:`, error);
        
        // Check for server notification
        const notification = action.parent?.notification;
        if (notification) {
            return { 
                success: false, 
                error: notification.message || notification 
            };
        }
        
        return { 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
        };
    }
}
```

## Best Practices

1. **Always check action availability** before execution
2. **Handle errors gracefully** with try-catch blocks
3. **Respect selection rules** when executing query actions
4. **Provide user feedback** during long-running actions
5. **Use TypeScript types** for better type safety
6. **Check object notifications** after action execution for server messages
7. **Set item.isSelected = true** before executing actions with selection requirements

## Related Topics

- [Persistent Object](./persistent-object.md)
- [Query](./query.md)
- [Getting Started](./getting-started.md)