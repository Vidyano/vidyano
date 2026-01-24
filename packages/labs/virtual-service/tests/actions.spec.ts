import { test, expect } from "@playwright/test";
import { VirtualService } from "../src/index.js";
import type { ActionArgs } from "../src/index.js";

test("registers actions on persistent object", async () => {
    const service = new VirtualService();

    // Register actions first
    service.registerAction({
        name: "CustomAction",
        handler: async (args: ActionArgs) => args.parent
    });

    service.registerAction({
        name: "AnotherAction",
        handler: async (args: ActionArgs) => args.parent
    });

    // Register PersistentObject with action references
    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String" }
        ],
        actions: ["CustomAction", "AnotherAction"]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");

    expect(person.actions.length).toBe(2);
    expect(person.getAction("CustomAction")).toBeDefined();
    expect(person.getAction("AnotherAction")).toBeDefined();
});

test("executes custom action handler", async () => {
    const service = new VirtualService();
    let actionExecuted = false;

    // Register action with new unified handler
    service.registerAction({
        name: "CustomAction",
        handler: async (args: ActionArgs) => {
            actionExecuted = true;
            const firstName = args.context.getAttributeValue("FirstName");
            expect(firstName).toBe("John");
            args.context.setAttributeValue("LastName", "Smith");
            args.context.setNotification("Action executed!", "OK", 3000);
            return args.parent;
        }
    });

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "John" },
            { name: "LastName", type: "String", value: "Doe" }
        ],
        actions: ["CustomAction"]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");
    const action = person.getAction("CustomAction");
    const result = await action.execute();

    expect(actionExecuted).toBe(true);
    expect(result.getAttributeValue("LastName")).toBe("Smith");
    expect(result.notification).toBe("Action executed!");
    expect(result.notificationType).toBe("OK");
    expect(result.notificationDuration).toBe(3000);
});

test("registers Save action explicitly", async () => {
    const service = new VirtualService();

    // Register Save action explicitly
    service.registerAction({
        name: "Save",
        handler: async (args: ActionArgs) => {
            return args.parent;
        }
    });

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String" }
        ],
        actions: ["Save"]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");

    expect(person.actions.length).toBeGreaterThan(0);
    expect(person.getAction("Save")).toBeDefined();
});

test("unified action can detect if invoked from query", async () => {
    const service = new VirtualService();
    let hasQuery = false;
    let hasSelectedItems = false;

    // Register unified action that checks context
    service.registerAction({
        name: "UnifiedAction",
        handler: async (args: ActionArgs) => {
            // Check if invoked from query
            if (args.query) {
                hasQuery = true;
                expect(args.query.name).toBeDefined();
            }

            // Check if has selected items
            if (args.selectedItems && args.selectedItems.length > 0) {
                hasSelectedItems = true;
            }

            return args.parent;
        }
    });

    service.registerPersistentObject({
        type: "Product",
        attributes: [
            { name: "Name", type: "String" }
        ],
        actions: ["UnifiedAction"]
    });

    service.registerQuery({
        name: "Products",
        persistentObject: "Product",
        itemActions: ["UnifiedAction"],
        data: [
            { id: "1", Name: "Widget" }
        ]
    });

    await service.initialize();

    // Test 1: Invoke from PersistentObject directly
    const product = await service.getPersistentObject(null, "Product");
    const action = product.getAction("UnifiedAction");
    await action.execute();
    expect(hasQuery).toBe(false);
    expect(hasSelectedItems).toBe(false);

    // Reset flags
    hasQuery = false;
    hasSelectedItems = false;

    // Test 2: Invoke from Query (would need query item selection)
    // Note: Full query action execution with selected items requires more setup
    // This demonstrates the API design
});

