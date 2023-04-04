import * as Polymer from "../../../../libs/polymer/polymer.js"
import * as Vidyano from "../../../../libs/vidyano/vidyano.js"
import { Icon } from "../../../icon/icon.js"
import * as IconRegister from "../../../icon/icon-register.js"
import { WebComponent } from "../../../web-component/web-component.js"
import { PersistentObjectAttribute } from "../../persistent-object-attribute.js"

@WebComponent.register({
    properties: {
        icons: {
            type: Array,
            readOnly: true
        }
    }
})
export class PersistentObjectAttributeIcon extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-icon.html">`; }

    readonly icons: string[]; private _setIcons: (icons: string[]) => void;

    private _onOpening() {
        const icons = IconRegister.all();
        this._setIcons(!this.attribute.isRequired ? [null, ...icons] : icons);
    }

    private _selectIcon(e: Polymer.Gestures.TapEvent) {
        this.attribute.setValue(e.model.icon);
    }
}

PersistentObjectAttribute.registerAttributeType("Icon", PersistentObjectAttributeIcon);