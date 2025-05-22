import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import { WebComponent } from "components/web-component/web-component"
import { Dialog } from "components/dialog/dialog"
import type { ITranslatedString } from "./persistent-object-attribute-translated-string"

@WebComponent.register({
    properties: {
        label: String,
        strings: Array,
        readonly: Boolean,
        multiline: {
            type: Boolean,
            reflectToAttribute: true,
        }
    },
    keybindings: {
        "ctrl+s": "_keyboardOk"
    }
}, "vi-persistent-object-attribute-translated-string-dialog")
export class PersistentObjectAttributeTranslatedStringDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="persistent-object-attribute-translated-string-dialog.html">`) }

    constructor(public label: string, public strings: ITranslatedString[], public multiline: boolean, public readonly: boolean) {
        super();
    }

    private _keyboardOk(e: KeyboardEvent) {
        if (document.activeElement && document.activeElement instanceof HTMLInputElement)
            document.activeElement.blur();

        e.stopPropagation();
        this._ok();
    }

    private _ok() {
        this.close(this.strings);
    }

    private _onCaptureTab() {
        // Skip default tab navigation behavior
    }
}