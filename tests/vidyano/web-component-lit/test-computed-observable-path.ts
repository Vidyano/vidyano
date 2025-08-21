import { WebComponentLit } from "../../../src/vidyano/web-components/web-component/web-component-lit.js";
import { property } from "../../../src/vidyano/web-components/web-component/web-component-decorators.js";
import { html } from "lit";
import { Observable } from "../../../src/core/observable/index.js";

export class ServiceObject extends Observable<any> {
    #isBusy: boolean;

    constructor(isBusy: boolean = false) {
        super();
        this.#isBusy = isBusy;
    }

    get isBusy(): boolean {
        return this.#isBusy;
    }

    set isBusy(value: boolean) {
        if (this.#isBusy !== value) {
            const oldValue = this.#isBusy;
            this.notifyPropertyChanged("isBusy", this.#isBusy = value, oldValue);
        }
    }
}

class TestComputedObservablePath extends WebComponentLit {
    @property({ type: Object })
    declare serviceObject?: ServiceObject;

    @property({ type: Boolean, computed: "serviceObject.isBusy" })
    declare readonly loading: boolean;

    constructor() {
        super();
        // serviceObject is initially undefined
        // 'loading' will default to false for a boolean if serviceObject or serviceObject.isBusy is undefined/unresolvable.
    }

    render() {
        return html`
            <p>Tests computed property from an Observable object path (serviceObject.isBusy).</p>
            <div>Service Object IsBusy: <span id="service-busy">${this.serviceObject?.isBusy ?? 'N/A'}</span></div>
            <div>Loading State: <span id="loading-state">${this.loading}</span></div>
            <!-- Buttons for manual testing/debugging if needed -->
            <button id="initServiceTrue" @click=${() => this.initializeServiceObject(true)}>Init Service (isBusy=true)</button>
            <button id="initServiceFalse" @click=${() => this.initializeServiceObject(false)}>Init Service (isBusy=false)</button>
            <button id="setBusyTrue" @click=${() => this.updateServiceIsBusy(true)}>Set isBusy = true</button>
            <button id="setBusyFalse" @click=${() => this.updateServiceIsBusy(false)}>Set isBusy = false</button>
            <button id="clearService" @click=${() => this.clearServiceObject()}>Clear Service</button>
        `;
    }

    initializeServiceObject(isBusy: boolean) {
        this.serviceObject = new ServiceObject(isBusy);
    }

    updateServiceIsBusy(isBusy: boolean) {
        if (this.serviceObject) {
            this.serviceObject.isBusy = isBusy;
        } else {
            console.warn("ServiceObject not initialized before updating isBusy state.");
        }
    }

    clearServiceObject() {
        this.serviceObject = undefined;
    }
}

customElements.define("test-computed-observable-path", TestComputedObservablePath);
