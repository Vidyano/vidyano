import * as Vidyano from "vidyano"
import { html, unsafeCSS } from "lit";
import type { Scroller } from "components/scroller/scroller";
import { property, WebComponentLit } from "components/web-component/web-component-lit";
import type { QueryGridGalleryLazyImage } from "./query-grid-gallery-lazy-image";
import "./query-grid-gallery-lazy-image";
import "./query-grid-gallery-image-viewer";
import styles from "./query-grid-gallery.css"

/**
 * Represents a block of photos for a single day in the gallery.
 */
type DayBlock = {
    date: Date;
    photos: any[];
    actualImageSize?: number;
    needsHeader?: boolean;
};

/**
 * Represents a row in the gallery, consisting of multiple day blocks.
 */
type GalleryRow = DayBlock[];

/**
 * Represents a month header row item for the gallery.
 */
type MonthHeaderRowItem = {
    type: 'month';
    month: number;
    year: number;
    isFirst?: boolean;
    rowHeight: number;
};

/**
 * Represents a gallery row item for the gallery.
 */
type GalleryRowItem = {
    type: 'gallery';
    row: GalleryRow;
    rowHeight: number;
};

/**
 * Represents an individual image item in the gallery.
 */
export type ImageItemMap = {
    date: string | null;
    image: string;
    thumbnail: string;
    label?: string;
};

/**
 * A web component that displays a gallery of photos grouped by day and month,
 * with responsive layout and lazy image loading.
 */
export class QueryGridGallery extends WebComponentLit {
    static styles = unsafeCSS(styles);
    
    @property({ type: Array, computed: "query.items", state: true }) private _items: Vidyano.QueryResultItem[];
    @property({ type: String, attribute: "map" }) private declare map: string;
    @property({ type: Array, state: true }) private _rows: (MonthHeaderRowItem | GalleryRowItem)[] = [];
    @property({ type: Array, state: true }) private _selectedItems: Set<any> = new Set();
    @property({ type: Boolean, state: true }) private _selectionMode = false;
    @property({ type: Object, state: true }) private _visibleRowIndexes: Set<number> = new Set();
    @property({ type: Boolean, state: true }) private _viewerActive = false;
    @property({ type: Number, state: true }) private _viewerCurrentIndex: number | null = null;


    @property({ type: Object, computed: "_computeMap(map)", state: true }) private _map: ImageItemMap;
    @property({ type: Object }) query: Vidyano.Query;
    @property({ type: Number, reflect: true, attribute: "size" }) size = 175; // Preferred size (in pixels) for gallery images.

    #lastSelectedIndex: number | null = null;

    #intersectionObserver: IntersectionObserver;
    #rowIntersectionObserver: IntersectionObserver;
    #resizeObserver: ResizeObserver;
    #resizeDebounceTimer: number;

    /**
     * Computes the mapping of item properties based on the provided map string.
     * @param map The JSON string representing the mapping of item properties.
     * @returns An object mapping item properties to their respective keys.
     */
    private _computeMap(map: string): ImageItemMap {
        const defaults: ImageItemMap = {
            date: null,
            image: "image",
            thumbnail: "thumbnail",
            label: null
        };

        if (!map)
            return defaults;

        try {
            const parsedMap = JSON.parse(map);
            return {
                date: parsedMap.hasOwnProperty('date') ? parsedMap.date : defaults.date,
                image: parsedMap.image || defaults.image,
                thumbnail: parsedMap.thumbnail || defaults.thumbnail,
                label: parsedMap.label || defaults.label
            };
        } catch (e) {
            console.error("Invalid map format:", e);
            return defaults;
        }
    }

