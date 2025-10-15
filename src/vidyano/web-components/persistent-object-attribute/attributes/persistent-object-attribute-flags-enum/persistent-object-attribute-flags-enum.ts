import * as Polymer from "polymer"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"
import "./persistent-object-attribute-flags-enum-flag"

@Polymer.WebComponent.register("vi-persistent-object-attribute-flags-enum")
export class PersistentObjectAttributeFlagsEnum extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-flags-enum.html">`; }
}

PersistentObjectAttribute.registerAttributeType("FlagsEnum", PersistentObjectAttributeFlagsEnum);
