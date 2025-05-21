import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { Dialog } from "components/dialog/dialog"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        retry: Object,
        tab: {
            type: Object,
            computed: "_computeTab(retry.persistentObject, isConnected)"
        }
    },
    mediaQueryAttributes: true
})
export class RetryActionDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="retry-action-dialog.html">`); }

    constructor(public retry: Vidyano.Dto.RetryAction) {
        super();

        if (typeof retry.message === "undefined")
            retry.message = null;
    }

    connectedCallback() {
        super.connectedCallback();

        this.noCancelOnEscKey = this.retry.cancelOption == null;
    }

    cancel() {
        this.close(this.retry.cancelOption);
    }

    private _computeTab(persistentObject: Vidyano.PersistentObject, isConnected: boolean): Vidyano.PersistentObjectAttributeTab {
        if (!persistentObject || !isConnected)
            return null;

        const tab = <Vidyano.PersistentObjectAttributeTab>persistentObject.tabs.find(tab => tab instanceof Vidyano.PersistentObjectAttributeTab);
        tab.columnCount = tab.columnCount > 1 ? tab.columnCount : 1;

        const width = parseInt(getComputedStyle(this).getPropertyValue("--vi-persistent-object-dialog-base-width-base")) * tab.columnCount;
        this.updateStyles({
            "--vi-persistent-object-dialog-computed-width": `${width}px`
        });

        return tab;
    }

    private _onSelectOption(e: Polymer.Gestures.TapEvent) {
        this.close(e.model.option);

        e.stopPropagation();
    }

    private _isFirst(index: number): boolean {
        return index === 0;
    }
}