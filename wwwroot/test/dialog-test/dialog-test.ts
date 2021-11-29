import * as Polymer from "../../libs/@polymer/polymer.js"
import "../../web-components/button/button.js"
import { WebComponent } from "../../web-components/web-component/web-component.js"
import { MyDialog } from "./my-dialog/my-dialog.js"

@WebComponent.register({
})
export class DialogTest extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="dialog-test.html">`; }

    private async _open() {
        const result = await this.app.showDialog(new MyDialog());
        console.log(result);
    }
}