import * as Vidyano from "vidyano"
import { WebComponent } from "components/web-component/web-component"
import type { QueryGridRow } from "components/query-grid/query-grid-row"

let resizeObserver: ResizeObserver;
resizeObserver = new ResizeObserver(allEntries => {
    window.requestAnimationFrame(() => {
        // Entries may be batched for multiple grids, make sure the event is dispatched to the correct grid
        
        const parents = new Map<HTMLElement, ResizeObserverEntry[]>();
        allEntries.forEach(e => {
            const parent = parents.get(e.target.parentElement) || parents.set(e.target.parentElement, []).get(e.target.parentElement);
            parent.push(e);
        });

        parents.forEach((entries, parent) => {
            try {
                // parent can be null if the the element is no longer in the DOM
                parent?.dispatchEvent(new CustomEvent("column-width-changed", {
                    detail: {
                        type: "cell",
                        entries: entries.map(e => {
                            let width = e["borderBoxSize"] != null ? e["borderBoxSize"][0].inlineSize : (<HTMLElement>e.target).offsetWidth;
                            return [(<QueryGridCell>e.target).column.name, width];
                        }),
                    },
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }));
            }
            finally {
                entries.forEach(e => (e.target as QueryGridCell)._unobserve());
            }
        });
    });
});

@WebComponent.register({
    properties: {
        column: Object,
        value: Object,
        sensitive: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true
        },
        isRowHovered: {
            type: Boolean,
            observer: "_isRowHoveredChanged"
        }
    },
    observers: [
        "_queueMeasure(value, isConnected)"
    ]
}, "vi-query-grid-cell")
export abstract class QueryGridCell extends WebComponent {
    #_observeOnConnected: boolean;
    #_lastMeasuredColumn: Vidyano.QueryColumn;
    #_isObserved: boolean;
    #typeHints: any;
    #_foregroundStyle: { currentValue?: string; originalValue?: string } = { currentValue: null };
    #_textAlignStyle: { currentValue?: string; originalValue?: string } = { currentValue: null };
    #_customStyles: Map<string, { currentValue?: string; originalValue?: string }> = new Map();
    #_customHoverStyles: Map<string, { currentValue?: string; originalValue?: string }> = new Map();

    readonly sensitive: boolean; protected _setSensitive: (sensitive: boolean) => void;

    column: Vidyano.QueryColumn;
    value: Vidyano.QueryResultItemValue;
    valueQueued: Vidyano.QueryResultItemValue;
    isRowHovered: boolean;

