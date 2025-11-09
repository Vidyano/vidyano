import { property, state } from "lit/decorators.js";
import { WebComponent, observer } from "components/web-component/web-component";
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
    /** The nearest scrollable parent element */
    scrollableParent: HTMLElement | null;
    /** Cached draggable elements to avoid repeated DOM queries during drag */
    cachedDraggableElements: HTMLElement[];
    /** The pointer ID for this drag operation */
    pointerId: number;
    /** Initial pointer position */
    startX: number;
    startY: number;
    /** Current pointer position */
    currentX: number;
    currentY: number;
}

export class Sortable extends WebComponent {
    static styles = unsafeCSS(styles);

    #dragState: DragState | null = null;
    #pointerDownHandler: EventListener;
    #pointerMoveHandler: EventListener;
    #pointerUpHandler: EventListener;
    #pointerCancelHandler: EventListener;
    #debounceTimer: number | null = null;
    #autoScrollFrame: number | null = null;
    #currentScrollDirection: 'up' | 'down' | null = null;
    #isRegisteredInGroup: boolean = false;
    #dragDelayTimeout: number | null = null;
    #pendingDragState: { element: HTMLElement; event: PointerEvent; items: HTMLElement[] } | null = null;

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

    /** Delay in milliseconds before drag mode activates. If not set or 0, dragging activates immediately */
    @property({ type: Number, reflect: true })
    dragDelay: number;

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
        this.#pointerDownHandler = this.#onPointerDown.bind(this);
        this.#pointerMoveHandler = this.#onPointerMove.bind(this);
        this.#pointerUpHandler = this.#onPointerUp.bind(this);
        this.#pointerCancelHandler = this.#onPointerCancel.bind(this);
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

        if (this.#dragDelayTimeout) {
            window.clearTimeout(this.#dragDelayTimeout);
            this.#dragDelayTimeout = null;
            this.#pendingDragState = null;
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
    @observer("filter", "draggableItems", "handle", "enabled", { allowUndefined: true })
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

        this.addEventListener("pointerdown", this.#pointerDownHandler, { capture: true });
        this.addEventListener("pointermove", this.#pointerMoveHandler, { capture: true });
        this.addEventListener("pointerup", this.#pointerUpHandler, { capture: true });
        this.addEventListener("pointercancel", this.#pointerCancelHandler, { capture: true });
    }

    /**
     * Removes drag-and-drop event listeners from all elements.
     */
    #teardownDragAndDrop() {
        this.removeEventListener("pointerdown", this.#pointerDownHandler, { capture: true });
        this.removeEventListener("pointermove", this.#pointerMoveHandler, { capture: true });
        this.removeEventListener("pointerup", this.#pointerUpHandler, { capture: true });
        this.removeEventListener("pointercancel", this.#pointerCancelHandler, { capture: true });
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
     * Checks if a handle element was clicked in the event path.
     * Returns true if a handle was clicked, false otherwise.
     */
    #checkHandleClick(composedPath: EventTarget[]): boolean {
        if (!this.handle)
            return true;

        return composedPath.some(el => {
            if (!el || (el as Node).nodeType !== Node.ELEMENT_NODE || typeof (el as HTMLElement).matches !== 'function')
                return false;

            const element = el as HTMLElement;

            // Check if element matches the handle selector
            if (element.matches(this.handle))
                return true;

            // Also check by class name (for .reorder -> reorder)
            if (this.handle.startsWith('.')) {
                const className = this.handle.substring(1);

                if (element.classList && element.classList.contains(className))
                    return true;

                // Check part attribute (for shadow parts like part="reorder")
                const part = element.getAttribute?.('part');
                if (part && part.split(' ').includes(className))
                    return true;
            }

            return false;
        });
    }

    /**
     * Activates drag mode after delay (if configured) has elapsed.
     */
    #activateDragMode(draggableElement: HTMLElement, items: HTMLElement[], e: PointerEvent) {
        const originalIndex = items.indexOf(draggableElement);

        // Capture the pointer on sortable to receive all events even if pointer moves outside
        this.setPointerCapture(e.pointerId);

        // Find the scrollable parent once at drag start
        const scrollableParent = this.#findScrollableParent(this);

        this.#dragState = {
            draggedElement: draggableElement,
            originalIndex: originalIndex,
            sourceContainer: this,
            scrollableParent: scrollableParent,
            cachedDraggableElements: items,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY
        };

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
            draggableElement.style.opacity = "0.4";
        });

        this._dragStart();

        // Clear pending state
        this.#pendingDragState = null;
        this.#dragDelayTimeout = null;
    }

    /**
     * Handles the pointerdown event to initialize the drag operation.
     */
    #onPointerDown(e: PointerEvent) {
        e.stopPropagation();
        e.stopImmediatePropagation();

        const target = e.target as HTMLElement;

        // Only handle primary button (left mouse button or touch)
        if (e.button !== 0)
            return;

        const items = this.#getDraggableElements();

        // Find the actual draggable item (might be the target or a parent)
        let draggableElement: HTMLElement | undefined = target;
        if (!items.includes(draggableElement)) {
            draggableElement = items.find(item => item.contains(target));
            if (!draggableElement)
                return;
        }

        // Check if the element should be filtered
        if (this.filter && draggableElement.matches(this.filter))
            return;

        // Check if handle is required and was clicked
        if (this.handle) {
            const composedPath = e.composedPath();
            if (!this.#checkHandleClick(composedPath))
                return;
        }

        // If dragDelay is configured, wait before activating drag mode
        if (this.dragDelay && this.dragDelay > 0) {
            // Store pending drag state
            this.#pendingDragState = {
                element: draggableElement,
                event: e,
                items: items
            };

            // Set timeout to activate drag mode after delay
            this.#dragDelayTimeout = window.setTimeout(() => {
                if (this.#pendingDragState) {
                    this.#activateDragMode(
                        this.#pendingDragState.element,
                        this.#pendingDragState.items,
                        this.#pendingDragState.event
                    );
                }
            }, this.dragDelay);
        } else {
            // No delay configured - activate drag mode immediately
            this.#activateDragMode(draggableElement, items, e);
        }
    }

