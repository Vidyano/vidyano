import { test as base, expect } from "@playwright/test";
import { Service, ServiceHooks, Query } from "@vidyano/core";
import { devBackendUrl } from "./_helpers/dev-backend";

/**
 * Grouped People (10,000 rows, pageSize 100): lazy page loads and the query's group objects.
 * Every ExecuteQuery response carries the groupingInfo, so a page load must keep the existing groups when they did not change.
 */

/** Counts the ExecuteQuery requests, can make them fail like a network error and can change their responses. */
class GroupingHooks extends ServiceHooks {
    executeQueries = 0;
    fail = false;
    /** Optionally changes the result of an ExecuteQuery response */
    rewrite: ((result: any) => void) | null = null;

    override async onFetch(request: Request): Promise<Response> {
        if (!request.url.endsWith("/ExecuteQuery"))
            return super.onFetch(request);

        this.executeQueries++;
        if (this.fail)
            throw new TypeError("Failed to fetch");

        const response = await super.onFetch(request);
        if (!this.rewrite)
            return response;

        const json = await response.json();
        if (json.result)
            this.rewrite(json.result);

        return new Response(JSON.stringify(json), { status: response.status, headers: response.headers });
    }
}

type Fixtures = {
    hooks: GroupingHooks;
    people: Query;
    query: Query;
};

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        await use(new GroupingHooks());
    },

    people: async ({ hooks }, use) => {
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        await use(await service.getQuery("People"));
    },

    query: async ({ people }, use) => {
        await people.group("Gender");
        await use(people);
    },
});

test.describe("Query grouping and lazy page loads", () => {
    test("a group's items include its last row", async ({ query }) => {
        const group = query.groupingInfo.groups[0];
        expect(group.end).toBe(group.start + group.count - 1);

        // Loads the page that holds the group's last row
        const [last] = await query.items.sliceAsync(group.end, group.end + 1);

        expect(group.items).toHaveLength(group.count);
        expect(group.items[group.count - 1] === last, "the last row is in the group").toBe(true);
    });

    test("a page load keeps the group objects when the groups did not change", async ({ query, hooks }) => {
        const groupingInfo = query.groupingInfo;
        const groups = [...groupingInfo.groups];
        expect(groupingInfo.groupedBy).toBe("Gender");
        expect(groups.length).toBeGreaterThan(1);
        expect(groups.reduce((n, g) => n + g.count, 0)).toBe(10_000);

        groups[0].isCollapsed = true;

        const changes: string[] = [];
        query.propertyChanged.attach((_, args) => changes.push(args.propertyName));

        const executeQueries = hooks.executeQueries;
        const items = await query.items.sliceAsync(5000, 5000 + query.pageSize);
        expect(items.length).toBe(query.pageSize);
        expect(hooks.executeQueries).toBe(executeQueries + 1);

        // Identity checks as booleans: a failing toBe would try to print the query
        expect(query.groupingInfo === groupingInfo, "the groupingInfo is kept").toBe(true);
        expect(query.groupingInfo.groups).toHaveLength(groups.length);
        expect(query.groupingInfo.groups.every((g, i) => g === groups[i]), "the group objects are kept").toBe(true);
        expect(query.groupingInfo.groups[0].isCollapsed).toBe(true);
        expect(changes).not.toContain("groupingInfo");

        // The kept group that holds the loaded page lists its items
        const group = groups.find(g => g.start <= 5000 && g.end > 5000);
        expect(group.items[5000 - group.start] === items[0], "the loaded item is in its group").toBe(true);
    });

    test("a refresh after a page load drops the items that are no longer loaded from the kept groups", async ({ query }) => {
        const groups = [...query.groupingInfo.groups];
        const group = groups.find(g => g.start <= 5000 && g.end > 5000);
        const index = 5000 - group.start;

        await query.items.sliceAsync(5000, 5000 + query.pageSize);
        expect(group.items[index]).toBeDefined();

        await query.search();

        expect(query.groupingInfo.groups.every((g, i) => g === groups[i]), "the group objects are kept").toBe(true);
        expect(group.items).toHaveLength(group.count);
        expect(group.items[index] == null, "the item of the page that is no longer loaded is dropped").toBe(true);
        expect(groups[0].items[0] === query.items[0], "the first page is in the first group").toBe(true);
    });

    test("a page load updates the groups when they changed", async ({ query, hooks }) => {
        const groupingInfo = query.groupingInfo;
        const [first, second] = groupingInfo.groups;
        first.isCollapsed = true;

        // The second page sees one row moved from the first group to the second
        hooks.rewrite = result => {
            result.groupingInfo.groups[0].count--;
            result.groupingInfo.groups[1].count++;
        };

        await query.items.sliceAsync(5000, 5000 + query.pageSize);

        expect(query.groupingInfo === groupingInfo, "the groupingInfo is replaced").toBe(false);
        expect(query.groupingInfo.groupedBy).toBe("Gender");

        const [newFirst, newSecond] = query.groupingInfo.groups;
        expect(newFirst.name).toBe(first.name);
        expect(newFirst.count).toBe(first.count - 1);
        expect(newFirst.start).toBe(0);
        expect(newFirst.end).toBe(first.count - 2);
        expect(newFirst.isCollapsed).toBe(true);

        expect(newSecond.name).toBe(second.name);
        expect(newSecond.count).toBe(second.count + 1);
        expect(newSecond.start).toBe(first.count - 1);
        expect(newSecond.isCollapsed).toBe(false);
        expect(query.groupingInfo.groups.reduce((n, g) => n + g.count, 0)).toBe(10_000);
    });
});

