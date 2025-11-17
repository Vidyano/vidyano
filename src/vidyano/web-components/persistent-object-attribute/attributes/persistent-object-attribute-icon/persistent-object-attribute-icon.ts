import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { Icon } from "components/icon/icon"
import * as IconRegister from "components/icon/icon-register"
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register"

@Polymer.WebComponent.register({
    properties: {
        icons: {
            type: Array,
            readOnly: true
        }
    }
}, "vi-persistent-object-attribute-icon")
export class PersistentObjectAttributeIcon extends Polymer.PersistentObjectAttribute {
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

PersistentObjectAttributeRegister.add("Icon", PersistentObjectAttributeIcon);
