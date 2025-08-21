import { test as base, expect } from '@playwright/test';
import { Service, Query, QueryResultItem } from "@vidyano/core";

type Fixtures = {
    service: Service;
    peopleQuery: Query;
    pageSize: number;
    totalItems: number;
    fakeQueryResultItem: QueryResultItem;
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
        const query = await service.getQuery("People", {
            textSearch: "FirstName:A*" // Use text search to get a smaller dataset for faster tests
        });

        expect(query.totalItems).toBeGreaterThan(query.pageSize);        
        await use(query);
    },
    pageSize: async ({ peopleQuery }, use) => {
        expect(peopleQuery.pageSize).toBeGreaterThan(0);
        await use(peopleQuery.pageSize);
    },
    totalItems: async ({ peopleQuery }, use) => {
        expect(peopleQuery.totalItems).toBeGreaterThan(0);
        await use(peopleQuery.totalItems);
    },
    fakeQueryResultItem: async ({ service, peopleQuery }, use) => {
        const item = new QueryResultItem(service, { id: 'fake-id', values: [] }, peopleQuery, false);
        await use(item);
    }
});

/**
 * Helper function to verify lazy loading behavior
 * Temporarily disables lazy loading to check if items are loaded or not
 */
async function withDisabledLazyLoading<T>(query: Query, fn: () => T | Promise<T>): Promise<T> {
    const originalValue = query.disableLazyLoading;
    try {
        query.disableLazyLoading = true;
        return await fn();
    } finally {
        query.disableLazyLoading = originalValue;
    }
}

/**
 * Verifies that items at the given indexes are not loaded yet
 */
async function verifyItemsNotLoaded(query: Query, ...indexes: number[]): Promise<void> {
    await withDisabledLazyLoading(query, () => {
        for (const index of indexes) {
            const item = query.items[index];
            // Unloaded items are undefined when disableLazyLoading is true
            expect(item).toBeUndefined();
        }
    });
}

/**
 * Verifies that items at the given indexes are loaded
 */
async function verifyItemsLoaded(query: Query, ...indexes: number[]): Promise<void> {
    await withDisabledLazyLoading(query, () => {
        for (const index of indexes) {
            const item = query.items[index];
            expect(item).toBeInstanceOf(QueryResultItem);
        }
    });
}

