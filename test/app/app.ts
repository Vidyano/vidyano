import { init } from "../helpers.js"

QUnit.module("App tests", hooks => {
    QUnit.test("Default", async assert => {
        const app = await init("components/dialog", "app/app.html");

        const label = app.shadowRoot.querySelector("vi-menu").shadowRoot.querySelector("header > div.label") as HTMLElement;
        assert.equal(getComputedStyle(label).backgroundColor, "rgb(35, 104, 142)", "Theme color computed and applied corretly");
        assert.equal(label.innerText, "App tests", "Label property is visible in menu");
    });
});