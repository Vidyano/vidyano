import * as Polymer from "polymer"
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register"
import "./persistent-object-attribute-flags-enum-flag"

@Polymer.WebComponent.register("vi-persistent-object-attribute-flags-enum")
export class PersistentObjectAttributeFlagsEnum extends Polymer.PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-flags-enum.html">`; }
}

PersistentObjectAttributeRegister.add("FlagsEnum", PersistentObjectAttributeFlagsEnum);
