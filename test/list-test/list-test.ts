import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../../web-components/web-component/web-component.js"
import "../../web-components/list/list.js"

@WebComponent.register({
    properties: {
        items: {
            type: Array,
            value: () => {
                return Array.range(1, 10000)
            }
        }
    }
})
export class ListTest extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="list-test.html">`; }
}