import { Button } from "../../web-components/button/button";
import { Popup } from "../../web-components/popup/popup";
import { QueryGrid } from "../../web-components/query-grid/query-grid";
import { QueryGridColumnFilter } from "../../web-components/query-grid/query-grid-column-filter";
import { init, waitFor as until, waitForQueryQrid, waitForQueryPresenter } from "../helpers.js"

QUnit.module("QueryGrid tests", hooks => {
    QUnit.test("AutoQuery false", async assert => {
        await init("home/employees");

        const queryPresenter = await waitForQueryPresenter("Employees");
        const queryGrid = await until(() => {
            return queryPresenter.querySelector("vi-query").shadowRoot.querySelector("vi-query-items-presenter > vi-query-grid") as QueryGrid;
        });

        const innerGrid = queryGrid.shadowRoot.querySelector("#grid");
        assert.equal(innerGrid.querySelectorAll("vi-query-grid-row:not(.hidden)").length, 0, "No rows visible");

        assert.equal(queryGrid.shadowRoot.querySelector("header > div:nth-child(2) > div > vi-query-grid-column-header:nth-child(8)").clientWidth, 84, "Header has minimal width");

        await queryGrid.query.search();
        await until(async () => {
            if (innerGrid.querySelectorAll("vi-query-grid-row:not(.hidden)").length === 0)
                return;
                
            assert.ok(true, "Rows are visible after searching");
            return true;
        });

        assert.ok(queryGrid.shadowRoot.querySelector("header > div:nth-child(2) > div > vi-query-grid-column-header:nth-child(8)").clientWidth >  100, "Header has new width");
    });

    QUnit.test("Distincts", async assert => {
        await init("home/companies");

        const queryGrid = await waitForQueryQrid("Companies");
        const queryItems = queryGrid.query.totalItems;

        const queryGridColumnFilter = queryGrid.shadowRoot.querySelector("vi-query-grid-column-header:first-of-type").shadowRoot.querySelector("vi-query-grid-column-filter") as QueryGridColumnFilter;
        
        (queryGridColumnFilter.shadowRoot.querySelector("vi-button#preRender") as Button).click();

        const filterPopup = (queryGridColumnFilter.shadowRoot.querySelector("#filter") as Popup);
        await until(() => filterPopup.open);
        assert.ok(true, "Filter open");

        const firstDistinct = await until(() => queryGridColumnFilter.shadowRoot.querySelector("#distincts > div:first-of-type")) as HTMLDivElement;
        const firstDistinctValue = firstDistinct.querySelector("span").innerText;

        firstDistinct.querySelector("span").click();

        await until(() => queryGridColumnFilter.shadowRoot.querySelector("#filter #label")?.innerHTML === `= ${firstDistinctValue}`);
        assert.ok(true, "Selected distinct visible on query filter");
        
        const firstRowFirstCell = await until(() => queryGrid.shadowRoot.querySelector("vi-query-grid-row:first-of-type > vi-query-grid-cell-default:first-of-type"));
        await until(() => Array.from(firstRowFirstCell.shadowRoot.childNodes).find(child => child.nodeType === Node.TEXT_NODE)?.textContent === firstDistinctValue);
        assert.ok(true, "Selected distinct visible on query results");

        await until(() => queryGrid.query.totalItems > 0);
        const queryItemsWithDistinct = queryGrid.query.totalItems;

        (queryGridColumnFilter.shadowRoot.querySelector("#inverse") as HTMLDivElement).click();

        await until(() => queryGridColumnFilter.shadowRoot.querySelector("#filter #label")?.innerHTML === `≠ ${firstDistinctValue}`);
        assert.ok(true, "Selected inverse distinct visible on query filter");

        await until(() => queryGrid.query.totalItems + queryItemsWithDistinct === queryItems);
        assert.ok(true, "Selected inverse distincts visible on query results");

        queryGrid.dispatchEvent(new MouseEvent("mousedown", {
            bubbles: true,
            composed: true
        }));

        await until(() => !filterPopup.open);
        assert.ok(true, "Filter popup closed");
    });
});