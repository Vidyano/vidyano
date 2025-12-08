import { test, expect } from "@playwright/test";
import { Observable, createObservableArray } from "../../src/core/observable/index.js";

// #region Test Helper Classes

class TestObservable extends Observable<TestObservable> {
    #name: string = "";
    #items: string[];

    get name(): string {
        return this.#name;
    }

    set name(value: string) {
        const oldValue = this.#name;
        if (oldValue !== value) {
            this.#name = value;
            this.notifyPropertyChanged("name", value, oldValue);
        }
    }

    get items(): string[] {
        return this.#items;
    }

    constructor() {
        super();
        this.#items = createObservableArray<string>(
            [],
            (index: number, removed: string[], added: number) => this.notifyArrayChanged("items", index, removed, added)
        );
    }
}

class ValueObservable extends Observable<ValueObservable> {
    #value: string = "";

    get value(): string {
        return this.#value;
    }

    set value(v: string) {
        const oldValue = this.#value;
        if (oldValue !== v) {
            this.#value = v;
            this.notifyPropertyChanged("value", v, oldValue);
        }
    }
}

class ParentObservable extends Observable<ParentObservable> {
    #child: ValueObservable | null = null;

    get child(): ValueObservable | null {
        return this.#child;
    }

    set child(value: ValueObservable | null) {
        const oldValue = this.#child;
        if (oldValue !== value) {
            this.#child = value;
            this.notifyPropertyChanged("child", value, oldValue);
        }
    }
}

class ItemObservable extends Observable<ItemObservable> {
    #name: string;

    get name(): string {
        return this.#name;
    }

    set name(value: string) {
        const oldValue = this.#name;
        if (oldValue !== value) {
            this.#name = value;
            this.notifyPropertyChanged("name", value, oldValue);
        }
    }

    constructor(name: string) {
        super();
        this.#name = name;
    }
}

class ContainerObservable extends Observable<ContainerObservable> {
    #items: ItemObservable[];

    get items(): ItemObservable[] {
        return this.#items;
    }

    constructor() {
        super();
        this.#items = createObservableArray<ItemObservable>(
            [],
            (index: number, removed: ItemObservable[], added: number) => this.notifyArrayChanged("items", index, removed, added)
        );
    }
}

class Level2Observable extends Observable<Level2Observable> {
    #level3: ValueObservable | null = null;

    get level3(): ValueObservable | null {
        return this.#level3;
    }

    set level3(value: ValueObservable | null) {
        const oldValue = this.#level3;
        if (oldValue !== value) {
            this.#level3 = value;
            this.notifyPropertyChanged("level3", value, oldValue);
        }
    }
}

class Level1Observable extends Observable<Level1Observable> {
    #level2: Level2Observable | null = null;

    get level2(): Level2Observable | null {
        return this.#level2;
    }

    set level2(value: Level2Observable | null) {
        const oldValue = this.#level2;
        if (oldValue !== value) {
            this.#level2 = value;
            this.notifyPropertyChanged("level2", value, oldValue);
        }
    }
}

// Helper classes for nested collection depth testing

class NestedItem extends Observable<NestedItem> {
    #name: string;

    get name(): string {
        return this.#name;
    }

    set name(value: string) {
        const oldValue = this.#name;
        if (oldValue !== value) {
            this.#name = value;
            this.notifyPropertyChanged("name", value, oldValue);
        }
    }

    constructor(name: string) {
        super();
        this.#name = name;
    }
}

class InnerContainer extends Observable<InnerContainer> {
    #items: NestedItem[];

    get items(): NestedItem[] {
        return this.#items;
    }

    constructor() {
        super();
        this.#items = createObservableArray<NestedItem>(
            [],
            (index: number, removed: NestedItem[], added: number) => this.notifyArrayChanged("items", index, removed, added)
        );
    }
}

class OuterItem extends Observable<OuterItem> {
    #title: string;
    #container: InnerContainer;
    #tags: string[];

    get title(): string {
        return this.#title;
    }

    set title(value: string) {
        const oldValue = this.#title;
        if (oldValue !== value) {
            this.#title = value;
            this.notifyPropertyChanged("title", value, oldValue);
        }
    }

    get container(): InnerContainer {
        return this.#container;
    }

    set container(value: InnerContainer) {
        const oldValue = this.#container;
        if (oldValue !== value) {
            this.#container = value;
            this.notifyPropertyChanged("container", value, oldValue);
        }
    }

    get tags(): string[] {
        return this.#tags;
    }

    constructor(title: string) {
        super();
        this.#title = title;
        this.#container = new InnerContainer();
        this.#tags = createObservableArray<string>(
            [],
            (index: number, removed: string[], added: number) => this.notifyArrayChanged("tags", index, removed, added)
        );
    }
}

class OuterContainer extends Observable<OuterContainer> {
    #items: OuterItem[];

    get items(): OuterItem[] {
        return this.#items;
    }

    constructor() {
        super();
        this.#items = createObservableArray<OuterItem>(
            [],
            (index: number, removed: OuterItem[], added: number) => this.notifyArrayChanged("items", index, removed, added)
        );
    }
}

// #endregion

test.describe("Observable", () => {
    test("should notify propertyChanged when property changes", () => {
        const observable = new TestObservable();
        let changedPropertyName: string | null = null;
        let newValue: any = null;
        let oldValue: any = null;

        const disposer = observable.propertyChanged.attach((sender, args) => {
            changedPropertyName = args.propertyName;
            newValue = args.newValue;
            oldValue = args.oldValue;
        });

        observable.name = "Test";

        expect(changedPropertyName).toBe("name");
        expect(newValue).toBe("Test");
        expect(oldValue).toBe("");

        disposer();
    });

    test("should not notify when property value is the same", () => {
        const observable = new TestObservable();
        observable.name = "Test";

        let notifyCount = 0;
        const disposer = observable.propertyChanged.attach(() => {
            notifyCount++;
        });

        observable.name = "Test"; // Same value

        expect(notifyCount).toBe(0);

        disposer();
    });

    test("should allow multiple observers", () => {
        const observable = new TestObservable();
        let observer1Called = false;
        let observer2Called = false;

        const disposer1 = observable.propertyChanged.attach(() => {
            observer1Called = true;
        });
        const disposer2 = observable.propertyChanged.attach(() => {
            observer2Called = true;
        });

        observable.name = "Test";

        expect(observer1Called).toBe(true);
        expect(observer2Called).toBe(true);

        disposer1();
        disposer2();
    });

    test("should stop notifying after disposer is called", () => {
        const observable = new TestObservable();
        let notifyCount = 0;

        const disposer = observable.propertyChanged.attach(() => {
            notifyCount++;
        });

        observable.name = "First";
        expect(notifyCount).toBe(1);

        disposer();

        observable.name = "Second";
        expect(notifyCount).toBe(1); // Should not have increased
    });
});

