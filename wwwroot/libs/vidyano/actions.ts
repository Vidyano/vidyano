import { Action, IActionExecuteOptions, Actions } from "./action.js";
import type { ActionDefinition } from "./action-definition.js";
import type { Service } from "./service.js";
import type { ServiceObjectWithActions } from "./service-object-with-actions.js";
import type { PersistentObject } from "./persistent-object.js";
import type { IExecuteMethodOperation, IOpenOperation } from "./client-operations.js";

Actions.CancelEdit = class CancelEdit extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);
        this.isVisible = this.parent.isEditing;
        this.canExecute = this.parent.stateBehavior.indexOf("StayInEdit") < 0 || this.parent.isDirty;
    }

    _onParentIsEditingChanged(isEditing: boolean) {
        this.isVisible = isEditing;
    }

    _onParentIsDirtyChanged(isDirty: boolean) {
        this.canExecute = this.parent.stateBehavior.indexOf("StayInEdit") < 0 || isDirty;
    }

    protected _onExecute({ menuOption, parameters, selectedItems, skipOpen, noConfirmation, throwExceptions }: IActionExecuteOptions): Promise<PersistentObject> {
        this.parent.cancelEdit();
        return Promise.resolve(null);
    }
}

Actions.CancelSave = class CancelSave extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);
    }

    protected _onExecute({ menuOption, parameters, selectedItems, skipOpen, noConfirmation, throwExceptions }: IActionExecuteOptions): Promise<PersistentObject> {
        this.service.hooks.onClose(this.parent);
        return Promise.resolve(null);
    }
}

Actions.Edit = class Edit extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);
        this.isVisible = !this.parent.isEditing;

        this.dependentActions = ["EndEdit", "CancelEdit"];
    }

    _onParentIsEditingChanged(isEditing: boolean) {
        this.isVisible = !isEditing;
    }

    protected _onExecute({ menuOption, parameters, selectedItems, skipOpen, noConfirmation, throwExceptions }: IActionExecuteOptions): Promise<PersistentObject> {
        this.parent.beginEdit();
        return Promise.resolve(null);
    }
}

Actions.EndEdit = class EndEdit extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);
        this.isVisible = this.parent.isEditing;
        this.canExecute = this.parent.isDirty;
    }

    _onParentIsEditingChanged(isEditing: boolean) {
        this.isVisible = isEditing;
    }

    _onParentIsDirtyChanged(isDirty: boolean) {
        this.canExecute = isDirty;
    }

    protected async _onExecute({ menuOption, parameters, selectedItems, skipOpen, noConfirmation, throwExceptions }: IActionExecuteOptions): Promise<PersistentObject> {
        await this.parent.save();
        if (String.isNullOrWhiteSpace(this.parent.notification) || this.parent.notificationType !== "Error") {
            const edit = this.parent.actions["Edit"];
            const endEdit = this.parent.actions["EndEdit"];

            if (this.parent.stateBehavior.indexOf("StayInEdit") !== -1 && endEdit != null) {
                endEdit.canExecute = false;
            } else if (edit) {
                edit.isVisible = true;
                if (endEdit != null)
                    endEdit.isVisible = false;
            }
        }

        return this.parent;
    }
}

Actions.ExportToCsv = class ExportToCsv extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);
    }

    protected _onExecute({ menuOption, parameters, selectedItems, skipOpen, noConfirmation, throwExceptions }: IActionExecuteOptions): Promise<PersistentObject> {
        this.service._getStream(null, "Query.ExportToCsv", this.parent, this.query, null, this._getParameters(parameters, menuOption));
        return Promise.resolve(null);
    }
}

Actions.ExportToExcel = class ExportToExcel extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);
    }

    protected _onExecute({ menuOption, parameters, selectedItems, skipOpen, noConfirmation, throwExceptions }: IActionExecuteOptions): Promise<PersistentObject> {
        this.service._getStream(null, "Query.ExportToExcel", this.parent, this.query, null, this._getParameters(parameters, menuOption));
        return Promise.resolve(null);
    }
}

