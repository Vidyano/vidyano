import * as Polymer from "../../libs/@polymer/polymer.js"
import "../../web-components/button/button.js"
import { WebComponent } from "../../web-components/web-component/web-component.js"
import { MyDialog } from "./my-dialog/my-dialog.js"

@WebComponent.register({
})
export class DialogTest extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="dialog-test.html">`; }

    private async _openDialog() {
        const result = await this.app.showDialog(new MyDialog());
        console.log(result);
    }

    private async _openWizard() {
        const wizard = await this.service.getPersistentObject(null, "Wizard", null, true);
        
        const module = await import("../../web-components/persistent-object-wizard-dialog/persistent-object-wizard-dialog.js");
        await this.app.showDialog(new module.PersistentObjectWizardDialog(wizard));
    }
}