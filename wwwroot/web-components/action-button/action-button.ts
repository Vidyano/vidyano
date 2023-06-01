import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import * as IconRegister from "../icon/icon-register.js"
import { ConfigurableWebComponent } from "../web-component/web-component-configurable.js"

@ConfigurableWebComponent.register({
    properties: {
        action: Object,
        item: Object,
        icon: {
            type: String,
            computed: "_computeIcon(action)"
        },
        hasIcon: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHasIcon(icon)"
        },
        siblingIcon: {
            type: Boolean,
            readOnly: true
        },
        iconSpace: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeIconSpace(icon, siblingIcon, overflow, grouped)"
        },
        pinned: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "action.isPinned"
        },
        noLabel: {
            type: Boolean,
            reflectToAttribute: true
        },
        forceLabel: {
            type: Boolean,
            reflectToAttribute: true
        },
        overflow: {
            type: Boolean,
            reflectToAttribute: true,
            value: null
        },
        canExecute: {
            type: Boolean,
            readOnly: true
        },
        disabled: {
            type: Boolean,
            computed: "_computeDisabled(canExecute)",
            reflectToAttribute: true
        },
        hidden: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true,
            observer: "_hiddenChanged"
        },
        options: {
            type: Array,
            readOnly: true
        },
        openOnHover: {
            type: Boolean,
            reflectToAttribute: true,
            value: null
        },
        grouped: {
            type: Boolean,
            reflectToAttribute: true,
            value: null
        },
        title: {
            type: String,
            reflectToAttribute: true,
            computed: "_computeTitle(action, pinned)"
        },
        isGroup: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeIsGroup(action)"
        }
    },
    listeners: {
        "vi:configure": "_configure"
    },
    observers: [
        "_observeAction(action.canExecute, action.isVisible, action.options)",
        "_computeSiblingIcon(overflow, grouped, isConnected)"
    ],
    forwardObservers: [
        "action.isPinned",
        "action.canExecute",
        "action.isVisible",
        "action.options"
    ]
})
export class ActionButton extends ConfigurableWebComponent {
    static get template() { return Polymer.html`<link rel="import" href="action-button.html">`; }

    private _skipObserver: boolean;
    readonly options: Vidyano.KeyValuePair<number, string>[]; private _setOptions: (val: Vidyano.KeyValuePair<number, string>[]) => void;
    readonly canExecute: boolean; private _setCanExecute: (val: boolean) => void;
    readonly siblingIcon: boolean; private _setSiblingIcon: (val: boolean) => void;
    readonly hidden: boolean; private _setHidden: (val: boolean) => void;
    readonly isGroup: boolean;
    noLabel: boolean;
    openOnHover: boolean;
    forceLabel: boolean;
    grouped: boolean;

    constructor(public item: Vidyano.QueryResultItem, public action: Vidyano.Action | Vidyano.ActionGroup) {
        super();

        if(item && action)
            this._applyItemSelection(item, action);
    }

    async connectedCallback() {
        super.connectedCallback();

        if (this.grouped) {
            const groupParent = <ActionButton>this.findParent(p => p instanceof ActionButton && p.isGroup);
            if (groupParent && groupParent.item && this.action) {
                this.item = groupParent.item;
                this._applyItemSelection(groupParent.item, this.action);
            }
        }
    }

    private _applyItemSelection(item: Vidyano.QueryResultItem, action: Vidyano.Action | Vidyano.ActionGroup) {
        const args: Vidyano.ISelectedItemsActionArgs = {
            name: action.name,
            isVisible: action.isVisible,
            canExecute: action.definition.selectionRule(1),
            options: action.options
        };

        action.service.hooks.onSelectedItemsActions(item.query, [item], args);

        this._setCanExecute(args.canExecute);
        this._setHidden(!args.isVisible);
        this._setOptions(args.options && args.options.length > 0 ? args.options.map((value: string, index: number) => {
            return {
                key: index,
                value: value
            };
        }) : null);

        this._skipObserver = true;
    }

