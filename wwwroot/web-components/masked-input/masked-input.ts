import * as Polymer from "../../libs/polymer/polymer"
import { WebComponent } from "../web-component/web-component"

@WebComponent.register({
    properties: {
        format: {
            type: String,
            observer: "_resetField",
            value: ""
        },
        separator: {
            type: String,
            observer: "_resetField",
            value: "\/:-"
        },
        allowed: {
            type: String,
            observer: "_resetField",
            value: "0123456789"
        },
        open: {
            type: String,
            observer: "_resetField",
            value: "_YMDhms"
        },
        disabled: {
            type: Boolean,
            reflectToAttribute: true
        },
        preserve: {
            type: Boolean,
            reflectToAttribute: true
        },
        size: {
            type: Number,
            computed: "_computeSize(format)"
        },
        value: {
            type: String,
            notify: true
        }
    }
})
export class MaskedInput extends WebComponent {
    static get template() {  return Polymer.html`<link rel="import" href="masked-input.html">` }

    private _startText: string;
    format: string;
    separator: string;
    allowed: string;
    open: string;
    disabled: boolean;
    preserve: boolean;
    value: string;

    connectedCallback() {
        super.connectedCallback();

        if (!this.preserve || this.input.value === "")
            this.value = this.format;
    }

    get input() {
        return this.$.input as HTMLInputElement;
    }

    private static otherKeys = ["Tab", "Enter", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];
    private _isOther(key: string) {
        return MaskedInput.otherKeys.indexOf(key) >= 0;
    }

    private _isGoodOnes(key: string) {
        return this.allowed.indexOf(key) !== -1 || key === "Backspace" || key === "Delete" || this._isOther(key);
    }

    private _isFilled() {
        // Check if any typeon characters are left
        // Work from end of string as it's usually last filled
        for (let a = this.input.value.length - 1; a >= 0; a--) {
            // Check against each typeon character
            for (let c = 0, d = this.open.length; c < d; c++) {
                // If one matches we don't need to check anymore
                if (this.input.value[a] === this.open[c])
                    return false;
            }
        }

        return true;
    }

    private _resetCursor() {
        if (!!this.input.value && this.input.value !== this.format)
            return;

        setTimeout(() => {
            this._setTextCursor(0);
        }, 1);
    }

    private _getTextCursor() {
        try {
            this.input.focus();
            if (this.input.selectionStart >= 0)
                return this.input.selectionStart;

            return -1;
        }
        catch (e) {
            return -1;
        }
    }

    private _setTextCursor(pos: number) {
        try {
            if (this.input.selectionStart) {
                this.input.focus();
                this.input.setSelectionRange(pos, pos);
            }
        }
        catch (e) {
            return false;
        }

        return true;
    }

    private _update(key: string) {
        let p = this._getTextCursor(),
				c = this.input.value,
				val = "";

        if (this.allowed.indexOf(key) !== -1) {
            p++;

            // If text cursor at end
            if (p > this.format.length)
                return false;

            // Handle cases where user places cursor before separator
            while (this.separator.indexOf(c.charAt(p - 1)) !== -1 && p <= this.format.length)
                p++;

            val = c.substr(0, p - 1) + key + c.substr(p);

            // Move cursor up a spot if next char is a separator char
            if (this.allowed.indexOf(c.charAt(p)) === -1 && this.open.indexOf(c.charAt(p)) === -1)
                p++;
        }
        else if (key === "Backspace") {
            p--;

            // At start of field
            if (p < 0)
                return false;

            // If previous char is a separator, move a little more
            while (this.allowed.indexOf(c.charAt(p)) === -1 && this.open.indexOf(c.charAt(p)) === -1 && p > 1)
                p--;

            val = c.substr(0, p) + this.format.substr(p, 1) + c.substr(p + 1);
        }
        else if (key === "Delete") {
            // At end of field
            if (p >= c.length)
                return false;

            // If next char is a separator and not the end of the text field
            while (this.separator.indexOf(c.charAt(p)) !== -1 && c.charAt(p) !== '')
                p++;

            val = c.substr(0, p) + this.format.substr(p, 1) + c.substr(p + 1);
            p++;
        }
        else if (this._isOther(key))
            return true;
        else
            return false;

        this.value = "";
        this.value = val;
        this._setTextCursor(p);
        
        return false;
    }

    private _keydown(e: KeyboardEvent) {
        if (this.disabled)
            return true;

        // Allow for OS commands
        if (e.metaKey || e.ctrlKey)
            return true;

        if (!this.input.value) {
            this.value = this.format;
            this._setTextCursor(0);
        }

        // Only do update for backspace and delete
        if (e.key === "Backspace" || e.key === "Delete") {
            this._update(e.key);
            
            e.preventDefault();
            return false;
        }

        return true;
    }

    private _keypress(e: KeyboardEvent) {
        if (this.disabled)
            return true;

        if (this._isOther(e.key) || e.metaKey || e.ctrlKey || e.altKey)
            return true;

        if (e.key !== "Backspace" && e.key !== "Delete" && e.key !== "shift") {
            if (!this._isGoodOnes(e.key)) {
                e.preventDefault();
                return false;
            }

            if (this._update(e.key)) {
                if (this._isFilled())
                    this.fire("filled");

                e.preventDefault();
                return true;
            }

            if (this._isFilled())
                this.fire("filled");

            e.preventDefault();
            return false;
        }

        return false;
    }

    private _tap() {
        this._resetCursor();
    }

    private _focus() {
        this._resetCursor();
        this._startText = this.input.value;
    }

    private _blur() {
        if (this.input.value !== this._startText && this.input.onchange)
            this.input.dispatchEvent(new Event("change"));
    }

    private _preventCutPaste(e: Event) {
        e.preventDefault();
        return false;
    }

    private _resetField() {
        this.value = this.format;
    }

    private _computeSize(format: string) {
        // Don't return zero
        return format?.length || undefined;
    }
}