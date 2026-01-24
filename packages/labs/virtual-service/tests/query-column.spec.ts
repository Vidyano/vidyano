import { test, expect } from "@playwright/test";
import { VirtualService } from "../src/index.js";
// Import polyfills required for array extensions
import "@vidyano/core";

test("derives columns from PersistentObject attributes", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Id", type: "String" },
            { name: "FirstName", type: "String", label: "First Name" },
            { name: "LastName", type: "String" },
            { name: "Age", type: "Int32" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();

    const query = await service.getQuery("People");

    expect(query.columns).toHaveLength(4);

    // Verify first column
    expect(query.columns[0].id).toBe("Id");
    expect(query.columns[0].name).toBe("Id");
    expect(query.columns[0].label).toBe("Id");
    expect(query.columns[0].type).toBe("String");
    expect(query.columns[0].offset).toBe(0);

    // Verify second column with explicit label
    expect(query.columns[1].id).toBe("FirstName");
    expect(query.columns[1].name).toBe("FirstName");
    expect(query.columns[1].label).toBe("First Name");
    expect(query.columns[1].type).toBe("String");
    expect(query.columns[1].offset).toBe(1);

    // Verify third column - should humanize label
    expect(query.columns[2].id).toBe("LastName");
    expect(query.columns[2].name).toBe("LastName");
    expect(query.columns[2].label).toBe("Last Name");
    expect(query.columns[2].type).toBe("String");
    expect(query.columns[2].offset).toBe(2);

    // Verify fourth column with Int32 type
    expect(query.columns[3].id).toBe("Age");
    expect(query.columns[3].name).toBe("Age");
    expect(query.columns[3].type).toBe("Int32");
    expect(query.columns[3].offset).toBe(3);
});

test("maps visibility 'Always' to isHidden=false", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Name", type: "String", visibility: "Always" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].isHidden).toBe(false);
});

test("maps visibility 'Read' to isHidden=false", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Name", type: "String", visibility: "Read" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].isHidden).toBe(false);
});

test("maps visibility 'Query' to isHidden=false", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Status", type: "String", visibility: "Query" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].isHidden).toBe(false);
});

test("maps visibility 'New' to isHidden=true", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "CreatedDate", type: "DateTime", visibility: "New" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].isHidden).toBe(true);
});

test("maps visibility 'Never' to isHidden=true", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "InternalId", type: "String", visibility: "Never" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].isHidden).toBe(true);
});

test("maps compound visibility 'Read, Query' to isHidden=false", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Name", type: "String", visibility: "Read, Query" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].isHidden).toBe(false);
});

test("maps undefined visibility to isHidden=false (default)", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Name", type: "String" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].isHidden).toBe(false);
});

test("canSort defaults to true when not specified", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String" },
            { name: "LastName", type: "String" },
            { name: "Email", type: "String" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].canSort).toBe(true);
    expect(query.columns[1].canSort).toBe(true);
    expect(query.columns[2].canSort).toBe(true);
});

test("canSort can be explicitly set to false", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Description", type: "String", canSort: false }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].canSort).toBe(false);
});

test("canSort can be explicitly set to true", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Name", type: "String", canSort: true }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].canSort).toBe(true);
});

test("preserves different attribute types", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Id", type: "String" },
            { name: "Name", type: "String" },
            { name: "Age", type: "Int32" },
            { name: "Salary", type: "Decimal" },
            { name: "IsActive", type: "Boolean" },
            { name: "BirthDate", type: "Date" },
            { name: "CreatedAt", type: "DateTime" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].type).toBe("String");
    expect(query.columns[1].type).toBe("String");
    expect(query.columns[2].type).toBe("Int32");
    expect(query.columns[3].type).toBe("Decimal");
    expect(query.columns[4].type).toBe("Boolean");
    expect(query.columns[5].type).toBe("Date");
    expect(query.columns[6].type).toBe("DateTime");
});

test("defaults type to String when not specified", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Name" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].type).toBe("String");
});

test("sets query capabilities correctly", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Name", type: "String" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].canFilter).toBe(false);
    expect(query.columns[0].canGroupBy).toBe(false);
    expect(query.columns[0].canListDistincts).toBe(false);
});

test("initializes selectedDistincts as empty array", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Name", type: "String" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].selectedDistincts).toEqual([]);
    expect(query.columns[0].selectedDistinctsInversed).toBe(false);
});

test("respects custom offset values", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "Name", type: "String", offset: 10 },
            { name: "Age", type: "Int32", offset: 5 },
            { name: "Email", type: "String", offset: 20 }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    // Columns are sorted by offset
    expect(query.columns[0].offset).toBe(5);
    expect(query.columns[1].offset).toBe(10);
    expect(query.columns[2].offset).toBe(20);
});

test("humanizes column labels correctly", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String" },
            { name: "LastName", type: "String" },
            { name: "EmailAddress", type: "String" },
            { name: "PhoneNumber1", type: "String" },
            { name: "isActive", type: "Boolean" }
        ]
    });

    service.registerQuery({
        name: "People",
        persistentObject: "Person",
    });

    await service.initialize();
    const query = await service.getQuery("People");

    expect(query.columns[0].label).toBe("First Name");
    expect(query.columns[1].label).toBe("Last Name");
    expect(query.columns[2].label).toBe("Email Address");
    expect(query.columns[3].label).toBe("Phone Number 1");
    expect(query.columns[4].label).toBe("is Active");
});
