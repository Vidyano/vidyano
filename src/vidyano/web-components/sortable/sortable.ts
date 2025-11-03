import { property, state } from "lit/decorators.js";
import { WebComponent, observer } from "components/web-component/web-component";
import { html, unsafeCSS } from "lit";
import styles from "./sortable.css";

const _groups: Sortable[] = [];

export interface ISortableDragEndDetails {
    element: HTMLElement;
    newIndex: number;
    oldIndex: number;
}

interface DragState {
    draggedElement: HTMLElement;
    originalIndex: number;
    sourceContainer: Sortable;
    lastDropTarget: HTMLElement | null;
    scrollableParent: HTMLElement | null;
}

export abstract class Sortable extends WebComponent {
    static styles = unsafeCSS(styles);

    #dragState: DragState | null = null;
    #boundHandlers: Map<string, EventListener> = new Map();
    #mutationObserver: MutationObserver | null = null;
    #debounceTimer: number | null = null;
    #autoScrollInterval: number | null = null;
    #documentDragOverHandler: ((e: DragEvent) => void) | null = null;
    #currentScrollDirection: 'up' | 'down' | null = null;

    @property({ type: String, reflect: true })
    @observer(function(this: Sortable, newGroup: string, oldGroup: string) {
        if (oldGroup)
            _groups.remove(this);

        if (newGroup)
            _groups.push(this);
    })
    group: string;

    @property({ type: String, reflect: true })
    filter: string;

    @property({ type: String, reflect: true })
    draggableItems: string;

    @property({ type: String, reflect: true })
    handle: string;

    @property({ type: Boolean, reflect: true })
    enabled: boolean = true;

    @state()
    isDragging: boolean = false;

    @state()
    isGroupDragging: boolean = false;

    render() {
        return html`<slot></slot>`;
    }

    connectedCallback() {
        super.connectedCallback();

        if (this.group)
            _groups.push(this);
    }

    disconnectedCallback() {
        if (this.group)
            _groups.remove(this);

        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }

        if (this.#mutationObserver) {
            this.#mutationObserver.disconnect();
            this.#mutationObserver = null;
        }

