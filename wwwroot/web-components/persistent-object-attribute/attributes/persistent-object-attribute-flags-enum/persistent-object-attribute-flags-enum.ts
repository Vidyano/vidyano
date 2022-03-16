import * as Polymer from "../../../../libs/polymer/polymer.js"
import { WebComponent } from "../../../web-component/web-component.js"
import { PersistentObjectAttribute } from "../../persistent-object-attribute.js"
import "./persistent-object-attribute-flags-enum-flag.js"

@WebComponent.register()
export class PersistentObjectAttributeFlagsEnum extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-flags-enum.html">`; }
}

PersistentObjectAttribute.registerAttributeType("FlagsEnum", PersistentObjectAttributeFlagsEnum);