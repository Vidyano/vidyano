import { html, unsafeCSS } from "lit";
import { query, property } from "lit/decorators.js";
import type { ImageItemMap } from "./query-grid-gallery"
import { WebComponent } from "components/web-component/web-component";
import * as Vidyano from "vidyano";
import styles from "./query-grid-gallery-image-viewer.css";

/**
 * A web component that uses a native <dialog> element to display a single photo
 * in a full-screen overlay, with navigation controls.
 */
export class QueryGridGalleryImageViewer extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Array }) items: Vidyano.QueryResultItem[] = [];
    @property({ type: Number }) currentIndex: number | null = null;
    @property({ type: Object }) map: ImageItemMap;
    @property({ type: Boolean }) open: boolean = false;
    @property({ type: Boolean, state: true }) private _isLoading = false;
    @property({ type: Boolean, state: true }) private _controlsVisible = false;

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

customElements.define("vi-query-grid-gallery-image-viewer", QueryGridGalleryImageViewer);
