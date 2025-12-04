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
