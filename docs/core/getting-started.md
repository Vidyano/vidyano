# Getting Started

## Installation

Install the latest version of the `@vidyano/core` package using npm:

```bash
npm install @vidyano/core
```

## Connecting to a Vidyano backend

To start using Vidyano, you need to connect to a Vidyano backend service. This is done by creating an instance of the `Service` class and initializing it with the backend URL.

### Step 1: Initialize the Service

After creating a `Service` instance, you must call `initialize()` to retrieve preliminary configuration data from the backend. This includes details such as the set of available languages and the list of supported authentication providers.

```ts
import { Service, Query, PersistentObject } from "@vidyano/core";

// Create a new Service instance, pointing to your Vidyano backend API.
const service = new Service("https://your-backend-url/api");

try {
    // Initialize the service. This is the first call you should always make.
    await service.initialize();
    console.log("Service initialized successfully.");
} catch (error) {
    console.error("Failed to initialize service:", error);
}
```

### Step 2: Sign In

Although the backend might allow anonymous access, most operations require user authentication. After initializing, you can sign in with user credentials. A successful sign-in returns an `Application` object, which contains user-specific data and navigation routes for when you are building a user interface.

```ts
if (!service.isSignedIn) {
    try {
        const application = await service.signInUsingCredentials("demo", "demo");
        console.log(`Sign-in successful! Welcome, ${application.friendlyUserName}.`);
    } catch (error) {
        console.error("Sign-in failed:", error);
    }
} else {
    console.log("Already signed in.");
}
```

### Step 3: Fetch a List of Data (Query)

Queries are used to fetch collections of data, like a list of people or products. You can retrieve a query by its unique name or ID, which is defined in your Vidyano backend model.

#### Async Iteration

Vidyano uses intelligent **lazy loading** to handle large datasets efficiently. Query items are fetched from the server on-demand as you iterate through them, making it perfect for processing large collections without overwhelming memory or network bandwidth.

The recommended way to iterate through query items is using **async iteration** with `for await...of`, which automatically handles lazy loading:

```ts
import { Query } from "@vidyano/core";

try {
    // Get the "People" query by its name from the backend.
    const peopleQuery = await service.getQuery("People");
    console.log(`Query "${peopleQuery.label}" has ${peopleQuery.totalItems} items.`);
    
    // Iterate through all items using async iteration - items are loaded automatically
    console.log("Processing people...");
    for await (const personItem of peopleQuery.items) {
        const firstName = personItem.getValue("FirstName");
        const lastName = personItem.getValue("LastName");
        const email = personItem.getValue("Email");
        console.log(`- ${firstName} ${lastName} (${email})`);
    }

} catch (error) {
    console.error("Failed to get or process the 'People' query:", error);
}
```

The `query.items` property also provides async helper methods like `mapAsync`, `filterAsync`, `forEachAsync`, `toArrayAsync`, and `sliceAsync` for more complex operations. Learn more about these and other advanced patterns in [Query](./query.md).

### Step 4: Load a Specific Object (PersistentObject)

A `QueryResultItem` from a query is a lightweight read-only representation of an object. To work with the full data and capabilities of a `PersistentObject`, you need to load it using the `getPersistentObject()` method.

#### 4.1. From a Query Result Item

> Note: Because queries use lazy loading, always obtain items with `getItemsByIndex()` rather than direct array access.

The easiest way to load a `PersistentObject` is from an item in a query result.

```ts
// Safely load the first item as a PersistentObject using lazy-loading aware APIs
const [firstPersonItem] = await peopleQuery.getItemsByIndex(0);
if (firstPersonItem) {
    console.log(`Loading full details for person with ID: ${firstPersonItem.id}`);
    try {
        const personObject = await firstPersonItem.getPersistentObject();
        console.log(`Successfully loaded PersistentObject: ${personObject.breadcrumb}`);
    } catch (error) {
        console.error("Failed to load persistent object from query item:", error);
    }
} else {
    console.log("No people to load.");
}
```

#### 4.2. Directly by ID

If you know an object's type and its unique ID, you can load it directly without fetching a query first.

```ts
// These IDs are defined in your backend Vidyano model.
const personTypeId = "Person";
const specificPersonId = "12345"; // Example person ID

try {
    const specificPerson = await service.getPersistentObject(null, personTypeId, specificPersonId);
    console.log(`Directly loaded person: ${specificPerson.breadcrumb}`);
} catch (error) {
    console.error(`Failed to load person with ID ${specificPersonId}:`, error);
}
```

### Step 5: Edit and Save an Object

