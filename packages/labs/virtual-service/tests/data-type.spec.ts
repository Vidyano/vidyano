import { test, expect } from "@playwright/test";
import { DataType } from "@vidyano/core";
// Import polyfills required for DataType.toServiceString and array extensions
import "@vidyano/core";

test.describe("Phase 3: Data Conversion - Service String Format", () => {
    test("DataType.toServiceString converts string values (pass through)", () => {
        const value = "John Doe";
        const result = DataType.toServiceString(value, "String");

        expect(result).toBe("John Doe");
    });

    test("DataType.toServiceString converts boolean true to 'True'", () => {
        const value = true;
        const result = DataType.toServiceString(value, "Boolean");

        expect(result).toBe("True");
    });

    test("DataType.toServiceString converts boolean false to 'False'", () => {
        const value = false;
        const result = DataType.toServiceString(value, "Boolean");

        expect(result).toBe("False");
    });

    test("DataType.toServiceString converts Date objects to 'dd-MM-yyyy 00:00:00' format", () => {
        const birthDate = new Date(1994, 0, 15); // January 15, 1994
        const result = DataType.toServiceString(birthDate, "Date");

        expect(result).toBe("15-01-1994 00:00:00");
    });

    test("DataType.toServiceString converts DateTime objects to 'dd-MM-yyyy HH:mm:ss.fff' format", () => {
        const createdAt = new Date(2023, 0, 15, 10, 30, 45, 123); // January 15, 2023 10:30:45.123
        const result = DataType.toServiceString(createdAt, "DateTime");

        expect(result).toBe("15-01-2023 10:30:45.123");
    });

    test("DataType.toServiceString converts Int32 numbers to string format", () => {
        const value = 30;
        const result = DataType.toServiceString(value, "Int32");

        expect(result).toBe("30");
    });

    test("DataType.toServiceString converts Decimal numbers to string format", () => {
        const value = 75000.50;
        const result = DataType.toServiceString(value, "Decimal");

        expect(result).toBe("75000.5");
    });

    test("DataType.toServiceString handles null values for nullable types", () => {
        expect(DataType.toServiceString(null, "String")).toBeNull();
        expect(DataType.toServiceString(null, "NullableInt32")).toBeNull();
        expect(DataType.toServiceString(null, "NullableBoolean")).toBeNull();
    });

    test("DataType.toServiceString handles null values for non-nullable numeric types", () => {
        // Non-nullable numeric types default to "0" when value is empty/null
        expect(DataType.toServiceString(null, "Int32")).toBe("0");
        expect(DataType.toServiceString(null, "Decimal")).toBe("0");
    });

    test("DataType.toServiceString handles undefined values", () => {
        // undefined is treated similarly to null
        expect(DataType.toServiceString(undefined, "String")).toBeUndefined();
        expect(DataType.toServiceString(undefined, "Int32")).toBe("0");
    });
});