Actions.Filter = class Filter extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);
        this.isVisible = false;
    }
}

Actions.RefreshQuery = class RefreshQuery extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);
        this.isVisible = false;
    }

    protected _onExecute({ menuOption, parameters, selectedItems, skipOpen, noConfirmation, throwExceptions }: IActionExecuteOptions): Promise<any> {
        return this.query.search();
    }
}

Actions.Save = class Save extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);
        this.dependentActions = ["CancelSave"];
        this.canExecute = this.parent.isDirty || this.parent.isNew;
    }

    _onParentIsDirtyChanged(isDirty: boolean) {
        this.canExecute = isDirty;
    }

    protected async _onExecute({ menuOption, parameters, selectedItems, skipOpen, noConfirmation, throwExceptions }: IActionExecuteOptions): Promise<PersistentObject> {
        const wasNew = this.parent.isNew;

        await this.parent.save();

        // NOTE: Check if operations will open a new persistent object anyway
        if (this.service.queuedClientOperations.length > 0 &&
            this.service.queuedClientOperations.some(o => {
                if (o.type === "Open") {
                    (<IOpenOperation>o).replace = true;
                    return true;
                }
                else if (o.type === "ExecuteMethod") {
                    const eo = <IExecuteMethodOperation>o;
                    if (eo.name === "navigate") {
                        eo.arguments[1] = true;
                        return true;
                    }
                }

                return false;
            })
        )
            return this.parent;

        if (String.isNullOrWhiteSpace(this.parent.notification) || this.parent.notificationType !== "Error") {
            if (wasNew && this.parent.ownerAttributeWithReference == null && this.parent.stateBehavior.indexOf("OpenAfterNew") !== -1) {
                const newPO = await this.parent.queueWork(() => this.service.getPersistentObject(this.parent.parent, this.parent.id, this.parent.objectId));
                newPO.ownerQuery = this.parent.ownerQuery;
                this.service.hooks.onOpen(newPO, true);
            }
            else
                this.service.hooks.onClose(this.parent);
        }

        return this.parent;
    }
}

Actions.ShowHelp = class ShowHelp extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);
    }

    protected async _onExecute({ menuOption, parameters, selectedItems, skipOpen, noConfirmation, throwExceptions }: IActionExecuteOptions): Promise<PersistentObject> {
        const owner = this.query ? this.query.persistentObject : this.parent;
        const helpWindow = window.open();

        try {
            const po = await this.service.executeAction("PersistentObject.ShowHelp", owner, null, null);

            if (po != null) {
                if (po.fullTypeName === "Vidyano.RegisteredStream" || po.getAttributeValue("Type") === "0") {
                    helpWindow.close();
                    this.service._getStream(po);
                } else {
                    helpWindow.location.href = po.getAttributeValue("Document");
                    helpWindow.focus();
                }
            }
            else
                helpWindow.close();
        }
        catch (e) {
            helpWindow.close();
            this.owner.setNotification(e);
        }

        return null;
    }
}

/* tslint:disable:class-name */
Actions.viConfigurePO = class viConfigurePO extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);

        this.isVisible = false;
    }
}
/* tslint:enable:class-name */

/* tslint:disable:class-name */
Actions.viConfigureQuery = class viConfigureQuery extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);

        this.isVisible = false;
    }
}
/* tslint:enable:class-name */

/* tslint:disable:class-name */
Actions.viSearch = class viSearch extends Action {
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions) {
        super(service, definition, owner);

        this.isVisible = this.parent == null || this.parent.fullTypeName === "Vidyano.Search";

        if (this.parent != null && this.parent.fullTypeName === "Vidyano.Search")
            this._isPinned = false;
    }
}
/* tslint:enable:class-name */