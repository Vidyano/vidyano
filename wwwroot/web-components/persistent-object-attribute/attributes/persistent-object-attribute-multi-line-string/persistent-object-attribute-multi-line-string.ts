import * as Polymer from '../../../../libs/@polymer/polymer.js';
import * as Vidyano from "../../../../libs/vidyano/vidyano.js"
import { WebComponent } from "../../../web-component/web-component.js"
import { PersistentObjectAttribute } from "../../persistent-object-attribute.js"
import "codemirror/lib/codemirror.js"

@WebComponent.register({
    properties: {
        maxlength: Number,
        useCodeMirror: {
            type: Boolean,
            computed: "_computeUseCodeMirror(codeMirror, sensitive)"
        },
        codeMirror: {
            type: String,
            computed: "_computeCodeMirror(attribute)",
            value: ""
        },
        isCodeMirrorReadOnly: {
            type: Boolean,
            computed: "_computeIsCodeMirrorReadOnly(readOnly, editing)"
        }
    }
})
export class PersistentObjectAttributeMultiLineString extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-multi-line-string.html">`; }

    maxlength: number;

    protected _attributeChanged() {
        super._attributeChanged();

        if (this.attribute) {
            const maxlength = parseInt(this.attribute.getTypeHint("MaxLength", "0"), 10);
            this.maxlength = maxlength > 0 ? maxlength : null;
        }
    }

    private _editTextAreaBlur() {
        if (this.attribute && this.attribute.isValueChanged && this.attribute.triggersRefresh)
            this.attribute.setValue(this.value = this.attribute.value, true).catch(Vidyano.noop);
    }

    private _computeCodeMirror(attribute: Vidyano.PersistentObjectAttribute): string {
        return attribute ? attribute.getTypeHint("language", null) : null;
    }

    private _computeIsCodeMirrorReadOnly(readOnly: boolean, editing: boolean): boolean {
        return readOnly || !editing;
    }

    private _computeUseCodeMirror(codeMirror: boolean, sensitive: boolean): boolean {
        return codeMirror && !sensitive;
    }
}

PersistentObjectAttribute.registerAttributeType("MultiLineString", PersistentObjectAttributeMultiLineString);