import { html, unsafeCSS, nothing } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { WebComponentLit, observer } from "components/web-component/web-component-lit.js";
import styles from "./persistent-object-attribute-as-detail-cell.css";

export class PersistentObjectAttributeAsDetailCell extends WebComponentLit {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    attribute: Vidyano.PersistentObjectAttribute;

    @observer("attribute.typeHints")
    _updateForeground() {
        if (!this.attribute)
            return;

        const foreground = this.attribute.getTypeHint("foreground", null);
        
        if (!!foreground)
            this.style.setProperty("--vi-persistent-object-attribute-foreground", foreground);
        else
            this.style.removeProperty("--vi-persistent-object-attribute-foreground");
    }

    render() {
        if (!this.attribute)
            return nothing;
        
        return html`${this.attribute.displayValue || ""}`;
    }
}

customElements.define("vi-persistent-object-attribute-as-detail-cell", PersistentObjectAttributeAsDetailCell);