test.describe("Query grouping on an empty result", () => {
    // The service sends no groupingInfo for an empty grouped result
    test("grouping an empty result keeps the grouping for the next search", async ({ people }) => {
        people.textSearch = "zzzzqqq";
        await people.search();
        expect(people.totalItems).toBe(0);

        await people.group("Gender");
        expect(people.groupingInfo?.groupedBy).toBe("Gender");
        expect(people.groupingInfo.groups).toHaveLength(0);

        people.textSearch = "";
        await people.search();
        expect(people.groupingInfo?.groupedBy).toBe("Gender");
        expect(people.groupingInfo.groups.length).toBeGreaterThan(1);
        expect(people.groupingInfo.groups.reduce((n, g) => n + g.count, 0)).toBe(10_000);
    });

    test("a search with no rows keeps the grouping", async ({ query }) => {
        query.textSearch = "zzzzqqq";
        await query.search();
        expect(query.totalItems).toBe(0);
        expect(query.groupingInfo?.groupedBy).toBe("Gender");
        expect(query.groupingInfo.groups).toHaveLength(0);
    });

    test("removing the grouping on an empty result clears it", async ({ query }) => {
        query.textSearch = "zzzzqqq";
        await query.search();

        await query.group("");
        expect(query.groupingInfo).toBeNull();

        query.textSearch = "";
        await query.search();
        expect(query.groupingInfo).toBeNull();
    });
});

test.describe("A group by that fails", () => {
    test("can be tried again", async ({ people, hooks }) => {
        await people.search();
        expect(people.groupingInfo).toBeNull();

        hooks.fail = true;
        expect(await people.group("Gender")).toBeNull();
        expect(people.groupingInfo).toBeNull();

        hooks.fail = false;
        const executeQueries = hooks.executeQueries;
        await people.group("Gender");
        expect(hooks.executeQueries).toBe(executeQueries + 1);
        expect(people.groupingInfo?.groupedBy).toBe("Gender");
        expect(people.groupingInfo.groups.length).toBeGreaterThan(1);
    });

    test("keeps the grouping of the last result", async ({ query, hooks }) => {
        const groupingInfo = query.groupingInfo;

        hooks.fail = true;
        await query.group("FirstName");

        // Identity check as a boolean: a failing toBe would try to print the query
        expect(query.groupingInfo === groupingInfo, "the groupingInfo is kept").toBe(true);

        hooks.fail = false;
        const executeQueries = hooks.executeQueries;
        await query.group("FirstName");
        expect(hooks.executeQueries).toBe(executeQueries + 1);
        expect(query.groupingInfo?.groupedBy).toBe("FirstName");
    });

    test("keeps the groups of a later page load", async ({ query, hooks }) => {
        const original = query.groupingInfo;
        // The page sees one row moved from the first group to the second
        hooks.rewrite = result => {
            result.groupingInfo.groups[0].count--;
            result.groupingInfo.groups[1].count++;
        };
        await query.items.sliceAsync(5000, 5000 + query.pageSize);
        hooks.rewrite = null;
        expect(query.groupingInfo !== original, "the page load replaced the groupingInfo").toBe(true);
        const groupingInfo = query.groupingInfo;

        hooks.fail = true;
        await query.group("FirstName");

        expect(query.groupingInfo === groupingInfo, "the groupingInfo of the page load is kept").toBe(true);
    });

    test("keeps the grouping it tried to remove", async ({ query, hooks }) => {
        hooks.fail = true;
        await query.group("");

        expect(query.groupingInfo?.groupedBy).toBe("Gender");
    });
});
