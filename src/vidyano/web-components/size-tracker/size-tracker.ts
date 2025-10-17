import { property } from "lit/decorators.js";
import { WebComponent, notify } from "components/web-component/web-component.js";

/**
 * Represents the dimensions of an element.
 */
export interface ISize {
    width: number;
    height: number;
}

/**
 * Custom event fired when the tracked element's size changes.
 */
export interface SizeTrackerEvent extends CustomEvent {
    detail: ISize;
}

interface IResizeObserver {
    observe: (target: HTMLElement) => void;
    unobserve: (target: HTMLElement) => void;
}

declare class ResizeObserver implements IResizeObserver {
    constructor(observer: (entries: { target: HTMLElement; contentRect: DOMRectReadOnly }[]) => void);
    observe: (target: HTMLElement) => void;
    unobserve: (target: HTMLElement) => void;
}

const triggerSizeChanged = Symbol('triggerSizeChanged');

let resizeObserver: ResizeObserver;
resizeObserver = new ResizeObserver(entries => {
    entries.forEach(entry => {
        let tracker = <SizeTracker>[...Array.from(entry.target.shadowRoot?.children || []), ...Array.from(entry.target.children || [])].find(child => child instanceof SizeTracker);
        if (tracker)
            tracker[triggerSizeChanged](entry.contentRect);
    });
});

/**
 * A web component that tracks the size of its parent element using ResizeObserver.
 *
 * @fires sizechanged - Fired when the parent element's size changes. Event detail contains ISize.
 * @fires size-changed - Fired for Polymer backward compatibility when the size property changes.
 */
export class SizeTracker extends WebComponent {
    #isActive: boolean;
    #resizeLast: ISize;

    /**
     * When true, prevents automatic size tracking on connect.
     * Call measure() to start tracking manually.
     * @default false
     */
    @property({ type: Boolean, reflect: true })
    deferred: boolean = false;

    /**
     * The current size of the parent element.
     * Updated whenever a size change is detected.
     */
    @property({ type: Object })
    @notify()
    size: ISize;

    /**
     * When true, fires sizechanged events even when width or height is 0.
     * When false, suppresses events when either dimension is 0.
     * @default false
     */
    @property({ type: Boolean, reflect: true })
    triggerZero: boolean = false;

    /**
     * When true, the sizechanged event will bubble up the DOM tree.
     * @default false
     */
    @property({ type: Boolean, reflect: true })
    bubbles: boolean = false;

    connectedCallback() {
        super.connectedCallback();

        this.style.display = "none";

        if (this.deferred)
            return;

        this.measure();
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        if (this.#isActive) {
            resizeObserver.unobserve(this.#parentElement);
            this.#isActive = false;
        }
    }

    #dispatchSizeChanged() {
        this.size = this.#resizeLast;

        // Dispatch component-specific event for size tracking behavior
        // This is the primary event that consumers listen to for resize notifications
        this.dispatchEvent(new CustomEvent("sizechanged", {
            detail: this.#resizeLast,
            bubbles: !!this.bubbles,
            composed: true
        }));
    }

    // Note: size-changed event is now automatically dispatched by @notify decorator

    /**
     * Starts tracking the parent element's size.
     * If deferred was true, this sets it to false and begins observation.
     * If size data already exists, immediately fires a sizechanged event.
     */
    measure() {
        if (!this.#isActive) {
            resizeObserver.observe(this.#parentElement);
            this.#isActive = true;
        }

        this.deferred = false;

        // Dispatch immediately if we already have size data
        if (this.#resizeLast)
            this.#dispatchSizeChanged();
    }

    get #parentElement(): HTMLElement {
        return this.parentElement || <HTMLElement>(<ShadowRoot>this.getRootNode())?.host;
    }

    [triggerSizeChanged](cr: { width: number; height: number; }) {
        if (!this.#resizeLast || cr.width !== this.#resizeLast.width || cr.height !== this.#resizeLast.height) {
            this.#resizeLast = {
                width: cr.width,
                height: cr.height
            };

            if ((this.#resizeLast.width === 0 || this.#resizeLast.height === 0) && !this.triggerZero)
                return;

            this.#dispatchSizeChanged();
        }
    }
}

customElements.define("vi-size-tracker", SizeTracker);
