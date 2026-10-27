import { test, expect, Locator, Page } from '@playwright/test';
import { BASE, getScrollOffset, nextFrames, openView, requestLog, VIEWS, visibleRows, waitForGridReady } from '../_helpers/query-grid';
import { ALL_PARTS, box, browseReference, dialogButton, expectAligned, itemDisplay, openAttributesReference, openEmergencyContact, physicalRowCount, prefixParts, referenceDialog, rowBoxes, rowForItem, rowHeight, settle, wheelGrid } from '../_helpers/views';

async function fullName(grid: Locator, index: number) {
    return (await itemDisplay(grid, index, ['FirstName', 'LastName']))!.values.join(' ');
}

async function selectedIds(grid: Locator) {
    return grid.evaluate((g: any) => g.query.selectedItems.map((i: any) => i.id));
}

/** Samples the dialog's grid and search box every animation frame, from before the browse click. */
async function startSampler(page: Page) {
    await page.evaluate(() => {
        const w = window as any;
        w.__pwSamples = [];
        w.__pwStop = false;
        const sample = () => {
            const dialog = document.querySelector('vi-app')?.shadowRoot?.querySelector('vi-select-reference-dialog') ?? document.querySelector('vi-select-reference-dialog');
            const grid = dialog?.shadowRoot?.querySelector('vi-query-grid');
            const search = dialog?.shadowRoot?.querySelector('vi-input-search');
            if (grid && search)
                w.__pwSamples.push({ initializing: grid.hasAttribute('initializing'), searchHidden: search.hasAttribute('hidden') || getComputedStyle(search).display === 'none' });

            if (!w.__pwStop)
                requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
    });
}

async function stopSampler(page: Page): Promise<{ initializing: boolean; searchHidden: boolean }[]> {
    return page.evaluate(() => {
        const w = window as any;
        w.__pwStop = true;
        return w.__pwSamples;
    });
}

async function deepActiveElement(page: Page) {
    return page.evaluate(() => {
        let element = document.activeElement;
        const path: string[] = [];
        while (element) {
            path.push(element.tagName.toLowerCase());
            element = element.shadowRoot?.activeElement ?? null;
        }

        return path;
    });
}

test.describe('Select reference dialog: open and layout', () => {
    test('browsing Attributes.Reference opens a lookup grid', { annotation: [{ type: 'case', description: 'views.srd-open-reference' }] }, async ({ page }) => {
        const reference = await openAttributesReference(page);
        const { dialog, grid } = await browseReference(reference);

        await expect(dialog.locator('h4')).toHaveText('10 People (Top 10)');
        await expect(grid).toHaveAttribute('as-lookup', '');
        await expect(grid).toHaveAttribute('can-select', '');
        await expect(grid).not.toHaveAttribute('inline-actions');
        await expect(grid).not.toHaveAttribute('can-filter');

        const rows = await visibleRows(grid);
        expect(rows).toHaveLength(10);
        expect(rows[0].texts[0]).toBe('Aaron');

        const b = await box(grid);
        expect([b.width, b.height]).toEqual([960, 540]);
    });

    test('Person.EmergencyContact lookup over 10,000 people', { annotation: [{ type: 'case', description: 'views.srd-emergency-contact' }] }, async ({ page }) => {
        const log = requestLog(page);
        const { po, reference } = await openEmergencyContact(page);
        const { dialog, grid } = await browseReference(reference);
        const rh = await rowHeight(grid);

        await expect(dialog.locator('h4')).toHaveText(/^10[.,]?000 People$/);
        expect(await grid.evaluate((g: any) => g.query.totalItems)).toBe(10000);

        const viewport = await grid.evaluate((g: any) => ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as HTMLElement).getBoundingClientRect().height);
        const physical = await physicalRowCount(grid);
        expect(physical).toBeGreaterThanOrEqual(Math.ceil(viewport / rh) + 1);
        expect(physical).toBeLessThanOrEqual(Math.ceil(Math.ceil(viewport / rh) * 1.5) + 1);

        const rows = await visibleRows(grid);
        expect(rows[0].index).toBe(0);
        expect(rows[0].texts[0]).toBe('Aaron');

        await dialogButton(dialog, 'Cancel').click();
        await expect(referenceDialog(page)).toHaveCount(0);
        await po.locator('vi-action-button[name=CancelEdit]').click();
        await expect.poll(() => po.evaluate((p: any) => [p.persistentObject.isEditing, p.persistentObject.isDirty])).toEqual([false, false]);

        await log.quiet();
        expect(log.of('ExecuteAction').filter(r => /Save/.test(r.action ?? ''))).toEqual([]);
    });

    test('lookup grid layout: select-all control and selector prefix', { annotation: [{ type: 'case', description: 'views.srd-alignment' }] }, async ({ page }) => {
        const reference = await openAttributesReference(page);
        const { grid } = await browseReference(reference);
        const rh = await rowHeight(grid);

        const controls = await box(grid.locator('header .controls'));
        expect(controls.width).toBe(rh);

        const selectAll = grid.locator('vi-query-grid-select-all');
        await expect(selectAll).toBeVisible();
        await expect(selectAll).not.toHaveAttribute('can-select-all');
        expect(await selectAll.evaluate((e: any) => getComputedStyle(e.shadowRoot.querySelector('vi-icon')).visibility)).toBe('hidden');

        const parts = await prefixParts(await rowForItem(grid, 0));
        for (const part of ALL_PARTS) {
            if (part === 'selector')
                expect(parts[part], part).toMatchObject({ width: rh, height: rh });
            else
                expect(parts[part], part).toBeNull();
        }

        expect((await box(grid.locator('header').first())).height).toBe(rh + 1);
        const filters = grid.locator('vi-query-grid-column-header vi-query-grid-column-filter');
        for (let i = 0; i < await filters.count(); i++)
            await expect(filters.nth(i)).toBeHidden();

        await expectAligned(grid, 'lookup');
        for (const row of await rowBoxes(grid)) {
            expect(Math.round(row.height)).toBe(rh);
            row.cellHeights.forEach(h => expect(Math.round(h)).toBe(rh));
        }
    });

    test("the 'New' footer button follows canAddNewReference", { annotation: [{ type: 'case', description: 'views.srd-add-new-button' }] }, async ({ page }) => {
        for (const [attribute, visible] of [['ReferenceWithCanAddNew', true], ['Reference', false]] as const) {
            const reference = await openAttributesReference(page, attribute);
            const { dialog } = await browseReference(reference);

            // Never click it: it would create a new person
            const button = dialog.locator('footer vi-button').filter({ hasText: /^\s*New/ });
            await expect(button, attribute).toHaveCount(1);
            if (visible)
                await expect(button, attribute).toBeVisible();
            else
                await expect(button, attribute).toBeHidden();

            await dialogButton(dialog, 'Cancel').click();
            await expect(referenceDialog(page)).toHaveCount(0);
        }
    });

    test('browsing a User attribute shows a users lookup grid', { annotation: [{ type: 'case', description: 'views.user-lookup-opens' }] }, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(`${BASE}/attributes/persistent-object.1cc61676-3aa6-450f-884b-bdc425c7b232/User;Group;NullableUser`);
        const user = page.locator('vi-persistent-object-attribute-user').first();
        await user.waitFor({ timeout: 30000 });
        const before = await user.locator('input').inputValue();

        await user.locator('vi-button:has(vi-icon[source=Ellipsis])').first().click();
        const dialog = referenceDialog(page);
        const grid = dialog.locator('vi-query-grid');
        await grid.waitFor({ state: 'attached' });
        await waitForGridReady(grid);

        await expect(grid).toHaveAttribute('as-lookup', '');
        await expect(grid).toHaveAttribute('can-select', '');
        const rows = await visibleRows(grid);
        expect(rows.length).toBeGreaterThanOrEqual(1);
        expect(rows.some(r => r.texts.some(t => t.includes('Admin')))).toBe(true);

        await dialogButton(dialog, 'Cancel').click();
        await expect(referenceDialog(page)).toHaveCount(0);
        await expect(user.locator('input')).toHaveValue(before);
    });

    test('lookup rows have no inline actions or actions popup', { annotation: [{ type: 'case', description: 'views.srd-no-inline-or-context' }] }, async ({ page }) => {
        const reference = await openAttributesReference(page);
        const { grid } = await browseReference(reference);
        const row = await rowForItem(grid, 1);

        await expect(row.locator('[part=actions]')).toBeHidden();

        const cell = (await row.locator('.column').nth(1).boundingBox())!;
        await page.mouse.click(cell.x + cell.width / 2, cell.y + cell.height / 2, { button: 'right' });
        await nextFrames(page, 3);

        expect(await grid.evaluate((g: any) => [...g.shadowRoot.children].filter((e: Element) => e.tagName === 'VI-POPUP').length)).toBe(0);
        await expect(row).not.toHaveAttribute('actions-open');
        await expect(referenceDialog(page)).toHaveCount(1);
    });
});