    /**
     * Calculates the layout of the gallery based on the container width and items.
     * Groups photos by day and month, and determines optimal image size and row structure.
     * If this.map.date is null, it will display all images in rows without date/month grouping.
     */
    private _calculateLayout() {
        const scroller = this.shadowRoot?.querySelector('vi-scroller') as HTMLElement;
        if (!scroller || scroller.offsetWidth === 0 || !this._items?.some(Boolean) || !this._map) {
            this._rows = [];
            this._visibleRowIndexes.clear();
            return;
        }

        const computedStyle = getComputedStyle(this);
        const getCssVar = (name: string) => parseInt(computedStyle.getPropertyValue(name));

        const MONTH_HEADER_HEIGHT = getCssVar('--query-grid-gallery-month-header-height');
        const MONTH_HEADER_FIRST_HEIGHT = getCssVar('--query-grid-gallery-month-header-first-height');
        const DAY_BLOCK_HEADER_WITH_GAP_HEIGHT = getCssVar('--query-grid-gallery-day-block-header-with-gap-height');
        const gap = getCssVar('--query-grid-gallery-gap');
        const padding = getCssVar('--query-grid-gallery-padding');

        const horizontalPadding = padding * 2;
        const availableWidth = scroller.offsetWidth - horizontalPadding;
        const preferredSize = this.size;

        const estimatedPhotosPerRow = Math.max(1, Math.floor((availableWidth + gap) / (preferredSize + gap)));
        const totalGapsWidth = (estimatedPhotosPerRow - 1) * gap;
        const optimalSize = (availableWidth - totalGapsWidth) / estimatedPhotosPerRow;

        const minSize = preferredSize * 0.7;
        const maxSize = preferredSize * 1.5;
        const clampedSize = Math.max(minSize, Math.min(maxSize, optimalSize));

        const actualImageSize = Math.floor(clampedSize);
        const totalUsedWidth = estimatedPhotosPerRow * actualImageSize + totalGapsWidth;
        const remainingSpace = availableWidth - totalUsedWidth;

        const finalImageSize = remainingSpace > 0 && remainingSpace < estimatedPhotosPerRow
            ? actualImageSize + Math.floor(remainingSpace / estimatedPhotosPerRow)
            : actualImageSize;

        let rowsToSet: (MonthHeaderRowItem | GalleryRowItem)[] = [];
        let performDateGrouping = this._map.date !== null;

        if (performDateGrouping) {
            // If date grouping is requested, check if all items have valid dates.
            // If any item has an invalid/undefined date, disable grouping for the entire gallery.
            for (const item of this._items) {
                const dateValue = item.values[this._map.date as string];
                if (!(dateValue && typeof dateValue.toISOString === 'function')) {
                    performDateGrouping = false; // Found an item that prevents date grouping
                    break;
                }
            }
        }

        if (!performDateGrouping) {
            // MODE 1: No date grouping for the entire gallery.
            // This occurs if this.map.date was null, or if an item had an invalid/undefined date.
            const finalRowsNoDate: GalleryRowItem[] = [];
            let currentPhotosInRow: any[] = [];

            for (let i = 0; i < this._items.length; i++) {
                const item = this._items[i];
                currentPhotosInRow.push(item);

                if (currentPhotosInRow.length === estimatedPhotosPerRow || i === this._items.length - 1) {
                    if (currentPhotosInRow.length > 0) {
                        const dayBlock: DayBlock = {
                            date: new Date(0), // Dummy date, not used
                            photos: [...currentPhotosInRow],
                            actualImageSize: finalImageSize,
                            needsHeader: false
                        };
                        finalRowsNoDate.push({
                            type: 'gallery',
                            row: [dayBlock],
                            rowHeight: finalImageSize
                        });
                        currentPhotosInRow = [];
                    }
                }
            }
            rowsToSet = finalRowsNoDate;
        } else {
            // MODE 2: Date grouping is active, and all items have been verified to have valid dates.
            // this.map.date is guaranteed to be a string here.
            const datedItemsMap = new Map<string, any[]>();
            for (const item of this._items) {
                // All items here are guaranteed to have a valid date for this.map.date
                const dateValue = item.values[this._map.date as string] as Date;
                const dateStr = dateValue.toISOString().slice(0, 10);
                if (!datedItemsMap.has(dateStr))
                    datedItemsMap.set(dateStr, []);
                datedItemsMap.get(dateStr)!.push(item);
            }

            const finalRowsWithDate: (MonthHeaderRowItem | GalleryRowItem)[] = [];
            let currentRow: GalleryRow = [];
            let currentWidth = 0;
            let lastRowLastDate: Date | null = null;
            let lastProcessedMonth: { month: number; year: number } | null = null;
            let firstMonthHeaderAdded = false;

            for (const [dateStr, photosInDay] of datedItemsMap.entries()) {
                const date = new Date(dateStr + 'T00:00:00');
                const currentMonth = date.getMonth();
                const currentYear = date.getFullYear();

                if (lastProcessedMonth === null || lastProcessedMonth.month !== currentMonth || lastProcessedMonth.year !== currentYear) {
                    if (currentRow.length > 0) {
                        const hasHeaders = currentRow.some(b => b.needsHeader);
                        const rowHeight = finalImageSize + (hasHeaders ? DAY_BLOCK_HEADER_WITH_GAP_HEIGHT : 0);
                        finalRowsWithDate.push({ type: 'gallery', row: currentRow, rowHeight });
                        lastRowLastDate = currentRow[currentRow.length - 1].date;
                        currentRow = [];
                        currentWidth = 0;
                    }
                    const rowHeight = !firstMonthHeaderAdded ? MONTH_HEADER_FIRST_HEIGHT : MONTH_HEADER_HEIGHT;
                    finalRowsWithDate.push({ type: 'month', month: currentMonth, year: currentYear, isFirst: !firstMonthHeaderAdded, rowHeight });
                    firstMonthHeaderAdded = true;
                    lastProcessedMonth = { month: currentMonth, year: currentYear };
                    lastRowLastDate = null;
                }

                for (let i = 0; i < photosInDay.length; i++) {
                    const photo = photosInDay[i];
                    const isNewBlock = !currentRow.find(b => b.date.getTime() === date.getTime());

                    if (isNewBlock && currentRow.length > 0) {
                        const currentRowHasHeaders = currentRow.some(block => block.needsHeader);
                        if (!currentRowHasHeaders) {
                            const remainingWidthInCurrentRow = availableWidth - currentWidth;
                            const maxPhotosInRemainingSpace = Math.floor((remainingWidthInCurrentRow + gap) / (finalImageSize + gap));
                            if (maxPhotosInRemainingSpace < estimatedPhotosPerRow / 2) {
                                const hasHeaders = currentRow.some(b => b.needsHeader);
                                const rowHeight = finalImageSize + (hasHeaders ? DAY_BLOCK_HEADER_WITH_GAP_HEIGHT : 0);
                                finalRowsWithDate.push({ type: 'gallery', row: currentRow, rowHeight });
                                lastRowLastDate = currentRow[currentRow.length - 1].date;
                                currentRow = [];
                                currentWidth = 0;
                            } else {
                                currentRow.forEach(block => { block.needsHeader = true; });
                            }
                        }
                    }

                    const neededWidth = (isNewBlock ? (currentRow.length > 0 ? gap : 0) : gap) + finalImageSize;
                    if (currentWidth > 0 && currentWidth + neededWidth > availableWidth) {
                        const hasHeaders = currentRow.some(b => b.needsHeader);
                        const rowHeight = finalImageSize + (hasHeaders ? DAY_BLOCK_HEADER_WITH_GAP_HEIGHT : 0);
                        finalRowsWithDate.push({ type: 'gallery', row: currentRow, rowHeight });
                        lastRowLastDate = currentRow[currentRow.length - 1].date;
                        currentRow = [];
                        currentWidth = 0;
                    }

                    let blockForThisDay = currentRow.find(b => b.date.getTime() === date.getTime());
                    if (!blockForThisDay) {
                        let needsHeader: boolean;
                        if (currentRow.length === 0) {
                            needsHeader = !lastRowLastDate || date.getTime() !== lastRowLastDate.getTime();
                        } else {
                            needsHeader = currentRow.some(block => block.needsHeader);
                        }
                        blockForThisDay = { date, photos: [], needsHeader };
                        currentRow.push(blockForThisDay);
                        if (currentRow.length > 1) {
                            currentWidth += gap;
                        }
                    } else {
                        currentWidth += gap;
                    }
                    blockForThisDay.photos.push(photo);
                    currentWidth += finalImageSize;
                }
            }

            if (currentRow.length > 0) {
                const hasHeaders = currentRow.some(b => b.needsHeader);
                const rowHeight = finalImageSize + (hasHeaders ? DAY_BLOCK_HEADER_WITH_GAP_HEIGHT : 0);
                finalRowsWithDate.push({ type: 'gallery', row: currentRow, rowHeight });
            }

            rowsToSet = finalRowsWithDate.map(item => {
                if (item.type === 'month') {
                    return item;
                }
                return {
                    ...item,
                    row: item.row.map(block => ({
                        ...block,
                        actualImageSize: finalImageSize
                    }))
                };
            });
        }

        const initiallyVisibleIndexes = new Set<number>();
        const viewportHeight = scroller.offsetHeight;
        const buffer = 400;
        let cumulativeHeight = 0;
        for (let i = 0; i < rowsToSet.length; i++) {
            if (cumulativeHeight < viewportHeight + buffer) {
                initiallyVisibleIndexes.add(i);
                cumulativeHeight += rowsToSet[i].rowHeight;
            } else {
                break;
            }
        }

        this._rows = rowsToSet;
        this._visibleRowIndexes = initiallyVisibleIndexes;
    }