        this.#teardownDragAndDrop();
        super.disconnectedCallback();
    }

    firstUpdated(changedProperties: Map<PropertyKey, unknown>) {
        super.firstUpdated(changedProperties);

        // Watch for changes to slotted content
        const slot = this.shadowRoot?.querySelector('slot');
        if (slot) {
            // Setup on slotchange to ensure content is slotted before we initialize
            slot.addEventListener('slotchange', () => {
                if (this.#debounceTimer)
                    clearTimeout(this.#debounceTimer);

                this.#debounceTimer = setTimeout(() => {
                    this.#teardownDragAndDrop();
                    this.#setupDragAndDrop();
                    this.#debounceTimer = null;
                }, 50) as unknown as number;
            });

            // Do initial setup if content is already slotted
            if (slot.assignedElements().length > 0) {
                this.#setupDragAndDrop();
            }
        }
    }

    protected _dragStart() {
        this.dispatchEvent(new CustomEvent("drag-start", {
            bubbles: true,
            composed: true
        }));
    }

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

    @observer("filter", "draggableItems", "handle", "enabled")
    private _reinitializeDragAndDrop() {
        if (!this.shadowRoot)
            return;

        this.#teardownDragAndDrop();
        this.#setupDragAndDrop();
    }

    #setupDragAndDrop() {
        if (!this.enabled) {
            return;
        }

        // Get all potential draggable items
        const items = this.#getDraggableElements();

        items.forEach(item => {
            // When handle is specified, start with draggable="false"
            // We'll enable it dynamically on mousedown if the handle is clicked
            item.setAttribute("draggable", this.handle ? "false" : "true");

            const dragStartHandler = this.#onDragStart.bind(this);
            const dragEndHandler = this.#onDragEnd.bind(this);

            item.addEventListener("dragstart", dragStartHandler);
            item.addEventListener("dragend", dragEndHandler);

            this.#boundHandlers.set(`${item.id || items.indexOf(item)}-dragstart`, dragStartHandler);
            this.#boundHandlers.set(`${item.id || items.indexOf(item)}-dragend`, dragEndHandler);
        });

        // Add mousedown listener when handle is specified
        if (this.handle) {
            const mouseDownHandler = this.#onMouseDown.bind(this);
            this.addEventListener("mousedown", mouseDownHandler, true); // Use capture phase
            this.#boundHandlers.set("mousedown", mouseDownHandler);
        }

        const dragOverHandler = this.#onDragOver.bind(this);
        const dropHandler = this.#onDrop.bind(this);
        const dragEnterHandler = this.#onDragEnter.bind(this);
        const dragLeaveHandler = this.#onDragLeave.bind(this);

        this.addEventListener("dragover", dragOverHandler);
        this.addEventListener("drop", dropHandler);
        this.addEventListener("dragenter", dragEnterHandler);
        this.addEventListener("dragleave", dragLeaveHandler);

        this.#boundHandlers.set("dragover", dragOverHandler);
        this.#boundHandlers.set("drop", dropHandler);
        this.#boundHandlers.set("dragenter", dragEnterHandler);
        this.#boundHandlers.set("dragleave", dragLeaveHandler);
    }

    #teardownDragAndDrop() {
        const items = this.#getDraggableElements();

        items.forEach(item => {
            item.removeAttribute("draggable");

            const dragStartHandler = this.#boundHandlers.get(`${item.id || items.indexOf(item)}-dragstart`);
            const dragEndHandler = this.#boundHandlers.get(`${item.id || items.indexOf(item)}-dragend`);

            if (dragStartHandler)
                item.removeEventListener("dragstart", dragStartHandler as EventListener);
            if (dragEndHandler)
                item.removeEventListener("dragend", dragEndHandler as EventListener);
        });

        const mouseDownHandler = this.#boundHandlers.get("mousedown");
        const dragOverHandler = this.#boundHandlers.get("dragover");
        const dropHandler = this.#boundHandlers.get("drop");
        const dragEnterHandler = this.#boundHandlers.get("dragenter");
        const dragLeaveHandler = this.#boundHandlers.get("dragleave");

        if (mouseDownHandler)
            this.removeEventListener("mousedown", mouseDownHandler as EventListener, true);
        if (dragOverHandler)
            this.removeEventListener("dragover", dragOverHandler as EventListener);
        if (dropHandler)
            this.removeEventListener("drop", dropHandler as EventListener);
        if (dragEnterHandler)
            this.removeEventListener("dragenter", dragEnterHandler as EventListener);
        if (dragLeaveHandler)
            this.removeEventListener("dragleave", dragLeaveHandler as EventListener);

        this.#boundHandlers.clear();
    }

    #getDraggableElements(): HTMLElement[] {
        // Get slotted elements from the shadow DOM slot
        const slot = this.shadowRoot?.querySelector('slot');
        if (!slot) {
            return [];
        }

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
            if (tagName === 'dom-repeat' || tagName === 'dom-if' || tagName === 'template') {
                return false;
            }

            // Exclude elements with no size (hidden, display:none, etc.)
            if (el.offsetHeight === 0 && el.offsetWidth === 0) {
                return false;
            }

            return true;
        });

        // Filter out elements that match the filter selector
        if (this.filter) {
            return validElements.filter(el => !el.matches(this.filter));
        }

        return validElements;
    }

    #onMouseDown(e: MouseEvent) {
        if (!this.handle) {
            return;
        }

        // Check if any element in the composed path (including shadow DOM) matches the handle selector
        const composedPath = e.composedPath() as HTMLElement[];

        const handleFound = composedPath.some(el => {
            if (!el || el.nodeType !== Node.ELEMENT_NODE || typeof el.matches !== 'function') {
                return false;
            }

            // Check if element matches the handle selector
            if (el.matches(this.handle)) {
                return true;
            }

            // Also check by class name (for .reorder -> reorder)
            if (this.handle.startsWith('.')) {
                const className = this.handle.substring(1);

                if (el.classList && el.classList.contains(className)) {
                    return true;
                }

                // Check part attribute (for shadow parts like part="reorder")
                const part = el.getAttribute?.('part');
                if (part && part.split(' ').includes(className)) {
                    return true;
                }
            }

            return false;
        });

        // Find the draggable item (the item containing the handle)
        const items = this.#getDraggableElements();
        const draggableItem = composedPath.find(el => {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) {
                return false;
            }
            return items.includes(el as HTMLElement);
        }) as HTMLElement | undefined;

        // Enable/disable dragging based on whether handle was clicked
        items.forEach(item => {
            if (handleFound && item === draggableItem) {
                item.setAttribute("draggable", "true");
            } else {
                item.setAttribute("draggable", "false");
            }
        });
    }

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

        // Temporarily disconnect mutation observer during drag to prevent re-initialization
        if (this.#mutationObserver) {
            this.#mutationObserver.disconnect();
        }

        // Add document-level dragover listener for auto-scrolling even when cursor is outside component
        this.#documentDragOverHandler = (e: DragEvent) => {
            // Just handle auto-scroll, don't touch preventDefault or dropEffect
            // Let the component's own dragover handler manage the cursor
            this.#handleAutoScroll(e);
        };
        document.addEventListener("dragover", this.#documentDragOverHandler);

        // Set dragging state
        this.isDragging = true;
        if (this.group) {
            _groups.filter(s => s.group === this.group).forEach(s => s.isGroupDragging = true);
        }

        // Add dragging class
        this.classList.add('dragging');

        // Add sortable-dragging class to all items to disable pointer-events on handles
        items.forEach(item => {
            item.classList.add('sortable-dragging');
        });

        // Reduce opacity during drag
        setTimeout(() => {
            target.style.opacity = "0.4";
        }, 0);

        this._dragStart();

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/html", target.innerHTML);
        }
    }

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
        if (this.handle) {
            items.forEach(item => {
                item.setAttribute("draggable", "false");
            });
        }

        // Set dragging state
        this.isDragging = false;
        if (this.group) {
            _groups.filter(s => s.group === this.group).forEach(s => s.isGroupDragging = false);
        }

        // Reconnect mutation observer after drag
        if (this.#mutationObserver) {
            this.#mutationObserver.observe(this, {
                childList: true,
                subtree: false
            });
        }

        // Dispatch drag-end event
        if (newIndex !== this.#dragState.originalIndex) {
            this._dragEnd(target, newIndex, this.#dragState.originalIndex);
        }

        this.#dragState = null;
    }

    #onDragOver(e: DragEvent) {
        if (!this.#dragState)
            return;

        e.preventDefault();

        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
        }

        // Handle auto-scrolling
        this.#handleAutoScroll(e);

        const target = this.#getDropTarget(e);
        if (!target || target === this.#dragState.draggedElement)
            return;

        // Check if we can drop in this container
        if (this.group && this.#dragState.sourceContainer.group !== this.group) {
            return;
        }

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
            if (target.nextSibling) {
                parent.insertBefore(draggedElement, target.nextSibling);
            } else {
                parent.appendChild(draggedElement);
            }
        }
    }

    #onDragEnter(e: DragEvent) {
        if (!this.#dragState)
            return;

        e.preventDefault();

        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
        }
    }

    #onDragLeave(_e: DragEvent) {
        // Handle drag leave if needed
    }

    #onDrop(e: DragEvent) {
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
        if (distanceFromTop < scrollZone && scrollableParent.scrollTop > 0) {
            newDirection = 'up';
        }
        else if (distanceFromBottom < scrollZone && scrollableParent.scrollTop < scrollableParent.scrollHeight - scrollableParent.clientHeight) {
            newDirection = 'down';
        }

        // Only restart interval if direction changed
        if (newDirection !== this.#currentScrollDirection) {
            // Stop existing interval
            if (this.#autoScrollInterval) {
                clearInterval(this.#autoScrollInterval);
                this.#autoScrollInterval = null;
            }

            this.#currentScrollDirection = newDirection;

            // Start new interval if needed
            if (newDirection === 'up') {
                this.#autoScrollInterval = setInterval(() => {
                    if (scrollableParent.scrollTop > 0) {
                        scrollableParent.scrollTop -= scrollSpeed;
                    }
                }, 16) as unknown as number; // ~60fps
            }
            else if (newDirection === 'down') {
                this.#autoScrollInterval = setInterval(() => {
                    if (scrollableParent.scrollTop < scrollableParent.scrollHeight - scrollableParent.clientHeight) {
                        scrollableParent.scrollTop += scrollSpeed;
                    }
                }, 16) as unknown as number; // ~60fps
            }
        }
    }

    #stopAutoScroll() {
        if (this.#autoScrollInterval) {
            clearInterval(this.#autoScrollInterval);
            this.#autoScrollInterval = null;
        }
        this.#currentScrollDirection = null;
    }

    #findScrollableParent(element: HTMLElement): HTMLElement | null {
        return this.findParent<HTMLElement>((node: Node) => {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) {
                return false;
            }

            const el = node as HTMLElement;

            // Don't go past body
            if (el.tagName === 'BODY') {
                return false;
            }

            // Check if the element is scrollable
            const style = window.getComputedStyle(el);
            const overflow = style.overflow;
            const overflowY = style.overflowY;
            const isScrollable = (overflow === 'auto' || overflow === 'scroll' || overflowY === 'auto' || overflowY === 'scroll');
            const hasScrollableContent = el.scrollHeight > el.clientHeight;

            return isScrollable && hasScrollableContent;
        }, { parent: element, followSlots: true });
    }

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
