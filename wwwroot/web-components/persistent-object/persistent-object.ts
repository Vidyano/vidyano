import * as Polymer from "../../libs/polymer/polymer.js"
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import "../action-bar/action-bar.js"
import { App } from "../app/app.js"
import { AppCacheEntryPersistentObject } from "../app-cache/app-cache-entry-persistent-object.js"
import { Button } from "../button/button.js"
import "../notification/notification.js"
import "../persistent-object-tab-bar/persistent-object-tab-bar.js"
import "../persistent-object-tab-presenter/persistent-object-tab-presenter.js"
import { WebComponent } from "../web-component/web-component.js"

export interface IPersistentObjectWebComponent extends WebComponent {
    persistentObject: Vidyano.PersistentObject;
}

@WebComponent.register({
    properties: {
        persistentObject: {
            type: Object,
        },
        tabs: {
            type: Array,
            computed: "persistentObject.tabs"
        },
        masterWidth: {
            type: Number,
            observer: "_masterWidthChanged"
        },
        masterTabs: {
            type: Array,
            computed: "_computeMasterTabs(persistentObject, tabs)",
            observer: "_masterTabsChanged"
        },
        hasMasterTabs: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHasMasterTabs(masterTabs)"
        },
        selectedMasterTab: {
            type: Object,
            value: null,
            observer: "_selectedMasterTabChanged"
        },
        detailTabs: {
            type: Array,
            computed: "_computeDetailTabs(persistentObject, tabs)",
            observer: "_detailTabsChanged"
        },
        hasDetailTabs: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHasDetailTabs(detailTabs)"
        },
        selectedDetailTab: {
            type: Object,
            value: null,
            observer: "_selectedDetailTabChanged"
        },
        layoutMasterDetail: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeLayoutMasterDetail(persistentObject, masterTabs, detailTabs)"
        },
        layoutDetailsOnly: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeLayoutDetailsOnly(persistentObject, masterTabs, detailTabs)"
        },
        layoutFullPage: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeLayoutFullPage(persistentObject, detailTabs)"
        },
        layoutMasterActions: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeLayoutMasterActions(persistentObject, masterTabs)"
        },
        layoutDetailActions: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeLayoutDetailActions(persistentObject, detailTabs)"
        },
        layoutMasterTabs: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeLayoutMasterTabs(persistentObject, masterTabs, detailTabs)"
        },
        layoutDetailTabs: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeLayoutDetailTabs(persistentObject, detailTabs)"
        },
        isBusy: {
            type: Boolean,
            computed: "persistentObject.isBusy"
        },
        showNavigation: {
            type: Boolean,
            computed: "_computeShowNavigation(persistentObject)"
        }
    },
    observers: [
        "_persistentObjectChanged(persistentObject, isConnected)",
        "_persistentObjectNotificationChanged(persistentObject.notification)"
    ],
    forwardObservers: [
        "persistentObject.tabs.*.isVisible",
        "persistentObject.breadcrumb",
        "persistentObject.notification",
        "persistentObject.isBusy"
    ],
    listeners: {
        "tabselect": "_tabselect"
    },
    sensitive: true
})
export class PersistentObject extends WebComponent implements IPersistentObjectWebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object.html">` }

    private _cacheEntry: AppCacheEntryPersistentObject;
    persistentObject: Vidyano.PersistentObject;
    layout: string;
    masterWidth: string;
    masterTabs: Vidyano.PersistentObjectTab[];
    selectedMasterTab: Vidyano.PersistentObjectTab;
    detailTabs: Vidyano.PersistentObjectTab[];
    selectedDetailTab: Vidyano.PersistentObjectTab;

    private _persistentObjectChanged(persistentObject: Vidyano.PersistentObject, isConnected: boolean) {
        if (persistentObject && isConnected) {
            this._cacheEntry = <AppCacheEntryPersistentObject>(<App>(this.app)).cache(new AppCacheEntryPersistentObject(this.persistentObject));

            this.selectedMasterTab = this._cacheEntry.selectedMasterTab || this._computeMasterTabs(this.persistentObject, this.persistentObject.tabs)[0] || null;
            this.selectedDetailTab = this._cacheEntry.selectedDetailTab || this._computeDetailTabs(this.persistentObject, this.persistentObject.tabs)[0] || null;

            if (persistentObject.service.application.userSettings["PersistentObjectSettings"] &&
                persistentObject.service.application.userSettings["PersistentObjectSettings"][this.persistentObject.id] &&
                persistentObject.service.application.userSettings["PersistentObjectSettings"][this.persistentObject.id]["master-detail"]) {

                let masterWidth = persistentObject.service.application.userSettings["PersistentObjectSettings"][this.persistentObject.id]["master-detail"];
                if (isNaN(parseInt(masterWidth)))
                    masterWidth = "40%";

                this.masterWidth = masterWidth;
            }
            else
                this.masterWidth = "40%";
        }
    }

    private _masterWidthChanged() {
        this.updateStyles({
            "--vi-persistent-object-master-width": this.masterWidth
        });
    }

    private _computeMasterTabs(persistentObject: Vidyano.PersistentObject, tabs: Vidyano.PersistentObjectTab[]): Vidyano.PersistentObjectTab[] {
        if (persistentObject.queryLayoutMode === Vidyano.PersistentObjectLayoutMode.FullPage)
            return tabs.filter(t => t.isVisible);

        return tabs ? tabs.filter(t => t.isVisible && t.tabGroupIndex === 0) : [];
    }

    private _computeDetailTabs(persistentObject: Vidyano.PersistentObject, tabs: Vidyano.PersistentObjectTab[]): Vidyano.PersistentObjectTab[] {
        if (persistentObject.queryLayoutMode === Vidyano.PersistentObjectLayoutMode.FullPage)
            return [];

        return tabs ? tabs.filter(t => t.isVisible && t.tabGroupIndex === 1) : [];
    }

    private _detailTabsChanged() {
        if (!this.detailTabs || this.detailTabs.length === 0) {
            this.selectedDetailTab = null;
            return;
        }
    }

    private _masterTabsChanged() {
        if (!this.masterTabs || this.masterTabs.length === 0) {
            this.selectedMasterTab = null;
            return;
        }
    }

    private _selectedMasterTabChanged() {
        if (!this._cacheEntry)
            return;

        this._cacheEntry.selectedMasterTab = this.selectedMasterTab;
    }

    private _selectedDetailTabChanged() {
        if (!this._cacheEntry)
            return;

        this._cacheEntry.selectedDetailTab = this.selectedDetailTab;
    }

    private _computeLayout(persistentObject: Vidyano.PersistentObject, masterTabs: Vidyano.PersistentObjectTab[] = [], detailTabs: Vidyano.PersistentObjectTab[] = []): string {
        if (!persistentObject)
            return undefined;

        const hasDetailTabs = detailTabs.length > 0;
        const hasMasterTabs = masterTabs.length > 0;

        const layoutFlags = [hasDetailTabs ? (hasMasterTabs ? "master-detail" : "details-only") : "full-page"];
        if (hasDetailTabs)
            layoutFlags.push("dt");

        if (hasMasterTabs && (hasDetailTabs || masterTabs.length > 1))
            layoutFlags.push("mt");

        if (hasMasterTabs && masterTabs.some(t => t.parent.actions.some(a => a.isVisible || a.name === "Filter")))
            layoutFlags.push("ma");

        if (hasDetailTabs && detailTabs.some(t => t.parent.actions.some(a => a.isVisible || a.name === "Filter")))
            layoutFlags.push("da");

        return layoutFlags.join(" ");
    }

    private _computeLayoutMasterDetail(persistentObject: Vidyano.PersistentObject, masterTabs: Vidyano.PersistentObjectTab[] = [], detailTabs: Vidyano.PersistentObjectTab[] = []): boolean {
        return !!persistentObject && masterTabs.length > 0 && detailTabs.length > 0;
    }

    private _computeLayoutDetailsOnly(persistentObject: Vidyano.PersistentObject, masterTabs: Vidyano.PersistentObjectTab[] = [], detailTabs: Vidyano.PersistentObjectTab[] = []): boolean {
        return !!persistentObject && masterTabs.length === 0 && detailTabs.length > 0;
    }

    private _computeLayoutFullPage(persistentObject: Vidyano.PersistentObject, detailTabs: Vidyano.PersistentObjectTab[] = []): boolean {
        return !!persistentObject && detailTabs.length === 0;
    }

    private _computeLayoutMasterActions(persistentObject: Vidyano.PersistentObject, masterTabs: Vidyano.PersistentObjectTab[] = []): boolean {
        return !!persistentObject && masterTabs.some(t => t.target.actions.some(a => a.isVisible || a.name === "Filter"));
    }

    private _computeLayoutDetailActions(persistentObject: Vidyano.PersistentObject, detailTabs: Vidyano.PersistentObjectTab[] = []): boolean {
        return !!persistentObject && detailTabs.some(t => t.target.actions.some(a => a.isVisible || a.name === "Filter"));
    }

    private _computeLayoutMasterTabs(persistentObject: Vidyano.PersistentObject, masterTabs: Vidyano.PersistentObjectTab[] = [], detailTabs: Vidyano.PersistentObjectTab[] = []): boolean {
        return !!persistentObject && masterTabs.length > 0 && (detailTabs.length > 0 || masterTabs.length > 1);
    }

    private _computeLayoutDetailTabs(persistentObject: Vidyano.PersistentObject, detailTabs: Vidyano.PersistentObjectTab[] = []): boolean {
        return !!persistentObject && detailTabs.length > 0;
    }

    private _computeHasMasterTabs(tabs: Vidyano.PersistentObjectAttributeTab[]): boolean {
        return tabs && tabs.length > 1;
    }

    private _computeHasDetailTabs(tabs: Vidyano.PersistentObjectAttributeTab[]): boolean {
        return tabs && tabs.length > 0;
    }

    private _computeShowNavigation(persistentObject: Vidyano.PersistentObject) {
        return !persistentObject.isNew && persistentObject.ownerQuery?.totalItems > 0 && !persistentObject.isBulkEdit;
    }

    private _tabselect(e: CustomEvent) {
        let { name, tab }: { name?: string; tab?: Vidyano.PersistentObjectTab } = e.detail;

        if (!tab) {
            tab = this.masterTabs.find(t => t.name === name) || this.detailTabs.find(t => t.name === name);
            if (!tab)
                return;
        }

        if (this.masterTabs.indexOf(tab) >= 0)
            this.selectedMasterTab = tab;

        if (this.detailTabs.indexOf(tab) >= 0)
            this.selectedDetailTab = tab;

        e.stopPropagation();
    }

    private _persistentObjectNotificationChanged(notification: string) {
        if (!notification || !this.persistentObject || this.persistentObject.notificationType !== "Error")
            return;

        const firstAttributeWithValidationError = this.persistentObject.attributes.orderBy(attr => attr.offset).find(attr => !!attr.validationError);
        if (!firstAttributeWithValidationError)
            return;

        if (firstAttributeWithValidationError.tab !== this.selectedMasterTab && this.masterTabs.indexOf(firstAttributeWithValidationError.tab) >= 0)
            this.selectedMasterTab = firstAttributeWithValidationError.tab;
    }

    private _trackSplitter(e: Polymer.Gestures.TrackEvent) {
        if (e.detail.state === "track") {
            const px = parseInt(this.masterWidth);
            this.masterWidth = (px + e.detail.ddx) + "px";
        }
        else if (e.detail.state === "start") {
            this.app.isTracking = true;
            this.app.classList.add("dragging");
            if (this.masterWidth.endsWith("%"))
                this.masterWidth = (this.offsetWidth * (parseInt(this.masterWidth) / 100)).toString() + "px";
        }
        else if (e.detail.state === "end") {
            this.app.classList.remove("dragging");
            window.getSelection().removeAllRanges();

            if (this.masterWidth.endsWith("px")) {
                const px = parseInt(this.masterWidth);
                const newMasterWidth = 100 / this.offsetWidth * px;
                this.masterWidth = `${!isNaN(newMasterWidth) ? newMasterWidth.toString() : "40"}%`;
            }

            const persistentObjectSettings = this.persistentObject.service.application.userSettings["PersistentObjectSettings"] || (this.persistentObject.service.application.userSettings["PersistentObjectSettings"] = {});
            const thisPersistentObjectSettings = persistentObjectSettings[this.persistentObject.id] || (persistentObjectSettings[this.persistentObject.id] = {});
            thisPersistentObjectSettings["master-detail"] = this.masterWidth;

            this.persistentObject.service.application.saveUserSettings();
            this.app.isTracking = false;
        }

        e.stopPropagation();
    }

    private _hideActionBar(tab: Vidyano.PersistentObjectAttributeTab): boolean {
        if (!tab)
            return false;

        const config = this.app.configuration.getTabConfig(tab);
        if (!config)
            return false;

        return !!config.hideActionBar;
    }

    /**
     * Returns the navigation index of the persistent object within its owner query.
     * 
     * @param {Vidyano.PersistentObject} persistentObject - The persistent object to get the navigation index for.
     * @returns {string | undefined} The navigation index in the format "currentIndex / totalItems" or undefined if there is no owner query.
     */
    private _getNavigationIndex(persistentObject: Vidyano.PersistentObject) {
        if (!persistentObject.ownerQuery)
            return;

        // Find the index of the persistent object within the owner query
        const index = persistentObject.ownerQuery.items.findIndex(i => i.id === persistentObject.objectId);
        return `${index + 1} / ${persistentObject.ownerQuery.totalItems}${persistentObject.ownerQuery.hasMore ? "+" : ""}`;
    }

    private async _navigate(e: Polymer.Gestures.TapEvent) {
        let index = this.persistentObject.ownerQuery.items.findIndex(i => i.id === this.persistentObject.objectId);
        index += ((e.target as Button).getAttribute("data-direction") === "previous" ? -1 : 1);

        if (!this.persistentObject.ownerQuery.hasMore)
            index = (index + this.persistentObject.ownerQuery.totalItems) % this.persistentObject.ownerQuery.totalItems;

        if (index < 0)
            return;

        const currentPath = this.app.path;
        try {
            let targetItem: Vidyano.QueryResultItem = this.persistentObject.ownerQuery.items[index] || await (this.persistentObject.ownerQuery.getItemsByIndex(index))[0];
            if (targetItem == null) {
                targetItem = await this.persistentObject.ownerQuery.queueWork(async () => { 
                    return this.persistentObject.ownerQuery.items[index];
                });

                if (targetItem == null)
                    return;
            }

            // Check if the user navigated while the item was loading
            if (currentPath !== this.app.path)
                return;

            const targetPersistentObject = await targetItem.getPersistentObject(true);
            
            // Check if the user navigated while the persistent object was loading
            if (currentPath !== this.app.path)
                return;
            
            // Make sure to replace the current url so that back navigation takes the user to the query
            this.service.hooks.onOpen(targetPersistentObject, true);
        }
        catch (e) {
            this.app.showAlert(e, "Error")
        }
    }
}

@WebComponent.register({
    properties: {
        tab: Object,
        hideActionBar: Boolean
    }
})
export class PersistentObjectDetailsContent extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="vi-persistent-object-details-content.html">` }
}

@WebComponent.register({
    properties: {
        tabs: Object,
        tab: {
            type: Object,
            notify: true
        }
    }
})
export class PersistentObjectDetailsHeader extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="vi-persistent-object-details-header.html">` }
}