test.describe('Select reference dialog: screenshot', () => {
    test.skip(process.platform !== 'win32', 'Baselines exist for Windows only');

    test('lookup dialog screenshot', { annotation: [{ type: 'case', description: 'views.srd-screenshot' }] }, async ({ page }) => {
        const reference = await openAttributesReference(page);
        const { dialog } = await browseReference(reference);
        await expect(dialog.locator('vi-input-search')).toHaveAttribute('focused', '');
        await page.evaluate(() => document.fonts.ready);
        await page.mouse.move(0, 0);
        await nextFrames(page, 2);

        await expect(dialog.locator('dialog')).toHaveScreenshot('select-reference-dialog-reference.png', { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 });
    });
});

test.describe('Select reference dialog: selection', () => {
    test('selectors enforce a single selection and enable OK', { annotation: [{ type: 'case', description: 'views.srd-selector-max-one' }] }, async ({ page }) => {
        const reference = await openAttributesReference(page);
        const { dialog, grid } = await browseReference(reference);
        const ok = dialogButton(dialog, 'OK');
        const selectAll = grid.locator('vi-query-grid-select-all');

        await expect(ok).toHaveAttribute('disabled', '');

        const first = (await itemDisplay(grid, 0, []))!.id;
        const second = (await itemDisplay(grid, 1, []))!.id;

        await (await rowForItem(grid, 0)).locator('[part=selector]').click();
        await expect(ok).not.toHaveAttribute('disabled');
        await expect(selectAll).toHaveAttribute('partial', '');
        await expect(selectAll).toHaveAttribute('selected', '');
        expect(await selectedIds(grid)).toEqual([first]);

        await (await rowForItem(grid, 1)).locator('[part=selector]').click();
        await expect.poll(() => selectedIds(grid)).toEqual([second]);
        await expect(await rowForItem(grid, 1)).toHaveAttribute('selected', '');
        await expect(await rowForItem(grid, 0)).not.toHaveAttribute('selected');
        await expect(referenceDialog(page)).toHaveCount(1);
    });

    test('select-all in the lookup only clears', { annotation: [{ type: 'case', description: 'views.srd-select-all-clears' }] }, async ({ page }) => {
        const reference = await openAttributesReference(page);
        const { dialog, grid } = await browseReference(reference);
        const ok = dialogButton(dialog, 'OK');

        expect(await grid.evaluate((g: any) => g.query.maxSelectedItems)).toBe(1);
        // isAvailable is a boolean: false while maxSelectedItems limits the selection
        expect.soft(await grid.evaluate((g: any) => g.query.selectAll.isAvailable)).toBe(false);
        await expect(grid.locator('vi-query-grid-select-all')).not.toHaveAttribute('can-select-all');

        await (await rowForItem(grid, 0)).locator('[part=selector]').click();
        await expect(ok).not.toHaveAttribute('disabled');
        expect(await selectedIds(grid)).toHaveLength(1);

        await grid.locator('vi-query-grid-select-all').click();
        await expect.poll(() => selectedIds(grid)).toEqual([]);
        await expect(ok).toHaveAttribute('disabled', '');
        expect(await grid.evaluate((g: any) => g.query.selectAll.allSelected)).toBe(false);
        await expect(await rowForItem(grid, 0)).not.toHaveAttribute('selected');
        await expect(referenceDialog(page)).toHaveCount(1);
    });

    test('without maxSelectedItems 1 a row tap toggles selection instead of closing', { annotation: [{ type: 'case', description: 'views.srd-multi-select-toggle' }] }, async ({ page }) => {
        await openView(page, VIEWS.People);

        await page.evaluate(async () => {
            const w = window as any;
            const m = await import((document.querySelector('script[type=module]') as HTMLScriptElement).src);
            const app = document.querySelector('vi-app') as any;
            const query = await app.service.getQuery('PeopleTop10');
            w.__pwMax = query.maxSelectedItems ?? null;
            // Not awaited: the promise resolves when the dialog closes
            w.__pwResult = app.showDialog(new m.SelectReferenceDialog(query)).then((items: any[]) => items?.map(i => i.id) ?? null);
        });
        expect(await page.evaluate(() => (window as any).__pwMax)).not.toBe(1);

        const dialog = referenceDialog(page);
        const grid = dialog.locator('vi-query-grid');
        await grid.waitFor({ state: 'attached' });
        await waitForGridReady(grid);

        const ids = [(await itemDisplay(grid, 1, []))!.id, (await itemDisplay(grid, 3, []))!.id];
        for (const index of [1, 3])
            await (await rowForItem(grid, index)).locator('.column').nth(1).click();

        await expect(await rowForItem(grid, 1)).toHaveAttribute('selected', '');
        await expect(await rowForItem(grid, 3)).toHaveAttribute('selected', '');
        await expect(dialog).toHaveCount(1);
        expect((await selectedIds(grid)).sort()).toEqual([...ids].sort());

        // A second tap deselects
        await (await rowForItem(grid, 3)).locator('.column').nth(1).click();
        await expect(await rowForItem(grid, 3)).not.toHaveAttribute('selected');
        await (await rowForItem(grid, 3)).locator('.column').nth(1).click();
        await expect(await rowForItem(grid, 3)).toHaveAttribute('selected', '');

        await dialogButton(dialog, 'OK').click();
        await expect(referenceDialog(page)).toHaveCount(0);
        expect((await page.evaluate(() => (window as any).__pwResult) as string[]).sort()).toEqual([...ids].sort());
    });
});

