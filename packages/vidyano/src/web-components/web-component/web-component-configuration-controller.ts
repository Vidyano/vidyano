import { ReactiveController } from "lit";
import type { WebComponent } from "./web-component";
import { PopupMenuItem } from "components/popup-menu/popup-menu-item";
import { PopupMenuItemSplit } from "components/popup-menu/popup-menu-item-split";

export interface IConfigurableAction {
    icon: string;
    label: string;
    action: () => void;

    subActions?: IConfigurableAction[];
}

/**
 * A Reactive Controller that manages the vi:configure event for web components.
 * This allows components to add custom configuration actions that appear on Ctrl+RightClick.
 *
 * Usage:
 * ```typescript
 * class MyComponent extends WebComponent {
 *     private configurable = new WebComponentConfigurationController(this, (actions) => {
 *         actions.push({
 *             label: "My Custom Action",
 *             icon: "viConfigure",
 *             action: () => console.log("Clicked!")
 *         });
 *     });
 * }
 * ```
 */
export class WebComponentConfigurationController implements ReactiveController {
    #host: WebComponent;
    #onConfigure: (actions: IConfigurableAction[]) => void;
    #onContextmenu: (e: PointerEvent) => void;

    constructor(host: WebComponent, onConfigure: (actions: IConfigurableAction[]) => void) {
        this.#host = host;
        this.#onConfigure = onConfigure;
        this.#host.addController(this);
    }

    /**
     * Lit lifecycle hook. Called when the host connects to the DOM.
     * Sets up the contextmenu event listener.
     */
    hostConnected(): void {
        this.#onContextmenu = (e: PointerEvent) => {
            // Only handle Ctrl+RightClick
            if (!e.ctrlKey || e.defaultPrevented)
                return;

            // Avoid duplicate handling if already processed
            if (e["vi:configure"])
                return;

            const actions: IConfigurableAction[] = [];

            // Allow the component to add its custom actions
            this.#onConfigure(actions);

            // If no actions were added, don't dispatch the event
            if (actions.length === 0)
                return;

            // Dispatch the event with the actions
            this.#host.dispatchEvent(new CustomEvent("vi:configure", {
                bubbles: true,
                detail: actions,
                composed: true
            }));

            // Create menu items from the actions
            const configureItems: (PopupMenuItem | PopupMenuItemSplit)[] = [];
            actions.forEach(action => {
                let item: PopupMenuItem | PopupMenuItemSplit;

                if (!action.subActions)
                    item = new PopupMenuItem(action.label, action.icon, action.action);
                else {
                    item = new PopupMenuItemSplit(action.label, action.icon, action.action);
                    action.subActions.forEach(subA => item.appendChild(new PopupMenuItem(subA.label, subA.icon, subA.action)));
                }

                configureItems.push(item);
            });

            // Attach menu items to the contextmenu event so the app can display them
            e["vi:configure"] = configureItems;
        };

        this.#host.addEventListener("contextmenu", this.#onContextmenu);
    }

    /**
     * Lit lifecycle hook. Called when the host disconnects from the DOM.
     * Cleans up the event listener.
     */
    hostDisconnected(): void {
        if (this.#onContextmenu) {
            this.#host.removeEventListener("contextmenu", this.#onContextmenu);
        }
    }
}