    private _onExecuteWithoutOptions(e: Polymer.Gestures.TapEvent) {
        if (!this.canExecute) {
            e.stopPropagation();
            return;
        }

        if (!this.options)
            this._execute();

        e.stopPropagation();
        e.preventDefault();
    }

    private _onExecuteWithOption(e: Polymer.Gestures.TapEvent) {
        if (!this.canExecute) {
            e.stopPropagation();
            return;
        }

        this._execute(e.model.option.key);
    }

    private _execute(option: number = -1) {
        if (!(this.action instanceof Vidyano.Action))
            return;

        if (this.canExecute) {
            if (!this.item)
                this.action.execute({
                    menuOption: option
                });
            else {
                this.action.execute({
                    menuOption: option,
                    parameters: this.options && option < this.options.length ? { MenuLabel: this.options[option].value } : null,
                    selectedItems: [this.item]
                });
            }
        }
    }

    private _observeAction(canExecute: boolean, isVisible: boolean, options: boolean) {
        if(this._skipObserver)
            return;

        this._setCanExecute(this.item ? this.action.definition.selectionRule(1) : canExecute);
        this._setHidden(!this.action.isVisible);
        this._setOptions(this.action.options && this.action.options.length > 0 ? this.action.options.map((value: string, index: number) => {
            return {
                key: index,
                value: value
            };
        }) : null);
    }

    private _computeDisabled(canExecute: boolean): boolean {
        return !canExecute;
    }

    private _computeIsGroup(action: Vidyano.Action | Vidyano.ActionGroup): boolean {
        return action instanceof Vidyano.ActionGroup;
    }

    private _computeTitle(action: Vidyano.Action, pinned: boolean): string {
        return pinned ? action.displayName : null;
    }

    private _computeIcon(action: Vidyano.Action): string {
        if (!action)
            return "";

        return action.isPinned && !IconRegister.exists(action.definition.icon) ? "Action_Default$" : action.definition.icon;
    }

    private _computeHasIcon(icon: string): boolean {
        return !String.isNullOrEmpty(icon) && IconRegister.exists(icon);
    }

    private _computeIconSpace(icon: string, siblingIcon: boolean, overflow: boolean, grouped: boolean): boolean {
        return (overflow || grouped) && !IconRegister.exists(icon) && siblingIcon;
    }

    private _computeSiblingIcon(overflow: boolean, grouped: boolean, isConnected: boolean) {
        const siblingIcon = (overflow || grouped) && isConnected && this.parentElement != null && Array.from(this.parentElement.children).find((c: ActionButton) => c.action && IconRegister.exists(this._computeIcon(<Vidyano.Action>c.action))) != null;
        this._setSiblingIcon(siblingIcon);
        if (siblingIcon) {
            Array.from(this.parentElement.children).forEach((ab: ActionButton) => {
                if (ab instanceof ActionButton && ab !== this)
                    ab._setSiblingIcon(true);
            });
        }
    }

    private _computeOpenOnHover(overflow: boolean, openOnHover: boolean): boolean {
        return overflow || openOnHover;
    }

    private _getPlacement(overflow: boolean, grouped: boolean) {
        return overflow || grouped ? "right-start" : "bottom-start";
    }

    private _hiddenChanged() {
        this.fire("sizechanged", null);
    }

    _configure(e: CustomEvent) {
        if (!(this.action instanceof Vidyano.Action))
            return;

        if ((this.action.parent && this.action.parent.isSystem) || (this.action.query && this.action.query.isSystem))
            return;

        e.detail.push({
            label: `Action: ${this.action.name}`,
            icon: "viConfigure",
            action: () => {
                this.app.changePath(`management/persistent-object.1bf5e50c-ee7d-4205-8ccf-46ab68e25d63/${this.action.name}`);
            }
        });
    }
}