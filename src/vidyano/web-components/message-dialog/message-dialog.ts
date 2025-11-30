import { CSSResultGroup, html, nothing, TemplateResult, unsafeCSS } from "lit";
import { state } from "lit/decorators.js";
import { keybinding } from "components/web-component/web-component";
import { Dialog } from "components/dialog/dialog";
import "components/marked/marked";
import styles from "./message-dialog.css";

export interface IMessageDialogOptions {
    noClose?: boolean;
    title?: string;
    titleIcon?: string;
    actions?: string[];
    actionTypes?: string[];
    defaultAction?: number;
    cancelAction?: number;
    message: string;
    extraClasses?: string[];
    rich?: boolean;
}

export class MessageDialog extends Dialog {
    static styles: CSSResultGroup = [Dialog.styles, unsafeCSS(styles)];

    @state()
    options: IMessageDialogOptions;

    @state()
    activeAction: number = 0;

    constructor(options: IMessageDialogOptions) {
        super();

        this.options = options;

        if (options.defaultAction)
            this.activeAction = options.defaultAction;
    }

    connectedCallback() {
        super.connectedCallback();

        this.noCancelOnEscKey = this.noCancelOnOutsideClick = !!this.options.noClose;
    }

    protected renderContent(): TemplateResult {
        return html`
            <header>
                ${this._hasHeaderIcon ? html`<vi-icon source=${this.options.titleIcon}></vi-icon>` : nothing}
                <h4>${this.options.title}</h4>
                ${!this.options.noClose ? this.renderCloseButton() : nothing}
            </header>
            <main ?rich=${this.options.rich}>
                ${this.options.rich
                    ? html`<vi-marked markdown=${this.options.message}></vi-marked>`
                    : html`<pre>${this.options.message}</pre>`
                }
            </main>
            <footer id="actions">
                ${this.options.actions?.map((action, index) => html`
                    <vi-button
                        @click=${(e: Event) => this._onSelectAction(e, index)}
                        type=${this._actionType(index) ?? nothing}
                        ?inverse=${this.activeAction !== index}
                        label=${action}
                    ></vi-button>
                `)}
            </footer>
        `;
    }

    private get _hasHeaderIcon(): boolean {
        return this.options && typeof this.options.titleIcon === "string";
    }

    cancel() {
        if (this.options.cancelAction == null)
            super.cancel();
        else
            super.close(this.options.cancelAction);
    }

    async open(): Promise<any> {
        const result = super.open();
        await this.updateComplete;

        const button = this.$.actions.querySelectorAll("vi-button")[this.activeAction] as HTMLElement;
        this._focusElement(button);

        return result;
    }

    private _actionType(index: number): string {
        if (!this.options || !this.options.actionTypes)
            return undefined;

        return this.options.actionTypes[index];
    }

    private _onSelectAction(e: Event, index: number) {
        this.close(index);
        e.stopPropagation();
    }

    @keybinding("tab")
    @keybinding("arrowright")
    private _keyboardNextAction() {
        this.activeAction = (this.activeAction + 1) % this.options.actions.length;
        this._focusActiveAction();
    }

    @keybinding("arrowleft")
    private _keyboardPreviousAction() {
        this.activeAction = (this.activeAction - 1 + this.options.actions.length) % this.options.actions.length;
        this._focusActiveAction();
    }

    private _focusActiveAction() {
        const button = <HTMLButtonElement>this.$.actions.querySelector(`vi-button:nth-child(${this.activeAction + 1})`);
        if (button)
            this._focusElement(button);
    }
}

customElements.define("vi-message-dialog", MessageDialog);
