import { test, expect } from "@playwright/test";
import { Application, Service } from "@vidyano/core";
import { TestInfo } from "@playwright/test";
import { BackendProcess, startBackend, stopBackend } from "./_helpers/backend";

let backend: BackendProcess;

test.describe.serial("Core service backend", () => {
    test.beforeAll(async ({}, testInfo: TestInfo) => {
        backend = await startBackend(testInfo, "persistent-object-visibility/persistent-object-visibility.cs");
    });

    test.afterAll(async () => {
        await stopBackend(backend);
    });

    test("should initialize service and load application", async () => {
        const service = new Service(`http://localhost:${backend.port}`, undefined, false);
        const app = await service.initialize(false);

        expect(app).toBeInstanceOf(Application);
        expect(service.isSignedIn).toBe(true);
        expect(app.friendlyUserName).toBe("admin");

        await service.signOut();
    });
});
