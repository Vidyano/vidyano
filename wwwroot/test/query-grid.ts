import { QueryGrid } from "../web-components/query-grid/query-grid";
import { init, waitFor, waitForQuery } from "./helpers.js"

QUnit.module("QueryGrid tests", hooks => {
    QUnit.test("AutoQuery false", async assert => {
        await init("home/employees");

        const queryPresenter = await waitForQuery("Employees");
        const queryGrid = await waitFor(() => {
            return queryPresenter.querySelector("vi-query").shadowRoot.querySelector("vi-query-items-presenter > vi-query-grid") as QueryGrid;
        });

        const innerGrid = queryGrid.shadowRoot.querySelector("#grid");
        assert.equal(innerGrid.querySelectorAll("vi-query-grid-row:not(.hidden)").length, 0, "No rows visible");

        assert.equal(queryGrid.shadowRoot.querySelector("header > div:nth-child(2) > div > vi-query-grid-column-header:nth-child(8)").clientWidth, 84, "Header has minimal width");

        await queryGrid.query.search();
        await waitFor(async () => {
            if (innerGrid.querySelectorAll("vi-query-grid-row:not(.hidden)").length === 0)
                return;
                
            assert.ok(true, "Rows are visible after searching");
            return true;
        });

        assert.ok(queryGrid.shadowRoot.querySelector("header > div:nth-child(2) > div > vi-query-grid-column-header:nth-child(8)").clientWidth >  100, "Header has new width");
    });
});