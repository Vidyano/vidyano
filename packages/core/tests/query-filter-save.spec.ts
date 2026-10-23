import { test as base, expect } from "@playwright/test";
import { Service, ServiceHooks, Query, QueryFilter } from "@vidyano/core";

/**
 * A failed QueryFilters.save keeps the current filter and the column filters as they are.
 * Saving a filter with an empty Name fails on the server (Name is required).
 */

/** Counts the ExecuteQuery requests (searches) the service sends and optionally fails the saves. */
class SearchCountingHooks extends ServiceHooks {
    searches = 0;
    failSave = false;

    override onFetch(request: Request): Promise<Response> {
        if (request.url.endsWith("/ExecuteQuery"))
            this.searches++;
        else if (this.failSave && request.url.endsWith("/ExecuteAction"))
            return Promise.resolve(new Response(JSON.stringify({ exception: "pw-save-failed" }), { status: 200, headers: { "Content-Type": "application/json" } }));

        return super.onFetch(request);
    }
}

type Fixtures = {
    hooks: SearchCountingHooks;
    peopleQuery: Query;
};

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        await use(new SearchCountingHooks());
    },

    peopleQuery: async ({ hooks }, use) => {
        const service = new Service("http://localhost:5000", hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        const query = await service.getQuery("People");

        await use(query);

        // Remove the filters saved by the test
        for (const filter of query.filters.filters.filter(f => f.name.startsWith("pw-")))
            await query.filters.delete(filter);
    },
});

/** Selects Gender Female and creates a new current filter, as the column filter of the query grid does. */
async function filterOnFemale(query: Query): Promise<QueryFilter> {
    query.getColumn("Gender").selectedDistincts = ["|Female"];
    await query.search();

    const filter = await query.filters.createNew();
    query.filters.currentFilter = filter;

    return filter;
}

/** Saves a new filter with the given name. */
async function saveAs(query: Query, name: string): Promise<boolean> {
    const filter = await query.filters.createNew();
    filter.persistentObject.attributes["Name"].setValue(name);

    return query.filters.save(filter);
}

test.describe("Saving Query Filters", () => {
    test("keeps the column filters and the current filter when saving a new filter fails", async ({ hooks, peopleQuery }) => {
        const currentFilter = await filterOnFemale(peopleQuery);
        const totalItems = peopleQuery.totalItems;
        const searches = hooks.searches;

        const result = await saveAs(peopleQuery, "");

        expect(result).toBe(false);
        expect(peopleQuery.filters.currentFilter).toBe(currentFilter);
        expect(peopleQuery.getColumn("Gender").selectedDistincts).toEqual(["|Female"]);
        expect(peopleQuery.getColumn("Gender").selectedDistinctsInversed).toBe(false);
        expect(peopleQuery.filters.filters.some(f => f.name === "")).toBe(false);
        await peopleQuery.queueWork(async () => null);
        expect(hooks.searches).toBe(searches);
        expect(peopleQuery.totalItems).toBe(totalItems);
    });

    test("saves a new filter after a failed save", async ({ peopleQuery }) => {
        const name = `pw-b17-${Date.now()}`;
        await filterOnFemale(peopleQuery);
        expect(await saveAs(peopleQuery, "")).toBe(false);

        const result = await saveAs(peopleQuery, name);

        expect(result).toBe(true);
        expect(peopleQuery.filters.filters.filter(f => f.name === name)).toHaveLength(1);
        expect(peopleQuery.filters.currentFilter).toBe(peopleQuery.filters.getFilter(name));
        expect(peopleQuery.filters.currentFilter.persistentObject.isNew).toBe(false);
        expect(JSON.parse(peopleQuery.filters.currentFilter.persistentObject.getAttributeValue("Columns"))).toEqual([{ name: "Gender", includes: ["|Female"], excludes: [] }]);
        expect(peopleQuery.getColumn("Gender").selectedDistincts).toEqual(["|Female"]);
    });

    test("keeps the loaded saved filter and its unsaved column changes when saving a new filter fails", async ({ hooks, peopleQuery }) => {
        const name = `pw-b17-${Date.now()}`;
        await filterOnFemale(peopleQuery);
        expect(await saveAs(peopleQuery, name)).toBe(true);

        peopleQuery.getColumn("Gender").selectedDistincts = ["|Female", "|Male"];
        await peopleQuery.search();
        const totalItems = peopleQuery.totalItems;
        const searches = hooks.searches;

        const result = await saveAs(peopleQuery, "");

        expect(result).toBe(false);
        expect(peopleQuery.filters.currentFilter).toBeInstanceOf(QueryFilter);
        expect(peopleQuery.filters.currentFilter.name).toBe(name);
        expect(peopleQuery.filters.currentFilter).toBe(peopleQuery.filters.getFilter(name));
        expect(peopleQuery.filters.filters.filter(f => f.name === name)).toHaveLength(1);
        expect(peopleQuery.getColumn("Gender").selectedDistincts).toEqual(["|Female", "|Male"]);
        await peopleQuery.queueWork(async () => null);
        expect(hooks.searches).toBe(searches);
        expect(peopleQuery.totalItems).toBe(totalItems);
    });

    test("keeps the loaded saved filter and its unsaved column changes when saving it fails on the server", async ({ hooks, peopleQuery }) => {
        const name = `pw-b17-${Date.now()}`;
        await filterOnFemale(peopleQuery);
        expect(await saveAs(peopleQuery, name)).toBe(true);

        peopleQuery.getColumn("Gender").selectedDistincts = ["|Female", "|Male"];
        await peopleQuery.search();
        const totalItems = peopleQuery.totalItems;
        const searches = hooks.searches;
        hooks.failSave = true;

        const result = await peopleQuery.filters.save();
        hooks.failSave = false;

        expect(result).toBe(false);
        expect(peopleQuery.filters.currentFilter).toBeInstanceOf(QueryFilter);
        expect(peopleQuery.filters.currentFilter.name).toBe(name);
        expect(peopleQuery.filters.currentFilter).toBe(peopleQuery.filters.getFilter(name));
        expect(peopleQuery.getColumn("Gender").selectedDistincts).toEqual(["|Female", "|Male"]);
        await peopleQuery.queueWork(async () => null);
        expect(hooks.searches).toBe(searches);
        expect(peopleQuery.totalItems).toBe(totalItems);
    });
});