test.describe("Observable Array - push", () => {
    test("should notify arrayChanged when items are pushed", () => {
        const observable = new TestObservable();
        let arrayChangedCount = 0;
        let lastChange: any = null;

        const disposer = observable.arrayChanged.attach((sender, args) => {
            arrayChangedCount++;
            lastChange = args;
        });

        observable.items.push("item1");

        expect(arrayChangedCount).toBe(1);
        expect(lastChange.arrayPropertyName).toBe("items");
        expect(lastChange.index).toBe(0);
        expect(lastChange.removedItems).toEqual([]);
        expect(lastChange.addedItemCount).toBe(1);

        disposer();
    });

    test("should notify with correct index when pushing to non-empty array", () => {
        const observable = new TestObservable();
        observable.items.push("item1", "item2");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items.push("item3");

        expect(lastChange.index).toBe(2);
        expect(lastChange.addedItemCount).toBe(1);

        disposer();
    });

    test("should notify with correct count when pushing multiple items", () => {
        const observable = new TestObservable();
        let lastChange: any = null;

        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items.push("item1", "item2", "item3");

        expect(lastChange.index).toBe(0);
        expect(lastChange.addedItemCount).toBe(3);
        expect(observable.items.length).toBe(3);

        disposer();
    });
});

test.describe("Observable Array - pop", () => {
    test("should notify arrayChanged when items are popped", () => {
        const observable = new TestObservable();
        observable.items.push("item1", "item2");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        const removed = observable.items.pop();

        expect(removed).toBe("item2");
        expect(lastChange.index).toBe(1);
        expect(lastChange.removedItems).toEqual(["item2"]);
        expect(lastChange.addedItemCount).toBe(0);
        expect(observable.items.length).toBe(1);

        disposer();
    });

    test("should not notify when popping from empty array", () => {
        const observable = new TestObservable();
        let notifyCount = 0;

        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items.pop();

        expect(notifyCount).toBe(0);

        disposer();
    });
});

test.describe("Observable Array - shift", () => {
    test("should notify arrayChanged when items are shifted", () => {
        const observable = new TestObservable();
        observable.items.push("item1", "item2");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        const removed = observable.items.shift();

        expect(removed).toBe("item1");
        expect(lastChange.index).toBe(0);
        expect(lastChange.removedItems).toEqual(["item1"]);
        expect(lastChange.addedItemCount).toBe(0);
        expect(observable.items.length).toBe(1);

        disposer();
    });

    test("should not notify when shifting from empty array", () => {
        const observable = new TestObservable();
        let notifyCount = 0;

        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items.shift();

        expect(notifyCount).toBe(0);

        disposer();
    });
});

test.describe("Observable Array - unshift", () => {
    test("should notify arrayChanged when items are unshifted", () => {
        const observable = new TestObservable();
        observable.items.push("item2");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items.unshift("item1");

        expect(lastChange.index).toBe(0);
        expect(lastChange.removedItems).toEqual([]);
        expect(lastChange.addedItemCount).toBe(1);
        expect(observable.items[0]).toBe("item1");
        expect(observable.items.length).toBe(2);

        disposer();
    });

    test("should notify with correct count when unshifting multiple items", () => {
        const observable = new TestObservable();
        let lastChange: any = null;

        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items.unshift("item1", "item2", "item3");

        expect(lastChange.index).toBe(0);
        expect(lastChange.addedItemCount).toBe(3);
        expect(observable.items.length).toBe(3);

        disposer();
    });
});

test.describe("Observable Array - splice", () => {
    test("should notify when items are removed via splice", () => {
        const observable = new TestObservable();
        observable.items.push("item1", "item2", "item3");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        const removed = observable.items.splice(1, 1);

        expect(removed).toEqual(["item2"]);
        expect(lastChange.index).toBe(1);
        expect(lastChange.removedItems).toEqual(["item2"]);
        expect(lastChange.addedItemCount).toBe(0);
        expect(observable.items.length).toBe(2);

        disposer();
    });

    test("should notify when items are added via splice", () => {
        const observable = new TestObservable();
        observable.items.push("item1", "item3");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items.splice(1, 0, "item2");

        expect(lastChange.index).toBe(1);
        expect(lastChange.removedItems).toEqual([]);
        expect(lastChange.addedItemCount).toBe(1);
        expect(observable.items).toEqual(["item1", "item2", "item3"]);

        disposer();
    });

    test("should notify when items are replaced via splice", () => {
        const observable = new TestObservable();
        observable.items.push("item1", "item2", "item3");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        const removed = observable.items.splice(1, 1, "newItem");

        expect(removed).toEqual(["item2"]);
        expect(lastChange.index).toBe(1);
        expect(lastChange.removedItems).toEqual(["item2"]);
        expect(lastChange.addedItemCount).toBe(1);
        expect(observable.items).toEqual(["item1", "newItem", "item3"]);

        disposer();
    });

    test("should handle negative start index", () => {
        const observable = new TestObservable();
        observable.items.push("item1", "item2", "item3");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items.splice(-1, 1);

        expect(lastChange.index).toBe(2);
        expect(lastChange.removedItems).toEqual(["item3"]);
        expect(observable.items).toEqual(["item1", "item2"]);

        disposer();
    });
});

test.describe("Observable Array - index assignment", () => {
    test("should notify when item is set via index", () => {
        const observable = new TestObservable();
        observable.items.push("item1", "item2");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items[0] = "newItem1";

        expect(lastChange.index).toBe(0);
        expect(lastChange.removedItems).toEqual(["item1"]);
        expect(lastChange.addedItemCount).toBe(1);
        expect(observable.items[0]).toBe("newItem1");

        disposer();
    });

    test("should notify when adding at new index", () => {
        const observable = new TestObservable();

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items[0] = "item1";

        expect(lastChange.index).toBe(0);
        expect(lastChange.removedItems).toEqual([]);
        expect(lastChange.addedItemCount).toBe(1);

        disposer();
    });

    test("should not notify when setting same value", () => {
        const observable = new TestObservable();
        observable.items.push("item1");

        let notifyCount = 0;
        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items[0] = "item1"; // Same value

        expect(notifyCount).toBe(0);

        disposer();
    });
});

