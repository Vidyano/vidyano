export declare type KeyValue<T> = {
    [key: string]: T;
};

export declare type KeyValueString = KeyValue<string>;

export declare type KeyValuePair<T, U> = {
    key: T;
    value: U;
};