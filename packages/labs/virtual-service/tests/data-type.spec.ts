import { test, expect } from "@playwright/test";
import { DataType } from "@vidyano/core";
import "@vidyano/core";
import { VirtualService, VirtualPersistentObjectActions, VirtualPersistentObject } from "../src/index.js";
import { unwrapVirtualPersistentObject } from "../src/virtual-persistent-object.js";

DataType.registerConverter("NativeDate", {
    toServiceString: (value) => DataType.toServiceString(value, "Date"),
    fromServiceString: (value) => DataType.fromServiceString(value, "Date")
});

test.describe("Data Conversion with VirtualService", () => {
    test("Date value serializes correctly via unwrap", async () => {
        const service = new VirtualService();
        const testDate = new Date(2024, 0, 15);
        let unwrappedDto: any;

        service.registerPersistentObject({
            type: "Test",
            attributes: [
                { name: "CustomDate", type: "NativeDate", value: testDate }
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

        const dateAttr = unwrappedDto.attributes?.find((a: any) => a.name === "CustomDate");
        expect(dateAttr?.value).toBe("15-01-2024 00:00:00");
    });

    test("getValue() returns Date primitive", async () => {
        const service = new VirtualService();
        const testDate = new Date(2024, 5, 15);
        let capturedValue: any;

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

    test("unregistered custom types pass through as strings", async () => {
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
        const dateValue = items[0].getFullValue("EventDate");
        expect(dateValue.value).toBe("10-03-2024 00:00:00");
    });
});
