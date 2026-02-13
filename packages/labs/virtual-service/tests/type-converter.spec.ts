import "@vidyano/core";
import { DataType } from "@vidyano/core";
import { test, expect } from "@playwright/test";
import { VirtualService, VirtualPersistentObjectActions, VirtualPersistentObject } from "../src/index.js";
import { unwrapVirtualPersistentObject } from "../src/virtual-persistent-object.js";

test.describe("Type converters", () => {
    const registerNativeDateConverter = (service: VirtualService) =>
        service.registerTypeConverter("NativeDate", {
            toServiceValue: (value) => DataType.toServiceString(value, "Date"),
            fromServiceValue: (value) => value instanceof Date ? value : DataType.fromServiceString(value, "Date")
        });

    test("Date value with custom type converter serializes correctly", async () => {
        const service = new VirtualService();
        const testDate = new Date(2024, 0, 15);
        let unwrappedDto: any;

        registerNativeDateConverter(service);
        service.registerPersistentObject({
            type: "Test",
            attributes: [
                { name: "CustomDate", type: "NativeDate", value: testDate }
            ]
        }, class extends VirtualPersistentObjectActions {
            async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                const obj = await super.onLoad(objectId, parent);
                unwrappedDto = unwrapVirtualPersistentObject(obj, service.typeConverters);
                return obj;
            }
        });

        await service.initialize();
        await service.getPersistentObject(null, "Test", "123");

        const dateAttr = unwrappedDto.attributes?.find((a: any) => a.name === "CustomDate");
        expect(dateAttr?.value).toBe("15-01-2024 00:00:00");
    });

    test("Date value with custom type converter is stored as Date primitive in getValue()", async () => {
        const service = new VirtualService();
        const testDate = new Date(2024, 5, 15);
        let capturedValue: any;

        registerNativeDateConverter(service);
        service.registerPersistentObject({
            type: "Test",
            attributes: [
                { name: "CustomDate", type: "NativeDate", value: testDate }
            ]
        }, class extends VirtualPersistentObjectActions {
            async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                const obj = await super.onLoad(objectId, parent);
                capturedValue = obj.getAttribute("CustomDate")!.getValue();
                return obj;
            }
        });

        await service.initialize();
        await service.getPersistentObject(null, "Test", "123");

        expect(capturedValue).toBeInstanceOf(Date);
        expect(capturedValue.getFullYear()).toBe(2024);
    });

    test("unregistered custom types still pass through as strings", async () => {
        const service = new VirtualService();
        let capturedValue: any;

        service.registerPersistentObject({
            type: "Test",
            attributes: [
                { name: "Custom", type: "CustomType", value: "hello" }
            ]
        }, class extends VirtualPersistentObjectActions {
            async onLoad(objectId: string, parent: VirtualPersistentObject | null) {
                const obj = await super.onLoad(objectId, parent);
                capturedValue = obj.getAttribute("Custom")!.getValue();
                return obj;
            }
        });

        await service.initialize();
        await service.getPersistentObject(null, "Test", "123");

        expect(capturedValue).toBe("hello");
    });

    test("query result items serialize custom types via converter", async () => {
        const service = new VirtualService();
        const testDate = new Date(2024, 2, 10);

        registerNativeDateConverter(service);
        service.registerPersistentObject({
            type: "Event",
            attributes: [
                { name: "Name", type: "String" },
                { name: "EventDate", type: "NativeDate" }
            ]
        });
        service.registerQuery({
            name: "AllEvents",
            persistentObject: "Event",
            data: [
                { id: "1", Name: "Meeting", EventDate: testDate }
            ]
        });

        await service.initialize();
        const query = await service.getQuery("AllEvents");
        const items = await query.items.toArrayAsync();

        expect(items.length).toBe(1);
        // The item value for EventDate should be the serialized service string
        const dateValue = items[0].getFullValue("EventDate");
        expect(dateValue.value).toBe("10-03-2024 00:00:00");
    });

    test("registerTypeConverter throws after initialize", async () => {
        const service = new VirtualService();
        service.registerPersistentObject({
            type: "Test",
            attributes: [{ name: "A", type: "String", value: "" }]
        });
        await service.initialize();

        expect(() => service.registerTypeConverter("NativeDate", {
            toServiceValue: (value) => DataType.toServiceString(value, "Date"),
            fromServiceValue: (value) => DataType.fromServiceString(value, "Date")
        })).toThrow();
    });
});
