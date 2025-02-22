import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import { App } from "../app/app.js"
import { Button } from "../button/button.js"
import { Dialog } from "../dialog/dialog.js"
import "../notification/notification.js"
import "../persistent-object-tab-presenter/persistent-object-tab-presenter.js"
import { SizeTrackerEvent } from "../size-tracker/size-tracker.js"
import { WebComponent } from "../web-component/web-component.js"

export interface IPersistentObjectDialogOptions {
    noHeader?: boolean;
    saveLabel?: string;
    save?: (po: Vidyano.PersistentObject, close: () => void) => void;
    noCancel?: boolean;
    cancel?: (close: () => void) => void;
}

@WebComponent.register({
    properties: {
        persistentObject: Object,
        tab: {
            type: Object,
            computed: "_computeTab(persistentObject, isConnected)"
        },
        readOnly: {
            type: Boolean,
            computed: "_computeReadOnly(tab)"
        },
        canSave: {
            type: Boolean,
            computed: "_computeCanSave(persistentObject.isBusy, persistentObject.dialogSaveAction.canExecute)"
        },
        cancelLabel: {
            type: String,
            computed: "_computeCancelLabel(app, persistentObject.isDirty)"
        },
        saveLabel: {
            type: String,
            computed: "_computeSaveLabel(app)"
        },
        dialogActions: {
            type: Array,
            computed: "_computeDialogActions(persistentObject, app)"
        },
        options: {
            type: Object,
            readOnly: true
        },
        showNavigation: {
            type: Boolean,
            computed: "_computeShowNavigation(persistentObject, app)"
        },
    },
    forwardObservers: [
        "persistentObject.isBusy",
        "persistentObject.isDirty",
        "persistentObject.dialogSaveAction.canExecute"
    ],
    listeners: {
        "vi-persistent-object-tab-inner-size-changed": "_tabInnerSizeChanged"
    },
    keybindings: {
        "ctrl+s": "_keyboardSave"
    },
    mediaQueryAttributes: true
})
export class PersistentObjectDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="persistent-object-dialog.html">`) }

    private _saveHook: (po: Vidyano.PersistentObject) => Promise<any>;
    readonly options: IPersistentObjectDialogOptions; private _setOptions: (options: IPersistentObjectDialogOptions) => void;
    tab: Vidyano.PersistentObjectAttributeTab;
    readonly showNavigation: boolean;

    constructor(public persistentObject: Vidyano.PersistentObject, _options: IPersistentObjectDialogOptions = {}) {
        super();

        this._setOptions(_options || null);
        persistentObject.beginEdit();
    }

    private _keyboardSave(e: KeyboardEvent) {
        if (document.activeElement && document.activeElement instanceof HTMLInputElement)
            document.activeElement.blur();

        e.stopPropagation();
        this._save();
    }

    private async _save() {
        if (this.options.save)
            this.options.save(this.persistentObject, () => this.close(this.persistentObject));
        else {
            const wasNew = this.persistentObject.isNew;
            await this.persistentObject.dialogSaveAction.execute();

            if (String.isNullOrWhiteSpace(this.persistentObject.notification) || this.persistentObject.notificationType !== "Error") {
                if (wasNew && this.persistentObject.ownerAttributeWithReference == null && this.persistentObject.stateBehavior.indexOf("OpenAfterNew") !== -1) {
                    try {
                        const po2 = await this.persistentObject.queueWork(() => this.persistentObject.service.getPersistentObject(this.persistentObject.parent, this.persistentObject.id, this.persistentObject.objectId));
                        this.persistentObject.service.hooks.onOpen(po2, true);
                        this.close(this.persistentObject);
                    }
                    catch (e) {
                        this.close(this.persistentObject);
                        const owner: Vidyano.ServiceObjectWithActions = this.persistentObject.ownerQuery || this.persistentObject.parent;
                        if (!!owner)
                            owner.setNotification(e);
                    }
                }
                else
                    this.close(this.persistentObject);
            }
        }
    }

    private _cancel() {
        if (this.showNavigation && this.persistentObject.isDirty) {
            this.persistentObject.cancelEdit();
            this.persistentObject.beginEdit();
            return;
        }

        if (this.options.cancel)
            this.options.cancel(() => this.cancel());
        else if (this.persistentObject) {
            this.persistentObject.cancelEdit();
            this.cancel();
        }
    }

    private _computeCanSave(isBusy: boolean, canExecute: boolean): boolean {
        return !isBusy && canExecute;
    }

    private _computeCancelLabel(app: App, isDirty: boolean): string {
        if (!app)
            return null;

        return isDirty ? this.translateMessage("Cancel") : this.translateMessage("Close");
    }

    private _computeSaveLabel(app: App): string {
        if (!app)
            return null;

        let label = this.options.saveLabel;
        if (!label) {
            const endEdit = this.persistentObject.dialogSaveAction;
            if (endEdit)
                label = endEdit.displayName;
        }

        return label || this.translateMessage("Save");
    }

    private _computeTab(persistentObject: Vidyano.PersistentObject, isConnected: boolean): Vidyano.PersistentObjectAttributeTab {
        if (!persistentObject || !isConnected)
            return null;

        const tab = <Vidyano.PersistentObjectAttributeTab>persistentObject.tabs.find(tab => tab instanceof Vidyano.PersistentObjectAttributeTab);
        tab.columnCount = tab.columnCount > 1 ? tab.columnCount : 1;

        const width = parseInt(getComputedStyle(this).getPropertyValue("--vi-persistent-object-dialog-base-width-base")) * tab.columnCount
        this.style.setProperty("--vi-persistent-object-dialog-computed-width", `${width}px`);

        return tab;
    }

    private _computeReadOnly(tab: Vidyano.PersistentObjectAttributeTab): boolean {
        return !!tab && !tab.parent.isNew && !tab.attributes.some(attribute => !attribute.isReadOnly && attribute.isVisible);
    }

    private _computeDialogActions(persistentObject: Vidyano.PersistentObject): Vidyano.Action[] {
        return persistentObject.actions.filter(a => a.definition.showedOn.some(s => s === "Dialog"));
    }

    private _computeHideCancel(readOnly: boolean, noCancel: boolean): boolean {
        return readOnly || noCancel;
    }

    private _computeShowNavigation(persistentObject: Vidyano.PersistentObject, app: App): boolean {
        const config = app.configuration.getPersistentObjectConfig(persistentObject);
        if (!config)
            return false;

        return Boolean.parse(config.configs["show-dialog-navigation"]);
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
        if (this.persistentObject.isDirty) {
            const result = await this.app.showMessageDialog( {
                title: this.service.getTranslatedMessage("PageWithUnsavedChanges"),
                noClose: true,
                message: this.service.getTranslatedMessage("ConfirmLeavePage"),
                actions: [
                    this.service.getTranslatedMessage("StayOnThisPage"), // 0
                    this.service.getTranslatedMessage("LeaveThisPage") // 1
                ]
            });

            if (result !== 1)
                return;
        }

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

            this.persistentObject = await targetItem.getPersistentObject(true);
        }
        catch (e) {
            this.app.showAlert(e, "Error")
        }
    }

    private _executeExtraAction(e: Polymer.Gestures.TapEvent) {
        const action = e.model.action as Vidyano.Action;
        if (!action.canExecute)
            return;

        action.execute();
    }

    private _onCaptureTab() {
        // Skip default tab navigation behavior
    }

    private _tabInnerSizeChanged(e: SizeTrackerEvent) {
        e.stopPropagation();

        if (!e.detail.height)
            return;

        this.fire("sizechanged", e.detail, {
            bubbles: true,
            composed: true
        });
    }
}