import { expect, Locator, Page } from '@playwright/test';
import { getScrollOffset, gridPage, GridPageOptions, mountGrid, openView, pageErrors, pauseClock, scrollGrid, test, VIEWS, waitForGridReady, waitForQueryIdle } from '../_helpers/query-grid';
import { scrollerBox } from '../_helpers/grid';
import { allDistinctRows, settledRows, settledTexts, clearItem, clickDistinct, columnFilter, distinctItem, distinctRows, distinctTexts, filterButton, filterLabel, filterLog, filtersControl, inverseButton, listBox, openFilter, REMAINING, resizeHandleBox, searchInput, setSelectedDistincts, totalItems, columnState } from '../_helpers/filters';

const PEOPLE_COLUMNS = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];
const FIRST_EMAIL = 'Aaron_Lemmens59@skynet.be';

/** The console error of a response a test fails with status 500 on purpose. */
const SERVER_ERROR = /^Failed to load resource: the server responded with a status of 500/;

async function setup(page: Page, options?: GridPageOptions) {
    await gridPage(page, options);
    return mountGrid(page);
}

/** Resolves a CSS color custom property of the grid to its computed rgb() form. */
async function resolvedColor(grid: Locator, variable: string) {
    return grid.evaluate((g: Element, variable) => {
        const probe = document.createElement('div');
        probe.style.color = `var(${variable})`;
        g.shadowRoot!.appendChild(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
    }, variable);
}

function visibleFilterIcons(cf: Locator) {
    return cf.locator('vi-icon[source="Filter"]').filter({ visible: true });
}

/** Per visible value row: whether the label text or one of its ancestors up to the row has a blur() filter. */
function blurs(cf: Locator) {
    return cf.evaluate((host: Element) => {
        const deep = (root: ParentNode, out: Element[] = []): Element[] => {
            for (const el of root.querySelectorAll('*')) {
                out.push(el);
                if (el.shadowRoot)
                    deep(el.shadowRoot, out);
            }

            return out;
        };

        return deep(host.shadowRoot!).filter(el => el.classList.contains('item') && el.checkVisibility()).map(item => {
            const label = item.querySelector('span[distinct-type]')!;
            for (let el: Element | null = label; el && el !== item.parentElement; el = el.parentElement) {
                if (getComputedStyle(el).filter.includes('blur'))
                    return true;
            }

            return false;
        });
    });
}

async function isOpen(cf: Locator) {
    return cf.locator('vi-popup[open]').count().then(c => c > 0);
}

test.describe('Button and label', () => {
    test('unfiltered column shows only the Filter icon', { annotation: [{ type: 'case', description: 'filters.cf-label-unfiltered' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = columnFilter(grid, 'Gender');

        await expect(cf).not.toHaveAttribute('filtered');
        await expect(cf.locator('vi-button').filter({ visible: true })).toHaveCount(1);
        // The button holds the '=' label (textContent) but doesn't render it (innerText)
        await expect(filterButton(cf)).toHaveText('=');
        expect(await filterLabel(cf)).toBe('');
        await expect(visibleFilterIcons(cf)).toHaveCount(1);
    });

    test("label shows '= Female' after selecting Female", { annotation: [{ type: 'case', description: 'filters.cf-label-include-single' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');

        await expect(cf).toHaveAttribute('filtered');
        await expect.poll(() => filterLabel(cf)).toBe('= Female');
        await expect(visibleFilterIcons(cf)).toHaveCount(0);
    });

    test("multiple values join with ', ' in selection order", { annotation: [{ type: 'case', description: 'filters.cf-label-multi-order' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Male');
        await clickDistinct(cf, 'Female');

        await expect.poll(() => filterLabel(cf)).toBe('= Male, Female');
    });

    test('length-prefixed values show only their display part', { annotation: [{ type: 'case', description: 'filters.cf-label-length-prefixed' }] }, async ({ page }) => {
        const grid = await setup(page);
        const birthDate = await grid.evaluate(async (g: any) => {
            const column = g.query.getColumn('BirthDate');
            const distincts = await column.refreshDistincts();
            return distincts.matching[0] as string;
        });
        expect(birthDate).toMatch(/^27\|28-04-1945 .*28\/04\/1945$/);

        await setSelectedDistincts(grid, 'IsActive', ['4|TrueYes']);
        await setSelectedDistincts(grid, 'EmergencyContact', ['4|7120Aaron Decock']);
        await setSelectedDistincts(grid, 'BirthDate', [birthDate]);

        await expect.poll(() => filterLabel(columnFilter(grid, 'IsActive'))).toBe('= Yes');
        await expect.poll(() => filterLabel(columnFilter(grid, 'EmergencyContact'))).toBe('= Aaron Decock');
        await expect.poll(() => filterLabel(columnFilter(grid, 'BirthDate'))).toBe('= 28/04/1945');
    });

    test('all filters get [query-filtering] and a faint background while any column is filtered', { annotation: [{ type: 'case', description: 'filters.cf-host-query-filtering' }] }, async ({ page }) => {
        const grid = await setup(page);
        const faint = await grid.evaluate((g: Element) => {
            const probe = document.createElement('div');
            probe.style.backgroundColor = 'var(--color-faint)';
            g.shadowRoot!.appendChild(probe);
            const color = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return color;
        });
        expect(faint).not.toBe('rgba(0, 0, 0, 0)');

        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');

        for (const name of PEOPLE_COLUMNS) {
            const host = columnFilter(grid, name);
            await expect(host).toHaveAttribute('query-filtering');
            await expect(host).toHaveCSS('background-color', faint);
        }

        await clearItem(cf).click();
        await waitForQueryIdle(grid);

        for (const name of PEOPLE_COLUMNS) {
            const host = columnFilter(grid, name);
            await expect(host).not.toHaveAttribute('query-filtering');
            await expect(host).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        }
    });

    test('label follows model changes before and after the first render', { annotation: [{ type: 'case', description: 'filters.cf-label-programmatic' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = columnFilter(grid, 'Gender');

        const check = async () => {
            await setSelectedDistincts(grid, 'Gender', ['|Male']);
            await expect.poll(() => filterLabel(cf)).toBe('= Male');
            await expect(cf).toHaveAttribute('filtered');

            await setSelectedDistincts(grid, 'Gender', ['|Male'], true);
            await expect.poll(() => filterLabel(cf)).toBe('≠ Male');

            await setSelectedDistincts(grid, 'Gender', [], false);
            await expect.poll(() => filterLabel(cf)).toBe('');
            await expect(cf).not.toHaveAttribute('filtered');
            await expect(visibleFilterIcons(cf)).toHaveCount(1);
        };

        // Before the first click (popup not rendered yet)
        await check();

        await openFilter(grid, 'Gender');
        await filterButton(cf).click();
        await expect(clearItem(cf)).toBeHidden();

        // After the popup was opened and closed
        await check();
    });

    test('label follows the column it is given, not the one it had before', { annotation: [{ type: 'case', description: 'filters.cf-label-column-swap' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = columnFilter(grid, 'Gender');

        await cf.evaluate((host: any) => {
            const lastName = host.getRootNode().host.getRootNode().querySelector('vi-query-grid-column-header[name="LastName"]');
            host.column = lastName.column;
        });

        await setSelectedDistincts(grid, 'LastName', ['|Claes']);
        await expect.poll(() => filterLabel(cf)).toBe('= Claes');
        await expect(cf).toHaveAttribute('filtered');

        await setSelectedDistincts(grid, 'Gender', ['|Male'], true);
        await setSelectedDistincts(grid, 'LastName', ['|Claes', '|Claeys']);
        await expect.poll(() => filterLabel(cf)).toBe('= Claes, Claeys');
    });

    test('label catches up with a selection made while disconnected', { annotation: [{ type: 'case', description: 'filters.cf-label-reconnect' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = columnFilter(grid, 'Gender');

        await cf.evaluate(async (host: any) => {
            const parent = host.parentNode;
            const next = host.nextSibling;
            host.remove();

            host.column.column.selectedDistincts = ['|Female'];
            await new Promise(r => setTimeout(r, 50));

            parent.insertBefore(host, next);
        });

        await expect.poll(() => filterLabel(cf)).toBe('= Female');
        await expect(cf).toHaveAttribute('filtered');
    });
});

test.describe('Popup', () => {
    test('first click renders and opens the popup in one click', { annotation: [{ type: 'case', description: 'filters.cf-lazy-first-click-opens' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = columnFilter(grid, 'Gender');
        await filterButton(cf).click();

        await expect(page.getByText('Clear filter from Gender')).toBeVisible();
        await expect(searchInput(cf)).toBeVisible();
        await expect(cf.locator('vi-popup[open]')).toHaveCount(1);
    });

    test('filter button toggles the popup closed and open', { annotation: [{ type: 'case', description: 'filters.cf-toggle-button' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');

        await filterButton(cf).click();
        await expect(page.getByText('Clear filter from Gender')).toBeHidden();
        await expect(cf.locator('vi-popup[open]')).toHaveCount(0);

        await filterButton(cf).click();
        await expect(page.getByText('Clear filter from Gender')).toBeVisible();
        await expect(cf.locator('vi-popup[open]')).toHaveCount(1);
    });

    test('opening by mouse focuses the search box', { annotation: [{ type: 'case', description: 'filters.cf-focus-search-on-open' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');
        await expect(searchInput(cf)).toBeFocused();

        await page.keyboard.type('cl');
        await expect(searchInput(cf)).toHaveValue('cl');
        await expect.poll(() => distinctTexts(cf)).toEqual(['Claes', 'Claeys', 'Declerck', 'Declercq']);
    });

    test('clicking outside closes the popup', { annotation: [{ type: 'case', description: 'filters.cf-popup-click-outside' }] }, async ({ page }) => {
        // Wide enough that the header has empty space after the last column
        await gridPage(page, { width: 1920 });
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Gender');

        // The empty header space to the right of the last column header
        const box = (await grid.boundingBox())!;
        const last = (await grid.locator('vi-query-grid-column-header[name="IsActive"]').boundingBox())!;
        const x = last.x + last.width + 20;
        expect(x).toBeLessThan(box.x + box.width - 20);
        await page.mouse.click(x, last.y + last.height / 4);
        await expect(clearItem(cf)).toBeHidden();
    });
});

test.describe('Distinct loading', () => {
    test('distincts load once, on first open only', { annotation: [{ type: 'case', description: 'filters.cf-distincts-first-open-request' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        await log.quiet();
        expect(log.refreshes()).toHaveLength(0);

        const cf = await openFilter(grid, 'Gender');
        await log.quiet();
        const refreshes = log.refreshes();
        expect(refreshes).toHaveLength(1);
        expect(refreshes[0].body.parameters.ColumnName).toBe('Gender');
        expect(refreshes[0].body.parameters.Search).toBeUndefined();
        await expect.poll(async () => (await distinctRows(cf)).length).toBe(3);
    });

    test('spinner and [loading] while distincts load', { annotation: [{ type: 'case', description: 'filters.cf-distincts-spinner' }] }, async ({ page }) => {
        const grid = await setup(page);
        let release: () => void;
        const held = new Promise<void>(resolve => release = resolve);
        await page.route('**/ExecuteAction', async route => {
            if (route.request().postData()?.includes('QueryFilter.RefreshColumn'))
                await held;

            await route.continue();
        });

        const cf = columnFilter(grid, 'Gender');
        await filterButton(cf).click();

        await expect(cf.locator('vi-spinner')).toBeVisible();
        await expect(cf).toHaveAttribute('loading');
        await expect(cf.locator('vi-list')).toHaveCSS('opacity', '0.5');
        await expect(cf.locator('.item')).toHaveCount(0);

        // The response is held until here, so the loading state above is the in-flight state
        release!();

        await expect(cf).not.toHaveAttribute('loading');
        await expect(cf.locator('vi-spinner')).toBeHidden();
        await expect(cf.locator('vi-list')).toHaveCSS('opacity', '1');
        await expect.poll(() => distinctTexts(cf)).toEqual(['Female', 'Male', 'Unknown']);
    });

    test("another column's selection reloads distincts on reopen", { annotation: [{ type: 'case', description: 'filters.cf-distincts-dirty-other-selection' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);

        const gender = await openFilter(grid, 'Gender');
        await filterButton(gender).click();
        await expect(clearItem(gender)).toBeHidden();
        await log.quiet();
        expect(log.refreshes('Gender')).toHaveLength(1);

        const email = await openFilter(grid, 'Email');
        await clickDistinct(email, FIRST_EMAIL);
        await waitForQueryIdle(grid);
        await log.quiet();

        await openFilter(grid, 'Gender');
        await log.quiet();
        expect(log.refreshes('Gender')).toHaveLength(2);

        await expect.poll(() => distinctTexts(gender)).toEqual(['Male', 'Female', 'Unknown']);
        const rows = await settledRows(gender);
        expect(rows.map(r => r.text)).toEqual(['Male', 'Female', 'Unknown']);
        expect(rows[0].color).not.toBe(REMAINING);
        expect(rows[1].color).toBe(REMAINING);
        expect(rows[2].color).toBe(REMAINING);
    });
});

test.describe('Distinct list', () => {
    test('Gender lists Female, Male and Unknown unchecked', { annotation: [{ type: 'case', description: 'filters.cf-list-gender' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');

        const rows = await settledRows(cf);
        expect(rows.map(r => r.text)).toEqual(['Female', 'Male', 'Unknown']);
        for (const row of rows) {
            expect(row.checked).toBe(false);
            expect(row.color).not.toBe(REMAINING);
            expect(row.hasMore).toBe(false);
        }

        await expect(cf.locator('vi-icon[source="Ellipsis"]').filter({ visible: true })).toHaveCount(0);
    });

    test('rows show display text for boolean, reference and date values', { annotation: [{ type: 'case', description: 'filters.cf-list-isactive-display' }] }, async ({ page }) => {
        const grid = await setup(page);

        const isActive = await openFilter(grid, 'IsActive');
        expect(await settledTexts(isActive)).toEqual(['No', 'Yes']);

        const emergency = await openFilter(grid, 'EmergencyContact');
        expect((await settledTexts(emergency))[0]).toBe('Aaron Decock');

        const birthDate = await openFilter(grid, 'BirthDate');
        expect((await settledTexts(birthDate))[0]).toBe('28/04/1945');
    });

    test('has-more columns end with an ellipsis row', { annotation: [{ type: 'case', description: 'filters.cf-list-hasmore-row' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Email');

        const rows = await allDistinctRows(cf);
        const last = rows[rows.length - 1];
        expect(last.hasMore).toBe(true);
        expect(last.text).toBe('');
        expect(last.opacity).toBe('0.25');
        expect(rows.slice(0, -1).every(r => !r.hasMore && r.type === 'matching')).toBe(true);
        expect(rows.length - 1).toBe(100);

        const hasMore = cf.locator('.hasMore').filter({ visible: true });
        await expect(hasMore.locator('vi-icon[source="Ellipsis"]')).toBeVisible();
        await expect(hasMore.locator('vi-checkbox')).toHaveCount(0);
    });

    test('selected values come first, checked, in selection order', { annotation: [{ type: 'case', description: 'filters.cf-list-selected-first' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');
        await clickDistinct(cf, 'Maes');
        await clickDistinct(cf, 'Claes');

        const rows = await allDistinctRows(cf);
        const texts = rows.map(r => r.text);
        expect(texts.slice(0, 2)).toEqual(['Maes', 'Claes']);
        expect(rows[0].checked && rows[1].checked).toBe(true);

        const rest = rows.slice(2);
        expect(rest.length).toBeGreaterThan(0);
        expect(rest.every(r => !r.checked)).toBe(true);
        expect(rest.map(r => r.text)).toEqual(rest.map(r => r.text).sort((a, b) => a.localeCompare(b)));
        expect(texts.filter(t => t === 'Maes')).toHaveLength(1);
        expect(texts.filter(t => t === 'Claes')).toHaveLength(1);
    });

    test('values outside the result set are grey (remaining)', { annotation: [{ type: 'case', description: 'filters.cf-list-matching-remaining' }] }, async ({ page }) => {
        const grid = await setup(page);
        const email = await openFilter(grid, 'Email');
        await clickDistinct(email, FIRST_EMAIL);
        await waitForQueryIdle(grid);

        const cf = await openFilter(grid, 'LastName');
        const rows = await allDistinctRows(cf);
        expect(rows[0].text).toBe('Lemmens');
        expect(rows[0].color).not.toBe(REMAINING);
        // The People data has 32 distinct last names, so 31 others are remaining
        expect(rows.slice(1)).toHaveLength(31);
        expect(rows.slice(1).every(r => r.color === REMAINING && r.type === 'remaining')).toBe(true);
    });

    test('distinct list scrolls with the mouse wheel', { annotation: [{ type: 'case', description: 'filters.cf-list-wheel-scroll' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');

        const inside = async (text: string) => {
            const box = (await listBox(cf))!;
            const row = (await distinctRows(cf)).find(r => r.text === text);
            return !!row && row.top >= box.y - 1 && row.bottom <= box.y + box.height + 1;
        };

        await expect.poll(() => inside('Claes')).toBe(true);
        expect(await inside('Wouters')).toBe(false);

        const box = (await listBox(cf))!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
        await page.mouse.wheel(0, 2000);

        await expect.poll(() => inside('Wouters')).toBe(true);
        expect(await isOpen(cf)).toBe(true);
        await expect(clearItem(cf)).toBeVisible();
    });
});

test.describe('Selection', () => {
    test('clicking a value selects it and filters the grid', { annotation: [{ type: 'case', description: 'filters.cf-select-click-adds' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');

        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual(['|Female']);
        const rows = await settledRows(cf);
        expect(rows[0]).toMatchObject({ text: 'Female', checked: true });
        expect(await totalItems(grid)).toBe(4587);
        await expect(clearItem(cf)).toBeVisible();
    });

    test('values in the same column are ORed', { annotation: [{ type: 'case', description: 'filters.cf-select-multi-or' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');
        await clickDistinct(cf, 'Male');

        expect(await totalItems(grid)).toBe(9093);
        const rows = await settledRows(cf);
        expect(rows.filter(r => r.checked).map(r => r.text)).toEqual(['Female', 'Male']);
    });

    test('clicking a selected value deselects it', { annotation: [{ type: 'case', description: 'filters.cf-select-click-removes' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');
        await clickDistinct(cf, 'Male');

        await clickDistinct(cf, 'Female');
        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual(['|Male']);
        await expect.poll(() => filterLabel(cf)).toBe('= Male');
        expect(await totalItems(grid)).toBe(4506);

        await clickDistinct(cf, 'Male');
        await expect.poll(() => filterLabel(cf)).toBe('');
        await expect(cf).not.toHaveAttribute('filtered');
        await expect(visibleFilterIcons(cf)).toHaveCount(1);
        expect(await totalItems(grid)).toBe(10000);
    });

    test('first selection creates an unsaved current filter', { annotation: [{ type: 'case', description: 'filters.cf-select-creates-current-filter' }] }, async ({ page }) => {
        const grid = await setup(page);
        await expect(filtersControl(grid)).toHaveAttribute('disabled');
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter)).toBeFalsy();

        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');

        await expect.poll(() => grid.evaluate((g: any) => g.query.filters.currentFilter?.persistentObject?.isNew ?? null)).toBe(true);
        await expect(filtersControl(grid)).not.toHaveAttribute('disabled');
    });
});

test.describe('Include/exclude', () => {
    test('inverse with a selection switches to exclude and re-queries', { annotation: [{ type: 'case', description: 'filters.cf-inverse-with-selection' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');
        await waitForQueryIdle(grid);
        await log.quiet();
        log.clear();

        await inverseButton(cf).click();
        await expect(cf).not.toHaveAttribute('loading');

        expect((await columnState(grid, 'Gender')).inversed).toBe(true);
        await expect(inverseButton(cf)).toHaveAttribute('inversed');
        await expect(inverseButton(cf)).toHaveCSS('fill', 'rgb(139, 0, 0)');
        await expect.poll(() => filterLabel(cf)).toBe('≠ Female');
        expect(await totalItems(grid)).toBe(5413);

        await log.quiet();
        expect(log.queries()).toHaveLength(1);
        expect(log.refreshes()).toHaveLength(1);
    });

    test('inverse again restores include mode', { annotation: [{ type: 'case', description: 'filters.cf-inverse-toggle-back' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');
        await inverseButton(cf).click();
        await expect.poll(() => filterLabel(cf)).toBe('≠ Female');
        await expect(cf).not.toHaveAttribute('loading');

        await inverseButton(cf).click();
        await expect(cf).not.toHaveAttribute('loading');

        await expect.poll(() => filterLabel(cf)).toBe('= Female');
        expect(await totalItems(grid)).toBe(4587);
        await expect(inverseButton(cf)).not.toHaveAttribute('inversed');
        await expect(inverseButton(cf)).toHaveCSS('fill', 'rgb(170, 170, 170)');
    });
});

test.describe('Clear filter', () => {
    test('clear item names the column and is dimmed while unfiltered', { annotation: [{ type: 'case', description: 'filters.cf-clear-item' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'BirthDate');

        await expect(clearItem(cf)).toHaveText('Clear filter from Birth date');
        await expect(clearItem(cf)).toHaveAttribute('disabled');
        await expect(clearItem(cf)).toHaveCSS('opacity', '0.25');
    });

    test('clear removes the selection, re-queries and closes', { annotation: [{ type: 'case', description: 'filters.cf-clear-enabled' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');
        await clickDistinct(cf, 'Male');
        await waitForQueryIdle(grid);
        await log.quiet();
        log.clear();

        await expect(clearItem(cf)).not.toHaveAttribute('disabled');
        await clearItem(cf).click();

        await expect(clearItem(cf)).toBeHidden();
        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual([]);
        await expect.poll(() => filterLabel(cf)).toBe('');
        await expect(visibleFilterIcons(cf)).toHaveCount(1);
        expect(await totalItems(grid)).toBe(10000);

        await log.quiet();
        expect(log.queries()).toHaveLength(1);
        expect(log.refreshes()).toHaveLength(1);
    });
});

test.describe('Search', () => {
    test('typing filters loaded values locally without has-more', { annotation: [{ type: 'case', description: 'filters.cf-search-client-filter' }] }, async ({ page }) => {
        await page.clock.install();
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'LastName');
        await log.quiet();
        await pauseClock(page);
        log.clear();

        await cf.evaluate((host: any) => {
            (window as any).__cfLoading = false;
            new MutationObserver(() => {
                if (host.hasAttribute('loading'))
                    (window as any).__cfLoading = true;
            }).observe(host, { attributes: true });
        });

        await searchInput(cf).pressSequentially('cl');
        // Well past the 250ms server search debounce, to prove that no request follows
        await page.clock.runFor(1000);
        await expect.poll(() => distinctTexts(cf)).toEqual(['Claes', 'Claeys', 'Declerck', 'Declercq']);
        await log.quiet();
        expect(log.refreshes()).toHaveLength(0);
        expect(await page.evaluate(() => (window as any).__cfLoading)).toBe(false);
        await expect(cf.locator('vi-spinner')).toBeHidden();
    });

    test('matches are highlighted with their original casing', { annotation: [{ type: 'case', description: 'filters.cf-search-highlight' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');
        await searchInput(cf).pressSequentially('cl');
        await expect.poll(() => distinctTexts(cf)).toEqual(['Claes', 'Claeys', 'Declerck', 'Declercq']);

        const matches = await cf.locator('.item').filter({ visible: true }).evaluateAll(items => items
            .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
            .map(item => [...item.querySelectorAll('.match')].map(m => m.textContent)));
        expect(matches).toEqual([['Cl'], ['Cl'], ['cl'], ['cl']]);

        const color = await resolvedColor(grid, '--color');
        const match = cf.locator('.item .match').filter({ visible: true }).first();
        await expect(match).toHaveCSS('font-weight', '600');
        await expect(match).toHaveCSS('color', color);
    });
});

/** Opens the Email filter (more distincts than listed) on a page clock that is installed before the grid creates its timers. */
async function openEmailFilter(page: Page) {
    await page.clock.install();
    await gridPage(page);
    const log = filterLog(page);
    const grid = await mountGrid(page);
    const cf = await openFilter(grid, 'Email');
    await log.quiet();
    expect(await grid.evaluate((g: any) => !!g.query.getColumn('Email').distincts.hasMore), 'Email has more distincts than listed').toBe(true);

    await pauseClock(page);
    log.clear();
    return { log, cf };
}

/** Presses each key `gap` ms of page time after the previous one. */
async function typeKeys(page: Page, cf: Locator, keys: string, gap: number) {
    for (const [i, key] of [...keys].entries()) {
        if (i > 0)
            await page.clock.runFor(gap);

        await searchInput(cf).press(key);
    }
}

const searches = (log: ReturnType<typeof filterLog>) => log.refreshes('Email').map(r => r.body.parameters.Search);

test.describe('Server search', () => {
    test('typing on a has-more column runs a debounced server search', { annotation: [{ type: 'case', description: 'filters.cf-search-server-request' }] }, async ({ page }) => {
        const { log, cf } = await openEmailFilter(page);

        // The keys span longer than the debounce, so only a debounce that restarts on every key waits for the last one
        await typeKeys(page, cf, 'aaron', 100);
        await expect(cf).toHaveAttribute('loading');

        await page.clock.runFor(249);
        await log.quiet();
        expect(searches(log), 'no search within 250ms of the last key').toEqual([]);

        await page.clock.runFor(1);
        await expect.poll(() => searches(log)).toEqual(['aaron']);

        await page.clock.resume();
        await expect(cf).not.toHaveAttribute('loading', { timeout: 10000 });
        await log.quiet();
        expect(searches(log)).toEqual(['aaron']);

        const rows = (await allDistinctRows(cf)).filter(r => !r.hasMore);
        expect(rows.every(r => r.text.toLowerCase().includes('aaron'))).toBe(true);
        expect(rows.filter(r => r.color !== REMAINING)).toHaveLength(57);
        await expect(cf.locator('vi-spinner')).toBeHidden();
    });

    test('a pause longer than the debounce runs a server search per burst', { annotation: [{ type: 'case', description: 'filters.cf-search-server-request-per-burst' }] }, async ({ page }) => {
        const { log, cf } = await openEmailFilter(page);

        await typeKeys(page, cf, 'aa', 35);
        await page.clock.runFor(250);
        await expect.poll(() => searches(log)).toEqual(['aa']);
        await log.quiet();

        await page.clock.runFor(150);
        await typeKeys(page, cf, 'ron', 35);
        await page.clock.runFor(249);
        await log.quiet();
        expect(searches(log), 'no second search within 250ms of the last key').toEqual(['aa']);

        await page.clock.runFor(1);
        await expect.poll(() => searches(log)).toEqual(['aa', 'aaron']);

        await page.clock.resume();
        await expect(cf).not.toHaveAttribute('loading', { timeout: 10000 });
        await log.quiet();
        expect(searches(log)).toEqual(['aa', 'aaron']);

        const rows = (await allDistinctRows(cf)).filter(r => !r.hasMore);
        expect(rows.every(r => r.text.toLowerCase().includes('aaron'))).toBe(true);
    });
});

test.describe('Text filter (Enter)', () => {
    test('Enter adds a text-search filter', { annotation: [{ type: 'case', description: 'filters.cf-search-enter-adds-text-filter' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'LastName');
        await log.quiet();
        log.clear();

        await searchInput(cf).pressSequentially('Cl');
        await searchInput(cf).press('Enter');
        await expect(cf).not.toHaveAttribute('loading');
        await waitForQueryIdle(grid);

        expect((await columnState(grid, 'LastName')).selectedDistincts).toContain('1|@Cl');
        await expect(searchInput(cf)).toHaveValue('');
        await expect.poll(() => filterLabel(cf)).toBe('= Cl');

        const lastNames = await grid.evaluate((g: any) => {
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                return { total: q.totalItems, names: q.items.filter((i: any) => !!i).map((i: any) => i.getValue('LastName') as string) };
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        });
        expect(lastNames.total).toBeGreaterThan(0);
        expect(lastNames.names.length).toBeGreaterThan(0);
        expect(lastNames.names.every(n => n.startsWith('Cl'))).toBe(true);

        const rows = await settledRows(cf);
        expect(rows[0]).toMatchObject({ text: 'Cl', checked: true });

        // One search plus the distinct refresh, no second identical search
        await log.quiet();
        expect(log.queries()).toHaveLength(1);
        expect(log.refreshes('LastName')).toHaveLength(1);
    });

    test('Enter on a has-more column refreshes the values once', { annotation: [{ type: 'case', description: 'filters.cf-search-enter-hasmore-single-refresh' }] }, async ({ page }) => {
        await page.clock.install();
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'FirstName');
        await searchInput(cf).fill('an');
        await expect(cf).not.toHaveAttribute('loading', { timeout: 10000 });
        await log.quiet();
        log.clear();

        await searchInput(cf).press('Enter');
        await expect(cf).not.toHaveAttribute('loading', { timeout: 10000 });
        await waitForQueryIdle(grid);
        // Past the 250ms search debounce, so a queued refresh would have been sent
        await page.clock.runFor(1000);
        await log.quiet();

        expect((await columnState(grid, 'FirstName')).selectedDistincts).toEqual(['1|@an']);
        expect(log.queries()).toHaveLength(1);
        expect(log.refreshes('FirstName')).toHaveLength(1);
        expect(log.actions('Query.New')).toHaveLength(1);
    });
});

test.describe('Resize', () => {
    test('dragging the handle grows the popup', { annotation: [{ type: 'case', description: 'filters.cf-resize-grow' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        // The distinct list fills the popup content, so it grows by the same amount
        const content = cf.locator('vi-list');
        const before = (await content.boundingBox())!;
        const handle = (await resizeHandleBox(cf))!;
        expect(handle).not.toBeNull();

        const x = handle.x + handle.width / 2;
        const y = handle.y + handle.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 120, y + 80, { steps: 10 });
        await page.mouse.up();

        await expect.poll(async () => Math.round((await content.boundingBox())!.width - before.width)).toBeGreaterThan(100);
        const after = (await content.boundingBox())!;
        expect(Math.abs(after.width - before.width - 120)).toBeLessThanOrEqual(2);
        expect(Math.abs(after.height - before.height - 80)).toBeLessThanOrEqual(2);
        await expect(clearItem(cf)).toBeVisible();
    });
});

test.describe('Restricted columns and security', () => {
    test('distinct values render as text, also when highlighted', { annotation: [{ type: 'case', description: 'filters.cf-xss' }] }, async ({ page }) => {
        const grid = await setup(page);
        await grid.evaluate((g: any) => {
            g.query.getColumn('LastName').distincts = {
                matching: ['|<b>bold</b>', '|<img src=x onerror=window.__cfXss=1>'],
                remaining: [],
                isDirty: false,
                hasMore: false
            };
        });

        const cf = await openFilter(grid, 'LastName');
        const rows = await settledRows(cf);
        expect(rows.map(r => r.text)).toEqual(['<b>bold</b>', '<img src=x onerror=window.__cfXss=1>']);
        await expect(cf.locator('.item b')).toHaveCount(0);
        await expect(cf.locator('.item img')).toHaveCount(0);
        expect(await page.evaluate(() => (window as any).__cfXss)).toBeUndefined();

        await searchInput(cf).pressSequentially('b');
        await expect.poll(async () => (await distinctRows(cf)).map(r => r.text)).toEqual(['<b>bold</b>']);
        const elements = await cf.locator('.item').filter({ visible: true }).locator('span[distinct-type]').first().evaluate((span: Element) => [...span.querySelectorAll('*')].map(e => `${e.tagName.toLowerCase()}.${e.className}`));
        expect(elements.length).toBeGreaterThan(0);
        expect(elements.every(e => e === 'span.match')).toBe(true);
        expect(await page.evaluate(() => (window as any).__cfXss)).toBeUndefined();
    });

    test('canFilter=false column shows a disabled filter that never opens', { annotation: [{ type: 'case', description: 'filters.cf-disabled-column' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_ColumnOptions' });
        const cf = columnFilter(grid, 'PhoneNumber');

        await expect(cf).toHaveAttribute('disabled');
        await expect(cf).toHaveCSS('background-color', 'rgb(249, 249, 249)');
        await expect(cf).toHaveCSS('cursor', 'default');

        await filterButton(cf).click();
        await expect(clearItem(cf)).toBeHidden();
        await expect(cf.locator('vi-popup[open]')).toHaveCount(0);
        await log.quiet();
        expect(log.refreshes()).toHaveLength(0);

        // While another column filters the query, the disabled filter keeps its own background
        await setSelectedDistincts(grid, 'IsActive', ['4|TrueYes']);
        await grid.evaluate(async (g: any) => { await g.query.search(); });
        await expect(columnFilter(grid, 'FirstName')).toHaveAttribute('query-filtering');
        await expect(cf).toHaveCSS('background-color', 'rgb(249, 249, 249)');
    });

    test('canListDistincts=false opens without loading distincts', { annotation: [{ type: 'case', description: 'filters.cf-no-list-distincts' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_ColumnOptions' });

        const cf = await openFilter(grid, 'Email');
        await log.quiet();
        expect(log.refreshes()).toHaveLength(0);
        expect(await distinctRows(cf)).toEqual([]);

        await searchInput(cf).pressSequentially('Aaron');
        await searchInput(cf).press('Enter');
        await expect(cf).not.toHaveAttribute('loading');
        await waitForQueryIdle(grid);

        expect((await columnState(grid, 'Email')).selectedDistincts).toEqual(['1|@Aaron']);
        await expect.poll(() => filterLabel(cf)).toBe('= Aaron');
        const total = await totalItems(grid);
        expect(total).toBeGreaterThan(0);
        expect(total).toBeLessThan(10000);
    });

    test('sensitive column reflects [sensitive] on the filter', { annotation: [{ type: 'case', description: 'filters.cf-sensitive-attr' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_ColumnOptions' });

        await expect(columnFilter(grid, 'LastName')).toHaveAttribute('sensitive');
        for (const name of ['FirstName', 'BirthDate', 'ContactPreference', 'Email', 'PhoneNumber', 'IsActive'])
            await expect(columnFilter(grid, name)).not.toHaveAttribute('sensitive');
    });

    test('sensitive column distinct values are blurred in sensitive mode', { annotation: [{ type: 'case', description: 'filters.cf-sensitive-distincts-blurred' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_ColumnOptions' });

        await page.evaluate(() => (window as any).Vidyano.ServiceBus.send('vi-app:sensitive-changed', true));
        try {
            const lastName = await openFilter(grid, 'LastName');
            await settledRows(lastName);
            const sensitive = await blurs(lastName);
            expect(sensitive.length).toBeGreaterThan(0);
            expect(sensitive.every(b => b)).toBe(true);

            const firstName = await openFilter(grid, 'FirstName');
            await settledRows(firstName);
            expect((await blurs(firstName)).some(b => b)).toBe(false);
        }
        finally {
            await page.evaluate(() => (window as any).Vidyano.ServiceBus.send('vi-app:sensitive-changed', false));
        }
    });

    test('sensitive mode turned on after the filter was moved still blurs its values', { annotation: [{ type: 'case', description: 'filters.cf-sensitive-after-reconnect' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_ColumnOptions' });

        const lastName = await openFilter(grid, 'LastName');
        await settledRows(lastName);
        expect((await blurs(lastName)).some(b => b)).toBe(false);
        await page.keyboard.press('Escape');
        await expect(clearItem(lastName)).toBeHidden();

        await lastName.evaluate((host: Element) => {
            const parent = host.parentNode!;
            const next = host.nextSibling;
            host.remove();
            parent.insertBefore(host, next);
        });

        await page.evaluate(() => (window as any).Vidyano.ServiceBus.send('vi-app:sensitive-changed', true));
        try {
            await openFilter(grid, 'LastName');
            await settledRows(lastName);
            const sensitive = await blurs(lastName);
            expect(sensitive.length).toBeGreaterThan(0);
            expect(sensitive.every(b => b)).toBe(true);
        }
        finally {
            await page.evaluate(() => (window as any).Vidyano.ServiceBus.send('vi-app:sensitive-changed', false));
        }
    });

    test('filter label renders HTML-like values as text', { annotation: [{ type: 'case', description: 'filters.cf-label-html-as-text' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = columnFilter(grid, 'LastName');
        await setSelectedDistincts(grid, 'LastName', ['|<b>x</b>']);

        await expect.poll(() => filterLabel(cf)).toBe('= <b>x</b>');
        expect(await filterButton(cf).evaluate((b: Element) => b.querySelector('#label')?.textContent)).toBe('= <b>x</b>');
        await expect(filterButton(cf).locator('b')).toHaveCount(0);
    });
});

/** Records when the popup closes (performance.now()). */
async function trackPopupClose(cf: Locator) {
    await cf.locator('vi-popup').first().evaluate((popup: any) => {
        const w = window as any;
        w.__cfClosed = null;
        new MutationObserver(() => {
            if (!popup.hasAttribute('open') && w.__cfClosed == null)
                w.__cfClosed = performance.now();
        }).observe(popup, { attributes: true, attributeFilter: ['open'] });
    });
}

/** Moves the pointer into the open popup content, then out to the lower right of the grid body. */
async function hoverAndLeave(page: Page, grid: Locator, cf: Locator) {
    const content = (await cf.locator('#filterContent').boundingBox())!;
    await page.mouse.move(content.x + content.width / 2, content.y + content.height / 2, { steps: 5 });
    const view = await scrollerBox(grid);
    await page.mouse.move(view.x + view.width * 0.85, view.bottom - 40, { steps: 5 });
}

test.describe('Button and label (more)', () => {
    test('one filter button at the same position before and after the first render', { annotation: [{ type: 'case', description: 'filters.cf-lazy-single-button-no-shift' }] }, async ({ page, browser }) => {
        const check = async (p: Page, female: boolean) => {
            await gridPage(p);
            const grid = await mountGrid(p);
            if (female)
                await setSelectedDistincts(grid, 'Gender', ['|Female']);

            const cf = columnFilter(grid, 'Gender');
            await expect.poll(() => filterLabel(cf)).toBe(female ? '= Female' : '');
            await expect(cf.locator('vi-button').filter({ visible: true })).toHaveCount(1);
            const before = { text: await filterButton(cf).innerText(), box: (await filterButton(cf).boundingBox())! };

            await openFilter(grid, 'Gender');
            await p.keyboard.press('Escape');
            await expect(clearItem(cf)).toBeHidden();

            await expect(cf.locator('vi-button').filter({ visible: true })).toHaveCount(1);
            const after = { text: await filterButton(cf).innerText(), box: (await filterButton(cf).boundingBox())! };
            expect(after.text).toBe(before.text);
            for (const key of ['x', 'y', 'width', 'height'] as const)
                expect(Math.abs(after.box[key] - before.box[key]), key).toBeLessThanOrEqual(1);
        };

        await check(page, false);

        const other = await browser.newPage();
        try {
            await check(other, true);
        }
        finally {
            await other.close();
        }
    });

    test('null and empty values use the translated placeholders', { annotation: [{ type: 'case', description: 'filters.cf-label-null-empty' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = columnFilter(grid, 'LastName');

        await setSelectedDistincts(grid, 'LastName', [null as any]);
        await expect.poll(() => filterLabel(cf)).toBe('= < Nothing >');

        await setSelectedDistincts(grid, 'LastName', ['|']);
        await expect.poll(() => filterLabel(cf)).toBe('= < Empty >');

        await setSelectedDistincts(grid, 'LastName', ['']);
        await expect.poll(() => filterLabel(cf)).toBe('= < Empty >');
    });

    test('long label truncates on one line without growing the filter row', { annotation: [{ type: 'case', description: 'filters.cf-label-truncate' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = columnFilter(grid, 'LastName');
        const height = (await cf.boundingBox())!.height;

        await grid.evaluate(async (g: any) => {
            const column = g.query.getColumn('LastName');
            const distincts = await column.refreshDistincts();
            column.selectedDistincts = [...distincts.matching, ...distincts.remaining];
        });
        expect((await columnState(grid, 'LastName')).selectedDistincts).toHaveLength(32);
        await expect.poll(() => filterLabel(cf)).toMatch(/^= Claes, /);

        expect(Math.abs((await cf.boundingBox())!.height - height)).toBeLessThanOrEqual(0.5);
        const label = await filterButton(cf).evaluate((b: Element) => {
            const l = b.querySelector('#label') as HTMLElement;
            const style = getComputedStyle(l);
            return { whiteSpace: style.whiteSpace, textOverflow: style.textOverflow, scrollWidth: l.scrollWidth, clientWidth: l.clientWidth };
        });
        expect(label.whiteSpace).toBe('nowrap');
        expect(label.textOverflow).toBe('ellipsis');
        expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
    });
});

test.describe('Popup (more)', () => {
    test('Enter on the focused filter button opens the popup', { annotation: [{ type: 'case', description: 'filters.cf-keyboard-open' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = columnFilter(grid, 'Gender');

        await filterButton(cf).focus();
        await page.keyboard.press('Enter');

        await expect(clearItem(cf)).toBeVisible();
        await expect(searchInput(cf)).toBeFocused();
        const active = await page.evaluate(() => {
            let element = document.activeElement;
            while (element?.shadowRoot?.activeElement)
                element = element.shadowRoot.activeElement;

            return element?.tagName.toLowerCase();
        });
        expect(active).toBe('input');
    });

    test('Escape closes the popup', { annotation: [{ type: 'case', description: 'filters.cf-popup-escape' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await expect(searchInput(cf)).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(clearItem(cf)).toBeHidden();
        await expect(cf.locator('vi-popup[open]')).toHaveCount(0);
    });

    test('leaving the popup closes it after the default 750ms', { annotation: [{ type: 'case', description: 'filters.cf-popup-mouseleave-delay' }] }, async ({ page }) => {
        await page.clock.install();
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await trackPopupClose(cf);
        await pauseClock(page);

        await hoverAndLeave(page, grid, cf);
        await page.clock.runFor(749);
        expect(await page.evaluate(() => (window as any).__cfClosed), 'still open 749ms after leaving').toBeNull();
        await page.clock.runFor(1);
        expect(await page.evaluate(() => (window as any).__cfClosed), 'closed 750ms after leaving').not.toBeNull();
        await expect(clearItem(cf)).toBeHidden();

        // Coming back before the delay ends keeps it open
        await openFilter(grid, 'Gender');
        await trackPopupClose(cf);
        await hoverAndLeave(page, grid, cf);
        await page.clock.runFor(250);
        const content = (await cf.locator('#filterContent').boundingBox())!;
        await page.mouse.move(content.x + content.width / 2, content.y + content.height / 2, { steps: 5 });

        await page.clock.runFor(1000);
        expect(await page.evaluate(() => (window as any).__cfClosed)).toBeNull();
        await expect(clearItem(cf)).toBeVisible();
    });

    test('close-delay app setting overrides the 750ms delay', { annotation: [{ type: 'case', description: 'gap.cf-close-delay-setting' }] }, async ({ page }) => {
        await page.clock.install();
        await gridPage(page, { settings: { 'vi-query-grid-column-filter.close-delay': '100' } });
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Gender');
        await trackPopupClose(cf);
        await pauseClock(page);

        await hoverAndLeave(page, grid, cf);
        await page.clock.runFor(99);
        expect(await page.evaluate(() => (window as any).__cfClosed), 'still open 99ms after leaving').toBeNull();
        await page.clock.runFor(1);
        expect(await page.evaluate(() => (window as any).__cfClosed), 'closed 100ms after leaving').not.toBeNull();
        await expect(clearItem(cf)).toBeHidden();
    });

    test('opening another filter closes the first', { annotation: [{ type: 'case', description: 'filters.cf-popup-one-at-a-time' }] }, async ({ page }) => {
        const grid = await setup(page);
        const gender = await openFilter(grid, 'Gender');

        const lastName = columnFilter(grid, 'LastName');
        await filterButton(lastName).click();
        await expect(clearItem(lastName)).toBeVisible();
        await expect(clearItem(gender)).toBeHidden();
        await expect(gender.locator('vi-popup[open]')).toHaveCount(0);
    });

    test('popup opens below the button, left-aligned, inside the viewport', { annotation: [{ type: 'case', description: 'filters.cf-popup-position' }] }, async ({ page }) => {
        const grid = await setup(page);

        const firstName = await openFilter(grid, 'FirstName');
        const button = (await filterButton(firstName).boundingBox())!;
        const content = (await firstName.locator('#filterContentHost').boundingBox())!;
        expect(Math.abs(content.y - (button.y + button.height))).toBeLessThanOrEqual(2);
        expect(Math.abs(content.x - button.x)).toBeLessThanOrEqual(2);

        const isActive = await openFilter(grid, 'IsActive');
        const right = (await isActive.locator('#filterContentHost').boundingBox())!;
        expect(right.x + right.width).toBeLessThanOrEqual(1280);
        expect(right.x).toBeGreaterThanOrEqual(0);
    });

    test('popup content defaults to 20em x 25em', { annotation: [{ type: 'case', description: 'filters.cf-popup-default-size' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');

        const content = cf.locator('#filterContent');
        const fontSize = await content.evaluate((el: Element) => parseFloat(getComputedStyle(el).fontSize));
        const box = (await content.boundingBox())!;
        expect(Math.abs(box.width - 20 * fontSize)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.height - 25 * fontSize)).toBeLessThanOrEqual(1);
    });

    test('filter clicks never reach the header or sort the column', { annotation: [{ type: 'case', description: 'filters.cf-popup-click-contained' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const sort = await grid.evaluate((g: any) => JSON.stringify(g.query.sortOptions));
        await grid.locator('vi-query-grid-column-header[name="Gender"]').evaluate((header: Element) => {
            (window as any).__headerClicks = 0;
            header.addEventListener('click', () => (window as any).__headerClicks++);
        });
        const headerClicks = () => page.evaluate(() => (window as any).__headerClicks);
        await log.quiet();
        log.clear();

        // Open (first render) and close with the button
        const cf = columnFilter(grid, 'Gender');
        await filterButton(cf).click();
        await expect(clearItem(cf)).toBeVisible();
        await expect(cf).not.toHaveAttribute('loading');
        await filterButton(cf).click();
        await expect(clearItem(cf)).toBeHidden();
        await log.quiet();
        expect(log.queries()).toHaveLength(0);
        expect(await grid.evaluate((g: any) => JSON.stringify(g.query.sortOptions))).toBe(sort);

        // The search input, the inverse toggle (without a selection) and a value row
        // Clicks inside the popup content are contained
        await openFilter(grid, 'Gender');
        await page.evaluate(() => (window as any).__headerClicks = 0);
        await searchInput(cf).click();
        await inverseButton(cf).click();
        await inverseButton(cf).click();
        await clickDistinct(cf, 'Female');
        await waitForQueryIdle(grid);

        expect(await headerClicks()).toBe(0);
        expect(await grid.evaluate((g: any) => JSON.stringify(g.query.sortOptions))).toBe(sort);
    });
});

test.describe('Distinct loading (more)', () => {
    test('open list re-renders when QueryColumn.distincts changes', { annotation: [{ type: 'case', description: 'filters.cf-distincts-external-update' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        expect(await settledTexts(cf)).toEqual(['Female', 'Male', 'Unknown']);

        await grid.evaluate((g: any) => g.query.getColumn('Gender').distincts = { matching: ['|Female'], remaining: ['|Male'], isDirty: false, hasMore: false });
        await expect.poll(() => distinctTexts(cf)).toEqual(['Female', 'Male']);
        const rows = await settledRows(cf);
        expect(rows[0].color).not.toBe(REMAINING);
        expect(rows[1].color).toBe(REMAINING);
        expect(rows.some(r => r.hasMore)).toBe(false);

        await grid.evaluate((g: any) => g.query.getColumn('Gender').distincts = { matching: ['|Female'], remaining: ['|Male'], isDirty: false, hasMore: true });
        await expect.poll(async () => (await distinctRows(cf)).map(r => r.hasMore)).toEqual([false, false, true]);
        await expect(cf.locator('.hasMore vi-icon[source="Ellipsis"]').filter({ visible: true })).toHaveCount(1);
    });

    test('failed distinct load hides the spinner without an alert', { annotation: [{ type: 'case', description: 'filters.cf-distincts-error' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        const grid = await setup(page, { expectedErrors: [SERVER_ERROR] });
        await page.route('**/ExecuteAction', async route => {
            const body = route.request().postData() ?? '';
            if (!body.includes('QueryFilter.RefreshColumn'))
                return route.continue();

            // Gender gets a server error, LastName an aborted request
            if (body.includes('"Gender"'))
                return route.fulfill({ status: 500, contentType: 'text/plain', body: 'pw refresh error' });

            return route.abort();
        });

        for (const column of ['Gender', 'LastName']) {
            const cf = columnFilter(grid, column);
            await filterButton(cf).click();
            await expect(clearItem(cf)).toBeVisible();
            await expect(cf).not.toHaveAttribute('loading');
            await expect(cf.locator('vi-spinner')).toBeHidden();
            await expect(cf.locator('vi-popup[open]')).toHaveCount(1);
            expect(await distinctRows(cf)).toEqual([]);
        }

        expect(await page.evaluate(() => (window as any).__alerts ?? [])).toEqual([]);
        expect(errors).toEqual([]);
    });
});

test.describe('Distinct list (more)', () => {
    test('clicking the has-more row does nothing', { annotation: [{ type: 'case', description: 'filters.cf-list-hasmore-inert' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Email');
        const rows = await allDistinctRows(cf);
        expect(rows[rows.length - 1].hasMore).toBe(true);
        await log.quiet();
        log.clear();

        await cf.locator('.hasMore').filter({ visible: true }).click();
        await log.quiet();

        expect(log.queries()).toHaveLength(0);
        expect(log.refreshes()).toHaveLength(0);
        expect((await columnState(grid, 'Email')).selectedDistincts).toEqual([]);
        await expect(clearItem(cf)).toBeVisible();
    });

    test('LastName lists all 32 values without has-more', { annotation: [{ type: 'case', description: 'filters.cf-list-lastname-complete' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');

        const rows = await allDistinctRows(cf);
        expect(rows).toHaveLength(32);
        expect(rows[0].text).toBe('Claes');
        expect(rows[31].text).toBe('Wouters');
        expect(rows.some(r => r.hasMore)).toBe(false);
        expect(new Set(rows.map(r => r.text)).size).toBe(32);
    });

    test('reopening shows the list scrolled to the top', { annotation: [{ type: 'case', description: 'filters.cf-distincts-scroll-top-reopen' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');

        const firstInside = async () => {
            const box = (await listBox(cf))!;
            return (await distinctRows(cf)).find(r => r.top >= box.y - 1 && r.bottom <= box.y + box.height + 1)?.text;
        };
        const inside = async (text: string) => {
            const box = (await listBox(cf))!;
            const row = (await distinctRows(cf)).find(r => r.text === text);
            return !!row && row.top >= box.y - 1 && row.bottom <= box.y + box.height + 1;
        };

        await expect.poll(firstInside).toBe('Claes');
        const box = (await listBox(cf))!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
        await page.mouse.wheel(0, 2000);
        await expect.poll(() => inside('Wouters')).toBe(true);

        await page.keyboard.press('Escape');
        await expect(clearItem(cf)).toBeHidden();
        await openFilter(grid, 'LastName');
        await expect.poll(firstInside).toBe('Claes');
    });

    test('distinct rows are --theme-h3 high', { annotation: [{ type: 'case', description: 'filters.cf-list-row-height' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        const h3 = await cf.evaluate((host: Element) => parseFloat(getComputedStyle(host).getPropertyValue('--theme-h3')));
        expect(h3).toBeGreaterThan(0);

        const rows = await settledRows(cf);
        expect(rows).toHaveLength(3);
        for (const row of rows)
            expect(Math.abs((row.bottom - row.top) - h3), row.text).toBeLessThanOrEqual(0.5);
    });

    test('hover and remaining colors follow defaults and public CSS vars', { annotation: [{ type: 'case', description: 'filters.cf-list-theme-vars' }] }, async ({ page }) => {
        const grid = await setup(page);
        const faint = await grid.evaluate((g: Element) => {
            const probe = document.createElement('div');
            probe.style.backgroundColor = 'var(--color-faint)';
            g.shadowRoot!.appendChild(probe);
            const color = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return color;
        });

        const cf = await openFilter(grid, 'Gender');
        await grid.evaluate((g: any) => g.query.getColumn('Gender').distincts = { matching: ['|Female'], remaining: ['|Male'], isDirty: false, hasMore: false });
        await expect.poll(() => distinctTexts(cf)).toEqual(['Female', 'Male']);

        const female = distinctItem(cf, 'Female');
        await female.hover();
        await expect(female).toHaveCSS('background-color', faint);
        await expect(distinctItem(cf, 'Male').locator('span[distinct-type="remaining"]')).toHaveCSS('color', REMAINING);

        await grid.evaluate((g: HTMLElement) => {
            g.style.setProperty('--vi-query-grid-column-filter-distinct-remaining-color', 'rgb(1, 2, 3)');
            g.style.setProperty('--vi-query-grid-column-filter-distinct-hover-color', 'rgb(4, 5, 6)');
        });
        await page.mouse.move(0, 0);
        await female.hover();
        await expect(female).toHaveCSS('background-color', 'rgb(4, 5, 6)');
        await expect(distinctItem(cf, 'Male').locator('span[distinct-type="remaining"]')).toHaveCSS('color', 'rgb(1, 2, 3)');
    });

    test('checked values use the theme color in include and exclude mode', { annotation: [{ type: 'case', description: 'filters.cf-list-checked-color' }] }, async ({ page }) => {
        const grid = await setup(page);
        const color = await resolvedColor(grid, '--color');
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');

        const checkedStyle = () => distinctItem(cf, 'Female').locator('vi-checkbox').evaluate((checkbox: Element) => {
            const deep = (root: ParentNode): Element | null => {
                for (const el of root.querySelectorAll('*')) {
                    if (el.id === 'box')
                        return el;

                    const found = el.shadowRoot ? deep(el.shadowRoot) : null;
                    if (found)
                        return found;
                }

                return null;
            };

            const box = deep(checkbox.shadowRoot ?? checkbox);
            return { fill: box ? getComputedStyle(box).fill : '', variable: getComputedStyle(checkbox).getPropertyValue('--vi-checkbox-checked-color').trim() };
        });

        await expect.poll(checkedStyle).toEqual({ fill: color, variable: '' });

        await inverseButton(cf).click();
        await expect(cf).not.toHaveAttribute('loading');
        await expect.poll(() => filterLabel(cf)).toBe('≠ Female');
        await expect.poll(checkedStyle).toEqual({ fill: color, variable: '' });
    });
});

test.describe('Selection (more)', () => {
    test('spinner shows and list dims during the toggle round-trip', { annotation: [{ type: 'case', description: 'filters.cf-select-spinner' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');

        let release!: () => void;
        const held = new Promise<void>(resolve => release = resolve);
        let holding = false;
        await page.route('**/ExecuteQuery', async route => {
            holding = true;
            await held;
            await route.continue();
        });

        try {
            await distinctItem(cf, 'Female').click();
            await expect.poll(() => holding).toBe(true);
            await expect(cf.locator('vi-spinner')).toBeVisible();
            await expect(cf).toHaveAttribute('loading');
            await expect(cf.locator('vi-list')).toHaveCSS('opacity', '0.5');
        }
        finally {
            release();
        }

        // Done once the search and the distinct refresh both finished
        await expect(cf).not.toHaveAttribute('loading');
        await expect(cf.locator('vi-spinner')).toBeHidden();
        await expect(cf.locator('vi-list')).toHaveCSS('opacity', '1');
        expect(await grid.evaluate((g: any) => g.query.isBusy)).toBe(false);
        expect(await totalItems(grid)).toBe(4587);
    });

    test('selecting during a search keeps and reuses the search', { annotation: [{ type: 'case', description: 'filters.cf-select-with-search' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'LastName');
        await searchInput(cf).pressSequentially('cl');
        await expect.poll(() => distinctTexts(cf)).toEqual(['Claes', 'Claeys', 'Declerck', 'Declercq']);
        await log.quiet();
        log.clear();

        await clickDistinct(cf, 'Claes');
        await waitForQueryIdle(grid);
        await log.quiet();

        const refreshes = log.refreshes('LastName');
        expect(refreshes).toHaveLength(1);
        expect(refreshes[0].body.parameters.Search).toBe('cl');
        await expect(searchInput(cf)).toHaveValue('cl');

        const rows = await settledRows(cf);
        expect(rows.map(r => r.text)).toEqual(['Claes', 'Claeys', 'Declerck', 'Declercq']);
        expect(rows.map(r => r.checked)).toEqual([true, false, false, false]);
    });

    test('filters on different columns combine with AND', { annotation: [{ type: 'case', description: 'filters.cf-select-cross-column-and' }] }, async ({ page }) => {
        const grid = await setup(page);
        await clickDistinct(await openFilter(grid, 'Gender'), 'Female');
        await waitForQueryIdle(grid);
        await clickDistinct(await openFilter(grid, 'IsActive'), 'Yes');
        await waitForQueryIdle(grid);

        const total = await totalItems(grid);
        const expected = await grid.evaluate(async (g: any) => {
            const clone = g.query.clone();
            clone.getColumn('Gender').selectedDistincts = ['|Female'];
            clone.getColumn('Gender').selectedDistinctsInversed = false;
            clone.getColumn('IsActive').selectedDistincts = ['4|TrueYes'];
            clone.getColumn('IsActive').selectedDistinctsInversed = false;
            await clone.search();
            return clone.totalItems;
        });
        expect(total).toBe(expected);
        expect(total).toBeGreaterThan(0);
        expect(total).toBeLessThan(4587);

        const loaded = await grid.evaluate((g: any) => {
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                return q.items.filter((i: any) => !!i).map((i: any) => ({ gender: String(i.getValue('Gender')), active: i.getValue('IsActive') }));
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        });
        expect(loaded.length).toBeGreaterThan(0);
        expect(loaded.every(r => r.gender === 'Female' && r.active === true)).toBe(true);
    });

    test('two quick distinct clicks both apply', { annotation: [{ type: 'case', description: 'gap.cf-rapid-distinct-clicks' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await settledRows(cf);

        await distinctItem(cf, 'Female').click();
        await distinctItem(cf, 'Male').click({ delay: 0 });
        await expect.poll(() => grid.evaluate((g: any) => g.query.getColumn('Gender').selectedDistincts.length)).toBe(2);
        await waitForQueryIdle(grid);
        await expect(cf).not.toHaveAttribute('loading');

        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual(['|Female', '|Male']);
        await expect.poll(() => filterLabel(cf)).toBe('= Female, Male');
        const rows = await settledRows(cf);
        expect(rows.filter(r => r.checked).map(r => r.text)).toEqual(['Female', 'Male']);
        expect(await totalItems(grid)).toBe(9093);
        expect(errors).toEqual([]);
    });

    test('selecting with the grid scrolled resets the scroll and keeps the popup open', { annotation: [{ type: 'case', description: 'filters.cf-select-scrolled-grid-stays-open' }] }, async ({ page }) => {
        const grid = await setup(page);
        await scrollGrid(grid, { top: 2000 });
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(2000);
        await waitForGridReady(grid);

        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');
        await waitForQueryIdle(grid);

        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(0);
        expect(await totalItems(grid)).toBe(4587);
        // Like a selection on an unscrolled grid, the popup stays open for more choices
        await expect(clearItem(cf)).toBeVisible();
        await expect(cf.locator('vi-popup[open]')).toHaveCount(1);
    });
});

test.describe('Include/exclude (more)', () => {
    test('inverse toggle shows include mode by default', { annotation: [{ type: 'case', description: 'filters.cf-inverse-initial' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');

        expect((await columnState(grid, 'Gender')).inversed).toBe(false);
        await expect(inverseButton(cf)).not.toHaveAttribute('inversed');
        await expect(inverseButton(cf)).toHaveCSS('fill', 'rgb(170, 170, 170)');
    });

    test('inverse without a selection only flips the mode', { annotation: [{ type: 'case', description: 'filters.cf-inverse-no-selection' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Gender');
        await log.quiet();
        log.clear();

        await inverseButton(cf).click();
        expect((await columnState(grid, 'Gender')).inversed).toBe(true);
        await expect(inverseButton(cf)).toHaveCSS('fill', 'rgb(139, 0, 0)');
        await log.quiet();
        expect(log.requests).toHaveLength(0);
        expect(await filterLabel(cf)).toBe('');
        await expect(cf).not.toHaveAttribute('filtered');

        await clickDistinct(cf, 'Female');
        await expect.poll(() => filterLabel(cf)).toBe('≠ Female');
        expect(await totalItems(grid)).toBe(5413);
    });
});

test.describe('Clear filter (more)', () => {
    test('clicking the unfiltered clear item does nothing', { annotation: [{ type: 'case', description: 'filters.cf-clear-disabled-noop' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Gender');
        await log.quiet();
        log.clear();

        await clearItem(cf).click();
        await log.quiet();
        expect(log.requests).toHaveLength(0);
        await expect(clearItem(cf)).toBeVisible();
        await expect(cf.locator('vi-popup[open]')).toHaveCount(1);
    });

    test('clearing one column keeps the others', { annotation: [{ type: 'case', description: 'filters.cf-clear-scoped-to-column' }] }, async ({ page }) => {
        const grid = await setup(page);
        await clickDistinct(await openFilter(grid, 'Gender'), 'Female');
        await waitForQueryIdle(grid);
        await clickDistinct(await openFilter(grid, 'IsActive'), 'Yes');
        await waitForQueryIdle(grid);

        const gender = await openFilter(grid, 'Gender');
        await clearItem(gender).click();
        await expect(clearItem(gender)).toBeHidden();
        await waitForQueryIdle(grid);

        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual([]);
        expect((await columnState(grid, 'IsActive')).selectedDistincts).toEqual(['4|TrueYes']);
        await expect.poll(() => filterLabel(columnFilter(grid, 'IsActive'))).toBe('= Yes');
        for (const name of PEOPLE_COLUMNS)
            await expect(columnFilter(grid, name)).toHaveAttribute('query-filtering');
    });

    test('clear also switches the column back to include mode', { annotation: [{ type: 'case', description: 'filters.cf-inverse-survives-clear' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await inverseButton(cf).click();
        await clickDistinct(cf, 'Female');
        await expect.poll(() => filterLabel(cf)).toBe('≠ Female');

        await clearItem(cf).click();
        await expect(clearItem(cf)).toBeHidden();
        await waitForQueryIdle(grid);
        expect(await columnState(grid, 'Gender')).toEqual({ selectedDistincts: [], inversed: false });

        const reopened = await openFilter(grid, 'Gender');
        await expect(inverseButton(reopened)).not.toHaveAttribute('inversed');
        await clickDistinct(reopened, 'Male');
        await expect.poll(() => filterLabel(reopened)).toBe('= Male');
        expect(await totalItems(grid)).toBe(4506);
    });

    test('clearing the last selection of an unsaved filter drops the current filter', { annotation: [{ type: 'case', description: 'filters.cf-clear-keeps-current-filter' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');
        await expect.poll(() => grid.evaluate((g: any) => g.query.filters.currentFilter?.persistentObject?.isNew ?? null)).toBe(true);
        await waitForQueryIdle(grid);
        await log.quiet();
        log.clear();

        await clearItem(cf).click();
        await expect(clearItem(cf)).toBeHidden();
        await waitForQueryIdle(grid);

        await expect.poll(() => grid.evaluate((g: any) => g.query.filters.currentFilter ?? null)).toBeNull();
        await expect(filtersControl(grid)).toHaveAttribute('disabled');
        expect(await totalItems(grid)).toBe(10000);
        await log.quiet();
        expect(log.queries()).toHaveLength(1);
    });

    test('deselecting the last value of an unsaved filter drops the current filter', { annotation: [{ type: 'case', description: 'filters.cf-deselect-drops-current-filter' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');
        await expect.poll(() => grid.evaluate((g: any) => g.query.filters.currentFilter?.persistentObject?.isNew ?? null)).toBe(true);
        await waitForQueryIdle(grid);
        await log.quiet();
        log.clear();

        await clickDistinct(cf, 'Female');
        await waitForQueryIdle(grid);

        await expect.poll(() => grid.evaluate((g: any) => g.query.filters.currentFilter ?? null)).toBeNull();
        await expect(filtersControl(grid)).toHaveAttribute('disabled');
        expect(await totalItems(grid)).toBe(10000);
        await log.quiet();
        expect(log.queries()).toHaveLength(1);
    });

    test('deselecting before the new filter arrives leaves no current filter', { annotation: [{ type: 'case', description: 'filters.cf-deselect-during-create' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await settledRows(cf);

        let release!: () => void;
        const held = new Promise<void>(resolve => release = resolve);
        let holding = false;
        await page.route('**/ExecuteAction', async route => {
            if (!/(^|\.)New$/.test(route.request().postDataJSON()?.action ?? ''))
                return route.continue();

            holding = true;
            await held;
            await route.continue();
        });

        try {
            await distinctItem(cf, 'Female').click();
            await expect.poll(() => holding).toBe(true);
            await distinctItem(cf, 'Female').click();
        }
        finally {
            release();
        }

        await waitForQueryIdle(grid);
        await expect(cf).not.toHaveAttribute('loading');
        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual([]);
        await expect.poll(() => grid.evaluate((g: any) => g.query.filters.currentFilter ?? null)).toBeNull();
        await expect(filtersControl(grid)).toHaveAttribute('disabled');
    });
});

test.describe('Search (more)', () => {
    const LAST_NAMES_DE = 10;

    async function highlights(cf: Locator) {
        return cf.locator('.item').filter({ visible: true }).evaluateAll(items => items
            .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
            .map(item => ({ text: (item as HTMLElement).innerText.trim(), matches: [...item.querySelectorAll('.match')].map(m => m.textContent) })));
    }

    test('search box shows the translated placeholder', { annotation: [{ type: 'case', description: 'filters.cf-search-placeholder' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await expect(searchInput(cf)).toHaveAttribute('placeholder', 'Search ...');
    });

    test('every occurrence in a row is highlighted', { annotation: [{ type: 'case', description: 'filters.cf-search-highlight-multiple' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');
        await searchInput(cf).pressSequentially('de');
        await expect.poll(async () => (await distinctTexts(cf)).length).toBe(LAST_NAMES_DE);

        const rows = await highlights(cf);
        for (const row of rows) {
            const expected = ['Dewilde', 'Vandevelde'].includes(row.text) ? 2 : 1;
            expect(row.matches, row.text).toHaveLength(expected);
            expect(row.matches.every(m => m!.toLowerCase() === 'de'), row.text).toBe(true);
        }
        expect(rows.map(r => r.text)).toEqual(expect.arrayContaining(['Dewilde', 'Vandevelde']));
    });

    test('search is case-insensitive', { annotation: [{ type: 'case', description: 'filters.cf-search-case-insensitive' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');
        await searchInput(cf).pressSequentially('de');
        await expect.poll(async () => (await distinctTexts(cf)).length).toBe(LAST_NAMES_DE);
        const lower = await highlights(cf);

        await searchInput(cf).fill('');
        await searchInput(cf).pressSequentially('DE');
        await expect.poll(async () => (await highlights(cf)).map(r => r.text)).toEqual(lower.map(r => r.text));

        // The highlights keep the value's own casing
        const upper = await highlights(cf);
        expect(upper).toEqual(lower);
        const matches = upper.flatMap(r => r.matches);
        expect(matches).toContain('De');
        expect(matches).toContain('de');
    });

    test('search without matches shows an empty list', { annotation: [{ type: 'case', description: 'filters.cf-search-no-results' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');
        await searchInput(cf).pressSequentially('xyz');

        await expect.poll(async () => (await distinctRows(cf)).length).toBe(0);
        await expect(cf.locator('.hasMore').filter({ visible: true })).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test('regex metacharacters match literally', { annotation: [{ type: 'case', description: 'filters.cf-search-regex-chars' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');
        expect(await settledRows(cf)).not.toHaveLength(0);

        for (const text of ['(', '.', '[', '*', '+', '?', '\\']) {
            await searchInput(cf).fill(text);
            await expect.poll(async () => (await distinctRows(cf)).length, text).toBe(0);
        }

        await searchInput(cf).fill('');
        await expect.poll(async () => (await distinctRows(cf)).length).toBeGreaterThan(0);
        expect(errors).toEqual([]);
    });

    test('search reset button clears the text and re-queries', { annotation: [{ type: 'case', description: 'filters.cf-search-reset-button' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'LastName');
        await searchInput(cf).pressSequentially('cl');
        await expect.poll(() => distinctTexts(cf)).toEqual(['Claes', 'Claeys', 'Declerck', 'Declercq']);
        await log.quiet();
        log.clear();

        await cf.locator('vi-input-search button.reset').click();
        await expect(searchInput(cf)).toHaveValue('');
        await expect(cf).not.toHaveAttribute('loading');
        await waitForQueryIdle(grid);
        await log.quiet();

        expect((await columnState(grid, 'LastName')).selectedDistincts).toEqual([]);
        expect(await allDistinctRows(cf)).toHaveLength(32);
        expect(log.queries()).toHaveLength(1);
        expect(log.refreshes('LastName')).toHaveLength(1);
    });

    test('closing the popup clears the search text', { annotation: [{ type: 'case', description: 'filters.cf-search-persists-reopen' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');
        await searchInput(cf).pressSequentially('cl');
        await expect.poll(() => distinctTexts(cf)).toEqual(['Claes', 'Claeys', 'Declerck', 'Declercq']);

        await page.keyboard.press('Escape');
        await expect(clearItem(cf)).toBeHidden();

        await openFilter(grid, 'LastName');
        await expect(searchInput(cf)).toHaveValue('');
        expect(await allDistinctRows(cf)).toHaveLength(32);
    });
});

test.describe('Server search (more)', () => {
    test('has-more row shows while a search result has more values', { annotation: [{ type: 'case', description: 'filters.cf-search-shows-hasmore' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Email');
        await searchInput(cf).pressSequentially('a');
        await expect(cf).not.toHaveAttribute('loading', { timeout: 10000 });
        expect(await grid.evaluate((g: any) => g.query.getColumn('Email').distincts.hasMore)).toBe(true);

        // The server answered a truncated list for 'a': the list ends with the has-more row
        const rows = await allDistinctRows(cf);
        expect(rows.length).toBeGreaterThan(1);
        expect(rows[rows.length - 1].hasMore).toBe(true);
    });

    test('latest search wins with out-of-order responses', { annotation: [{ type: 'case', description: 'filters.cf-search-stale-response' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Email');
        let staleHeld = false;
        let release!: () => void;
        const held = new Promise<void>(resolve => release = resolve);
        await page.route('**/ExecuteAction', async route => {
            const body = route.request().postDataJSON();
            if (body?.action === 'QueryFilter.RefreshColumn' && body.parameters?.Search === 'a') {
                staleHeld = true;
                await held;
            }

            await route.continue();
        });

        // Keep the promise of the 'a' refresh, to wait until the page handled its late response
        await grid.evaluate((g: any) => {
            const column = g.query.getColumn('Email');
            const refreshDistincts = column.refreshDistincts;
            column.refreshDistincts = function (search?: string) {
                const refresh = refreshDistincts.call(this, search);
                if (search === 'a')
                    (window as any).__staleRefresh = refresh;

                return refresh;
            };
        });

        await searchInput(cf).pressSequentially('a');
        await expect.poll(() => staleHeld).toBe(true);
        await searchInput(cf).pressSequentially('aron');
        await expect(cf).not.toHaveAttribute('loading', { timeout: 10000 });

        // Let the held 'a' search through, it answers after 'aaron'
        const stale = page.waitForResponse(r => r.request().postDataJSON()?.parameters?.Search === 'a');
        release();
        const staleValues = ((await (await stale).json()).result.attributes as any[]).find(a => a.name === 'MatchingDistincts').options as string[];
        expect(staleValues.some(v => !v.toLowerCase().includes('aaron'))).toBe(true);
        await page.evaluate(() => (window as any).__staleRefresh.then(() => {}));

        const distincts = await grid.evaluate((g: any) => g.query.getColumn('Email').distincts.matching as string[]);
        expect(distincts.length).toBeGreaterThan(0);
        expect(distincts.every(v => v.toLowerCase().includes('aaron'))).toBe(true);
        await expect(cf).not.toHaveAttribute('loading');
        await expect(searchInput(cf)).toHaveValue('aaron');
    });

    test('clearing a has-more search reloads the full list', { annotation: [{ type: 'case', description: 'filters.cf-search-clear-reloads' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Email');
        await searchInput(cf).pressSequentially('aaron');
        await expect(cf).not.toHaveAttribute('loading', { timeout: 10000 });
        await log.quiet();
        log.clear();

        await searchInput(cf).press('Control+A');
        await searchInput(cf).press('Backspace');
        await expect(searchInput(cf)).toHaveValue('');
        await expect(cf).not.toHaveAttribute('loading', { timeout: 10000 });
        await log.quiet();

        const refreshes = log.refreshes('Email');
        expect(refreshes).toHaveLength(1);
        expect(refreshes[0].body.parameters.Search).toBeUndefined();

        const rows = await allDistinctRows(cf);
        expect(rows).toHaveLength(101);
        expect(rows[100].hasMore).toBe(true);
    });

    test('detaching the grid sends nothing and re-attaching shows an empty search', { annotation: [{ type: 'case', description: 'gap.cf-disconnect-clears-search' }] }, async ({ page }) => {
        await page.clock.install();
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Email');
        await searchInput(cf).pressSequentially('aaron');
        await expect(cf).not.toHaveAttribute('loading', { timeout: 10000 });
        await log.quiet();
        await pauseClock(page);
        log.clear();

        // Removed with the popup still open and the search text in place, like navigating away
        await page.evaluate(() => (window as any).grid.remove());
        // Well past the 250ms search debounce: a detached filter must not send anything
        await page.clock.runFor(1000);
        await log.quiet();
        expect(log.refreshes()).toHaveLength(0);
        await page.clock.resume();

        await page.evaluate(() => document.getElementById('test-container')!.appendChild((window as any).grid));
        await waitForGridReady(grid);
        await openFilter(grid, 'Email');
        await expect(searchInput(cf)).toHaveValue('');
        const rows = await allDistinctRows(cf);
        expect(rows).toHaveLength(101);
        expect(rows[100].hasMore).toBe(true);
    });

    test('a search answered after the grid was detached does not stay in the list', { annotation: [{ type: 'case', description: 'gap.cf-disconnect-search-in-flight' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Email');
        let searchHeld = false;
        let release!: () => void;
        const held = new Promise<void>(resolve => release = resolve);
        await page.route('**/ExecuteAction', async route => {
            const body = route.request().postDataJSON();
            if (body?.action === 'QueryFilter.RefreshColumn' && body.parameters?.Search === 'an') {
                searchHeld = true;
                await held;
            }

            await route.continue();
        });

        await searchInput(cf).pressSequentially('an');
        await expect.poll(() => searchHeld).toBe(true);

        await page.evaluate(() => {
            const w = window as any;
            w.grid.remove();
            w.__distincts = w.grid.query.getColumn('Email').distincts;
        });
        const search = page.waitForResponse(r => r.request().postDataJSON()?.parameters?.Search === 'an');
        release();
        await search;
        await expect.poll(() => page.evaluate(() => (window as any).grid.query.getColumn('Email').distincts !== (window as any).__distincts)).toBe(true);

        await page.evaluate(() => document.getElementById('test-container')!.appendChild((window as any).grid));
        await waitForGridReady(grid);
        await openFilter(grid, 'Email');
        await expect(searchInput(cf)).toHaveValue('');
        expect(await grid.evaluate((g: any) => g.query.getColumn('Email').distincts.matching[0])).toBe(`|${FIRST_EMAIL}`);
        const rows = await allDistinctRows(cf);
        expect(rows).toHaveLength(101);
        expect(rows[0].text).toBe(FIRST_EMAIL);
    });

    test('a new grid on the same query after a search shows the full list', { annotation: [{ type: 'case', description: 'gap.cf-search-new-grid-same-query' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Email');
        await searchInput(cf).pressSequentially('an');
        await expect(cf).not.toHaveAttribute('loading', { timeout: 10000 });
        expect(await grid.evaluate((g: any) => g.query.getColumn('Email').distincts.matching[0])).not.toBe(`|${FIRST_EMAIL}`);

        // Like returning to a view that is stamped again: the cached query gets a new grid
        await page.evaluate(() => {
            const w = window as any;
            w.grid.remove();
            const next = document.createElement('vi-query-grid') as any;
            next.query = w.q;
            document.getElementById('test-container')!.appendChild(next);
            w.grid = next;
        });
        await waitForGridReady(grid);

        await openFilter(grid, 'Email');
        await expect(searchInput(cf)).toHaveValue('');
        expect(await grid.evaluate((g: any) => g.query.getColumn('Email').distincts.matching[0])).toBe(`|${FIRST_EMAIL}`);
        const rows = await allDistinctRows(cf);
        expect(rows).toHaveLength(101);
        expect(rows[0].text).toBe(FIRST_EMAIL);
    });

    test('a search answered after a re-attach and reopen does not replace the full list', { annotation: [{ type: 'case', description: 'gap.cf-reopen-search-in-flight' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Email');
        let searchHeld = false;
        let release!: () => void;
        const held = new Promise<void>(resolve => release = resolve);
        await page.route('**/ExecuteAction', async route => {
            const body = route.request().postDataJSON();
            if (body?.action === 'QueryFilter.RefreshColumn' && body.parameters?.Search === 'an') {
                searchHeld = true;
                await held;
            }

            await route.continue();
        });

        // Keep the promise of the 'an' refresh, to wait until the page handled its late response
        await grid.evaluate((g: any) => {
            const column = g.query.getColumn('Email');
            const refreshDistincts = column.refreshDistincts;
            column.refreshDistincts = function (search?: string) {
                const refresh = refreshDistincts.call(this, search);
                if (search === 'an')
                    (window as any).__searchRefresh = refresh;

                return refresh;
            };
        });

        await searchInput(cf).pressSequentially('an');
        await expect.poll(() => searchHeld).toBe(true);

        await page.evaluate(() => {
            const w = window as any;
            w.grid.remove();
            document.getElementById('test-container')!.appendChild(w.grid);
        });
        await waitForGridReady(grid);
        await openFilter(grid, 'Email');

        release();
        await page.evaluate(() => (window as any).__searchRefresh.then(() => {}));
        await expect(cf).not.toHaveAttribute('loading');
        await expect(searchInput(cf)).toHaveValue('');
        expect(await grid.evaluate((g: any) => g.query.getColumn('Email').distincts.matching[0])).toBe(`|${FIRST_EMAIL}`);
        const rows = await allDistinctRows(cf);
        expect(rows).toHaveLength(101);
        expect(rows[0].text).toBe(FIRST_EMAIL);
    });
});

test.describe('Text filter (Enter) (more)', () => {
    test('Enter with empty search re-queries without adding a filter', { annotation: [{ type: 'case', description: 'filters.cf-search-enter-empty' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);
        const cf = await openFilter(grid, 'Gender');
        await log.quiet();
        log.clear();

        await searchInput(cf).press('Enter');
        await expect(cf).not.toHaveAttribute('loading');
        await waitForQueryIdle(grid);
        await log.quiet();

        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual([]);
        expect(log.queries()).toHaveLength(1);
        expect(log.refreshes('Gender')).toHaveLength(1);
    });

    test('exact values precede text filters in the label', { annotation: [{ type: 'case', description: 'filters.cf-search-enter-combined-label' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');
        await searchInput(cf).pressSequentially('Cl');
        await searchInput(cf).press('Enter');
        await expect(cf).not.toHaveAttribute('loading');
        await waitForQueryIdle(grid);
        await expect.poll(() => filterLabel(cf)).toBe('= Cl');
        const textOnly = await totalItems(grid);

        await clickDistinct(cf, 'Maes');
        await waitForQueryIdle(grid);
        await expect.poll(() => filterLabel(cf)).toBe('= Maes, Cl');
        expect(await totalItems(grid)).toBeGreaterThan(textOnly);
    });

    test('a failed search after Enter rolls the text filter back', { annotation: [{ type: 'case', description: 'gap.cf-search-enter-search-fails' }] }, async ({ page }) => {
        const grid = await setup(page, { expectedErrors: [SERVER_ERROR] });
        const cf = await openFilter(grid, 'LastName');
        await page.route('**/ExecuteQuery', route => route.fulfill({ status: 500, contentType: 'text/plain', body: 'pw search error' }), { times: 1 });

        await searchInput(cf).pressSequentially('Cl');
        await searchInput(cf).press('Enter');
        await waitForQueryIdle(grid);
        await expect(cf).not.toHaveAttribute('loading');

        expect((await columnState(grid, 'LastName')).selectedDistincts).toEqual([]);
        await expect.poll(() => filterLabel(cf)).toBe('');
        await expect(cf).not.toHaveAttribute('filtered');
        await expect(searchInput(cf)).toHaveValue('Cl');
        await expect.poll(() => settledTexts(cf)).toEqual(['Claes', 'Claeys', 'Declerck', 'Declercq']);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter ?? null)).toBeNull();

        // The kept text can be retried
        await searchInput(cf).press('Enter');
        await expect(cf).not.toHaveAttribute('loading');
        await waitForQueryIdle(grid);
        expect((await columnState(grid, 'LastName')).selectedDistincts).toEqual(['1|@Cl']);
        await expect.poll(() => filterLabel(cf)).toBe('= Cl');
    });
});

test.describe('Resize (more)', () => {
    async function drag(page: Page, cf: Locator, dx: number, dy: number) {
        // Grab the outer corner of the handle: its inner part lies under the list, which shows a scrollbar for long lists
        const handle = (await resizeHandleBox(cf))!;
        const x = handle.x + handle.width - 2;
        const y = handle.y + handle.height - 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + dx, y + dy, { steps: 10 });
        await page.mouse.up();

        // Back inside the content, so the popup's close-on-leave delay does not close it
        const content = (await cf.locator('#filterContent').boundingBox())!;
        await page.mouse.move(content.x + content.width / 2, content.y + content.height / 2, { steps: 5 });
    }

    test('popup cannot shrink below its minimum', { annotation: [{ type: 'case', description: 'filters.cf-resize-min' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        const content = cf.locator('#filterContent');
        const fontSize = await content.evaluate((el: Element) => parseFloat(getComputedStyle(el).fontSize));

        await drag(page, cf, -200, -200);
        await expect(clearItem(cf)).toBeVisible();
        const box = (await content.boundingBox())!;
        expect(Math.abs(box.width - 20 * fontSize)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.height - 25 * fontSize)).toBeLessThanOrEqual(1);
    });

    test('list uses the extra height after a resize', { annotation: [{ type: 'case', description: 'filters.cf-resize-list-fills' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'LastName');
        const intersecting = async () => {
            const box = (await listBox(cf))!;
            return (await distinctRows(cf)).filter(r => r.bottom > box.y + 1 && r.top < box.y + box.height - 1).length;
        };
        await settledRows(cf);
        const before = await intersecting();

        await drag(page, cf, 0, 110);
        await expect.poll(intersecting).toBeGreaterThanOrEqual(before + 4);
    });

    test('resize handle sits bottom-right with a resize cursor', { annotation: [{ type: 'case', description: 'filters.cf-resize-handle-render' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');

        const host = (await cf.locator('#filterContentHost').boundingBox())!;
        const handle = (await resizeHandleBox(cf))!;
        expect(handle).not.toBeNull();
        expect(Math.abs(handle.x + handle.width - (host.x + host.width))).toBeLessThanOrEqual(1);
        expect(Math.abs(handle.y + handle.height - (host.y + host.height))).toBeLessThanOrEqual(1);

        const cursor = await page.evaluate(({ x, y }) => {
            let element = document.elementFromPoint(x, y);
            while (element?.shadowRoot?.elementFromPoint(x, y) && element.shadowRoot.elementFromPoint(x, y) !== element)
                element = element.shadowRoot.elementFromPoint(x, y);

            return element ? getComputedStyle(element).cursor : null;
        }, { x: host.x + host.width - 2, y: host.y + host.height - 2 });
        expect(cursor).toBe('nwse-resize');
    });

    test('resized size survives close and reopen', { annotation: [{ type: 'case', description: 'filters.cf-resize-persists' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        const content = cf.locator('#filterContent');
        const before = (await content.boundingBox())!;

        await drag(page, cf, 120, 80);
        await expect.poll(async () => Math.round((await content.boundingBox())!.width - before.width)).toBeGreaterThan(100);
        const grown = (await content.boundingBox())!;

        await page.keyboard.press('Escape');
        await expect(clearItem(cf)).toBeHidden();
        await openFilter(grid, 'Gender');
        const reopened = (await content.boundingBox())!;
        expect(Math.abs(reopened.width - grown.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(reopened.height - grown.height)).toBeLessThanOrEqual(1);
    });

    test('popup stays open while resizing and the app is tracking', { annotation: [{ type: 'case', description: 'filters.cf-resize-sticky' }] }, async ({ page }) => {
        await page.clock.install();
        const grid = await openView(page, VIEWS.People);
        const cf = await openFilter(grid, 'Gender');
        const app = page.locator('vi-app');

        const handle = (await resizeHandleBox(cf))!;
        const x = handle.x + handle.width / 2;
        const y = handle.y + handle.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 20, y + 20, { steps: 5 });
        await expect(app).toHaveAttribute('is-tracking');
        await pauseClock(page);

        // Leave the content by moving the pointer far left and up, then hold it there past the close delay
        const content = (await cf.locator('#filterContentHost').boundingBox())!;
        await page.mouse.move(content.x - 60, y + 20, { steps: 5 });
        await page.clock.runFor(1000);
        await expect(clearItem(cf)).toBeVisible();
        await expect(app).toHaveAttribute('is-tracking');

        await page.mouse.up();
        await expect(app).not.toHaveAttribute('is-tracking');
        await expect(clearItem(cf)).toBeVisible();
        await expect(cf.locator('vi-popup[open]')).toHaveCount(1);
    });
});
