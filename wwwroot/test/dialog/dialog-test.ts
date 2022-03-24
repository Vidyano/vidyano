import * as Polymer from "../../libs/polymer/polymer.js"
import { PersistentObjectWizardDialog } from "../../web-components/persistent-object-wizard-dialog/persistent-object-wizard-dialog.js";
import { WebComponent } from "../../web-components/web-component/web-component.js"
import { MyDialog } from "./my-dialog/my-dialog.js"

@WebComponent.register({
})
export class DialogTest extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="dialog-test.html">`; }

    private async _openDialog() {
        await this.app.showDialog(new MyDialog());
    }

    private async _openWizard() {
        const wizard = await this.service.getPersistentObject(null, "Wizard", null, true);
        
        await this.app.showDialog(new PersistentObjectWizardDialog(wizard));
    }
}