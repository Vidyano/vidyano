import * as Polymer from "../../../../libs/polymer/polymer.js"
import * as Vidyano from "../../../../libs/vidyano/vidyano.js"
import { WebComponent } from "../../../web-component/web-component.js"
import  { PersistentObjectAttribute } from "../../persistent-object-attribute.js"
import "../../../marked/marked.js"

@WebComponent.register()
export class PersistentObjectAttributeCommonMark extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-common-mark.html">`; }

    private _editTextAreaBlur() {
        if (this.attribute && this.attribute.isValueChanged && this.attribute.triggersRefresh)
            this.attribute.setValue(this.value = this.attribute.value, true).catch(Vidyano.noop);
    }
}

PersistentObjectAttribute.registerAttributeType("CommonMark", PersistentObjectAttributeCommonMark);