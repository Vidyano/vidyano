import { test, expect } from "@playwright/test";
import { PersistentObject, PersistentObjectAttributeWithReference, Dto } from "@vidyano/core";
import { VirtualService, VirtualPersistentObjectActions } from "../src/index.js";
import type { VirtualPersistentObject } from "../src/index.js";

test("overrides onLoad method for a PersistentObject type", async () => {
    const service = new VirtualService();
    let loadCalled = false;

    // Register PersistentObject with actions
    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "John" },
            { name: "LastName", type: "String", value: "Doe" }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onLoad(obj: VirtualPersistentObject, parent: VirtualPersistentObject | null): Promise<VirtualPersistentObject> {
            loadCalled = true;

            // Call base implementation first
            obj = await super.onLoad(obj, parent);

            // Custom load logic - clean method calls directly on obj
            if (obj.objectId === "123") {
                obj.setAttributeValue("FirstName", "Custom");
                obj.setAttributeValue("LastName", "Loaded");
            }

            return obj;
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "123");

    expect(loadCalled).toBe(true);
    expect(person.getAttributeValue("FirstName")).toBe("Custom");
    expect(person.getAttributeValue("LastName")).toBe("Loaded");
});

test("overrides onSave method for a PersistentObject type", async () => {
    const service = new VirtualService();
    let saveCalled = false;

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "John" },
            { name: "LastName", type: "String", value: "Doe" },
            { name: "FullName", type: "String", value: "", isReadOnly: true }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onSave(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            saveCalled = true;

            // Call base implementation (handles saveNew/saveExisting)
            obj = await super.onSave(obj);

            // Custom post-save logic - compute full name
            const firstName = obj.getAttributeValue("FirstName");
            const lastName = obj.getAttributeValue("LastName");
            obj.setAttributeValue("FullName", `${firstName} ${lastName}`);

            return obj;
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "123");
    person.beginEdit();
    await person.setAttributeValue("FirstName", "Jane");
    await person.save();

    expect(saveCalled).toBe(true);
    expect(person.getAttributeValue("FullName")).toBe("Jane Doe");
});

test("overrides onRefresh method for attribute changes", async () => {
    const service = new VirtualService();
    let refreshCalled = false;

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "John", triggersRefresh: true },
            { name: "LastName", type: "String", value: "Doe" },
            { name: "FullName", type: "String", value: "John Doe", isReadOnly: true }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onRefresh(obj: VirtualPersistentObject, attribute: Dto.PersistentObjectAttributeDto | undefined): Promise<VirtualPersistentObject> {
            refreshCalled = true;

            // Call base implementation first
            obj = await super.onRefresh(obj, attribute);

            // Custom refresh logic - update full name when first or last name changes
            if (attribute?.name === "FirstName" || attribute?.name === "LastName") {
                const firstName = obj.getAttributeValue("FirstName");
                const lastName = obj.getAttributeValue("LastName");
                obj.setAttributeValue("FullName", `${firstName} ${lastName}`);
            }

            return obj;
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "123");
    person.beginEdit();

    // Trigger refresh by changing FirstName
    await person.setAttributeValue("FirstName", "Jane");

    expect(refreshCalled).toBe(true);
    expect(person.getAttributeValue("FullName")).toBe("Jane Doe");
});

test("overrides onConstruct for all objects", async () => {
    const service = new VirtualService();
    let constructCalled = false;

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "John" },
            { name: "IsActive", type: "Boolean", value: false }
        ]
    }, class extends VirtualPersistentObjectActions {
        onConstruct(obj: VirtualPersistentObject): void {
            constructCalled = true;

            // Call base implementation
            super.onConstruct(obj);

            // Set default values for all new instances (use string format for boolean)
            obj.setAttributeValue("IsActive", "True");
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "123");

    expect(constructCalled).toBe(true);
    expect(person.getAttributeValue("IsActive")).toBe(true);
});

test("overrides onNew for creating new objects", async () => {
    const service = new VirtualService();
    let newCalled = false;

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "" },
            { name: "Status", type: "String", value: "" }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onNew(
            obj: VirtualPersistentObject,
            parent: VirtualPersistentObject | null,
            query: Dto.QueryDto | null,
            parameters: Record<string, string> | null
        ): Promise<VirtualPersistentObject> {
            newCalled = true;

            // Call base implementation
            obj = await super.onNew(obj, parent, query, parameters);

            // Set default status for new objects
            obj.setAttributeValue("Status", "Draft");

            return obj;
        }
    });

    // New action is auto-added to queries by default
    service.registerQuery({
        name: "People",
        persistentObject: "Person"
    });

    await service.initialize();

    const query = await service.getQuery("People");
    const newAction = query.getAction("New");
    const newPerson = await newAction.execute({ skipOpen: true });

    expect(newCalled).toBe(true);
    expect(newPerson.getAttributeValue("Status")).toBe("Draft");
});

