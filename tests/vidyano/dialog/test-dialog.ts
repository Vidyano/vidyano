import { html, TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { Dialog } from "../../../src/vidyano/web-components/dialog/dialog.js";

export class TestDialog extends Dialog {
    @property({ type: String })
    title: string = "Test Dialog";

    @property({ type: String })
    content: string = "Test content";

    @property({ type: Boolean })
    showCloseButton: boolean = false;

    protected renderContent(): TemplateResult {
        return html`
            <header>
                <h4>${this.title}</h4>
                ${this.showCloseButton ? this.renderCloseButton() : null}
            </header>
            <main>${this.content}</main>
            <footer>
                <button id="close-btn" @click=${() => this.close("closed")}>Close</button>
                <button id="cancel-btn" @click=${() => this.cancel()}>Cancel</button>
            </footer>
        `;
    }
}

customElements.define("vi-test-dialog", TestDialog);
