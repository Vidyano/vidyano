import { test as base, expect } from "@playwright/test";
import { Service, ServiceHooks, Query, QueryResultItem, Action, ExecuteActionArgs, PersistentObject } from "@vidyano/core";
import { devBackendUrl } from "./_helpers/dev-backend";

/**
 * The built-in AddReference action on Person_Addresses, which has a lookup over the addresses of the other people (dev AddressActions).
 * Adding changes the in-memory dev data, so every test resets it with PersistentObject.ResetTest.
 */

/** Picks in the lookup with `select`, records the AddReference requests, can answer them with an error, handle the action itself or refuse a confirmation. */
class AddReferenceHooks extends ServiceHooks {
    select: ((lookup: Query) => Promise<QueryResultItem[]>) | null = null;
    requests: any[] = [];
    error: string | null = null;
    handleAddReference = false;
    handledIds: string[] | null = null;
    confirm = true;

    override onAction(args: ExecuteActionArgs): Promise<PersistentObject> {
        if (this.handleAddReference && args.action === "AddReference") {
            this.handledIds = args.selectedItems.map(i => i.id);
            args.isHandled = true;

            return Promise.resolve(null);
        }

        return super.onAction(args);
    }

    override onActionConfirmation(action: Action, option: number): Promise<boolean> {
        return Promise.resolve(this.confirm);
    }

    override onSelectReference(query: Query): Promise<QueryResultItem[]> {
        return this.select ? this.select(query) : super.onSelectReference(query);
    }

    override async onFetch(request: Request): Promise<Response> {
        if (request.url.endsWith("/ExecuteAction")) {
            const body = await request.clone().json();
            if (body.action === "Query.AddReference") {
                this.requests.push(body);

                if (this.error)
                    return new Response(JSON.stringify({ exception: this.error }), { headers: { "Content-Type": "application/json" } });
            }
        }

        return super.onFetch(request);
    }
}

type Fixtures = {
    hooks: AddReferenceHooks;
    addresses: Query;
};

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        await use(new AddReferenceHooks());
    },

    addresses: async ({ hooks }, use) => {
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        await service.executeAction("PersistentObject.ResetTest", service.application);

        const person = await service.getPersistentObject(null, "Person", "123");
        const addresses = person.queries.find(q => q.name === "Person_Addresses") as Query;
        await addresses.search();

        await use(addresses);

        await service.executeAction("PersistentObject.ResetTest", service.application);
    },
});

const addReference = (addresses: Query) => addresses.actions.find(a => a.name === "AddReference") as Action;

test.describe("Built-in AddReference", () => {
    test("select-all with one unticked row adds every other lookup row, also the ones never loaded", async ({ hooks, addresses }) => {
        const before = addresses.totalItems;
        let total: number, loaded: number, unticked: string;
        hooks.select = async lookup => {
            await lookup.search();
            total = lookup.totalItems;
            loaded = lookup.items.filter(i => !!i).length;

            lookup.selectAll.allSelected = true;
            lookup.items[0].isSelected = false;
            unticked = lookup.items[0].id;

            return lookup.selectedItems;
        };

        await addReference(addresses).execute();
        expect(loaded).toBeLessThan(total - 1);

        // The lookup clone goes along with its select-all and only the unticked row, to skip
        expect(hooks.requests.map(r => ({ allSelected: r.query.allSelected, allSelectedInversed: r.query.allSelectedInversed, selectedIds: r.selectedItems.map((i: any) => i.id) })))
            .toEqual([{ allSelected: true, allSelectedInversed: true, selectedIds: [unticked] }]);

        await addresses.search();
        expect(addresses.totalItems).toBe(before + total - 1);
    });

    test("cancelling the dialog sends nothing", async ({ hooks, addresses }) => {
        const before = addresses.totalItems;
        hooks.select = async () => [];

        await addReference(addresses).execute();
        expect(hooks.requests).toEqual([]);

        await addresses.search();
        expect(addresses.totalItems).toBe(before);
    });

    test("an error of the service shows on the query of the grid", async ({ hooks, addresses }) => {
        hooks.select = async lookup => {
            await lookup.search();
            lookup.items[0].isSelected = true;

            return lookup.selectedItems;
        };
        hooks.error = "Limit reached";

        await addReference(addresses).execute().catch(() => {});
        expect(hooks.requests.length).toBe(1);
        expect(addresses.notification).toBe("Limit reached");
        expect(addresses.notificationType).toBe("Error");
    });

    test("an app's onAction gets the picked references and can stop the request", async ({ hooks, addresses }) => {
        let picked: string;
        hooks.select = async lookup => {
            await lookup.search();
            lookup.items[0].isSelected = true;
            picked = lookup.items[0].id;

            return lookup.selectedItems;
        };
        hooks.handleAddReference = true;

        await addReference(addresses).execute();
        expect(picked).toBeTruthy();
        expect(hooks.handledIds).toStrictEqual([picked]);
        expect(hooks.requests).toEqual([]);
    });

    test("a refused confirmation shows no dialog and sends nothing", async ({ hooks, addresses }) => {
        let asked = false;
        hooks.select = async () => {
            asked = true;
            return [];
        };
        hooks.confirm = false;

        // The dev AddReference has no confirmation, the test gives it one
        const action = addReference(addresses);
        Object.defineProperty(action.definition, "confirmation", { value: "Add the addresses?" });

        await action.execute();
        expect(asked).toBe(false);
        expect(hooks.requests).toEqual([]);
    });
});
