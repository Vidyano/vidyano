import { html, css } from "lit";
import { property } from "lit/decorators.js";
import { WebComponentLit } from "components/web-component/web-component-lit";

/**
 * A web component for lazy-loading images in the gallery.
 * The image is only loaded when it enters the viewport.
 */
@WebComponentLit.register({
    properties: {
        src: { type: String },
        alt: { type: String },
        _isLoaded: { state: true }
    }
}, "vi-query-grid-gallery-lazy-image")
export class QueryGridGalleryLazyImage extends WebComponentLit {
    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            background-color: #e9e9e9;
        }

        img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0;
            transition: opacity 0.4s ease-in-out;
        }

        img.loaded {
            opacity: 1;
        }
    `;

    @property({ type: String })
    src: string;

    @property({ type: String })
    alt: string;

    private _isLoaded = false;

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