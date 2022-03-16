import { PopupMenuItemSplit } from "../popup-menu/popup-menu-item-split.js"
import { PopupMenuItem } from "../popup-menu/popup-menu-item.js"
import { WebComponent } from "./web-component.js"

export interface IConfigurableAction {
    icon: string;
    label: string;
    action: () => void;

    subActions?: IConfigurableAction[];
}

export abstract class ConfigurableWebComponent extends WebComponent {
    #_onContextmenu: (e: Event) => void;

    async connectedCallback() {
        super.connectedCallback();

        this._addEventListenerToNode(this, "contextmenu", this.#_onContextmenu = (e: CustomEvent) => {
            if (e["vi:configure"])
                return;

            const actions: IConfigurableAction[] = [];
            this.dispatchEvent(new CustomEvent("vi:configure", {
                bubbles: true,
                detail: actions,
                composed: true
            }));

            if (actions.length === 0)
                return;

            const configureItems: WebComponent[] = [];
            actions.forEach(action => {
                let item: WebComponent;

                if (!action.subActions)
                    item = new PopupMenuItem(action.label, action.icon, action.action);
                else {
                    item = new PopupMenuItemSplit(action.label, action.icon, action.action);
                    action.subActions.forEach(subA => item.appendChild(new PopupMenuItem(subA.label, subA.icon, subA.action)));
                }

                configureItems.push(item);
            });

            e["vi:configure"] = configureItems;
        });
    }

    disconnectedCallback() {
        this._removeEventListenerFromNode(this, "contextmenu", this.#_onContextmenu);
        super.disconnectedCallback();
    }
}