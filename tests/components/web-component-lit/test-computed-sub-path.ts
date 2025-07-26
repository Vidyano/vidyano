import { WebComponentLit } from "../../../src/app/web-components/web-component/web-component-lit.js";
import { property } from "../../../src/app/web-components/web-component/web-component-decorators.js";
import { Observable } from "../../../src/core/observable/index.js";
import { html } from "lit";

export class QuerySource extends Observable<QuerySource> {
    private _items: string[] = [];

    get items(): string[] {
        return this._items;
    }

    set items(value: string[]) {
        if (this._items === value)
            return;

        const oldValue = this._items;
        this._items = value;
        this.notifyPropertyChanged("items", this._items, oldValue);
    }

    constructor(initialItems: string[]) {
        super();
        this._items = initialItems;
    }

    addItem(item: string) {
        const oldItems = [...this._items];
        this._items.push(item);
        this.notifyArrayChanged("items", oldItems.length, [], 1);
        this.notifyPropertyChanged("items", this._items, oldItems); // Also notify that 'items' array instance itself might be considered "changed" by some observers
    }
}

export class TestComputedSubPath extends WebComponentLit {
    @property({ type: Object })
    query: QuerySource;

    @property({ type: Array, computed: "query.items" })
    readonly items: string[];

    constructor() {
        super();
        this.query = new QuerySource(["initial1", "initial2"]);
    }

    render() {
        return html`
            <p>Tests computed property based on an Observable object's property.</p>
            <div id="query-items">${this.query?.items?.join(", ")}</div>
            <div id="component-items">${this.items?.join(", ")}</div>
        `;
    }

    resetQuerySource() {
        this.query = new QuerySource(["brandnew1", "brandnew2"]);
    }
}

customElements.define("test-computed-sub-path", TestComputedSubPath);