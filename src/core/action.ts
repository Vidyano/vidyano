import type { ActionDefinition } from "./action-definition.js";
import { ActionGroup } from "./action-group.js";
import type { QueryResultItem } from "./query-result-item.js";
import type { NotificationType, Service } from "./service.js";
import { ServiceObject } from "./service-object.js";
import type { ServiceObjectWithActions } from "./service-object-with-actions.js";
import type { PersistentObject } from "./persistent-object.js";
import { Query } from "./query.js";
import { PersistentObjectSymbols, QuerySymbols, _internal } from "./_internals.js";

/**
 * Options for executing an action.
 */
export interface IActionExecuteOptions {
    /**
     * The selected menu option index, if applicable.
     */
    menuOption?: number;

    /**
     * Additional parameters for the action.
     */
    parameters?: any;

    /**
     * Selected query result items on which to execute the action.
     */
    selectedItems?: QueryResultItem[];

    /**
     * If true, the resulting object should not be opened.
     */
    skipOpen?: boolean;

    /**
     * If true, skip confirmation dialogs.
     */
    noConfirmation?: boolean;

    /**
     * If true, throw exceptions instead of setting the notification.
     */
    throwExceptions?: boolean;
}

/**
 * Arguments for selected items actions.
 */
export interface ISelectedItemsActionArgs {
    /**
     * The name of the action.
     */
    name: string;

    /**
     * Flag indicating if the action is visible.
     */
    isVisible: boolean;

    /**
     * Flag indicating if the action can be executed.
     */
    canExecute: boolean;
    
    /**
     * Available options for the action.
     */
    options: string[];
}

/**
 * Handler for action execution.
 */
export type ActionExecutionHandler = (action: Action, worker: Promise<PersistentObject>, args: IActionExecuteOptions) => boolean | void | Promise<void>;

/**
 * Function to dispose an action execution handler.
 */
export type ActionExecutionHandlerDispose = () => void;

/**
 * Represents an executable Vidyano or custom action.
 */
export class Action extends ServiceObject {
    #targetType: string;
    #query: Query;
    #parent: PersistentObject;
    #isVisible: boolean = true;
    #canExecute: boolean;
    #block: boolean;
    #parameters: any = {};
    #offset: number;
    #options: string[] = [];
    #executeHandlers: ActionExecutionHandler[];
    #group: ActionGroup;
    
    /**
     * Flag indicating if this action should appear in the pinned section.
     */
    protected _isPinned: boolean;
    
    /**
     * Function that determines if the action can execute based on selection count.
     */
    selectionRule: (count: number) => boolean;
    
    /**
     * The display name of the action.
     */
    displayName: string;
    
    /**
     * List of action names that depend on this action.
     */
    dependentActions: string[] = [];

    /**
     * Initializes a new instance of the Action class.
     * 
     * @param service - The service that provides backend functionality.
     * @param definition - The action definition.
     * @param owner - The owner of this action.
     */
    constructor(service: Service,  public definition: ActionDefinition,  public owner: ServiceObjectWithActions) {
        super(service);

        this.displayName = definition.displayName;
        this.selectionRule = definition.selectionRule;
        this._isPinned = definition.isPinned;
        this.#offset = definition.offset;

        if (owner[QuerySymbols.IsQuery]) {
            this.#targetType = "Query";
            this.#query = <Query>owner;
            this.#parent = this.query.parent;
            if (definition.name === "New" && this.query.persistentObject != null && !String.isNullOrEmpty(this.query.persistentObject.newOptions))
                this.#setOptions(this.query.persistentObject.newOptions.split(";"));

            this.query.propertyChanged.attach((source, detail) => {
                if (detail.propertyName === "selectedItems") {
                    let options: string[];

                    if (definition.name === "New" && this.query.persistentObject != null && !String.isNullOrEmpty(this.query.persistentObject.newOptions))
                        options = this.query.persistentObject.newOptions.split(";");
                    else
                        options = definition.options.slice();

                    const args: ISelectedItemsActionArgs = {
                        name: this.name,
                        isVisible: this.isVisible,
                        canExecute: this.selectionRule(detail.newValue ? detail.newValue.length : 0),
                        options: options
                    };
                    this.service.hooks.onSelectedItemsActions(this.#query, detail.newValue, args);

                    this.canExecute = args.canExecute;
                    this.#setOptions(args.options);
                }
            });

            this.canExecute = this.selectionRule(0);
        }
        else if (owner[PersistentObjectSymbols.IsPersistentObject]) {
            this.#targetType = "PersistentObject";
            this.#parent = <PersistentObject>owner;
            this.canExecute = true;

            this.#parent.propertyChanged.attach((_, detail) => {
                if (detail.propertyName === "isEditing")
                    this._onParentIsEditingChanged(detail.newValue);
                else if (detail.propertyName === "isDirty")
                    this._onParentIsDirtyChanged(detail.newValue);
            });
        }
        else
            throw "Invalid owner-type.";

