import type { AppRoute } from "components/app-route/app-route"
import type { Dialog } from "components/dialog/dialog"

export const Keys = {
    Backspace: "Backspace",
    Tab: "Tab",
    Enter: "Enter",
    Shift: "Shift",
    Control: "Control",
    Alt: "Alt",
    Pause: "Pause",
    Break: "Break",
    CapsLock: "CapsLock",
    Escape: "Escape",
    PageUp: "PageUp",
    PageDown: "PageDown",
    End: "End",
    Home: "Home",
    ArrowLeft: "ArrowLeft",
    ArrowUp: "ArrowUp",
    ArrowRight: "ArrowRight",
    ArrowDown: "ArrowDown",
    Comma: ",",
    Subtract: "-",
    Period: ".",
    Zero: "0",
    One: "1",
    Two: "2",
    Three: "3",
    Four: "4",
    Five: "5",
    Six: "6",
    Seven: "7",
    Eight: "8",
    Nine: "9"
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