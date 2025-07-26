import type { Action } from "./action.js";
import type { ActionDefinition } from "./action-definition.js";
import type { ISubjectDisposer, PropertyChangedArgs } from "./observable";
import type { Service } from "./service.js";
import { ServiceObject } from "./service-object.js";

/**
 * Represents an action group action.
 */
interface IActionGroupAction {
    action: Action;
    observer: ISubjectDisposer;
}

/**
 * Represents a group of related actions that share common visibility and execution state.
 */
export class ActionGroup extends ServiceObject {
    #actions: IActionGroupAction[] = [];
    #canExecute: boolean = false;
    #isVisible: boolean = false;

    /**
     * Initializes a new instance of the ActionGroup class.
     * @param service - The associated service.
     * @param definition - The action definition that describes this group.
     */
    constructor(service: Service, public definition: ActionDefinition) {
        super(service);
    }

    /**
     * Adds an action to this group.
     * @param action - The action to add to this group.
     */
    addAction(action: Action): void {
        const index = this.#actions.findIndex(a => a.action === action);
        if (index >= 0)
            return;

        this.#actions.push({
            action: action,
            observer: action.propertyChanged.attach(this.#actionPropertyChanged.bind(this))
        });

        this.#setCanExecute(this.canExecute || action.canExecute);
        this.#setIsVisible(this.isVisible || action.isVisible);
    }

    /**
     * Removes an action from this group.
     * @param action - The action to remove from this group.
     */
    removeAction(action: Action): void {
        const index = this.#actions.findIndex(a => a.action === action);
        if (index < 0)
            return;

        const gAction = this.#actions.splice(index, 1)[0];
        gAction.observer();
    }

    /**
     * Gets all actions contained in this group.
     */
    get actions(): Action[] {
        return this.#actions.map(a => a.action);
    }

    /**
     * Gets the name of this action group.
     */
    get name(): string {
        return this.definition.name;
    }

    /**
     * Gets the display name of this action group.
     */
    get displayName(): string {
        return this.definition.displayName;
    }

    /**
     * Gets whether any action in this group can be executed.
     */
    get canExecute(): boolean {
        return this.#canExecute;
    }

    /**
     * Sets the canExecute state for this action group.
     */
    #setCanExecute(val: boolean): void {
        if (this.#canExecute === val)
            return;

        this.#canExecute = val;
        this.notifyPropertyChanged("canExecute", val, !val);
    }

    /**
     * Gets whether this action group is visible.
     */
    get isVisible(): boolean {
        return this.#isVisible;
    }

    /**
     * Sets the visibility state for this action group.
     */
    #setIsVisible(val: boolean): void {
        if (this.#isVisible === val)
            return;

        this.#isVisible = val;
        this.notifyPropertyChanged("isVisible", val, !val);
    }

    /**
     * Gets whether this action group is pinned based on its first action.
     */
    get isPinned(): boolean {
        return this.#actions[0] ? this.#actions[0].action.isPinned : false;
    }

    /**
     * Gets available options for this action group.
     */
    get options(): string[] {
        return null;
    }

    /**
     * Handles property changes on contained actions.
     * @param action - The action that changed.
     * @param detail - Details about the property that changed.
     */
    #actionPropertyChanged(action: Action, detail: PropertyChangedArgs): void {
        switch (detail.propertyName) {
            case "canExecute": {
                this.#setCanExecute(this.#actions.some(a => a.action.canExecute));
                break;
            }

            case "isVisible": {
                this.#setIsVisible(this.#actions.some(a => a.action.isVisible));
                break;
            }
        }
    }
}