test.describe("Observable Array - sort", () => {
    test("should notify when array is sorted", () => {
        const observable = new TestObservable();
        observable.items.push("c", "a", "b");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items.sort();

        expect(lastChange.index).toBe(0);
        expect(lastChange.removedItems).toEqual(["c", "a", "b"]);
        expect(lastChange.addedItemCount).toBe(3);
        expect(observable.items).toEqual(["a", "b", "c"]);

        disposer();
    });

    test("should not notify when sort does not change order", () => {
        const observable = new TestObservable();
        observable.items.push("a", "b", "c");

        let notifyCount = 0;
        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items.sort();

        expect(notifyCount).toBe(0);
        expect(observable.items).toEqual(["a", "b", "c"]);

        disposer();
    });

    test("should sort with custom compare function", () => {
        const observable = new TestObservable();
        observable.items.push("aa", "aaa", "a");

        let notifyCount = 0;
        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items.sort((a, b) => a.length - b.length);

        expect(notifyCount).toBe(1);
        expect(observable.items).toEqual(["a", "aa", "aaa"]);

        disposer();
    });
});

test.describe("Observable Array - reverse", () => {
    test("should notify when array is reversed", () => {
        const observable = new TestObservable();
        observable.items.push("a", "b", "c");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items.reverse();

        expect(lastChange.index).toBe(0);
        expect(lastChange.removedItems).toEqual(["a", "b", "c"]);
        expect(lastChange.addedItemCount).toBe(3);
        expect(observable.items).toEqual(["c", "b", "a"]);

        disposer();
    });

    test("should not notify when reverse does not change order (single item)", () => {
        const observable = new TestObservable();
        observable.items.push("a");

        let notifyCount = 0;
        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items.reverse();

        expect(notifyCount).toBe(0);

        disposer();
    });

    test("should not notify when reverse does not change order (palindrome)", () => {
        const observable = new TestObservable();
        observable.items.push("a", "b", "a");

        let notifyCount = 0;
        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items.reverse();

        expect(notifyCount).toBe(0);

        disposer();
    });
});

test.describe("Observable Array - fill", () => {
    test("should notify when array is filled", () => {
        const observable = new TestObservable();
        observable.items.push("a", "b", "c");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items.fill("x");

        expect(lastChange.index).toBe(0);
        expect(lastChange.removedItems).toEqual(["a", "b", "c"]);
        expect(lastChange.addedItemCount).toBe(3);
        expect(observable.items).toEqual(["x", "x", "x"]);

        disposer();
    });

    test("should notify when partial fill with start index", () => {
        const observable = new TestObservable();
        observable.items.push("a", "b", "c", "d");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items.fill("x", 1, 3);

        expect(lastChange.index).toBe(1);
        expect(lastChange.removedItems).toEqual(["b", "c"]);
        expect(lastChange.addedItemCount).toBe(2);
        expect(observable.items).toEqual(["a", "x", "x", "d"]);

        disposer();
    });

    test("should not notify when fill does not change values", () => {
        const observable = new TestObservable();
        observable.items.push("x", "x", "x");

        let notifyCount = 0;
        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items.fill("x");

        expect(notifyCount).toBe(0);

        disposer();
    });

    test("should not notify when filling empty array", () => {
        const observable = new TestObservable();

        let notifyCount = 0;
        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items.fill("x");

        expect(notifyCount).toBe(0);

        disposer();
    });
});

test.describe("Observable Array - copyWithin", () => {
    test("should notify when copyWithin changes array", () => {
        const observable = new TestObservable();
        observable.items.push("a", "b", "c", "d", "e");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        // Copy elements from index 3 to index 0
        observable.items.copyWithin(0, 3);

        expect(lastChange.index).toBe(0);
        expect(lastChange.removedItems).toEqual(["a", "b"]);
        expect(lastChange.addedItemCount).toBe(2);
        expect(observable.items).toEqual(["d", "e", "c", "d", "e"]);

        disposer();
    });

    test("should notify when copyWithin with end parameter", () => {
        const observable = new TestObservable();
        observable.items.push("a", "b", "c", "d", "e");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        // Copy element at index 3 to index 1
        observable.items.copyWithin(1, 3, 4);

        expect(lastChange.index).toBe(1);
        expect(lastChange.removedItems).toEqual(["b"]);
        expect(lastChange.addedItemCount).toBe(1);
        expect(observable.items).toEqual(["a", "d", "c", "d", "e"]);

        disposer();
    });

    test("should not notify when copyWithin does not change values", () => {
        const observable = new TestObservable();
        observable.items.push("a", "a", "a");

        let notifyCount = 0;
        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items.copyWithin(0, 1);

        expect(notifyCount).toBe(0);

        disposer();
    });
});

test.describe("Observable Array - length assignment", () => {
    test("should notify when length is reduced", () => {
        const observable = new TestObservable();
        observable.items.push("a", "b", "c");

        let lastChange: any = null;
        const disposer = observable.arrayChanged.attach((sender, args) => {
            lastChange = args;
        });

        observable.items.length = 1;

        expect(lastChange.index).toBe(1);
        expect(lastChange.removedItems).toEqual(["b", "c"]);
        expect(lastChange.addedItemCount).toBe(0);
        expect(observable.items.length).toBe(1);

        disposer();
    });

    test("should not notify when length is increased (sparse array)", () => {
        const observable = new TestObservable();
        observable.items.push("a");

        let notifyCount = 0;
        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items.length = 3;

        expect(notifyCount).toBe(0);
        expect(observable.items.length).toBe(3);

        disposer();
    });

    test("should not notify when length is set to same value", () => {
        const observable = new TestObservable();
        observable.items.push("a", "b");

        let notifyCount = 0;
        const disposer = observable.arrayChanged.attach(() => {
            notifyCount++;
        });

        observable.items.length = 2;

        expect(notifyCount).toBe(0);

        disposer();
    });
});

test.describe("Observable - sender verification", () => {
    test("should pass correct sender in propertyChanged callback", () => {
        const observable = new TestObservable();
        let receivedSender: any = null;

        const disposer = observable.propertyChanged.attach((sender) => {
            receivedSender = sender;
        });

        observable.name = "Test";

        expect(receivedSender).toBe(observable);

        disposer();
    });

    test("should pass correct sender in arrayChanged callback", () => {
        const observable = new TestObservable();
        let receivedSender: any = null;

        const disposer = observable.arrayChanged.attach((sender) => {
            receivedSender = sender;
        });

        observable.items.push("item1");

        expect(receivedSender).toBe(observable);

        disposer();
    });
});

