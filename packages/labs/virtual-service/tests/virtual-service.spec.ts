import { test, expect } from "@playwright/test";
import { VirtualService, VirtualServiceHooks, VirtualPersistentObjectActions } from "../src/index.js";

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
        await person.save();

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
});
