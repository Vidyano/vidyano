import { test, expect } from "@playwright/test";
import { VirtualService } from "../src/index.js";
// Import polyfills required for array extensions
import "@vidyano/core";

test.describe("Basic Setup", () => {
    test("successfully registers a query with valid configuration", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Id", type: "String" },
                { name: "FirstName", type: "String" },
                { name: "LastName", type: "String" }
            ]
        });

        service.registerQuery({
            name: "People",
            persistentObject: "Person",
            data: [
                { id: "1", FirstName: "John", LastName: "Doe" },
                { id: "2", FirstName: "Jane", LastName: "Smith" }
            ]
        });

        await service.initialize();

        const query = await service.getQuery("People");
        expect(query).toBeDefined();
        expect(query.name).toBe("People");
    });

    test("throws error when name is missing", () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [{ name: "Id", type: "String" }]
        });

        expect(() => {
            service.registerQuery({
                name: "",
                persistentObject: "Person"
            });
        }).toThrow("VirtualQueryConfig.name is required");
    });

    test("throws error when persistentObject is missing", () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [{ name: "Id", type: "String" }]
        });

        expect(() => {
            service.registerQuery({
                name: "People",
                persistentObject: ""
            });
        }).toThrow("VirtualQueryConfig.persistentObject is required");
    });

    test("allows query with no data (empty result)", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [{ name: "Id", type: "String" }]
        });

        service.registerQuery({
            name: "People",
            persistentObject: "Person"
        });

        await service.initialize();

        const query = await service.getQuery("People");
        expect(query).toBeDefined();
        expect(query.name).toBe("People");
        expect(query.totalItems).toBe(0);
    });

    test("getQuery returns Query with correct properties", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Id", type: "String" },
                { name: "FirstName", type: "String" },
                { name: "LastName", type: "String" }
            ]
        });

        service.registerQuery({
            name: "People",
            label: "All People",
            persistentObject: "Person",
            data: [
                { id: "1", FirstName: "John", LastName: "Doe" },
                { id: "2", FirstName: "Jane", LastName: "Smith" }
            ]
        });

        await service.initialize();

        const query = await service.getQuery("People");

        expect(query).toBeDefined();
        expect(query.name).toBe("People");
        expect(query.label).toBe("All People");
        expect(query.id).toBeDefined();
    });

    test("getQuery includes columns from PersistentObject", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Id", type: "String" },
                { name: "FirstName", type: "String" },
                { name: "LastName", type: "String" },
                { name: "Age", type: "Int32" }
            ]
        });

        service.registerQuery({
            name: "People",
            persistentObject: "Person"
        });

        await service.initialize();

        const query = await service.getQuery("People");

        expect(query.columns).toBeDefined();
        expect(query.columns).toHaveLength(4);
        expect(query.columns[0].name).toBe("Id");
        expect(query.columns[1].name).toBe("FirstName");
        expect(query.columns[2].name).toBe("LastName");
        expect(query.columns[3].name).toBe("Age");
    });

    test("query defaults pageSize to 20 when not specified", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [{ name: "Id", type: "String" }]
        });

        service.registerQuery({
            name: "People",
            persistentObject: "Person"
        });

        await service.initialize();

        const query = await service.getQuery("People");

        expect(query.pageSize).toBe(20);
    });

    test("query respects custom pageSize", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [{ name: "Id", type: "String" }]
        });

        service.registerQuery({
            name: "People",
            persistentObject: "Person",
            pageSize: 50
        });

        await service.initialize();

        const query = await service.getQuery("People");

        expect(query.pageSize).toBe(50);
    });

    test("query defaults allowTextSearch to true", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [{ name: "Id", type: "String" }]
        });

        service.registerQuery({
            name: "People",
            persistentObject: "Person"
        });

        await service.initialize();

        const query = await service.getQuery("People");

        expect(query.allowTextSearch).toBe(true);
    });

    test("query sets allowTextSearch from config", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [{ name: "Id", type: "String" }]
        });

        service.registerQuery({
            name: "People",
            persistentObject: "Person",
            allowTextSearch: false
        });

        await service.initialize();

        const query = await service.getQuery("People");

        expect(query.allowTextSearch).toBe(false);
    });

    test("throws error for unregistered query", async () => {
        const service = new VirtualService();
        await service.initialize();

        let error: any;
        try {
            await service.getQuery("UnknownQuery");
        } catch (e) {
            error = e;
        }

        expect(error).toBeDefined();
        expect(error).toBe("Query 'UnknownQuery' is not registered");
    });

    test("throws error if PersistentObject not registered", () => {
        const service = new VirtualService();

        expect(() => {
            service.registerQuery({
                name: "People",
                persistentObject: "Person"
            });
        }).toThrow("PersistentObject type 'Person' must be registered before creating a query");
    });
});