Now that you have a `PersistentObject`, you can modify its data. The flow is:
1.  Enter edit mode.
2.  Change attribute values.
3.  Save the changes.

```ts
if (personObject) {
    // 1. This step puts the object into edit mode, making its attributes writable.
    personObject.beginEdit();
    console.log(`Is the object in edit mode? ${personObject.isEditing}`);

    // 2. Get the attribute and change its value.
    const emailAttribute = personObject.getAttribute("Email");
    const oldEmail = emailAttribute.value;
    const newEmail = "newemail@example.com";
    
    // Setting the value marks the attribute and the parent object as dirty.
    emailAttribute.value = newEmail;

    console.log(`Email changed from "${oldEmail}" to "${emailAttribute.value}".`);
    console.log(`Is the object dirty? ${personObject.isDirty}`);

    // 3. Save the changes back to the backend.
    try {
        const wasSaved = await personObject.save();
        if (wasSaved) {
            console.log("Person saved successfully!");
        } else {
            // A save can fail due to validation rules on the backend.
            // The error message is automatically placed in the object's 'notification' property.
            console.error(`Failed to save. Reason: ${personObject.notification}`);
        }
    } catch (error) {
        console.error("An unexpected error occurred during save:", error);
    }
} else {
    console.log("No person object loaded to edit.");
}
```

### Step 6: Executing an Action

Actions are the heart of user interaction in Vidyano. They represent commands you can run, like "Save," "Delete," "New," or custom business operations. Actions can be attached to both individual `PersistentObject` instances and entire `Query` lists.

All actions are found in the `.actions` property of the object and can be executed with the `.execute()` method.

#### 6.1. Actions on a PersistentObject

Actions on a PersistentObject usually trigger an operation on the server that affects that specific object. The server processes the request and typically sends back the updated object data, which the client then uses to refresh its state automatically.

Let's imagine our Person object has a custom action called "SendWelcomeEmail" that sends a welcome message to the person and updates their status.

```ts
// Assume 'personObject' is an existing PersistentObject that we have loaded.
if (personObject) {
    // 1. Check if the person has already been welcomed
    const welcomedAttribute = personObject.getAttribute("HasBeenWelcomed");
    const emailAttribute = personObject.getAttribute("Email");
    
    if (!welcomedAttribute?.value && emailAttribute?.value) {
        console.log(`Preparing to send welcome email to: ${emailAttribute.value}`);
        
        // 2. Get the "SendWelcomeEmail" action from the object's action list.
        // You can do this in two ways:
        const sendWelcomeAction = personObject.getAction("SendWelcomeEmail");
        // or
        // const sendWelcomeAction = personObject.actions.SendWelcomeEmail;

        if (sendWelcomeAction && sendWelcomeAction.canExecute) {
            // 3. Execute the action. This sends a request to the server.
            console.log("Sending welcome email...");
            await sendWelcomeAction.execute();

            // After the action completes, our 'personObject' is automatically
            // refreshed with the data returned from the server.
            console.log("Welcome email sent successfully!");
            console.log(`Welcome status updated: ${welcomedAttribute?.value}`);
        } else {
            console.log("The 'SendWelcomeEmail' action is not available or cannot be executed.");
        }
    } else {
        console.log("Person has already been welcomed or has no email address.");
    }
}
```

#### 6.2. Actions on a Query

Actions on a `Query` can create new items (e.g., "New") or operate on one or more items from the list (e.g., "Delete").
To specify which items an action should operate on, you pass them directly in the `execute` method's `selectedItems` option.

Let's find inactive people and delete them:

```ts
// Find all inactive people using async filtering
const inactivePeople = await peopleQuery.items.filterAsync(
    person => person.getValue("IsActive") === false
);

if (inactivePeople.length > 0) {
    console.log(`Found ${inactivePeople.length} inactive people to delete`);
    
    // Get the "Delete" action from the query's action list
    const deleteAction = peopleQuery.actions.Delete;
    
    if (deleteAction) {
        console.log(`Total items before delete: ${peopleQuery.totalItems}`);
        
        // Execute the action on all inactive people
        await deleteAction.execute({ selectedItems: inactivePeople });
        
        console.log("Delete action executed.");
        console.log(`Total items after delete: ${peopleQuery.totalItems}`);
    } else {
        console.log("Delete action not available on this query.");
    }
}

// Or delete a specific item by index
const [itemToDelete] = await peopleQuery.getItemsByIndex(1);
if (itemToDelete && peopleQuery.actions.Delete) {
    await peopleQuery.actions.Delete.execute({ selectedItems: [itemToDelete] });
}
```

## Related Topics

- [Query](./query.md)
- [Persistent Object](./persistent-object.md)