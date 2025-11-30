import { CSSResultGroup, html, TemplateResult, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import { keybinding, WebComponent } from "components/web-component/web-component";
import { PopupMenu } from "components/popup-menu/popup-menu";
import styles from "./dialog.css";

interface IPosition {
    x: number;
    y: number;
}

export abstract class Dialog extends WebComponent {
    static styles: CSSResultGroup = unsafeCSS(styles);

    #result: any;
    #resolve: Function;
    #translatePosition: IPosition;
    #abortController: AbortController;

    @property({ type: String })
    anchorTag: string = "header";

    @state()
    isDragging: boolean = false;

    @property({ type: Boolean })
    noCancelOnOutsideClick: boolean = true;

    @property({ type: Boolean })
    noCancelOnEscKey: boolean;

    private get dialog(): HTMLDialogElement {
        return this.shadowRoot.querySelector("dialog") as HTMLDialogElement;
    }

    protected render() {
        return html`<dialog
            ?is-dragging=${this.isDragging}
            @close=${this._onClose}
            @cancel=${this._onCancel}
            @click=${this._onClick}
            @contextmenu=${this._configureContextMenu}
        >${this.renderContent()}</dialog>`;
    }

    protected abstract renderContent(): TemplateResult;

    protected renderCloseButton() {
        return html`<vi-button class="close" @click=${() => this.cancel()} icon="Remove"></vi-button>`;
    }

    async open(): Promise<any> {
        await this.updateComplete;

        this.dialog.showModal();

        const promise = new Promise<any>(resolve => {
            this.#resolve = resolve;
        });

        const anchor = !!this.anchorTag ? <HTMLElement>this.shadowRoot.querySelector(this.anchorTag) : null;
        if (anchor) {
            this.#abortController = new AbortController();

            anchor.addEventListener("pointerdown", this._onPointerDown.bind(this), { signal: this.#abortController.signal });

            promise.finally(() => {
                this.#abortController?.abort();
                this.#abortController = null;
            });
        }

        return promise;
    }

    private _onPointerDown(e: PointerEvent) {
        const path = e.composedPath();

        // Don't start dragging when clicking interactive elements (like close button)
        const hasInteractiveElement = path.some(el =>
            el instanceof HTMLInputElement ||
            el instanceof HTMLButtonElement ||
            (el instanceof HTMLElement && el.matches("vi-button, a, [role='button']"))
        );
        if (hasInteractiveElement)
            return;

        const target = e.currentTarget as HTMLElement;
        if (!target.tagName.startsWith("H")) {
            e.stopPropagation();
            e.preventDefault();
            return;
        }

        this.isDragging = true;
        if (!this.#translatePosition)
            this._translate({ x: 0, y: 0 });

        // Capture initial positions for sticky dragging
        const initialMouseX = e.clientX;
        const initialMouseY = e.clientY;
        const initialTranslateX = this.#translatePosition.x;
        const initialTranslateY = this.#translatePosition.y;

        target.setPointerCapture(e.pointerId);

        const onPointerMove = (moveEvent: PointerEvent) => {
            if (!this.isDragging)
                return;

            const rect = this.dialog.getBoundingClientRect();

            // Calculate position based on delta from initial mouse position
            let x = initialTranslateX + (moveEvent.clientX - initialMouseX);
            let y = initialTranslateY + (moveEvent.clientY - initialMouseY);

            // Prevent dialog from going outside the screen
            if (x < 0)
                x = Math.max(x, (window.innerWidth - rect.width) * -1);
            else if (x > 0)
                x = Math.min(x, window.innerWidth - rect.width);

            if (y < 0)
                y = Math.max(y, (window.innerHeight - rect.height) * -1);
            else if (y > 0)
                y = Math.min(y, window.innerHeight - rect.height);

            this._translate({ x, y });
        };

        const onPointerUp = (upEvent: PointerEvent) => {
            this.isDragging = false;
            target.releasePointerCapture(upEvent.pointerId);
            target.removeEventListener("pointermove", onPointerMove);
            target.removeEventListener("pointerup", onPointerUp);
        };

        target.addEventListener("pointermove", onPointerMove);
        target.addEventListener("pointerup", onPointerUp);
    }

    private _translate(position: IPosition) {
        const { x, y } = this.#translatePosition = position;

        this.dialog.style.transform = `translate(${x}px, ${y}px)`;
    }

    @keybinding("escape")
    private _esc(_e: KeyboardEvent) {
        if (!this.noCancelOnEscKey)
            this.cancel();
    }

    close(result?: any) {
        this.#result = result;
        this.dialog.close();
    }

    cancel() {
        this.close();
    }

    protected _focusElement(element: string | HTMLElement) {
        const target = typeof element === "string" ? <HTMLElement>this.shadowRoot.querySelector(`#${element}`) : element;
        target?.focus();
    }

    private _onClose() {
        this.#resolve(this.#result);
    }

    private _onCancel(e: Event) {
        if (this.noCancelOnEscKey)
            e.preventDefault();

        this.#result = undefined;
    }

    private _onClick(e: MouseEvent) {
        if (this.noCancelOnOutsideClick)
            return;

        const rect = this.dialog.getBoundingClientRect();
        const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
            rect.left <= e.clientX && e.clientX <= rect.left + rect.width);

        if (!isInDialog)
            this.dialog.close();
    }

    private async _configureContextMenu(e: MouseEvent) {
        if (!this.service || !this.service.application)
            return;

        const configureItems: WebComponent[] = e["vi:configure"];
        if (!this.service.application.hasManagement || !configureItems?.length || window.getSelection().toString()) {
            e.stopImmediatePropagation();
            return;
        }

        e.stopPropagation();
        e.preventDefault();

        const popupMenu = new PopupMenu();
        popupMenu.contextMenuOnly = true;

        Array.from(popupMenu.children).forEach(item => popupMenu.removeChild(item));
        configureItems.forEach(item => popupMenu.appendChild(item));

        this.dialog.appendChild(popupMenu);

        try {
            popupMenu.$.popup.style.left = e.pageX + "px";
            popupMenu.$.popup.style.top = e.pageY + "px";

            await popupMenu.popup();
        }
        finally {
            this.dialog.removeChild(popupMenu);
        }
    }
}