test.describe('QueryItems async methods', () => {
    
    test('verifies lazy loading behavior', async ({ peopleQuery, pageSize, totalItems }) => {
        // Verify first page is loaded
        await verifyItemsLoaded(peopleQuery, 0, pageSize - 1);
        
        // Verify items beyond first page are NOT loaded
        await verifyItemsNotLoaded(peopleQuery, pageSize, pageSize + 10, pageSize + 50);
        
        // Access an item beyond first page using async method
        const secondPageItems = await peopleQuery.items.sliceAsync(pageSize + 10, pageSize + 20);
        expect(secondPageItems.length).toBe(10);
        
        // Now verify those items ARE loaded
        await verifyItemsLoaded(peopleQuery, pageSize + 10, pageSize + 19);
        
        // But items further out should still not be loaded
        if (totalItems > pageSize + 100) {
            await verifyItemsNotLoaded(peopleQuery, pageSize + 100);
        }
    });
    
    test('forEachAsync should iterate through all items', async ({ peopleQuery, pageSize, totalItems }) => {
        // Verify items beyond first page are not loaded initially
        await verifyItemsNotLoaded(peopleQuery, pageSize + 10, pageSize * 2, pageSize * 5);
        
        let count = 0;
        const genders = new Set<string>();
        
        // Process ALL items - this should load all pages as needed
        await peopleQuery.items.forEachAsync((item, index) => {
            count++;
            genders.add(item.values['Gender']);
            
            // Verify item is not null
            expect(item).toBeInstanceOf(QueryResultItem);
            expect(index).toBe(count - 1);
        });
        
        expect(count).toBe(totalItems);
        expect(genders.size).toBeGreaterThan(0); // Should have at least one gender
        
        // After forEachAsync, all items should be loaded
        await verifyItemsLoaded(peopleQuery, pageSize + 10, pageSize * 2, pageSize * 5);
    });
    
    test('mapAsync should transform all items', async ({ peopleQuery, pageSize, totalItems }) => {
        // Verify items beyond first page are not loaded initially
        await verifyItemsNotLoaded(peopleQuery, pageSize + 10, pageSize * 3);
        
        // Map ALL items to their emails - this should load all pages as needed
        const emails = await peopleQuery.items.mapAsync(async (item) => {
            return item.values['Email'];
        });
        
        expect(emails.length).toBe(totalItems);
        expect(emails.every(email => typeof email === 'string')).toBe(true);
        
        // After mapAsync, all items should be loaded
        await verifyItemsLoaded(peopleQuery, pageSize + 10, pageSize * 3);
    });
    
    test('filterAsync should filter all items based on predicate', async ({ peopleQuery, pageSize }) => {
        // Verify items beyond first page are not loaded initially
        await verifyItemsNotLoaded(peopleQuery, pageSize + 10, pageSize * 4);
        
        // Filter ALL items for active people - this should load all pages as needed
        const activeItems = await peopleQuery.items.filterAsync(item => {
            return item.values['IsActive'] === true;
        });
        
        expect(activeItems).toBeInstanceOf(Array);
        expect(activeItems.every(item => item instanceof QueryResultItem)).toBe(true);
        expect(activeItems.every(item => item.values['IsActive'] === true)).toBe(true);
        
        // After filterAsync, all items should be loaded
        await verifyItemsLoaded(peopleQuery, pageSize + 10, pageSize * 4);
    });
    
    test('toArrayAsync should return all items as array', async ({ peopleQuery, pageSize, totalItems }) => {
        // Verify items beyond first page are not loaded initially
        await verifyItemsNotLoaded(peopleQuery, pageSize + 5, pageSize * 2 + 10, pageSize * 6);
        
        // Get all items as array - this should load all pages as needed
        const allItems = await peopleQuery.items.toArrayAsync();
        expect(allItems.length).toBe(totalItems);
        expect(allItems.every(item => item instanceof QueryResultItem)).toBe(true);
        
        // After toArrayAsync, all items should be loaded
        await verifyItemsLoaded(peopleQuery, pageSize + 5, pageSize * 2 + 10, pageSize * 6);
    });
    
    test('sliceAsync should return a range of items', async ({ peopleQuery, pageSize, totalItems }) => {
        // We know we have ~947 items with "FirstName:A*" filter, so we have at least 9 pages
        // Assert minimum requirements for this test
        expect(totalItems).toBeGreaterThan(pageSize * 3); // Need at least 3 full pages
        
        // First, get a slice that crosses the page boundary between page 0 and 1
        // This should load both the first and second page entirely
        const crossPageSlice = await peopleQuery.items.sliceAsync(pageSize - 10, pageSize + 10);
        expect(crossPageSlice.length).toBe(20);
        expect(crossPageSlice.every(item => item instanceof QueryResultItem)).toBe(true);
        
        // Verify that both pages are now fully loaded
        await verifyItemsLoaded(peopleQuery, 0, pageSize - 1); // First page (0-99)
        await verifyItemsLoaded(peopleQuery, pageSize, pageSize * 2 - 1); // Second page (100-199)
        
        // Now verify that the THIRD page (200-299) is NOT loaded yet
        const thirdPageStart = pageSize * 2; // 200
        const thirdPageEnd = pageSize * 3 - 1; // 299
        
        // Verify third page items are NOT loaded
        await verifyItemsNotLoaded(peopleQuery, thirdPageStart, thirdPageStart + 10, thirdPageEnd);
        
        // Now get a slice from the third page
        const thirdPageSlice = await peopleQuery.items.sliceAsync(thirdPageStart + 10, thirdPageStart + 30);
        expect(thirdPageSlice.length).toBe(20);
        expect(thirdPageSlice.every(item => item instanceof QueryResultItem)).toBe(true);
        
        // Verify the entire third page is now loaded
        await verifyItemsLoaded(peopleQuery, thirdPageStart, thirdPageEnd);
        
        // Test slice beyond total items should return only available items
        const beyondSlice = await peopleQuery.items.sliceAsync(totalItems - 5, totalItems + 10);
        expect(beyondSlice.length).toBe(5);
    });
    
    test('findAsync should find first matching item', async ({ peopleQuery, pageSize }) => {
        // FIRST: Test finding an item deep in results BEFORE loading everything
        const deepIndex = pageSize * 8; // Item 800 (in the 9th page)
        
        // Verify the deep item is not loaded yet
        await verifyItemsNotLoaded(peopleQuery, deepIndex);
        
        // Find the item at a specific deep index
        const deepItem = await peopleQuery.items.findAsync((_item, index) => 
            index === deepIndex
        );
        
        expect(deepItem).toBeInstanceOf(QueryResultItem);
        
        // Verify the item is now loaded
        await verifyItemsLoaded(peopleQuery, deepIndex);
        
        // SECOND: Find first male (should be early in the results)
        const maleItem = await peopleQuery.items.findAsync(item => 
            item.values['Gender'] === 'Male'
        );
        
        expect(maleItem).toBeInstanceOf(QueryResultItem);
        expect(maleItem!.values['Gender']).toBe('Male');
        
        // LAST: Find non-existent item - this will check ALL items and load everything
        const notFound = await peopleQuery.items.findAsync(item => 
            item.values['FirstName'] === 'ThisNameDoesNotExist123456'
        );
        
        expect(notFound).toBeUndefined();
        
        // After searching for non-existent item, ALL items should be loaded
        await verifyItemsLoaded(peopleQuery, 0, pageSize * 2, pageSize * 5, pageSize * 9);
    });
    
    test('findIndexAsync should find index of first matching item', async ({ peopleQuery }) => {
        
        // Find index of first female
        const femaleIndex = await peopleQuery.items.findIndexAsync(item => 
            item.values['Gender'] === 'Female'
        );
        
        expect(femaleIndex).toBeGreaterThanOrEqual(0);
        
        // Verify the item at that index is indeed female
        if (femaleIndex >= 0) {
            const items = await peopleQuery.items.sliceAsync(femaleIndex, femaleIndex + 1);
            expect(items[0].values['Gender']).toBe('Female');
        }
        
        // Find index of non-existent item - will check ALL items
        const notFoundIndex = await peopleQuery.items.findIndexAsync(item => 
            item.values['FirstName'] === 'ThisNameDoesNotExist123456'
        );
        
        expect(notFoundIndex).toBe(-1);
    });
    
    test('someAsync should check if any item matches predicate', async ({ peopleQuery, pageSize }) => {
        // Verify items beyond first page are not loaded initially
        await verifyItemsNotLoaded(peopleQuery, pageSize + 10, pageSize * 3);
        
        // Check if there are any active people (should find one early and stop)
        const hasActive = await peopleQuery.items.someAsync(item => 
            item.values['IsActive'] === true
        );
        
        expect(typeof hasActive).toBe('boolean');
        
        // Check for males (should find one early and stop)
        const hasMales = await peopleQuery.items.someAsync(item => 
            item.values['Gender'] === 'Male'
        );
        
        expect(hasMales).toBe(true); // Should have males
        
        // Note: someAsync may not load all pages if it finds a match early
        // Let's verify items deep in the results are still not loaded
        await verifyItemsNotLoaded(peopleQuery, pageSize * 8);
        
        // Check for non-existent value - will check ALL items
        const hasNonExistent = await peopleQuery.items.someAsync(item => 
            item.values['FirstName'] === 'ThisNameDoesNotExist123456'
        );
        
        expect(hasNonExistent).toBe(false);
        
        // After searching for non-existent item, all items should be loaded
        await verifyItemsLoaded(peopleQuery, pageSize * 3, pageSize * 8);
    });
    
    test('everyAsync should check if all items match predicate', async ({ peopleQuery }) => {
        // Use filtered query for testing
        peopleQuery.textSearch = "Gender:Female";
        await peopleQuery.search();
        
        if (peopleQuery.totalItems > 0) {
            // Check ALL items are female
            const allFemale = await peopleQuery.items.everyAsync(item => {
                return item.values['Gender'] === 'Female';
            });
            
            expect(allFemale).toBe(true);
        }
        
        // Check that not all have a specific name
        await peopleQuery.search(); // Reset to all items
        const allJohn = await peopleQuery.items.everyAsync(item => {
            return item.values['FirstName'] === 'John';
        });
        
        expect(allJohn).toBe(false);
    });
    
    test('includesAsync should check if array includes specific item', async ({ peopleQuery, fakeQueryResultItem }) => {
        
        // Get first item
        const firstItem = await peopleQuery.items.findAsync(() => true);
        
        if (firstItem) {
            // Check if array includes this item
            const includesFirst = await peopleQuery.items.includesAsync(firstItem);
            expect(includesFirst).toBe(true);
            
            // Check with fromIndex
            const includesFromIndex1 = await peopleQuery.items.includesAsync(firstItem, 1);
            expect(includesFromIndex1).toBe(false); // First item is at index 0
        }
        
        // Create a fake item that's not in the query
        const includesFake = await peopleQuery.items.includesAsync(fakeQueryResultItem);
        expect(includesFake).toBe(false);
    });
    
    test('indexOfAsync should find index of specific item', async ({ peopleQuery, fakeQueryResultItem }) => {
        
        // Get item at index 5
        const items = await peopleQuery.items.sliceAsync(5, 6);
        const fifthItem = items[0];
        
        if (fifthItem) {
            // Find index of this item
            const indexOf5 = await peopleQuery.items.indexOfAsync(fifthItem);
            expect(indexOf5).toBe(5);
            
            // Check with fromIndex
            const indexFrom10 = await peopleQuery.items.indexOfAsync(fifthItem, 10);
            expect(indexFrom10).toBe(-1); // Item is at index 5, before 10
        }
        
        // Check for non-existent item - will check ALL items
        const indexOfFake = await peopleQuery.items.indexOfAsync(fakeQueryResultItem);
        expect(indexOfFake).toBe(-1);
    });
    
    test('reduceAsync should reduce all items to single value', async ({ peopleQuery, pageSize, totalItems }) => {
        // Verify items beyond first page are not loaded initially
        await verifyItemsNotLoaded(peopleQuery, pageSize + 20, pageSize * 3, pageSize * 7);
        
        // Count ALL active people - this should load all pages as needed
        const activeCount = await peopleQuery.items.reduceAsync((acc, item) => {
            return acc + (item.values['IsActive'] === true ? 1 : 0);
        }, 0);
        
        expect(typeof activeCount).toBe('number');
        expect(activeCount).toBeGreaterThanOrEqual(0);
        expect(activeCount).toBeLessThanOrEqual(totalItems);
        
        // After first reduce, all items should be loaded
        await verifyItemsLoaded(peopleQuery, pageSize + 20, pageSize * 3, pageSize * 7);
        
        // Collect unique genders from ALL items (items already loaded from first reduce)
        const genders = await peopleQuery.items.reduceAsync((acc, item) => {
            acc.add(item.values['Gender']);
            return acc;
        }, new Set<string>());
        
        expect(genders).toBeInstanceOf(Set);
        expect(genders.size).toBeGreaterThan(0);
        expect(genders.size).toBeLessThanOrEqual(3); // Male, Female and Unknown
    });
    
    test('async methods should handle empty queries', async ({ peopleQuery, fakeQueryResultItem }) => {
        // Search for something that doesn't exist
        peopleQuery.textSearch = "FirstName:ThisNameDoesNotExist123456";
        await peopleQuery.search();
        
        expect(peopleQuery.totalItems).toBe(0);
        
        // Test all methods with empty result set
        let forEachCount = 0;
        await peopleQuery.items.forEachAsync(() => { forEachCount++; });
        expect(forEachCount).toBe(0);
        
        const mapped = await peopleQuery.items.mapAsync(item => item.values['Email']);
        expect(mapped).toEqual([]);
        
        const filtered = await peopleQuery.items.filterAsync(() => true);
        expect(filtered).toEqual([]);
        
        const array = await peopleQuery.items.toArrayAsync();
        expect(array).toEqual([]);
        
        const slice = await peopleQuery.items.sliceAsync(0, 10);
        expect(slice).toEqual([]);
        
        const found = await peopleQuery.items.findAsync(() => true);
        expect(found).toBeUndefined();
        
        const foundIndex = await peopleQuery.items.findIndexAsync(() => true);
        expect(foundIndex).toBe(-1);
        
        const some = await peopleQuery.items.someAsync(() => true);
        expect(some).toBe(false);
        
        const every = await peopleQuery.items.everyAsync(() => false);
        expect(every).toBe(true); // vacuous truth
        
        const includes = await peopleQuery.items.includesAsync(fakeQueryResultItem);
        expect(includes).toBe(false);
        
        const indexOf = await peopleQuery.items.indexOfAsync(fakeQueryResultItem);
        expect(indexOf).toBe(-1);
        
        // reduceAsync with no initial value on empty array should throw
        await expect(peopleQuery.items.reduceAsync((acc) => acc)).rejects.toThrow('Reduce of empty array with no initial value');
        
        // With initial value should work
        const reduced = await peopleQuery.items.reduceAsync((acc) => acc + 1, 0);
        expect(reduced).toBe(0);
    });
});