/**
 * Internal value conversion utilities for the virtual service.
 *
 * NOTE: This file exists to avoid circular dependencies. Files like
 * virtual-persistent-object.ts cannot import VirtualService directly
 * (it would create a cycle), so they import these helpers instead.
 *
 * Public API: Use VirtualService.fromServiceString() and VirtualService.toServiceString().
 */

import { DataType } from "@vidyano/core";

/**
 * Converts a service string value to a primitive JavaScript type.
 * Unlike DataType.fromServiceString, this returns number instead of BigNumber
 * for numeric types (Decimal, Double, Int64, etc.).
 */
export function fromServiceString(value: string, type: string): any {
    const result = DataType.fromServiceString(value, type);

    // Check for BigNumber (has toNumber method) and convert to number primitive
    if (result && typeof result.toNumber === "function")
        return result.toNumber();

    return result;
}

/**
 * Converts a primitive JavaScript value to a service string.
 */
export function toServiceString(value: any, type: string): string {
    return DataType.toServiceString(value, type);
}
