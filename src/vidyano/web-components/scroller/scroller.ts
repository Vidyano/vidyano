import { html, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, listener, observer, notify } from "components/web-component/web-component";
import "components/size-tracker/size-tracker"
import styles from "./scroller.css";

/**
 * Custom scrollable container with styled scrollbars and scroll shadows.
 *
 * @element vi-scroller
 *
 * @fires outer-width-changed - Fired when the outer (viewport) width changes
 * @fires outer-height-changed - Fired when the outer (viewport) height changes
 * @fires vertical-scroll-offset-changed - Fired when the vertical scroll position changes
 * @fires horizontal-scroll-offset-changed - Fired when the horizontal scroll position changes
 */
export class Scroller extends WebComponent {
    static styles = unsafeCSS(styles);

    /** Minimum size for scrollbar thumbs in pixels */
    static #minBarSize: number = 40;

    #scrollEventListener: EventListener;
    #verticalScrollHeight: number;
    #verticalScrollTop: number;
    #verticalScrollSpace: number;
    #horizontalScrollWidth: number;
    #horizontalScrollLeft: number;
    #horizontalScrollSpace: number;
    #trackStart: number;
    #cachedScroller: HTMLElement | null = null;

    /** Whether the mouse is currently hovering over the scroller */
    @property({ type: Boolean, reflect: true })
    hovering: boolean = false;

    /** Current scrolling state: "vertical", "horizontal", or null */
    @property({ type: String, reflect: true })
    scrolling: string;

    /** Whether the scroller is scrolled to the top */
    @property({ type: Boolean, reflect: true })
    atTop: boolean = true;

    /** Whether the scroller is scrolled to the bottom */
    @property({ type: Boolean, reflect: true })
    atBottom: boolean = false;

    /** Whether the scroller is scrolled to the start (left) */
    @property({ type: Boolean, reflect: true })
    atStart: boolean = true;

    /** Whether the scroller is scrolled to the end (right) */
    @property({ type: Boolean, reflect: true })
    atEnd: boolean = false;

    /** Width of the viewport (outer container) */
    @property({ type: Number })
    @notify()
    outerWidth: number = 0;

    /** Height of the viewport (outer container) */
    @property({ type: Number })
    @notify()
    outerHeight: number = 0;

    /** Width of the scrollable content (inner container) */
    @property({ type: Number })
    innerWidth: number = 0;

    /** Height of the scrollable content (inner container) */
    @property({ type: Number })
    innerHeight: number = 0;

    /** Whether horizontal scrollbar is visible */
    @property({ type: Boolean, reflect: true })
    horizontal: boolean = false;

    /** Alignment of the vertical scrollbar */
    @property({ type: String, reflect: true })
    alignVerticalScrollbar: string;

    /** Whether to disable horizontal scrolling */
    @property({ type: Boolean, reflect: true })
    noHorizontal: boolean = false;

    /** Whether vertical scrollbar is visible */
    @property({ type: Boolean, reflect: true })
    vertical: boolean = false;

    /** Whether to disable vertical scrolling */
    @property({ type: Boolean, reflect: true })
    noVertical: boolean = false;

    /** Scrollbar visibility mode */
    @property({ type: String, reflect: true })
    scrollbars: string;

    /** Current vertical scroll position in pixels */
    @property({ type: Number })
    @observer(Scroller.prototype._verticalScrollOffsetChanged)
    @notify("vertical-scroll-offset-changed")
    verticalScrollOffset: number = 0;

    /** Current horizontal scroll position in pixels */
    @property({ type: Number })
    @observer(Scroller.prototype._horizontalScrollOffsetChanged)
    @notify("horizontal-scroll-offset-changed")
    horizontalScrollOffset: number = 0;

    /** Whether to disable scroll shadows */
    @property({ type: Boolean, reflect: true })
    noScrollShadow: boolean = false;

    /** Whether to show top scroll shadow */
    @property({ type: Boolean, reflect: true })
    scrollTopShadow: boolean = false;

    /** Whether to show bottom scroll shadow */
    @property({ type: Boolean, reflect: true })
    scrollBottomShadow: boolean = false;

    /** Whether to always show scrollbars */
    @property({ type: Boolean, reflect: true })
    forceScrollbars: boolean = false;

    /** Whether to hide scrollbars */
    @property({ type: Boolean, reflect: true })
    hideScrollbars: boolean = false;

