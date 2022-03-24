import { IronOverlayBehavior } from "../../libs/polymer/polymer.js";
import { App } from "../../web-components/app/app.js";
import { Button } from "../../web-components/button/button.js";
import { init, waitFor } from "./../helpers.js"

QUnit.module("Dialog tests", hooks => {
    let app: App;

    hooks.beforeEach(async assert => {
        app = await init("components/dialog");
        assert.ok(await waitFor(() => document.querySelector("body > iron-overlay-backdrop") == null), "No dialogs open");
    });

    hooks.afterEach(async assert => {
        assert.ok(await waitFor(() => document.querySelector("body > iron-overlay-backdrop") == null), "All dialogs closed");
    });

    QUnit.test("Message dialog", async assert => {
        app.showMessageDialog({
            message: "Test",
            title: "Test title",
            actions: ["Cancel", "Ok"],
            defaultAction: 1
        });

        assert.equal((await waitFor(() => app.shadowRoot.querySelector("vi-message-dialog")?.shadowRoot?.querySelector("vi-dialog-core > main > pre"))).innerHTML, "Test");
        
        (app.shadowRoot.querySelector("vi-message-dialog").shadowRoot.querySelector("#actions > vi-button:nth-child(2)") as Button).click();
    });

    QUnit.test("Rich message dialog", async assert => {
        app.showMessageDialog({
            message: "Hello **Test**",
            title: "Test title",
            actions: ["Cancel", "Ok"],
            defaultAction: 1,
            rich: true
        });

        assert.equal((await waitFor(() => app.shadowRoot.querySelector("vi-message-dialog")?.shadowRoot.querySelector("vi-dialog-core > main > marked-element")?.shadowRoot.querySelector("#content"))).innerHTML, "<p>Hello <strong>Test</strong></p>\n");
        (app.shadowRoot.querySelector("vi-message-dialog").shadowRoot.querySelector("#actions > vi-button:nth-child(2)") as Button).click();
    });

    QUnit.test("Custom dialog", async assert => {
        (await waitFor(() => app.querySelector("vi-app-route.active > vi-dialog-test")?.shadowRoot?.querySelector("div > div:nth-child(1) > vi-button") as Button)).click();

        const dialogCore = await waitFor(() => <any>app.shadowRoot.querySelector("vi-my-dialog").shadowRoot.querySelector("vi-dialog-core") as IronOverlayBehavior);
        assert.ok(dialogCore.opened, "Dialog is opened");

        assert.equal(app.shadowRoot.querySelector("vi-my-dialog").shadowRoot.querySelector("vi-dialog-core > main > div").innerHTML, "Some content", "Dialog is showing content");

        (app.shadowRoot.querySelector("vi-my-dialog").shadowRoot.querySelector("vi-dialog-core > footer > vi-button") as Button).click();
    });

    QUnit.test("Wizard dialog", async assert => {
        (await waitFor(() => app.querySelector("vi-app-route.active > vi-dialog-test").shadowRoot.querySelector("div > div:nth-child(2) > vi-button") as Button)).click();
        await waitFor(() => app.shadowRoot.querySelector("vi-persistent-object-wizard-dialog")?.shadowRoot.querySelector("vi-dialog-core > header > h4").innerHTML === "Step 1");

        const firstName = await waitFor(() => app
            .shadowRoot.querySelector("vi-persistent-object-wizard-dialog")
            .shadowRoot.querySelector("vi-persistent-object-tab")
            .shadowRoot.querySelector("vi-persistent-object-group")
            .shadowRoot.querySelector("vi-persistent-object-attribute-string")
            .shadowRoot.querySelector("input[type=text]") as HTMLInputElement);

        firstName.value = "Bruce";

        (app.shadowRoot.querySelector("vi-persistent-object-wizard-dialog").shadowRoot.querySelector("vi-dialog-core > footer > div:nth-child(2) > vi-button:nth-child(1)") as Button).click();
        await waitFor(() => app.shadowRoot.querySelector("vi-persistent-object-wizard-dialog").shadowRoot.querySelector("vi-dialog-core > header > h4").innerHTML === "Step 2");

        const lastName = await waitFor(() => app
            .shadowRoot.querySelector("vi-persistent-object-wizard-dialog")
            .shadowRoot.querySelector("vi-persistent-object-tab")
            .shadowRoot.querySelector("vi-persistent-object-group")
            .shadowRoot.querySelector("vi-persistent-object-attribute-string")
            .shadowRoot.querySelector("input[type=text]") as HTMLInputElement);
        
        assert.notEqual(firstName, lastName);
        lastName.value = "Willis";

        (app.shadowRoot.querySelector("vi-persistent-object-wizard-dialog").shadowRoot.querySelector("vi-dialog-core > footer > div:nth-child(2) > vi-button:nth-child(2)") as Button).click();
    });
});