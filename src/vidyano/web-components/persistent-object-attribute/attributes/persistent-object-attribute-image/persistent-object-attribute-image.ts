import * as Polymer from "polymer"
import "components/button/button"
import { WebComponent } from "components/web-component/web-component"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"
import { PersistentObjectAttributeImageDialog } from "./persistent-object-attribute-image-dialog"

@WebComponent.register({
    properties: {
        hasValue: {
            type: Boolean,
            computed: "_computeHasValue(value)"
        },
        image: {
            type: String,
            computed: "_computeImage(value)"
        },
        canOpen: {
            type: Boolean,
            computed: "_computeCanOpen(hasValue, sensitive)"
        }
    }
}, "vi-persistent-object-attribute-image")
export class PersistentObjectAttributeImage extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-image.html">`; }

    private _pasteListener: EventListener;

    _attributeChanged() {
        if (this._pasteListener) {
            document.removeEventListener("paste", this._pasteListener, false);
            this._pasteListener = null;
        }

        if (this.attribute && this.attribute.getTypeHint("AllowPaste") === "true") {
            this._pasteListener = this._pasteAuto.bind(this);
            document.addEventListener("paste", this._pasteListener, false);
        }
    }

    disconnectedCallback() {
        if (this._pasteListener) {
            document.removeEventListener("paste", this._pasteListener, false);
            this._pasteListener = null;
        }

        super.disconnectedCallback();
    }

    private _change(e: Event) {
        this.attribute.parent.queueWork(() => {
            return new Promise((resolve, reject) => {
                if (!(e.target instanceof HTMLInputElement))
                    return;

                if (e.target.files && e.target.files.length === 1) {
                    const fr = new FileReader();
                    fr.readAsDataURL(e.target.files[0]);
                    fr.onload = () => {
                        resolve(this.value = (<string>fr.result).match(/,(.*)$/)[1]);
                    };
                    fr.onerror = () => {
                        reject(fr.error);
                    };
                }
            });
        }, true);
    }

    private _clear() {
        this.value = null;
    }

    private _computeHasValue(value: string): boolean {
        return !String.isNullOrEmpty(value);
    }

    private _computeImage(value: string): string {
        return value ? value.asDataUri() : "";
    }

    private _computeCanOpen(hasValue: boolean, sensitive: boolean): boolean {
        return hasValue && !sensitive;
    }

    private _pasteAuto(e: ClipboardEvent) {
        if (this.readOnly || !this.editing)
            return;

        if (e.clipboardData) {
            const items = e.clipboardData.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf("image") !== -1) {
                        const blob = (<any>items[i]).getAsFile();
                        const URLObj = window["URL"] || window["webkitURL"];
                        const source = URLObj.createObjectURL(blob);
                        this._pasteCreateImage(source);

                        e.preventDefault();
                    }
                }
            }
        }
    }

    private _pasteCreateImage(source) {
        const pastedImage = new Image();
        pastedImage.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = pastedImage.width;
            canvas.height = pastedImage.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(pastedImage, 0, 0);

            this.value = canvas.toDataURL().match(/,(.*)$/)[1];
        };
        pastedImage.src = source;
    }

    private _showDialog() {
        if (!this.value || this.sensitive)
            return;

        this.app.showDialog(new PersistentObjectAttributeImageDialog(this.attribute.label, this.value.asDataUri()));
    }
}

PersistentObjectAttribute.registerAttributeType("Image", PersistentObjectAttributeImage);