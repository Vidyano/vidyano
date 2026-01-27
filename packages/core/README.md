# Vidyano core client library

The `@vidyano/core` library is the core client-side JavaScript/TypeScript foundation for building web applications that interact with a Vidyano backend. It provides a rich set of classes and utilities to manage data, actions, queries, application state, and UI reactivity.

## Key Features

*   **Service Interaction:** Robust `Service` class for authentication, fetching and managing `PersistentObject` and `Query` data, and executing backend `Action`s.
*   **Application Structure:**
    *   `Application`: Represents the overall application state, user information, global settings, and navigation structure (via `ProgramUnit`).
*   **Data Modeling:**
    *   `PersistentObject`: Represents a backend entity, supporting CRUD-like operations, validation, and state management (e.g., edit mode, dirty tracking).
    *   `PersistentObjectAttribute`: Defines a property of a `PersistentObject`, with specialized types like `PersistentObjectAttributeWithReference` (for lookups/references) and `PersistentObjectAttributeAsDetail` (for in-place master-detail relationships).
    *   `Query`: Fetches a list of data from the backend, supporting pagination, sorting, filtering, grouping, and text search.
    *   `QueryResultItem`: Represents an individual record within the result set of a `Query`.
*   **Action System:**
    *   `Action`: Is used to execute an operation on a `PersistentObject` or `Query`.
*   **Reactivity & State Management:**
    *   `Observable`, `Subject`, `PropertyChangedArgs`, `ArrayChangedArgs`: A built-in reactive system to notify UI components of data changes.
*   **Extensibility:**
    *   `ServiceHooks`: Provides extensive hooks to customize nearly every aspect of the library's behavior, from data construction and network requests to UI interactions like dialogs, notifications, and navigation.

## Installation

```bash
npm install @vidyano/core
```

## Prerequisites

This library is designed to work with a Vidyano backend.

## Usage

### 1. Initializing the Service

The Service class is your main entry point.

```ts
import { Service, ServiceHooks, NotificationType } from '@vidyano/core';

// Optionally, create custom service hooks
class MyHooks extends ServiceHooks {
    // Override methods to customize behavior
    onShowNotification(notification: string, type: NotificationType, duration?: number) {
        // Implement your UI notification logic (e.g., using a toast library)
        console.log(`[${type}] ${notification} (for ${duration || 'default'}ms)`);
    }
}

const service = new Service("https://your-vidyano-backend.com/", new MyHooks());

async function initializeApp() {
    try {
        await service.initialize();
        if (service.isSignedIn) {
            const app = service.application;
            console.log(`Welcome, ${app.friendlyUserName}!`);
            // Application is ready, proceed with UI rendering or loading initial views
        } else {
            // Handle sign-in (e.g., show login form or redirect)
            await service.signInUsingCredentials("demoUser", "demoPassword");
            console.log("Signed in successfully!");
            // Reload or re-initialize parts of your app
        }
    } catch (error) {
        console.error("Initialization or Login failed:", error);
        // Handle errors, e.g., show an error message to the user
    }
}

initializeApp();
```

### 2. Working with a Persistent Object (PO)

PersistentObject represents an entity from your backend.

```ts
import { PersistentObject } from '@vidyano/core';

async function loadAndEditUserProfile(userId: string) {
    if (!service.application || !service.isSignedIn) {
        console.warn("Service not initialized or user not signed in.");
        return;
    }

    try {
        // Assuming "UserProfile" is the type name of your PO and userId is its ID
        const userProfilePo: PersistentObject = await service.getPersistentObject(null, "UserProfile", userId);
        console.log("User Profile loaded:", userProfilePo.label);

        // Subscribe to property changes (e.g., to enable/disable a save button)
        const disposer = userProfilePo.propertyChanged.attach((sender, args) => {
            if (args.propertyName === "isDirty") {
                console.log(`User Profile isDirty: ${args.newValue}`);
                // Update UI accordingly
            }
        });

        userProfilePo.beginEdit(); // Enter edit mode

        // Set an attribute value. This might trigger validation or dependent attribute refreshes.
        await userProfilePo.setAttributeValue("EmailAddress", "new.email@example.com");

        if (userProfilePo.isDirty) {
            const saveAction = userProfilePo.getAction("Save") || userProfilePo.getAction("EndEdit");
            if (saveAction && saveAction.canExecute) {
                const resultPo = await saveAction.execute(); // `save()` method also exists
                if (userProfilePo.notificationType !== "Error") {
                     console.log("User Profile saved!", resultPo?.label);
                } else {
                    console.error("Save failed:", userProfilePo.notification);
                    userProfilePo.cancelEdit(); // Revert changes
                }
            }
        } else {
            userProfilePo.cancelEdit(); // Exit edit mode if no changes were made
        }

        disposer(); // Clean up the subscription when done
    } catch (error) {
        console.error("Error working with User Profile PO:", error);
    }
}
```