test("action can inspect parent persistent object attributes", async () => {
    const service = new VirtualService();

    service.registerAction({
        name: "InspectProduct",
        handler: async (args: ActionArgs) => {
            const name = args.context.getAttributeValue("Name");
            const price = args.context.getAttributeValue("Price");

            expect(name).toBe("Widget");
            expect(price).toBe(100);

            // Modify based on current values
            const priceNum = typeof price === "string" ? parseFloat(price) : price;
            if (priceNum < 200) {
                args.context.setAttributeValue("Price", 200);
                args.context.setNotification("Price increased to minimum", "Warning");
            }

            return args.parent;
        }
    });

    service.registerPersistentObject({
        type: "Product",
        attributes: [
            { name: "Name", type: "String", value: "Widget" },
            { name: "Price", type: "Decimal", value: 100 }
        ],
        actions: ["InspectProduct"]
    });

    await service.initialize();

    const product = await service.getPersistentObject(null, "Product");
    const action = product.getAction("InspectProduct");
    const result = await action.execute();

    // Check that price was updated
    const newPrice = result.getAttributeValue("Price");
    expect(String(newPrice)).toBe("200");
    expect(result.notification).toBe("Price increased to minimum");
    expect(result.notificationType).toBe("Warning");
});

test("action can return null to complete silently", async () => {
    const service = new VirtualService();
    let executed = false;

    service.registerAction({
        name: "SilentAction",
        handler: async (args: ActionArgs) => {
            executed = true;
            // Return null to complete without UI refresh
            return null;
        }
    });

    service.registerPersistentObject({
        type: "Product",
        attributes: [
            { name: "Name", type: "String" }
        ],
        actions: ["SilentAction"]
    });

    await service.initialize();

    const product = await service.getPersistentObject(null, "Product");
    const action = product.getAction("SilentAction");
    const result = await action.execute();

    expect(executed).toBe(true);
    // Result is still returned (defaults to parent)
    expect(result).toBeDefined();
});

test("query action receives selected items", async () => {
    const service = new VirtualService();
    let receivedQuery = false;
    let parentIsNull = false;
    let selectedItemCount = 0;
    let selectedItemIds: string[] = [];

    // Register action that processes selected items (same action can be used from PO or Query)
    service.registerAction({
        name: "BulkUpdatePrice",
        handler: async (args: ActionArgs) => {
            // For query actions without a parent context, parent can be null
            if (args.parent === null) {
                parentIsNull = true;
            }

            // Check that we have query context
            if (args.query) {
                receivedQuery = true;
                expect(args.query.name).toBe("Products");
            }

            // Check selected items
            if (args.selectedItems && args.selectedItems.length > 0) {
                selectedItemCount = args.selectedItems.length;
                selectedItemIds = args.selectedItems.map(item => item.id);

                // In a real scenario, you might update the selected items
                args.context.setNotification(`Updated ${selectedItemCount} products`, "OK");
            }

            // For query actions, we can return null since there's no parent to refresh
            return null;
        }
    });

    service.registerPersistentObject({
        type: "Product",
        attributes: [
            { name: "Name", type: "String" },
            { name: "Price", type: "Decimal" }
        ]
    });

    service.registerQuery({
        name: "Products",
        persistentObject: "Product",
        itemActions: ["BulkUpdatePrice"],
        data: [
            { id: "1", Name: "Widget", Price: 100 },
            { id: "2", Name: "Gadget", Price: 200 },
            { id: "3", Name: "Gizmo", Price: 150 }
        ]
    });

    await service.initialize();

    const query = await service.getQuery("Products");
    const items = await query.search();

    // Select first two items
    items[0].isSelected = true;
    items[1].isSelected = true;

    // Execute action on selected items
    const action = query.getAction("BulkUpdatePrice");
    const result = await action.execute({ selectedItems: [items[0], items[1]] });

    // Verify the action received all context
    expect(parentIsNull).toBe(true);
    expect(receivedQuery).toBe(true);
    expect(selectedItemCount).toBe(2);
    expect(selectedItemIds).toEqual(["1", "2"]);
    // Result is the query's template PO with notification
    expect(result.notification).toBe("Updated 2 products");
});
