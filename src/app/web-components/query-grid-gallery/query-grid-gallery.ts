import * as Vidyano from "vidyano"
import { html, css } from "lit";
import { WebComponentLit } from "components/web-component/web-component-lit";
import type { QueryGridGalleryLazyImage } from "./query-grid-gallery-lazy-image";
import "./query-grid-gallery-lazy-image";
import "./query-grid-gallery-image-viewer";

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
@WebComponentLit.register({
    properties: {
        query: {
            type: Object
        },
        size: {
            type: Number,
            reflect: true,
            attribute: "size"
        },
        map: {
            type: Object,
            computed: "_computeMap(_map)"
        },
        _map: {
            type: String,
            attribute: "map"
        },
        _rows: {
            state: true
        },
        _visibleRowIndexes: {
            state: true
        },
        _viewerActive: {
            state: true
        },
        _viewerCurrentIndex: {
            state: true
        },
        _selectionMode: {
            state: true
        },
        _selectedItems: {
            state: true
        },
    },
}, "vi-query-grid-gallery")
export class QueryGridGallery extends WebComponentLit {
    static styles = [css`
        :host {
            display: block;
            height: 100%;
        }

        vi-scroller {
            width: 100%;
            height: 100%;
            display: flex;
        }

        .gallery-container {
            display: flex;
            flex-direction: column;
            gap: 12px 24px;
            padding: 16px;
        }

        .month-header {
            font-size: 1.6em;
            font-weight: 500;
            color: var(--vi-foreground-color, #333);
            padding-left: 4px;
            padding-top: 20px;
        }
        .month-header.first-month {
            padding-top: 0;
        }

        .gallery-row {
            display: flex;
            flex-direction: row;
            gap: 16px;
            align-items: flex-start;
        }

        .day-block {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .day-block-header {
            font-weight: bold;
            background-color: #f0f0f0;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 0.9em;
            text-align: left;
            white-space: nowrap;
        }

        .photos-container {
            display: flex;
            flex-direction: row;
            gap: 16px;
        }

        .gallery-photo {
            flex-shrink: 0;
            box-sizing: border-box;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            background: #f9f9f9;
            cursor: pointer;
            transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
            position: relative;
        }

        .gallery-photo:hover {
            transform: scale(1.03);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .gallery-photo.selected {
            outline: 2px solid var(--vi-accent-color, #0078d4);
        }

        .selection-checkbox {
            appearance: none;
            -webkit-appearance: none;
            margin: 0;
            position: absolute;
            top: 8px;
            left: 8px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: none; /* Hidden by default */
            cursor: pointer;
            
            /* Style for the unchecked ring */
            background-color: rgba(255, 255, 255, 0.6);
            border: 2px solid white;
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);

            transition: all 0.2s ease-in-out;
        }

        /* Add a subtle hover effect on the checkbox itself */
        .selection-checkbox:hover {
            transform: scale(1.1);
        }

        .selection-checkbox:checked {
            background-color: var(--vi-accent-color, #0078d4);
            border-color: var(--vi-accent-color, #0078d4);
            
            /* SVG checkmark icon */
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='white'%3e%3cpath d='M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z'/%3e%3c/svg%3e");
            background-size: 70%;
            background-position: center;
            background-repeat: no-repeat;
        }

        :host(.selection-mode) .selection-checkbox,
        .gallery-photo:hover .selection-checkbox {
            display: block;
        }
    `];
    
    private _visibleRowIndexes: Set<number> = new Set();    
    private _viewerActive = false;
    private _viewerCurrentIndex: number | null = null;

    private _intersectionObserver: IntersectionObserver;
    private _rowIntersectionObserver: IntersectionObserver;
    private _resizeObserver: ResizeObserver;
    private _rows: (MonthHeaderRowItem | GalleryRowItem)[] = [];
    private _resizeDebounceTimer: number;
    private _selectedItems: Set<any> = new Set();
    private _selectionMode = false;
    private _lastSelectedIndex: number | null = null;

    map: ImageItemMap;
    query: Vidyano.Query;
    size = 175; // Preferred size (in pixels) for gallery images.

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
        if (!scroller || scroller.offsetWidth === 0 || !this.query?.items?.length || !this.map) {
            this._rows = [];
            this._visibleRowIndexes.clear();
            return;
        }

        const MONTH_HEADER_HEIGHT = 46;
        const MONTH_HEADER_FIRST_HEIGHT = 26;
        const DAY_BLOCK_HEADER_WITH_GAP_HEIGHT = 38;

        const horizontalPadding = 16 * 2;
        const availableWidth = scroller.offsetWidth - horizontalPadding;
        const gap = 16;
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
        const items = this.query.items;