### 3. Fetching Data with a Query

Query is used to retrieve collections of data.

```ts
import { Query, QueryResultItem } from '@vidyano/core';

async function listActiveProducts() {
    if (!service.application || !service.isSignedIn) {
        console.warn("Service not initialized or user not signed in.");
        return;
    }

    try {
        // Assuming "ActiveProducts" is the ID of your query
        const productsQuery: Query = await service.getQuery("ActiveProducts");

        // Optional: set text search or sort options before fetching
        productsQuery.textSearch = "Laptop";
        // productsQuery.sortOptions = [{ column: productsQuery.getColumn("Price"), name: "Price", direction: "DESC" }];

        const items: QueryResultItem[] = await productsQuery.search(); // Initial search
        console.log(`Found ${productsQuery.totalItems} products matching criteria:`);
        items.forEach(item => {
            console.log(`- ${item.getValue("ProductName")} (ID: ${item.id}), Price: ${item.getValue("CurrentPrice")}`);
        });

        // Example: load more items if pagination is enabled (pageSize > 0)
        if (productsQuery.hasMore && productsQuery.pageSize > 0) {
            const moreItems = await productsQuery.getItems(productsQuery.items.length, productsQuery.pageSize);
            console.log(`Loaded ${moreItems.length} more items.`);
            // items array on productsQuery is automatically updated
        }

    } catch (error) {
        console.error("Error fetching products:", error);
        // productsQuery.setNotification(String(error), "Error"); could be used if productsQuery is available
    }
}
```

### 4. Executing an Action

Action objects allow you to perform backend operations.

```ts
import { Action, PersistentObject } from '@vidyano/core';

async function approveOrder(orderPo: PersistentObject) {
    // Assuming "ApproveOrder" is the name of the action on the Order PO
    const approveAction: Action | undefined = orderPo.actions["ApproveOrder"]; // Or orderPo.getAction("ApproveOrder");

    if (approveAction && approveAction.canExecute) {
        try {
            // Action execution might return another PO (e.g., a confirmation dialog PO or the updated PO)
            // or null if the action doesn't result in a new PO view.
            const resultPo = await approveAction.execute();
            if (resultPo) {
                console.log("Action executed, result PO:", resultPo.label);
                // The UI might navigate to this resultPo if not handled by ServiceHooks.onOpen
            } else if (orderPo.notificationType !== "Error") {
                console.log("Approve action completed successfully.");
                // The orderPo itself might have been updated or a query refreshed.
            }
        } catch (error) {
            // Errors during action execution usually set notification on the owner (orderPo here)
            console.error("Error executing Approve action:", orderPo.notification || error);
        }
    } else {
        console.warn("Approve action cannot be executed or does not exist on this PO.");
    }
}
```

### Customization with ServiceHooks

The ServiceHooks class is a powerful mechanism to intercept and customize default behaviors. You can create a class that extends ServiceHooks and override its methods to:

* Handle how notifications are displayed (onShowNotification, onMessageDialog).
* Control navigation and how objects are opened/closed (onNavigate, onOpen, onClose).
* Modify how Vidyano objects are constructed (onConstructPersistentObject, onConstructQuery, etc.).
* Intercept action execution and confirmation (onAction, onActionConfirmation).
* Implement custom logic for session expiration, retries, and more.