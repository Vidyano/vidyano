import type { KeyValuePair } from "./../typings/common.js"

declare global {
    export interface Array<T> {
        index?: number;
        input?: string;
        distinct<T, U>(this: T[], selector?: (element: T) => T | U): U[];
        groupBy<T>(this: T[], selector: (element: T) => string): KeyValuePair<string, T[]>[];
        groupBy<T>(this: T[], selector: (element: T) => number): KeyValuePair<number, T[]>[];
        orderBy<T>(this: T[], selector: (element: T) => number | string): T[];
        orderBy<T>(this: T[], property: string): T[];
        orderByDescending<T>(this: T[], selector: (element: T) => number): T[];
        orderByDescending<T>(this: T[], property: string): T[];
        min<T>(this: T[], selector: (element: T) => number): number;
        max<T>(this: T[], selector: (element: T) => number): number;
        remove(s: T): boolean;
        removeAll(f: (t: T) => boolean, thisObject?: any): void;
        sum<T>(this: T[], selector: (element: T) => number): number;
    }

    export interface ArrayConstructor {
        range(start: number, end: number, step?: number): number[];
    }
};

if (Array.prototype["distinct"] === undefined) {
    Object.defineProperty(Array.prototype, "distinct", {
        configurable: true,
        value: function distinct<T, U>(this: T[], selector: (element: T) => T | U = (element) => element): U[] {
            return this.reduce((x, y) => x.find(yy => yy === selector(y)) !== undefined ? x : [...x, selector(y)], []);
        },
        writable: true
    });
}

if (Array.prototype["groupBy"] === undefined) {
    Object.defineProperty(Array.prototype, "groupBy", {
        configurable: true,
        value: function groupBy<T>(this: T[], selector: (element: T) => string | number): KeyValuePair<string | number, T[]>[] {
            const groups = this.reduce((r, e) => {
                const g = selector(e);
                (r[g] || (r[g] = [])).push(e);
                return r;
            }, {});

            return Object.keys(groups).map(key => ({ key: key, value: groups[key] }));
        },
        writable: true
    });
}

if (Array.prototype["orderBy"] === undefined) {
    Object.defineProperty(Array.prototype, "orderBy", {
        configurable: true,
        value: function orderBy<T>(this: T[], selectorOrString: string | ((element: T) => number)): T[] {
            const selector = typeof selectorOrString === "string" ? (element: T) => element[<string>selectorOrString] : selectorOrString;
            if (!this.length)
                return [];

            const first = selector(this[0]);
            if (typeof first === "number")
                return this.slice().sort((a, b) => selector(a) - selector(b));
            else if (typeof first === "string") {
                return this.slice().sort((a, b) => {
                    if (selector(a) < selector(b))
                        return -1;
                    else if (selector(a) > selector(b))
                        return 1;

                    return 0;
                });
            }

            throw "Invalid property type";
        },
        writable: true
    });
}

if (Array.prototype["orderByDescending"] === undefined) {
    Object.defineProperty(Array.prototype, "orderByDescending", {
        configurable: true,
        value: function orderByDescending<T>(this: T[], selectorOrString: string | ((element: T) => number)): T[] {
            const selector = typeof selectorOrString === "string" ? (element: T) => element[<string>selectorOrString] : selectorOrString;
            return this.slice().sort((a, b) => selector(b) - selector(a));
        },
        writable: true
    });
}

if (Array.prototype["min"] === undefined) {
    Object.defineProperty(Array.prototype, "min", {
        configurable: true,
        value: function min<T>(this: T[], selector: (element: T) => number): number {
            if (!this.length)
                return Infinity;

            return this.slice(1).reduce((prev, element) => {
                const v = selector(element);
                return (prev < v ? prev : v);
            }, selector(this[0]));
        },
        writable: true
    });
}

if (Array.prototype["max"] === undefined) {
    Object.defineProperty(Array.prototype, "max", {
        configurable: true,
        value: function max<T>(this: T[], selector: (element: T) => number): number {
            if (!this.length)
                return Infinity;

            return this.slice(1).reduce((prev, element) => {
                const v = selector(element);
                return (prev > v ? prev : v);
            }, selector(this[0]));
        },
        writable: true
    });
}

if (Array.prototype["remove"] === undefined) {
    Object.defineProperty(Array.prototype, "remove", {
        configurable: true,
        value: function remove<T>(s: T): boolean {
            let success = false;
            for (let index = this.length; index--;) {
                if (s == this[index]) {
                    this.splice(index, 1);
                    success = true;
                }
            }

            return success;
        },
        writable: true
    });
}

if (Array.prototype["removeAll"] === undefined) {
    Object.defineProperty(Array.prototype, "removeAll", {
        configurable: true,
        value: function removeAll<T>(f: (t: T) => boolean, thisObject?: any) {
            if (this.length > 0) {
                for (let index = this.length; index--;) {
                    if (f.call(thisObject, this[index], index, this))
                        this.splice(index, 1);
                }
            }
        },
        writable: true
    });
}

if (Array.prototype["sum"] === undefined) {
    Object.defineProperty(Array.prototype, "sum", {
        configurable: true,
        value: function sum<T>(this: T[], selector: (element: T) => number): number {
            if (!this.length)
                return Infinity;

            return this.slice(1).reduce((prev, element) => prev + selector(element), selector(this[0]));
        },
        writable: true
    });
}

Array.range = function range(start: number, end: number, step: number = 1): number[] {
    return Array.from({ length: end - start + 1 }, (_, k) => k * step + start);
};