        if (definition.options.length > 0)
            this.#options = definition.options.slice();
    }

    /**
     * Gets the parent persistent object associated with this action.
     */
    get parent(): PersistentObject {
        return this.#parent;
    }

    /**
     * Gets the query associated with this action.
     */
    get query(): Query {
        return this.#query;
    }

    /**
     * Gets or sets the display order offset.
     */
    get offset(): number {
        return this.#offset;
    }
    set offset(value: number) {
        this.#offset = value;
    }

    /**
     * Gets the name of the action.
     */
    get name(): string {
        return this.definition.name;
    }

    /**
     * Gets the action group this action belongs to, if any.
     */
    get group(): ActionGroup {
        return this.#group;
    }

    /**
     * Gets or sets whether this action can be executed.
     */
    get canExecute(): boolean {
        return this.#canExecute && !this.#block;
    }
    set canExecute(val: boolean) {
        if (this.#canExecute === val)
            return;

        this.#canExecute = val;
        this.notifyPropertyChanged("canExecute", val, !val);
    }

    /**
     * Gets or sets the block state which temporarily disables the action.
     */
    get block(): boolean {
        return this.#block;
    }
    set block(block: boolean) {
        const oldCanExecute = this.canExecute;
        this.#block = block;

        if (this.canExecute !== oldCanExecute)
            this.notifyPropertyChanged("canExecute", this.canExecute, oldCanExecute);
    }

    /**
     * Gets or sets whether this action is visible.
     */
    get isVisible(): boolean {
        return this.#isVisible;
    }
    set isVisible(val: boolean) {
        if (this.#isVisible === val)
            return;

        this.#isVisible = val;
        this.notifyPropertyChanged("isVisible", val, !val);
    }

    /**
     * Gets whether this action should be shown in the pinned section.
     */
    get isPinned(): boolean {
        return this._isPinned;
    }

    /**
     * Gets the options available for this action.
     */
    get options(): string[] {
        return this.#options;
    }

    /**
     * Sets the options available for this action.
     * @param options - The new options.
     */
    #setOptions(options: string[]) {
        if (this.#options === options)
            return;

        const oldOptions = this.#options;
        this.notifyPropertyChanged("options", this.#options = options, oldOptions);
    }

    /**
     * Subscribes to action execution events.
     * @param handler - The handler to call when the action executes.
     * @returns A function to dispose the subscription.
     */
    subscribe(handler: ActionExecutionHandler): ActionExecutionHandlerDispose {
        if (!this.#executeHandlers)
            this.#executeHandlers = [];

        this.#executeHandlers.push(handler);
        return () => this.#executeHandlers.splice(this.#executeHandlers.indexOf(handler), 1)[0];
    }

    /**
     * Executes this action with the provided options.
     * @param options - Options for action execution.
     * @returns A promise that resolves to the resulting persistent object, or null.
     */
    async execute(options: IActionExecuteOptions = {}): Promise<PersistentObject> {
        if (!this.canExecute && !(options.selectedItems != null && this.selectionRule(options.selectedItems.length)))
            return null;

        try {
            let workHandlerResolve: (po: PersistentObject) => void;
            let workHandlerReject: (reason?: any) => void;

            const workHandler = new Promise<PersistentObject>((resolve, reject) => {
                workHandlerResolve = resolve;
                workHandlerReject = reject;
            });

            if (this.#executeHandlers && this.#executeHandlers.length > 0) {
                for (let i = 0; i < this.#executeHandlers.length; i++) {
                    if (this.#executeHandlers[i](this, workHandler, options) === false) {
                        workHandlerResolve(null);
                        return workHandler;
                    }
                }
            }

            try {
                workHandlerResolve(await this._onExecute(options));
            }
            catch (e) {
                workHandlerReject(e);
            }

            return workHandler;
        }
        catch (e) {
            if (options.throwExceptions)
                throw e;
            else
                this.owner.setNotification(e);
        }
    }

    /**
     * Internal execution handler for the action.
     * @param options - Options for action execution.
     * @returns A promise that resolves to the resulting persistent object, or null.
     */
    protected async _onExecute(options: IActionExecuteOptions): Promise<PersistentObject> {
        let { menuOption, parameters, selectedItems, skipOpen, noConfirmation } = options;
        if (this.definition.confirmation && (!noConfirmation) && !await this.service.hooks.onActionConfirmation(this, menuOption))
            return null;

        return this.owner.queueWork(async () => {
            parameters = this._getParameters(parameters, menuOption);

            if (selectedItems == null && this.query) {
                if (this.query.selectAll.allSelected) {
                    if (!this.query.selectAll.inverse)
                        selectedItems = [];
                    else
                        selectedItems = this.query.items.filter(i => !i.isSelected);
                }
                else
                    selectedItems = this.query.selectedItems;

                selectedItems = selectedItems.filter(i => !i.ignoreSelect);
            }

            let po = await this.service.executeAction(this.#targetType + "." + this.definition.name, this.parent, this.query, selectedItems, parameters);
            if (po) {
                if (po.fullTypeName === "Vidyano.Notification") {
                    if (po.objectId != null && JSON.parse(po.objectId).dialog) {
                        this.#setNotification();
                        this.service.hooks.onMessageDialog(po.notificationType, po.notification, false, this.service.hooks.service.getTranslatedMessage("OK"));
                    }
                    else {
                        if (this.query && this.definition.refreshQueryOnCompleted)
                        /* tslint:disable:no-var-keyword */ var notificationPO = po; /* tslint:enable:no-var-keyword */
                        else
                            this.#setNotification(po.notification, po.notificationType, po.notificationDuration);
                    }

                    po = null;
                } else if (po.fullTypeName === "Vidyano.RegisteredStream") {
                    await this.service.getStream(po);
                } else if (po.fullTypeName === "Vidyano.AddReference") {
                    const query = po.queries[0];
                    query.parent = this.parent;

                    const selectedItems = await this.service.hooks.onSelectReference(query);
                    if (selectedItems && selectedItems.length > 0) {
                        try {
                            await this.service.executeAction("Query.AddReference", this.parent, query, selectedItems, { AddAction: this.name }, true);
                        }
                        catch (e) {
                            this.#setNotification(e);
                        }

                        if (this.query)
                            this.query.search();
                    }
                } else if (this.parent != null && (po.fullTypeName === this.parent.fullTypeName || po.isNew === this.parent.isNew) && po.id === this.parent.id && po.objectId === this.parent.objectId) {
                    _internal(this.parent).refreshFromResult(po, true);
                } else {
                    po.ownerQuery = this.query;
                    po.ownerPersistentObject = this.parent;

                    if (!skipOpen)
                        this.service.hooks.onOpen(po, false, true);
                }
            }

            if (this.query != null && this.definition.refreshQueryOnCompleted) {
                // NOTE: Don't wait for search to complete
                this.query.search({ keepSelection: this.definition.keepSelectionOnRefresh }).then(() => {
                    if (notificationPO && !this.query.notification)
                        this.#setNotification(notificationPO.notification, notificationPO.notificationType, notificationPO.notificationDuration);
                });
            }

            return po;
        });
    }

    /**
     * Gets parameters for the action execution.
     * @param parameters - Base parameters.
     * @param option - Option index.
     * @returns Combined parameters.
     */
    _getParameters(parameters: any, option: any): any {
        if (parameters == null)
            parameters = {};
            
        if (this.#parameters != null)
            parameters = Object.assign({ ...this.#parameters }, parameters);
            
        if (this.options != null && this.options.length > 0 && option >= 0) {
            parameters["MenuOption"] = option;
            parameters["MenuLabel"] = this.options[option];
        }
        else if (option != null)
            parameters["MenuOption"] = option;
            
        return parameters;
    }

    /**
     * Handles changes to the parent's editing state.
     * @param isEditing - The new editing state.
     */
    protected _onParentIsEditingChanged(isEditing: boolean) {
        // Noop
    }

    /**
     * Handles changes to the parent's dirty state.
     * @param isDirty - The new dirty state.
     */
    protected _onParentIsDirtyChanged(isDirty: boolean) {
        // Noop
    }

    /**
     * Sets a notification on the parent or query.
     * @param notification - The notification message.
     * @param notificationType - The type of notification.
     * @param notificationDuration - The duration of the notification.
     */
    #setNotification(notification: string = null, notificationType: NotificationType = "Error", notificationDuration?: number) {
        (this.query || this.parent).setNotification(notification, notificationType, notificationDuration);
    }

    /**
     * Gets an action by name for the given owner.
     * @param service - The service instance.
     * @param name - The action name.
     * @param owner - The owner of the action.
     * @returns The action instance.
     */
    static get(service: Service, name: string, owner: ServiceObjectWithActions): Action {
        let definition = service.actionDefinitions[name];
        if (definition == null) {
            definition = service.hooks.onActionDefinitionNotFound(name);
            if (definition == null)
                return null;
        }

        const hook = Actions[name];
        return service.hooks.onConstructAction(service, hook != null ? new hook(service, definition, owner) : new Action(service, definition, owner));
    }

    /**
     * Adds actions to the owner.
     * @param service - The service instance.
     * @param owner - The owner to add actions to.
     * @param actions - The array of actions.
     * @param actionNames - Names of actions to add.
     */
    static addActions(service: Service, owner: ServiceObjectWithActions, actions: Action[], actionNames: string[]) {
        if (actionNames == null || actionNames.length === 0)
            return;

        actionNames.forEach(actionName => {
            const action = Action.get(service, actionName, owner);
            if (!action)
                return;

            action.offset = actions.length;
            actions.push(action);

            Action.addActions(service, owner, actions, action.dependentActions);
        });

        const actionGroups: { [name: string]: ActionGroup } = {};
        actions.forEach(action => {
            if (action.definition.groupDefinition) {
                if (!actionGroups[action.definition.groupDefinition.name])
                    actionGroups[action.definition.groupDefinition.name] = new ActionGroup(service, action.definition.groupDefinition);

                actionGroups[action.definition.groupDefinition.name].addAction(action);
                action.#group = actionGroups[action.definition.groupDefinition.name];
            }
        });
    }
}

/**
 * Registry of action implementations.
 */
export let Actions: {[name: string]: typeof Action} = {};