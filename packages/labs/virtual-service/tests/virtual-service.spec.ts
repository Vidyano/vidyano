import { test, expect } from "@playwright/test";
import { VirtualService, VirtualServiceHooks, VirtualPersistentObjectActions, VirtualPersistentObject, VirtualPersistentObjectConfig } from "../src/index.js";

test.describe("VirtualService", () => {
    test("can register and initialize successfully", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Name", type: "String", value: "John" }
            ]
        });

        await service.initialize();

        const person = await service.getPersistentObject(null, "Person", "1");
        expect(person).toBeTruthy();
        expect(person.getAttributeValue("Name")).toBe("John");
    });

    test("throws error when registering PersistentObject after initialize", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Name", type: "String", value: "John" }
            ]
        });

        await service.initialize();

        expect(() => {
            service.registerPersistentObject({
                type: "Company",
                attributes: [
                    { name: "Name", type: "String", value: "Acme" }
                ]
            });
        }).toThrow("Cannot register after initialize() has been called");
    });

    test("throws error when registering Query after initialize", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Name", type: "String", value: "John" }
            ]
        });

        await service.initialize();

        expect(() => {
            service.registerQuery({
                name: "AllPersons",
                persistentObject: "Person"
            });
        }).toThrow("Cannot register after initialize() has been called");
    });

    test("throws error when registering Action after initialize", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Name", type: "String", value: "John" }
            ]
        });

        await service.initialize();

        expect(() => {
            service.registerAction({
                name: "CustomAction",
                handler: async () => null
            });
        }).toThrow("Cannot register after initialize() has been called");
    });

    test("throws error when registering BusinessRule after initialize", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Name", type: "String", value: "John" }
            ]
        });

        await service.initialize();

        expect(() => {
            service.registerBusinessRule("CustomRule", () => null);
        }).toThrow("Cannot register after initialize() has been called");
    });

    test("throws error when registering PersistentObjectActions after initialize", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Name", type: "String", value: "John" }
            ]
        });

        await service.initialize();

        expect(() => {
            service.registerPersistentObjectActions("Person", class extends VirtualPersistentObjectActions {});
        }).toThrow("Cannot register after initialize() has been called");
    });

    test("can use registerMessageTranslator method", async () => {
        let translateCalled = false;

        const service = new VirtualService();
        service.registerMessageTranslator((key: string) => {
            translateCalled = true;
            return key;
        });

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "Name", type: "String", rules: "Required", value: null }
            ]
        });

        await service.initialize();

        const person = await service.getPersistentObject(null, "Person", "1");
        await person.save({ throwExceptions: false });

        expect(translateCalled).toBe(true);
    });

    test("virtualHooks getter returns the hooks instance", async () => {
        const service = new VirtualService();

        expect(service.virtualHooks).toBeDefined();
        expect(service.virtualHooks).toBeInstanceOf(VirtualServiceHooks);
    });

    test("creates default hooks if none provided", async () => {
        const service = new VirtualService();

        expect(service.virtualHooks).toBeInstanceOf(VirtualServiceHooks);
    });

    test("registers a simple persistent object", () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [
                { name: "FirstName", type: "String" },
                { name: "LastName", type: "String" }
            ]
        });

        // If no error thrown, registration succeeded
        expect(true).toBe(true);
    });

    test("throws error when type is missing", () => {
        const service = new VirtualService();

        expect(() => {
            service.registerPersistentObject({
                type: "",
                attributes: [{ name: "Test" }]
            });
        }).toThrow("VirtualPersistentObjectConfig.type is required");
    });

    test("throws error when attributes are empty", () => {
        const service = new VirtualService();

        expect(() => {
            service.registerPersistentObject({
                type: "Person",
                attributes: []
            });
        }).toThrow("VirtualPersistentObjectConfig.attributes must have at least one attribute");
    });

    test("throws error when saving with unknown attribute", async () => {
        const service = new VirtualService();

        class PersonActions extends VirtualPersistentObjectActions {
            protected async saveNew(obj: VirtualPersistentObject) {
                return obj;
            }
        }

        // Keep reference to config so we can mutate it
        const config: VirtualPersistentObjectConfig = {
            type: "Person",
            attributes: [
                { name: "Name", type: "String" },
                { name: "Age", type: "Int32" }
            ]
        };

        service.registerPersistentObject(config);
        service.registerPersistentObjectActions("Person", PersonActions);

        await service.initialize();

        // Remove Age attribute from config BEFORE getting the person
        // This way when getPersistentObject builds the DTO, it won't have Age
        // But if we directly call the hooks with a DTO that has Age, it should fail
        config.attributes = config.attributes.filter(a => a.name !== "Age");

        // Call hooks directly with a DTO containing an unknown attribute
        const hooks = service.virtualHooks;
        const mockBody = {
            action: "Person.Save",
            parent: {
                type: "Person",
                objectId: "1",
                isNew: true,
                attributes: [
                    { name: "Name", value: "John" },
                    { name: "Age", value: 30 }  // This attribute is not in config anymore
                ],
                actions: []
            }
        };

        const request = new Request("http://virtual.local/ExecuteAction", {
            method: "POST",
            body: JSON.stringify(mockBody)
        });

        const response = await hooks.onFetch(request);
        const result = await response.json();

        expect(result.exception).toContain('Attribute "Age" is not registered for PersistentObject type "Person"');
    });

    test("returns error when executing action with unknown PersistentObject type", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [{ name: "Name", type: "String" }]
        });

        await service.initialize();

        // Call hooks directly with an unknown PersistentObject type
        const hooks = service.virtualHooks;
        const mockBody = {
            action: "UnknownType.Save",
            parent: {
                type: "UnknownType",
                objectId: "1",
                isNew: true,
                attributes: [{ name: "Name", value: "John" }],
                actions: []
            }
        };

        const request = new Request("http://virtual.local/ExecuteAction", {
            method: "POST",
            body: JSON.stringify(mockBody)
        });

        const response = await hooks.onFetch(request);
        const result = await response.json();

        expect(result.exception).toContain('PersistentObject type "UnknownType" is not registered');
    });

    test("returns error when getting unknown Query", async () => {
        const service = new VirtualService();

        service.registerPersistentObject({
            type: "Person",
            attributes: [{ name: "Name", type: "String" }]
        });

        await service.initialize();

        // Call hooks directly with an unknown Query name
        const hooks = service.virtualHooks;
        const mockBody = {
            id: "UnknownQuery"
        };

        const request = new Request("http://virtual.local/GetQuery", {
            method: "POST",
            body: JSON.stringify(mockBody)
        });

        const response = await hooks.onFetch(request);
        const result = await response.json();

        expect(result.exception).toContain("Query 'UnknownQuery' is not registered");
    });
});
