import { css, html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { property } from "lit/decorators.js";
import { WebComponent } from "components/web-component/web-component";
import { marked } from "marked";
import DOMPurify from "dompurify";

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

export class Marked extends WebComponent {
    static styles = [css`:host { display: block; }`];

    @property({ type: String })
    addTags: string | null = null;

    @property({ type: String })
    forbidTags: string | null = null;

    @property({ type: Boolean })
    breaks: boolean = true;

    @property({ type: Boolean })
    gfm: boolean = true;

    @property({ type: String })
    markdown: string;

    createRenderRoot() {
        return this;
    }

    render() {
        if (!this.markdown)
            return html``;

        return unsafeHTML(getMarkdown(this.markdown, {
            breaks: this.breaks,
            gfm: this.gfm,
            addTags: this.addTags,
            forbidTags: this.forbidTags
        }));
    }
}

/**
 * Converts markdown to HTML using marked and sanitizes it with DOMPurify.
 * @param markdown - The markdown string to convert.
 * @param options - Optional settings for the conversion.
 * @param options.breaks - Whether to enable line breaks in the output (default: true if not specified).
 * @param options.gfm - Whether to enable GitHub Flavored Markdown (default: true if not specified).
 * @param options.addTags - Comma-separated list of additional tags to allow in the output (default: none).
 * @param options.forbidTags - Comma-separated list of tags to forbid in the output (default: none).
 * @return Sanitized HTML string.
 */
export function getMarkdown(markdown: string, options?: {
    breaks?: boolean;
    gfm?: boolean;
    addTags?: string | null;
    forbidTags?: string | null;
}) {
    const html = marked(markdown, {
        breaks: options?.breaks ?? true,
        gfm: options?.gfm ?? true,
        async: false
    });

    const sanitized = DOMPurify.sanitize(html, {
        ADD_TAGS: options?.addTags?.split(",") || [],
        FORBID_TAGS: options?.forbidTags?.split(",") || []
    });

    return sanitized;
}

customElements.define("vi-marked", Marked);