test.describe("Observable.forward", () => {
    test("should observe direct property changes", () => {
        const parent = new ParentObservable();
        const notifications: any[] = [];

        const disposer = Observable.forward(parent, "child", (detail) => {
            notifications.push(detail);
        });

        const child = new ValueObservable();
        parent.child = child;

        expect(notifications.length).toBe(1);
        expect(notifications[0].propertyName).toBe("child");
        expect(notifications[0].newValue).toBe(child);

        disposer();
    });

    test("should observe nested property changes", () => {
        const parent = new ParentObservable();
        const child = new ValueObservable();
        parent.child = child;

        const notifications: any[] = [];

        const disposer = Observable.forward(parent, "child.value", (detail) => {
            notifications.push(detail);
        });

        child.value = "test";

        expect(notifications.length).toBe(1);
        expect(notifications[0].propertyName).toBe("value");
        expect(notifications[0].newValue).toBe("test");

        disposer();
    });

    test("should notify initial state when requested", () => {
        const parent = new ParentObservable();
        const child = new ValueObservable();
        child.value = "initial";
        parent.child = child;

        const notifications: any[] = [];

        const disposer = Observable.forward(parent, "child.value", (detail) => {
            notifications.push(detail);
        }, true);

        expect(notifications.length).toBe(1);
        expect(notifications[0].propertyName).toBe("value");
        expect(notifications[0].newValue).toBe("initial");

        disposer();
    });

    test("should stop observing after disposer is called", () => {
        const parent = new ParentObservable();
        const child = new ValueObservable();
        parent.child = child;

        const notifications: any[] = [];

        const disposer = Observable.forward(parent, "child.value", (detail) => {
            notifications.push(detail);
        });

        child.value = "first";
        expect(notifications.length).toBe(1);

        disposer();

        child.value = "second";
        expect(notifications.length).toBe(1); // Should not increase
    });

    test("should re-observe when parent property changes", () => {
        const parent = new ParentObservable();
        const child1 = new ValueObservable();
        const child2 = new ValueObservable();
        parent.child = child1;

        const notifications: any[] = [];

        const disposer = Observable.forward(parent, "child.value", (detail) => {
            notifications.push(detail);
        });

        child1.value = "child1-value";
        expect(notifications.length).toBe(1);

        // Change the child reference - this triggers notification #2
        parent.child = child2;

        // Old child changes should not be observed - count stays at 2
        child1.value = "child1-updated";
        expect(notifications.length).toBe(2);

        // New child changes should be observed
        child2.value = "child2-value";
        expect(notifications.length).toBe(3);
        expect(notifications[2].newValue).toBe("child2-value");

        disposer();
    });

    test("should include path in ForwardObservedPropertyChangedArgs", () => {
        const parent = new ParentObservable();
        const child = new ValueObservable();
        parent.child = child;

        const notifications: any[] = [];

        const disposer = Observable.forward(parent, "child.value", (detail) => {
            notifications.push(detail);
        });

        child.value = "test";

        expect(notifications[0].path).toBe("child.value");
        expect(notifications[0].propertyOwner).toBe(child);

        disposer();
    });

    test("should include propertyOwner in notifications", () => {
        const parent = new ParentObservable();
        const notifications: any[] = [];

        const disposer = Observable.forward(parent, "child", (detail) => {
            notifications.push(detail);
        });

        const child = new ValueObservable();
        parent.child = child;

        expect(notifications[0].propertyOwner).toBe(parent);

        disposer();
    });
});

