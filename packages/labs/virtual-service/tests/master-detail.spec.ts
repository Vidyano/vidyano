import { test, expect } from "@playwright/test";
import { PersistentObject, Query } from "@vidyano/core";
import { VirtualService, VirtualPersistentObjectActions } from "../src/index.js";
import type { VirtualPersistentObject } from "../src/index.js";

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

test("detail queries are pre-executed by default (isIncludedInParentObject defaults to true)", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Address",
        attributes: [
            { name: "Street", type: "String" },
            { name: "City", type: "String" }
        ]
    });

    service.registerPersistentObject({
        type: "PhoneNumber",
        attributes: [
            { name: "Number", type: "String" },
            { name: "Type", type: "String" }
        ]
    });

    service.registerQuery({
        name: "Addresses",
        persistentObject: "Address",
        autoQuery: false,
        data: [
            { Street: "123 Main St", City: "Springfield" },
            { Street: "456 Oak Ave", City: "Shelbyville" }
        ]
    });

    service.registerQuery({
        name: "PhoneNumbers",
        persistentObject: "PhoneNumber",
        autoQuery: false,
        data: [
            { Number: "555-1234", Type: "Home" },
            { Number: "555-5678", Type: "Work" }
        ]
    });

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String" }
        ],
        queries: ["Addresses", "PhoneNumbers"]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "123");

    // Both queries should be pre-executed by default
    const addressesQuery = person.queries.find(q => q.name === "Addresses")!;
    expect(addressesQuery.hasSearched).toBe(true);
    expect(addressesQuery.totalItems).toBe(2);

    const phoneNumbersQuery = person.queries.find(q => q.name === "PhoneNumbers")!;
    expect(phoneNumbersQuery.hasSearched).toBe(true);
    expect(phoneNumbersQuery.totalItems).toBe(2);

    const addresses = await addressesQuery.items.toArrayAsync();
    expect(addresses[0].values["Street"]).toBe("123 Main St");

    const phones = await phoneNumbersQuery.items.toArrayAsync();
    expect(phones[0].values["Number"]).toBe("555-1234");
});

test("detail query with isIncludedInParentObject=false is not pre-executed", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Address",
        attributes: [
            { name: "Street", type: "String" },
            { name: "City", type: "String" }
        ]
    });

    service.registerPersistentObject({
        type: "PhoneNumber",
        attributes: [
            { name: "Number", type: "String" },
            { name: "Type", type: "String" }
        ]
    });

    service.registerQuery({
        name: "Addresses",
        persistentObject: "Address",
        autoQuery: false,
        data: [
            { Street: "123 Main St", City: "Springfield" },
            { Street: "456 Oak Ave", City: "Shelbyville" }
        ]
    });

    service.registerQuery({
        name: "PhoneNumbers",
        persistentObject: "PhoneNumber",
        autoQuery: false,
        data: [
            { Number: "555-1234", Type: "Home" },
            { Number: "555-5678", Type: "Work" }
        ]
    });

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String" }
        ],
        queries: ["Addresses", "PhoneNumbers"]
    }, class extends VirtualPersistentObjectActions {
        onConstruct(obj: VirtualPersistentObject): void {
            super.onConstruct(obj);

            // Exclude PhoneNumbers from being pre-executed
            const phoneNumbersQuery = obj.queries!.find(q => q.name === "PhoneNumbers")!;
            phoneNumbersQuery.isIncludedInParentObject = false;
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "123");

    // Addresses should be pre-executed (default behavior)
    const addressesQuery = person.queries.find(q => q.name === "Addresses")!;
    expect(addressesQuery.hasSearched).toBe(true);
    expect(addressesQuery.totalItems).toBe(2);

    // PhoneNumbers should NOT be pre-executed
    const phoneNumbersQuery = person.queries.find(q => q.name === "PhoneNumbers")!;
    expect(phoneNumbersQuery.hasSearched).toBeFalsy();
});

test("onConstruct receives detail queries that are available but not yet executed", async () => {
    const service = new VirtualService();
    let constructCalled = false;
    let queriesAvailable = false;
    let queriesNotExecuted = false;
    let capturedQueryNames: string[] = [];

    // Register Address persistent object
    service.registerPersistentObject({
        type: "Address",
        attributes: [
            { name: "Street", type: "String" },
            { name: "City", type: "String" }
        ]
    });

    // Register PhoneNumber persistent object
    service.registerPersistentObject({
        type: "PhoneNumber",
        attributes: [
            { name: "Number", type: "String" },
            { name: "Type", type: "String" }
        ]
    });

    // Register Addresses query
    service.registerQuery({
        name: "Addresses",
        persistentObject: "Address",
        data: [
            { Street: "123 Main St", City: "Springfield" },
            { Street: "456 Oak Ave", City: "Shelbyville" }
        ]
    });

    // Register PhoneNumbers query
    service.registerQuery({
        name: "PhoneNumbers",
        persistentObject: "PhoneNumber",
        data: [
            { Number: "555-1234", Type: "Home" },
            { Number: "555-5678", Type: "Work" }
        ]
    });

    // Register Person with multiple detail queries
    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String" },
            { name: "LastName", type: "String" }
        ],
        queries: ["Addresses", "PhoneNumbers"]
    }, class extends VirtualPersistentObjectActions {
        onConstruct(obj: VirtualPersistentObject): void {
            constructCalled = true;
            super.onConstruct(obj);

            // Check if detail queries are available
            if (obj.queries && obj.queries.length > 0) {
                queriesAvailable = true;
                capturedQueryNames = obj.queries.map(q => q.name);

                // Check that none of the queries have been executed yet
                queriesNotExecuted = obj.queries.every(q => !q.hasSearched);
            }
        }
    });

    await service.initialize();

    await service.getPersistentObject(null, "Person", "123");

    expect(constructCalled).toBe(true);
    expect(queriesAvailable).toBe(true);
    expect(capturedQueryNames).toContain("Addresses");
    expect(capturedQueryNames).toContain("PhoneNumbers");
    expect(queriesNotExecuted).toBe(true);
});
