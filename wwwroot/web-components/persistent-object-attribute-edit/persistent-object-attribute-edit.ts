import * as Polymer from '../../libs/@polymer/polymer.js';
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import { WebComponent, WebComponentListener } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        attribute: Object,
        focus: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true
        },
        hasError: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHasError(attribute.validationError)"
        },
        reverse: {
            type: Boolean,
            reflectToAttribute: true
        },
        sensitive: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeSensitive(attribute.isSensitive, isAppSensitive)"
        },
        readOnly: {
            type: Boolean,
            computed: "attribute.isReadOnly",
            reflectToAttribute: true
        }
    },
    listeners: {
        "focusin": "_focus",
        "focusout": "_blur",
    },
    forwardObservers: [
        "attribute.isSensitive",
        "attribute.validationError",
        "attribute.parent.isFrozen",
        "attribute.isReadOnly"
    ],
    sensitive: true
})
export class PersistentObjectAttributeEdit extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-edit.html">`; }

    private _setFocus: (val: boolean) => void;
    attribute: Vidyano.PersistentObjectAttribute;

    private _focus(e: Event) {
        this._setFocus(true);
    }

    private _blur(e: Event) {
        this._setFocus(false);
    }

    private _computeHasError(validationError: string): boolean {
        return !!validationError;
    }

    private _computeSensitive(isSensitive: boolean, isAppSensitive: boolean): boolean {
        return isSensitive && isAppSensitive;
    }
}