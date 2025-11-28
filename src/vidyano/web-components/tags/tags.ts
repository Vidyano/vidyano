import { html, nothing, unsafeCSS } from "lit";
import { property, query, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { notify, WebComponent } from "components/web-component/web-component";
import * as Keyboard from "components/utils/keyboard";
import type { Scroller } from "components/scroller/scroller";
import type { ISortableDragEndDetails } from "components/sortable/sortable";
import styles from "./tags.css";

interface TagItem {
    id: string;
    value: string;
}

let _nextTagId = 0;

export class Tags extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: String })
    input: string;

    @property({ type: Array })
    @notify()
    tags: string[] = [];

    @property({ type: Boolean, reflect: true })
    disabled: boolean = false;

    @property({ type: Boolean, reflect: true })
    sensitive: boolean = true;

    @state()
    private _tagItems: TagItem[] = [];

    @state()
    private _dragInProgress: boolean = false;

    @query("#tagsInput")
    private tagsInput!: HTMLInputElement;

    @query("#scroller")
    private scroller!: Scroller;

    focus() {
        this.tagsInput?.focus();
    }

    private _passFocus(e: MouseEvent) {
        if (this.disabled)
            return;

        if (!this.tagsInput)
            return;

        this.tagsInput.focus();
        this.scroller?.scrollToBottom();
    }

    private _checkKeyPress(e: KeyboardEvent) {
        if (!this.input)
            return;

        if (e.key === Keyboard.Keys.Enter)
            this._addTag(this.input);
        else {
            const newWidth = (this.input.length * 8) + 30;
            this.style.setProperty("--tags-input--width", `${newWidth}px`);
        }
    }

    private _onInputBlur() {
        if (!this.input || this.disabled) {
            this.input = "";
            return;
        }

        this._addTag(this.input);
    }

    private _addTag(input: string) {
        if (!((/^\s*$/.test(input)))) {
            this.tags = [...this.tags, input];
            this._updateTagItems();
            this.style.setProperty("--tags-input--width", "30px");
        }

        this.input = "";
    }

    private _onDeleteTap(tag: string) {
        const index = this.tags.indexOf(tag);
        if (index >= 0) {
            this.tags = [...this.tags.slice(0, index), ...this.tags.slice(index + 1)];
            this._updateTagItems();
        }
    }

    private _handleInput(e: Event) {
        this.input = (e.target as HTMLInputElement).value;
    }

    private _updateTagItems() {
        if (this._dragInProgress)
            return;

        const newTags = this.tags || [];
        const currentTags = this._tagItems.map(item => item.value);

        // Check if values actually changed (order or content)
        const tagsMatch = newTags.length === currentTags.length &&
            newTags.every((v, i) => v === currentTags[i]);

        if (tagsMatch)
            return;

        // Tags changed - recreate items array
        this._tagItems = newTags.map(tag => ({
            id: `tag-${_nextTagId++}`,
            value: tag
        }));
    }

    private _onDragStart() {
        this._dragInProgress = true;
    }

    private _onDragEnd(e: CustomEvent<ISortableDragEndDetails>) {
        const details = e.detail;
        this._dragInProgress = false;

        if (this.disabled || details.newIndex === details.oldIndex || details.newIndex < 0)
            return;

        // Reorder the _tagItems array using the indices from the event
        const newOrder = [...this._tagItems];
        const [movedItem] = newOrder.splice(details.oldIndex, 1);
        newOrder.splice(details.newIndex, 0, movedItem);

        this._tagItems = newOrder;

        // Update the tags array to reflect the new order
        this.tags = this._tagItems.map(item => item.value);
    }

    render() {
        // Ensure tag items are in sync with tags array
        if (!this._dragInProgress)
            this._updateTagItems();

        return html`
            <vi-scroller id="scroller" no-horizontal @click=${this._passFocus}>
                <div class="wrap-container">
                    <vi-sortable id="sortable-tags" draggable-items=".tag" .enabled=${!this.disabled} @drag-start=${this._onDragStart} @drag-end=${this._onDragEnd}>
                        ${repeat(this._tagItems, (item) => item.id, (item) => html`
                            <div class="tag">
                                <vi-sensitive ?disabled=${!this.sensitive}><span class="tag-value">${item.value}</span></vi-sensitive>
                                ${!this.disabled ? html`
                                    <div @click=${() => this._onDeleteTap(item.value)} class="delete">
                                        <vi-icon source="Remove"></vi-icon>
                                    </div>
                                ` : nothing}
                            </div>
                        `)}
                    </vi-sortable>
                    ${!this.disabled ? html`
                        <input id="tagsInput" type="text" .value=${this.input ?? ""} @input=${this._handleInput} @keyup=${this._checkKeyPress} @blur=${this._onInputBlur} />
                    ` : nothing}
                </div>
            </vi-scroller>
        `;
    }
}

customElements.define("vi-tags", Tags);
