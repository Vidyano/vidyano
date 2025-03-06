import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"
import { marked } from "marked"
import DOMPurify from "dompurify"

DOMPurify.addHook("afterSanitizeAttributes", function (node) {
    // set all elements owning target to target=_blank
    if (node instanceof HTMLAnchorElement && node.getAttribute("href")?.startsWith("http")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener");
    }
});

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (node.tagName === "VI-ICON" && data.attrName === 'source')
        data.forceKeepAttr = true;
});

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
        this.innerHTML = getMarkdown(markdown, { breaks, gfm, addTags, forbidTags });
    }
}

export function getMarkdown(markdown: string, options?: {
    breaks?: boolean;
    gfm?: boolean;
    addTags?: string;
    forbidTags?: string;
}) {
    const html = marked(markdown, {
        breaks: options?.breaks !== false ? true : false,
        gfm: options?.gfm !== false ? true : false,
        async: false
    });

    const sanitized = DOMPurify.sanitize(html, {
        ADD_TAGS: options?.addTags?.split(",") || [],
        FORBID_TAGS: options?.forbidTags?.split(",") || []
    });

    return sanitized;
}