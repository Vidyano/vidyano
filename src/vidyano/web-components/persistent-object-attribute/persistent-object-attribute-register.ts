import type { PersistentObjectAttribute as PolymerPersistentObjectAttribute } from "./polymer/persistent-object-attribute";
import type { PersistentObjectAttribute as LitPersistentObjectAttribute } from "./persistent-object-attribute";

export type PersistentObjectAttributeConstructor =
    | (new (...args: any[]) => PolymerPersistentObjectAttribute)
    | (new (...args: any[]) => LitPersistentObjectAttribute);

const types: Record<string, PersistentObjectAttributeConstructor> = {};

export function get(attributeType: string): PersistentObjectAttributeConstructor {
    return types[attributeType];
}

export function add(attributeType: string, constructor: PersistentObjectAttributeConstructor): void {
    types[attributeType] = constructor;
}

export function all(): string[] {
    return Object.keys(types);
}
