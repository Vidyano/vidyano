import { property, state } from "lit/decorators.js";
import { WebComponent, observer, listener } from "components/web-component/web-component";
import { html, unsafeCSS } from "lit";
import styles from "./sortable.css";

const _groups: Sortable[] = [];

/** Details provided in the drag-end event */
export interface ISortableDragEndDetails {
    /** The dragged element */
    element: HTMLElement;
    /** The element's new index position */
    newIndex: number;
    /** The element's original index position */
    oldIndex: number;
}

/** Internal state tracking during drag operations */
interface DragState {
    /** The element currently being dragged */
    draggedElement: HTMLElement;
    /** The original index of the dragged element */
    originalIndex: number;
    /** The sortable container where the drag originated */
    sourceContainer: Sortable;
    /** The last valid drop target during the drag operation */
    lastDropTarget: HTMLElement | null;
    /** The nearest scrollable parent element */
    scrollableParent: HTMLElement | null;
}

export class Sortable extends WebComponent {
    static styles = unsafeCSS(styles);

    #dragState: DragState | null = null;
    #dragStartHandler: EventListener;
    #dragEndHandler: EventListener;
    #mouseDownHandler: EventListener;
    #itemsWithListeners: Set<HTMLElement> = new Set();
    #debounceTimer: number | null = null;
    #autoScrollFrame: number | null = null;
    #documentDragOverHandler: ((e: DragEvent) => void) | null = null;
    #currentScrollDirection: 'up' | 'down' | null = null;
    #isRegisteredInGroup: boolean = false;

    /** Group name for synchronized drag-and-drop across multiple sortable containers */
    @property({ type: String, reflect: true })
    @observer(function(this: Sortable) {
        if (!this.isConnected)
            return;

        this.#unregisterFromGroup();
        this.#registerInGroup();
    })
    group: string;

    /** CSS selector for elements that should not be draggable */
    @property({ type: String, reflect: true })
    filter: string;

    /** CSS selector for elements that should be draggable. If not specified, all slotted elements are draggable */
    @property({ type: String, reflect: true })
    draggableItems: string;

    /** CSS selector for the drag handle. When specified, dragging is only enabled when the handle is clicked */
    @property({ type: String, reflect: true })
    handle: string;

    /**
     * Controls whether drag-and-drop functionality is enabled
     * @default true
     */
    @property({ type: Boolean, reflect: true })
    enabled: boolean = true;

    /**
     * Indicates whether this sortable container is currently being dragged
     * @default false
     */
    @state()
    isDragging: boolean = false;

    /**
     * Indicates whether any sortable container in the same group is being dragged
     * @default false
     */
    @state()
    isGroupDragging: boolean = false;

    constructor() {
        super();
        this.#dragStartHandler = this.#onDragStart.bind(this);
        this.#dragEndHandler = this.#onDragEnd.bind(this);
        this.#mouseDownHandler = this.#onMouseDown.bind(this);
    }

    render() {
        return html`<slot @slotchange=${this._onSlotChange}></slot>`;
    }

    connectedCallback() {
        super.connectedCallback();
        this.#registerInGroup();
    }

    disconnectedCallback() {
        this.#unregisterFromGroup();

        if (this.#debounceTimer) {
            window.clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }

        this.#teardownDragAndDrop();
        super.disconnectedCallback();
    }

    firstUpdated(changedProperties: Map<PropertyKey, unknown>) {
        super.firstUpdated(changedProperties);

        const slot = this.shadowRoot?.querySelector('slot');
        if (slot?.assignedElements().length)
            this.#setupDragAndDrop();
    }

    /**
     * Handles slot content changes and reinitializes drag-and-drop functionality.
     */
    protected _onSlotChange() {
        if (this.#debounceTimer)
            window.clearTimeout(this.#debounceTimer);

        this.#debounceTimer = window.setTimeout(() => {
            this.#teardownDragAndDrop();
            this.#setupDragAndDrop();
            this.#debounceTimer = null;
        }, 50);
    }

    /**
     * Handles drag start operations and emits the drag-start event.
     */
    protected _dragStart() {
        this.dispatchEvent(new CustomEvent("drag-start", {
            bubbles: true,
            composed: true
        }));
    }

    /**
     * Handles drag end operations and emits the drag-end event.
     */
    protected _dragEnd(element: HTMLElement, newIndex: number, oldIndex: number) {
        this.dispatchEvent(new CustomEvent("drag-end", {
            detail: {
                element: element,
                newIndex: newIndex,
                oldIndex: oldIndex
            },
            bubbles: true,
            composed: true
        }));
    }