        let performDateGrouping = this.map.date !== null;

        if (performDateGrouping) {
            // If date grouping is requested, check if all items have valid dates.
            // If any item has an invalid/undefined date, disable grouping for the entire gallery.
            for (const item of items) {
                const dateValue = item.values[this.map.date as string];
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

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                currentPhotosInRow.push(item);

                if (currentPhotosInRow.length === estimatedPhotosPerRow || i === items.length - 1) {
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
            for (const item of items) {
                // All items here are guaranteed to have a valid date for this.map.date
                const dateValue = item.values[this.map.date as string] as Date;
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
        this._resizeObserver = new ResizeObserver(() => {
            clearTimeout(this._resizeDebounceTimer);
            this._resizeDebounceTimer = window.setTimeout(() => this._calculateLayout(), 200);
        });
        const scroller = this.shadowRoot?.querySelector('vi-scroller') as HTMLElement;
        if (scroller) {
            this._resizeObserver.observe(scroller);

            this._intersectionObserver = new IntersectionObserver((entries, observer) => {
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
            
            this._rowIntersectionObserver = new IntersectionObserver((entries, observer) => {
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
        this._resizeObserver?.disconnect();
        this._intersectionObserver?.disconnect();
        this._rowIntersectionObserver?.disconnect();
        window.removeEventListener('keydown', this._handleKeyDown);
        clearTimeout(this._resizeDebounceTimer);
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
        if (changedProps.has('items') || changedProps.has('size')) {
            Promise.resolve().then(() => this._calculateLayout());
        }

        if (this._rowIntersectionObserver) {
            const placeholders = this.shadowRoot?.querySelectorAll('.row-placeholder');
            placeholders?.forEach(p => this._rowIntersectionObserver.observe(p));
        }

        if (this._intersectionObserver) {
            const lazyImages = this.shadowRoot?.querySelectorAll('vi-query-grid-gallery-lazy-image');
            lazyImages?.forEach(img => this._intersectionObserver.observe(img));
        }
    }

    private _openImageViewer(photoToOpen: any) {
        if (!this.query.items || this.query.items.length === 0) return;

        const index = this.query.items.findIndex(item => item === photoToOpen);
        if (index !== -1) {
            this._viewerCurrentIndex = index;
            this._viewerActive = true;
        }
    }

    private _closeImageViewer = () => { this._viewerActive = false; this._viewerCurrentIndex = null; }
    private _handleViewerNext = () => { if (this._viewerCurrentIndex < this.query.items.length - 1) this._viewerCurrentIndex++; }
    private _handleViewerPrevious = () => { if (this._viewerCurrentIndex > 0) this._viewerCurrentIndex--; }

    private _toggleSelection(item: any, event?: MouseEvent) {
        const newSelectedItems = new Set(this._selectedItems);
        const index = this.query.items.indexOf(item);

        if (event?.shiftKey && this._lastSelectedIndex !== null && index !== -1) {
            const start = Math.min(this._lastSelectedIndex, index);
            const end = Math.max(this._lastSelectedIndex, index);
            for (let i = start; i <= end; i++) {
                newSelectedItems.add(this.query.items[i]);
            }
        } else {
            if (newSelectedItems.has(item))
                newSelectedItems.delete(item);
            else
                newSelectedItems.add(item);
            this._lastSelectedIndex = index;
        }

        this._selectedItems = newSelectedItems;
        this._selectionMode = this._selectedItems.size > 0;
        this.classList.toggle('selection-mode', this._selectionMode);
    }

    private _clearSelection() {
        this._selectedItems = new Set();
        this._selectionMode = false;
        this._lastSelectedIndex = null;
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
                                     @click=${(e: MouseEvent) => this._handlePhotoClick(item, e)} role="button" tabindex="0" aria-label="${item.values[this.map.label]}">
                                    <input type="checkbox" class="selection-checkbox" .checked=${this._selectedItems.has(item)} @click=${(e: MouseEvent) => this._handleCheckboxClick(item, e)}>
                                    <vi-query-grid-gallery-lazy-image .src=${item.values[this.map.thumbnail]} alt="${item.values[this.map.label]}"></vi-query-grid-gallery-lazy-image>
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
                .items=${this.query?.items}
                .map=${this.map}
                .currentIndex=${this._viewerCurrentIndex}
                ?open=${this._viewerActive}
                @close=${this._closeImageViewer}
                @navigate-previous=${this._handleViewerPrevious}
                @navigate-next=${this._handleViewerNext}
            ></vi-query-grid-gallery-image-viewer>
        `;
    }
}