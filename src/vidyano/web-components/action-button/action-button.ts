import { html, nothing, unsafeCSS } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { property, state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import * as IconRegister from "components/icon/icon-register";
import { computed, observer, WebComponent } from "components/web-component/web-component";
import { IConfigurableAction, WebComponentConfigurationController } from "components/web-component/web-component-configuration-controller";
import { Popup } from "components/popup/popup";
import styles from "./action-button.css";

export class ActionButton extends WebComponent {
    static styles = unsafeCSS(styles);

    #lastIconState: boolean = false;

    /** The action or action group this button executes */
    @property({ type: Object })
    action: Vidyano.Action | Vidyano.ActionGroup;

    /** The query result item this action operates on (for row-level actions) */
    @property({ type: Object })
    item: Vidyano.QueryResultItem;

    /** The name of the action */
    @property({ type: String, reflect: true })
    @computed(function(this: ActionButton, action: Vidyano.Action | Vidyano.ActionGroup): string {
        return action ? action.name : null;
    }, "action")
    declare readonly name: string;

    /** The icon to display for the action */
    @property({ type: String })
    @computed(function(this: ActionButton, action: Vidyano.Action): string {
        if (!action)
            return "";

        return action.isPinned && !IconRegister.exists(action.definition.icon) ? "Action_Default$" : action.definition.icon;
    }, "action")
    declare readonly icon: string;

    /** Whether the action has a valid icon */
    @property({ type: Boolean, reflect: true })
    @computed(function(this: ActionButton, icon: string): boolean {
        return !String.isNullOrEmpty(icon) && IconRegister.exists(icon);
    }, "icon")
    declare readonly hasIcon: boolean;

    /** Whether to show icon spacing placeholder (in overflow/grouped mode without icon) */
    @property({ type: Boolean, reflect: true })
    @computed(function(this: ActionButton, overflow: boolean, grouped: boolean, hasIcon: boolean): boolean {
        return (overflow || grouped) && !hasIcon;
    }, "overflow", "grouped", "hasIcon")
    declare readonly iconSpace: boolean;

    /** Whether the action is pinned */
    @property({ type: Boolean, reflect: true })
    @computed(function(this: ActionButton): boolean {
        return this.action?.isPinned;
    }, "action.isPinned")
    declare readonly pinned: boolean;

    /** Hide the action label (show only icon) */
    @property({ type: Boolean, reflect: true })
    noLabel: boolean = false;

    /** Force the label to be shown even when pinned */
    @property({ type: Boolean, reflect: true })
    forceLabel: boolean = false;

    /** Display in overflow menu style */
    @property({ type: Boolean, reflect: true })
    overflow: boolean = null;

    @state()
    canExecute: boolean = false;

    /** Whether the action button is disabled */
    @property({ type: Boolean, reflect: true })
    @computed(function(this: ActionButton, canExecute: boolean): boolean {
        return !canExecute;
    }, "canExecute")
    declare readonly disabled: boolean;

    /** Whether the action button is hidden */
    @property({ type: Boolean, reflect: true })
    @observer(function(this: ActionButton) {
        this.dispatchEvent(new CustomEvent("sizechanged", {
            bubbles: true,
            composed: true
        }));
    })
    hidden: boolean = false;

    @state()
    options: Vidyano.KeyValuePair<number, string>[] = null;

    /** Open dropdown menu on hover instead of click */
    @property({ type: Boolean, reflect: true })
    openOnHover: boolean = null;

    /** Display as a grouped action in an action group */
    @property({ type: Boolean, reflect: true })
    grouped: boolean = null;

    /** The tooltip title for the action button */
    @property({ type: String, reflect: true })
    @computed(function(this: ActionButton, action: Vidyano.Action, pinned: boolean): string {
        return pinned ? action.displayName : null;
    }, "action", "pinned")
    declare readonly title: string;

    /** Whether this button represents an action group */
    @property({ type: Boolean, reflect: true })
    @computed(function(this: ActionButton, action: Vidyano.Action | Vidyano.ActionGroup): boolean {
        return action instanceof Vidyano.ActionGroup;
    }, "action")
    declare readonly isGroup: boolean;

    /** Use inverse color scheme */
    @property({ type: Boolean, reflect: true })
    inverse: boolean = false;

    readonly #configurable = new WebComponentConfigurationController(this, (actions: IConfigurableAction[]) => {
        if (!(this.action instanceof Vidyano.Action))
            return;

        if ((this.action.parent && this.action.parent.isSystem) || (this.action.query && this.action.query.isSystem))
            return;

        actions.push({
            label: `Action: ${this.action.name}`,
            icon: "viConfigure",
            action: () => {
                this.app.changePath(`management/persistent-object.1bf5e50c-ee7d-4205-8ccf-46ab68e25d63/${this.action.name}`);
            }
        });
    });

    /**
     * Creates an action button without initialization.
     */
    constructor();
    /**
     * Creates an action button for a specific query result item.
     * @param item The query result item this action operates on
     * @param action The action or action group to execute
     */
    constructor(item: Vidyano.QueryResultItem, action: Vidyano.Action | Vidyano.ActionGroup);
    constructor(item?: Vidyano.QueryResultItem, action?: Vidyano.Action | Vidyano.ActionGroup) {
        super();

        this.item = item;
        this.action = action;

        if (item && action)
            this.#applyItemSelection(item, action);
    }

    @observer("action.canExecute", "action.isVisible", "action.options")
    private _observeAction(canExecute: boolean, isVisible: boolean, options: string[]) {
        // Skip observer if this button has an item assigned (row-level button)
        // to prevent global action updates from overwriting item-specific visibility/executability
        if (this.item)
            return;

        this.canExecute = canExecute;
        this.hidden = !isVisible;
        this.options = options?.length > 0 ? options.map((value: string, index: number) => {
            return {
                key: index,
                value: value
            };
        }) : null;
    }

    @observer("hasIcon", "overflow", "grouped", "isConnected")
    private _updateParentIconMarker(hasIcon: boolean, overflow: boolean, grouped: boolean, isConnected: boolean) {
        if (!(overflow || grouped) || !isConnected || !this.parentElement)
            return;

        // Only update if this button's relevant state changed
        const currentState = (overflow || grouped) && hasIcon;
        if (this.#lastIconState === currentState)
            return;

        this.#lastIconState = currentState;

        // Check if ANY sibling (including this) has an icon in overflow/grouped mode
        // Each button independently checks and updates the parent marker
        const hasAnySiblingWithIcon = Array.from(this.parentElement.children).some((child: Element) =>
            child instanceof ActionButton && (child.overflow || child.grouped) && child.hasIcon
        );

        // Set or remove the CSS variable based on current state
        // This ensures the variable is cleared when no buttons have icons anymore
        if (hasAnySiblingWithIcon)
            this.parentElement.style.setProperty('--has-icon-child', 'block');
        else
            this.parentElement.style.removeProperty('--has-icon-child');
    }


    async connectedCallback() {
        super.connectedCallback();

        if (this.grouped) {
            const groupParent = <ActionButton>this.findParent(p => p instanceof ActionButton && p.isGroup);
            if (groupParent && groupParent.item && this.action) {
                this.item = groupParent.item;
                this.#applyItemSelection(groupParent.item, this.action);
            }
        }
    }

    /**
     * Executes the action associated with this button.
     * @param option - The menu option index to execute (for actions with options). Defaults to -1 for simple actions.
     */
    click(option: number = -1) {
        if (!(this.action instanceof Vidyano.Action))
            return;

        if (!this.canExecute)
            return;

        if (!this.item) {
            this.action.execute({
                menuOption: option
            });
        }
        else {
            this.action.execute({
                menuOption: option,
                parameters: this.options && option < this.options.length ? { MenuLabel: this.options[option].value } : null,
                selectedItems: [this.item]
            });
        }
    }

    private _onExecuteWithoutOptions(e: MouseEvent) {
        if (!this.canExecute) {
            e.stopPropagation();
            return;
        }

        Popup.closeAll();

        if (!this.options)
            this.click();

        e.stopPropagation();
        e.preventDefault();
    }

    private _onExecuteWithOption(e: MouseEvent) {
        if (!this.canExecute) {
            e.stopPropagation();
            return;
        }

        Popup.closeAll();

        const target = e.currentTarget as HTMLElement;
        const optionKey = parseInt(target.getAttribute("data-option-key"));
        this.click(optionKey);
    }

    #applyItemSelection(item: Vidyano.QueryResultItem, action: Vidyano.Action | Vidyano.ActionGroup) {
        const args: Vidyano.ISelectedItemsActionArgs = {
            name: action.name,
            isVisible: action.isVisible,
            canExecute: action.definition.selectionRule(1),
            options: action.options
        };

        action.service.hooks.onSelectedItemsActions(item.query, [item], args);

        // Apply item-specific settings (these won't be overwritten by _observeAction since this.item is set)
        this.canExecute = args.canExecute;
        this.hidden = !args.isVisible;
        this.options = args.options && args.options.length > 0 ? args.options.map((value: string, index: number) => {
            return {
                key: index,
                value: value
            };
        }) : null;
    }

    #computeIcon(action: Vidyano.Action): string {
        if (!action)
            return "";

        return action.isPinned && !IconRegister.exists(action.definition.icon) ? "Action_Default$" : action.definition.icon;
    }

    #computeOpenOnHover(overflow: boolean, openOnHover: boolean): boolean {
        return overflow || openOnHover;
    }

    #getPlacement(overflow: boolean, grouped: boolean) {
        return overflow || grouped ? "right-start" : "bottom-start";
    }

    /**
     * Renders a simple action button without dropdown options.
     */
    #renderSimpleButton() {
        return html`
            <vi-button ?disabled=${!this.canExecute} header @click=${this._onExecuteWithoutOptions} ?inverse=${this.inverse}>
                <div class="button-content">
                    <vi-icon class="action-icon" source=${this.icon}></vi-icon>
                    ${this.iconSpace ? html`<div class="icon-space"></div>` : nothing}
                    <span class="label">${this.action?.displayName}</span>
                </div>
            </vi-button>
        `;
    }

    /**
     * Renders an action button with a dropdown menu of options.
     * @param options - The menu options to display
     */
    #renderButtonWithOptions(options: Vidyano.KeyValuePair<number, string>[]) {
        return html`
            <vi-popup-menu ?open-on-hover=${this.#computeOpenOnHover(this.overflow, this.openOnHover)} ?disabled=${!this.canExecute} placement=${this.#getPlacement(this.overflow, this.grouped)} ?auto-width=${!this.overflow}>
                <vi-button ?disabled=${!this.canExecute} slot="header" header ?inverse=${this.inverse} class="options">
                    <div class="button-content-full">
                        <vi-icon class="action-icon" source=${this.icon}></vi-icon>
                        ${this.iconSpace ? html`<div class="icon-space"></div>` : nothing}
                        <span class="label label-flex">${this.action?.displayName}</span>
                        <vi-icon class="down-icon" source="Down"></vi-icon>
                    </div>
                </vi-button>
                ${repeat(options, option => option.key, option => html`
                    <vi-popup-menu-item label=${option.value} data-option-key=${option.key} @click=${this._onExecuteWithOption}></vi-popup-menu-item>
                `)}
            </vi-popup-menu>
        `;
    }

    /**
     * Renders an action group button with a popup containing sub-actions.
     * @param group - The action group containing sub-actions
     */
    #renderActionGroup(group: Vidyano.ActionGroup) {
        return html`
            <vi-popup ?disabled=${!this.canExecute} ?open-on-hover=${this.#computeOpenOnHover(this.overflow, this.openOnHover)} placement=${this.#getPlacement(this.overflow, this.grouped)} ?auto-width=${!this.overflow}>
                <vi-button ?disabled=${!this.canExecute} slot="header" ?inverse=${this.inverse} class="groupActions">
                    <div class="button-content-full">
                        <vi-icon class="action-icon" source=${this.icon}></vi-icon>
                        ${this.iconSpace ? html`<div class="icon-space"></div>` : nothing}
                        <span class="label label-flex">${this.action?.displayName}</span>
                        <vi-icon class="down-icon" source="Down"></vi-icon>
                    </div>
                </vi-button>
                <div content>
                    ${group.actions?.map(groupAction => html`
                        <vi-action-button grouped open-on-hover .action=${groupAction} inverse></vi-action-button>
                    `)}
                </div>
            </vi-popup>
        `;
    }

    render() {
        if (this.isGroup)
            return this.#renderActionGroup(this.action as Vidyano.ActionGroup);

        if (this.options?.length > 0)
            return this.#renderButtonWithOptions(this.options);

        return this.#renderSimpleButton();
    }
}

customElements.define("vi-action-button", ActionButton);
