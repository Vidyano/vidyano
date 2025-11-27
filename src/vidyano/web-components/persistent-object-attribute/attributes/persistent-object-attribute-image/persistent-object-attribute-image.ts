import { html, nothing, unsafeCSS } from "lit";
import * as Vidyano from "vidyano";
import "components/button/button";
import "components/icon/icon";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import { PersistentObjectAttributeImageDialog } from "./persistent-object-attribute-image-dialog";
import styles from "./persistent-object-attribute-image.css";

export class PersistentObjectAttributeImage extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    #pasteListener: EventListener;

    @computed(function(this: PersistentObjectAttributeImage): boolean {
        return !String.isNullOrEmpty(this.value);
    }, "value")
    declare readonly hasValue: boolean;

    @computed(function(this: PersistentObjectAttributeImage): string {
        return this.value ? this.value.asDataUri() : "";
    }, "value")
    declare readonly image: string;

    @computed(function(this: PersistentObjectAttributeImage): boolean {
        return this.hasValue && !this.sensitive;
    }, "hasValue", "sensitive")
    declare readonly canOpen: boolean;

    protected override _attributeChanged() {
        super._attributeChanged();

        if (this.#pasteListener) {
            document.removeEventListener("paste", this.#pasteListener, false);
            this.#pasteListener = null;
        }

        if (this.attribute instanceof Vidyano.PersistentObjectAttribute && this.attribute.getTypeHint("AllowPaste") === "true") {
            this.#pasteListener = this._pasteAuto.bind(this);
            document.addEventListener("paste", this.#pasteListener, false);
        }
    }

    override disconnectedCallback() {
        if (this.#pasteListener) {
            document.removeEventListener("paste", this.#pasteListener, false);
            this.#pasteListener = null;
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

    private _pasteAuto(e: ClipboardEvent) {
        if (this.readOnly || !this.editing)
            return;

        if (e.clipboardData) {
            const items = e.clipboardData.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf("image") !== -1) {
                        const blob = items[i].getAsFile();
                        const URLObj = window["URL"] || window["webkitURL"];
                        const source = URLObj.createObjectURL(blob);
                        this.#pasteCreateImage(source);

                        e.preventDefault();
                    }
                }
            }
        }
    }

    #pasteCreateImage(source: string) {
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

    protected override renderDisplay() {
        return super.renderDisplay(html`
            <img src=${this.image || nothing} @click=${this._showDialog} ?can-open=${this.canOpen} />
        `);
    }

    protected override renderEdit() {
        return super.renderEdit(html`
            <div class="image-container">
                <vi-sensitive ?disabled=${!this.sensitive}>
                    <img src=${this.image || nothing} @click=${this._showDialog} ?can-open=${this.canOpen} />
                </vi-sensitive>
            </div>
            ${!this.readOnly ? html`
                <vi-button slot="right" class="browse bottom-border" ?disabled=${this.frozen}>
                    <vi-icon source="ImageUpload"></vi-icon>
                    <input type="file" accept="image/*" capture="environment" @change=${this._change}>
                </vi-button>
                ${this.hasValue ? html`
                    <vi-button slot="right" class="bottom-border" @click=${this._clear} tabindex="-1" ?disabled=${this.frozen}>
                        <vi-icon source="Remove"></vi-icon>
                    </vi-button>
                ` : nothing}
            ` : nothing}
        `);
    }
}

customElements.define("vi-persistent-object-attribute-image", PersistentObjectAttributeImage);

PersistentObjectAttributeRegister.add("Image", PersistentObjectAttributeImage);
