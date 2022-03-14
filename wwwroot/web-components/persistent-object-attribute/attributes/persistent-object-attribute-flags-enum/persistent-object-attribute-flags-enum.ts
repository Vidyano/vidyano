import * as Polymer from "../../../../libs/polymer/polymer";
import { WebComponent } from "../../../web-component/web-component"
import { PersistentObjectAttribute } from "../../persistent-object-attribute"
import "./persistent-object-attribute-flags-enum-flag"

@WebComponent.register()
export class PersistentObjectAttributeFlagsEnum extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-flags-enum.html">`; }
}

PersistentObjectAttribute.registerAttributeType("FlagsEnum", PersistentObjectAttributeFlagsEnum);