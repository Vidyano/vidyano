import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"
import { marked } from "marked"
import DOMPurify from "dompurify"

DOMPurify.addHook("afterSanitizeAttributes", function (node) {
    // set all elements owning target to target=_blank
    if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener");
    }
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
        var renderer = new marked.Renderer();
        renderer.link = function(token) {
            var anchor = marked.Renderer.prototype.link.call(this, token) as string;
            if (token.href.startsWith("http"))
                return anchor.replace("<a",`<a target="_blank" rel="noopener" `);

            return anchor;
        };

        const html = await marked(markdown, {
            breaks,
            gfm,
            async: false,
            renderer: renderer
        });

        this.innerHTML = DOMPurify.sanitize(html, {
            ADD_TAGS: addTags?.split(",") || [],
            FORBID_TAGS: forbidTags?.split(",") || [],
        });
    }
}