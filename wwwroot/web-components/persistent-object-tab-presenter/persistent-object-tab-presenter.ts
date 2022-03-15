import * as Polymer from "../../libs/polymer/polymer";
import * as Vidyano from "../../libs/vidyano/vidyano"
import { WebComponent } from "../web-component/web-component"
import { QueryItemsPresenter } from "../query-items-presenter/query-items-presenter"
import { PersistentObjectTab } from "../persistent-object-tab/persistent-object-tab"

@WebComponent.register({
    properties: {
        tab: Object,
        loading: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true,
            value: true
        },
        templated: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true
        }
    },
    observers: [
        "_renderTab(tab, isConnected)"
    ],
    listeners: {
        "attribute-loaded": "_attributeLoaded"
    }
})
export class PersistentObjectTabPresenter extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-tab-presenter.html">`; }

    private _renderedTab: Vidyano.PersistentObjectTab;
        private _tabAttributes: Vidyano.PersistentObjectAttribute[];
        readonly loading: boolean; private _setLoading: (loading: boolean) => void;
        readonly templated: boolean; private _setTemplated: (templated: boolean) => void;
        tab: Vidyano.PersistentObjectTab;

    private async _renderTab(tab: Vidyano.PersistentObjectTab, isConnected: boolean) {
        if (!isConnected || this._renderedTab === tab)
            return;

        this.empty();

        if (!tab) {
            this._setLoading(false);
            return;
        }

        this._setLoading(true);

        const config = this.app.configuration.getTabConfig(tab);
        this._setTemplated(!!config && config.hasTemplate);

        if (this.templated) {
            this.appendChild(config.stamp(tab, config.as || "tab"));

            this._setLoading(false);
        }
        else {
            if (tab instanceof Vidyano.PersistentObjectQueryTab) {
                const itemPresenter = new QueryItemsPresenter();
                itemPresenter.query = (<Vidyano.PersistentObjectQueryTab>tab).query;
                if (itemPresenter.query.autoQuery && !itemPresenter.query.hasSearched)
                    itemPresenter.query.search();

                this.appendChild(itemPresenter);

                this._setLoading(false);
            }
            else if (tab instanceof Vidyano.PersistentObjectAttributeTab) {
                if (tab !== this.tab)
                    return;

                this._tabAttributes = (<Vidyano.PersistentObjectAttributeTab>tab).attributes.slice(0).filter(a => a.isVisible);

                const attributeTab = new PersistentObjectTab();
                attributeTab.tab = <Vidyano.PersistentObjectAttributeTab>tab;

                this.appendChild(attributeTab);

                if (this._tabAttributes.length === 0)
                    this._setLoading(false);
            }
        }
    }

    private _attributeLoaded(e: CustomEvent) {
        const { attribute }: { attribute: Vidyano.PersistentObjectAttribute; } = e.detail;

        if (!this._tabAttributes)
            return;

        if (this._tabAttributes.length > 0)
            this._tabAttributes.remove(attribute);

        if (this._tabAttributes.length === 0)
            this._setLoading(false);
    }
}