test("overrides saveNew and saveExisting separately", async () => {
    const service = new VirtualService();
    let saveNewCalled = false;
    let saveExistingCalled = false;

    service.registerAction({
        name: "Save",
        handler: async (args) => args.parent
    });

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "John" },
            { name: "CreatedAt", type: "DateTime", value: null, isReadOnly: true },
            { name: "UpdatedAt", type: "DateTime", value: null, isReadOnly: true }
        ],
        actions: ["Save"]
    }, class extends VirtualPersistentObjectActions {
        protected async saveNew(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            saveNewCalled = true;

            // Call base implementation
            obj = await super.saveNew(obj);

            // Set creation timestamp
            obj.setAttributeValue("CreatedAt", new Date());

            return obj;
        }

        protected async saveExisting(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            saveExistingCalled = true;

            // Call base implementation
            obj = await super.saveExisting(obj);

            // Update timestamp
            obj.setAttributeValue("UpdatedAt", new Date());

            return obj;
        }
    });

    await service.initialize();

    // Test existing object
    const person = await service.getPersistentObject(null, "Person", "123");
    person.beginEdit();
    await person.setAttributeValue("FirstName", "Jane");
    await person.save();

    expect(saveExistingCalled).toBe(true);
    expect(saveNewCalled).toBe(false);
    expect(person.getAttributeValue("UpdatedAt")).toBeInstanceOf(Date);
});

test("validates data in onSave before persisting", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Age", type: "Int32", value: 0 }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onSave(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            const ageAttr = obj.getAttribute("Age");

            if (ageAttr && (ageAttr.getValue() < 0 || ageAttr.getValue() > 150)) {
                ageAttr.setValidationError("Age must be between 0 and 150");
                obj.setNotification("Validation failed", "Error");
                return obj;
            }

            // Call base implementation only if validation passes
            return await super.onSave(obj);
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "123");
    person.beginEdit();
    await person.setAttributeValue("Age", 200);

    await person.save({ throwExceptions: false });

    const ageAttr = person.getAttribute("Age");
    expect(ageAttr.validationError).toBe("Age must be between 0 and 150");
    expect(person.notification).toBe("Validation failed");
    expect(person.notificationType).toBe("Error");
});

test("onLoad can throw to prevent loading certain objects", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "John" }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onLoad(obj: VirtualPersistentObject, parent: VirtualPersistentObject | null): Promise<VirtualPersistentObject> {
            if (obj.objectId === "deleted-123") {
                obj.setNotification("This person has been deleted", "Error");
                throw new Error("Person not found");
            }

            return await super.onLoad(obj, parent);
        }
    });

    await service.initialize();

    // This should throw - Service throws exception as string, not Error object
    await expect(async () => {
        await service.getPersistentObject(null, "Person", "deleted-123");
    }).rejects.toBe("Person not found");

    // This should work
    const person = await service.getPersistentObject(null, "Person", "456");
    expect(person).toBeInstanceOf(PersistentObject);
});

test("onRefresh can modify multiple attributes based on one change", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Product",
        attributes: [
            { name: "Name", type: "String", value: "Widget" },
            { name: "Price", type: "Decimal", value: 100, triggersRefresh: true },
            { name: "Tax", type: "Decimal", value: 0, isReadOnly: true },
            { name: "Total", type: "Decimal", value: 0, isReadOnly: true }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onRefresh(obj: VirtualPersistentObject, attribute: Dto.PersistentObjectAttributeDto | undefined): Promise<VirtualPersistentObject> {
            obj = await super.onRefresh(obj, attribute);

            // Recalculate tax and total when price changes
            if (attribute?.name === "Price") {
                const price = obj.getAttributeValue("Price");
                const tax = price * 0.2; // 20% tax
                const total = price + tax;

                obj.setAttributeValue("Tax", tax);
                obj.setAttributeValue("Total", total);
            }

            return obj;
        }
    });

    await service.initialize();

    const product = await service.getPersistentObject(null, "Product", "123");
    product.beginEdit();

    // Change price - should trigger refresh
    await product.setAttributeValue("Price", 200);

    // Tax and total should be automatically calculated
    expect(product.getAttributeValue("Tax").toNumber()).toBe(40);
    expect(product.getAttributeValue("Total").toNumber()).toBe(240);
});

