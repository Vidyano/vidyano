import { AppRoute } from "../app-route/app-route.js"
import { Dialog } from "../dialog/dialog.js"

export enum KeyCodes {
    backspace = 8,
    tab = 9,
    enter = 13,
    shift = 16,
    control = 17,
    alt = 18,
    pause = 19,
    break = 19,
    capslock = 20,
    escape = 27,
    pageup = 33,
    pagedown = 34,
    end = 35,
    home = 36,
    leftarrow = 37,
    uparrow = 38,
    rightarrow = 39,
    downarrow = 40,
    comma = 44,
    subtract = 45,
    period = 46,
    zero = 48,
    one = 49,
    two = 50,
    three = 51,
    four = 52,
    five = 53,
    six = 54,
    seven = 55,
    eight = 56,
    nine = 57
}

export let KeyIdentifiers = {
    "tab": "U+0009",
    "esc": "U+001B",
    "space": "U+0020",
    "*": "U+002A",
    "0": "U+0030",
    "1": "U+0031",
    "2": "U+0032",
    "3": "U+0033",
    "4": "U+0034",
    "5": "U+0035",
    "6": "U+0036",
    "7": "U+0037",
    "8": "U+0038",
    "9": "U+0039",
    "a": "U+0041",
    "b": "U+0042",
    "c": "U+0043",
    "d": "U+0044",
    "e": "U+0045",
    "f": "U+0046",
    "g": "U+0047",
    "h": "U+0048",
    "i": "U+0049",
    "j": "U+004A",
    "k": "U+004B",
    "l": "U+004C",
    "m": "U+004D",
    "n": "U+004E",
    "o": "U+004F",
    "p": "U+0050",
    "q": "U+0051",
    "r": "U+0052",
    "s": "U+0053",
    "t": "U+0054",
    "u": "U+0055",
    "v": "U+0056",
    "w": "U+0057",
    "x": "U+0058",
    "y": "U+0059",
    "z": "U+005A",
    "del": "U+007F",
};

export interface IKeysEvent extends CustomEvent {
    detail: {
        combo: string;
        key: string;
        shiftKey?: boolean;
        ctrlKey?: boolean;
        altKey?: boolean;
        metaKey?: boolean;
        event: string;
        keyboardEvent: IEvent;
    };
}

export interface IEvent extends KeyboardEvent {
    keyIdentifier: string;
}

export interface IKeybindingRegistration {
    keys: string[];
    element: HTMLElement;
    listener: (e: IKeysEvent) => void;
    nonExclusive: boolean;
    priority?: number;
    scope?: AppRoute | Dialog;
}