import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { Path } from "libs/pathjs/pathjs"
import type { AppBase } from "components/app/app-base"
import type { App } from "components/app/app"
import * as IconRegister from "components/icon/icon-register"
import * as Keyboard from "components/utils/keyboard"
import { IronA11yKeysElement } from "@polymer/iron-a11y-keys"

Polymer.Settings.setLegacyUndefined(true);
Polymer.Settings.setOrderedComputed(true);
Polymer.Settings.setPassiveTouchGestures(true);
Polymer.Settings.setRemoveNestedTemplates(true);
Polymer.Settings.setSuppressTemplateNotifications(true);

class Operations {
    areSame(value1: any, value2: any): boolean {
        return value1 === value2;
    }

    areNotSame(value1: any, value2: any): boolean {
        return value1 !== value2;
    }

    areEqual(value1: any, value2: any): boolean {
        return value1 == value2;
    }

    areNotEqual(value1: any, value2: any): boolean {
        return value1 != value2;
    }

    some(...args: any[]): boolean {
        return args.some(a => !!a && (!Array.isArray(a) || a.length > 0));
    }

    every(...args: any[]) {
        return args.every(a => !!a && (!Array.isArray(a) || a.length > 0));
    }

    none(...args: any[]) {
        return args.every(a => !a && (!Array.isArray(a) || a.length === 0));
    }

    isNull(value: any): boolean {
        return value == null;
    }

    isNotNull(value: any): boolean {
        return value != null;
    }

    isEmpty(value: string): boolean {
        return !value;
    }

    isNotEmpty(value: string): boolean {
        return !!value;
    }
}

export interface IPosition {
    x: number;
    y: number;
}

export interface IWebComponentProperties {
    [name: string]: ObjectConstructor | StringConstructor | BooleanConstructor | DateConstructor | NumberConstructor | ArrayConstructor | IWebComponentProperty;
}

export interface IWebComponentProperty {
    type: ObjectConstructor | StringConstructor | BooleanConstructor | DateConstructor | NumberConstructor | ArrayConstructor;
    computed?: string;
    reflectToAttribute?: boolean;
    readOnly?: boolean;
    observer?: string;
    value?: number | boolean | string | Function;
    notify?: boolean;
}

export interface IWebComponentKeybindingInfo {
    [keys: string]: {
        listener: string;

        /*
         * if nonExclusive is set to true then the observer will also be called when there are other observers bound to any of the same keys.
         */
        nonExclusive?: boolean;

        priority?: number;
    } | string;
}

export interface IWebComponentRegistrationInfo {
    properties?: IWebComponentProperties;
    listeners?: { [eventName: string]: string };
    observers?: string[];

    // Non-default Polymer registration info

    /**
     * Binds keys to local observer functions
     */
    keybindings?: IWebComponentKeybindingInfo;

    /**
     * forwardObservers is used to forward Vidyano.Common.Observable notifications to Polymer notifyPath
     */
    forwardObservers?: string[];

    /**
     * serviceBusObservers is used to subscribe to messages send over the global ServiceBus
     */
    serviceBusObservers?: { [message: string]: string };

    /**
     * If true, the component will add readonly isDesktop, isTablet, isPhone properties with reflectToAttribute
     */
    mediaQueryAttributes?: boolean;

    /**
     * If true, the component will add a readonly is-app-sensitive property with reflectToAttribute. The value will be toggled by the app.
     */
    sensitive?: boolean;
}

export class WebComponent extends Polymer.GestureEventListeners(Polymer.PolymerElement) {
    private _appChangedListener: EventListener;
    private _serviceChangedListener: EventListener;
    readonly isConnected: boolean; private _setIsConnected: (isConnected: boolean) => void;
    readonly app: AppBase; private _setApp: (app: AppBase) => void;
    readonly service: Vidyano.Service;
    readonly translations: { [key: string]: string; };
    protected readonly isAppSensitive: boolean;

