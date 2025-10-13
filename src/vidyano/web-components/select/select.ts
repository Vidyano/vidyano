import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import * as Keyboard from "components/utils/keyboard"
import { WebComponent } from "components/web-component/web-component"
import { Popup } from '../popup/popup.js';
import { Scroller } from "components/scroller/scroller";

export type SelectOption = Vidyano.KeyValuePair<any, string>;

export interface ISelectItem {
    displayValue: string;
    group: string;
    groupFirst: boolean;
    option: string | SelectOption;
}

@WebComponent.register({
    properties: {
        options: {
            type: Array,
            value: null
        },
        hasOptions: {
            type: Boolean,
            computed: "_computeHasOptions(options, readonly)"
        },
        keepUnmatched: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        selectedOption: {
            type: Object,
            observer: "_selectedOptionChanged",
            notify: true
        },
        suggestion: {
            type: Object,
            readOnly: true,
            observer: "_suggestionChanged"
        },
        groupSeparator: {
            type: String,
            value: null
        },
        ungroupedOptions: {
            type: Array,
            computed: "_computeUngroupedOptions(options, groupSeparator)"
        },
        items: {
            type: Array,
            computed: "_computeItems(options, ungroupedOptions)"
        },
        filteredItems: {
            type: Array,
            computed: "_computeFilteredItems(items, inputValue, filtering, selectedOption)"
        },
        selectedItem: {
            type: Object,
            readOnly: true,
            observer: "_selectedItemChanged"
        },
        inputValue: {
            type: String,
            notify: true,
            computed: "_forwardComputed(_inputValue)"
        },
        _inputValue: {
            type: String,
            notify: true,
            value: ""
        },
        filtering: {
            type: Boolean,
            readOnly: true,
            value: false
        },
        readonly: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        isReadonlyInput: {
            type: Boolean,
            computed: "_computeIsReadonlyInput(readonly, hasOptions, keepUnmatched, disableFiltering)"
        },
        inputTabindex: {
            type: String,
            computed: "_computeInputTabIndex(isReadonlyInput)"
        },
        disabled: {
            type: Boolean,
            reflectToAttribute: true,
            value: false,
            observer: "_disabledChanged"
        },
        disableFiltering: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        sensitive: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        placeholder: String,
        lazy: {
            type: Boolean,
            readOnly: true,
            value: true
        }
    },
    listeners: {
        "keydown": "_keydown"
    },
    observers: [
        "_computeSuggestionFeedback(inputValue, suggestion, filtering)"
    ]
}, "vi-select")
export class Select extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="select.html">` }

    private items: ISelectItem[];
    private filteredItems: ISelectItem[];
    private _lastMatchedInputValue: string;
    private _inputValue: string;
    private _pendingSelectedOption: string;
    readonly suggestion: ISelectItem; private _setSuggestion: (suggestion: ISelectItem) => void;
    readonly filtering: boolean; private _setFiltering: (filtering: boolean) => void;
    readonly selectedItem: ISelectItem; private _setSelectedItem: (item: ISelectItem) => void;
    readonly lazy: boolean; private _setLazy: (lazy: boolean) => void;
    ungroupedOptions: string[] | SelectOption[];
    selectedOption: string;
    keepUnmatched: boolean;
    readonly: boolean;
    groupSeparator: string;

    open() {
        if (this.readonly || !this.items || this.items.length === 0)
            return;

        this.popup.popup();
    }

    focus() {
        this.shadowRoot.querySelector("input").focus();
    }

    private get popup(): Popup {
        return <Popup>this.$.popup;
    }

    private _keydown(e: KeyboardEvent) {
        if (!this.ungroupedOptions || this.ungroupedOptions.length === 0)
            return;

        if (this.items && this.items.length > 0) {
            const currentIndex = this.filteredItems.indexOf(this.filtering ? this.suggestion : this.selectedItem);

            if (e.key === Keyboard.Keys.ArrowDown) {
                this.popup.popup();

                if (currentIndex + 1 < this.filteredItems.length) {
                    if (this.filtering)
                        this._setSuggestion(this.filteredItems[currentIndex + 1]);
                    else
                        this._setSelectedItem(this.filteredItems[currentIndex + 1]);
                }

                e.stopPropagation();
                e.preventDefault();
            }
            else if (e.key === Keyboard.Keys.ArrowUp) {
                this.popup.popup();

                if (currentIndex > 0) {
                    if (this.filtering)
                        this._setSuggestion(this.filteredItems[currentIndex - 1]);
                    else
                        this._setSelectedItem(this.filteredItems[currentIndex - 1]);
                }

                e.stopPropagation();
                e.preventDefault();
            }
            else if (e.key === Keyboard.Keys.Enter || e.key === Keyboard.Keys.Tab) {
                this.popup.close();

                if (this.suggestion !== this.selectedItem)
                    this._setSelectedItem(this.suggestion);
                else
                    this._selectedItemChanged();

                if (e.key === Keyboard.Keys.Enter) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            }
            else if (e.key === Keyboard.Keys.Escape) {
                this.popup.close();

                if (this.filtering)
                    this._setFiltering(false);

                const currentSelectedItem = this.selectedItem;
                this._setSelectedItem(this._getItem(this.selectedOption));
                if (currentSelectedItem === this.selectedItem)
                    this._selectedItemChanged();

                e.stopPropagation();
                e.preventDefault();
            }
        }
    }

    private _keyup(e: KeyboardEvent) {
        if (this._lastMatchedInputValue !== this._inputValue && !this.filtering && e.key !== Keyboard.Keys.Enter && e.key !== Keyboard.Keys.Tab && e.key !== Keyboard.Keys.Escape)
            this._setFiltering(true);
    }

    private _blur() {
        if (this.keepUnmatched)
            return;

        if (!this.popup.open)
            this._selectedItemChanged();
    }

    private _popupOpened() {
        if (this.lazy) {
            this._setLazy(false);
            Polymer.flush();
        }

        this._scrollItemIntoView();
    }

    private _popupClosed() {
        if (this._pendingSelectedOption) {
            const pendingSelectedOption = this._pendingSelectedOption;
            this._pendingSelectedOption = undefined;

            this._setSelectedItem(this._getItem(pendingSelectedOption));
        }
    }

    private _scrollItemIntoView() {
        if (!this.selectedItem)
            return;

        const scroller = this.shadowRoot.getElementById(`${this.groupSeparator ? "grouped-" : ""}scroller`) as Scroller;
        if (scroller != null) {
            const options = <SelectOptionItem[]>(Array.from(scroller.querySelectorAll("vi-select-option-item")) as any);
            options.find(option => option.item === this.selectedItem)?.scrollIntoView();
        }
    }

    private _computeHasOptions(options: string[], readonly: boolean): boolean {
        return !readonly && !!options && options.length > 0;
    }

    private _computeUngroupedOptions(options: string[] | SelectOption[], groupSeparator: string): string[] | SelectOption[] {
        if (!groupSeparator || !options || options.length === 0)
            return options;

        if ((<any[]>options).some(o => typeof o === "string"))
            return (<string[]>options).map(o => o ? o.split(groupSeparator, 2)[1] : o);
        else
            return (<SelectOption[]>options).map(kvp => {
                return {
                    key: kvp.key,
                    value: kvp && kvp.value ? kvp.value.split(groupSeparator, 2)[1] : ""
                };
            });
    }

    private _computeItems(options: string[] | SelectOption[], ungroupedOptions: string[] | SelectOption[]): ISelectItem[] {
        if (!options || options.length === 0)
            return [];

        const isKvp = !(<any[]>options).some(o => typeof o === "string");

        let groupFirstOptions: Map<any, any>;
        if (this.groupSeparator) {
            let optionsByGroup: Vidyano.KeyValuePair<string, any>[];

            if (!isKvp)
                optionsByGroup = (<string[]>options).groupBy(o => {
                    const parts = o ? o.split(this.groupSeparator, 2) : [];
                    return parts.length === 2 ? parts[0] || null : null;
                });
            else {
                optionsByGroup = (<SelectOption[]>options).groupBy(kvp => {
                    const displayValue = kvp ? kvp.value : null;
                    const displayParts = displayValue ? displayValue.split(this.groupSeparator, 2) : [];
                    return displayParts.length === 2 ? displayParts[0] || null : null;
                });
            }

            groupFirstOptions = new Map();
            optionsByGroup.forEach(g => {
                g.value.forEach((o, n) => groupFirstOptions.set(o, { name: g.key, first: n === 0 }));
            });
        }

        let result: ISelectItem[];
        if (!isKvp )
            result = (<string[]>options).map((o, n) => {
                const group = groupFirstOptions ? groupFirstOptions.get(o) : null;
                return {
                    displayValue: <string>ungroupedOptions[n],
                    group: group ? group.name : null,
                    groupFirst: group ? group.first : null,
                    option: ungroupedOptions[n]
                };
            });
        else {
            result = (<SelectOption[]>options).map((kvp, index) => {
                const ungroupedKvp = <SelectOption>ungroupedOptions[index];
                const group = groupFirstOptions ? groupFirstOptions.get(kvp) : null;

                return {
                    displayValue: ungroupedKvp ? ungroupedKvp.value : "",
                    group: group ? group.name : null,
                    groupFirst: group ? group.first : null,
                    option: ungroupedKvp
                };
            });
        }

        return result;
    }

    private _computeFilteredItems(items: ISelectItem[], inputValue: string, filtering: boolean, selectedOption: string): ISelectItem[] {
        let result = items;
        if (result.length === 0)
            return result;

        if (filtering) {
            if (!String.isNullOrEmpty(inputValue)) {
                const lowerInputValue = inputValue.toLowerCase();
                result = result.filter(r => r != null && r.displayValue && r.displayValue.toLowerCase().contains(lowerInputValue));

                if (!this.suggestion || result.indexOf(this.suggestion) < 0)
                    this._setSuggestion(result[0] !== undefined && result[0].displayValue.toLowerCase().startsWith(lowerInputValue) ? result[0] : null);
            }
            else {
                let suggestion: ISelectItem;
                if (result[0].option == null)
                    suggestion = result[0];
                else if (typeof result[0].option === "string") {
                    suggestion = result.find(o => o.option == null);
                    if (!suggestion)
                        suggestion = result.find(o => (<string>o.option).length === 0);
                }
                else {
                    suggestion = result.find(o => (<SelectOption>o.option).key == null);
                    if (!suggestion)
                        suggestion = result.find(o => (<SelectOption>o.option).key.length === 0);
                }

                this._setSuggestion(suggestion);
            }

            if (!this.popup.open && result.length > 1)
                this.popup.popup();
        }
        else if (!this.selectedItem)
            this._setSelectedItem(this._getItem(this.selectedOption));

        return result;
    }

    private _computeSuggestionFeedback(inputValue: string, suggestion: ISelectItem, filtering: boolean) {
        let suggestionMatch = "";
        let suggestionRemainder = "";

        if (filtering && suggestion && suggestion.displayValue) {
            suggestionMatch = inputValue;
            suggestionRemainder = suggestion.displayValue.substr(inputValue.length);
        }

        this.$.match.innerHTML = this._escapeHTML(suggestionMatch).replace(" ", "&nbsp;");
        this.$.remainder.innerHTML = this._escapeHTML(suggestionRemainder).replace(" ", "&nbsp;");
    }

    private _computeItemDisplayValue(displayValue: string, inputValue: string): string {
        if (!displayValue)
            return displayValue;

        const escapedDisplayValue = this._escapeHTML(displayValue);

        if (!inputValue)
            return escapedDisplayValue;

        inputValue = inputValue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        const exp = new RegExp(`(${inputValue})`, "gi");

        return escapedDisplayValue.replace(exp, "<span class='match'>$1</span>");
    }
    
    private _disabledChanged(newValue: boolean, oldValue: boolean) {
        if (newValue && (<Popup>this.$.popup).open)
            (<Popup>this.$.popup).close();
    }

    private _setSelectedOption(option: string | SelectOption, force?: boolean) {
        if (option && typeof option !== "string")
            option = (<SelectOption>option).key;

        if (this.popup.open && !force) {
            this._pendingSelectedOption = <string>option;
            this._scrollItemIntoView();

            return;
        }

        this.selectedOption = <string>option;
    }

    private _selectedItemChanged() {
        this._setFiltering(false);

        if (this.selectedItem) {
            if (!this.selectedItem.option || typeof this.selectedItem.option === "string") {
                this._setSelectedOption((<string[]>this.ungroupedOptions).find(o => o === this.selectedItem.option));
                this._inputValue = <string>this.selectedItem.option;
            }
            else {
                this._setSelectedOption((<SelectOption[]>this.ungroupedOptions).find(o => o.key === (<SelectOption>this.selectedItem.option).key));
                this._inputValue = (<SelectOption>this.selectedItem.option).value;
            }

            this._lastMatchedInputValue = this._inputValue;
            this._setSuggestion(this.selectedItem);
        }
        else {
            this._setSuggestion(null);
            this._inputValue = "";
        }
    }

    private _selectedOptionChanged() {
        this._setFiltering(false);

        this._setSelectedItem(this._getItem(this.selectedOption));
        this._scrollItemIntoView();
    }

    private _suggestionChanged() {
        if (!this.filtering && this.suggestion)
            this._setSelectedOption(this.suggestion.option);
    }

    private _getItem(key: string, items: ISelectItem[] = this.items): ISelectItem {
        if (!items)
            return undefined;

        return items.find(i => {
            if (!i.option || typeof i.option === "string")
                return i.option === key;
            else
                return (<SelectOption>i.option).key === key;
        });
    }

    private _select(e: CustomEvent, detail: any) {
        this._setSelectedOption(detail.option, true);
        this.popup.close();

        e.stopPropagation();
    }

    private _computeIsReadonlyInput(readonly: boolean, hasOptions: boolean, keepUnmatched: boolean, disableFiltering: boolean): boolean {
        return readonly || (!keepUnmatched && (!hasOptions || disableFiltering));
    }

    private _computeInputTabIndex(isReadonlyInput: boolean): string {
        return isReadonlyInput ? "-1" : "0";
    }
}

@WebComponent.register({
    properties: {
        suggested: {
            type: Boolean,
            reflectToAttribute: true
        },
        selected: {
            type: Boolean,
            reflectToAttribute: true
        },
        item: Object,
        group: {
            type: String,
            reflectToAttribute: true,
            computed: "item.group"
        }
    },
    listeners: {
        "tap": "_onTap"
    }
}, "vi-select-option-item")
export class SelectOptionItem extends WebComponent {
    item: ISelectItem;

    private _onTap(e: Polymer.Gestures.TapEvent) {
        this.dispatchEvent(new CustomEvent("select-option", {
            detail: { option: this.item.option },
            bubbles: true,
            composed: true
        }));

        e.stopPropagation();
    }
}