import * as Polymer from "../../libs/@polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"

let _documentClosePopupListener: EventListener;
document.addEventListener("mousedown", _documentClosePopupListener = e => {
    const path = e.composedPath().slice();
    do {
        const el = path.shift();
        if (!el || el === <any>document) {
            PopupCore.closeAll();
            break;
        }
        else if ((<any>el).__Vidyano_WebComponents_PopupCore__Instance__ && (<PopupCore><any>el).open)
            break;
        else if ((<any>el).popup && (<any>el).popup.__Vidyano_WebComponents_PopupCore__Instance__ && (<PopupCore>(<any>el).popup).open)
            break;
    }
    while (true);
});
document.addEventListener("touchstart", _documentClosePopupListener);

type Rect = {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
}

const openPopups: PopupCore[] = [];

@WebComponent.register({
    properties: {
        disabled: {
            type: Boolean,
            reflectToAttribute: true
        },
        open: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true,
            notify: true
        },
        sticky: {
            type: Boolean,
            reflectToAttribute: true
        },
        contentAlign: {
            type: String,
            reflectToAttribute: true
        },
        orientation: {
            type: String,
            reflectToAttribute: true,
            value: "auto"
        },
        hover: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true,
            observer: "_hoverChanged"
        },
        closeDelay: {
            type: Number,
            value: 500
        }
    }
})
export class PopupCore extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup-core.html">` }

    private static _isBuggyGetBoundingClientRect: boolean;

    private __Vidyano_WebComponents_PopupCore__Instance__ = true;
    private _resolver: Function;
    private _closeOnMoveoutTimer: ReturnType<typeof setTimeout>;
    private _currentTarget: HTMLElement | WebComponent;
    private _currentContent: HTMLElement;
    protected _currentOrientation: string;
    readonly open: boolean; protected _setOpen: (val: boolean) => void;
    readonly hover: boolean; private _setHover: (val: boolean) => void;
    orientation: string;
    contentAlign: string;
    disabled: boolean;
    sticky: boolean;
    boundingTarget: HTMLElement;
    closeDelay: number;

    popup(target: HTMLElement | WebComponent): Promise<any> {
        if (this.open)
            return Promise.resolve();

        return new Promise(resolve => {
            this._resolver = resolve;
            this._open(target);
        });
    }

    protected _open(target: HTMLElement | WebComponent, content: HTMLElement = this) {
        this._currentOrientation = this.orientation.toUpperCase() === "AUTO" ? !this._findParentPopup() ? "vertical" : "horizontal" : this.orientation.toLowerCase();

        if (this.open || this.hasAttribute("disabled") || this.fire("popup-opening", null, { bubbles: false, cancelable: true }).defaultPrevented)
            return;

        // Close non-parent popups
        const parentPopup = this._findParentPopup();
        const firstOpenNonParentChild = openPopups[parentPopup == null ? 0 : openPopups.indexOf(parentPopup) + 1];
        if (firstOpenNonParentChild != null)
            firstOpenNonParentChild.close();

        // Position content
        const {targetRect, transformedRect} = this._getTargetRect(<HTMLElement>target);
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const contentWidth = content.offsetWidth;
        const contentHeight = content.offsetHeight;

        let boundWidth = windowWidth;
        let boundHeight = windowHeight;
        let boundLeft = 0;
        if (this.boundingTarget) {
            const boundTargetRectInfo = this._getTargetRect(this.boundingTarget);
            boundWidth = boundTargetRectInfo.targetRect.right;
            boundHeight = boundTargetRectInfo.targetRect.bottom;
            boundLeft = boundTargetRectInfo.targetRect.left;

            if (boundTargetRectInfo.transformedRect) {
                boundWidth += boundTargetRectInfo.transformedRect.right;
                boundHeight += boundTargetRectInfo.transformedRect.bottom;
                boundLeft += boundTargetRectInfo.transformedRect.left;
            }
        }

        const alignments = (this.contentAlign || "").toUpperCase().split(" ");
        const alignRight = alignments.indexOf("RIGHT") >= 0;

        let maxContentHeight = "none";
        if (this._currentOrientation === "vertical") {
            if (alignRight ? (targetRect.right + (transformedRect ? transformedRect.right : 0) - contentWidth) < 0 : targetRect.left + (transformedRect ? transformedRect.left : 0) + contentWidth <= boundWidth) {
                // Left-align
                let left = targetRect.left;
                if (this.boundingTarget && transformedRect && (left + transformedRect.left < boundLeft))
                    left += boundLeft - left - transformedRect.left;

                if (alignments.indexOf("CENTER") >= 0)
                    left = Math.max(0, left - contentWidth / 2 + targetRect.width / 2);

                content.style.left = left + "px";
                content.style.right = "auto";

                content.classList.add("left");
                content.classList.remove("right");
            }
            else {
                // Right-align
                content.style.left = "auto";

                let right = (!transformedRect ? windowWidth : transformedRect.width) - (targetRect.left + targetRect.width);
                if (this.boundingTarget)
                    right += (transformedRect ? transformedRect.left : 0) + targetRect.left + targetRect.width - boundWidth;

                if (right < 0)
                    right = 0;

                content.style.right = right + "px";
                content.classList.add("right");
                content.classList.remove("left");
            }

            if (targetRect.top + targetRect.height + contentHeight < boundHeight || targetRect.top - contentHeight < 0) {
                // Top-align
                content.style.top = (targetRect.top + targetRect.height) + "px";
                content.style.bottom = "auto";

                content.classList.add("top");
                content.classList.remove("bottom");

                maxContentHeight = `${boundHeight - targetRect.top - targetRect.height}px`;
            }
            else {
                // Bottom-align
                content.style.top = "auto";
                const bottom = Math.max(windowHeight - targetRect.top, 0);
                content.style.bottom = `${bottom}px`;

                content.classList.add("bottom");
                content.classList.remove("top");

                maxContentHeight = `${windowHeight - bottom}px`;
            }
        }
        else if (this._currentOrientation === "horizontal") {
            if (alignRight ? (targetRect.right - contentWidth) < 0 : targetRect.left + targetRect.width + contentWidth <= boundWidth) {
                // Left-align
                content.style.left = (targetRect.left + targetRect.width) + "px";
                content.style.right = "auto";

                content.classList.add("left");
                content.classList.remove("right");
            }
            else {
                // Right-align
                content.style.left = "auto";
                content.style.right = Math.max(windowWidth - targetRect.left, 0) + "px";

                content.classList.add("right");
                content.classList.remove("left");
            }

            content.style.top = targetRect.top + "px";
            content.style.bottom = "auto";

            content.classList.add("top");
            content.classList.remove("bottom");

            if (targetRect.top + contentHeight > boundHeight || targetRect.top + contentHeight > windowHeight) {
                let newTop = Math.min(boundHeight, windowHeight) - contentHeight;
                if (newTop < 0) {
                    newTop = 0;
                    maxContentHeight = `${Math.min(boundHeight, windowHeight)}px`;
                }

                content.style.top = `${newTop}px`;
            }
        }

        const contentChild = <HTMLElement>this.querySelector("[content]");
        if (contentChild) {
            const definedMaxHeight = parseInt(getComputedStyle(contentChild).maxHeight);
            if (isNaN(definedMaxHeight) || definedMaxHeight > parseInt(maxContentHeight))
                contentChild.style.maxHeight = maxContentHeight;
        }

        this._currentTarget = target;
        this._currentContent = content;

        this._setOpen(true);
        openPopups.push(this);

        this.fire("popup-opened", null, { bubbles: false, cancelable: false });
    }

    protected _getTargetRect(target: HTMLElement): { targetRect: Rect, transformedRect?: Rect } {
        let targetRect: Rect = target.getBoundingClientRect();
        if (target === this) {
            targetRect = {
                left: targetRect.left,
                top: targetRect.top,
                bottom: targetRect.top,
                right: targetRect.left,
                width: 0,
                height: 0
            };
        }

        if (PopupCore._isBuggyGetBoundingClientRect === undefined) {
            const outer = document.createElement("div");
            outer.style.transform = "translate(-100px, -100px)";

            const inner = document.createElement("div");
            inner.style.position = "fixed";

            outer.appendChild(inner);

            document.body.appendChild(outer);
            const outerRect = outer.getBoundingClientRect();
            const innerRect = inner.getBoundingClientRect();
            document.body.removeChild(outer);

            PopupCore._isBuggyGetBoundingClientRect = outerRect.left === innerRect.left;
        }

        if (PopupCore._isBuggyGetBoundingClientRect) {
            let parent: Element = target.parentElement || (target.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? (<ShadowRoot>target.parentNode).host : null);
            while (parent != null) {
                const computedStyle = getComputedStyle(parent, null),
                    transform = <string>(computedStyle.transform);

                if (transform.startsWith("matrix")) {
                    const transformedParentRect = parent.getBoundingClientRect();

                    return {
                        targetRect: {
                            top: targetRect.top - transformedParentRect.top,
                            left: targetRect.left - transformedParentRect.left,
                            right: targetRect.right - transformedParentRect.right,
                            bottom: targetRect.bottom - transformedParentRect.bottom,
                            width: targetRect.width,
                            height: targetRect.height
                        },
                        transformedRect: transformedParentRect
                    };
                }

                parent = parent.parentElement || (parent.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? (<ShadowRoot>parent.parentNode).host : null);
            }
        }

        return { targetRect: targetRect };
    }

    close() {
        if (!this.open || this.fire("popup-closing", null, { bubbles: false, cancelable: true }).defaultPrevented)
            return;

        if (!this.open && this._closeOnMoveoutTimer) {
            clearTimeout(this._closeOnMoveoutTimer);
            this._closeOnMoveoutTimer = undefined;
        }

        const openChild = openPopups[openPopups.indexOf(this) + 1];
        if (openChild != null)
            openChild.close();

        this._currentTarget = this._currentContent = null;
        this._setOpen(false);
        this._setHover(false);

        if (this._resolver)
            this._resolver();

        openPopups.remove(this);

        this.fire("popup-closed", null, { bubbles: false, cancelable: false });
    }

    protected _findParentPopup(): PopupCore {
        let element = this.parentNode;
        while (element != null && openPopups.indexOf(<any>element) === -1)
            element = (<any>element).host || element.parentNode;

        return <PopupCore><any>element;
    }

    private _catchContentClick(e?: Event) {
        if (this.sticky)
            e.stopPropagation();
    }

    protected _contentMouseEnter(e: MouseEvent) {
        if (this._setHover)
            this._setHover(true);

        if (this._closeOnMoveoutTimer) {
            clearTimeout(this._closeOnMoveoutTimer);
            this._closeOnMoveoutTimer = undefined;
        }
    }

    protected _contentMouseLeave(e: MouseEvent) {
        if (e.relatedTarget == null) {
            e.stopPropagation();
            return;
        }

        if (!this.sticky) {
            this._closeOnMoveoutTimer = setTimeout(() => {
                this.close();
            }, this.closeDelay);
        }
    }

    private _hoverChanged(hover: boolean) {
        if (!this._currentTarget)
            return;

        if (hover)
            this._currentTarget.setAttribute("hover", "");
        else
            this._currentTarget.removeAttribute("hover");
    }

    static closeAll(parent?: HTMLElement | WebComponent) {
        const rootPopup = openPopups[0];
        if (rootPopup && (!parent || PopupCore._isDescendant(<HTMLElement>parent, rootPopup)))
            rootPopup.close();
    }

    private static _isDescendant(parent: HTMLElement, child: HTMLElement): boolean {
        let node = child.parentNode;
        while (node != null) {
            if (node === parent)
                return true;

            node = node.parentNode;
        }

        return false;
    }
}