    connectedCallback() {
        this._setApp(window["app"]);
        if (!this.app)
            this._listenForApp();
        else if (!this.app.service)
            this._listenForService(this.app);
            
        super.connectedCallback();
        this._setIsConnected(true);

        if (this._updateListeners)
            this._updateListeners(true);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._setIsConnected(false);

        if (this._updateListeners)
            this._updateListeners(false);
        
        if (!!this._appChangedListener)
            window.removeEventListener("app-changed", this._appChangedListener);

        if (!!this._serviceChangedListener)
            this.app.removeEventListener("service-changed", this._serviceChangedListener);
    }

    declare private _updateListeners: (isConnected: boolean) => void;

    private _listenForApp() {
        window.addEventListener("app-changed", this._appChangedListener = (e: CustomEvent) => {
            window.removeEventListener("app-changed", this._appChangedListener);
            this._appChangedListener = null;

            this._setApp(window["app"]);

            if (!this.app.service)
                this._listenForService(this.app);
        });
    }

    private _listenForService(app: AppBase) {
        app.addEventListener("service-changed", this._serviceChangedListener = (e: CustomEvent) => {
            app.removeEventListener("service-changed", this._serviceChangedListener);
            this._serviceChangedListener = null;

            this.notifyPath("app.service", e.detail.value);
        });
    }

    todo_checkEventTarget(target: EventTarget): EventTarget {
        console.assert(false, "Check event target", target);
        return target;
    }

    ensureArgumentValues(args: IArguments): boolean {
        return !Array.from(args).some(a => a === undefined);
    }

    $: { [key: string]: HTMLElement };

    computePath(relativePath: string): string {
        return Path.routes.rootPath + relativePath;
    }

    empty(parent: Node = this, condition?: (e: Node) => boolean) {
        let children = Array.from(parent.childNodes);
        if (condition)
            children = children.filter(c => condition(c));

        children.forEach(c => parent.removeChild(c));
    }

    findParent<T extends HTMLElement>(condition: (element: Node) => boolean = e => !!e, parent?: Node): T {
        if (!parent) {
            parent = this.parentElement ||
                     (this.parentNode instanceof ShadowRoot ? (<ShadowRoot>this.parentNode).host : null);
        }

        while (!!parent && !condition(parent)) {
            parent = parent.parentElement ||
                     (parent.parentNode instanceof ShadowRoot ? (<ShadowRoot>parent.parentNode).host : null);
        }

        return <T><any>parent;
    }

    /**
     * Dispatches a custom event with an optional detail value.
     * @param {string} type Name of event type.
     * @param {*=} detail Detail value containing event-specific payload.
     * @param {{ bubbles: (boolean|undefined), cancelable: (boolean|undefined), composed: (boolean|undefined) }=}
     *  options Object specifying options.  These may include:
     *  `bubbles` (boolean, defaults to `true`),
     *  `cancelable` (boolean, defaults to false), and
     *  `node` on which to fire the event (HTMLElement, defaults to `this`).
     * @return {!Event} The new event that was fired.
     * @deprecated Use dispatchEvent(new CustomEvent(...)) directly instead.
     */
    fire(type: string, detail?: any, options?: { node?: Node, bubbles?: boolean, cancelable?: boolean, composed?: boolean }): Event {
        options = options || {};
        detail = (detail === null || detail === undefined) ? {} : detail;
        let event = new CustomEvent(type, {
            detail: detail,
            bubbles: options.bubbles === undefined ? true : options.bubbles,
            cancelable: Boolean(options.cancelable),
            composed: options.composed === undefined ? true : options.composed
        });

        const node = options.node || this;
        node.dispatchEvent(event);

        return event;
    }

