import { test as base, expect } from "@playwright/test";
import {
    Service,
    Query,
    QueryResultItem,
    PersistentObject,
    QueryColumn,
    Action
} from "@vidyano/core";

type Fixtures = {
    service: Service;
    peopleQuery: Query;
};

const test = base.extend<Fixtures>({
    service: async ({}, use) => {
        const service = new Service("http://localhost:5000", undefined, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        await service.executeAction("PersistentObject.ResetTest", service.application);
        await use(service);
    },

    peopleQuery: async ({ service }, use) => {
        const peopleQuery = await service.getQuery("People");
        await use(peopleQuery);
    },
});

test.describe("Query", () => {
    test.describe("Basic Query Loading", () => {
        test("loads query with correct metadata", async ({ peopleQuery }) => {
            expect(peopleQuery).toBeInstanceOf(Query);
            expect(peopleQuery.name).toBe("People");
            expect(Array.isArray(peopleQuery.items)).toBe(true);
            expect(peopleQuery.items.length).toBe(10_000);
            expect(peopleQuery.totalItems).toBe(10_000);
            expect(peopleQuery.pageSize).toBe(100);
        });

        test("loads query in lookup mode", async ({ service }) => {
            const peopleLookup = await service.getQuery("People", {
                asLookup: true,
            });
            expect(peopleLookup).toBeInstanceOf(Query);
            expect(peopleLookup.asLookup).toBe(true);
        });

        test("loads query with text search parameter", async ({ service }) => {
            const searchResults = await service.getQuery("People", {
                textSearch: "John",
            });
            expect(searchResults).toBeInstanceOf(Query);
            expect(searchResults.textSearch).toBe("John");
        });

        test("exposes query capability flags", async ({ peopleQuery }) => {
            expect(typeof peopleQuery.canRead).toBe("boolean");
            expect(typeof peopleQuery.canFilter).toBe("boolean");
            expect(typeof peopleQuery.canReorder).toBe("boolean");
        });
    });

    test.describe("Query Result Items and Lazy Loading", () => {
        test("retrieves single item by index", async ({ peopleQuery }) => {
            const [firstPerson] = await peopleQuery.getItemsByIndex(0);
            expect(firstPerson).toBeInstanceOf(QueryResultItem);
            expect(typeof firstPerson.id).toBe("string");
            expect(typeof firstPerson.getValue).toBe("function");
        });

        test("retrieves multiple items by specific indexes", async ({ peopleQuery }) => {
            const items = await peopleQuery.getItemsByIndex(0, 2, 4, 5);
            expect(items).toHaveLength(4);
            expect(items[0]).toBeInstanceOf(QueryResultItem);
            expect(items[1]).toBeInstanceOf(QueryResultItem);
            expect(items[2]).toBeInstanceOf(QueryResultItem);
            expect(items[3]).toBeInstanceOf(QueryResultItem);
        });

        test("retrieves non-contiguous items by indexes", async ({ peopleQuery }) => {
            const items = await peopleQuery.getItemsByIndex(1, 3, 7);
            expect(items).toHaveLength(3);
            expect(items[0]).toBeInstanceOf(QueryResultItem);
            expect(items[1]).toBeInstanceOf(QueryResultItem);
            expect(items[2]).toBeInstanceOf(QueryResultItem);
        });

        test("loads item lazily by index", async ({ peopleQuery }) => {
            const [loadedItem] = await peopleQuery.getItemsByIndex(2);
            expect(loadedItem).toBeInstanceOf(QueryResultItem);
        });

        test("retrieves attribute values from query result item", async ({ peopleQuery }) => {
            const [person] = await peopleQuery.getItemsByIndex(0);
            expect(person).toBeInstanceOf(QueryResultItem);

            const firstName = person.getValue("FirstName");
            const email = person.getValue("Email");
            expect(typeof firstName).toBe("string");
            expect(typeof email).toBe("string");
        });
    });

    test.describe("Searching and Filtering", () => {
        test("filters results using text search", async ({ peopleQuery }) => {
            const initialCount = peopleQuery.totalItems;

            peopleQuery.textSearch = "John";
            await peopleQuery.search();

            const afterSearchCount = peopleQuery.totalItems;
            const loadedItems = await peopleQuery.getItemsByIndex(0, 1, 2, 3, 4);
            const allResultsContainJohn = loadedItems.filter(item => item != null).every((item) => {
                const firstName = item.getValue("FirstName");
                const lastName = item.getValue("LastName");
                return (
                    firstName.toLowerCase().includes("john") ||
                    lastName.toLowerCase().includes("john")
                );
            });

            expect(peopleQuery.textSearch).toBe("John");
            expect(afterSearchCount).toBeLessThan(initialCount);
            expect(allResultsContainJohn).toBe(true);
        });

        test("clears text search and restores full results", async ({ peopleQuery }) => {
            peopleQuery.textSearch = "John";
            await peopleQuery.search();
            const withSearchCount = peopleQuery.totalItems;

            peopleQuery.textSearch = "";
            await peopleQuery.search();

            expect(peopleQuery.textSearch).toBe("");
            expect(peopleQuery.totalItems).toBeGreaterThan(withSearchCount);
        });

        test("searches with keepSelection and throwExceptions options", async ({ peopleQuery }) => {
            await peopleQuery.search({
                keepSelection: true,
                throwExceptions: true,
            });
            expect(peopleQuery.isBusy).toBe(false);
        });

        test("filters by column distinct values", async ({ peopleQuery }) => {
            const initialCount = peopleQuery.totalItems;
            const genderColumn = peopleQuery.columns.find((c) => c.name === "Gender")!;
            expect(genderColumn).toBeInstanceOf(QueryColumn);

            await genderColumn.refreshDistincts();
            const allDistincts = [...(genderColumn.distincts.matching || []), ...(genderColumn.distincts.remaining || [])];
            expect(allDistincts.length).toBeGreaterThan(0);

            const firstDistinctValue = allDistincts[0];
            const displayValue = firstDistinctValue.split('|').pop();

            genderColumn.selectedDistincts = [firstDistinctValue];
            await peopleQuery.search();

            const loadedItems = await peopleQuery.getItemsByIndex(0, 1, 2, 3, 4);
            const allMatchFilter = loadedItems.every((item) => {
                return item.getValue("Gender") === displayValue;
            });

            expect(peopleQuery.totalItems).toBeLessThan(initialCount);
            expect(allMatchFilter).toBe(true);
            expect(peopleQuery.isFiltering).toBe(true);
        });
    });

    test.describe("Pagination", () => {
        test("exposes pagination properties", async ({ peopleQuery }) => {
            const loadedItemsCount = peopleQuery.items.filter(item => item !== null).length;

            expect(peopleQuery.pageSize).toBeGreaterThan(0);
            expect(peopleQuery.totalItems).toBeGreaterThan(0);
            expect(peopleQuery.items.length).toBe(peopleQuery.totalItems);
            expect(loadedItemsCount).toBe(Math.min(peopleQuery.pageSize, peopleQuery.totalItems));
            expect(typeof peopleQuery.hasMore).toBe("boolean");
        });

        test("loads next page of results", async ({ peopleQuery }) => {
            test.skip(peopleQuery.hasMore === false, "Query does not have more pages");

            const loadedCountBefore = peopleQuery.items.filter(i => i !== null).length;
            await peopleQuery.getItems(peopleQuery.pageSize, peopleQuery.pageSize);
            const loadedCountAfter = peopleQuery.items.filter(i => i !== null).length;

            expect(loadedCountAfter).toBeGreaterThan(loadedCountBefore);
        });

        test("loads specific range of items", async ({ peopleQuery }) => {
            const pageSize = peopleQuery.pageSize;
            const totalItems = peopleQuery.totalItems;
            const requiredMinimum = pageSize + 15;
            expect(totalItems).toBeGreaterThan(requiredMinimum);

            const startIndex = pageSize + 10;
            const count = 5;

            const itemsBeforeLoad = peopleQuery.items.slice(startIndex, startIndex + count);
            expect(itemsBeforeLoad.every(item => item === null)).toBe(true);

            const rangeItems = await peopleQuery.getItems(startIndex, count);

            const itemsAfterLoad = peopleQuery.items.slice(startIndex, startIndex + count);
            for (const item of itemsAfterLoad) {
                expect(item).toBeInstanceOf(QueryResultItem);
            }
            for (const item of rangeItems) {
                expect(item).toBeInstanceOf(QueryResultItem);
                expect(typeof item.id).toBe("string");
            }
        });
    });

    test.describe("Sorting", () => {
        test("clears existing sort options", async ({ peopleQuery }) => {
            const initialSortOptions = peopleQuery.sortOptions || [];
            peopleQuery.sortOptions = [];
            await peopleQuery.search();
            expect(Array.isArray(peopleQuery.sortOptions)).toBe(true);
        });

        test("sorts ascending by FirstName column", async ({ peopleQuery }) => {
            const firstNameColumn = peopleQuery.columns.find((c) => c.name === "FirstName")!;
            expect(firstNameColumn).toBeInstanceOf(QueryColumn);
            expect(firstNameColumn.canSort).toBe(true);

            peopleQuery.sortOptions = [{ name: "FirstName", direction: "ASC" }];
            await peopleQuery.search();

            const sortOption = peopleQuery.sortOptions?.[0];
            expect(sortOption?.name).toBe("FirstName");
            expect(sortOption?.direction).toBe("ASC");
        });

        test("sorts descending by FirstName column", async ({ peopleQuery }) => {
            const firstNameColumn = peopleQuery.columns.find((c) => c.name === "FirstName")!;
            expect(firstNameColumn).toBeInstanceOf(QueryColumn);
            expect(firstNameColumn.canSort).toBe(true);

            peopleQuery.sortOptions = [{ name: "FirstName", direction: "DESC" }];
            await peopleQuery.search();

            const sortOption = peopleQuery.sortOptions?.[0];
            expect(sortOption?.name).toBe("FirstName");
            expect(sortOption?.direction).toBe("DESC");
        });

        test("applies multiple column sorts in order", async ({ peopleQuery }) => {
            peopleQuery.sortOptions = [
                { name: "FirstName", direction: "ASC" },
                { name: "LastName", direction: "DESC" },
            ];
            await peopleQuery.search();

            expect(peopleQuery.sortOptions).toHaveLength(2);
            expect(peopleQuery.sortOptions[0].name).toBe("FirstName");
            expect(peopleQuery.sortOptions[0].direction).toBe("ASC");
            expect(peopleQuery.sortOptions[1].name).toBe("LastName");
            expect(peopleQuery.sortOptions[1].direction).toBe("DESC");
        });
    });

    test.describe("Query Actions", () => {
        test("exposes query actions collection", async ({ peopleQuery }) => {
            expect(Array.isArray(peopleQuery.actions)).toBe(true);
            expect(peopleQuery.actions.length).toBeGreaterThan(0);
        });

        test("executes RefreshQuery action", async ({ peopleQuery }) => {
            const refreshAction = peopleQuery.getAction("RefreshQuery");
            expect(refreshAction).toBeInstanceOf(Action);
            expect(refreshAction.canExecute).toBe(true);

            await refreshAction.execute();
            expect(peopleQuery.isBusy).toBe(false);
        });
    });

    test.describe("Events and Notifications", () => {
        test("fires property change events", async ({ peopleQuery }) => {
            const propertyChanges: string[] = [];
            const disposer = peopleQuery.propertyChanged.attach((sender, args) => {
                propertyChanges.push(args.propertyName);
            });

            peopleQuery.textSearch = "test";
            await peopleQuery.search();

            disposer();
            expect(propertyChanges.length).toBeGreaterThan(0);
        });

        test("sets notification with Info type", async ({ peopleQuery }) => {
            peopleQuery.setNotification("Test Info", "OK");
            expect(peopleQuery.notification).toBe("Test Info");
            expect(peopleQuery.notificationType).toBe("OK");

        });

        test("sets notification with Warning type", async ({ peopleQuery }) => {
            peopleQuery.setNotification("Test Warning", "Warning");
            expect(peopleQuery.notification).toBe("Test Warning");
            expect(peopleQuery.notificationType).toBe("Warning");
        });

        test("sets notification with Error type", async ({ peopleQuery }) => {
            peopleQuery.setNotification("Test Error", "Error");
            expect(peopleQuery.notification).toBe("Test Error");
            expect(peopleQuery.notificationType).toBe("Error");
        });

        test("clears notification", async ({ peopleQuery }) => {
            peopleQuery.setNotification("Test", "OK");
            peopleQuery.setNotification();
            expect(peopleQuery.notification).toBeNull();
        });
    });

    test.describe("Advanced Patterns", () => {
        test("gets PersistentObject from query item", async ({ peopleQuery }) => {
            const [firstPerson] = await peopleQuery.getItemsByIndex(0);
            const personPO = await firstPerson.getPersistentObject();

            expect(personPO).toBeInstanceOf(PersistentObject);
            expect(personPO.objectId).toBe(firstPerson.id);
            expect(personPO.type).toBe("Person");
        });

        test("triggers async loading on direct array access beyond first page", async ({ peopleQuery }) => {
            const pageSize = peopleQuery.pageSize;
            const totalItems = peopleQuery.totalItems;
            const requiredMinimum = pageSize + 10;
            expect(totalItems).toBeGreaterThan(requiredMinimum);

            const testIndex = pageSize + 10;
            let becameBusy = false;
            const disposer = peopleQuery.propertyChanged.attach((sender, args) => {
                if (args.propertyName === "isBusy" && peopleQuery.isBusy) {
                    becameBusy = true;
                }
            });

            const initialAccess = peopleQuery.items[testIndex];
            expect(initialAccess).toBeNull();

            await new Promise((resolve) => setTimeout(resolve, 500));
            disposer();

            const afterWaitAccess = peopleQuery.items[testIndex];
            expect(afterWaitAccess).toBeInstanceOf(QueryResultItem);
            expect(becameBusy).toBe(true);
        });
    });
});