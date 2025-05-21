import * as Polymer from "polymer"
import { WebComponent } from "components/web-component/web-component"
import { Dialog } from "components/dialog/dialog"
import { ISize } from "components/size-tracker/size-tracker"

@WebComponent.register({
    properties: {
        label: String,
        sources: Array,
        source: String,
        hasMultiple: {
            type: Boolean,
            computed: "_computeHasMultiple(sources)"
        },
        headerSize: Object,
        footerSize: Object
    },
    keybindings: {
        "left": "_previous",
        "right": "_next"
    },
    observers: [
        "_showImage(headerSize, footerSize)"
    ]
})
export class PersistentObjectAttributeImageDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="persistent-object-attribute-image-dialog.html">`) }

    private _updated: boolean;
        readonly sources: string[];
        source: string;

        constructor(public label: string, ...sources: string[]) {
            super();

            this.sources = sources;
            this.source = this.sources[0];
        }

        private _showImage(headerSize: ISize, footerSize: ISize) {
            this.updateStyles({
                "--vi-persistent-object-attribute-image-dialog--max-height": `${headerSize.height + footerSize.height}px`
            });

            if (!this._updated) {
                this.$.img.removeAttribute("hidden");
                this.$.spinner.setAttribute("hidden", "");

                this._updated = true;
            }
        }

        private _computeHasMultiple(sources: string[]): boolean {
            return sources && sources.length > 1;
        }

        private _next() {
            this.source = this.sources[(this.sources.indexOf(this.source) + 1) % this.sources.length];
        }

        private _previous() {
            this.source = this.sources[(this.sources.indexOf(this.source) - 1 + this.sources.length) % this.sources.length];
        }

        private _close() {
            this.cancel();
        }
}