import { html, css } from "lit";
import { query } from "lit/decorators.js";
import type { ImageItemMap } from "./query-grid-gallery"
import { WebComponentLit } from "components/web-component/web-component-lit";
import * as Vidyano from "vidyano";

/**
 * A web component that uses a native <dialog> element to display a single photo
 * in a full-screen overlay, with navigation controls.
 */
@WebComponentLit.register({
    properties: {
        items: {
            type: Array
        },
        currentIndex: {
            type: Number
        },
        map: {
            type: Object
        },
        open: {
            type: Boolean
        },
        _isLoading: {
            type: Boolean,
            state: true
        },
        _controlsVisible: {
            type: Boolean,
            state: true
        }
    }
}, "vi-query-grid-gallery-image-viewer")
export class QueryGridGalleryImageViewer extends WebComponentLit {
    static styles = css`
        :host {
            display: contents;
        }

        dialog {
            background: transparent;
            border: none;
            padding: 0;
            max-width: 100vw;
            max-height: 100vh;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
        }

        dialog::backdrop {
            background-color: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(2px);
        }

        .dialog-content {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;
        }

        .image-container {
            position: relative;
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        img {
            display: block;
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 4px;
        }

        .nav-button, .close-button {
            position: absolute;
            background: rgba(30, 30, 30, 0.6);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            cursor: pointer;
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            -webkit-tap-highlight-color: transparent;
            outline: none;
            /* Fade-in/out behavior */
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 1; /* Ensure buttons are on top */
        }

        /* Show buttons when active */
        dialog.controls-visible .nav-button,
        dialog.controls-visible .close-button {
            opacity: 1;
        }

        .nav-button:hover, .close-button:hover { background: rgba(0, 0, 0, 0.8); }

        /* Position nav buttons safely inside the viewport */
        .nav-button.prev { left: 24px; top: 50%; transform: translateY(-50%); }
        .nav-button.next { right: 24px; top: 50%; transform: translateY(-50%); }

        /* Position close button in the top-right corner of the screen */
        .close-button { top: 24px; right: 24px; }

        .nav-button svg, .close-button svg { width: 24px; height: 24px; }
    `;

    items: Vidyano.QueryResultItem[] = [];
    currentIndex: number | null = null;
    map: ImageItemMap;
    open: boolean = false;
    
    private _isLoading = false;
    private _controlsVisible = false;

    @query('dialog')
    private _dialog: HTMLDialogElement;

    #activityTimer: number | undefined;

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this.#activityTimer);
    }

    firstUpdated() {
        // When the native dialog is closed (e.g., via ESC key),
        // we must update our own state and dispatch our own event so the parent component knows.
        this._dialog.addEventListener('close', () => {
            this.open = false; // Sync internal state
            this.dispatchEvent(new CustomEvent('close'));
            // Clean up activity timer and state
            clearTimeout(this.#activityTimer);
            this._controlsVisible = false;
        });
    }

    updated(changedProps: Map<string, any>) {
        if (changedProps.has('open') || (changedProps.has('currentIndex') && this.open))
            this._isLoading = true;

        if (changedProps.has('open') && this._dialog) {
            if (this.open) {
                this._dialog.showModal();
                this._handleActivity(); // Show controls when opened
            } else {
                this._dialog.close();
            }
        }
    }
    
    private _closeDialog() {
        // This will trigger the 'close' event listener added in firstUpdated
        this._dialog?.close();
    }

    private _navigate(direction: 'previous' | 'next') {
        this.dispatchEvent(new CustomEvent(`navigate-${direction}`));
        this._handleActivity(); // Reset activity timer on navigation
    }
    
    private _handleActivity() {
        this._controlsVisible = true;
        clearTimeout(this.#activityTimer);
        this.#activityTimer = window.setTimeout(() => {
            this._controlsVisible = false;
        }, 3000); // Hide controls after 3 seconds of inactivity
    }

    private _handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault(); // Stop the browser from moving focus
            if (this.currentIndex > 0) {
                this._navigate('previous');
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault(); // Stop the browser from moving focus
            if (this.currentIndex < this.items.length - 1) {
                this._navigate('next');
            }
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            // Also prevent up/down arrows from trying to move focus
            e.preventDefault();
        }
    }

    render() {
        const currentItem = this.currentIndex !== null ? this.items[this.currentIndex] : null;
        const imageUrl = currentItem ? currentItem.values[this.map?.image] : '';
        const showPrev = currentItem && this.currentIndex > 0;
        const showNext = currentItem && this.currentIndex < this.items.length - 1;

        return html`
            <dialog @mousemove=${this._handleActivity} @keydown=${this._handleKeyDown} class=${this._controlsVisible ? 'controls-visible' : ''}>
                <button tabindex="-1" class="close-button" @click=${() => this._closeDialog()} title="Close (Escape)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>

                ${currentItem ? html`
                    ${showPrev ? html`
                        <button tabindex="-1" class="nav-button prev" @click=${() => this._navigate('previous')} title="Previous (Left Arrow)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                    ` : ''}

                    ${showNext ? html`
                        <button tabindex="-1" class="nav-button next" @click=${() => this._navigate('next')} title="Next (Right Arrow)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>
                    ` : ''}

                    <div class="dialog-content">
                        <div class="image-container">
                            ${this._isLoading ? html`<vi-spinner></vi-spinner>` : ''}
                            <img
                                src=${imageUrl}
                                alt="Image ${currentItem.id}"
                                @load=${() => this._isLoading = false}
                                @error=${() => this._isLoading = false}
                                style="display: ${this._isLoading ? 'none' : 'block'}"
                            >
                        </div>
                    </div>
                ` : ''}
            </dialog>
        `;
    }
}