    protected sleep(milliseconds: number): Promise<never> {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    translateMessage(key: string, ...params: string[]): string {
        if (!key || !this.app || !this.service || !this.service.language)
            return key;

        return this.service.getTranslatedMessage.apply(this.service, [key].concat(params));
    }

    protected _focusElement(element: string | HTMLElement, maxAttempts?: number, interval?: number, attempt: number = 0) {
        const target = typeof element === "string" ? <HTMLElement>this.shadowRoot.querySelector(`#${element}`) : <HTMLElement>element;
        if (target) {
            const oldActiveElementPath = this.app.activeElementPath;
            if (oldActiveElementPath.some(e => e === target))
                return;

            target.focus();

            const currentActiveElementPath = this.app.activeElementPath;
            if (oldActiveElementPath.length !== currentActiveElementPath.length)
                return;

            if (oldActiveElementPath.some((e, i) => currentActiveElementPath[i] !== e))
                return;
        }

        if (attempt < (maxAttempts || 10))
            setTimeout(() => this._focusElement(target || element, maxAttempts, interval, attempt + 1), interval || 100);
    }

    protected _escapeHTML(val: string): string {
        const span = document.createElement("span");
        span.innerText = val;

        return span.innerHTML;
    }

    protected _forwardObservable(source: Vidyano.Observable<any> | Array<any>, path: string, pathPrefix: string, callback?: (path: string) => void): Vidyano.ForwardObservedChainDisposer {
        return Vidyano.Observable.forward(source, path, (detail: Vidyano.ForwardObservedPropertyChangedArgs | Vidyano.ForwardObservedArrayChangedArgs) => {
            if (detail instanceof Vidyano.ForwardObservedPropertyChangedArgs) {
                const pathToNotify = !!pathPrefix ? `${pathPrefix}.${detail.path}` : detail.path;
                this.notifyPath(pathToNotify, detail.newValue);

                if (callback)
                    callback(pathToNotify);
            } else if (detail instanceof Vidyano.ForwardObservedArrayChangedArgs) {
                const pathToNotify = !!pathPrefix ? `${pathPrefix}.${detail.path}` : detail.path;
                this.notifySplices(pathToNotify, [{
                    index: detail.index,
                    removed: detail.removedItems,
                    addedCount: detail.addedItemCount,
                    object: detail.arrayInstance,
                    type: "splice"
                }]);

                if (callback)
                    callback(pathToNotify);
            }
        }, false);
    }

    /**
     * Forwards the service.language.messages to the translations property. Can be overridden to provide custom translations.
     * @param messages - The current service.language.messages
     * @returns The translations to be used in the component
     */
    protected _computeTranslations(messages: Record<string, string>): Record<string, string> {
        return messages;
    }

    // This function simply returns the value. This can be used to reflect a property on an observable object as an attribute.
    private _forwardComputed(value: any): any {
        return value;
    }

    // This function simply returns the negated value. This can be used to reflect a property on an observable object as an attribute.
    private _forwardNegate(value: boolean): boolean {
        return !value;
    }

    // This function converts the value to a boolean.
    private _forwardTruthy(value: any): boolean {
        return !!value;
    }

    private static _scanTemplateForLayoutClasses(template: HTMLTemplateElement) {
        if (template.content.querySelectorAll(".layout, .flex").length > 0)
            return true;

        return Array.from(template.content.querySelectorAll("template")).some(t => WebComponent._scanTemplateForLayoutClasses(t));
    }

    private static _updateTemplateProperty(element: CustomElementConstructor, elementName: string) {
        const baseTemplate = <HTMLTemplateElement>element["template"];
        if (!baseTemplate)
            return;

        Object.defineProperty(element, "template", {
            get: () => {
                const template = <HTMLTemplateElement>Polymer.DomModule.import(`${elementName}-template-module`, "template") || baseTemplate;

                const resetStyle = document.createElement("style");
                resetStyle.setAttribute("include", "vi-reset-css-style-module");
                template.content.insertBefore(resetStyle, template.content.firstChild);

                // Add vi-flex-layout-style-module if template contains layout or flex class
                if (WebComponent._scanTemplateForLayoutClasses(template)) {
                    const flexStyle = document.createElement("style");
                    flexStyle.setAttribute("include", "vi-flex-layout-style-module");
                    template.content.insertBefore(flexStyle, resetStyle.nextSibling);
                }

                // Add style module by naming pattern "elementName-style-module" if it exists
                const userStyleModule = <HTMLTemplateElement>Polymer.DomModule.import(`${elementName}-style-module`);
                if (userStyleModule != null) {
                    const style = document.createElement("style");
                    style.setAttribute("include", `${elementName}-style-module`);

                    // Safari doesn't allow style:last-of-type here
                    const lastStyle = Array.from(template.content.children).filter(c => c instanceof HTMLStyleElement).pop();
                    if (lastStyle != null)
                        template.content.insertBefore(style, lastStyle.nextSibling);
                    else
                        template.content.insertBefore(style, template.content.firstChild);
                }

                // Move icons out of the template and register for later reuse
                const icons = template.content.querySelectorAll("vi-icon[name]");
                icons.forEach(icon => {
                    const iconTemplate = document.createElement("template");
                    iconTemplate.innerHTML = icon.outerHTML;
                    IconRegister.add(Polymer.html`${iconTemplate}`);

                    icon.parentNode.removeChild(icon);
                });

                return template;
            },
            enumerable: false
        });
    }

    private static _register(element: CustomElementConstructor, info: IWebComponentRegistrationInfo = {}, prefixOrElementName: string = "") {
        const needsSuffix = prefixOrElementName && !prefixOrElementName.includes("-");
        const elementName = needsSuffix ? `${prefixOrElementName}-${element.name.toKebabCase()}` : prefixOrElementName;
        WebComponent._updateTemplateProperty(element, elementName);

        let baseProperties: IWebComponentProperties = {};
        let baseType = Object.getPrototypeOf(element);
        while (baseType !== WebComponent) {
            const basePropertyInfo = baseType["properties"];
            if (!!basePropertyInfo)
                Object.assign(baseProperties, basePropertyInfo || {});
            
            baseType = Object.getPrototypeOf(baseType);
        }

        info.properties = info.properties || {};
        element["properties"] = info.properties;

        for (const p in <IWebComponentProperties>info.properties) {
            const prop = info.properties[p];
            if (typeof prop === "object") {
                if (prop.computed && !/\)$/.test(prop.computed)) {
                    if (prop.computed[0] !== "!")
                        prop.computed = "_forwardComputed(" + prop.computed + ")";
                    else {
                        if (prop.computed[1] !== "!")
                            prop.computed = "_forwardNegate(" + prop.computed.substring(1) + ")";
                        else
                        prop.computed = "_forwardTruthy(" + prop.computed.substring(2) + ")";
                    }
                }
            }
        }

        if (!baseProperties.isConnected && !info.properties.isConnected) {
            info.properties.isConnected = {
                type: Boolean,
                readOnly: true
            };
        }

        if (!baseProperties.app && !info.properties.app) {
            info.properties.app = {
                type: Object,
                readOnly: true
            };
        }

        if (!baseProperties.service && !info.properties.service) {
            info.properties.service = {
                type: Object,
                computed: "_forwardComputed(app.service)"
            };
        }

        if (!baseProperties.translations && !info.properties.translations) {
            info.properties.translations = {
                type: Object,
                computed: "_computeTranslations(service.language.messages)"
            };
        }

        if (info.listeners) {
            element.prototype._updateListeners = function(isConnected: boolean) {
                if (isConnected) {
                    for (const l in info.listeners) {
                        if (this[info.listeners[l]])
                            this._addEventListenerToNode(this, l, this[info.listeners[l]].bound = this[info.listeners[l]].bind(this));
                        else
                            console.warn(`listener method '${info.listeners[l]}' not defined`);
                    }
                }
                else {
                    for (const l in info.listeners) {
                        if (!this[info.listeners[l]])
                            continue;

                        this._removeEventListenerFromNode(this, l, this[info.listeners[l]].bound);
                        this[info.listeners[l]].bound = undefined;
                    }
                }
            }
        }

        element["observers"] = info.observers || (info.observers = []);

        info.forwardObservers = info.forwardObservers || [];
        info.forwardObservers.push("service.language");
        info.forwardObservers.push("service.language.messages");

        info.forwardObservers.groupBy(path => {
            const functionIndex = path.indexOf("(");
            return (functionIndex > 0 ? path.substr(functionIndex + 1) : path).split(".", 2)[0];
        }).forEach(source => {
            const methodName = `_observablePropertyObserver_${source.key}`;
            const methodValues = `${methodName}_values`;

            if (!!element.prototype[methodName]) {
                const values = Array.from(element.prototype[methodValues]);
                source.value.forEach(v => {
                    if (values.indexOf(v) >= 0)
                        return;

                    values.push(v);
                });

                return;
            }

            element.prototype[methodValues] = source.value.slice(0);

            info.observers.push(`${methodName}(${source.key}, isConnected)`);
            element.prototype[methodName] = function (sourceObj: any, isConnected: boolean) {
                if (sourceObj == null)
                    return;

                const forwardObserversCollectionName = `_forwardObservers_${source.key}`;
                const forwardObservers = this[forwardObserversCollectionName] || (this[forwardObserversCollectionName] = []) || [];

                while (forwardObservers.length > 0)
                    forwardObservers.pop()();

                if (!isConnected)
                    return;

                element.prototype[methodValues].forEach((p: string) => {
                    const functionIndex = p.indexOf("(");
                    const path = functionIndex > 0 ? p.substr(functionIndex + source.key.length + 2, p.length - (functionIndex + source.key.length + 2) - 1) : p.substr(source.key.length + 1);

                    let observer = functionIndex > 0 ? this[p.substr(0, functionIndex)] : null;
                    if (observer)
                        observer = observer.bind(this);

                    forwardObservers.push(this._forwardObservable(sourceObj, path, source.key, observer));
                    if (observer && sourceObj && isConnected) {
                        const valuePath = path.slice().split(".").reverse();
                        let value = sourceObj;

                        do {
                            value = value[valuePath.pop()];
                        }
                        while (value != null && valuePath.length > 0);

                        observer(value);
                    }
                });
            };
        });

        if (info.keybindings) {
            (info.observers = info.observers || []).push("_keybindingsObserver(isConnected)");

            element.prototype._keybindingsObserver = function (isConnected: boolean) {
                if (isConnected) {
                    if (!this._keybindingRegistrations)
                        this._keybindingRegistrations = [];

                    const registerKeybinding = (keys: string) => {
                        let keybinding = info.keybindings[keys];
                        if (typeof keybinding === "string")
                            keybinding = { listener: keybinding };

                        const listener = this[keybinding.listener];
                        if (!listener) {
                            console.warn("Keybindings listener '" + keybinding.listener + "' not found on element " + this.is);
                            return;
                        }

                        const eventListener = (e: Keyboard.IKeysEvent) => {
                            let combo = e.detail.combo;
                            if (e.detail.keyboardEvent.ctrlKey && combo.indexOf("ctrl") < 0)
                                combo = "ctrl+" + combo;
                            if (e.detail.keyboardEvent.shiftKey && combo.indexOf("shift") < 0)
                                combo = "shift+" + combo;
                            if (e.detail.keyboardEvent.altKey && combo.indexOf("alt") < 0)
                                combo = "alt+" + combo;

                            const registrations = this._keybindingRegistrations.find(r => r.keys.some(k => k === combo));
                            if (!registrations)
                                return;

                            if (listener.call(this, e.detail.keyboardEvent) === true)
                                return;

                            e.stopPropagation();
                            e.detail.keyboardEvent.stopPropagation();
                            e.detail.keyboardEvent.preventDefault();
                        };

                        const element = <IronA11yKeysElement>document.createElement("iron-a11y-keys");
                        element.target = this;
                        element.keys = keys;
                        element.style.display = "none";
                        element.addEventListener("keys-pressed", eventListener);

                        const registration: Keyboard.IKeybindingRegistration = {
                            keys: keys.split(" "),
                            element: element,
                            listener: eventListener,
                            priority: keybinding.priority || 0,
                            nonExclusive: keybinding.nonExclusive
                        };

                        this._keybindingRegistrations.push(registration);
                        this.shadowRoot.appendChild(element);

                        this.app._registerKeybindings(registration);
                    };

                    for (const keys in info.keybindings) {
                        registerKeybinding(keys);
                    }
                }
                else {
                    if (this._keybindingRegistrations) {
                        while (this._keybindingRegistrations.length > 0) {
                            const reg = this._keybindingRegistrations.splice(0, 1)[0];

                            this.app._unregisterKeybindings(reg);

                            reg.element.removeEventListener("keys-pressed", reg.listener);
                            this.shadowRoot.removeChild(reg.element);
                        }
                    }
                }
            };
        }

        if (info.mediaQueryAttributes) {
            info.properties.isDesktop = {
                type: Boolean,
                reflectToAttribute: true,
                readOnly: true
            };

            info.properties.isTablet = {
                type: Boolean,
                reflectToAttribute: true,
                readOnly: true
            };

            info.properties.isPhone = {
                type: Boolean,
                reflectToAttribute: true,
                readOnly: true
            };

            info.observers.push("_mediaQueryObserver(app)");

            element.prototype._mediaQueryObserver = function (app: App) {
                if (this._mediaQueryObserverInfo) {
                    this._mediaQueryObserverInfo.app.removeEventListener("media-query-changed", this._mediaQueryObserverInfo.listener);
                    this._mediaQueryObserverInfo = null;
                }

                if (app) {
                    this._mediaQueryObserverInfo = {
                        app: app,
                        listener: (e: Event) => {
                            this["_setIsDesktop"](e["detail"] === "desktop");
                            this["_setIsTablet"](e["detail"] === "tablet");
                            this["_setIsPhone"](e["detail"] === "phone");
                        }
                    };

                    this["_setIsDesktop"](app["isDesktop"]);
                    this["_setIsTablet"](app["isTablet"]);
                    this["_setIsPhone"](app["isPhone"]);

                    app.addEventListener("media-query-changed", this._mediaQueryObserverInfo.listener);
                }
            };
        }

        if (info.sensitive) {
            info.properties.isAppSensitive = {
                type: Boolean,
                reflectToAttribute: true,
                readOnly: true,
                value: false
            };

            info.serviceBusObservers = info.serviceBusObservers || {};
            info.serviceBusObservers["vi-app:sensitive-changed"] = "_appSensitiveChangedObserver"

            element.prototype._appSensitiveChangedObserver = <Vidyano.ServiceBusCallback>function (sender: any, message: string, detail: any) {
                this["_setIsAppSensitive"](detail);
            };
        }

        if (info.serviceBusObservers) {
            (info.observers = info.observers || []).push("_serviceBusObserver(isConnected)");
            element.prototype["_serviceBusObserver"] = function (isConnected: boolean) {
                if (!this._serviceBusRegistrations)
                    this._serviceBusRegistrations = [];

                if (isConnected) {
                    for (const message in info.serviceBusObservers) {
                        const callback = this[info.serviceBusObservers[message]];
                        if (callback)
                            this._serviceBusRegistrations.push(Vidyano.ServiceBus.subscribe(message, callback.bind(this), true));
                        else
                            console.warn("ServiceBus listener callback '" + message + "' not found on element " + this.is);
                    }
                }
                else {
                    this._serviceBusRegistrations.forEach(disposer => disposer());
                    this._serviceBusRegistrations = [];
                }
            };
        }

        for (let p in info.properties) {
            if (typeof info.properties[p] === "object") {
                const prop = <IWebComponentProperty>info.properties[p];
                if (prop.computed && !prop.computed.startsWith("_forwardComputed(") && !prop.computed.startsWith("_forwardNegate(")) {
                    if (elementName.startsWith("vi-") && (!prop.computed.startsWith("_compute") && !prop.computed.startsWith("op_")))
                        console.warn(`Naming convention violation for computed property "${p}" on element "${elementName}"`);
                }
            }
        }

        for (let fn of Object.getOwnPropertyNames(Operations.prototype)) {
            if (fn === "constructor")
                continue;

            element.prototype[`op_${fn}`] = Operations.prototype[fn];
        }

        if (!!elementName && !window.VidyanoSettings?.skipElements?.includes(elementName))
            window.customElements.define(elementName, element);

        return element;
    }