    /**
     * Called after the component is first rendered.
     * Sets up resize and intersection observers for responsive layout and lazy loading.
     */
    firstUpdated() {
        this.#resizeObserver = new ResizeObserver(() => {
            clearTimeout(this.#resizeDebounceTimer);
            this.#resizeDebounceTimer = window.setTimeout(() => this._calculateLayout(), 200);
        });
        const scroller = this.shadowRoot?.querySelector('vi-scroller') as HTMLElement;
        if (scroller) {
            this.#resizeObserver.observe(scroller);

            this.#intersectionObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const lazyImage = entry.target as QueryGridGalleryLazyImage;
                        lazyImage.loadImage();
                        observer.unobserve(lazyImage);
                    }
                });
            }, {
                root: scroller,
                rootMargin: "200px 0px 200px 0px" // Pre-load images 200px before and after they enter the viewport
            });
            
            this.#rowIntersectionObserver = new IntersectionObserver((entries, observer) => {
                const newVisibleIndexes = new Set(this._visibleRowIndexes);
                let changed = false;
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const el = entry.target as HTMLElement;
                        const index = parseInt(el.dataset.index, 10);
                        if (!isNaN(index) && !newVisibleIndexes.has(index)) {
                            newVisibleIndexes.add(index);
                            changed = true;
                        }
                        observer.unobserve(el);
                    }
                });
                
                if (changed) {
                    this._visibleRowIndexes = newVisibleIndexes;
                }
            }, {
                root: scroller,
                rootMargin: "400px 0px 400px 0px" // Pre-load rows further out to ensure smooth scrolling
            });
        }
        window.addEventListener('keydown', this._handleKeyDown);
        this._calculateLayout();
    }
    
    /**
     * Called when the component is disconnected from the DOM.
     * Cleans up observers.
     */
    disconnectedCallback() {
        super.disconnectedCallback();
        this.#resizeObserver?.disconnect();
        this.#intersectionObserver?.disconnect();
        this.#rowIntersectionObserver?.disconnect();
        window.removeEventListener('keydown', this._handleKeyDown);
        clearTimeout(this.#resizeDebounceTimer);
    }

    private _handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            if (this._viewerActive) {
                this._closeImageViewer();
            } else if (this._selectionMode) {
                this._clearSelection();
            }
        }
    };

    private _renderRow = (item: MonthHeaderRowItem | GalleryRowItem, index: number) => {
        const isVisible = this._visibleRowIndexes.has(index);
        const style = `min-height: ${item.rowHeight}px;`; // Apply min-height for placeholder effect

        if (!isVisible) {
            // Render a placeholder if the row is not yet marked as visible
            return html`<div class="row-placeholder" data-index=${index} style=${style}></div>`;
        }

        return this._renderRowContent(item); // Actual row content rendering
    };

    /**
     * Called when component properties are updated.
     * Recalculates layout and ensures lazy images and virtual rows are observed for loading.
     */
    updated(changedProps: Map<string, any>) {
        super.updated?.(changedProps);
        if (changedProps.has('_items') || changedProps.has('size')) {
            if (changedProps.has('_items')) {
                const scroller = this.shadowRoot?.querySelector('vi-scroller') as Scroller;
                if (scroller)
                    scroller.verticalScrollOffset = 0;
            }

            Promise.resolve().then(() => this._calculateLayout());
        }

        if (this.#rowIntersectionObserver) {
            const placeholders = this.shadowRoot?.querySelectorAll('.row-placeholder');
            placeholders?.forEach(p => this.#rowIntersectionObserver.observe(p));
        }

        if (this.#intersectionObserver) {
            const lazyImages = this.shadowRoot?.querySelectorAll('vi-query-grid-gallery-lazy-image');
            lazyImages?.forEach(img => this.#intersectionObserver.observe(img));
        }
    }

    private _openImageViewer(photoToOpen: any) {
        if (!this._items || this._items.length === 0) return;

        const index = this._items.findIndex(item => item === photoToOpen);
        if (index !== -1) {
            this._viewerCurrentIndex = index;
            this._viewerActive = true;
        }
    }

    private _closeImageViewer = () => { this._viewerActive = false; this._viewerCurrentIndex = null; }
    private _handleViewerNext = () => { if (this._viewerCurrentIndex < this._items.length - 1) this._viewerCurrentIndex++; }
    private _handleViewerPrevious = () => { if (this._viewerCurrentIndex > 0) this._viewerCurrentIndex--; }

    private _toggleSelection(item: Vidyano.QueryResultItem, event?: MouseEvent) {
        if (!this.query || !this._items) return;
        const itemIndexInQuery = this._items.indexOf(item);
        if (itemIndexInQuery === -1) return;

        if (event?.shiftKey && this.#lastSelectedIndex !== null && this.#lastSelectedIndex >= 0 && this.#lastSelectedIndex < this._items.length) {
            const anchorIndex = this.#lastSelectedIndex;
            const currentIndex = itemIndexInQuery;

            const start = Math.min(anchorIndex, currentIndex);
            const end = Math.max(anchorIndex, currentIndex);

            // query.selectRange selects items from start up to and including end
            this.query.selectRange(start, end);
            // The anchor (_lastSelectedIndex) does not change on a shift-click.
        } else {
            // Directly toggle isSelected; QueryResultItem will notify the Query,
            // which then updates its selectedItems and notifies listeners.
            item.isSelected = !item.isSelected;
            // Update _lastSelectedIndex to the current item for non-shift clicks or initial clicks.
            this.#lastSelectedIndex = itemIndexInQuery;
        }

        // Sync local component state from the query's authoritative selection state
        // Ensure query.selectedItems is not null before creating a Set
        this._selectedItems = new Set(this.query.selectedItems || []);
        this._selectionMode = this._selectedItems.size > 0;
        this.classList.toggle('selection-mode', this._selectionMode);
    }

    private _clearSelection() {
        if (this.query) {
            // Use the setter for query.selectedItems, which handles unselecting all items
            // and notifying listeners.
            this.query.selectedItems = [];
        }

        // Sync local component state
        this._selectedItems = new Set();
        this._selectionMode = false;
        this.#lastSelectedIndex = null;
        this.classList.remove('selection-mode');
    }

    private _handlePhotoClick(item: any, e: MouseEvent) {
        if (this._selectionMode) {
            this._toggleSelection(item, e);
        } else {
            this._openImageViewer(item);
        }
    }

    private _handleCheckboxClick(item: any, e: MouseEvent) {
        e.stopPropagation();
        this._toggleSelection(item, e);
    }


    private _renderRowContent(item: MonthHeaderRowItem | GalleryRowItem) {
        // Generate month headers
        if (item.type === 'month') {
            const monthName = Vidyano.CultureInfo.currentCulture.dateFormat.monthNames[item.month];
            return html`<div class="month-header${item.isFirst ? ' first-month' : ''}">${monthName} ${item.year}</div>`;
        }

        // Generate gallery rows
        return html`
            <div class="gallery-row">
                ${item.row.map(block => html`
                    <div class="day-block">
                        ${block.needsHeader !== false ? html`<div class="day-block-header">${String.format(`{0:${Vidyano.CultureInfo.currentCulture.dateFormat.shortDatePattern}}`, block.date)}</div>` : ''}
                        <div class="photos-container">
                            ${block.photos.map((item: Vidyano.QueryResultItem) => html`
                                <div class="gallery-photo${this._selectedItems.has(item) ? ' selected' : ''}" style="width: ${block.actualImageSize}px; height: ${block.actualImageSize}px;"
                                     @click=${(e: MouseEvent) => this._handlePhotoClick(item, e)} role="button" tabindex="0" aria-label="${item.values[this._map.label]}">
                                    <input type="checkbox" class="selection-checkbox" .checked=${this._selectedItems.has(item)} @click=${(e: MouseEvent) => this._handleCheckboxClick(item, e)}>
                                    <vi-query-grid-gallery-lazy-image .src=${item.values[this._map.thumbnail]} alt="${item.values[this._map.label]}"></vi-query-grid-gallery-lazy-image>
                                </div>
                            `)}
                        </div>
                    </div>
                `)}
            </div>
        `;
    }

    /**
     * Renders the gallery, including month headers, day blocks, and lazy-loaded images.
     */
    render() {
        return html`
            <vi-scroller>
                <div class="gallery-container" style="padding-bottom: ${this._rows.length > 0 ? '16px' : '0'}">
                    ${this._rows.map((item, index) => this._renderRow(item, index))}
                </div>
            </vi-scroller>

            <vi-query-grid-gallery-image-viewer
                .items=${this._items}
                .map=${this._map}
                .currentIndex=${this._viewerCurrentIndex}
                ?open=${this._viewerActive}
                @close=${this._closeImageViewer}
                @navigate-previous=${this._handleViewerPrevious}
                @navigate-next=${this._handleViewerNext}
            ></vi-query-grid-gallery-image-viewer>
        `;
    }
}

customElements.define("vi-query-grid-gallery", QueryGridGallery);