    @listener("mouseenter")
    private _mouseenter() {
        this.hovering = true;

        // Update scrollable content size on hover to show scrollbars
        if (this.scroller) {
            this.innerHeight = this.scroller.scrollHeight;
            this.innerWidth = this.scroller.scrollWidth;
        }
    }

    @listener("mouseleave")
    private _mouseleave() {
        this.hovering = false;
    }

    @listener("scroll")
    private _trapEvent(e: Event) {
        // Prevent scroll events on the component itself (only allow on the wrapper)
        this.scrollTop = this.scrollLeft = 0;
        e.preventDefault();
        e.stopPropagation();
    }

    render() {
        return html`
            <main class="main-container">
                <div id="wrapper" class="wrapper" tabindex="-1">
                    <vi-size-tracker class="fit" @sizechanged=${this._outerSizeChanged}></vi-size-tracker>
                    <div id="content" class="relative content">
                        <vi-size-tracker @sizechanged=${this._innerSizeChanged} trigger-zero></vi-size-tracker>
                        <slot></slot>
                    </div>
                </div>

                <div class="top scroll-shadow-parent">
                    <div class="top scroll-shadow"></div>
                </div>
                <div class="bottom scroll-shadow-parent">
                    <div class="bottom scroll-shadow"></div>
                </div>
            </main>

            <div class="horizontal scrollbar-parent" @click=${this._horizontalScrollbarParentTap}>
                <div id="horizontal" class="scrollbar" @pointerdown=${this._startTrackHorizontal}></div>
            </div>
            <div class="vertical scrollbar-parent" @click=${this._verticalScrollbarParentTap}>
                <div id="vertical" class="scrollbar" @pointerdown=${this._startTrackVertical}></div>
            </div>
        `;
    }

    updated(changedProperties: Map<PropertyKey, unknown>) {
        super.updated(changedProperties);

        if (changedProperties.has('outerHeight') || changedProperties.has('innerHeight') ||
            changedProperties.has('verticalScrollOffset') || changedProperties.has('noVertical')) {
            this.#updateVerticalScrollbar(this.outerHeight, this.innerHeight, this.verticalScrollOffset, this.noVertical);
        }

        if (changedProperties.has('outerWidth') || changedProperties.has('innerWidth') ||
            changedProperties.has('horizontalScrollOffset') || changedProperties.has('noHorizontal')) {
            this.#updateHorizontalScrollbar(this.outerWidth, this.innerWidth, this.horizontalScrollOffset, this.noHorizontal);
        }
    }

