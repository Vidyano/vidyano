import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import "../../web-components/notification/notification.js"
import { WebComponent } from "../../web-components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        ok: Object,
        notice: Object,
        warning: Object,
        error: Object,
        long: Object,
        url: Object
    }
})
export class NotificationTest extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="notification-test.html">`; }

    ok: Vidyano.ServiceObjectWithActions;
    notice: Vidyano.ServiceObjectWithActions;
    warning: Vidyano.ServiceObjectWithActions;
    error: Vidyano.ServiceObjectWithActions;
    long: Vidyano.ServiceObjectWithActions;
    url: Vidyano.ServiceObjectWithActions;

    connectedCallback() {
        super.connectedCallback();
        Polymer.Async.microTask.run(this._init.bind(this));
    }

    private _init() {
        this.ok = new Vidyano.ServiceObjectWithActions(this.service, [], {});
        this.ok.setNotification("OK", "OK", 0);

        this.notice = new Vidyano.ServiceObjectWithActions(this.service, [], {});
        this.notice.setNotification("Notice", "Notice", 0);

        this.warning = new Vidyano.ServiceObjectWithActions(this.service, [], {});
        this.warning.setNotification("Warning", "Warning", 0);

        this.error = new Vidyano.ServiceObjectWithActions(this.service, [], {});
        this.error.setNotification("Error", "Error", 0);

        this.long = new Vidyano.ServiceObjectWithActions(this.service, [], {});
        this.long.setNotification("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.", "OK", 0);

        this.url = new Vidyano.ServiceObjectWithActions(this.service, [], {});
        this.url.setNotification("[url:Vidyano|https://vidyano.com]", "OK", 0);
    }
}