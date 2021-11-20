import * as Polymer from "../../libs/@polymer/polymer.js"
import "../popup/popup.js"
import { Popup } from "../popup/popup.js"
import { WebComponent, WebComponentListener} from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        hasOverflow: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true
        }
    },
    listeners: {
        "sizechanged": "_childSizechanged"
    }
})
export class Overflow extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="overflow.html">` }

    private _overflownChildren: HTMLElement[];
    private _previousHeight: number;
    readonly hasOverflow: boolean; private _setHasOverflow: (val: boolean) => void;

    private _visibleContainerSizeChanged(e: Event, detail: { width: number; height: number }) {
        this.$.visible.style.maxWidth = `${detail.width}px`;

        if (this._previousHeight !== detail.height)
            this.$.first.style.height = `${this._previousHeight = detail.height}px`;
    }

    private _childSizechanged() {
        if ((<Popup>this.$.overflowPopup).open)
            return;

        this._setHasOverflow(false);
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
        this._overflownChildren.forEach(child => child.setAttribute("slot", "overflow"));

        Polymer.flush();
    }

    private _popupClosed() {
        this._overflownChildren.forEach(child => child.removeAttribute("slot"));
        Polymer.flush();

        this._setHasOverflow(this._overflownChildren.some(child => child.offsetTop > 0));
    }
}