import { html, PropertyValues, unsafeCSS } from "lit";
import { QueryGridCell } from "./query-grid-cell"
import { QueryGridCellDefault } from "./query-grid-cell-default"
import { getMarkdown } from "components/marked/marked"
import { Path } from "libs/pathjs/pathjs"
import styles from "./query-grid-cell-common-mark.css";

const MAX_CACHED_MARKDOWN = 1000;
const markdownTemplates = new Map<string, HTMLTemplateElement>();

// Cells share the sanitized markup per text, so recycling a cell to a text seen before only clones it
function getMarkdownTemplate(markdown: string): HTMLTemplateElement {
    let template = markdownTemplates.get(markdown);
    if (template)
        return template;

    template = document.createElement("template");
    template.innerHTML = getMarkdown(markdown, {
        addTags: "VI-ICON",
        forbidTags: "STYLE"
    });

    // The cell shows one row, so a line break becomes a space
    template.content.querySelectorAll("br").forEach(br => br.replaceWith(" "));

    if (markdownTemplates.size >= MAX_CACHED_MARKDOWN)
        markdownTemplates.delete(markdownTemplates.keys().next().value);

    markdownTemplates.set(markdown, template);
    return template;
}

export class QueryGridCellCommonMark extends QueryGridCellDefault {
    static styles = [QueryGridCellDefault.styles, unsafeCSS(styles)];

    #markdownValue: string;
    #renderedMarkdown: string;
    #renderedText: string;

    // #text is written in updated, so a new value replaces its content with one write instead of a node per markdown block
    render() {
        return html`<div id="text" @click=${this._onClick}></div>`;
    }

    protected updated(changedProperties: PropertyValues) {
        super.updated(changedProperties);

        const text = this.shadowRoot.getElementById("text");
        if (this.#markdownValue != null) {
            if (this.#renderedMarkdown === this.#markdownValue)
                return;

            text.replaceChildren(document.importNode(getMarkdownTemplate(this.#renderedMarkdown = this.#markdownValue).content, true));
            this.#renderedText = null;
        }
        else if (this.#renderedText !== this._text || this.#renderedMarkdown != null) {
            text.textContent = this.#renderedText = this._text;
            this.#renderedMarkdown = null;
        }
    }

    protected _clearCell() {
        super._clearCell();

        this.#markdownValue = null;
    }

    protected _updateCell(value: string) {
        const asmarkdown = this._getTypeHint(this.value.column, "displayingrid", null);
        if (Boolean.parse(asmarkdown)) {
            this.#markdownValue = value;
            return;
        }

        this.#markdownValue = null;
        super._updateCell(value);
    }

    private _onClick(e: MouseEvent) {
        const anchor = <HTMLAnchorElement>e.composedPath().find(n => n instanceof HTMLAnchorElement);
        if (!anchor)
            return;

        e.stopPropagation();

        // Outside vi-app there is no app router, so the browser follows every link
        if (Path.routes.root == null)
            return;

        if (!e.ctrlKey && anchor.href.startsWith(Path.routes.root) && !(anchor.getAttribute("rel") || "").contains("external")) {
            e.preventDefault();

            let path = anchor.href.slice(Path.routes.root.length);
            if (path.startsWith("#!/"))
                path = path.substring(3);

            this.app.changePath(path);
        }
    }
}

QueryGridCell.registerCellType("CommonMark", QueryGridCellCommonMark);

customElements.define("vi-query-grid-cell-common-mark", QueryGridCellCommonMark);
