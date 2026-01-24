import { test, expect } from "@playwright/test";
import { PersistentObject } from "@vidyano/core";
import { VirtualService } from "../src/index.js";

test("loads a registered persistent object", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "John" },
            { name: "LastName", type: "String", value: "Doe" }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "123");

    expect(person).toBeInstanceOf(PersistentObject);
    expect(person.type).toBe("Person");
    expect(person.objectId).toBe("123");
    expect(person.label).toBe("Person");
    expect(person.attributes.length).toBe(2);
});

test("handles PersistentObject.Refresh action", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", value: "John" },
            { name: "LastName", type: "String", value: "Doe" }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");

    // Modify an attribute
    person.getAttribute("FirstName").value = "Jane";

    // Execute refresh
    const refreshed = await service.executeAction("PersistentObject.Refresh", person);

    expect(refreshed).toBeInstanceOf(PersistentObject);
    expect(refreshed.getAttribute("FirstName").value).toBe("Jane");
});