test("onLoad can set initial values based on objectId", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "" },
            { name: "LastName", type: "String", value: "" },
            { name: "Role", type: "String", value: "" }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onLoad(obj: VirtualPersistentObject, parent: VirtualPersistentObject | null): Promise<VirtualPersistentObject> {
            obj = await super.onLoad(obj, parent);

            // Simulate loading from different data sources based on ID prefix
            if (obj.objectId?.startsWith("admin-")) {
                obj.setAttributeValue("Role", "Administrator");
            } else if (obj.objectId?.startsWith("user-")) {
                obj.setAttributeValue("Role", "User");
            } else {
                obj.setAttributeValue("Role", "Guest");
            }

            return obj;
        }
    });

    await service.initialize();

    const admin = await service.getPersistentObject(null, "Person", "admin-1");
    expect(admin.getAttributeValue("Role")).toBe("Administrator");

    const user = await service.getPersistentObject(null, "Person", "user-2");
    expect(user.getAttributeValue("Role")).toBe("User");

    const guest = await service.getPersistentObject(null, "Person", "123");
    expect(guest.getAttributeValue("Role")).toBe("Guest");
});

test("parent parameter is passed to onLoad for master-detail scenarios", async () => {
    const service = new VirtualService();
    let parentReceived: VirtualPersistentObject | null = null;

    service.registerPersistentObject({
        type: "Order",
        attributes: [
            { name: "OrderNumber", type: "String", value: "ORD-001" }
        ]
    });

    service.registerPersistentObject({
        type: "OrderLine",
        attributes: [
            { name: "ProductName", type: "String", value: "Widget" },
            { name: "ParentOrderNumber", type: "String", value: "", isReadOnly: true }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onLoad(obj: VirtualPersistentObject, parent: VirtualPersistentObject | null): Promise<VirtualPersistentObject> {
            parentReceived = parent;
            obj = await super.onLoad(obj, parent);

            // If loaded in context of parent Order, copy order number
            if (parent && parent.type === "Order") {
                const orderNumber = parent.getAttributeValue("OrderNumber");
                obj.setAttributeValue("ParentOrderNumber", orderNumber);
            }

            return obj;
        }
    });

    await service.initialize();

    // Load OrderLine with parent context
    const order = await service.getPersistentObject(null, "Order", "1");
    const orderLine = await service.getPersistentObject(order, "OrderLine", "1");

    expect(parentReceived).not.toBeNull();
    expect(parentReceived!.type).toBe("Order");
    expect(orderLine.getAttributeValue("ParentOrderNumber")).toBe("ORD-001");
});

test("VirtualPersistentObject provides access to DTO properties", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "John" },
            { name: "Age", type: "Int32", value: 30 }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onLoad(obj: VirtualPersistentObject, parent: VirtualPersistentObject | null): Promise<VirtualPersistentObject> {
            obj = await super.onLoad(obj, parent);

            // Can access DTO properties directly
            expect(obj.type).toBe("Person");
            expect(obj.attributes).toBeDefined();
            expect(Array.isArray(obj.attributes)).toBe(true);

            // Can also use helper methods
            const firstName = obj.getAttributeValue("FirstName");
            expect(firstName).toBe("John");

            // Can access attributes array directly
            const ageAttr = obj.getAttribute("Age");
            expect(ageAttr?.type).toBe("Int32");

            return obj;
        }
    });

    await service.initialize();

    await service.getPersistentObject(null, "Person", "123");
});

test("onConstructQuery is called when a query is constructed", async () => {
    const service = new VirtualService();

    let onConstructQueryCalled = false;
    let capturedQueryName: string | undefined;
    let capturedParent: any = undefined;

    service.registerPersistentObject({
        type: "Task",
        attributes: [
            { name: "Id", type: "String" },
            { name: "Title", type: "String" },
            { name: "Status", type: "String" }
        ]
    }, class extends VirtualPersistentObjectActions {
        onConstructQuery(query: Dto.QueryDto, parent: VirtualPersistentObject | null): void {
            onConstructQueryCalled = true;
            capturedQueryName = query.name;
            capturedParent = parent;

            // Custom logic: could modify query columns, set metadata, etc.
            // For now, just track that it was called
        }
    });

    service.registerQuery({
        name: "Tasks",
        persistentObject: "Task",
        data: [
            { Id: "1", Title: "Task 1", Status: "Open" },
            { Id: "2", Title: "Task 2", Status: "Done" }
        ]
    });

    await service.initialize();

    // Get the query - this should trigger onConstructQuery
    const query = await service.getQuery("Tasks");

    expect(onConstructQueryCalled).toBe(true);
    expect(capturedQueryName).toBe("Tasks");
    expect(capturedParent).toBeNull(); // No parent for top-level query
    expect(query.name).toBe("Tasks");
});

