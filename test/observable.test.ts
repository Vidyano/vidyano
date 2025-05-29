import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import {
    Observable,
    PropertyChangedArgs,
    ArrayChangedArgs,
    ForwardObservedPropertyChangedArgs,
    ForwardObservedArrayChangedArgs,
    ForwardObservedChainDisposer,
    Subject,
    ISubjectObserver
} from "../src/vidyano/observable";

// Helper observable classes for tests
class TestObservableItem extends Observable<{ id: string; data: string }> {
    _id: string = "";
    _data: string = "";

    constructor(id: string, data: string) {
        super();
        this._id = id;
        this._data = data;
    }

    get id(): string {
        return this._id;
    }
    set id(val: string) {
        const old = this._id;
        if (old === val) return;
        this._id = val;
        this.notifyPropertyChanged("id", val, old);
    }

    get data(): string {
        return this._data;
    }
    set data(val: string) {
        const old = this._data;
        if (old === val) return;
        this._data = val;
        this.notifyPropertyChanged("data", val, old);
    }
}

class TestObservable extends Observable<{ name: string; value: number; nested?: TestObservable | null; items?: TestObservableItem[], plain?: { p1: string } }> {
    _name: string = "";
    _value: number = 0;
    _nested?: TestObservable | null = undefined;
    _items: TestObservableItem[] = [];
    _plain?: { p1: string };

    constructor(name: string = "initialName", value: number = 0) {
        super();
        this._name = name;
        this._value = value;
    }

    get name(): string {
        return this._name;
    }
    set name(val: string) {
        const old = this._name;
        if (old === val) return;
        this._name = val;
        this.notifyPropertyChanged("name", val, old);
    }

    get value(): number {
        return this._value;
    }
    set value(val: number) {
        const old = this._value;
        if (old === val) return;
        this._value = val;
        this.notifyPropertyChanged("value", val, old);
    }

    get nested(): TestObservable | null | undefined {
        return this._nested;
    }
    set nested(val: TestObservable | null | undefined) {
        const old = this._nested;
        if (old === val) return;
        this._nested = val;
        this.notifyPropertyChanged("nested", val, old);
    }

    get items(): TestObservableItem[] {
        return this._items;
    }
    set items(val: TestObservableItem[]) {
        const old = this._items;
        if (old === val) return;
        this._items = val;
        this.notifyPropertyChanged("items", val, old);
    }

    get plain(): { p1: string } | undefined {
        return this._plain;
    }
    set plain(val: { p1: string } | undefined) {
        const old = this._plain;
        if (old === val) return;
        this._plain = val;
        this.notifyPropertyChanged("plain", val, old);
    }

    addItem(item: TestObservableItem) {
        const index = this._items.length;
        this._items.push(item);
        this.notifyArrayChanged("items", index, [], 1);
    }

    removeItem(index: number): TestObservableItem[] {
        const removed = this._items.splice(index, 1);
        if (removed.length > 0) {
            this.notifyArrayChanged("items", index, removed, 0);
        }
        return removed;
    }

    replaceItem(index: number, item: TestObservableItem): TestObservableItem[] {
        const removed = this._items.splice(index, 1, item);
        this.notifyArrayChanged("items", index, removed, 1);
        return removed;
    }
}


