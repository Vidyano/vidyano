import { WebComponent } from "../web-component/web-component.js"

export interface ISize {
    width: number;
    height: number;
}

export interface SizeTrackerEvent extends CustomEvent {
    detail: ISize;
}

interface IResizeObserver {
    observe: (target: HTMLElement) => void;
    unobserve: (target: HTMLElement) => void;
}

declare class ResizeObserver implements IResizeObserver {
    constructor(observer: (entries: { target: HTMLElement; contentRect: ClientRect }[]) => void);
    observe: (target: HTMLElement) => void;
    unobserve: (target: HTMLElement) => void;
}

let resizeObserver: ResizeObserver;
resizeObserver = new ResizeObserver(entries => {	
    entries.forEach(e => {
        let tracker = <SizeTracker>Array.from(e.target.shadowRoot?.children || e.target.children).find(e => e instanceof SizeTracker);
        if (tracker)
            tracker["_triggerSizeChanged"](e.contentRect);	
    });	
});

@WebComponent.register({
    properties: {
        deferred: {
            type: Boolean,
            reflectToAttribute: true
        },
        size: {
            type: Object,
            readOnly: true,
            notify: true
        },
        triggerZero: {
            type: Boolean,
            reflectToAttribute: true
        },
        bubbles: {
            type: Boolean,
            reflectToAttribute: true
        },
        noResizeObserver: {
            type: Boolean,
            readOnly: true
        }
    }
})
export class SizeTracker extends WebComponent {
    private _resizeLast: ISize;
    private _isActive: boolean;
    readonly size: ISize; private _setSize: (size: ISize) => void;
    deferred: boolean;
    triggerZero: boolean;
    bubbles: boolean;

    connectedCallback() {
        super.connectedCallback();

        if (this.deferred)
            return;

        this.measure();
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        resizeObserver.unobserve(this._parentElement);
    }

    measure() {
        if (!this._isActive) {
            this.deferred = false;
            resizeObserver.observe(this._parentElement);

            this._isActive = true;
        }

        if (this._resizeLast) {
            this._setSize(this._resizeLast);
            this.fire("sizechanged", this._resizeLast, { node: this, bubbles: !!this.bubbles });
        }
    }

    private get _parentElement(): HTMLElement {
        return this.parentElement || <HTMLElement>(<ShadowRoot>this.getRootNode())?.host;
    }

    private _triggerSizeChanged(cr: { width: number; height: number; }) {
        if (!this._resizeLast || cr.width !== this._resizeLast.width || cr.height !== this._resizeLast.height) {
            this._resizeLast = {
                width: cr.width,
                height: cr.height
            };

            if ((this._resizeLast.width === 0 || this._resizeLast.height === 0) && !this.triggerZero)
                return;

            this._setSize(this._resizeLast);
            this.fire("sizechanged", this._resizeLast, { node: this, bubbles: !!this.bubbles });
        }
    }
}