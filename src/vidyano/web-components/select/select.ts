import { html, nothing, unsafeCSS } from "lit";
import { property, state, query } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { WebComponent, computed, observer, listener, notify } from "components/web-component/web-component";
import * as Keyboard from "components/utils/keyboard"
import { Popup } from '../popup/popup.js';
import { Scroller } from "components/scroller/scroller";
import styles from "./select.css";
import { SelectOptionItem, ISelectItem, SelectOption } from "./select-option-item";

export { ISelectItem, SelectOptionItem, SelectOption };

export class Select extends WebComponent {
    static styles = unsafeCSS(styles);

    @query("#input")
    private _inputEl: HTMLInputElement;

    @query("#match")
    private _matchEl: HTMLElement;

    @query("#remainder")
    private _remainderEl: HTMLElement;

    @query("#popup")
    private _popup: Popup;

    @query("#scroller")
    private _scroller: Scroller;

    @property({ type: Array })
    options: (string | SelectOption)[] = [];

    @property({ type: Boolean })
    @computed(function(this: Select, options: (string | SelectOption)[], readonly: boolean): boolean {
        return !readonly && Array.isArray(options) && options.length > 0;
    }, "options", "readonly")
    declare readonly hasOptions: boolean;

    @property({ type: Boolean, reflect: true })
    keepUnmatched: boolean = false;

    @property({ type: Object })
    @notify()
    @observer(function(this: Select) {
        this.filtering = false;
        this._highlightedItem = null;
    })
    selectedOption: string | number | SelectOption;

    @state()
    suggestion: ISelectItem;

    @property({ type: String })
    groupSeparator: string = null;

    @property({ type: Array })
    @computed(function(this: Select, options: (string | SelectOption)[], groupSeparator: string): ISelectItem[] {
        if (!options || options.length === 0)
            return [];

        const result: ISelectItem[] = [];
        const groupsSeen = new Map<string, boolean>();

        options.forEach(opt => {
            let display = "";
            let key: string | number = "";
            let group = "";
            let rawOption = opt;

            if (typeof opt === "string") {
                display = opt;
                key = opt;
            } else if (opt && typeof opt === "object") {
                display = opt.value || "";
                key = opt.key;
            }

            if (groupSeparator && display.includes(groupSeparator)) {
                const parts = display.split(groupSeparator, 2);
                if (parts.length === 2) {
                    group = parts[0];
                    display = parts[1];
                }
            }

            let isGroupHeader = false;
            if (group) {
                if (!groupsSeen.has(group)) {
                    isGroupHeader = true;
                    groupsSeen.set(group, true);
                }
            }

            result.push({
                displayValue: display,
                group: group,
                isGroupHeader: isGroupHeader,
                option: rawOption,
                key: key
            });
        });

        return result;
    }, "options", "groupSeparator")
    declare readonly items: ISelectItem[];

    @property({ type: Array })
    @computed(function(this: Select, items: ISelectItem[], inputValue: string, filtering: boolean): ISelectItem[] {
        if (!items || items.length === 0)
            return [];
        if (!filtering || !inputValue)
            return items;

        const lowerInput = inputValue.toLowerCase();
        return items.filter(item =>
            item.displayValue && item.displayValue.toLowerCase().includes(lowerInput)
        );
    }, "items", "_inputValue", "filtering")
    declare readonly filteredItems: ISelectItem[];

    @property({ type: Object })
    @computed(function(this: Select, items: ISelectItem[], selectedOption: string | number | SelectOption): ISelectItem {
        if (!items || items.length === 0)
            return undefined;

        const searchKey = (selectedOption && typeof selectedOption === "object")
            ? (selectedOption as SelectOption).key
            : selectedOption;
        return items.find(i => i.key === searchKey);
    }, "items", "selectedOption")
    @observer(function(this: Select, selectedItem: ISelectItem) {
        if (this.filtering)
            return;

        this._inputValue = selectedItem?.displayValue ?? "";
        this.suggestion = selectedItem;
    })
    declare readonly selectedItem: ISelectItem;

    @property({ type: String })
    @notify()
    @computed(function(this: Select, _inputValue: string): string {
        return _inputValue;
    }, "_inputValue")
    declare readonly inputValue: string;

    @property({ type: String })
    _inputValue: string = "";

    @state()
    filtering: boolean = false;

    @state()
    private _highlightedItem: ISelectItem;

    @property({ type: Boolean, reflect: true })
    readonly: boolean = false;

