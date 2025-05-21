import * as Polymer from "libs/polymer/polymer"
import { QueryGridCell } from "./query-grid-cell"
import { QueryGridCellDefault } from "./query-grid-cell-default"
import { WebComponent } from "components/web-component/web-component"
import { getMarkdown } from "components/marked/marked"
import { Path } from "libs/pathjs/pathjs"

@WebComponent.register({
    properties: {
        value: {
            type: Object,
            observer: "_valueChanged"
        },
        column: Object,
        right: {
            type: Boolean,
            reflectToAttribute: true
        },
        tag: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    sensitive: true
})
export class QueryGridCellCommonMark extends QueryGridCellDefault {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-cell-common-mark.html">` }

    #asmarkdown: boolean;
    #textNode: Text;
    #textNodeValue: string;
    #markdownValue: string;

    protected _clearCell() {
        super._clearCell();

        if (this.#asmarkdown && this.#markdownValue) {
            this.$.text.innerHTML = "";
            this.#markdownValue = null;
        }
    }

    protected _updateCell(value: string) {
        const asmarkdown = this._getTypeHint(this.value.column, "displayingrid", null);
        this.#asmarkdown = Boolean.parse(asmarkdown);
        if (this.#asmarkdown) {
            if (this.#textNode) {
                // In case the cell was previously rendered as text, remove the text node.
                this.$.text.removeChild(this.#textNode);
                this.#textNode = this.#textNodeValue = null;
            }

            if (this.#markdownValue !== value) {
                this.$.text.innerHTML = getMarkdown(this.#markdownValue = value, {
                    addTags: "VI-ICON"
                });
            }

            return;
        }

        if (this.#markdownValue) {
            // In case the cell was previously rendered as markdown, clear the innerHTML.
            this.$.text.innerHTML = "";
            this.#markdownValue = null;
        }

        super._updateCell(value);
    }

    private _onClick(e: MouseEvent) {
        if (e.target instanceof HTMLAnchorElement) {
            e.stopPropagation();

            if (!e.ctrlKey && e.target.href.startsWith(Path.routes.root || "") && !(e.target.getAttribute("rel") || "").contains("external")) {
                e.preventDefault();
    
                let path = e.target.href.slice(Path.routes.root.length);
                if (path.startsWith("#!/"))
                    path = path.substring(3);
    
                this.app.changePath(path);
            }
        }
    }
}

QueryGridCell.registerCellType("CommonMark", QueryGridCellCommonMark);