    /**
     * Handles the pointermove event during drag operation.
     */
    #onPointerMove(e: PointerEvent) {
        // Do nothing if we're in pending state (waiting for delay to complete)
        if (this.#pendingDragState)
            return;

        e.stopPropagation();
        e.stopImmediatePropagation();

        if (!this.#dragState || e.pointerId !== this.#dragState.pointerId)
            return;

        // Update current position
        this.#dragState.currentX = e.clientX;
        this.#dragState.currentY = e.clientY;

        // Handle auto-scrolling
        this.#handleAutoScroll(e);

        const target = this.#getDropTarget(e);
        if (!target || target === this.#dragState.draggedElement)
            return;

        // Check if we can drop in this container - find which sortable container contains the target
        const targetSortable = _groups.find(s => {
            const items = s.#getDraggableElements();
            return items.includes(target);
        }) || this;

        if (this.group && this.#dragState?.sourceContainer.group !== targetSortable.group)
            return;

        const draggedElement = this.#dragState.draggedElement;

        // Get items from the target container to compare indices
        const items = targetSortable.#getDraggableElements();
        const draggedIndex = items.indexOf(draggedElement);
        const targetIndex = items.indexOf(target);

        // Determine insertion position based on index comparison
        // If dragging forward (down the list), insert after target to leap over it
        // If dragging backward (up the list), insert before target to take its spot
        const insertBefore = draggedIndex > targetIndex;

        // Only move if we're not already in the correct position
        if (insertBefore && draggedElement.nextSibling === target)
            return;
        else if (!insertBefore && draggedElement.previousSibling === target)
            return;

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
     * Handles the pointerup event to finalize the drag operation.
     */
    #onPointerUp(e: PointerEvent) {
        // Check if we have a pending drag (timeout active but not yet dragging)
        if (this.#pendingDragState && this.#dragDelayTimeout !== null) {
            // Clear the timeout
            window.clearTimeout(this.#dragDelayTimeout);
            this.#dragDelayTimeout = null;
            this.#pendingDragState = null;

            // Allow the event to propagate normally (enables clicks/taps)
            return;
        }

        e.stopPropagation();
        e.stopImmediatePropagation();

        if (!this.#dragState || e.pointerId !== this.#dragState.pointerId)
            return;

        this.#endDrag();
    }

    /**
     * Handles the pointercancel event to cancel the drag operation.
     */
    #onPointerCancel(e: PointerEvent) {
        // Check if we have a pending drag (timeout active but not yet dragging)
        if (this.#pendingDragState && this.#dragDelayTimeout !== null) {
            // Clear the timeout
            window.clearTimeout(this.#dragDelayTimeout);
            this.#dragDelayTimeout = null;
            this.#pendingDragState = null;
            return;
        }

        e.stopPropagation();
        e.stopImmediatePropagation();

        if (!this.#dragState || e.pointerId !== this.#dragState.pointerId)
            return;

        this.#endDrag();
    }

    /**
     * Common logic to end a drag operation.
     */
    #endDrag() {
        if (!this.#dragState)
            return;

        const draggedElement = this.#dragState.draggedElement;

        // Release pointer capture from sortable
        if (this.hasPointerCapture(this.#dragState.pointerId))
            this.releasePointerCapture(this.#dragState.pointerId);

        // Stop auto-scrolling
        this.#stopAutoScroll();

        // Restore opacity
        draggedElement.style.opacity = "";

        // Remove dragging class
        this.classList.remove('dragging');

        // Get final position
        const items = this.#getDraggableElements();
        const newIndex = items.indexOf(draggedElement);

        // Remove sortable-dragging class from all items
        items.forEach(item => {
            item.classList.remove('sortable-dragging');
        });

        // Set dragging state
        this.isDragging = false;
        if (this.group)
            _groups.filter(s => s.group === this.group).forEach(s => s.isGroupDragging = false);

        // Always dispatch drag-end event since we validated the drag was valid at start
        // newIndex may be -1 if element moved to another container or became invalid
        this._dragEnd(draggedElement, newIndex, this.#dragState.originalIndex);

        this.#dragState = null;
    }


    /**
     * Handles automatic scrolling when dragging near the edges of a scrollable container.
     */
    #handleAutoScroll(e: PointerEvent) {
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
     * Uses cached elements if this is the source container, otherwise queries fresh.
     */
    #getDropTarget(e: PointerEvent): HTMLElement | null {
        // Use cached elements if available (source container), otherwise get fresh (cross-container drag)
        const items = this.#dragState?.cachedDraggableElements ?? this.#getDraggableElements();
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