    @property({ type: Boolean })
    @computed(function(this: Select, readonly: boolean, hasOptions: boolean, keepUnmatched: boolean, disableFiltering: boolean): boolean {
        return readonly || (!keepUnmatched && (!hasOptions || disableFiltering));
    }, "readonly", "hasOptions", "keepUnmatched", "disableFiltering")
    declare readonly isReadonlyInput: boolean;

    @property({ type: String })
    @computed(function(this: Select, isReadonlyInput: boolean): string {
        return isReadonlyInput ? "-1" : "0";
    }, "isReadonlyInput")
    declare readonly inputTabindex: string;

    @property({ type: Boolean, reflect: true })
    @observer(function(this: Select, newValue: boolean) {
        if (newValue && this._popup?.open)
            this._popup.close();
    })
    disabled: boolean = false;

    @property({ type: Boolean, reflect: true })
    disableFiltering: boolean = false;

    @property({ type: Boolean, reflect: true })
    sensitive: boolean = false;

    @property({ type: String })
    placeholder: string;

    @state()
    lazy: boolean = true;


    render() {
        return html`
            <vi-popup id="popup"
                      @popup-opened=${this._popupOpened}
                      @popup-closed=${this._popupClosed}
                      sticky
                      auto-width
                      ?disabled=${this.readonly || this.disabled || this.sensitive}>

                <div slot="header">
                    <slot name="left"></slot>

                    ${this.filtering ? html`
                        <div class="suggestions">
                            <span id="match"></span><span id="remainder"></span>
                        </div>
                    ` : nothing}

                    <vi-sensitive ?disabled=${!this.sensitive}>
                        <input id="input"
                               .value=${this._inputValue}
                               @input=${this._onInput}
                               @blur=${this._blur}
                               @keydown=${this._keydown}
                               @keyup=${this._keyup}
                               ?readonly=${this.isReadonlyInput}
                               tabindex=${this.inputTabindex}
                               placeholder=${this.placeholder || ''}
                               part="input"
                               ?disabled=${this.disabled}
                               autocomplete="off">
                    </vi-sensitive>

                    ${this.hasOptions ? html`
                        <vi-icon source="CaretDown" part="icon"></vi-icon>
                    ` : nothing}
                    <slot name="right"></slot>
                </div>

                ${!this.lazy ? html`
                    <vi-scroller id="scroller" content ?filtering=${this.filtering} @select-option=${this._onOptionSelected}>
                        ${this.filteredItems?.map(item => html`
                            ${item.isGroupHeader ? html`
                                <div class="group">${item.group}</div>
                            ` : nothing}

                            <vi-select-option-item
                                ?suggested=${item.option === this.suggestion?.option}
                                ?selected=${!this.filtering && item.option === (this._highlightedItem ?? this.selectedItem)?.option}
                                .item=${item}>
                                ${unsafeHTML(this.#computeItemDisplayValue(item.displayValue, this._inputValue))}
                            </vi-select-option-item>
                        `)}
                    </vi-scroller>
                ` : nothing}
            </vi-popup>
        `;
    }

    open() {
        if (this.readonly || !this.items || this.items.length === 0)
            return;

        this._popup?.popup();
    }

    focus() {
        if (this._inputEl)
            this._inputEl.focus();
    }

    private _onInput(e: InputEvent) {
        this._inputValue = (e.target as HTMLInputElement).value;
    }

    @listener("keydown")
    private _keydown(e: KeyboardEvent) {
        if (!this.items || this.items.length === 0)
            return;

        switch (e.key) {
            case Keyboard.Keys.ArrowDown:
                this.#navigate(1);
                e.preventDefault();
                e.stopPropagation();
                break;

            case Keyboard.Keys.ArrowUp:
                this.#navigate(-1);
                e.preventDefault();
                e.stopPropagation();
                break;

            case Keyboard.Keys.Enter:
            case Keyboard.Keys.Tab:
                this.#confirmSelection();
                if (e.key === Keyboard.Keys.Enter) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                break;

            case Keyboard.Keys.Escape:
                this.#cancelSelection();
                e.preventDefault();
                e.stopPropagation();
                break;
        }
    }

    private _keyup(e: KeyboardEvent) {
        if (this.disableFiltering)
            return;

        const ignoredKeys = [
            Keyboard.Keys.Enter, Keyboard.Keys.Tab, Keyboard.Keys.Escape,
            Keyboard.Keys.ArrowUp, Keyboard.Keys.ArrowDown, Keyboard.Keys.ArrowLeft, Keyboard.Keys.ArrowRight
        ];

        if (!this.filtering && !ignoredKeys.includes(e.key)) {
            this.filtering = true;
        }
    }