test.describe("Observable.forward - array observation", () => {
    test("should observe array property with wildcard path", () => {
        const container = new ContainerObservable();
        const notifications: any[] = [];

        const disposer = Observable.forward(container, "items.*", (detail) => {
            notifications.push(detail);
        }, true);

        // Initial notification for items property
        expect(notifications.length).toBe(1);

        disposer();
    });

    test("should notify on array mutations", () => {
        const container = new ContainerObservable();
        const notifications: any[] = [];

        const disposer = Observable.forward(container, "items.*", (detail) => {
            notifications.push(detail);
        });

        container.items.push(new ItemObservable("item1"));

        // Should get arrayChanged notification
        const arrayNotification = notifications.find(n => n.arrayPropertyName === "items");
        expect(arrayNotification).toBeTruthy();

        disposer();
    });

    test("should include path and arrayInstance in array notifications", () => {
        const container = new ContainerObservable();
        const notifications: any[] = [];

        const disposer = Observable.forward(container, "items.*", (detail) => {
            notifications.push(detail);
        });

        container.items.push(new ItemObservable("item1"));

        const arrayNotification = notifications.find(n => n.arrayPropertyName === "items");
        expect(arrayNotification.path).toBe("items");
        expect(arrayNotification.arrayInstance).toBe(container.items);

        disposer();
    });

    test("should observe nested properties on array items with items.*.property path", () => {
        const container = new ContainerObservable();
        const item1 = new ItemObservable("item1");
        const item2 = new ItemObservable("item2");
        container.items.push(item1, item2);

        const notifications: any[] = [];

        const disposer = Observable.forward(container, "items.*.name", (detail) => {
            notifications.push(detail);
        });

        // Change name on first item
        item1.name = "updated-item1";

        expect(notifications.length).toBe(1);
        expect(notifications[0].propertyName).toBe("name");
        expect(notifications[0].newValue).toBe("updated-item1");

        // Change name on second item
        item2.name = "updated-item2";

        expect(notifications.length).toBe(2);
        expect(notifications[1].newValue).toBe("updated-item2");

        disposer();
    });

    test("should notify initial state for array item properties", () => {
        const container = new ContainerObservable();
        const item1 = new ItemObservable("first");
        const item2 = new ItemObservable("second");
        container.items.push(item1, item2);

        const notifications: any[] = [];

        const disposer = Observable.forward(container, "items.*.name", (detail) => {
            notifications.push(detail);
        }, true);

        // Should receive initial state for both items
        expect(notifications.length).toBe(2);
        expect(notifications.some(n => n.newValue === "first")).toBe(true);
        expect(notifications.some(n => n.newValue === "second")).toBe(true);

        disposer();
    });

    test("should include item index in path for array item properties", () => {
        const container = new ContainerObservable();
        const item1 = new ItemObservable("item1");
        container.items.push(item1);

        const notifications: any[] = [];

        const disposer = Observable.forward(container, "items.*.name", (detail) => {
            notifications.push(detail);
        });

        item1.name = "updated";

        expect(notifications[0].path).toBe("items.0.name");

        disposer();
    });

    test("should notify array changes when observing items.*.property and new item is pushed", () => {
        const container = new ContainerObservable();
        const item1 = new ItemObservable("item1");
        container.items.push(item1);

        const notifications: any[] = [];

        const disposer = Observable.forward(container, "items.*.name", (detail) => {
            notifications.push(detail);
        });

        // Push a new item AFTER observation is set up
        const item2 = new ItemObservable("item2");
        container.items.push(item2);

        // Should get array changed notification
        const arrayNotification = notifications.find(n => n.arrayPropertyName === "items");
        expect(arrayNotification).toBeTruthy();
        expect(arrayNotification.addedItemCount).toBe(1);

        disposer();
    });

    test("should observe property changes on newly added array items", () => {
        const container = new ContainerObservable();

        const notifications: any[] = [];

        const disposer = Observable.forward(container, "items.*.name", (detail) => {
            notifications.push(detail);
        });

        // Push a new item AFTER observation is set up
        const item1 = new ItemObservable("item1");
        container.items.push(item1);

        // Clear notifications from the push
        const pushNotificationCount = notifications.length;

        // Change the name on the newly added item
        item1.name = "updated-item1";

        // Should get property changed notification for the new item
        const propertyNotification = notifications.slice(pushNotificationCount).find(n => n.propertyName === "name");
        expect(propertyNotification).toBeTruthy();
        expect(propertyNotification.newValue).toBe("updated-item1");

        disposer();
    });

    test("should stop observing removed items (no memory leak)", () => {
        const container = new ContainerObservable();
        const item1 = new ItemObservable("item1");
        const item2 = new ItemObservable("item2");
        container.items.push(item1, item2);

        const notifications: any[] = [];

        const disposer = Observable.forward(container, "items.*.name", (detail) => {
            notifications.push(detail);
        });

        // Verify observation works before removal
        item1.name = "updated-item1";
        expect(notifications.some(n => n.propertyName === "name" && n.newValue === "updated-item1")).toBe(true);

        // Clear notifications
        notifications.length = 0;

        // Remove item1 from the array
        container.items.shift();

        // Clear the array change notification
        const afterRemovalCount = notifications.length;

        // Change the removed item's name - should NOT trigger notification (memory leak if it does)
        item1.name = "should-not-notify";

        // Should NOT have any new property notifications for item1
        const leakedNotification = notifications.slice(afterRemovalCount).find(n => n.propertyName === "name" && n.newValue === "should-not-notify");
        expect(leakedNotification).toBeFalsy();

        disposer();
    });

    test("should stop observing dynamically added then removed items", () => {
        const container = new ContainerObservable();

        const notifications: any[] = [];

        const disposer = Observable.forward(container, "items.*.name", (detail) => {
            notifications.push(detail);
        });

        // Add an item dynamically
        const item1 = new ItemObservable("item1");
        container.items.push(item1);

        // Verify observation works
        notifications.length = 0;
        item1.name = "updated";
        expect(notifications.some(n => n.propertyName === "name" && n.newValue === "updated")).toBe(true);

        // Remove the item
        container.items.pop();
        notifications.length = 0;

        // Change the removed item - should NOT trigger notification
        item1.name = "should-not-notify";
        const leakedNotification = notifications.find(n => n.propertyName === "name" && n.newValue === "should-not-notify");
        expect(leakedNotification).toBeFalsy();

        disposer();
    });

    test("should correctly track observers when removing from middle of array", () => {
        const container = new ContainerObservable();
        const item1 = new ItemObservable("item1");
        const item2 = new ItemObservable("item2");
        const item3 = new ItemObservable("item3");
        container.items.push(item1, item2, item3);

        const notifications: any[] = [];

        const disposer = Observable.forward(container, "items.*.name", (detail) => {
            notifications.push(detail);
        });

        // Remove item2 from the middle
        container.items.splice(1, 1);
        notifications.length = 0;

        // item1 should still be observed
        item1.name = "item1-updated";
        expect(notifications.some(n => n.newValue === "item1-updated")).toBe(true);

        // item3 should still be observed
        item3.name = "item3-updated";
        expect(notifications.some(n => n.newValue === "item3-updated")).toBe(true);

        // item2 should NOT be observed (memory leak if it is)
        notifications.length = 0;
        item2.name = "should-not-notify";
        expect(notifications.find(n => n.newValue === "should-not-notify")).toBeFalsy();

        disposer();
    });
});

test.describe("Observable.forward - plain objects", () => {
    test("should observe plain object properties", () => {
        const plainObj = {
            nested: {
                value: "initial"
            }
        };

        const notifications: any[] = [];

        const disposer = Observable.forward(plainObj, "nested.value", (detail) => {
            notifications.push(detail);
        }, true);

        // Should notify initial state
        expect(notifications.length).toBe(1);
        expect(notifications[0].newValue).toBe("initial");

        disposer();
    });

    test("should handle null values in path gracefully", () => {
        const obj = {
            child: null as any
        };

        const notifications: any[] = [];

        const disposer = Observable.forward(obj, "child.value", (detail) => {
            notifications.push(detail);
        }, true);

        // Should notify with undefined for missing nested property
        expect(notifications.length).toBe(1);
        expect(notifications[0].newValue).toBeUndefined();

        disposer();
    });

    test("should handle undefined source gracefully", () => {
        const notifications: any[] = [];

        const disposer = Observable.forward(undefined as any, "prop", (detail) => {
            notifications.push(detail);
        }, true);

        // Should handle gracefully without throwing
        expect(notifications.length).toBe(1);
        expect(notifications[0].newValue).toBeUndefined();

        disposer();
    });
});

test.describe("Observable.forward - edge cases", () => {
    test("should handle property set to null then back to object", () => {
        const parent = new ParentObservable();
        const child1 = new ValueObservable();
        parent.child = child1;

        const notifications: any[] = [];

        const disposer = Observable.forward(parent, "child.value", (detail) => {
            notifications.push(detail);
        });

        child1.value = "test1";
        expect(notifications.length).toBe(1);

        // Set child to null
        parent.child = null;
        expect(notifications.length).toBe(2);

        // Changes to old child should not notify
        child1.value = "test2";
        expect(notifications.length).toBe(2);

        // Set new child
        const child2 = new ValueObservable();
        parent.child = child2;
        expect(notifications.length).toBe(3);

        // New child changes should notify
        child2.value = "test3";
        expect(notifications.length).toBe(4);
        expect(notifications[3].newValue).toBe("test3");

        disposer();
    });

    test("should observe deeply nested paths", () => {
        const level1 = new Level1Observable();
        const level2 = new Level2Observable();
        const level3 = new ValueObservable();
        level1.level2 = level2;
        level2.level3 = level3;

        const notifications: any[] = [];

        const disposer = Observable.forward(level1, "level2.level3.value", (detail) => {
            notifications.push(detail);
        });

        level3.value = "deep";

        expect(notifications.length).toBe(1);
        expect(notifications[0].path).toBe("level2.level3.value");
        expect(notifications[0].newValue).toBe("deep");

        disposer();
    });
});

