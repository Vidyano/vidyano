import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { Icon } from "components/icon/icon"
import * as IconRegister from "components/icon/icon-register"
import { WebComponent } from "components/web-component/web-component"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"

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