test.describe('Select reference dialog: result', () => {
    test('OK closes the dialog and applies the selected reference', { annotation: [{ type: 'case', description: 'views.srd-ok-applies' }] }, async ({ page }) => {
        const reference = await openAttributesReference(page);
        const { dialog, grid } = await browseReference(reference);
        const name = await fullName(grid, 1);

        await (await rowForItem(grid, 1)).locator('[part=selector]').click();
        await dialogButton(dialog, 'OK').click();

        await expect(referenceDialog(page)).toHaveCount(0);
        // The input shows the reference's display value, which is the full name (not only the FirstName)
        await expect(reference.locator('input')).toHaveValue(name);
    });

    test('clicking a lookup row closes with that item and does not navigate', { annotation: [{ type: 'case', description: 'views.srd-row-tap-closes' }] }, async ({ page }) => {
        const reference = await openAttributesReference(page);
        const url = page.url();
        const { grid } = await browseReference(reference);
        const name = await fullName(grid, 2);

        await (await rowForItem(grid, 2)).locator('.column').nth(1).click();

        await expect(referenceDialog(page)).toHaveCount(0);
        await expect(reference.locator('input')).toHaveValue(name);
        expect(page.url()).toBe(url);
    });

    test('Cancel and Escape close without changes', { annotation: [{ type: 'case', description: 'views.srd-cancel-escape' }] }, async ({ page }) => {
        const reference = await openAttributesReference(page);
        const before = await reference.locator('input').inputValue();
        expect(before).toBe('Jonas Devos');

        for (const close of ['Cancel', 'Escape'] as const) {
            const { dialog, grid } = await browseReference(reference);
            await (await rowForItem(grid, 1)).locator('[part=selector]').click();

            if (close === 'Cancel')
                await dialogButton(dialog, 'Cancel').click();
            else
                await page.keyboard.press('Escape');

            await expect(referenceDialog(page), close).toHaveCount(0);
            await expect(reference.locator('input'), close).toHaveValue(before);
        }
    });
});

