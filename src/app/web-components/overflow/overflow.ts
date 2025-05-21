import * as Polymer from "polymer"
import "components/popup/popup"
import { Popup } from "components/popup/popup"
import { WebComponent} from "components/web-component/web-component"

export type OverflowType = "label" | "icon" | "icon-label";

@WebComponent.register({
    properties: {
        hasOverflow: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true
        },
        icon: {
            type: String,
        },
        label: {
            type: String,
            value: "…"
        },
        type: {
            type: String,
            value: "label"
        }
    }
})
export class Overflow extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="overflow.html">` }

    private _overflownChildren: HTMLElement[];
    private _previousHeight: number;
    readonly hasOverflow: boolean; private _setHasOverflow: (val: boolean) => void;
    type: OverflowType;

    private _visibleContainerSizeChanged(e: Event, detail: { width: number; height: number }) {
        if (this._previousHeight === detail.height)
            return;

        this.$.first.style.height = `${this._previousHeight = detail.height}px`;
    }

    private _visibleSizeChanged(e: Event, detail: { width: number; height: number }) {
        const popup = <Popup>this.$.overflowPopup;
        if (!popup.open) {
            Polymer.Async.animationFrame.run(() => {
                const children = this._getChildren();
                children.forEach(child => child.removeAttribute("slot"));
    
                this._setHasOverflow(children.reverse().some(child => child.offsetTop > 0));
            });
        }
        else
            this._popupOpening();
    }

    protected _getChildren(): HTMLElement[] {
        const visibleSlot = <HTMLSlotElement>this.$.visible;
        const overflowSlot = <HTMLSlotElement>this.$.overflow;

        return <HTMLElement[]>visibleSlot.assignedNodes().concat(overflowSlot.assignedNodes()).filter(child => child instanceof HTMLElement);
    }

    private _popupOpening() {
        this._overflownChildren = this._getChildren().filter(child => child.offsetTop > 0);
        this._overflownChildren.forEach(child => {
            child.setAttribute("slot", "overflow");
            child.setAttribute("overflow", "");
        });

        Polymer.flush();
    }

    private _popupClosed() {
        this._overflownChildren.forEach(child => {
            child.removeAttribute("slot");
            child.removeAttribute("overflow");
        });
        Polymer.flush();

        this._setHasOverflow(this._overflownChildren.some(child => child.offsetTop > 0));
    }

    private _getIcon(icon: string, type: OverflowType) {
        return type === "icon" || type === "icon-label" ? icon : null;
    }

    private _getLabel(label: string, type: OverflowType) {
        return type === "label" || type === "icon-label" ? label : null;
    }
}