export interface ISubjectNotifier<TSource, TDetail> {
    notify?: (source: TSource, detail?: TDetail) => void;
}

export class PropertyChangedArgs {
    constructor(
        public readonly propertyName: string,
        public readonly newValue: any,
        public readonly oldValue: any) {
    }
}

export class ArrayChangedArgs {
    constructor(public arrayPropertyName: string,
        public readonly index: number,
        public readonly removedItems?: any[],
        public readonly addedItemCount?: number) {
    }
}

export interface ISubjectDisposer {
    (): void;
}

export class Subject<TSource, TDetail> {
    private _observers: ((sender: TSource, detail: TDetail) => void)[] = [];

    constructor(notifier: ISubjectNotifier<TSource, TDetail>) {
        notifier.notify = (source: TSource, detail: TDetail) => {
            for (const i in this._observers)
                this._observers[i](source, detail);
        };
    }

    attach(observer: ISubjectObserver<TSource, TDetail>): ISubjectDisposer {
        const id = this._observers.length;
        this._observers.push(observer);

        return <ISubjectDisposer>this._detach.bind(this, id);
    }

    private _detach(observerId: number) {
        delete this._observers[observerId];
    }
}

export interface ISubjectObserver<TSource, TDetail> {
    (sender: TSource, detail: TDetail): void;
}

export class Observable<T> {
    private _propertyChangedNotifier: ISubjectNotifier<T, PropertyChangedArgs>;
    private _arrayChangedNotifier: ISubjectNotifier<T, ArrayChangedArgs>;
    readonly propertyChanged: Subject<T, PropertyChangedArgs>;
    readonly arrayChanged: Subject<T, ArrayChangedArgs>;

    constructor() {
        this.propertyChanged = new Subject<T, PropertyChangedArgs>(this._propertyChangedNotifier = {});
        this.arrayChanged = new Subject<T, ArrayChangedArgs>(this._arrayChangedNotifier = {});
    }

    protected notifyPropertyChanged(propertyName: string, newValue: any, oldValue?: any) {
        this._propertyChangedNotifier.notify(<T><any>this, new PropertyChangedArgs(propertyName, newValue, oldValue));
    }

    protected notifyArrayChanged(arrayPropertyName: string, index: number, removedItems: any[] = [], addedCount: number) {
        this._arrayChangedNotifier.notify(<T><any>this, new ArrayChangedArgs(arrayPropertyName, index, removedItems, addedCount));
    }
}

export interface IPropertyChangedObserver<T> extends ISubjectObserver<T, PropertyChangedArgs> {
}