test.describe('Select reference dialog: search and browse', () => {
    test('dialog search filters the lookup and resets to the top', { annotation: [{ type: 'case', description: 'views.srd-search' }] }, async ({ page }) => {
        const { po, reference } = await openEmergencyContact(page);
        const { dialog, grid } = await browseReference(reference);

        const input = dialog.locator('vi-input-search input');
        await input.fill('Thomas');
        await input.press('Enter');

        await expect.poll(() => grid.evaluate((g: any) => [g.query.textSearch, g.query.totalItems])).toEqual(['Thomas', 123]);
        await waitForGridReady(grid);

        const rows = await visibleRows(grid);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.map(r => r.index)).toEqual(rows.map((_, i) => i));
        expect(rows.filter(r => !r.texts.join(' ').toLowerCase().includes('thomas')).map(r => r.texts.join(' | '))).toEqual([]);
        await expectAligned(grid, 'searched');

        await dialogButton(dialog, 'Cancel').click();
        await po.locator('vi-action-button[name=CancelEdit]').click();
    });

    test('browse clears textSearch and runs a fresh search', { annotation: [{ type: 'case', description: 'views.srd-browse-forces-search' }] }, async ({ page }) => {
        const reference = await openAttributesReference(page);
        await reference.evaluate((r: any) => r.attribute.lookup.textSearch = 'x');

        const log = requestLog(page);
        await log.quiet();
        log.clear();

        const { grid } = await browseReference(reference);
        await log.quiet();

        expect(await grid.evaluate((g: any) => g.query.textSearch)).toBe('');
        const searches = log.of('ExecuteQuery');
        expect(searches).toHaveLength(1);
        expect(searches[0].textSearch ?? '').toBe('');
        expect(await grid.evaluate((g: any) => g.query.totalItems)).toBe(10);
        expect((await visibleRows(grid)).length).toBe(10);
    });
});

