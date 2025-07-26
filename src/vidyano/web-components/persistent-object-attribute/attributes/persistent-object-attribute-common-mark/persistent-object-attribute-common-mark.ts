import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { WebComponent } from "components/web-component/web-component"
import  { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"
import "components/marked/marked"

@WebComponent.register("vi-persistent-object-attribute-common-mark")
export class PersistentObjectAttributeCommonMark extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-common-mark.html">`; }

    private _editTextAreaBlur() {
        if (this.attribute && this.attribute.isValueChanged && this.attribute.triggersRefresh)
            this.attribute.setValue(this.value = this.attribute.value, true).catch(Vidyano.noop);
    }
}

PersistentObjectAttribute.registerAttributeType("CommonMark", PersistentObjectAttributeCommonMark);