    connectedCallback() {
        super.connectedCallback();

        // The element was disconnected and re-connected to the DOM, attach the observer
        if (this.#_observeOnConnected) {
            this.#_observeOnConnected = false;

            this._observe();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // The element is disconnected from the DOM, un-attach the observer
        if (this.#_isObserved) {
            this._unobserve();

            // Make sure that the element is observed when it is re-connected to the DOM
            this.#_observeOnConnected = true;
        }
    }

    get isObserved() {
        return this.#_isObserved;
    }

    private _queueMeasure(value: Vidyano.QueryResultItemValue, isConnected: boolean) {
        // Don't try to measure if the cell is disconnected
        if (!isConnected)
            return;

        // Don't try to measure if the column that needs to be measured hasn't changed
        if (this.#_lastMeasuredColumn && this.#_lastMeasuredColumn.query === this.column?.query && this.#_lastMeasuredColumn.name === this.column.name)
            return;

        const row = this.parentElement as QueryGridRow;
        // Don't measure the cell when the row is not a query result item (sanity check)
        if (!(row.item instanceof Vidyano.QueryResultItem))
            return;

        // Only measure if this is the first non-group query grid row in the grid
        const rowContainer = row.parentElement as HTMLElement;
        const firstQueryGridRow = rowContainer.querySelector("vi-query-grid-row:not([is-group])");
        if (firstQueryGridRow !== row)
            return;

        // Update the last measured column and queue the measure
        this.#_lastMeasuredColumn = this.column;
        this._observe();
    }

    private _observe() {
        this.#_isObserved = true;
        resizeObserver.observe(this, { box: "border-box" });
    }

    _unobserve() {
        resizeObserver.unobserve(this);
        this.#_isObserved = false;
    }

    protected _valueChanged(itemValue: Vidyano.QueryResultItemValue, oldValue: Vidyano.QueryResultItemValue) {
        this._setSensitive(itemValue?.column.isSensitive);

        // Prepare type hints for the cell
        this.#typeHints = Object.assign({}, itemValue?.item.typeHints, itemValue?.typeHints);

        if (!itemValue)
            this._clearCommonTypeHints();
        else
            this._applyCommonTypeHints(itemValue);

        // If row is already hovered when value changes, re-apply hover styles
        if (this.isRowHovered)
            this._applyHoverStyles(itemValue);
    }

    private _isRowHoveredChanged(isHovered: boolean, wasHovered: boolean) {
        if (isHovered === wasHovered || !this.value)
            return;

        if (isHovered)
            this._applyHoverStyles(this.value);
        else
            this._clearHoverStyles(this.value);
    }

    private _applyHoverStyles(itemValue: Vidyano.QueryResultItemValue) {
        if (!itemValue)
            return;

        const hoverStyleHint = this._getTypeHint(itemValue.column, "hoverstyle", null);
        if (hoverStyleHint) {
            const styleProps = hoverStyleHint.split(';').map(s => s.trim()).filter(s => !!s);
            styleProps.forEach(prop => {
                const [name, value] = prop.split(':').map(s => s.trim());
                if (name && value) {
                    let styleEntry = this.#_customHoverStyles.get(name);
                    if (!styleEntry) {
                        styleEntry = { currentValue: null, originalValue: this.style.getPropertyValue(name) };
                        this.#_customHoverStyles.set(name, styleEntry);
                    }

                    // Check if there's an active regular style hint for this property
                    const regularStyleEntry = this.#_customStyles.get(name);
                    if (regularStyleEntry && regularStyleEntry.currentValue !== null) {
                        // If a regular style is active, it becomes the original value for the hover style
                        styleEntry.originalValue = regularStyleEntry.currentValue;
                    }
                    // If no regular style, and no hover style was previously set, get current inline style
                    else if (styleEntry.currentValue === null) {
                         styleEntry.originalValue = this.style.getPropertyValue(name);
                    }

                    if (value !== styleEntry.currentValue) {
                        this.style.setProperty(name, value);
                        styleEntry.currentValue = value;
                    }
                }
            });
        }
    }

    private _clearHoverStyles(itemValue: Vidyano.QueryResultItemValue) {
        this.#_customHoverStyles.forEach((styleEntry, name) => {
            if (styleEntry.currentValue !== null) {
                // Revert to the original value (which could be a regular style hint or the initial style)
                this.style.setProperty(name, styleEntry.originalValue || null);
                styleEntry.currentValue = null;
                // No need to remove from map, originalValue is preserved for next hover
            }
        });

        // Re-apply non-hover styles if they exist, as hover might have overridden them
        if (itemValue) {
            this._applyCommonTypeHints(itemValue);
        }
    }

