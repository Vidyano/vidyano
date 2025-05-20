declare global {
    export interface BooleanConstructor {
        parse(value: string): boolean;
    }
}

Boolean.parse = function(value: string): boolean {
    if (value == null)
        return null;

    switch (value.toLowerCase()) {
        case "true":
            return true;
        case "false":
            return false;
        default:
            return null;
    }
}

export default Boolean;