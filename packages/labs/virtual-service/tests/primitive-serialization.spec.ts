import { test, expect } from "@playwright/test";
import { VirtualService, VirtualPersistentObjectActions } from "../src/index.js";
import { unwrapVirtualPersistentObject } from "../src/virtual-persistent-object.js";
import type { VirtualPersistentObject } from "../src/index.js";

test.describe("Primitive Serialization Boundary", () => {
    test.describe("Config values are primitives in getValue()", () => {
        test("boolean true in config returns boolean from getValue()", async () => {
            const service = new VirtualService();
            let capturedValue: any;
            let capturedType: string;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "IsActive", type: "Boolean", value: true }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    capturedValue = obj.getAttribute("IsActive")!.getValue();
                    capturedType = typeof capturedValue;
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(capturedValue).toBe(true);
            expect(capturedType).toBe("boolean");
        });

        test("boolean false in config returns boolean from getValue()", async () => {
            const service = new VirtualService();
            let capturedValue: any;
            let capturedType: string;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "IsActive", type: "Boolean", value: false }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    capturedValue = obj.getAttribute("IsActive")!.getValue();
                    capturedType = typeof capturedValue;
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(capturedValue).toBe(false);
            expect(capturedType).toBe("boolean");
        });

        test("number in config returns number from getValue()", async () => {
            const service = new VirtualService();
            let capturedAge: any;
            let capturedPrice: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "Age", type: "Int32", value: 42 },
                    { name: "Price", type: "Decimal", value: 99.99 }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    capturedAge = obj.getAttribute("Age")!.getValue();
                    capturedPrice = obj.getAttribute("Price")!.getValue();
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(capturedAge).toBe(42);
            expect(typeof capturedAge).toBe("number");
            expect(capturedPrice).toBe(99.99);
            expect(typeof capturedPrice).toBe("number");
        });

        test("Date in config returns Date from getValue()", async () => {
            const service = new VirtualService();
            const testDate = new Date(2024, 5, 15);
            let capturedValue: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "BirthDate", type: "Date", value: testDate }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    capturedValue = obj.getAttribute("BirthDate")!.getValue();
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(capturedValue).toBeInstanceOf(Date);
            expect(capturedValue.getFullYear()).toBe(2024);
            expect(capturedValue.getMonth()).toBe(5);
            expect(capturedValue.getDate()).toBe(15);
        });

        test("null in config returns null from getValue()", async () => {
            const service = new VirtualService();
            let capturedValue: any = "sentinel";

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "OptionalField", type: "String", value: null }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    capturedValue = obj.getAttribute("OptionalField")!.getValue();
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(capturedValue).toBeNull();
        });

        test("string in config returns string from getValue()", async () => {
            const service = new VirtualService();
            let capturedValue: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "Name", type: "String", value: "John Doe" }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    capturedValue = obj.getAttribute("Name")!.getValue();
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(capturedValue).toBe("John Doe");
            expect(typeof capturedValue).toBe("string");
        });
    });

    test.describe("setValue stores primitives directly", () => {
        test("setValue with boolean stores boolean", async () => {
            const service = new VirtualService();
            let capturedValue: any;
            let capturedType: string;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "IsActive", type: "Boolean", value: false }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    obj.getAttribute("IsActive")!.setValue(true);
                    capturedValue = obj.getAttribute("IsActive")!.getValue();
                    capturedType = typeof capturedValue;
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(capturedValue).toBe(true);
            expect(capturedType).toBe("boolean");
        });

        test("setValue with number stores number", async () => {
            const service = new VirtualService();
            let capturedValue: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "Count", type: "Int32", value: 0 }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    obj.getAttribute("Count")!.setValue(123);
                    capturedValue = obj.getAttribute("Count")!.getValue();
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(capturedValue).toBe(123);
            expect(typeof capturedValue).toBe("number");
        });

        test("setValue with Date stores Date", async () => {
            const service = new VirtualService();
            const newDate = new Date(2025, 11, 25);
            let capturedValue: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "EventDate", type: "Date", value: null }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    obj.getAttribute("EventDate")!.setValue(newDate);
                    capturedValue = obj.getAttribute("EventDate")!.getValue();
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(capturedValue).toBeInstanceOf(Date);
            expect(capturedValue.getFullYear()).toBe(2025);
        });

        test("setting same value via property does not trigger isValueChanged on second set", async () => {
            const service = new VirtualService();
            let isValueChangedAfterFirst: boolean;
            let isValueChangedAfterReset: boolean;
            let isValueChangedAfterSecond: boolean;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "Count", type: "Int32", value: 0 }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    const attr = obj.getAttribute("Count")!;

                    // First set via property - should trigger isValueChanged
                    attr.value = 42;
                    isValueChangedAfterFirst = attr.isValueChanged;

                    // Reset the flag manually to test second set
                    attr.isValueChanged = false;
                    isValueChangedAfterReset = attr.isValueChanged;

                    // Second set with same value - should NOT trigger isValueChanged
                    attr.value = 42;
                    isValueChangedAfterSecond = attr.isValueChanged;

                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(isValueChangedAfterFirst).toBe(true);
            expect(isValueChangedAfterReset).toBe(false);
            expect(isValueChangedAfterSecond).toBe(false);
        });

        test("setting same Date via property does not trigger isValueChanged on second set", async () => {
            const service = new VirtualService();
            let isValueChangedAfterFirst: boolean;
            let isValueChangedAfterReset: boolean;
            let isValueChangedAfterSecond: boolean;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "EventDate", type: "Date", value: null }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    const attr = obj.getAttribute("EventDate")!;

                    const date1 = new Date(2025, 5, 15);
                    const date2 = new Date(2025, 5, 15); // Same date, different instance

                    // First set via property - should trigger isValueChanged
                    attr.value = date1;
                    isValueChangedAfterFirst = attr.isValueChanged;

                    // Reset the flag manually to test second set
                    attr.isValueChanged = false;
                    isValueChangedAfterReset = attr.isValueChanged;

                    // Second set with equivalent Date - should NOT trigger isValueChanged
                    attr.value = date2;
                    isValueChangedAfterSecond = attr.isValueChanged;

                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(isValueChangedAfterFirst).toBe(true);
            expect(isValueChangedAfterReset).toBe(false);
            expect(isValueChangedAfterSecond).toBe(false);
        });
    });

    test.describe("unwrapVirtualPersistentObject converts to service strings", () => {
        test("converts boolean true to 'True'", async () => {
            const service = new VirtualService();
            let unwrappedDto: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "IsActive", type: "Boolean", value: true }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    unwrappedDto = unwrapVirtualPersistentObject(obj);
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            const isActiveAttr = unwrappedDto.attributes?.find((a: any) => a.name === "IsActive");
            expect(isActiveAttr?.value).toBe("True");
        });

        test("converts boolean false to 'False'", async () => {
            const service = new VirtualService();
            let unwrappedDto: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "IsActive", type: "Boolean", value: false }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    unwrappedDto = unwrapVirtualPersistentObject(obj);
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            const isActiveAttr = unwrappedDto.attributes?.find((a: any) => a.name === "IsActive");
            expect(isActiveAttr?.value).toBe("False");
        });

        test("converts number to string", async () => {
            const service = new VirtualService();
            let unwrappedDto: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "Count", type: "Int32", value: 42 }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    unwrappedDto = unwrapVirtualPersistentObject(obj);
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            const countAttr = unwrappedDto.attributes?.find((a: any) => a.name === "Count");
            expect(countAttr?.value).toBe("42");
        });

        test("converts Date to service format", async () => {
            const service = new VirtualService();
            const testDate = new Date(2024, 0, 15);
            let unwrappedDto: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "BirthDate", type: "Date", value: testDate }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    unwrappedDto = unwrapVirtualPersistentObject(obj);
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            const dateAttr = unwrappedDto.attributes?.find((a: any) => a.name === "BirthDate");
            expect(dateAttr?.value).toBe("15-01-2024 00:00:00");
        });

        test("preserves null values", async () => {
            const service = new VirtualService();
            let unwrappedDto: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "OptionalField", type: "String", value: null }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    unwrappedDto = unwrapVirtualPersistentObject(obj);
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            const attr = unwrappedDto.attributes?.find((a: any) => a.name === "OptionalField");
            expect(attr?.value).toBeNull();
        });

        test("does not mutate original VirtualPersistentObject", async () => {
            const service = new VirtualService();
            let originalValueAfterUnwrap: any;
            let originalTypeAfterUnwrap: string;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "IsActive", type: "Boolean", value: true }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    // Unwrap creates a copy
                    unwrapVirtualPersistentObject(obj);
                    // Original should still have primitive
                    originalValueAfterUnwrap = obj.getAttribute("IsActive")!.getValue();
                    originalTypeAfterUnwrap = typeof originalValueAfterUnwrap;
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(originalValueAfterUnwrap).toBe(true);
            expect(originalTypeAfterUnwrap).toBe("boolean");
        });
    });

    test.describe("Lifecycle hooks work with primitives", () => {
        test("onNew receives primitives from config", async () => {
            const service = new VirtualService();
            let capturedValue: any;
            let capturedType: string;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "IsActive", type: "Boolean", value: true }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onNew(parent: VirtualPersistentObject | null) {
                    const obj = await super.onNew(parent, null, null);
                    capturedValue = obj.getAttribute("IsActive")!.getValue();
                    capturedType = typeof capturedValue;
                    return obj;
                }
            });

            service.registerQuery({
                name: "Tests",
                persistentObject: "Test"
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", undefined, true);

            expect(capturedValue).toBe(true);
            expect(capturedType).toBe("boolean");
        });

        test("onSave receives primitives set via setValue", async () => {
            const service = new VirtualService();
            let capturedValue: any;
            let capturedType: string;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "IsActive", type: "Boolean", value: false }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onSave(obj: VirtualPersistentObject) {
                    capturedValue = obj.getAttribute("IsActive")!.getValue();
                    capturedType = typeof capturedValue;
                    return await super.onSave(obj);
                }
            });

            await service.initialize();
            const testObj = await service.getPersistentObject(null, "Test", "123");
            testObj.beginEdit();
            testObj.getAttribute("IsActive")!.value = true;
            await testObj.save();

            expect(capturedValue).toBe(true);
            expect(capturedType).toBe("boolean");
        });

        test("primitives survive round-trip through save", async () => {
            const service = new VirtualService();
            let valueAfterSave: any;
            let typeAfterSave: string;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "IsActive", type: "Boolean", value: false },
                    { name: "Count", type: "Int32", value: 0 }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onSave(obj: VirtualPersistentObject) {
                    const result = await super.onSave(obj);
                    valueAfterSave = result.getAttribute("IsActive")!.getValue();
                    typeAfterSave = typeof valueAfterSave;
                    return result;
                }
            });

            await service.initialize();
            const testObj = await service.getPersistentObject(null, "Test", "123");
            testObj.beginEdit();
            await testObj.setAttributeValue("IsActive", true);
            await testObj.save();

            expect(valueAfterSave).toBe(true);
            expect(typeAfterSave).toBe("boolean");
        });
    });

    test.describe("getAttributeValue/setAttributeValue work with primitives", () => {
        test("setAttributeValue stores primitives correctly", async () => {
            const service = new VirtualService();
            let capturedValue: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "IsActive", type: "Boolean", value: false }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    obj.setAttributeValue("IsActive", true);
                    capturedValue = obj.getAttributeValue("IsActive");
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(capturedValue).toBe(true);
        });

        test("getAttributeValue returns primitives", async () => {
            const service = new VirtualService();
            let capturedValue: any;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "Count", type: "Int32", value: 100 }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                    const obj = await super.onLoad(objectId, parent);
                    capturedValue = obj.getAttributeValue<number>("Count");
                    return obj;
                }
            });

            await service.initialize();
            await service.getPersistentObject(null, "Test", "123");

            expect(capturedValue).toBe(100);
            expect(typeof capturedValue).toBe("number");
        });
    });

    test.describe("Incoming wire values are converted to primitives", () => {
        test("service string from wire is converted to primitive in onSave", async () => {
            const service = new VirtualService();
            let valueInOnSave: any;
            let typeInOnSave: string;

            service.registerPersistentObject({
                type: "Test",
                attributes: [
                    { name: "IsActive", type: "Boolean", value: false }
                ]
            }, class extends VirtualPersistentObjectActions {
                async onSave(obj: VirtualPersistentObject) {
                    // The value comes from the wire as service string "True"
                    // but should be converted to boolean in the VirtualPersistentObject
                    valueInOnSave = obj.getAttribute("IsActive")!.getValue();
                    typeInOnSave = typeof valueInOnSave;
                    return await super.onSave(obj);
                }
            });

            await service.initialize();
            const testObj = await service.getPersistentObject(null, "Test", "123");
            testObj.beginEdit();
            // Core library sends "True" string over the wire, which gets converted to boolean
            testObj.getAttribute("IsActive")!.value = true;
            await testObj.save();

            expect(valueInOnSave).toBe(true);
            expect(typeInOnSave).toBe("boolean");
        });
    });
});
