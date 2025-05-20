import { AppRoute } from "../web-components/app-route/app-route";
import { init, waitForQueryPresenter, querySelectorDeep } from "./helpers.js"

QUnit.module("Routing tests", hooks => {
    QUnit.test("Automatically open first program unit", async assert => {
        await init();

        const activeRoute = await querySelectorDeep("vi-app", "vi-app-route-presenter vi-app-route.active") as AppRoute;
        assert.equal(activeRoute.route, ":programUnitName/query.:id");
    });

    QUnit.test("Go to other route", async assert => {
        const app = await init();
        app.changePath("home/employees");

        assert.equal((await waitForQueryPresenter("Employees"))?.query?.name, "Employees");
    });
});