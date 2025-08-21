import { test as base, expect } from '@playwright/test';
import { Service, ServiceHooks } from "@vidyano/core";

const DEV_SERVER_URL = "http://localhost:5000";

type ServiceFixtures = {
    service: Service;
};

const test = base.extend<ServiceFixtures>({
    service: async ({}, use) => {
        const serviceInstance = new Service(DEV_SERVER_URL, undefined, false);
        await serviceInstance.initialize(true);

        await use(serviceInstance);

        if (serviceInstance.isSignedIn) {
            await serviceInstance.signOut();
        }
    },
});

test.describe('Service', () => {
    test('should initialize Service', async () => {
        const service = new Service(DEV_SERVER_URL);

        expect(service.providers).toBeUndefined();
        expect(service.language).toBeUndefined();

        await service.initialize(true);

        expect(service.providers).toBeDefined();
        expect(service.providers).toHaveProperty("Vidyano");
        expect(service.language).toBeDefined();
    });

    test('should sign in with credentials', async ({ service }) => {
        const app = await service.signInUsingCredentials("admin", "admin");

        expect(service.isSignedIn).toBe(true);
        expect(app.friendlyUserName).toBe("Admin");
    });

    test('should have correct service properties', async ({ service }) => {
        expect(service.serviceUri).toBe(DEV_SERVER_URL);
        expect(service.isTransient).toBe(false);
        expect(service.isSignedIn).toBe(false);
    });

    test('should sign out successfully', async ({ service }) => {
        await service.signInUsingCredentials("admin", "admin");
        expect(service.isSignedIn, "Pre-condition: should be signed in").toBe(true);

        const signOutResult = await service.signOut();

        expect(signOutResult).toBe(true);
        expect(service.isSignedIn, "Post-condition: should be signed out").toBe(false);
    });

    test('should intercept API calls with service hooks', async () => {
        const interceptedCalls: string[] = [];

        class TestServiceHooks extends ServiceHooks {
            async onFetch(request: Request): Promise<Response> {
                interceptedCalls.push(request.url);
                return super.onFetch(request);
            }
        }

        const hooks = new TestServiceHooks();
        const serviceWithHooks = new Service(DEV_SERVER_URL, hooks);
        await serviceWithHooks.initialize(true);

        expect(serviceWithHooks.hooks).toBe(hooks);
        expect(serviceWithHooks.hooks).toBeInstanceOf(TestServiceHooks);
        expect(interceptedCalls.length).toBeGreaterThan(0);
    });

    test('should handle translations', async ({ service }) => {
        expect(service.getTranslatedMessage("SignIn")).toBeTruthy();
        expect(service.languages?.length || 0).toBeGreaterThan(0);
    });

    test('should create transient service', async () => {
        const transientService = new Service(DEV_SERVER_URL, undefined, true);
        await transientService.initialize();
        await transientService.signInUsingCredentials("admin", "admin");

        expect(transientService.isTransient).toBe(true);
        expect(transientService.isSignedIn).toBe(true);

        await transientService.signOut();
        expect(transientService.isSignedIn).toBe(false);
    });

    test('should get credential type for admin user', async ({ service }) => {
        const credentialType = await service.getCredentialType("admin");

        expect(credentialType).toBeDefined();
        expect(credentialType?.usePassword).toBe(true);
    });
});