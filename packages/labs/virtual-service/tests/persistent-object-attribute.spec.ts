import { test, expect } from "@playwright/test";
import { VirtualService, VirtualPersistentObjectActions } from "../src/index.js";
import type { VirtualPersistentObject, VirtualPersistentObjectAttribute } from "../src/index.js";

test("creates attributes with correct defaults", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName" },
            { name: "Email", type: "String", isRequired: true }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");

    const firstName = person.getAttribute("FirstName");
    expect(firstName.name).toBe("FirstName");
    expect(firstName.type).toBe("String");
    expect(firstName.label).toBe("FirstName");
    expect(firstName.isRequired).toBe(false);

    const email = person.getAttribute("Email");
    expect(email.isRequired).toBe(true);
});

test("uses provided id for attribute when specified", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { id: "fixed-email-id", name: "Email", type: "String" },
            { name: "FirstName", type: "String" }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");

    const email = person.getAttribute("Email");
    expect(email.id).toBe("fixed-email-id");

    // Attribute without explicit id should get a generated UUID
    const firstName = person.getAttribute("FirstName");
    expect(firstName.id).toBeDefined();
    expect(firstName.id).not.toBe("fixed-email-id");
});

test("handles attribute visibility for new vs existing objects", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "AlwaysVisible", visibility: "Always" },
            { name: "NewOnly", visibility: "New" },
            { name: "ReadOnly", visibility: "Read" },
            { name: "NeverVisible", visibility: "Never" }
        ]
    });

    await service.initialize();

    // Test new object - all attributes should be present with correct visibility
    const newPerson = await service.getPersistentObject(null, "Person", undefined, true);
    expect(newPerson.getAttribute("AlwaysVisible")?.visibility).toBe("Always");
    expect(newPerson.getAttribute("NewOnly")?.visibility).toBe("New");
    expect(newPerson.getAttribute("ReadOnly")?.visibility).toBe("Read");
    expect(newPerson.getAttribute("NeverVisible")?.visibility).toBe("Never");

    // Test existing object - all attributes should be present with correct visibility
    const existingPerson = await service.getPersistentObject(null, "Person", "123", false);
    expect(existingPerson.getAttribute("AlwaysVisible")?.visibility).toBe("Always");
    expect(existingPerson.getAttribute("NewOnly")?.visibility).toBe("New");
    expect(existingPerson.getAttribute("ReadOnly")?.visibility).toBe("Read");
    expect(existingPerson.getAttribute("NeverVisible")?.visibility).toBe("Never");
});

test("calls onRefresh handler when attribute triggers refresh", async () => {
    const service = new VirtualService();
    let refreshCalled = false;
    let refreshedAttrName: string | undefined;

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Email", type: "String", triggersRefresh: true },
            { name: "IsEmailValid", type: "Boolean", value: "False" }
        ]
    });

    service.registerPersistentObjectActions("Person", class extends VirtualPersistentObjectActions {
        async onRefresh(obj: VirtualPersistentObject, attribute: VirtualPersistentObjectAttribute | undefined): Promise<VirtualPersistentObject> {
            refreshCalled = true;
            refreshedAttrName = attribute?.name;

            if (attribute) {
                // Use getValue() on the attribute proxy to get the converted value
                const email = attribute.getValue() as string;
                // Use getAttribute() to get the IsEmailValid attribute and setValue() on it
                obj.getAttribute("IsEmailValid")?.setValue(email?.includes("@"));
            }

            return obj;
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");

    // Change email attribute value - this should automatically trigger refresh
    const emailAttr = person.getAttribute("Email");
    await emailAttr.setValue("test@example.com", true); // allowRefresh = true

    expect(refreshCalled).toBe(true);
    expect(refreshedAttrName).toBe("Email");
    expect(person.getAttribute("IsEmailValid").value).toBe(true);
});

test("marks attributes as changed after refresh", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "John" }
        ]
    });

    service.registerPersistentObjectActions("Person", class extends VirtualPersistentObjectActions {
        async onRefresh(obj: VirtualPersistentObject, _attribute: VirtualPersistentObjectAttribute | undefined): Promise<VirtualPersistentObject> {
            // Use getAttribute().setValue() instead of setAttributeValue()
            obj.getAttribute("FirstName")?.setValue("Updated");
            return obj;
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");

    // Execute refresh
    const refreshed = await service.executeAction("PersistentObject.Refresh", person);

    const firstName = refreshed.getAttribute("FirstName");
    expect(firstName.value).toBe("Updated");
    expect(firstName.isValueChanged).toBe(true);
});

test("changes attribute visibility in onRefresh handler", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "TriggerField", type: "String", triggersRefresh: true },
            { name: "ConditionalField", type: "String", visibility: "Never" }
        ]
    });

    service.registerPersistentObjectActions("Person", class extends VirtualPersistentObjectActions {
        async onRefresh(obj: VirtualPersistentObject, attribute: VirtualPersistentObjectAttribute | undefined): Promise<VirtualPersistentObject> {
            if (attribute?.name === "TriggerField") {
                const conditionalField = obj.getAttribute("ConditionalField");
                if (conditionalField) {
                    const triggerValue = attribute.getValue() as string;
                    // Show ConditionalField when TriggerField has a value
                    conditionalField.visibility = triggerValue ? "Always" : "Never";
                }
            }
            return obj;
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");

    // Initially, ConditionalField should not be visible (visibility: "Never")
    const conditionalFieldBefore = person.attributes?.find(a => a.name === "ConditionalField");
    expect(conditionalFieldBefore?.visibility).toBe("Never");

    // Change TriggerField value - this should trigger refresh and change visibility
    const triggerField = person.getAttribute("TriggerField");
    await triggerField.setValue("some value", true); // allowRefresh = true

    // After refresh, ConditionalField visibility should be changed to "Always"
    const conditionalFieldAfter = person.attributes?.find(a => a.name === "ConditionalField");
    expect(conditionalFieldAfter?.visibility).toBe("Always");
});
