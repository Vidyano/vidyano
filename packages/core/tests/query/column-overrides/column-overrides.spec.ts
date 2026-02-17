import { test, expect, TestInfo } from "@playwright/test";
import { Service, Query, QueryColumn } from "@vidyano/core";
import { startBackend, stopBackend, BackendProcess } from "../../_helpers/backend";

let backend: BackendProcess;

test.describe.serial("Column Overrides - includeAllContent", () => {
    test.beforeAll(async ({}, testInfo: TestInfo) => {
        backend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(backend);
    });

    async function createService(): Promise<Service> {
        const service = new Service(`http://localhost:${backend.port}`, undefined, false);
        await service.initialize(true);
        await service.signInUsingDefaultCredentials();
        return service;
    }

    test("query returns items with Content column", async () => {
        const service = await createService();
        const query = await service.getQuery("Articles");
        await query.search();

        expect(query.totalItems).toBe(2);

        const contentColumn = query.columns.find(c => c.name === "Content");
        expect(contentColumn).toBeInstanceOf(QueryColumn);

        const firstItem = await query.items.atAsync(0);
        expect(firstItem!.getValue("Title")).toBe("First Article");
    });

    test("content is truncated by default for long values", async () => {
        const service = await createService();
        const query = await service.getQuery("Articles");
        await query.search();

        const firstItem = await query.items.atAsync(0);
        const contentValue = firstItem!.getValue("Content") as string;

        // The seeded content is 500 characters of 'A'
        // With QueryMaxContentLength, it should be truncated
        expect(contentValue.length).toBeLessThan(500);
    });

    test("includeAllContent returns full content when set on column", async () => {
        const service = await createService();
        const query = await service.getQuery("Articles");

        const contentColumn = query.columns.find(c => c.name === "Content")!;
        contentColumn.includeAllContent = true;

        await query.search();

        const firstItem = await query.items.atAsync(0);
        const contentValue = firstItem!.getValue("Content") as string;

        expect(contentValue.length).toBe(500);
    });

    test("includeAllContent persists across searches", async () => {
        const service = await createService();
        const query = await service.getQuery("Articles");

        const contentColumn = query.columns.find(c => c.name === "Content")!;
        contentColumn.includeAllContent = true;

        await query.search();
        expect(contentColumn.includeAllContent).toBe(true);

        await query.search();
        expect(contentColumn.includeAllContent).toBe(true);

        const firstItem = await query.items.atAsync(0);
        const contentValue = firstItem!.getValue("Content") as string;
        expect(contentValue.length).toBe(500);
    });

    test("removing includeAllContent resumes default behavior", async () => {
        const service = await createService();
        const query = await service.getQuery("Articles");

        const contentColumn = query.columns.find(c => c.name === "Content")!;

        // First search with includeAllContent
        contentColumn.includeAllContent = true;
        await query.search();
        const fullItem = await query.items.atAsync(0);
        const fullContentLength = (fullItem!.getValue("Content") as string).length;

        // Second search without includeAllContent
        contentColumn.includeAllContent = false;
        await query.search();
        const truncatedItem = await query.items.atAsync(0);
        const truncatedContentLength = (truncatedItem!.getValue("Content") as string).length;

        expect(fullContentLength).toBeGreaterThan(truncatedContentLength);
    });
});