test.describe('Select reference dialog: scrolling and reopen', () => {
    test('lookup grid scrolls to the last item', { annotation: [{ type: 'case', description: 'views.srd-scroll-bottom' }] }, async ({ page }) => {
        const { po, reference } = await openEmergencyContact(page);
        const { dialog, grid } = await browseReference(reference);
        const physical = await physicalRowCount(grid);

        await wheelGrid(page, grid, 0, 400000);
        await settle(grid);

        await expect.poll(async () => (await visibleRows(grid)).at(-1)!.index).toBe(9999);
        const last = (await visibleRows(grid)).at(-1)!;
        expect(last.texts.slice(0, 2)).toEqual((await itemDisplay(grid, 9999, ['FirstName', 'LastName']))!.values);

        const gridBox = await box(grid);
        expect(Math.abs((await rowBoxes(grid)).at(-1)!.bottom - (gridBox.y + gridBox.height))).toBeLessThanOrEqual(1);
        expect(await physicalRowCount(grid)).toBe(physical);
        await expectAligned(grid, 'bottom');

        await dialogButton(dialog, 'Cancel').click();
        await po.locator('vi-action-button[name=CancelEdit]').click();
    });

    test('reopening the dialog starts at the top', { annotation: [{ type: 'case', description: 'views.srd-reopen-top' }] }, async ({ page }) => {
        const { po, reference } = await openEmergencyContact(page);
        let { dialog, grid } = await browseReference(reference);

        await wheelGrid(page, grid, 0, 100 * await rowHeight(grid));
        await settle(grid);
        expect((await visibleRows(grid))[0].index).toBeGreaterThan(0);

        await dialogButton(dialog, 'Cancel').click();
        await expect(referenceDialog(page)).toHaveCount(0);

        ({ dialog, grid } = await browseReference(reference));
        await settle(grid);
        expect((await getScrollOffset(grid)).top).toBe(0);
        expect((await visibleRows(grid))[0].index).toBe(0);

        await dialogButton(dialog, 'Cancel').click();
        await po.locator('vi-action-button[name=CancelEdit]').click();
    });
});