    private static _abstractRegistrations: { [key: string]: IWebComponentRegistrationInfo; } = {};
    private static readonly REGISTRATION_PROCESSED = Symbol("WebComponent.registrationProcessed");

    static register(prefixOrElementName: string): (obj: any) => void;
    static register(info: IWebComponentRegistrationInfo, prefixOrElementName: string): (obj: any) => void;
    static register(): (obj: any) => void;
    static register(firstArg?: IWebComponentRegistrationInfo | string, secondArg?: string): (obj: any) => void {
        let registrationInfoFromArgs: IWebComponentRegistrationInfo | undefined;
        let prefixOrElementNameFromArgs: string | undefined;

        if (typeof firstArg === 'string') {
            registrationInfoFromArgs = undefined;
            prefixOrElementNameFromArgs = firstArg;
        } else {
            registrationInfoFromArgs = firstArg;
            prefixOrElementNameFromArgs = secondArg;
        }

        return (target: CustomElementConstructor) => {
            // Check if this class has already been processed
            if (Object.prototype.hasOwnProperty.call(target, WebComponent.REGISTRATION_PROCESSED))
                return target;

            let currentProto = Object.getPrototypeOf(target);
            let info: IWebComponentRegistrationInfo = {};

            while (currentProto && currentProto !== WebComponent) {
                // Stop at already processed classes to avoid duplicate registration
                if (Object.prototype.hasOwnProperty.call(currentProto, WebComponent.REGISTRATION_PROCESSED))
                    break;

                const baseInfo = WebComponent._abstractRegistrations[currentProto.name];
                if (baseInfo)
                    info = WebComponent._clone(Vidyano.extend(info, WebComponent._clone(baseInfo)));

                currentProto = Object.getPrototypeOf(currentProto);
            }

            const targetInfo = <IWebComponentRegistrationInfo>registrationInfoFromArgs;
            if (targetInfo) {
                if (targetInfo.properties)
                    info.properties = info.properties ? Vidyano.extend(info.properties, targetInfo.properties) : targetInfo.properties;

                if (targetInfo.listeners)
                    info.listeners = info.listeners ? Vidyano.extend(info.listeners, targetInfo.listeners) : targetInfo.listeners;

                if (targetInfo.keybindings)
                    info.keybindings = info.keybindings ? Vidyano.extend(info.keybindings, targetInfo.keybindings) : targetInfo.keybindings;

                if (targetInfo.observers)
                    info.observers ? info.observers.push(...targetInfo.observers) : (info.observers = targetInfo.observers);

                if (targetInfo.forwardObservers)
                    info.forwardObservers ? info.forwardObservers.push(...targetInfo.forwardObservers) : (info.forwardObservers = targetInfo.forwardObservers);

                if (typeof targetInfo.mediaQueryAttributes !== "undefined")
                    info.mediaQueryAttributes = targetInfo.mediaQueryAttributes;

                if (typeof targetInfo.sensitive !== "undefined")
                    info.sensitive = targetInfo.sensitive;

                if (targetInfo.serviceBusObservers)
                    info.serviceBusObservers = info.serviceBusObservers ? Vidyano.extend(info.serviceBusObservers, targetInfo.serviceBusObservers) : targetInfo.serviceBusObservers;
            }
            
            const result = WebComponent._register(target, WebComponent._clone(info), prefixOrElementNameFromArgs);
            
            // Mark the class as processed to avoid duplicate registration in future inheritance chains
            target[WebComponent.REGISTRATION_PROCESSED] = true;
            
            return result;
        };
    }

    static registerAbstract(info?: IWebComponentRegistrationInfo): (obj: any) => void {
        return (target: Function) => {
            WebComponent._abstractRegistrations[Object(target).name] = info;
        };
    }

    private static _clone(source: any, depth: number = 0): any {
        const output = Array.isArray(source) ? [] : {};
        for (let key in source) {
            if (key === "behaviors" && depth === 0) {
                output[key] = source[key];
                continue;
            }

            const value = source[key];
            output[key] = (value != null && typeof value === "object") ? WebComponent._clone(value, depth + 1) : value;
        }

        return output;
    }
}