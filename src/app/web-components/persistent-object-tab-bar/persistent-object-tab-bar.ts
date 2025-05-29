import * as Polymer from "polymer"
import type * as Vidyano from "vidyano"
import "./persistent-object-tab-bar-item"
import { Popup } from "components/popup/popup"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        tabs: Array,
        selectedTab: {
            type: Object,
            notify: true
        },
        mode: {
            type: String,
            value: "inline",
            reflectToAttribute: true
        }
    },
    observers: [
        "_hookObservers(isConnected, tabs)"
    ]
}, "vi-persistent-object-tab-bar")
export class PersistentObjectTabBar extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-tab-bar.html">`; }

    private _observeDisposer: Vidyano.ForwardObservedChainDisposer;
    tabs: Vidyano.PersistentObjectTab[];
    selectedTab: Vidyano.PersistentObjectTab;

    private _hookObservers() {
        if (this._observeDisposer) {
            this._observeDisposer();
            this._observeDisposer = undefined;
        }

        if (this.isConnected && this.tabs) {
            this._observeDisposer = this._forwardObservable(this.tabs, "isVisible", "tabs", () => {
                if (!this.selectedTab || !this.selectedTab.isVisible)
                    this.selectedTab = this.tabs.filter(t => t.isVisible)[0];
            });
        }

        if (!this.selectedTab || !this.selectedTab.isVisible)
            this.selectedTab = this.tabs.filter(t => t.isVisible)[0];
    }

    private _tabSelected(e: Event, detail: any) {
        this.selectedTab = detail.tab;

        Popup.closeAll(this);
    }

    private isInline(mode: string): boolean {
        return mode === "inline";
    }

    private isDropDown(mode: string): boolean {
        return mode === "dropdown";
    }

    private _isVisible(tab: Vidyano.PersistentObjectTab): boolean {
        return tab.isVisible;
    }
}