test.describe('Select reference dialog: initialization contract', () => {
    for (const variant of ['Reference', 'EmergencyContact'] as const) {
        test(`lookup grid initializes once and the search box then takes focus (${variant})`, { annotation: [{ type: 'case', description: 'views.srd-initializing-contract' }] }, async ({ page }) => {
            const opened = variant === 'Reference' ? { reference: await openAttributesReference(page), po: null } : await openEmergencyContact(page);

            await startSampler(page);
            const { dialog, grid } = await browseReference(opened.reference);
            const search = dialog.locator('vi-input-search');
            await expect(search).toBeVisible();
            await expect(search).toHaveAttribute('focused', '');
            const samples = await stopSampler(page);

            expect(samples.length).toBeGreaterThan(0);
            expect(samples[0].initializing).toBe(true);
            const cleared = samples.findIndex(s => !s.initializing);
            expect(cleared).toBeGreaterThan(0);
            expect(samples.slice(cleared).filter(s => s.initializing)).toEqual([]);
            expect(samples.slice(0, cleared).filter(s => !s.searchHidden)).toEqual([]);

            expect((await deepActiveElement(page)).at(-1)).toBe('input');
            await page.keyboard.type('abc');
            await expect(search.locator('input')).toHaveValue('abc');

            const narrow = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')]
                .map((h: any) => ({ name: h.getAttribute('name'), width: h.getBoundingClientRect().width, label: h.shadowRoot.querySelector('label').scrollWidth }))
                .filter(h => h.width < h.label));
            expect(narrow).toEqual([]);

            await dialogButton(dialog, 'Cancel').click();
            if (opened.po)
                await opened.po.locator('vi-action-button[name=CancelEdit]').click();
        });
    }
});

test.describe('Select reference dialog: unknown total', () => {
    test('a continuation lookup pages on scroll, selects past page 1 and shows the open count', { annotation: [{ type: 'case', description: 'views.srd-continuation' }] }, async ({ page }) => {
        await openView(page, VIEWS.People);
        const log = requestLog(page);

        await page.evaluate(async () => {
            const w = window as any;
            const m = await import((document.querySelector('script[type=module]') as HTMLScriptElement).src);
            const app = document.querySelector('vi-app') as any;
            const query = await app.service.getQuery('QueryGrid_Continuation');
            // Not awaited: the promise resolves when the dialog closes
            w.__pwResult = app.showDialog(new m.SelectReferenceDialog(query)).then((items: any[]) => items?.map(i => i.id) ?? null);
        });

        const dialog = referenceDialog(page);
        const grid = dialog.locator('vi-query-grid');
        await grid.waitFor({ state: 'attached' });
        await waitForGridReady(grid);
        await log.quiet();

        const tokens = () => log.of('ExecuteQuery').map(r => r.body?.query?.continuation).filter(Boolean);
        await expect(dialog.locator('h4')).toHaveText('100+ Continuation (unknown total)');
        expect(tokens()).toEqual([]);

        // Scrolling past row 100 sends the next token once
        const rh = await rowHeight(grid);
        await wheelGrid(page, grid, 0, 110 * rh);
        await expect.poll(tokens).toEqual(['offset:100']);
        await log.quiet();
        await settle(grid);
        await expect(dialog.locator('h4')).toHaveText('200+ Continuation (unknown total)');

        await wheelGrid(page, grid, 0, 40 * rh);
        await settle(grid);
        await log.quiet();
        expect(tokens()).toEqual(['offset:100']);

        const item = (await itemDisplay(grid, 146, ['Code']))!;
        expect(item.values).toEqual(['Row 0147']);
        // The row sits below the viewport: scrolling it in as part of the click lets the grid hand its element to another item first
        await (await rowForItem(grid, 146)).scrollIntoViewIfNeeded();
        await settle(grid);
        const row = await rowForItem(grid, 146);
        await expect(row).toBeInViewport({ ratio: 1 });
        await row.locator('[part=selector]').click();
        await expect.poll(() => selectedIds(grid)).toEqual([item.id]);

        await dialogButton(dialog, 'OK').click();
        await expect(referenceDialog(page)).toHaveCount(0);
        expect(await page.evaluate(() => (window as any).__pwResult)).toEqual([item.id]);
        expect(tokens()).toEqual(['offset:100']);
    });
});

