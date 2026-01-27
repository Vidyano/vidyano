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

    // Test new object
    const newPerson = await service.getPersistentObject(null, "Person", undefined, true);
    expect(newPerson.getAttribute("AlwaysVisible")).toBeDefined();
    expect(newPerson.getAttribute("NewOnly")).toBeDefined();
    expect(newPerson.getAttribute("ReadOnly")).toBeUndefined();
    expect(newPerson.getAttribute("NeverVisible")).toBeUndefined();

    // Test existing object
    const existingPerson = await service.getPersistentObject(null, "Person", "123", false);
    expect(existingPerson.getAttribute("AlwaysVisible")).toBeDefined();
    expect(existingPerson.getAttribute("NewOnly")).toBeUndefined();
    expect(existingPerson.getAttribute("ReadOnly")).toBeDefined();
    expect(existingPerson.getAttribute("NeverVisible")).toBeUndefined();
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