    connectedCallback() {
        super.connectedCallback();

        // CRITICAL: Force synchronous render for backward compatibility
        // Polymer components expect .scroller to be available immediately
        this.performUpdate();

        if (this.scroller) {
            this.scroller.addEventListener("scroll", this.#scrollEventListener = this.#scroll.bind(this), { capture: true, passive: true });
        }
    }

    firstUpdated() {
        const actualWrapper = this.$.wrapper;
        if (actualWrapper) {
            this.#cachedScroller = actualWrapper;
        }

        this.#updateScrollOffsets();
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        if (this.#cachedScroller && this.#scrollEventListener) {
            this.#cachedScroller.removeEventListener("scroll", this.#scrollEventListener);
        }
        this.#cachedScroller = null;
    }

    /**
     * Gets the scrollable element.
     * NOTE: This property is used by other components to determine the scrolling parent.
     */
    get scroller(): HTMLElement | null {
        if (!this.#cachedScroller) {
            if (!this.shadowRoot) {
                console.warn('[vi-scroller] scroller accessed before connectedCallback, forcing render');
                this.performUpdate();
            }

            this.#cachedScroller = this.$.wrapper;
        }

        return this.#cachedScroller;
    }


    /**
     * Scrolls to the top of the content.
     * @param offsetTop - The offset from the top in pixels
     * @param animated - Whether to use smooth scrolling
     */
    async scrollToTop(offsetTop: number = 0, animated?: boolean) {
        if (!this.scroller) return;

        if (animated) {
            this.scroller.scrollTo({
                top: offsetTop,
                behavior: "smooth"
            });
        }
        else
            this.scroller.scrollTop = offsetTop;
    }

    /**
     * Scrolls to the bottom of the content.
     * @param animated - Whether to use smooth scrolling
     */
    scrollToBottom(animated?: boolean) {
        if (!this.scroller) return;

        if (animated) {
            this.scroller.scrollTo({
                top: this.innerHeight,
                behavior: "smooth"
            });
        }
        else
            this.scroller.scrollTop = this.innerHeight;
    }

    private _outerSizeChanged(e: CustomEvent<{ width: number; height: number }>) {
        this.outerWidth = e.detail.width;
        this.outerHeight = e.detail.height;

        if (this.scroller) {
            this.innerHeight = this.scroller.scrollHeight;
            this.innerWidth = this.scroller.scrollWidth;
        }

        this.#updateScrollOffsets();
        e.stopPropagation();
    }

    private _innerSizeChanged(e: CustomEvent<{ width: number; height: number }>) {
        if (this.scroller) {
            this.innerHeight = this.scroller.scrollHeight;
            this.innerWidth = this.scroller.scrollWidth;
        }

        this.#updateScrollOffsets();
        e.stopPropagation();
    }

    /**
     * Updates the vertical scrollbar size and position.
     */
    #updateVerticalScrollbar(outerHeight: number, innerHeight: number, verticalScrollOffset: number, noVertical: boolean) {
        let height = innerHeight > Math.ceil(outerHeight) ? outerHeight / innerHeight * outerHeight : 0;

        if (height > 0 && height < Scroller.#minBarSize)
            height = Scroller.#minBarSize;
        else if (height > 0)
            height = Math.floor(height);

        if (height !== this.#verticalScrollHeight) {
            this.#verticalScrollHeight = height;
            this.#verticalScrollSpace = outerHeight - height;

            const verticalElement = this.$.vertical;
            if (verticalElement)
                verticalElement.style.height = `${height}px`;
        }

        this.vertical = !noVertical && height > 0;

        const verticalScrollTop = verticalScrollOffset === 0 || innerHeight - outerHeight === 0 ? 0 : Math.round((1 / ((innerHeight - outerHeight) / verticalScrollOffset)) * this.#verticalScrollSpace);
        if (verticalScrollTop !== this.#verticalScrollTop) {
            const verticalElement = this.$.vertical;
            if (verticalElement)
                verticalElement.style.transform = `translateY(${this.#verticalScrollTop = verticalScrollTop}px)`;
        }

        this.scrollTopShadow = !this.noScrollShadow && verticalScrollTop > 0;
        this.scrollBottomShadow = !this.noScrollShadow && Math.floor(innerHeight - verticalScrollOffset - outerHeight) > 0;
    }

    /**
     * Updates the horizontal scrollbar size and position.
     */
    #updateHorizontalScrollbar(outerWidth: number, innerWidth: number, horizontalScrollOffset: number, noHorizontal: boolean) {
        let width = innerWidth > Math.ceil(outerWidth) ? outerWidth / innerWidth * outerWidth : 0;

        if (width > 0 && width < Scroller.#minBarSize)
            width = Scroller.#minBarSize;
        else if (width > 0)
            width = Math.floor(width);

        if (width !== this.#horizontalScrollWidth) {
            this.#horizontalScrollWidth = width;
            this.#horizontalScrollSpace = outerWidth - width;

            const horizontalElement = this.$.horizontal;
            if (horizontalElement)
                horizontalElement.style.width = `${width}px`;
        }

        this.horizontal = !noHorizontal && width > 0;

        const horizontalScrollLeft = horizontalScrollOffset === 0 ? 0 : Math.round((1 / ((innerWidth - outerWidth) / horizontalScrollOffset)) * this.#horizontalScrollSpace);
        if (horizontalScrollLeft !== this.#horizontalScrollLeft) {
            const horizontalElement = this.$.horizontal;
            if (horizontalElement)
                horizontalElement.style.transform = `translate3d(${this.#horizontalScrollLeft = horizontalScrollLeft}px, 0, 0)`;
        }
    }

    private _startTrackVertical(e: PointerEvent) {
        this.#startTrack(e, "vertical");
    }

    private _startTrackHorizontal(e: PointerEvent) {
        this.#startTrack(e, "horizontal");
    }

    /**
     * Handles dragging of scrollbar thumbs using pointer events.
     */
    #startTrack(e: PointerEvent, direction: "vertical" | "horizontal") {
        if (!this.scroller) return;

        this.scrolling = direction;
        const isVertical = direction === "vertical";

        this.#trackStart = isVertical ? this.#verticalScrollTop : this.#horizontalScrollLeft;
        const startPos = isVertical ? e.clientY : e.clientX;
        const inner = isVertical ? this.innerHeight : this.innerWidth;
        const outer = isVertical ? this.outerHeight : this.outerWidth;
        const space = isVertical ? this.#verticalScrollSpace : this.#horizontalScrollSpace;

        const pointerId = e.pointerId;
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(pointerId);

        const onPointerMove = (e: PointerEvent) => {
            const delta = (isVertical ? e.clientY : e.clientX) - startPos;
            const newScrollbarPos = this.#trackStart + delta;
            const scrollValue = newScrollbarPos === 0 ? 0 : (inner - outer) * ((1 / space) * newScrollbarPos);

            if (isVertical) {
                this.scroller.scrollTop = scrollValue;
            } else {
                this.scroller.scrollLeft = scrollValue;
            }
        };

        const onPointerUp = () => {
            this.scrolling = null;
            target.releasePointerCapture(pointerId);
            target.removeEventListener("pointermove", onPointerMove);
            target.removeEventListener("pointerup", onPointerUp);
            target.removeEventListener("pointercancel", onPointerUp);
        };

        target.addEventListener("pointermove", onPointerMove);
        target.addEventListener("pointerup", onPointerUp);
        target.addEventListener("pointercancel", onPointerUp);

        e.preventDefault();
    }

    /**
     * Handles scroll events to update scrollbar positions and content size.
     */
    #scroll(e: Event) {
        if (this.scroller) {
            this.innerHeight = this.scroller.scrollHeight;
            this.innerWidth = this.scroller.scrollWidth;
        }

        this.#updateScrollOffsets();
    }

    /**
     * Updates scroll offset properties and boundary flags.
     */
    #updateScrollOffsets() {
        if (!this.scroller) return;

        const newVerticalScrollOffset = this.scroller.scrollTop;
        if (this.verticalScrollOffset !== newVerticalScrollOffset) {
            this.verticalScrollOffset = newVerticalScrollOffset;
        }
        this.atTop = this.verticalScrollOffset === 0;
        this.atBottom = Math.abs(Math.round(this.scroller.scrollTop + this.scroller.offsetHeight) - this.scroller.scrollHeight) <= 1;

        const newHorizontalScrollOffset = this.scroller.scrollLeft;
        if (this.horizontalScrollOffset !== newHorizontalScrollOffset) {
            this.horizontalScrollOffset = newHorizontalScrollOffset;
        }
        this.atStart = this.horizontalScrollOffset === 0;
        this.atEnd = Math.abs(Math.round(this.scroller.scrollLeft + this.scroller.offsetWidth) - this.scroller.scrollWidth) <= 1;
    }