test.describe("Search", () => {
    test("returns query with items and properties", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Id", type: "String" },
                { name: "FirstName", type: "String" },
                { name: "LastName", type: "String" }
            ]
        });

        service.registerQuery({
            name: "People",
            persistentObject: "Person",
            data: [
                { id: "1", FirstName: "John", LastName: "Doe" },
                { id: "2", FirstName: "Jane", LastName: "Smith" },
                { id: "3", FirstName: "Bob", LastName: "Johnson" }
            ]
        });

        await service.initialize();

        const query = await service.getQuery("People");

        expect(query).toBeDefined();
        expect(query.items).toBeDefined();
        expect(query.totalItems).toBe(3);
        expect(query.columns).toBeDefined();
        expect(query.columns).toHaveLength(3);
    });

    test.describe("pagination", () => {
        test("loads first page correctly", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "FirstName", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                pageSize: 2,
                data: [
                    { id: "1", FirstName: "John" },
                    { id: "2", FirstName: "Jane" },
                    { id: "3", FirstName: "Bob" },
                    { id: "4", FirstName: "Alice" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");

            expect(query.totalItems).toBe(4);
            expect(query.pageSize).toBe(2);

            const firstPage = await query.items.sliceAsync(0, 2);
            expect(firstPage).toHaveLength(2);
            expect(firstPage[0].values.FirstName).toBe("John");
            expect(firstPage[1].values.FirstName).toBe("Jane");
        });

        test("loads subsequent pages", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "FirstName", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                pageSize: 2,
                data: [
                    { id: "1", FirstName: "John" },
                    { id: "2", FirstName: "Jane" },
                    { id: "3", FirstName: "Bob" },
                    { id: "4", FirstName: "Alice" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");

            const secondPage = await query.items.sliceAsync(2, 4);
            expect(secondPage).toHaveLength(2);
            expect(secondPage[0].values.FirstName).toBe("Bob");
            expect(secondPage[1].values.FirstName).toBe("Alice");
            expect(query.totalItems).toBe(4);
        });

        test("handles last page with remaining items", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "FirstName", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                pageSize: 2,
                data: [
                    { id: "1", FirstName: "John" },
                    { id: "2", FirstName: "Jane" },
                    { id: "3", FirstName: "Bob" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");

            const lastPage = await query.items.sliceAsync(2, 4);
            expect(lastPage).toHaveLength(1);
            expect(lastPage[0].values.FirstName).toBe("Bob");
            expect(query.totalItems).toBe(3);
        });

        test("returns empty when accessing beyond data range", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "FirstName", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", FirstName: "John" },
                    { id: "2", FirstName: "Jane" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");

            const beyondData = await query.items.sliceAsync(10, 12);
            expect(beyondData).toHaveLength(0);
            expect(query.totalItems).toBe(2);
        });

        test("respects pageSize configuration", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "FirstName", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                pageSize: 2,
                data: [
                    { id: "1", FirstName: "John" },
                    { id: "2", FirstName: "Jane" },
                    { id: "3", FirstName: "Bob" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");

            expect(query.totalItems).toBe(3);
            expect(query.pageSize).toBe(2);
        });
    });

    test.describe("primitives", () => {
        test("converts to correct types (string, number, boolean, Date)", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "Name", type: "String" },
                    { name: "Age", type: "Int32" },
                    { name: "IsActive", type: "Boolean" },
                    { name: "BirthDate", type: "Date" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    {
                        id: "1",
                        Name: "John Doe",
                        Age: 30,
                        IsActive: true,
                        BirthDate: new Date(1994, 0, 15)
                    }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");

            expect(query.items).toHaveLength(1);

            const item = await query.items.atAsync(0);
            expect(item).toBeDefined();
            expect(item!.values.Name).toBe("John Doe");
            expect(item!.values.Age).toBe(30);
            expect(item!.values.IsActive).toBe(true);
            expect(item!.values.BirthDate).toBeInstanceOf(Date);
        });

        test("handles null values for nullable types", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "Name", type: "String" },
                    { name: "Age", type: "NullableInt32" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    {
                        id: "1",
                        Name: "John",
                        Age: null
                    }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");

            expect(query.items).toHaveLength(1);

            const item = await query.items.atAsync(0);
            expect(item).toBeDefined();
            expect(item!.values.Age).toBe(null);
        });
    });

    test.describe("textSearch", () => {
        test("finds matches across multiple columns", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "FirstName", type: "String" },
                    { name: "LastName", type: "String" },
                    { name: "Email", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", FirstName: "John", LastName: "Doe", Email: "john@example.com" },
                    { id: "2", FirstName: "Jane", LastName: "Smith", Email: "jane@example.com" },
                    { id: "3", FirstName: "Bob", LastName: "Johnson", Email: "bob@test.com" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.textSearch = "john";
            await query.search();

            expect(query.totalItems).toBe(2);
            const allItems = await query.items.toArrayAsync();
            const firstNames = allItems.map(item => item.values.FirstName);
            expect(firstNames).toContain("John");
            expect(firstNames).toContain("Bob");
        });

        test("is case-insensitive", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "Name", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", Name: "John Doe" },
                    { id: "2", Name: "JANE SMITH" },
                    { id: "3", Name: "bob johnson" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");

            query.textSearch = "JOHN";
            await query.search();
            expect(query.totalItems).toBe(2);

            query.textSearch = "jane";
            await query.search();
            expect(query.totalItems).toBe(1);

            query.textSearch = "JoHnSoN";
            await query.search();
            expect(query.totalItems).toBe(1);
        });

        test("returns empty when no matches found", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "Name", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", Name: "John Doe" },
                    { id: "2", Name: "Jane Smith" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.textSearch = "xyz";
            await query.search();

            expect(query.items).toHaveLength(0);
            expect(query.totalItems).toBe(0);
        });

        test("returns all items when search string is empty", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "Name", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", Name: "John Doe" },
                    { id: "2", Name: "Jane Smith" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.textSearch = "";
            await query.search();

            expect(query.totalItems).toBe(2);
        });

        test("searches only visible string columns", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "Name", type: "String" },
                    { name: "Age", type: "Int32" },
                    { name: "SecretCode", type: "String", visibility: "Never" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", Name: "John", Age: 30, SecretCode: "special" },
                    { id: "2", Name: "Jane", Age: 25, SecretCode: "normal" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");

            query.textSearch = "special";
            await query.search();
            expect(query.totalItems).toBe(0);

            query.textSearch = "30";
            await query.search();
            expect(query.totalItems).toBe(0);

            query.textSearch = "John";
            await query.search();
            expect(query.totalItems).toBe(1);
        });
    });
});

