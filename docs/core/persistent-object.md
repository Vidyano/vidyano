# Persistent Objects

## Loading an Existing Object

There are two ways to load a persistent object:

1. **Directly from the service** - when you know the type and ID:

```ts
import { Service, type PersistentObject } from '@vidyano/core';

// Initialize and sign in to the service
const service = new Service("http://localhost:5000");
await service.initialize();
await service.signInUsingCredentials("admin", "admin");

// Load a specific person by ID
// Note: In practice, you would get the ID from a query or other source
const person = await service.getPersistentObject(null, "Person", "4321");

console.log(`Loaded person: ${person.breadcrumb}`);
console.log(`Person name: ${person.getAttributeValue('FirstName')} ${person.getAttributeValue('LastName')}`);
```

2. **From a query result item**:

```ts
// First, get a query with some results
const peopleQuery = await service.getQuery('People');

// Get the first item and load it as a persistent object
const firstItem = await peopleQuery.items.atAsync(0);
if (firstItem) {
    const person = await firstItem.getPersistentObject();
    console.log(`Loaded: ${person.breadcrumb}`);
}
```

## Creating a New Object

New objects are typically created through Query actions:

```ts
// Get the people query
const peopleQuery = await service.getQuery('People');

// Execute the 'New' action to create a new person
const newAction = peopleQuery.getAction('New');
if (newAction?.canExecute) {
    const newPerson = await newAction.execute();

    console.log(`New person created`);
    console.log(`Is new: ${newPerson.isNew}`);
    console.log(`Is editing: ${newPerson.isEditing}`); // Automatically in edit mode

    // We can then save the object with the Save action
    const saveAction = newPerson.getAction('Save');
    if (saveAction?.canExecute) {
        try {
            await saveAction.execute();
            console.log(`New person saved`);

            // Note: After saving, the Object Id will have been set,
            // but if you need the newly created entity, you should load it again from the service
            const objectId = newPerson.objectId;
            if (objectId) {
                const savedPerson = await service.getPersistentObject(null, "Person", objectId);
                console.log(`Loaded saved person with ID: ${savedPerson.objectId}`);
            }
        } catch (error) {
            console.error('Save failed:', error);
        }
    }
}
```

## Understanding Object States

Persistent Objects have several important state properties:

| Property     | Type    | Description                                            |
| ------------ | ------- | ------------------------------------------------------ |
| `isNew`      | boolean | True for newly created objects that haven't been saved |
| `isEditing`  | boolean | True when the object is in edit mode                   |
| `isDirty`    | boolean | True when the object has unsaved changes               |
| `isReadOnly` | boolean | True if the object cannot be edited                    |
| `isFrozen`   | boolean | True when the object is frozen (immutable)             |

## Working with Attributes

Persistent Objects contain attributes that represent the fields and properties of your data. For comprehensive documentation on working with attributes, including reading values, modifying data, validation, and refresh behavior, see [Persistent Object Attribute](./persistent-object-attribute.md).

## Editing and Saving

### Edit Mode Management

When you begin editing, the current state is saved internally so changes can be reverted if needed.
> Note: New objects (`isNew === true`) are automatically in edit mode and don't require `beginEdit()`.

**Option 1: Save changes**

```ts
// Start editing - creates an internal backup of current values
person.beginEdit();

// Make changes
await person.setAttributeValue('FirstName', 'Jane');
await person.setAttributeValue('LastName', 'Doe');
await person.setAttributeValue('Email', 'jane@example.com');

// Save changes
try {
    await person.save();
    
    console.log('Changes saved successfully');
    console.log(`Is editing: ${person.isEditing}`); // Now false
    console.log(`Is dirty: ${person.isDirty}`); // Now false
} catch (error) {
    console.error('Save failed:', error);
}
```

**Option 2: Cancel changes**

```ts
// Start editing - creates an internal backup of current values
person.beginEdit();

// Make changes
await person.setAttributeValue('FirstName', 'Jane');
await person.setAttributeValue('LastName', 'Doe');
await person.setAttributeValue('Email', 'jane@example.com');

// Cancel changes
person.cancelEdit();
// All changes are reverted to original values from before beginEdit()
// The object returns to non-editing state with isDirty = false
```

### Handling Save Errors

The `save()` method throws exceptions by default when errors occur. You have two options for error handling:

**Option 1: Using try-catch (default behavior)**

```ts
try {
    const success = await person.save();
    console.log('Save successful');
} catch (error) {
    // Error is thrown when notificationType is "Error"
    console.error('Save failed:', error);
    
    // Check individual attribute errors
    person.attributes.forEach(attr => {
        if (attr.validationError) {
            console.error(`${attr.label}: ${attr.validationError}`);
        }
    });
}
```