test.describe("Observable.forward - nested collection wildcard depth tests", () => {
    test("should observe items.*.container.items.* (wildcard → property → wildcard)", () => {
        const outer = new OuterContainer();

        // Setup structure before observing
        const outerItem1 = new OuterItem("outer1");
        outer.items.push(outerItem1);

        const outerItem2 = new OuterItem("outer2");
        outer.items.push(outerItem2);

        const notifications: any[] = [];

        const disposer = Observable.forward(outer, "items.*.container.items.*", (detail) => {
            notifications.push(detail);
        });

        // Add nested item to first outer item's container
        const nestedItem1 = new NestedItem("nested1");
        outerItem1.container.items.push(nestedItem1);

        // Should get array change notification for inner collection
        const innerArrayNotification = notifications.find(n => n.arrayPropertyName === "items" && n.path === "items.0.container.items");
        expect(innerArrayNotification).toBeTruthy();
        expect(innerArrayNotification.addedItemCount).toBe(1);

        // Add nested item to second outer item's container
        const nestedItem2 = new NestedItem("nested2");
        outerItem2.container.items.push(nestedItem2);

        const innerArrayNotification2 = notifications.find(n => n.arrayPropertyName === "items" && n.path === "items.1.container.items");
        expect(innerArrayNotification2).toBeTruthy();

        disposer();
    });

    test("should observe items.*.tags.* (wildcard → wildcard direct)", () => {
        const outer = new OuterContainer();

        // Setup outer items before observing
        const outerItem1 = new OuterItem("outer1");
        outer.items.push(outerItem1);

        const outerItem2 = new OuterItem("outer2");
        outer.items.push(outerItem2);

        const notifications: any[] = [];

        const disposer = Observable.forward(outer, "items.*.tags.*", (detail) => {
            notifications.push(detail);
        });

        // Add tag to first item
        outerItem1.tags.push("tag1");

        // Should get array change notification for tags collection
        const tagsArrayNotification = notifications.find(n => n.arrayPropertyName === "tags" && n.path === "items.0.tags");
        expect(tagsArrayNotification).toBeTruthy();
        expect(tagsArrayNotification.addedItemCount).toBe(1);

        // Add tag to second item
        outerItem2.tags.push("tag2");

        const tagsArrayNotification2 = notifications.find(n => n.arrayPropertyName === "tags" && n.path === "items.1.tags");
        expect(tagsArrayNotification2).toBeTruthy();

        disposer();
    });

    test("should observe items.*.container.items.*.name (wildcard → property → wildcard → property)", () => {
        const outer = new OuterContainer();

        // Setup outer items and nested items before observing
        const outerItem1 = new OuterItem("outer1");
        outer.items.push(outerItem1);

        const nestedItem1 = new NestedItem("nested1");
        outerItem1.container.items.push(nestedItem1);

        const outerItem2 = new OuterItem("outer2");
        outer.items.push(outerItem2);

        const nestedItem2 = new NestedItem("nested2");
        outerItem2.container.items.push(nestedItem2);

        const notifications: any[] = [];

        const disposer = Observable.forward(outer, "items.*.container.items.*.name", (detail) => {
            notifications.push(detail);
        });

        // Change name on first nested item
        nestedItem1.name = "updated-nested1";

        const nameNotification = notifications.find(n => n.propertyName === "name" && n.newValue === "updated-nested1");
        expect(nameNotification).toBeTruthy();
        expect(nameNotification.path).toBe("items.0.container.items.0.name");

        // Change name on second nested item
        nestedItem2.name = "updated-nested2";

        const nameNotification2 = notifications.find(n => n.propertyName === "name" && n.newValue === "updated-nested2");
        expect(nameNotification2).toBeTruthy();
        expect(nameNotification2.path).toBe("items.1.container.items.0.name");

        disposer();
    });

    test("should notify initial state for nested collections", () => {
        const outer = new OuterContainer();

        // Setup structure before observing
        const outerItem1 = new OuterItem("outer1");
        outer.items.push(outerItem1);

        const nestedItem1 = new NestedItem("initial1");
        const nestedItem2 = new NestedItem("initial2");
        outerItem1.container.items.push(nestedItem1, nestedItem2);

        const notifications: any[] = [];

        const disposer = Observable.forward(outer, "items.*.container.items.*.name", (detail) => {
            notifications.push(detail);
        }, true);

        // Should receive initial state for both nested items
        expect(notifications.length).toBe(2);
        expect(notifications.some(n => n.newValue === "initial1")).toBe(true);
        expect(notifications.some(n => n.newValue === "initial2")).toBe(true);

        disposer();
    });

    test("should handle multiple nested items across multiple outer items", () => {
        const outer = new OuterContainer();

        // Setup multiple outer items with multiple nested items each
        const outerItem1 = new OuterItem("outer1");
        outer.items.push(outerItem1);

        const nestedItem1a = new NestedItem("nested1a");
        const nestedItem1b = new NestedItem("nested1b");
        outerItem1.container.items.push(nestedItem1a, nestedItem1b);

        const outerItem2 = new OuterItem("outer2");
        outer.items.push(outerItem2);

        const nestedItem2a = new NestedItem("nested2a");
        const nestedItem2b = new NestedItem("nested2b");
        outerItem2.container.items.push(nestedItem2a, nestedItem2b);

        const notifications: any[] = [];

        const disposer = Observable.forward(outer, "items.*.container.items.*.name", (detail) => {
            notifications.push(detail);
        });

        // Change all nested items and verify each is observed
        nestedItem1a.name = "updated1a";
        nestedItem1b.name = "updated1b";
        nestedItem2a.name = "updated2a";
        nestedItem2b.name = "updated2b";

        // Verify all 4 name changes were observed
        expect(notifications.filter(n => n.propertyName === "name" && n.newValue === "updated1a").length).toBe(1);
        expect(notifications.filter(n => n.propertyName === "name" && n.newValue === "updated1b").length).toBe(1);
        expect(notifications.filter(n => n.propertyName === "name" && n.newValue === "updated2a").length).toBe(1);
        expect(notifications.filter(n => n.propertyName === "name" && n.newValue === "updated2b").length).toBe(1);

        // Verify paths are correct
        expect(notifications.some(n => n.path === "items.0.container.items.0.name")).toBe(true);
        expect(notifications.some(n => n.path === "items.0.container.items.1.name")).toBe(true);
        expect(notifications.some(n => n.path === "items.1.container.items.0.name")).toBe(true);
        expect(notifications.some(n => n.path === "items.1.container.items.1.name")).toBe(true);

        disposer();
    });

    test("should observe replacement of intermediate container", () => {
        const outer = new OuterContainer();
        const outerItem1 = new OuterItem("outer1");
        outer.items.push(outerItem1);

        const nestedItem1 = new NestedItem("nested1");
        outerItem1.container.items.push(nestedItem1);

        const notifications: any[] = [];

        const disposer = Observable.forward(outer, "items.*.container.items.*.name", (detail) => {
            notifications.push(detail);
        });

        // Change name - should notify
        nestedItem1.name = "changed1";
        expect(notifications.some(n => n.newValue === "changed1")).toBe(true);

        const notificationCountBefore = notifications.length;

        // Replace the container
        const newContainer = new InnerContainer();
        const newNestedItem = new NestedItem("new-nested");
        newContainer.items.push(newNestedItem);
        outerItem1.container = newContainer;

        // Changes to old nested item should no longer notify
        nestedItem1.name = "should-not-notify";
        expect(notifications.length).toBeGreaterThan(notificationCountBefore); // Container change notifications

        const countBeforeNewItemChange = notifications.length;

        // Changes to new nested item should notify
        newNestedItem.name = "new-changed";
        expect(notifications.length).toBeGreaterThan(countBeforeNewItemChange);
        expect(notifications.some(n => n.newValue === "new-changed")).toBe(true);

        disposer();
    });
});