test("onDelete is called when items are deleted from a query", async () => {
    const service = new VirtualService();

    const deletedIds: string[] = [];

    service.registerPersistentObject({
        type: "Task",
        attributes: [
            { name: "Id", type: "String" },
            { name: "Title", type: "String" },
            { name: "Status", type: "String" }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onDelete(
            _parent: VirtualPersistentObject | null,
            _query: Dto.QueryDto,
            selectedItems: Dto.QueryResultItemDto[]
        ): Promise<void> {
            // Track which items were deleted
            for (const item of selectedItems) {
                deletedIds.push(item.id);
            }

            // Custom logic: could remove from data store, validate permissions, etc.
        }
    });

    // Delete action is auto-added to queries when onDelete is overridden
    service.registerQuery({
        name: "Tasks",
        persistentObject: "Task",
        data: [
            { Id: "1", Title: "Task 1", Status: "Open" },
            { Id: "2", Title: "Task 2", Status: "Open" },
            { Id: "3", Title: "Task 3", Status: "Done" }
        ]
    });

    await service.initialize();

    const query = await service.getQuery("Tasks");
    await query.search();

    // Get items to delete
    const items = await query.items.toArrayAsync();
    const itemsToDelete = [items[0], items[1]]; // Delete first two tasks

    // Select items to delete
    itemsToDelete.forEach(item => item.isSelected = true);

    // Execute the Delete action
    const deleteAction = query.actions.find(a => a.name === "Delete");
    expect(deleteAction).toBeDefined();
    await deleteAction!.execute({ throwExceptions: false });

    // Verify onDelete was called with the right items
    expect(deletedIds.length).toBe(2);
    expect(deletedIds).toContain("1");
    expect(deletedIds).toContain("2");
});

test("base onSelectReference sets objectId and value on reference attribute", async () => {
    const service = new VirtualService();

    let onSelectReferenceCalled = false;

    // Register the Contact PersistentObject
    service.registerPersistentObject({
        type: "Contact",
        attributes: [
            { name: "Id", type: "String" },
            { name: "FullName", type: "String" },
            { name: "Email", type: "String" }
        ]
    });

    // Register the Contacts lookup query
    service.registerQuery({
        name: "Contacts",
        persistentObject: "Contact",
        data: [
            { Id: "1", FullName: "John Doe", Email: "john@example.com" },
            { Id: "2", FullName: "Jane Smith", Email: "jane@example.com" }
        ]
    });

    // Register Person with a reference to Contact
    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String" },
            { name: "LastName", type: "String" },
            {
                name: "EmergencyContact",
                type: "Reference",
                lookup: "Contacts",
                displayAttribute: "FullName"
            }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onSelectReference(
            parent: VirtualPersistentObject,
            referenceAttribute: Dto.PersistentObjectAttributeDto,
            query: Dto.QueryDto,
            selectedItem: Dto.QueryResultItemDto | null
        ): Promise<void> {
            // Call base implementation - this should set objectId and value
            await super.onSelectReference(parent, referenceAttribute, query, selectedItem);
            onSelectReferenceCalled = true;
        }
    });

    await service.initialize();

    // Get a person and enter edit mode
    const person = await service.getPersistentObject(null, "Person");
    person.beginEdit();

    // Get the reference attribute
    const refAttr = person.getAttribute("EmergencyContact") as PersistentObjectAttributeWithReference;
    expect(refAttr.objectId).toBeNull();
    expect(refAttr.value).toBeNull();

    // Search and select Jane Smith
    await refAttr.lookup!.search();
    const janeItem = await refAttr.lookup!.items.atAsync(1);

    // Change the reference - this should trigger onSelectReference
    await refAttr.changeReference([janeItem!]);

    // Verify onSelectReference was called
    expect(onSelectReferenceCalled).toBe(true);

    // Verify the base implementation set the objectId and value
    expect(refAttr.objectId).toBe("2");
    expect(refAttr.value).toBe("Jane Smith");
    expect(refAttr.isValueChanged).toBe(true);

    // Test clearing the reference
    onSelectReferenceCalled = false;
    await refAttr.changeReference([]);

    expect(onSelectReferenceCalled).toBe(true);
    expect(refAttr.objectId).toBeNull();
    expect(refAttr.value).toBeNull();
});
