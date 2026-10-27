import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "@vidyano/core";
import "@polymer/paper-ripple";
import { SelectReferenceDialog } from "components/select-reference-dialog/select-reference-dialog";
import { computed, observer } from "components/web-component/web-component";
import { IConfigurableAction, WebComponentConfigurationController } from "components/web-component/web-component-configuration-controller";
import { MenuNode } from "./menu-node";
import "./menu-group";
import "./menu-item";
import "./menu-separator";
import styles from "./menu-program-unit.css";

/**
 * The top-level node of the menu: vi-menu renders one for every program unit of the application.
 * It shows the program unit's title and icon, and its items below it while it is expanded.
 */
export class MenuProgramUnit extends MenuNode {
    static styles = unsafeCSS(styles);

    /** The program unit the app currently shows; it is expanded. */
    @property({ type: Object })
    activeProgramUnit: Vidyano.ProgramUnit;

    /** Whether the menu is collapsed to icons. */
    @property({ type: Boolean, reflect: true })
    collapsed: boolean = false;

    /** Whether the mouse is over the collapsed menu, which shows it in full. */
    @property({ type: Boolean, reflect: true })
    hovering: boolean = false;

    /** Whether the items are shown: always while filtering, else while expanded and the menu shows in full. */
    @property({ type: Boolean })
    @computed(function(this: MenuProgramUnit, filtering: boolean, expanded: boolean, collapsed: boolean, hovering: boolean): boolean {
        return filtering || (expanded && (!collapsed || hovering));
    }, "filtering", "expanded", "collapsed", "hovering")
    declare readonly open: boolean;

    readonly #configurable = new WebComponentConfigurationController(this, (actions: IConfigurableAction[]) => {
        const unit = this.item as Vidyano.ProgramUnit;
        if (!unit?.path || unit.path.startsWith("Management/"))
            return;

        actions.push({
            label: `Program unit: ${unit.name}`,
            icon: "viConfigure",
            action: () => this.app.changePath(`Management/PersistentObject.b53ec1cd-e0b3-480f-b16d-bf33b133c05c/${unit.name}`),
            subActions: [
                {
                    label: "Add Query",
                    icon: "Add",
                    action: async () => {
                        const query = await this.service.getQuery("5a4ed5c7-b843-4a1b-88f7-14bd1747458b");
                        if (!query)
                            return;

                        await this.app.showDialog(new SelectReferenceDialog(query));
                        if (!query.selectedItems?.length)
                            return;

                        await this.service.executeAction("System.AddQueriesToProgramUnit", null, query, query.selectedItems, { Id: unit.id });
                        document.location.reload();
                    }
                }
            ]
        });
    });

    @observer("item", "activeProgramUnit", { allowUndefined: true })
    private _activeChanged(item: Vidyano.ProgramUnit, activeProgramUnit: Vidyano.ProgramUnit) {
        this.expanded = !!item && item === activeProgramUnit;
    }

    @observer("open")
    private _openChanged(open: boolean) {
        if (open)
            return;

        // Blur a focused item before it is hidden, a hidden focused element is an accessibility warning
        const focused = this.shadowRoot?.activeElement;
        if (focused instanceof HTMLElement && this.shadowRoot.getElementById("subItems")?.contains(focused))
            focused.blur();
    }

    render() {
        const unit = this.item as Vidyano.ProgramUnit;
        const link = this.linkFor(unit);

        return html`
            <a class="title" href=${link.href ?? nothing} target=${link.target ?? nothing} rel=${link.rel ?? nothing} @click=${this._click}>
                <paper-ripple></paper-ripple>
                ${this.renderIcon()}
                ${this.renderTitle()}
            </a>
            ${unit?.items?.length ? html`
                <div id="subItems" ?open=${this.open} ?inert=${!this.open}>
                    <div class="items">${this.renderChildren(unit.items)}</div>
                </div>
            ` : nothing}
        `;
    }

    private _click(e: MouseEvent) {
        if (!this.filtering)
            this._collapseGroups(this.shadowRoot);

        if (!this.item?.path) {
            e.preventDefault();
            this.expanded = !this.expanded;
        }
        else
            this.navigating(this.item);
    }

    /**
     * Collapses every vi-menu-group below the root, the groups nested in other groups too.
     */
    private _collapseGroups(root: ShadowRoot) {
        root?.querySelectorAll<MenuNode>("vi-menu-group").forEach(group => {
            group.expanded = false;
            this._collapseGroups(group.shadowRoot);
        });
    }
}

customElements.define("vi-menu-program-unit", MenuProgramUnit);