// #region Keyed Observable Array Test Helper

interface KeyedItem {
    name: string;
    value: number;
}

class KeyedContainerObservable extends Observable<KeyedContainerObservable> {
    #items: KeyedItem[] & Record<string, KeyedItem>;

    get items(): KeyedItem[] & Record<string, KeyedItem> {
        return this.#items;
    }

    constructor() {
        super();
        this.#items = createObservableArray<KeyedItem, string>(
            [],
            (index: number, removed: KeyedItem[], added: number) => this.notifyArrayChanged("items", index, removed, added),
            {
                keySelector: item => item.name,
                onKeyChanged: (key, newValue, oldValue) => this.notifyPropertyChanged(`items.${key}`, newValue, oldValue)
            }
        );
    }
}

// #endregion

test.describe("Observable Array - keyed access", () => {
    test("should initialize keys for existing items", () => {
        const item1: KeyedItem = { name: "first", value: 1 };
        const item2: KeyedItem = { name: "second", value: 2 };

        const items = createObservableArray<KeyedItem, string>(
            [item1, item2],
            () => {},
            { keySelector: item => item.name }
        );

        expect(items["first"]).toBe(item1);
        expect(items["second"]).toBe(item2);
    });

    test("should add key when item is pushed", () => {
        const container = new KeyedContainerObservable();
        const item: KeyedItem = { name: "test", value: 42 };

        container.items.push(item);

        expect(container.items["test"]).toBe(item);
        expect(container.items[0]).toBe(item);
    });

    test("should fire both arrayChanged and propertyChanged when item is pushed", () => {
        const container = new KeyedContainerObservable();
        const arrayNotifications: any[] = [];
        const propertyNotifications: any[] = [];

        container.arrayChanged.attach((sender, args) => {
            arrayNotifications.push(args);
        });
        container.propertyChanged.attach((sender, args) => {
            propertyNotifications.push(args);
        });

        const item: KeyedItem = { name: "test", value: 42 };
        container.items.push(item);

        expect(arrayNotifications.length).toBe(1);
        expect(arrayNotifications[0].addedItemCount).toBe(1);

        expect(propertyNotifications.length).toBe(1);
        expect(propertyNotifications[0].propertyName).toBe("items.test");
        expect(propertyNotifications[0].newValue).toBe(item);
        expect(propertyNotifications[0].oldValue).toBeUndefined();
    });

    test("should remove key when item is popped", () => {
        const container = new KeyedContainerObservable();
        const item: KeyedItem = { name: "test", value: 42 };
        container.items.push(item);

        expect(container.items["test"]).toBe(item);

        container.items.pop();

        expect(container.items["test"]).toBeUndefined();
    });

    test("should fire both notifications when item is popped", () => {
        const container = new KeyedContainerObservable();
        const item: KeyedItem = { name: "test", value: 42 };
        container.items.push(item);

        const arrayNotifications: any[] = [];
        const propertyNotifications: any[] = [];

        container.arrayChanged.attach((sender, args) => {
            arrayNotifications.push(args);
        });
        container.propertyChanged.attach((sender, args) => {
            propertyNotifications.push(args);
        });

        container.items.pop();

        expect(arrayNotifications.length).toBe(1);
        expect(arrayNotifications[0].removedItems).toEqual([item]);

        expect(propertyNotifications.length).toBe(1);
        expect(propertyNotifications[0].propertyName).toBe("items.test");
        expect(propertyNotifications[0].newValue).toBeUndefined();
        expect(propertyNotifications[0].oldValue).toBe(item);
    });

    test("should remove key when item is shifted", () => {
        const container = new KeyedContainerObservable();
        const item1: KeyedItem = { name: "first", value: 1 };
        const item2: KeyedItem = { name: "second", value: 2 };
        container.items.push(item1, item2);

        container.items.shift();

        expect(container.items["first"]).toBeUndefined();
        expect(container.items["second"]).toBe(item2);
    });

    test("should add key when item is unshifted", () => {
        const container = new KeyedContainerObservable();
        const item1: KeyedItem = { name: "first", value: 1 };
        container.items.push(item1);

        const item2: KeyedItem = { name: "second", value: 2 };
        container.items.unshift(item2);

        expect(container.items["second"]).toBe(item2);
        expect(container.items[0]).toBe(item2);
    });

    test("should handle splice with add and remove", () => {
        const container = new KeyedContainerObservable();
        const item1: KeyedItem = { name: "a", value: 1 };
        const item2: KeyedItem = { name: "b", value: 2 };
        const item3: KeyedItem = { name: "c", value: 3 };
        container.items.push(item1, item2, item3);

        const arrayNotifications: any[] = [];
        const propertyNotifications: any[] = [];

        container.arrayChanged.attach((sender, args) => {
            arrayNotifications.push(args);
        });
        container.propertyChanged.attach((sender, args) => {
            propertyNotifications.push(args);
        });

        const newItem: KeyedItem = { name: "new", value: 99 };
        container.items.splice(1, 1, newItem); // Remove "b", add "new"

        expect(container.items["b"]).toBeUndefined();
        expect(container.items["new"]).toBe(newItem);

        expect(arrayNotifications.length).toBe(1);
        expect(arrayNotifications[0].removedItems).toEqual([item2]);
        expect(arrayNotifications[0].addedItemCount).toBe(1);

        // Should have 2 property notifications: one for removal of "b", one for addition of "new"
        expect(propertyNotifications.length).toBe(2);
        expect(propertyNotifications.some(n => n.propertyName === "items.b" && n.newValue === undefined)).toBe(true);
        expect(propertyNotifications.some(n => n.propertyName === "items.new" && n.newValue === newItem)).toBe(true);
    });

    test("should update key when item is replaced via index", () => {
        const container = new KeyedContainerObservable();
        const item1: KeyedItem = { name: "old", value: 1 };
        container.items.push(item1);

        const arrayNotifications: any[] = [];
        const propertyNotifications: any[] = [];

        container.arrayChanged.attach((sender, args) => {
            arrayNotifications.push(args);
        });
        container.propertyChanged.attach((sender, args) => {
            propertyNotifications.push(args);
        });

        const item2: KeyedItem = { name: "new", value: 2 };
        container.items[0] = item2;

        expect(container.items["old"]).toBeUndefined();
        expect(container.items["new"]).toBe(item2);

        expect(arrayNotifications.length).toBe(1);
        expect(propertyNotifications.length).toBe(2);
    });

    test("should support direct key assignment", () => {
        const container = new KeyedContainerObservable();
        const item: KeyedItem = { name: "test", value: 42 };

        container.items["test"] = item;

        expect(container.items.length).toBe(1);
        expect(container.items[0]).toBe(item);
        expect(container.items["test"]).toBe(item);
    });

    test("should fire notifications on direct key assignment", () => {
        const container = new KeyedContainerObservable();

        const arrayNotifications: any[] = [];
        const propertyNotifications: any[] = [];

        container.arrayChanged.attach((sender, args) => {
            arrayNotifications.push(args);
        });
        container.propertyChanged.attach((sender, args) => {
            propertyNotifications.push(args);
        });

        const item: KeyedItem = { name: "test", value: 42 };
        container.items["test"] = item;

        expect(arrayNotifications.length).toBe(1);
        expect(arrayNotifications[0].addedItemCount).toBe(1);

        expect(propertyNotifications.length).toBe(1);
        expect(propertyNotifications[0].propertyName).toBe("items.test");
    });

    test("should support direct key deletion", () => {
        const container = new KeyedContainerObservable();
        const item: KeyedItem = { name: "test", value: 42 };
        container.items.push(item);

        expect(container.items.length).toBe(1);

        delete container.items["test"];

        expect(container.items.length).toBe(0);
        expect(container.items["test"]).toBeUndefined();
    });

    test("should fire notifications on direct key deletion", () => {
        const container = new KeyedContainerObservable();
        const item: KeyedItem = { name: "test", value: 42 };
        container.items.push(item);

        const arrayNotifications: any[] = [];
        const propertyNotifications: any[] = [];

        container.arrayChanged.attach((sender, args) => {
            arrayNotifications.push(args);
        });
        container.propertyChanged.attach((sender, args) => {
            propertyNotifications.push(args);
        });

        delete container.items["test"];

        expect(arrayNotifications.length).toBe(1);
        expect(arrayNotifications[0].removedItems).toEqual([item]);

        expect(propertyNotifications.length).toBe(1);
        expect(propertyNotifications[0].propertyName).toBe("items.test");
        expect(propertyNotifications[0].oldValue).toBe(item);
    });

    test("should support 'in' operator for keys", () => {
        const container = new KeyedContainerObservable();
        const item: KeyedItem = { name: "test", value: 42 };
        container.items.push(item);

        expect("test" in container.items).toBe(true);
        expect("nonexistent" in container.items).toBe(false);
    });

    test("should preserve iteration with for...of", () => {
        const container = new KeyedContainerObservable();
        const item1: KeyedItem = { name: "a", value: 1 };
        const item2: KeyedItem = { name: "b", value: 2 };
        container.items.push(item1, item2);

        const collected: KeyedItem[] = [];
        for (const item of container.items)
            collected.push(item);

        expect(collected).toEqual([item1, item2]);
    });

    test("should preserve forEach iteration", () => {
        const container = new KeyedContainerObservable();
        const item1: KeyedItem = { name: "a", value: 1 };
        const item2: KeyedItem = { name: "b", value: 2 };
        container.items.push(item1, item2);

        const collected: KeyedItem[] = [];
        container.items.forEach(item => collected.push(item));

        expect(collected).toEqual([item1, item2]);
    });

    test("should preserve map functionality", () => {
        const container = new KeyedContainerObservable();
        const item1: KeyedItem = { name: "a", value: 1 };
        const item2: KeyedItem = { name: "b", value: 2 };
        container.items.push(item1, item2);

        const names = container.items.map(item => item.name);

        expect(names).toEqual(["a", "b"]);
    });

    test("should preserve spread operator", () => {
        const container = new KeyedContainerObservable();
        const item1: KeyedItem = { name: "a", value: 1 };
        const item2: KeyedItem = { name: "b", value: 2 };
        container.items.push(item1, item2);

        const spread = [...container.items];

        expect(spread).toEqual([item1, item2]);
    });

    test("should handle replacing item with same key via key assignment", () => {
        const container = new KeyedContainerObservable();
        const item1: KeyedItem = { name: "test", value: 1 };
        container.items.push(item1);

        const arrayNotifications: any[] = [];
        const propertyNotifications: any[] = [];

        container.arrayChanged.attach((sender, args) => {
            arrayNotifications.push(args);
        });
        container.propertyChanged.attach((sender, args) => {
            propertyNotifications.push(args);
        });

        const item2: KeyedItem = { name: "test", value: 2 };
        container.items["test"] = item2;

        expect(container.items.length).toBe(1);
        expect(container.items[0]).toBe(item2);
        expect(container.items["test"]).toBe(item2);

        // Should have removal and addition notifications
        expect(arrayNotifications.length).toBe(2); // Remove old, add new
    });

    test("should handle length reduction removing keyed items", () => {
        const container = new KeyedContainerObservable();
        const item1: KeyedItem = { name: "a", value: 1 };
        const item2: KeyedItem = { name: "b", value: 2 };
        const item3: KeyedItem = { name: "c", value: 3 };
        container.items.push(item1, item2, item3);

        const propertyNotifications: any[] = [];
        container.propertyChanged.attach((sender, args) => {
            propertyNotifications.push(args);
        });

        container.items.length = 1;

        expect(container.items["a"]).toBe(item1);
        expect(container.items["b"]).toBeUndefined();
        expect(container.items["c"]).toBeUndefined();

        // Should have property notifications for removed keys
        expect(propertyNotifications.some(n => n.propertyName === "items.b")).toBe(true);
        expect(propertyNotifications.some(n => n.propertyName === "items.c")).toBe(true);
    });
});