describe('Observable Core', () => {
    test('Observable.forward static method exists', () => {
        expect(Observable.forward).toBeTypeOf('function');
    });

    test('propertyChanged event fires with correct arguments', () => {
        const obs = new TestObservable("oldName", 10);
        const mockCallback = vi.fn();
        obs.propertyChanged.attach(mockCallback);

        obs.name = "newName";
        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith(obs, expect.any(PropertyChangedArgs));
        const args = mockCallback.mock.calls[0][1] as PropertyChangedArgs;
        expect(args.propertyName).toBe("name");
        expect(args.newValue).toBe("newName");
        expect(args.oldValue).toBe("oldName");

        obs.value = 20;
        expect(mockCallback).toHaveBeenCalledTimes(2);
        const args2 = mockCallback.mock.calls[1][1] as PropertyChangedArgs;
        expect(args2.propertyName).toBe("value");
        expect(args2.newValue).toBe(20);
        expect(args2.oldValue).toBe(10);
    });

    test('arrayChanged event fires for addItem', () => {
        const obs = new TestObservable();
        const mockCallback = vi.fn();
        obs.arrayChanged.attach(mockCallback);

        const item1 = new TestObservableItem("id1", "data1");
        obs.addItem(item1);

        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith(obs, expect.any(ArrayChangedArgs));
        const args = mockCallback.mock.calls[0][1] as ArrayChangedArgs;
        expect(args.arrayPropertyName).toBe("items");
        expect(args.index).toBe(0);
        expect(args.removedItems).toEqual([]);
        expect(args.addedItemCount).toBe(1);
        expect(obs.items).toEqual([item1]);
    });

    test('arrayChanged event fires for removeItem', () => {
        const obs = new TestObservable();
        const item1 = new TestObservableItem("id1", "data1");
        obs.addItem(item1); 

        const mockCallback = vi.fn();
        obs.arrayChanged.attach(mockCallback);

        obs.removeItem(0);

        expect(mockCallback).toHaveBeenCalledTimes(1);
        const args = mockCallback.mock.calls[0][1] as ArrayChangedArgs;
        expect(args.arrayPropertyName).toBe("items");
        expect(args.index).toBe(0);
        expect(args.removedItems).toEqual([item1]);
        expect(args.addedItemCount).toBe(0);
        expect(obs.items).toEqual([]);
    });

    test('arrayChanged event fires for replaceItem', () => {
        const obs = new TestObservable();
        const item1 = new TestObservableItem("id1", "data1");
        const item2 = new TestObservableItem("id2", "data2");
        obs.addItem(item1);

        const mockCallback = vi.fn();
        obs.arrayChanged.attach(mockCallback);

        obs.replaceItem(0, item2);

        expect(mockCallback).toHaveBeenCalledTimes(1);
        const args = mockCallback.mock.calls[0][1] as ArrayChangedArgs;
        expect(args.arrayPropertyName).toBe("items");
        expect(args.index).toBe(0);
        expect(args.removedItems).toEqual([item1]);
        expect(args.addedItemCount).toBe(1);
        expect(obs.items).toEqual([item2]);
    });
});

describe('Subject (underlying Observable events)', () => {
    test('Subject attach and detach works', () => {
        const capturedNotifier: { notify?: (source: any, detail: any) => void } = {};
        const subject = new Subject<any, any>(capturedNotifier);

        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const dispose1 = subject.attach(callback1);
        const dispose2 = subject.attach(callback2);

        expect(capturedNotifier.notify).toBeTypeOf('function'); 

        capturedNotifier.notify!("sender_obj", "detail_data_1");
        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback1).toHaveBeenCalledWith("sender_obj", "detail_data_1");
        expect(callback2).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledWith("sender_obj", "detail_data_1");

        dispose1(); 
        capturedNotifier.notify!("sender_obj_2", "detail_data_2");
        expect(callback1).toHaveBeenCalledTimes(1); 
        expect(callback2).toHaveBeenCalledTimes(2);
        expect(callback2).toHaveBeenCalledWith("sender_obj_2", "detail_data_2");

        dispose2(); 
        capturedNotifier.notify!("sender_obj_3", "detail_data_3");
        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(2); 
    });

    test('Subject attach with weak option and manual dispose', () => {
        const capturedNotifier: { notify?: (source: any, detail: any) => void } = {};
        const subject = new Subject<any, any>(capturedNotifier);

        let observer: ISubjectObserver<any, any> | null = vi.fn((_sender, _detail) => {});
        const dispose = subject.attach(observer!, { weak: true });

        capturedNotifier.notify!("sender", "detail_weak_1");
        expect(observer).toHaveBeenCalledTimes(1);

        dispose(); 

        capturedNotifier.notify!("sender", "detail_weak_2_after_dispose");
        expect(observer).toHaveBeenCalledTimes(1); 

        observer = null; 
    });
});