    private _applyCommonTypeHints(itemValue: Vidyano.QueryResultItemValue) {
        const foreground = this._getTypeHint(itemValue.column, "foreground", null);
        if (foreground !== this.#_foregroundStyle.currentValue) {
            if (this.#_foregroundStyle.originalValue === undefined) this.#_foregroundStyle.originalValue = this.style.color;
            this.style.color = this.#_foregroundStyle.currentValue = foreground || this.#_foregroundStyle.originalValue || null;
        }

        const textAlign = this._getTypeHint(itemValue.column, "horizontalcontentalignment", Vidyano.DataType.isNumericType(itemValue.column.type) ? "right" : null);
        if (textAlign !== this.#_textAlignStyle.currentValue) {
            if (this.#_textAlignStyle.originalValue === undefined) this.#_textAlignStyle.originalValue = this.style.textAlign;
            this.style.textAlign = this.#_textAlignStyle.currentValue = textAlign || this.#_textAlignStyle.originalValue || null;
        }

        const styleHint = this._getTypeHint(itemValue.column, "style", null);
        if (styleHint) {
            const styleProps = styleHint.split(';').map(s => s.trim()).filter(s => !!s);
            const newStyles = new Set<string>();
            styleProps.forEach(prop => {
                const [name, value] = prop.split(':').map(s => s.trim());
                if (name && value) {
                    newStyles.add(name);
                    let styleEntry = this.#_customStyles.get(name);
                    if (!styleEntry) {
                        styleEntry = { currentValue: null };
                        this.#_customStyles.set(name, styleEntry);
                    }

                    if (styleEntry.originalValue === undefined)
                        styleEntry.originalValue = this.style.getPropertyValue(name);

                    // Do not apply if a hover style is currently active for this property
                    const hoverStyleEntry = this.#_customHoverStyles.get(name);
                    if (hoverStyleEntry && hoverStyleEntry.currentValue !== null) {
                        // Update originalValue for the hover style if the base style changes
                        hoverStyleEntry.originalValue = value;
                        return;
                    }

                    if (value !== styleEntry.currentValue) {
                        this.style.setProperty(name, value);
                        styleEntry.currentValue = value;
                    }
                }
            });

            // Clear old styles that are not in the new style hint
            this.#_customStyles.forEach((styleEntry, name) => {
                if (!newStyles.has(name) && styleEntry.currentValue !== null) {
                    // Do not clear if a hover style is active for this property
                    const hoverStyleEntry = this.#_customHoverStyles.get(name);
                    if (hoverStyleEntry && hoverStyleEntry.currentValue !== null) {
                        return;
                    }

                    this.style.setProperty(name, styleEntry.originalValue || null);
                    styleEntry.currentValue = null;
                }
            });
        } else {
            // No style hint, clear all custom styles
            this.#_customStyles.forEach((styleEntry, name) => {
                // Do not clear if a hover style is active for this property
                const hoverStyleEntry = this.#_customHoverStyles.get(name);
                if (hoverStyleEntry && hoverStyleEntry.currentValue !== null) {
                    return;
                }

                if (styleEntry.currentValue !== null) {
                    this.style.setProperty(name, styleEntry.originalValue || null);
                    styleEntry.currentValue = null;
                }
            });
        }
    }

    private _clearCommonTypeHints() {
        if (this.#_foregroundStyle.originalValue !== undefined) {
            // Do not clear if a hover style is active for 'color'
            const hoverStyleEntry = this.#_customHoverStyles.get("color");
            if (!(hoverStyleEntry && hoverStyleEntry.currentValue !== null)) {
                this.style.color = this.#_foregroundStyle.originalValue || null;
            }
            this.#_foregroundStyle.currentValue = null;
        }

        if (this.#_textAlignStyle.originalValue !== undefined) {
            // Do not clear if a hover style is active for 'text-align'
            const hoverStyleEntry = this.#_customHoverStyles.get("text-align");
            if (!(hoverStyleEntry && hoverStyleEntry.currentValue !== null)) {
                this.style.textAlign = this.#_textAlignStyle.originalValue || null;
            }
            this.#_textAlignStyle.currentValue = null;
        }

        this.#_customStyles.forEach((styleEntry, name) => {
            // Do not clear if a hover style is active for this property
            const hoverStyleEntry = this.#_customHoverStyles.get(name);
            if (hoverStyleEntry && hoverStyleEntry.currentValue !== null) {
                return;
            }

            if (styleEntry.originalValue !== undefined) {
                this.style.setProperty(name, styleEntry.originalValue || null);
            } else {
                this.style.removeProperty(name);
            }
            styleEntry.currentValue = null;
        });
    }

    protected _getTypeHint(column: Vidyano.QueryColumn, name: string, defaultValue?: string): string {
        return column.getTypeHint(name, defaultValue, this.#typeHints, true);
    }

    static registerCellType(type: string, constructor: QueryGridCellConstructor) {
        registeredQueyGridCellTypes[type] = constructor;
    }

    static getCellTypeConstructor(type: string) {
        return registeredQueyGridCellTypes[type];
    }
}

export type QueryGridCellConstructor = new (...args:any[]) => QueryGridCell;

const registeredQueyGridCellTypes: { [type: string]: QueryGridCellConstructor} = {};