import * as Polymer from "../../../libs/polymer/polymer"
import { Dialog } from "../../../web-components/dialog/dialog.js"
import { WebComponent } from "../../../web-components/web-component/web-component.js"

@WebComponent.register({
})
export class MyDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="my-dialog.html">`); }

    private _close() {
        this.close("Result");
    }
}