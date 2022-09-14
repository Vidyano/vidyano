import * as Polymer from "../../libs/polymer/polymer.js"
import * as Keyboard from "../utils/keyboard.js"
import type { Scroller } from "../scroller/scroller.js"
import { WebComponent } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        input: String,
        tags: Array,
        readonly: {
            type: Boolean,
            reflectToAttribute: true
        },
        sensitive: {
            type: Boolean,
            reflectToAttribute: true,
            value: true
        }
    }
})
export class Tags extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="tags.html">` }

    input: string;
    tags: string[];
    readonly: boolean;

    focus() {
        this.$.tagsInput.focus();
    }

    private _passFocus(e: Polymer.Gestures.TapEvent) {
        if (this.readonly)
            return;

        const input = <HTMLInputElement>this.shadowRoot.querySelector("input");
        if (!input)
            return;

        input.focus();

        const scroller = <Scroller>this.$.scroller;
        scroller.scrollToBottom();
    }

    private _checkKeyPress(e: KeyboardEvent) {
        if (!this.input)
            return;

        if (e.key === Keyboard.Keys.Enter)
            this._addTag(this.input);
        else {
            const newWidth = (this.input.length * 8) + 30;
            this.updateStyles({ "--tags-input--width": `${newWidth}px` });
        }
    }

    private _onInputBlur() {
        if (!this.input || this.readonly) {
            this.input = "";
            return;
        }

        this._addTag(this.input);
    }

    private _addTag(input: string) {
        if (!((/^\s*$/.test(input)))) {
            this.push("tags", input);
            this.input = undefined;
            this.updateStyles({ "--tags-input--width": "30px" });
        }
        else
            this.input = undefined;
    }

    private _onDeleteTap(e: Polymer.Gestures.TapEvent) {
        this.splice("tags", this.tags.indexOf(e.model.tag), 1);
    }
}