describe('forwardObserver (via Observable.forward)', () => {
    let source: TestObservable;
    let mockCallback: ReturnType<typeof vi.fn>;
    let disposer: ForwardObservedChainDisposer | undefined;

    beforeEach(() => {
        source = new TestObservable("root", 0);
        source.nested = new TestObservable("nestedL1", 1);
        source.nested.nested = new TestObservable("nestedL2", 2);
        source.items = [new TestObservableItem("item0", "data0"), new TestObservableItem("item1", "data1")];
        source.plain = { p1: "plainP1Value" };
        mockCallback = vi.fn();
    });

    afterEach(() => {
        if (disposer) {
            disposer();
            disposer = undefined;
        }
        vi.clearAllMocks();
    });

    describe('Basic Path Observation', () => {
        test('observes a direct property on an Observable', () => {
            disposer = Observable.forward(source, "name", mockCallback);

            expect(mockCallback).not.toHaveBeenCalled();

            source.name = "newName";
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const args = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("name");
            expect(args.newValue).toBe("newName");
            expect(args.oldValue).toBe("root");
            expect(args.propertyOwner).toBe(source);
        });

        test('observes a direct property on a plain object', () => {
            const plainSource = { name: "plainName", value: 100 };
            disposer = Observable.forward(plainSource, "name", mockCallback);

            expect(mockCallback).not.toHaveBeenCalled();

            plainSource.name = "newName"; 
            expect(mockCallback).not.toHaveBeenCalled();
        });

        test('observes a direct property on a plain object', () => {
            const plainSource = { name: "plainName", value: 100 };
            disposer = Observable.forward(plainSource, "name", mockCallback, true);

            expect(mockCallback).toHaveBeenCalledTimes(1);
            const args = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("name");
            expect(args.newValue).toBe("plainName");
            expect(args.propertyOwner).toBe(plainSource);

            plainSource.name = "newName"; 
            expect(mockCallback).toHaveBeenCalledTimes(1);
        });
    });

    describe('Nested Path Observation', () => {
        test('observes a nested property (Observable.Observable.prop)', () => {
            disposer = Observable.forward(source, "nested.name", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();

            source.nested!.name = "newNestedName";
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const changeArgs = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(changeArgs.path).toBe("nested.name");
            expect(changeArgs.newValue).toBe("newNestedName");
            expect(changeArgs.propertyOwner).toBe(source.nested);
        });

        test('observes deeply nested property (Observable.Observable.Observable.prop)', () => {
            disposer = Observable.forward(source, "nested.nested.name", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();

            source.nested!.nested!.name = "newDeepNestedName";
            expect(mockCallback).toHaveBeenCalledTimes(1);
            expect((mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs).newValue).toBe("newDeepNestedName");
            expect((mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs).path).toBe("nested.nested.name");
        });

        test('observes nested property through plain object segment (Observable.plainObj.prop)', () => {
            // Path "plain.p1" - observer interested in "p1" of the object in "plain"
            disposer = Observable.forward(source, "plain.p1", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();

            const newPlain = { p1: "newP1Value" };
            source.plain = newPlain; // This changes the "plain" property of `source`
            
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const args = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("plain"); // Notification for the 'plain' property changing
            expect(args.newValue).toBe(newPlain);
            expect(args.propertyOwner).toBe(source);

            // Direct mutation of the plain object's property won't be caught
            newPlain.p1 = "anotherNewP1Value";
            expect(mockCallback).toHaveBeenCalledTimes(1);
        });
    });

    describe('Array Observation (`*` syntax)', () => {
        test('observes property changes on items in an array (items.*.data)', () => {
            disposer = Observable.forward(source, "items.*.data", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();

            source.items[0].data = "newData0";
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const changeArgs = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(changeArgs.path).toBe("items.0.data");
            expect(changeArgs.newValue).toBe("newData0");

            const newItem = new TestObservableItem("itemNew", "dataNew");
            source.items = [newItem]; // This changes the 'items' property

            expect(mockCallback).toHaveBeenCalledTimes(2); // Once for item[0].data, once for 'items' itself
            const itemsChangeArgs = mockCallback.mock.calls[1][0] as ForwardObservedPropertyChangedArgs;
            expect(itemsChangeArgs.path).toBe("items");
            expect(itemsChangeArgs.newValue).toEqual([newItem]);

            newItem.data = "superNewData";
            expect(mockCallback).toHaveBeenCalledTimes(3); // For newItem.data change
            const newItemDataChangeArgs = mockCallback.mock.calls[2][0] as ForwardObservedPropertyChangedArgs;
            expect(newItemDataChangeArgs.newValue).toBe("superNewData");
            expect(newItemDataChangeArgs.path).toBe("items.0.data");
        });

        test('observes array mutations via `items.*` path', () => {
            disposer = Observable.forward(source, "items.*", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();

            const itemNew = new TestObservableItem("itemNew", "dataNew");
            source.addItem(itemNew);
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const addArgs = mockCallback.mock.calls[0][0] as ForwardObservedArrayChangedArgs;
            expect(addArgs).toBeInstanceOf(ForwardObservedArrayChangedArgs);
            expect(addArgs.path).toBe("items"); // Path to the array property itself
            expect(addArgs.arrayPropertyName).toBe("items");
            expect(addArgs.index).toBe(2); 
            expect(addArgs.addedItemCount).toBe(1);

            const removed = source.removeItem(0);
            expect(mockCallback).toHaveBeenCalledTimes(2);
            const removeArgs = mockCallback.mock.calls[1][0] as ForwardObservedArrayChangedArgs;
            expect(removeArgs).toBeInstanceOf(ForwardObservedArrayChangedArgs);
            expect(removeArgs.path).toBe("items");
            expect(removeArgs.removedItems).toEqual(removed);
        });

        test('observes items in a top-level array `array.*.prop`', () => {
            const topLevelArray = [new TestObservableItem("top0", "dataTop0"), new TestObservableItem("top1", "dataTop1")];
            disposer = Observable.forward(topLevelArray, "*.data", mockCallback);

            expect(mockCallback).not.toHaveBeenCalled();

            topLevelArray[0].data = "newTopData0";
            expect(mockCallback).toHaveBeenCalledTimes(1);
            expect((mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs).newValue).toBe("newTopData0");
            expect((mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs).path).toBe("0.data");
        });
    });

    describe('Initial State Notification (`notifyInitialState`)', () => {
        test('notifyInitialState = true emits initial values for terminal properties', () => {
            disposer = Observable.forward(source, "nested.name", mockCallback, true);
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const args = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("nested.name");
            expect(args.newValue).toBe("nestedL1");
            expect(args.propertyOwner).toBe(source.nested);
        });

        test('notifyInitialState = true emits initial values for properties of items in an array (items.*.data)', () => {
            source.items = [new TestObservableItem("id0", "data0"), new TestObservableItem("id1", "data1")];
            disposer = Observable.forward(source, "items.*.data", mockCallback, true);

            expect(mockCallback).toHaveBeenCalledTimes(2);
            
            const args1 = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args1.path).toBe("items.0.data");
            expect(args1.newValue).toBe("data0");
            expect(args1.propertyOwner).toBe(source.items[0]);

            const args2 = mockCallback.mock.calls[1][0] as ForwardObservedPropertyChangedArgs;
            expect(args2.path).toBe("items.1.data");
            expect(args2.newValue).toBe("data1");
            expect(args2.propertyOwner).toBe(source.items[1]);
        });

        test('notifyInitialState = true for `items.*` path emits initial state for the array property itself', () => {
            source.items = [new TestObservableItem("id0", "initialData")]; // Ensure items has a value
            disposer = Observable.forward(source, "items.*", mockCallback, true);
        
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const args = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("items");
            expect(args.newValue).toBe(source.items);
            expect(args.propertyOwner).toBe(source);
        });


        test('notifyInitialState = false (default) does not emit initial values', () => {
            disposer = Observable.forward(source, "name", mockCallback, false);
            expect(mockCallback).not.toHaveBeenCalled();
            source.name = "anotherName";
            expect(mockCallback).toHaveBeenCalledTimes(1);
        });

        test('notifyInitialState = false (default) for nested path', () => {
            disposer = Observable.forward(source, "nested.name", mockCallback, false);
            expect(mockCallback).not.toHaveBeenCalled();

            source.nested!.name = "newNestedName"; 
            expect(mockCallback).toHaveBeenCalledTimes(1);

            const newNested = new TestObservable("replacement", 7);
            source.nested = newNested; 
            expect(mockCallback).toHaveBeenCalledTimes(2);

            newNested.name = "finalNestedName"; 
            expect(mockCallback).toHaveBeenCalledTimes(3);
            expect((mockCallback.mock.calls[2][0] as ForwardObservedPropertyChangedArgs).newValue).toBe("finalNestedName");
        });
    });

    describe('Observing Plain Objects and Primitives', () => {
        test('primitive source (string), notifyInitialState=true', () => {
            const primitiveSource = "test string";
            disposer = Observable.forward(primitiveSource as any, "foo", mockCallback, true);
            expect(mockCallback).toHaveBeenCalledTimes(1); 
            const args = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("foo");
            expect(args.newValue).toBeUndefined();
            expect(args.propertyOwner).toBe(primitiveSource);
        });

        test('primitive source (string), notifyInitialState=false', () => {
            const primitiveSource = "test string";
            disposer = Observable.forward(primitiveSource as any, "foo", mockCallback, false);
            expect(mockCallback).not.toHaveBeenCalled();
        });
        
        test('root plain object, nested path, notifyInitialState=true', () => {
            const plainSource = { nested: { value: "deepValue" } };
            disposer = Observable.forward(plainSource, "nested.value", mockCallback, true);

            expect(mockCallback).toHaveBeenCalledTimes(1);
            const args = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("nested.value");
            expect(args.newValue).toBe("deepValue");
            expect(args.propertyOwner).toBe(plainSource.nested);

            plainSource.nested.value = "newValue";
            expect(mockCallback).toHaveBeenCalledTimes(1); // No further calls for plain object mutation

            plainSource.nested = { value: "newStructure" };
            expect(mockCallback).toHaveBeenCalledTimes(1); // No further calls
        });

        test('root plain object, path to non-existent property, notifyInitialState=true', () => {
            const plainSource = { name: "test" };
            disposer = Observable.forward(plainSource, "nonExistent.sub", mockCallback, true);
            
            expect(mockCallback).toHaveBeenCalledTimes(1); 
            const args = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("nonExistent.sub");
            expect(args.newValue).toBeUndefined(); 
            expect(args.propertyOwner).toBeUndefined(); 
        });
        
        test('Observable with plain object property, path into plain obj, notifyInitialState=true, then parent prop reassigned', () => {
            source.plain = { p1: "initialP1" };
            const initialPlainObject = source.plain;
            disposer = Observable.forward(source, "plain.p1", mockCallback, true);

            expect(mockCallback).toHaveBeenCalledTimes(1);
            let args = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("plain.p1");
            expect(args.newValue).toBe("initialP1");
            expect(args.propertyOwner).toBe(initialPlainObject);

            // Direct mutation of plain object's property is not observed
            initialPlainObject.p1 = "directMutation";
            expect(mockCallback).toHaveBeenCalledTimes(1);

            const newPlain = { p1: "reassignedP1" };
            const oldPlainValue = source.plain; // Capture for oldValue assertion
            source.plain = newPlain; // This is an observable change on `source`

            expect(mockCallback).toHaveBeenCalledTimes(3);
            
            // Callback 2: New initial state of "plain.p1" from the new 'plain' object
            args = mockCallback.mock.calls[1][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("plain.p1");
            expect(args.newValue).toBe("reassignedP1");
            expect(args.propertyOwner).toBe(newPlain);
            expect(args.oldValue).toBeUndefined(); // Initial state notifications have undefined oldValue

            // Callback 3: Change of the "plain" property on the source observable
            args = mockCallback.mock.calls[2][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("plain");
            expect(args.newValue).toBe(newPlain);
            expect(args.propertyOwner).toBe(source);
            expect(args.oldValue).toBe(oldPlainValue);
        });
    });

    describe('Path Updates (Dynamic Chains)', () => {
        test('re-observes when an intermediate Observable object in path changes', () => {
            disposer = Observable.forward(source, "nested.name", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();

            const oldNested = source.nested;
            const newNested = new TestObservable("newIntermediate", 50);
            source.nested = newNested;

            expect(mockCallback).toHaveBeenCalledTimes(1);
            expect((mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs).path).toBe("nested");
            expect((mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs).newValue).toBe(newNested);

            oldNested!.name = "silentChange"; 
            expect(mockCallback).toHaveBeenCalledTimes(1);

            newNested.name = "activeChange";
            expect(mockCallback).toHaveBeenCalledTimes(2);
            expect((mockCallback.mock.calls[1][0] as ForwardObservedPropertyChangedArgs).newValue).toBe("activeChange");
            expect((mockCallback.mock.calls[1][0] as ForwardObservedPropertyChangedArgs).path).toBe("nested.name");
        });

        test('handles intermediate object becoming null/undefined then reinstated', () => {
            disposer = Observable.forward(source, "nested.name", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();

            const oldNested = source.nested;
            source.nested = null; 
            expect(mockCallback).toHaveBeenCalledTimes(1); 
            expect((mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs).newValue).toBeNull();
            expect((mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs).path).toBe("nested");
            
            mockCallback.mockClear(); // Clear calls to focus on reinstatement

            oldNested!.name = "silentChangeAfterNull";
            expect(mockCallback).not.toHaveBeenCalled();

            const reinstatedNested = new TestObservable("reinstated", 60);
            source.nested = reinstatedNested; 
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const changeArgs = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(changeArgs.path).toBe("nested");
            expect(changeArgs.newValue).toBe(reinstatedNested);

            // Check if observation of reinstatedNested.name works
            reinstatedNested.name = "newNameOnReinstated";
            expect(mockCallback).toHaveBeenCalledTimes(2);
            const nameChangeArgs = mockCallback.mock.calls[1][0] as ForwardObservedPropertyChangedArgs;
            expect(nameChangeArgs.path).toBe("nested.name");
            expect(nameChangeArgs.newValue).toBe("newNameOnReinstated");
        });
    });

    describe('Disposer Functionality', () => {
        test('calling disposer stops notifications', () => {
            disposer = Observable.forward(source, "name", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();

            source.name = "change1";
            expect(mockCallback).toHaveBeenCalledTimes(1);
            disposer!();
            disposer = undefined; 

            source.name = "change2_after_dispose";
            expect(mockCallback).toHaveBeenCalledTimes(1); 
        });
    });

    describe('Edge Cases (notifyInitialState defaults to false where not specified)', () => {
        test('observing on null/undefined source returns no-op disposer', () => {
            disposer = Observable.forward(null as any, "path", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();
            expect(disposer).toBeTypeOf('function');
            disposer(); 
            disposer = undefined;

            disposer = Observable.forward(undefined as any, "path", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();
            expect(disposer).toBeTypeOf('function');
            disposer();
            disposer = undefined;
        });

        test('observing a non-existent path on Observable (notifyInitialState=true)', () => {
            disposer = Observable.forward(source, "nonExistentProp.subProp", mockCallback, true);
            expect(mockCallback).toHaveBeenCalledTimes(1); 
            const args = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("nonExistentProp.subProp");
            expect(args.newValue).toBeUndefined();
            expect(args.propertyOwner).toBeUndefined(); // Owner of 'subProp' on undefined 'nonExistentProp'
        });

        test('observing a non-existent path on Observable (notifyInitialState=false, default)', () => {
            disposer = Observable.forward(source, "nonExistentProp", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();
        });
        
        test('observing an empty path string (notifyInitialState=false, default)', () => {
            disposer = Observable.forward(source, "", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();
        });

        test('observing an empty path string (notifyInitialState=true)', () => {
            disposer = Observable.forward(source, "", mockCallback, true);
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const args = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(args.path).toBe("");
            expect(args.propertyName).toBe("");
            expect(args.newValue).toBeUndefined(); 
            expect(args.propertyOwner).toBe(source);
        });

        test('observing `*` on a non-array property (e.g., "name.*") (notifyInitialState=false, default)', () => {
            disposer = Observable.forward(source, "name.*", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();

            source.name = "newName"; // Triggers notification for 'name'
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const changeArgs = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(changeArgs.path).toBe("name");
        });

        test('observing `*` on a non-array property (e.g., "name.*") (notifyInitialState=true)', () => {
            disposer = Observable.forward(source, "name.*", mockCallback, true);
            // With notifyInitialState=true and path "name.*", it will notify for "name" itself
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const initialArgs = mockCallback.mock.calls[0][0] as ForwardObservedPropertyChangedArgs;
            expect(initialArgs.path).toBe("name");
            expect(initialArgs.newValue).toBe(source.name);
            expect(initialArgs.propertyOwner).toBe(source);

            source.name = "newName";
            expect(mockCallback).toHaveBeenCalledTimes(2); // 1 initial + 1 change
            const changeArgs = mockCallback.mock.calls[1][0] as ForwardObservedPropertyChangedArgs;
            expect(changeArgs.path).toBe("name");
            expect(changeArgs.newValue).toBe("newName");
        });


        test('observing `*` without subsequent path segment on top-level array (e.g. `arraySource.*`) (notifyInitialState=false)', () => {
            const topLevelArray = [new TestObservableItem("id", "data")];
            disposer = Observable.forward(topLevelArray, "*", mockCallback);
            expect(mockCallback).not.toHaveBeenCalled();
        });
        
        test('observing `*` without subsequent path segment on top-level array (e.g. `arraySource.*`) (notifyInitialState=true)', () => {
            const topLevelArray = [new TestObservableItem("id", "data")];
            disposer = Observable.forward(topLevelArray, "*", mockCallback, true);
            expect(mockCallback).not.toHaveBeenCalled();
        });
    });
});