**Option 2: Disable exceptions**

```ts
const success = await person.save({ throwExceptions: false });
if (success) {
    console.log('Save successful');
} else {
    // Save failed - check the notification for details
    if (person.notification) {
        console.error(`${person.notificationType}: ${person.notification}`);
    }
    
    // Check individual attribute errors
    person.attributes.forEach(attr => {
        if (attr.validationError) {
            console.error(`${attr.label}: ${attr.validationError}`);
        }
    });
}
```

### Understanding the Save Process

When you save:

1. Attributes marked with `triggersRefresh` are refreshed first, provided they still have a refresh pending.
2. Data is sent to the server
3. Server performs validation and business logic
4. Response updates the object with new values, errors, or notifications
5. If successful, edit mode ends (unless `stateBehavior` keeps it in edit)

## Detail Queries

Persistent Objects can contain related queries (`Query`) that represent collections of associated detail data. These are accessible through the `queries` property, which functions as both an array and a dictionary indexed by query name.

```ts
// Access all detail queries as an array
person.queries.forEach(query => {
    console.log(`Query: ${query.name}`);
    console.log(`Total items: ${query.totalItems}`);
});

// Direct access by query name via the dictionary
const addressesQuery = person.queries.Person_Addresses;
// or using the getQuery method
// const addressesQuery = person.getQuery('Person_Addresses');

// Check if a specific query exists
if (addressesQuery) {
    // Work with the addresses query
    await addressesQuery.search();
    console.log(`Found ${addressesQuery.totalItems} addresses`);
    
    // Access address items (each has Street, City, ZipCode, Country, State)
    const addresses = await addressesQuery.getItemsByIndex(0, 10);
    addresses.forEach(address => {
        const street = address.getAttributeValue('Street');
        const city = address.getAttributeValue('City');
        const zipCode = address.getAttributeValue('ZipCode');
        const country = address.getAttributeValue('Country');

        console.log(`Address: ${street}, ${city}, ${zipCode}, ${country}`);
    });
}
```

These queries automatically maintain their relationship with the parent PersistentObject and will be refreshed when specified by `queriesToRefresh` during save operations.

For more information on working with queries, see [Query](./query.md).

## Tabs and Groups

Persistent Objects organize attributes into tabs and groups:

```ts
// Access tabs
person.tabs.forEach(tab => {
    console.log(`Tab: ${tab.label}`);

    if (tab instanceof PersistentObjectAttributeTab) {
        // Attribute tab with groups
        tab.groups.forEach(group => {
            console.log(`  Group: ${group.label || '(Default)'}`);
            group.attributes.forEach(attr => {
                console.log(`    - ${attr.label}: ${attr.value}`);
            });
        });
    } else if (tab instanceof PersistentObjectQueryTab) {
        // Query tab
        console.log(`  Query: ${tab.query.label}`);
    }
});
```

## Persistent Object Actions

Persistent Objects can have associated actions:

```ts
// Get available actions
const actions = person.actions;

const sendEmailAction = person.getAction('SendEmail');

// Execute an action
if (sendEmailAction?.canExecute) {
    try {
        // Execute the action, and handle exceptions instead of the default behavior where the exception is set on the notification
        const result = await sendEmailAction.execute({ throwExceptions: true });
        // Action executed successfully, handle the result if needed
    } catch (error) {
        console.error('Action failed:', error);
    }
}
```

## Advanced Patterns

### Freezing and Unfreezing Objects

The `freeze()` and `unfreeze()` methods allow you to temporarily make an object immutable:

```ts
// Freeze an object to prevent modifications
person.freeze();
console.log(`Is frozen: ${person.isFrozen}`); // true

// While frozen, setValue silently returns the current value without changing it
const originalValue = person.getAttributeValue('FirstName');
const result = await person.setAttributeValue('FirstName', 'NewName');
console.log(`setValue returned: ${result}`); // Returns the current value unchanged
console.log(`FirstName is still: ${person.getAttributeValue('FirstName')}`); // Original value

// Unfreeze to allow modifications again
person.unfreeze();
console.log(`Is frozen: ${person.isFrozen}`); // false

// Now modifications work normally
await person.setAttributeValue('FirstName', 'NewName'); // Success
console.log(`FirstName updated to: ${person.getAttributeValue('FirstName')}`); // NewName
```

Freezing is useful for:

- Preventing accidental modifications during async operations
- Ensuring data consistency while displaying in read-only views
- Temporarily locking objects during complex business logic

### Related Topics

- [Persistent Object Attribute](./persistent-object-attribute.md)
