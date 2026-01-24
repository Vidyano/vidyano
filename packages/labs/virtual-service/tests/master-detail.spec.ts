import { test, expect } from "@playwright/test";
import { PersistentObject } from "@vidyano/core";
import { VirtualService } from "../src/index.js";

test("registers a persistent object with a detail query", async () => {
    const service = new VirtualService();

    // Register Address persistent object
    service.registerPersistentObject({
        type: "Address",
        attributes: [
            { name: "Street", type: "String" },
            { name: "City", type: "String" },
            { name: "PostalCode", type: "String" }
        ]
    });

    // Register Addresses query for Address persistent object
    service.registerQuery({
        name: "Addresses",
        persistentObject: "Address",
        data: [
            { Street: "123 Main St", City: "Springfield", PostalCode: "12345" },
            { Street: "456 Oak Ave", City: "Shelbyville", PostalCode: "67890" }
        ]
    });

    // Register Person persistent object with Addresses as a detail query
    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String" },
            { name: "LastName", type: "String" }
        ],
        queries: ["Addresses"]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "123");

    expect(person).toBeInstanceOf(PersistentObject);
    expect(person.queries).toBeDefined();
    expect(person.queries.length).toBe(1);

    const addressesQuery = person.queries[0];
    expect(addressesQuery.name).toBe("Addresses");
    expect(addressesQuery.persistentObject.type).toBe("Address");

    // Verify the query has data
    expect(addressesQuery.totalItems).toBe(2);
    expect(addressesQuery.items).toBeDefined();

    const items = await addressesQuery.items.toArrayAsync();
    expect(items.length).toBe(2);
    expect(items[0].id).toBeDefined();
    expect(items[0].values.Street).toBe("123 Main St");
    expect(items[0].values.City).toBe("Springfield");
    expect(items[1].id).toBeDefined();
    expect(items[1].values.Street).toBe("456 Oak Ave");
    expect(items[1].values.City).toBe("Shelbyville");
    expect(items[0].id).not.toBe(items[1].id);
});
