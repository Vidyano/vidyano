/**
 * @deprecated Use typescript `Record<string, T>` instead.
 */
export declare type KeyValue<T> = {
    [key: string]: T;
};

/**
 * @deprecated Use typescript `Record<string, string>` instead.
 */
export declare type KeyValueString = KeyValue<string>;

export declare type KeyValuePair<T, U> = {
    key: T;
    value: U;
};