    private _verticalScrollOffsetChanged(newVerticalScrollOffset: number) {
        // Skip if scroller doesn't exist yet (during initialization)
        const scroller = this.#cachedScroller || this.$.wrapper;
        if (!scroller) return;

        if (scroller.scrollTop === newVerticalScrollOffset)
            return;

        scroller.scrollTop = newVerticalScrollOffset;
    }

    private _horizontalScrollOffsetChanged(newHorizontalScrollOffset: number) {
        // Skip if scroller doesn't exist yet (during initialization)
        const scroller = this.#cachedScroller || this.$.wrapper;
        if (!scroller) return;

        if (scroller.scrollLeft === newHorizontalScrollOffset)
            return;

        scroller.scrollLeft = newHorizontalScrollOffset;
    }

    private _verticalScrollbarParentTap(e: MouseEvent) {
        this.#scrollbarParentTap(e, "vertical");
    }

    private _horizontalScrollbarParentTap(e: MouseEvent) {
        this.#scrollbarParentTap(e, "horizontal");
    }

    /**
     * Handles clicks on the scrollbar track to jump to a position.
     */
    #scrollbarParentTap(e: MouseEvent, direction: "vertical" | "horizontal") {
        if (!this.scroller) return;

        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const isVertical = direction === "vertical";

        const offset = isVertical ? e.clientY - rect.top : e.clientX - rect.left;
        const scrollbarPos = isVertical ? this.#verticalScrollTop : this.#horizontalScrollLeft;
        const scrollbarSize = isVertical ? this.#verticalScrollHeight : this.#horizontalScrollWidth;
        const scrollSize = isVertical ? this.scroller.scrollHeight : this.scroller.scrollWidth;

        if (offset > scrollbarPos + scrollbarSize) {
            if (isVertical) {
                this.scroller.scrollTop += scrollSize * 0.1;
            } else {
                this.scroller.scrollLeft += scrollSize * 0.1;
            }
        } else if (offset < scrollbarPos) {
            if (isVertical) {
                this.scroller.scrollTop -= scrollSize * 0.1;
            } else {
                this.scroller.scrollLeft -= scrollSize * 0.1;
            }
        }

        e.stopPropagation();
    }
}

customElements.define("vi-scroller", Scroller);
