import { html, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent } from "components/web-component/web-component";
import styles from "./query-grid-gallery-lazy-image.css";

/**
 * A web component for lazy-loading images in the gallery.
 * The image is only loaded when it enters the viewport.
 */
export class QueryGridGalleryLazyImage extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: String }) src: string;
    @property({ type: String }) alt: string;
    @property({ type: Boolean, state: true }) private _isLoaded = false;

    /**
     * Loads the image when it enters the viewport.
     */
    loadImage() {
        if (this._isLoaded || !this.src)
            return;

        const img = new Image();
        img.src = this.src;
        img.alt = this.alt;
        img.onload = () => {
            this._isLoaded = true;
        };
    }

    /**
     * Renders the image element, only setting the src if the image is loaded.
     */
    render() {
        return html`<img .src=${this._isLoaded ? this.src : ""}  alt=${this.alt}  class=${this._isLoaded ? 'loaded' : ''}>`;
    }
}

customElements.define("vi-query-grid-gallery-lazy-image", QueryGridGalleryLazyImage);
