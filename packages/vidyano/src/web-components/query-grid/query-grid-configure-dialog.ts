import { CSSResultGroup, html, TemplateResult, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "@vidyano/core";
import { listener } from "components/web-component/web-component";
import { Dialog } from "components/dialog/dialog";
import { QueryGridConfigureDialogColumn } from "./query-grid-configure-dialog-column";
import { QueryGridUserSettings } from "./query-grid-user-settings";
import { Sortable } from "components/sortable/sortable";
import styles from "./query-grid-configure-dialog.css";

export class QueryGridConfigureDialog extends Dialog {
    static styles: CSSResultGroup = [Dialog.styles, unsafeCSS(styles)];

    private _elements: QueryGridConfigureDialogColumn[];
    private _resetWidths: boolean;

    @property({ attribute: false })
    query: Vidyano.Query;

    constructor(query: Vidyano.Query, private _settings: QueryGridUserSettings) {
        super();

        this.query = query;
    }

    connectedCallback() {
        this._elements = this._settings.columns.filter(c => c.width !== "0").map(c => new QueryGridConfigureDialogColumn(c));
        this._distributeColumns();
        this._updateLastVisible();

        super.connectedCallback();
    }

    protected renderContent(): TemplateResult {
        return html`
            <header>${this.query?.label}</header>
            <main>
                <vi-sortable id="pinned" group="pinned" @drag-end=${this._reorderColumns}></vi-sortable>
                <vi-scroller no-horizontal>
                    <vi-sortable id="unpinned" group="unpinned" @drag-end=${this._reorderColumns}></vi-sortable>
                </vi-scroller>
            </main>
            <footer>
                <vi-button inverse class="reset" @click=${this._reset} action-type="Default" label=${this.translations.Reset}></vi-button>
                <div class="buttons">
                    <vi-button @click=${this._save} action-type="Default" label=${this.translations.Save}></vi-button>
                    <vi-button inverse @click=${this.cancel} label=${this.translations.Cancel}></vi-button>
                </div>
            </footer>
        `;
    }

    @listener("distribute-columns")
    private _distributeColumns(e?: CustomEvent) {
        const columns = this._elements.orderBy(c => c.column.offset);

        requestAnimationFrame(async () => {
            await this.updateComplete;

            // Moving a row drops the focus of the button inside it
            const focused = this._focusedElement();

            this._updateColumns(this.$.pinned, columns.filter(c => c.isPinned));
            this._updateColumns(this.$.unpinned, columns.filter(c => !c.isPinned));

            if (focused && this._focusedElement() !== focused)
                focused.focus();
        });

        e?.stopPropagation();
    }

    private _focusedElement(): HTMLElement {
        let element = this.shadowRoot.activeElement;
        while (element?.shadowRoot?.activeElement)
            element = element.shadowRoot.activeElement;

        return element as HTMLElement;
    }

    @listener("column-visibility-toggled")
    private _updateLastVisible(e?: CustomEvent) {
        // The only visible column cannot be hidden
        const visible = this._elements.filter(c => !c.isHidden);
        this._elements.forEach(c => c.lastVisible = visible.length === 1 && visible[0] === c);

        e?.stopPropagation();
    }

    private _updateColumns(target: HTMLElement, columns: QueryGridConfigureDialogColumn[]) {
        columns.orderBy(c => c.offset).forEach((col, index) => {
            if (target.children[index] !== col)
                target.insertBefore(col, target.children[index] ?? null);
        });
    }

    private _reorderColumns(e: CustomEvent) {
        const details = e.detail;
        if (details.newIndex === details.oldIndex)
            return;

        const list = e.composedPath()[0] as Sortable;
        const children = <QueryGridConfigureDialogColumn[]>Array.from(list.children);
        const offsets = children.orderBy(c => c.column.offset).map(c => c.column.offset);

        children.forEach((child: QueryGridConfigureDialogColumn, index: number) => {
            child.offset = offsets[index];
        });

        e.stopPropagation();
    }

    private _save() {
        this._elements.forEach(c => {
            c.column.isPinned = c.isPinned;
            c.column.isHidden = c.isHidden;
            c.column.offset = c.offset;

            if (this._resetWidths)
                c.column.width = undefined;
        });

        this.close(true);
    }

    private _reset() {
        this._elements.forEach(c => {
            c.isPinned = c.column.column.isPinned;
            c.isHidden = c.column.column.isHidden;
            c.offset = c.column.column.offset;
        });

        this._resetWidths = true;

        this._distributeColumns();
        this._updateLastVisible();
    }
}

customElements.define("vi-query-grid-configure-dialog", QueryGridConfigureDialog);
