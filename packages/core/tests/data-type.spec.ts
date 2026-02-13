import { test, expect } from "@playwright/test";
import { DataType } from "@vidyano/core";
import "@vidyano/core";

test.describe("DataType", () => {
    test("toServiceString converts string values (pass through)", () => {
        expect(DataType.toServiceString("John Doe", "String")).toBe("John Doe");
    });

    test("toServiceString converts boolean true to 'True'", () => {
        expect(DataType.toServiceString(true, "Boolean")).toBe("True");
    });

    test("toServiceString converts boolean false to 'False'", () => {
        expect(DataType.toServiceString(false, "Boolean")).toBe("False");
    });

    test("toServiceString converts Date to 'dd-MM-yyyy 00:00:00' format", () => {
        expect(DataType.toServiceString(new Date(1994, 0, 15), "Date")).toBe("15-01-1994 00:00:00");
    });

    test("toServiceString converts DateTime to 'dd-MM-yyyy HH:mm:ss.fff' format", () => {
        expect(DataType.toServiceString(new Date(2023, 0, 15, 10, 30, 45, 123), "DateTime")).toBe("15-01-2023 10:30:45.123");
    });

    test("toServiceString converts Int32 to string", () => {
        expect(DataType.toServiceString(30, "Int32")).toBe("30");
    });

    test("toServiceString converts Decimal to string", () => {
        expect(DataType.toServiceString(75000.50, "Decimal")).toBe("75000.5");
    });

    test("toServiceString handles null for nullable types", () => {
        expect(DataType.toServiceString(null, "String")).toBeNull();
        expect(DataType.toServiceString(null, "NullableInt32")).toBeNull();
        expect(DataType.toServiceString(null, "NullableBoolean")).toBeNull();
    });

    test("toServiceString defaults to '0' for non-nullable numeric types", () => {
        expect(DataType.toServiceString(null, "Int32")).toBe("0");
        expect(DataType.toServiceString(null, "Decimal")).toBe("0");
    });

    test("toServiceString handles undefined values", () => {
        expect(DataType.toServiceString(undefined, "String")).toBeUndefined();
        expect(DataType.toServiceString(undefined, "Int32")).toBe("0");
    });

    test("registerConverter: fromServiceString uses registered converter", () => {
        DataType.registerConverter("TestFromType", {
            toServiceString: (value) => String(value),
            fromServiceString: (value) => ({ custom: true, raw: value })
        });

        expect(DataType.fromServiceString("hello", "TestFromType")).toEqual({ custom: true, raw: "hello" });
    });

    test("registerConverter: toServiceString uses registered converter", () => {
        DataType.registerConverter("TestToType", {
            toServiceString: (value) => `custom:${value}`,
            fromServiceString: (value) => value
        });

        expect(DataType.toServiceString(42, "TestToType")).toBe("custom:42");
    });

    test("registerConverter: unregistered types fall through to default behavior", () => {
        expect(DataType.fromServiceString("test", "UnknownType")).toBe("test");
    });

    test("registerConverter: handles Date serialization round-trip", () => {
        DataType.registerConverter("NativeDate", {
            toServiceString: (value) => DataType.toServiceString(value, "Date"),
            fromServiceString: (value) => DataType.fromServiceString(value, "Date")
        });

        const date = new Date(2024, 6, 4);
        const serialized = DataType.toServiceString(date, "NativeDate");
        expect(serialized).toBe("04-07-2024 00:00:00");

        const deserialized = DataType.fromServiceString(serialized, "NativeDate");
        expect(deserialized).toBeInstanceOf(Date);
        expect(deserialized.getFullYear()).toBe(2024);
        expect(deserialized.getMonth()).toBe(6);
        expect(deserialized.getDate()).toBe(4);
    });
});
