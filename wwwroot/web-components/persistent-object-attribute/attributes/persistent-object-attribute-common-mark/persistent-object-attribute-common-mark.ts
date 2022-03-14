import * as Polymer from "../../../../libs/polymer/polymer";
import * as Vidyano from "../../../../libs/vidyano/vidyano"
import { WebComponent } from "../../../web-component/web-component"
import  { PersistentObjectAttribute } from "../../persistent-object-attribute"
import "@polymer/marked-element/marked-element"

@WebComponent.register()
export class PersistentObjectAttributeCommonMark extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-common-mark.html">`; }

    private _editTextAreaBlur() {
        if (this.attribute && this.attribute.isValueChanged && this.attribute.triggersRefresh)
            this.attribute.setValue(this.value = this.attribute.value, true).catch(Vidyano.noop);
    }
}

PersistentObjectAttribute.registerAttributeType("CommonMark", PersistentObjectAttributeCommonMark);