    /**
     * Reinitializes drag-and-drop when observed properties change.
     */
    @observer("filter", "draggableItems", "handle", "enabled")
    private _reinitializeDragAndDrop() {
        if (!this.shadowRoot)
            return;

        this.#teardownDragAndDrop();
        this.#setupDragAndDrop();
    }

    /**
     * Registers this sortable in the _groups array if it has a group and isn't already registered
     */
    #registerInGroup() {
        if (this.group && !this.#isRegisteredInGroup) {
            _groups.push(this);
            this.#isRegisteredInGroup = true;
        }
    }

    /**
     * Unregisters this sortable from the _groups array if it's currently registered
     */
    #unregisterFromGroup() {
        if (this.#isRegisteredInGroup) {
            _groups.remove(this);
            this.#isRegisteredInGroup = false;
        }
    }

    /**
     * Sets up drag-and-drop event listeners on draggable elements.
     */
    #setupDragAndDrop() {
        if (!this.enabled)
            return;

        const items = this.#getDraggableElements();
        items.forEach(item => {
            item.setAttribute("draggable", this.handle ? "false" : "true");
            item.addEventListener("dragstart", this.#dragStartHandler);
            item.addEventListener("dragend", this.#dragEndHandler);
            this.#itemsWithListeners.add(item);
        });

        if (this.handle)
            this.addEventListener("mousedown", this.#mouseDownHandler, true);
    }

    /**
     * Removes drag-and-drop event listeners from all elements.
     */
    #teardownDragAndDrop() {
        this.#itemsWithListeners.forEach(item => {
            item.removeAttribute("draggable");
            item.removeEventListener("dragstart", this.#dragStartHandler);
            item.removeEventListener("dragend", this.#dragEndHandler);
        });
        this.#itemsWithListeners.clear();

        if (this.handle)
            this.removeEventListener("mousedown", this.#mouseDownHandler, true);
    }

    /**
     * Gets all draggable elements from the slot, filtered by configuration.
     */
    #getDraggableElements(): HTMLElement[] {
        // Get slotted elements from the shadow DOM slot
        const slot = this.shadowRoot?.querySelector('slot');
        if (!slot)
            return [];

        const assignedElements = slot.assignedElements();

        let elements: HTMLElement[];

        if (this.draggableItems) {
            // If draggableItems selector is specified, check both:
            // 1. The slotted elements themselves if they match
            // 2. Children within the slotted elements
            const matchedElements = assignedElements.filter(el => el.matches(this.draggableItems)) as HTMLElement[];
            const childElements = assignedElements
                .flatMap(el => Array.from(el.querySelectorAll(this.draggableItems))) as HTMLElement[];
            elements = [...matchedElements, ...childElements];
        } else {
            // Otherwise get all direct slotted elements
            elements = assignedElements as HTMLElement[];
        }

        // Filter out Polymer template helpers and elements with no size
        const validElements = elements.filter(el => {
            // Exclude Polymer template helpers (dom-repeat, dom-if, etc.)
            const tagName = el.tagName.toLowerCase();
            if (tagName === 'dom-repeat' || tagName === 'dom-if' || tagName === 'template')
                return false;

            // Exclude elements with no size (hidden, display:none, etc.)
            if (el.offsetHeight === 0 && el.offsetWidth === 0)
                return false;

            return true;
        });

        // Filter out elements that match the filter selector
        if (this.filter)
            return validElements.filter(el => !el.matches(this.filter));

        return validElements;
    }

    /**
     * Handles mousedown events to enable dragging when a handle is clicked.
     */
    #onMouseDown(e: MouseEvent) {
        if (!this.handle)
            return;

        // Check if any element in the composed path (including shadow DOM) matches the handle selector
        const composedPath = e.composedPath() as HTMLElement[];

        const handleFound = composedPath.some(el => {
            if (!el || el.nodeType !== Node.ELEMENT_NODE || typeof el.matches !== 'function')
                return false;

            // Check if element matches the handle selector
            if (el.matches(this.handle))
                return true;

            // Also check by class name (for .reorder -> reorder)
            if (this.handle.startsWith('.')) {
                const className = this.handle.substring(1);

                if (el.classList && el.classList.contains(className))
                    return true;

                // Check part attribute (for shadow parts like part="reorder")
                const part = el.getAttribute?.('part');
                if (part && part.split(' ').includes(className))
                    return true;
            }

            return false;
        });

        // Find the draggable item (the item containing the handle)
        const items = this.#getDraggableElements();
        const draggableItem = composedPath.find(el => {
            if (!el || el.nodeType !== Node.ELEMENT_NODE)
                return false;

            return items.includes(el as HTMLElement);
        }) as HTMLElement | undefined;

        // Enable/disable dragging based on whether handle was clicked
        items.forEach(item => {
            if (handleFound && item === draggableItem)
                item.setAttribute("draggable", "true");
            else
                item.setAttribute("draggable", "false");
        });
    }

    /**
     * Handles the dragstart event to initialize the drag operation.
     */
    #onDragStart(e: DragEvent) {
        const target = e.target as HTMLElement;

        // Check if the element should be filtered
        if (this.filter && target.matches(this.filter)) {
            e.preventDefault();
            return;
        }

        const items = this.#getDraggableElements();
        const originalIndex = items.indexOf(target);

        // Find the scrollable parent once at drag start
        const scrollableParent = this.#findScrollableParent(this);

        this.#dragState = {
            draggedElement: target,
            originalIndex: originalIndex,
            sourceContainer: this,
            lastDropTarget: null,
            scrollableParent: scrollableParent
        };

        // Add document-level dragover listener for auto-scrolling even when cursor is outside component
        this.#documentDragOverHandler = (e: DragEvent) => {
            // Just handle auto-scroll, don't touch preventDefault or dropEffect
            // Let the component's own dragover handler manage the cursor
            this.#handleAutoScroll(e);
        };
        document.addEventListener("dragover", this.#documentDragOverHandler);

        // Set dragging state
        this.isDragging = true;
        if (this.group)
            _groups.filter(s => s.group === this.group).forEach(s => s.isGroupDragging = true);

        // Add dragging class
        this.classList.add('dragging');

        // Add sortable-dragging class to all items to disable pointer-events on handles
        items.forEach(item => {
            item.classList.add('sortable-dragging');
        });

        // Reduce opacity during drag
        requestAnimationFrame(() => {
            target.style.opacity = "0.4";
        });

        this._dragStart();

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/html", target.innerHTML);
        }
    }

    /**
     * Handles the dragend event to finalize the drag operation.
     */
    #onDragEnd(e: DragEvent) {
        const target = e.target as HTMLElement;

        if (!this.#dragState)
            return;

        // Stop auto-scrolling
        this.#stopAutoScroll();

        // Remove document-level dragover listener
        if (this.#documentDragOverHandler) {
            document.removeEventListener("dragover", this.#documentDragOverHandler);
            this.#documentDragOverHandler = null;
        }

        // Restore opacity
        target.style.opacity = "";

        // Remove dragging class
        this.classList.remove('dragging');

        // Get final position
        const items = this.#getDraggableElements();
        const newIndex = items.indexOf(target);

        // Remove sortable-dragging class from all items
        items.forEach(item => {
            item.classList.remove('sortable-dragging');
        });

        // Reset draggable attribute if handle is specified
        if (this.handle)
            items.forEach(item => item.setAttribute("draggable", "false"));

        // Set dragging state
        this.isDragging = false;
        if (this.group)
            _groups.filter(s => s.group === this.group).forEach(s => s.isGroupDragging = false);

        // Dispatch drag-end event (always)
        this._dragEnd(target, newIndex, this.#dragState.originalIndex);

        this.#dragState = null;
    }

    /**
     * Handles the dragover event to update element positions during drag.
     */
    @listener("dragover")
    protected _onDragOver(e: DragEvent) {
        if (!this.#dragState)
            return;

        e.preventDefault();

        if (e.dataTransfer)
            e.dataTransfer.dropEffect = "move";

        // Handle auto-scrolling
        this.#handleAutoScroll(e);

        const target = this.#getDropTarget(e);
        if (!target || target === this.#dragState.draggedElement)
            return;

        // Check if we can drop in this container
        if (this.group && this.#dragState.sourceContainer.group !== this.group)
            return;

        // Determine if we should insert before or after
        const rect = target.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midpoint;

        // Determine the actual insertion point
        const insertionPoint = insertBefore ? target : target.nextSibling;

        // Only move if the insertion point has changed
        if (this.#dragState.lastDropTarget === insertionPoint)
            return;

        this.#dragState.lastDropTarget = insertionPoint as HTMLElement | null;

        const draggedElement = this.#dragState.draggedElement;
        const parent = target.parentNode;

        if (!parent)
            return;

        // Move the element in the DOM
        if (insertBefore) {
            parent.insertBefore(draggedElement, target);
        } else {
            if (target.nextSibling)
                parent.insertBefore(draggedElement, target.nextSibling);
            else
                parent.appendChild(draggedElement);
        }
    }

    /**
     * Handles the dragenter event to indicate a valid drop zone.
     */
    @listener("dragenter")
    protected _onDragEnter(e: DragEvent) {
        if (!this.#dragState)
            return;

        e.preventDefault();

        if (e.dataTransfer)
            e.dataTransfer.dropEffect = "move";

    }

    /**
     * Handles the dragleave event when dragging leaves the sortable container.
     */
    @listener("dragleave")
    protected _onDragLeave(_e: DragEvent) {
    }

    /**
     * Handles the drop event to complete the drag operation.
     */
    @listener("drop")
    protected _onDrop(e: DragEvent) {
        if (!this.#dragState)
            return;

        e.preventDefault();
        e.stopPropagation();

        // Stop auto-scrolling
        this.#stopAutoScroll();

        // Remove document-level dragover listener
        if (this.#documentDragOverHandler) {
            document.removeEventListener("dragover", this.#documentDragOverHandler);
            this.#documentDragOverHandler = null;
        }

        // Element is already in correct position from dragover
    }

    /**
     * Handles automatic scrolling when dragging near the edges of a scrollable container.
     */
    #handleAutoScroll(e: DragEvent) {
        if (!this.#dragState || !this.#dragState.scrollableParent)
            return;

        const scrollableParent = this.#dragState.scrollableParent;
        const scrollableRect = scrollableParent.getBoundingClientRect();
        const scrollZone = 50; // pixels from edge to trigger scrolling
        const scrollSpeed = 10; // pixels per scroll

        // Calculate distance from scrollable parent edges
        const distanceFromTop = e.clientY - scrollableRect.top;
        const distanceFromBottom = scrollableRect.bottom - e.clientY;

        let newDirection: 'up' | 'down' | null = null;

        // Determine scroll direction
        if (distanceFromTop < scrollZone && scrollableParent.scrollTop > 0)
            newDirection = 'up';
        else if (distanceFromBottom < scrollZone && scrollableParent.scrollTop < scrollableParent.scrollHeight - scrollableParent.clientHeight)
            newDirection = 'down';

        // Only restart animation if direction changed
        if (newDirection !== this.#currentScrollDirection) {
            // Stop existing animation
            if (this.#autoScrollFrame) {
                cancelAnimationFrame(this.#autoScrollFrame);
                this.#autoScrollFrame = null;
            }

            this.#currentScrollDirection = newDirection;

            // Start new animation if needed
            if (newDirection) {
                const scroll = () => {
                    if (!this.#currentScrollDirection)
                        return;

                    if (this.#currentScrollDirection === 'up' && scrollableParent.scrollTop > 0) {
                        scrollableParent.scrollTop -= scrollSpeed;
                    }
                    else if (this.#currentScrollDirection === 'down' && scrollableParent.scrollTop < scrollableParent.scrollHeight - scrollableParent.clientHeight) {
                        scrollableParent.scrollTop += scrollSpeed;
                    }

                    this.#autoScrollFrame = requestAnimationFrame(scroll);
                };

                this.#autoScrollFrame = requestAnimationFrame(scroll);
            }
        }
    }

    /**
     * Stops the automatic scrolling animation.
     */
    #stopAutoScroll() {
        if (this.#autoScrollFrame) {
            cancelAnimationFrame(this.#autoScrollFrame);
            this.#autoScrollFrame = null;
        }

        this.#currentScrollDirection = null;
    }

    /**
     * Finds the nearest scrollable parent element.
     */
    #findScrollableParent(element: HTMLElement): HTMLElement | null {
        return this.findParent<HTMLElement>((node: Node) => {
            if (!node || node.nodeType !== Node.ELEMENT_NODE)
                return false;

            const el = node as HTMLElement;

            // Don't go past body
            if (el === document.body)
                return false;

            // Check if the element is scrollable
            const style = window.getComputedStyle(el);
            const overflow = style.overflow;
            const overflowY = style.overflowY;
            const isScrollable = (overflow === 'auto' || overflow === 'scroll' || overflowY === 'auto' || overflowY === 'scroll');
            const hasScrollableContent = el.scrollHeight > el.clientHeight;

            return isScrollable && hasScrollableContent;
        }, { parent: element, followSlots: true });
    }

    /**
     * Gets the drop target element at the current drag position.
     */
    #getDropTarget(e: DragEvent): HTMLElement | null {
        const items = this.#getDraggableElements();
        const point = { x: e.clientX, y: e.clientY };

        for (const item of items) {
            if (item === this.#dragState?.draggedElement)
                continue;

            const rect = item.getBoundingClientRect();
            if (point.x >= rect.left && point.x <= rect.right &&
                point.y >= rect.top && point.y <= rect.bottom) {
                return item;
            }
        }

        return null;
    }
}

customElements.define("vi-sortable", Sortable);
