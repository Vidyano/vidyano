import * as Polymer from "polymer"
import { WebComponent } from "components/web-component/web-component.js"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute.js"
import "./persistent-object-attribute-flags-enum-flag.js"

@WebComponent.register()
export class PersistentObjectAttributeFlagsEnum extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-flags-enum.html">`; }
}

PersistentObjectAttribute.registerAttributeType("FlagsEnum", PersistentObjectAttributeFlagsEnum);