    private _blur() {
        if (this.keepUnmatched)
            return;

        if (!this._popup?.open) {
            this.filtering = false;
            this._inputValue = this.selectedItem?.displayValue ?? "";
        }
    }

    private async _popupOpened() {
        if (this.lazy) {
            this.lazy = false;
            await this.updateComplete;
        }
        this.#scrollItemIntoView(this._highlightedItem ?? this.selectedItem);
    }

    private _popupClosed() {
        this._highlightedItem = null;
    }

    private _onOptionSelected(e: CustomEvent) {
        e.stopPropagation();
        this.#setSelectedOption(e.detail.option);
        this._popup?.close();
    }

    #navigate(direction: number) {
        this._popup?.popup();

        const list = this.filteredItems;
        if (!list || list.length === 0)
            return;

        const activeItem = this.filtering
            ? this.suggestion
            : (this._highlightedItem ?? this.selectedItem);
        const currentIndex = list.indexOf(activeItem);

        let newIndex = currentIndex + direction;

        if (newIndex < 0)
            newIndex = 0;
        if (newIndex >= list.length)
            newIndex = list.length - 1;

        if (newIndex !== currentIndex || !activeItem) {
            const newItem = list[newIndex];
            if (this.filtering) {
                this.suggestion = newItem;
            } else {
                this._highlightedItem = newItem;
            }
            this.#scrollItemIntoView(newItem);
        }
    }

    #confirmSelection() {
        const itemToSelect = this.filtering
            ? this.suggestion
            : (this._highlightedItem ?? this.selectedItem);

        this._popup?.close();

        if (itemToSelect) {
            this.#setSelectedOption(itemToSelect.option);
        }
    }

    #cancelSelection() {
        this._popup?.close();
        this.filtering = false;
        this._highlightedItem = null;
        this._inputValue = this.selectedItem?.displayValue ?? "";
    }

    @observer("filteredItems", "filtering")
    private _filteredItemsChanged(filteredItems: ISelectItem[], filtering: boolean) {
        if (!filtering)
            return;

        if (!filteredItems || filteredItems.length === 0) {
            this.suggestion = null;
            return;
        }

        const lowerInput = this._inputValue ? this._inputValue.toLowerCase() : "";

        const exactStart = filteredItems.find(i => i.displayValue.toLowerCase().startsWith(lowerInput));
        const autoSuggest = exactStart || filteredItems[0];

        this.suggestion = autoSuggest;

        if (!this._popup?.open && filteredItems.length > 0) {
            this._popup?.popup();
        }
    }

    @observer("_inputValue", "suggestion", "filtering")
    private _updateSuggestionFeedback(inputValue: string, suggestion: ISelectItem, filtering: boolean) {
        const matchEl = this._matchEl;
        const remainEl = this._remainderEl;

        if (!matchEl || !remainEl)
            return;

        if (!filtering || !suggestion || !suggestion.displayValue || !inputValue) {
            matchEl.innerHTML = "";
            remainEl.innerHTML = "";
            return;
        }

        if (suggestion.displayValue.toLowerCase().startsWith(inputValue.toLowerCase())) {
            const matchTxt = suggestion.displayValue.substr(0, inputValue.length);
            const remainTxt = suggestion.displayValue.substr(inputValue.length);

            matchEl.innerHTML = this.#escapeHTML(matchTxt).replace(/ /g, "&nbsp;");
            remainEl.innerHTML = this.#escapeHTML(remainTxt).replace(/ /g, "&nbsp;");
        } else {
            matchEl.innerHTML = "";
            remainEl.innerHTML = "";
        }
    }

    #computeItemDisplayValue(displayValue: string, inputValue: string): string {
        if (!displayValue)
            return "";
        const escaped = this.#escapeHTML(displayValue);
        if (!inputValue || !this.filtering)
            return escaped;

        try {
            const safeInput = inputValue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            const exp = new RegExp(`(${safeInput})`, "gi");
            return escaped.replace(exp, "<span class='match'>$1</span>");
        } catch {
            return escaped;
        }
    }

    #setSelectedOption(option: string | SelectOption) {
        const key = (option && typeof option === "object")
            ? (option as SelectOption).key
            : option as string;

        this.selectedOption = key;
    }

    #scrollItemIntoView(item: ISelectItem) {
        if (!item || !this._scroller)
            return;

        const elements = Array.from(this._scroller.querySelectorAll("vi-select-option-item")) as SelectOptionItem[];
        const target = elements.find(el => el.item === item);
        if (target) {
            target.scrollIntoView({ block: "nearest" });
        }
    }

    #escapeHTML(str: string): string {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }
}

customElements.define("vi-select", Select);