test.describe("Sorting", () => {
    test.describe("single column", () => {
        test("ascending order", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "Name", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", Name: "Charlie" },
                    { id: "2", Name: "Alice" },
                    { id: "3", Name: "Bob" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.sortOptions = [{ name: "Name", direction: "ASC" }];
            await query.search();

            const allItems = await query.items.toArrayAsync();
            expect(allItems).toHaveLength(3);
            const names = allItems.map(item => item.values.Name);
            expect(names).toEqual(["Alice", "Bob", "Charlie"]);
        });

        test("descending order", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "Name", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", Name: "Charlie" },
                    { id: "2", Name: "Alice" },
                    { id: "3", Name: "Bob" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.sortOptions = [{ name: "Name", direction: "DESC" }];
            await query.search();

            const allItems = await query.items.toArrayAsync();
            expect(allItems).toHaveLength(3);
            const names = allItems.map(item => item.values.Name);
            expect(names).toEqual(["Charlie", "Bob", "Alice"]);
        });
    });

    test.describe("multiple columns", () => {
        test("primary and secondary sort", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "LastName", type: "String" },
                    { name: "FirstName", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", LastName: "Smith", FirstName: "Charlie" },
                    { id: "2", LastName: "Smith", FirstName: "Alice" },
                    { id: "3", LastName: "Doe", FirstName: "Bob" },
                    { id: "4", LastName: "Smith", FirstName: "Bob" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.sortOptions = [
                { name: "LastName", direction: "ASC" },
                { name: "FirstName", direction: "ASC" }
            ];
            await query.search();

            const allItems = await query.items.toArrayAsync();
            expect(allItems).toHaveLength(4);
            const names = allItems.map(item => `${item.values.FirstName} ${item.values.LastName}`);
            expect(names).toEqual(["Bob Doe", "Alice Smith", "Bob Smith", "Charlie Smith"]);
        });

        test("mixed directions (ASC and DESC)", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "LastName", type: "String" },
                    { name: "FirstName", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", LastName: "Smith", FirstName: "Bob" },
                    { id: "2", LastName: "Doe", FirstName: "Alice" },
                    { id: "3", LastName: "Smith", FirstName: "Alice" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.sortOptions = [
                { name: "LastName", direction: "ASC" },
                { name: "FirstName", direction: "DESC" }
            ];
            await query.search();

            const allItems = await query.items.toArrayAsync();
            expect(allItems).toHaveLength(3);
            const names = allItems.map(item => `${item.values.FirstName} ${item.values.LastName}`);
            expect(names).toEqual(["Alice Doe", "Bob Smith", "Alice Smith"]);
        });
    });

    test.describe("null handling", () => {
        test("nulls sort first", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "Name", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", Name: "Charlie" },
                    { id: "2", Name: null },
                    { id: "3", Name: "Alice" },
                    { id: "4", Name: undefined }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.sortOptions = [{ name: "Name", direction: "ASC" }];
            await query.search();

            const allItems = await query.items.toArrayAsync();
            expect(allItems).toHaveLength(4);
            const names = allItems.map(item => item.values.Name);
            expect(names[0]).toBeNull();
            expect(names[1]).toBeNull();
            expect(names[2]).toBe("Alice");
            expect(names[3]).toBe("Charlie");
        });
    });

    test.describe("type-aware", () => {
        test("string comparison is case-insensitive", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "Name", type: "String" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", Name: "zebra" },
                    { id: "2", Name: "APPLE" },
                    { id: "3", Name: "Banana" }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.sortOptions = [{ name: "Name", direction: "ASC" }];
            await query.search();

            const allItems = await query.items.toArrayAsync();
            expect(allItems).toHaveLength(3);
            const names = allItems.map(item => item.values.Name);
            expect(names).toEqual(["APPLE", "Banana", "zebra"]);
        });

        test("numeric comparison (not lexical)", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "Age", type: "Int32" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", Age: 30 },
                    { id: "2", Age: 5 },
                    { id: "3", Age: 100 },
                    { id: "4", Age: 25 }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.sortOptions = [{ name: "Age", direction: "ASC" }];
            await query.search();

            const allItems = await query.items.toArrayAsync();
            expect(allItems).toHaveLength(4);
            const ages = allItems.map(item => item.values.Age);
            expect(ages).toEqual([5, 25, 30, 100]);
        });

        test("Date comparison", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "BirthDate", type: "Date" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", Id: "1", BirthDate: new Date(1990, 5, 15) },
                    { id: "2", Id: "2", BirthDate: new Date(1985, 2, 20) },
                    { id: "3", Id: "3", BirthDate: new Date(2000, 11, 1) }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.sortOptions = [{ name: "BirthDate", direction: "ASC" }];
            await query.search();

            const allItems = await query.items.toArrayAsync();
            expect(allItems).toHaveLength(3);
            const ids = allItems.map(item => item.values.Id);
            expect(ids).toEqual(["2", "1", "3"]);
        });

        test("boolean comparison", async () => {
            const service = new VirtualService();

            service.registerPersistentObject({
                type: "Person",
                attributes: [
                    { name: "Id", type: "String" },
                    { name: "IsActive", type: "Boolean" }
                ]
            });

            service.registerQuery({
                name: "People",
                persistentObject: "Person",
                data: [
                    { id: "1", IsActive: true },
                    { id: "2", IsActive: false },
                    { id: "3", IsActive: true },
                    { id: "4", IsActive: false }
                ]
            });

            await service.initialize();

            const query = await service.getQuery("People");
            query.sortOptions = [{ name: "IsActive", direction: "ASC" }];
            await query.search();

            const allItems = await query.items.toArrayAsync();
            expect(allItems).toHaveLength(4);
            const isActiveValues = allItems.map(item => item.values.IsActive);
            expect(isActiveValues[0]).toBe(false);
            expect(isActiveValues[1]).toBe(false);
            expect(isActiveValues[2]).toBe(true);
            expect(isActiveValues[3]).toBe(true);
        });
    });

    test("combined with text search", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Id", type: "String" },
                { name: "Name", type: "String" },
                { name: "Age", type: "Int32" }
            ]
        });

        service.registerQuery({
            name: "People",
            persistentObject: "Person",
            data: [
                { id: "1", Name: "John Doe", Age: 30 },
                { id: "2", Name: "Jane Smith", Age: 25 },
                { id: "3", Name: "Bob Johnson", Age: 35 },
                { id: "4", Name: "Alice Jones", Age: 28 }
            ]
        });

        await service.initialize();

        const query = await service.getQuery("People");
        query.textSearch = "jo";
        query.sortOptions = [{ name: "Age", direction: "ASC" }];
        await query.search();

        expect(query.totalItems).toBe(3);
        const allItems = await query.items.toArrayAsync();
        const names = allItems.map(item => item.values.Name);
        expect(names).toEqual(["Alice Jones", "John Doe", "Bob Johnson"]);
    });
});
