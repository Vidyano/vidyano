import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { Dialog } from "components/dialog/dialog"
import { SizeTrackerEvent } from "components/size-tracker/size-tracker"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        persistentObject: Object,
        currentTab: {
            type: Object,
            readOnly: true
        },
        canPrevious: {
            type: Boolean,
            value: false,
            computed: "_computeCanPrevious(currentTab, persistentObject.tabs.*)"
        },
        canNext: {
            type: Boolean,
            value: true,
            computed: "_computeCanNext(currentTab, hasPendingAttributes, persistentObject.isBusy, persistentObject.tabs.*)"
        },
        canFinish: {
            type: Boolean,
            value: false,
            computed: "_computeCanFinish(currentTab, canNext)"
        },
        hasPendingAttributes: {
            type: Boolean,
            computed: "_computeHasPendingAttributes(currentTab.attributes, currentTab.attributes.*, persistentObject.lastUpdated)"
        },
        visibleTabs: {
            type: Array,
            computed: "_computeVisibleTabs(persistentObject.tabs, persistentObject.tabs.*)"
        }
    },
    forwardObservers: [
        "persistentObject.isBusy",
        "currentTab.attributes.*.value",
        "persistentObject.lastUpdated",
        "persistentObject.tabs.*.isVisible"
    ],
    listeners: {
        "vi-persistent-object-tab-inner-size-changed": "_tabInnerSizeChanged"
    },
    mediaQueryAttributes: true
})
export class PersistentObjectWizardDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="persistent-object-wizard-dialog.html">`); }

    readonly currentTab: Vidyano.PersistentObjectAttributeTab; private _setCurrentTab: (tab: Vidyano.PersistentObjectTab) => void;
    readonly canPrevious: boolean;
    readonly canNext: boolean;
    readonly canFinish: boolean;
    readonly visibleTabs: Vidyano.PersistentObjectAttributeTab[];
    hasPendingAttributes: boolean;

    constructor(public readonly persistentObject: Vidyano.PersistentObject) {
        super();
    }

    ready() {
        super.ready();

        this.persistentObject.beginEdit();
        this._setCurrentTab(this.visibleTabs.find(tab => tab.isVisible));
    }

    connectedCallback() {
        super.connectedCallback();

        const width = parseInt(getComputedStyle(this).getPropertyValue("--vi-persistent-object-dialog-base-width-base")) * (this.currentTab.columnCount || 1);
        this.updateStyles({
            "--vi-persistent-object-dialog-computed-width": `${width}px`
        });
    }

    private _tabInnerSizeChanged(e: SizeTrackerEvent) {
        e.stopPropagation();

        if (!e.detail.height)
            return;

        this.$.main.style.height = `${e.detail.height}px`;
        this.fire("sizechanged", e.detail, {
            bubbles: true,
            composed: true
        });
    }

    private _computeVisibleTabs(tabs: Vidyano.PersistentObjectAttributeTab[]): Vidyano.PersistentObjectAttributeTab[] {
        return tabs.filter(tab => tab.isVisible);
    }

    private _computeCanPrevious(currentTab: Vidyano.PersistentObjectAttributeTab): boolean {
        return !!currentTab && this.visibleTabs.indexOf(currentTab) > 0;
    }

    private _previous(e: Polymer.Gestures.TapEvent) {
        this._setCurrentTab(this.visibleTabs[Math.max(this.visibleTabs.indexOf(this.currentTab) - 1, 0)]);
    }

    private _computeCanNext(currentTab: Vidyano.PersistentObjectAttributeTab, hasPendingAttributes: boolean, isBusy: boolean): boolean {
        if (isBusy || hasPendingAttributes)
            return false;

        return !!currentTab && this.visibleTabs.indexOf(currentTab) < this.visibleTabs.length - 1;
    }

    private _next(e: Polymer.Gestures.TapEvent) {
        this.persistentObject.queueWork(async () => {
            const result = await this.persistentObject.service.executeAction("Wizard.NextStep", this.persistentObject, undefined, undefined, { CurrentTab: this.currentTab.key, Attributes: this.currentTab.attributes.map(a => a.name).join("\n") });
            Vidyano._internal(this.persistentObject).refreshFromResult(result);

            if (this.currentTab.attributes.some(attr => !!attr.validationError))
                return;

            this._setCurrentTab(this.visibleTabs[Math.min(this.visibleTabs.indexOf(this.currentTab) + 1, this.visibleTabs.length - 1)]);
        });
    }

    private _computeCanFinish(currentTab: Vidyano.PersistentObjectAttributeTab, canNext: boolean): boolean {
        if (canNext)
            return false;

        return !!currentTab && this.visibleTabs.indexOf(currentTab) === this.visibleTabs.length - 1;
    }

    private _computeHasPendingAttributes(attributes: Vidyano.PersistentObjectAttribute[]): boolean {
        return attributes && attributes.some(attr => attr.isRequired && (attr.value == null || (attr.rules && attr.rules.contains("NotEmpty") && attr.value === "")));
    }

    private async _finish() {
        if (await this.persistentObject.save())
            this.close(this.persistentObject);
    }

    private _onCaptureTab() {
        // Skip default tab navigation behavior
    }
}