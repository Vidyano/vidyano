import * as Polymer from "../../../../libs/polymer/polymer.js"
import { WebComponent } from "../../../web-component/web-component.js"

@WebComponent.register({
    properties: {
        value: {
            type: String,
            observer: "_valueChanged"
        },
        isReadOnly: {
            type: Boolean,
            reflectToAttribute: true
        },
        input: {
            type: Object,
            readOnly: true
        },
        isNew: {
            type: Boolean,
            reflectToAttribute: true
        },
        disabled: {
            type: Boolean,
            reflectToAttribute: true
        },
        placeholder: String,
        sensitive: Boolean
    }
})
export class PersistentObjectAttributeMultiStringItem extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-multi-string-item.html">`; }

    readonly input: HTMLInputElement; private _setInput: (input: HTMLInputElement) => void;
    private _focusQueued: boolean;
    isNew: boolean;
    isReadOnly: boolean;
    sensitive: boolean;

    constructor(public value: string) {
        super();
    }

    connectedCallback() {
        super.connectedCallback();

        this._setInput(<HTMLInputElement>this.shadowRoot.querySelector("input"));

        if (this._focusQueued) {
            this._focusQueued = false;
            this._focusElement(this.input);
        }
    }

    focus() {
        this.shadowRoot.querySelector("input")?.focus();
    }

    queueFocus() {
        this._focusQueued = true;
    }

    private _valueChanged(value: string) {
        if (this.isReadOnly)
            return;

        if (this.isNew) {
            if (value) {
                this.fire("multi-string-item-value-new", { value: value });
                this.value = "";
            }
        }
        else
            this.fire("multi-string-item-value-changed", null);
    }

    private _onInputBlur() {
        if (!this.isReadOnly && !this.isNew)
            this.fire("multi-string-item-value-changed", null);
    }
}