test.describe('Select reference dialog: Add on a detail query', () => {
    test('select-all with one unticked row adds every other lookup row, also the ones never loaded', { annotation: [{ type: 'case', description: 'views.srd-add-select-all' }] }, async ({ page }) => {
        test.setTimeout(90000);

        // Person_Addresses has a lookup over the addresses of the other people (dev AddressActions). The added addresses stay:
        // a ResetTest here would also reset the data and saved filters under the other workers, so each run takes a person nothing was added to
        await openView(page, VIEWS.People);
        const personId = await page.evaluate(async () => {
            const app = document.querySelector('vi-app') as any;
            // Below 1000 are the people other specs open
            for (let id = 1000 + Math.floor(Math.random() * 8998), tries = 0; tries < 100; id = id >= 9998 ? 1000 : id + 1, tries++) {
                const person = await app.service.getPersistentObject(null, 'Person', String(id));
                const addresses = person.queries.find((q: any) => q.name === 'Person_Addresses');
                await addresses.search();

                // A person has 1 to 3 addresses of their own
                if (addresses.totalItems <= 3)
                    return id;
            }

            return null;
        });
        expect(personId, 'a person nothing was added to').not.toBeNull();

        const grid = await openView(page, `home/person/${personId}`);
        expect(await grid.evaluate((g: any) => g.query.name)).toBe('Person_Addresses');
        const before = await grid.evaluate((g: any) => g.query.totalItems);

        // Not awaited: the action resolves when the dialog closes and the references are added
        await grid.evaluate((g: any) => { g.query.actions.find((a: any) => a.name === 'AddReference').execute(); });

        const dialog = referenceDialog(page);
        const lookup = dialog.locator('vi-query-grid');
        await lookup.waitFor({ state: 'attached' });
        await waitForGridReady(lookup);

        const { total, loaded } = await lookup.evaluate((g: any) => ({ total: g.query.totalItems, loaded: g.query.items.filter((i: any) => i).length }));
        expect(loaded).toBeLessThan(total - 1);

        await lookup.locator('vi-query-grid-select-all').click();
        await expect.poll(() => lookup.evaluate((g: any) => g.query.selectAll.allSelected)).toBe(true);

        const unticked = (await itemDisplay(lookup, 0, []))!.id;
        await (await rowForItem(lookup, 0)).locator('[part=selector]').click();
        await expect.poll(() => lookup.evaluate((g: any) => g.query.selectAll.inverse)).toBe(true);

        const log = requestLog(page);
        await dialogButton(dialog, 'OK').click();
        await expect(referenceDialog(page)).toHaveCount(0);

        // The dialog's query goes along with its select-all and only the unticked row, to skip
        await expect.poll(() => log.of('ExecuteAction').filter(r => r.action === 'Query.AddReference').length).toBe(1);
        const sent = log.of('ExecuteAction').find(r => r.action === 'Query.AddReference')!.body;
        expect({ allSelected: sent.query.allSelected, allSelectedInversed: sent.query.allSelectedInversed, selectedIds: sent.selectedItems.map((i: any) => i.id) })
            .toEqual({ allSelected: true, allSelectedInversed: true, selectedIds: [unticked] });

        // Every lookup row but the unticked one is added
        await expect.poll(() => grid.evaluate((g: any) => !g.query.isBusy && g.query.totalItems), { timeout: 30000 }).toBe(before + total - 1);
    });
});

