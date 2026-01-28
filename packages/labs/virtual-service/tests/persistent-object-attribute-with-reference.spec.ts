import { test, expect } from "@playwright/test";
import { PersistentObjectAttributeWithReference } from "@vidyano/core";
import { VirtualService, VirtualPersistentObjectActions } from "../src/index.js";

test("creates reference attribute with lookup query", async () => {
    const service = new VirtualService();

    // Register the Contact PersistentObject (what we're referencing)
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
            { Id: "2", FullName: "Jane Smith", Email: "jane@example.com" },
            { Id: "3", FullName: "Bob Wilson", Email: "bob@example.com" }
        ]
    });

    // Register Person with a reference to Contact using the lookup query
    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String" },
            { name: "LastName", type: "String" },
            {
                name: "EmergencyContact",
                type: "Reference",
                lookup: "Contacts"  // This is the new API we want to support
            }
        ]
    });

    await service.initialize();

    // Get a person
    const person = await service.getPersistentObject(null, "Person");

    // Get the EmergencyContact reference attribute
    const emergencyContactAttr = person.getAttribute("EmergencyContact");

    // Verify it's a reference attribute
    expect(emergencyContactAttr).toBeInstanceOf(PersistentObjectAttributeWithReference);

    const refAttr = emergencyContactAttr as PersistentObjectAttributeWithReference;

    // Verify the lookup query is available
    expect(refAttr.lookup).toBeDefined();
    expect(refAttr.lookup?.name).toBe("Contacts");

    // Verify we can search the lookup query
    await refAttr.lookup!.search();
    const items = await refAttr.lookup!.items.toArrayAsync();

    expect(items.length).toBe(3);
    expect(items[0].values["FullName"]).toBe("John Doe");
    expect(items[1].values["FullName"]).toBe("Jane Smith");
    expect(items[2].values["FullName"]).toBe("Bob Wilson");
});

test("changes reference using lookup query item", async () => {
    const service = new VirtualService();

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
            { Id: "2", FullName: "Jane Smith", Email: "jane@example.com" },
            { Id: "3", FullName: "Bob Wilson", Email: "bob@example.com" }
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
                lookup: "Contacts"
            }
        ]
    });

    await service.initialize();

    // Get a person and enter edit mode
    const person = await service.getPersistentObject(null, "Person");
    person.beginEdit();

    // Get the EmergencyContact reference attribute
    const refAttr = person.getAttribute("EmergencyContact") as PersistentObjectAttributeWithReference;

    // Verify initial state - no reference set
    expect(refAttr.objectId).toBeNull();
    expect(refAttr.value).toBeNull();

    // Search the lookup query and select Jane Smith
    await refAttr.lookup!.search();
    const janeItem = await refAttr.lookup!.items.atAsync(1); // Index 1 is Jane Smith

    // Change the reference to Jane Smith
    await refAttr.changeReference([janeItem!]);

    // Verify the reference was set correctly
    expect(refAttr.objectId).toBe("2");
    expect(refAttr.value).toBe("Jane Smith"); // Should show the display value (FullName)
    expect(refAttr.isValueChanged).toBe(true);

    // Verify we can clear the reference
    await refAttr.changeReference([]);
    expect(refAttr.objectId).toBeNull();
    expect(refAttr.value).toBeNull();
});

test("calls onSelectReference when reference is changed", async () => {
    const service = new VirtualService();

    // Track if onSelectReference was called
    let onSelectReferenceCalled = false;
    let capturedReferenceAttributeName: string | undefined;
    let capturedSelectedItemId: string | null | undefined;

    // Create a custom VirtualPersistentObjectActions class
    class PersonActions extends VirtualPersistentObjectActions {
        async onSelectReference(parent: any, referenceAttribute: any, _query: any, selectedItem: any): Promise<void> {
            onSelectReferenceCalled = true;
            capturedReferenceAttributeName = referenceAttribute.name;
            capturedSelectedItemId = selectedItem?.id || null;

            // Custom logic: when a contact is selected, copy their email to a notes field
            if (selectedItem) {
                const emailValue = selectedItem.values?.find((v: any) => v.key === "Email");
                if (emailValue) {
                    parent.setAttributeValue("Notes", `Contact email: ${emailValue.value}`);
                }
            }
        }
    }

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
            { name: "Notes", type: "String" },
            {
                name: "EmergencyContact",
                type: "Reference",
                lookup: "Contacts"
            }
        ]
    }, PersonActions);

    await service.initialize();

    // Get a person and enter edit mode
    const person = await service.getPersistentObject(null, "Person");
    person.beginEdit();

    // Get the reference attribute
    const refAttr = person.getAttribute("EmergencyContact") as PersistentObjectAttributeWithReference;

    // Search and select Jane Smith
    await refAttr.lookup!.search();
    const janeItem = await refAttr.lookup!.items.atAsync(1);

    // Change the reference - this should trigger onSelectReference
    await refAttr.changeReference([janeItem!]);

    // Verify onSelectReference was called with correct parameters
    expect(onSelectReferenceCalled).toBe(true);
    expect(capturedReferenceAttributeName).toBe("EmergencyContact");
    expect(capturedSelectedItemId).toBe("2");

    // Verify the custom logic executed (email was copied to Notes)
    expect(person.getAttribute("Notes")?.value).toBe("Contact email: jane@example.com");

    // Reset for clearing test
    onSelectReferenceCalled = false;
    capturedSelectedItemId = undefined;

    // Clear the reference - this should also trigger onSelectReference with null item
    await refAttr.changeReference([]);

    expect(onSelectReferenceCalled).toBe(true);
    expect(capturedSelectedItemId).toBeNull();
});
