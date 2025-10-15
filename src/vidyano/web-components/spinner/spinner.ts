import { html, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent } from "components/web-component/web-component.js";
import styles from "./spinner.css";

export class Spinner extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: String, reflect: true })
    color: string;

    render() {
        return html`
            <div class="box"></div>
            <div class="box"></div>
            <div class="box"></div>
            <div class="box"></div>
        `;
    }

    updated(changedProperties: Map<PropertyKey, unknown>) {
        super.updated(changedProperties);

        if (changedProperties.has('color') && this.color)
            this.style.setProperty("--vi-spinner-color", this.color);
    }
}

customElements.define("vi-spinner", Spinner);
