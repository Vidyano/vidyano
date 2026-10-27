import { html } from "lit";
import { ServiceBus } from "@vidyano/core";
import { WebComponent, serviceBusObserver } from "../../src/web-components/web-component/web-component.js";

export const symbolMessage = Symbol("test-service-bus:symbol");

type Received = { message: string; detail: any; self: boolean };

class TestServiceBusObserver extends WebComponent {
    received: Received[] = [];
    ignoredLast: Received[] = [];

    static send(message: string, detail?: any) {
        ServiceBus.send(message, detail);
    }

    static sendSymbol(detail?: any) {
        ServiceBus.send(symbolMessage, detail);
    }

    @serviceBusObserver("test-service-bus:message")
    protected _onMessage(_sender: any, message: string, detail: any) {
        this.received.push({ message, detail, self: this instanceof TestServiceBusObserver });
    }

    @serviceBusObserver(symbolMessage)
    protected _onSymbol(_sender: any, _message: symbol, detail: any) {
        this.received.push({ message: "symbol", detail, self: this instanceof TestServiceBusObserver });
    }

    @serviceBusObserver("test-service-bus-ignore:last", { receiveLast: false })
    protected _onIgnoreLast(_sender: any, message: string, detail: any) {
        this.ignoredLast.push({ message, detail, self: true });
    }

    render() {
        return html`<span id="count">${this.received.length}</span>`;
    }
}

class TestServiceBusObserverDerived extends TestServiceBusObserver {
    @serviceBusObserver("test-service-bus:derived")
    protected _onDerived(_sender: any, message: string, detail: any) {
        this.received.push({ message, detail, self: this instanceof TestServiceBusObserverDerived });
    }
}

export { TestServiceBusObserver, TestServiceBusObserverDerived };

customElements.define("test-service-bus-observer", TestServiceBusObserver);
customElements.define("test-service-bus-observer-derived", TestServiceBusObserverDerived);
