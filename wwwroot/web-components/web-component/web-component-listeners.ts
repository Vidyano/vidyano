import * as Polymer from "../../libs/polymer/polymer"

const registry: { [ key: string]: { [eventName: string]: string } } = {};
const registryMap = new Map();

export class WebComponentListenerRegistry {
    static registerElement(elementName: string, element: CustomElementConstructor, listeners: { [eventName: string]: string }) {
        const baseListeners = Object.assign({}, registryMap.get(Object.getPrototypeOf(element)) || {});

        const key = elementName.toUpperCase();
        registry[key] = Object.assign(registry[key] || {}, baseListeners, listeners);
        registryMap.set(element, registry[key]);
    }

    static implements(element: CustomElementConstructor) {
        return !!element.prototype["_updateListeners"];
    }
}

type Constructor<T = Polymer.PolymerElement> = new (...args: any[]) => T;

export default <T extends Constructor>(base: T) => class extends base {
    connectedCallback() {
        this._updateListeners(true);
        super.connectedCallback();
    }

    disconnectedCallback() {
        this._updateListeners(false);
        super.disconnectedCallback();
    }

    _updateListeners(isConnected: boolean) {
        const listeners = registry[this.tagName];

        if (isConnected) {
            for (const l in listeners) {
                if (this[listeners[l]])
                    this._addEventListenerToNode(this, l, this[listeners[l]].bound = this[listeners[l]].bind(this));
                else
                    console.warn(`listener method '${listeners[l]}' not defined`);
            }
        }
        else {
            for (const l in listeners) {
                if (!this[listeners[l]])
                    continue;

                this._removeEventListenerFromNode(this, l, this[listeners[l]].bound);
                this[listeners[l]].bound = undefined;
            }
        }
    }
}