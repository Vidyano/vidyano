/**
 * Shared type conversion utilities for the mocking module.
 * These provide simplified conversions between DTO string values and JavaScript primitives.
 */

/**
 * Converts a value from DTO format (typically string) to primitive JavaScript type
 * @param value - The DTO value to convert
 * @param type - The Vidyano data type
 * @returns The converted JavaScript primitive value
 */
export function convertFromDtoValue(value: any, type?: string): any {
    if (value == null || value === "")
        return null;

    switch (type) {
        case "Boolean":
            if (typeof value === "boolean")
                return value;

            return value === "True" || value === "true";

        case "Int32":
        case "Int64":
        case "Byte":
        case "SByte":
        case "UInt16":
        case "UInt32":
        case "UInt64":
            if (typeof value === "number")
                return value;

            return parseInt(value, 10);

        case "Decimal":
        case "Double":
        case "Single":
            if (typeof value === "number")
                return value;

            return parseFloat(value);

        case "DateTime":
        case "Date":
            if (value instanceof Date)
                return value;

            return new Date(value);

        default:
            // String and other types: return as-is
            return value;
    }
}

/**
 * Converts a primitive JavaScript value to DTO format (typically string)
 * @param value - The JavaScript value to convert
 * @param type - The Vidyano data type
 * @returns The converted DTO value
 */
export function convertToDtoValue(value: any, type?: string): any {
    if (value == null)
        return null;

    switch (type) {
        case "Boolean":
            if (typeof value === "string")
                return value;

            return value ? "True" : "False";

        case "Int32":
        case "Int64":
        case "Byte":
        case "SByte":
        case "UInt16":
        case "UInt32":
        case "UInt64":
        case "Decimal":
        case "Double":
        case "Single":
            // Convert to string for DTO storage (PersistentObject will convert back to number on read)
            if (typeof value === "string")
                return value;

            return String(value);

        case "DateTime":
        case "Date":
            // For DateTime, convert to service format: "YYYY-MM-DD HH:MM:SS"
            if (typeof value === "string")
                return value;

            if (value instanceof Date) {
                const year = value.getFullYear();
                const month = String(value.getMonth() + 1).padStart(2, '0');
                const day = String(value.getDate()).padStart(2, '0');
                const hours = String(value.getHours()).padStart(2, '0');
                const minutes = String(value.getMinutes()).padStart(2, '0');
                const seconds = String(value.getSeconds()).padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            }

            return String(value);

        default:
            // String and other types: store as-is
            return value;
    }
}