test.describe('Select reference dialog: Add Query to a program unit', () => {
    /** Opens the menu's queries dialog with `open`, selects all, unticks the first row and returns the request it sends and that row's id. */
    async function addQueriesSelectAllButOne(page: Page, open: () => Promise<void>) {
        await openView(page, VIEWS.People);

        // Adding queries would change the dev program units, the request is only recorded
        let sent: any = null;
        await page.route('**/ExecuteAction', async route => {
            const body = route.request().postDataJSON();
            if (body?.action !== 'System.AddQueriesToProgramUnit')
                return route.continue();

            sent = body;
            await route.fulfill({ json: {} });
        });

        await open();

        const dialog = referenceDialog(page);
        const lookup = dialog.locator('vi-query-grid');
        await lookup.waitFor({ state: 'attached' });
        await waitForGridReady(lookup);
        const total = await lookup.evaluate((g: any) => g.query.totalItems);
        expect(total).toBeGreaterThan(1);

        await lookup.locator('vi-query-grid-select-all').click();
        await expect.poll(() => lookup.evaluate((g: any) => g.query.selectAll.allSelected)).toBe(true);

        const unticked = (await itemDisplay(lookup, 0, []))!.id;
        await (await rowForItem(lookup, 0)).locator('[part=selector]').click();
        await expect.poll(() => lookup.evaluate((g: any) => g.query.selectAll.inverse)).toBe(true);

        await dialogButton(dialog, 'OK').click();
        await expect.poll(() => sent, { timeout: 15000 }).not.toBeNull();

        // The menu reloads the page after the request, the reload's requests must not reach the route once the test ends
        await page.unrouteAll({ behavior: 'ignoreErrors' });

        return { sent, unticked };
    }

    // With select-all the service skips the sent rows (UpdateSelectedItemsAsync, as the TestCount specs show)
    const skipOnly = (unticked: string) => ({ allSelected: true, allSelectedInversed: true, selectedIds: [unticked] });
    const request = (sent: any) => ({ allSelected: sent.query.allSelected, allSelectedInversed: sent.query.allSelectedInversed, selectedIds: sent.selectedItems.map((i: any) => i.id) });

    test('"+ Add menu item" with select-all and one unticked row sends that row to skip', { annotation: [{ type: 'case', description: 'views.srd-add-menu-item-select-all' }] }, async ({ page }) => {
        const { sent, unticked } = await addQueriesSelectAllButOne(page, () => page.locator('vi-menu').evaluate((m: any) => { m._add(new CustomEvent('tap')); }));
        expect(request(sent)).toEqual(skipOnly(unticked));
    });

    test('a program unit\'s "Add Query" with select-all and one unticked row sends that row to skip', { annotation: [{ type: 'case', description: 'views.srd-add-query-select-all' }] }, async ({ page }) => {
        const { sent, unticked } = await addQueriesSelectAllButOne(page, () => page.locator('vi-menu-program-unit').first().evaluate((unit: HTMLElement) => {
            // The program unit's configure menu (Ctrl+right-click): "Program unit: …" › "Add Query". The contextmenu
            // doesn't bubble, so only the program unit sees it and the app opens no popup.
            let actions: any[] = [];
            unit.addEventListener('vi:configure', (e: any) => actions = e.detail, { once: true });
            unit.dispatchEvent(new MouseEvent('contextmenu', { ctrlKey: true, button: 2, composed: true }));
            actions[0].subActions.find((a: any) => a.label === 'Add Query').action();
        }));
        expect(request(sent)).toEqual(skipOnly(unticked));
    });
});
