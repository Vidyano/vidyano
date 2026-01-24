/**
 * Value conversion utilities for the virtual service.
 * Wraps core DataType conversions to return JavaScript primitives instead of BigNumber.
 *
 * @example
 * // Convert from service string to primitive
 * fromServiceValue("100.50", "Decimal")    // => 100.5 (number)
 * fromServiceValue("True", "Boolean")      // => true (boolean)
 * fromServiceValue("15-01-2024 10:30:00", "DateTime")  // => Date object
 *
 * @example
 * // Convert from primitive to service string
 * toServiceValue(100.5, "Decimal")         // => "100.5"
 * toServiceValue(true, "Boolean")          // => "True"
 * toServiceValue(new Date(2024, 0, 15), "Date")  // => "15-01-2024 00:00:00"
 */

import { DataType } from "@vidyano/core";

/**
 * Converts a service string value to a primitive JavaScript type.
 * Unlike DataType.fromServiceString, this returns number instead of BigNumber
 * for numeric types (Decimal, Double, Int64, etc.).
 */
export function fromServiceValue(value: any, type: string): any {
    const result = DataType.fromServiceString(value, type);

    // Check for BigNumber (has toNumber method) and convert to number primitive
    if (result && typeof result.toNumber === "function")
        return result.toNumber();

    return result;
}

/**
 * Converts a primitive JavaScript value to a service string.
 */
export function toServiceValue(value: any, type: string): string {
    return DataType.toServiceString(value, type);
}
