import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"
import { marked } from "marked"
import DOMPurify from "dompurify"
export { DOMPurify } from "dompurify"
export { marked } from "marked"

@WebComponent.register({
    properties: {
        addTags: {
            type: String,
            value: null
        },
        forbidTags: {
            type: String,
            value: null
        },
        breaks: {
            type: Boolean,
            value: true
        },
        gfm: {
            type: Boolean,
            value: true
        },
        markdown: String
    },
    observers: [
        "_markdownChanged(markdown, breaks, gfm, addTags, forbidTags)"
    ]
})
export class Marked extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="marked.html">` }

    private async _markdownChanged(markdown: string, breaks: boolean, gfm: boolean, addTags: string, forbidTags: string) {
        this.innerHTML = await marked(markdown, {
            breaks,
            gfm,
            async: false,
            hooks: {
                preprocess: (markdown: string) => (markdown),
                postprocess: (html: string) => DOMPurify.sanitize(html, {
                    ADD_TAGS: addTags?.split(",") || [],
                    FORBID_TAGS: forbidTags?.split(",") || []
                })
            }
        });
    }
}

// TODO: Remove element by October 1st 2024
@WebComponent.register({
    properties: {
        breaks: {
            type: Boolean,
            value: true
        },
        markdown: String
    },
    observers: [
        "_markdownChanged(markdown, breaks)"
    ]
}, "marked")
class Element extends Marked {
    connectedCallback() {
        super.connectedCallback();

        console.warn("marked-element is deprecated and set to be removed by October 1st 2024. Use vi-marked instead.");
    }
}