import { expect, Locator, Page, test } from '@playwright/test';
import { gridPage, headerNames, mountGrid, nextFrames, openView, pageErrors, requestLog, scrollGrid, visibleRows, waitForGridReady, getScrollOffset, VIEWS } from '../_helpers/query-grid';
import { boxes, contextMenuEvents, contextPopup, contextPopupCount, deepHitChain, deepPopupCount, groupRowOf, holdPageLoads, mountPrepared, opens, patchItemHints, recordContextMenu, rowHeight, rowOf, rows, scrollToRow, scrollToRowAndWait, selectAllState, selectedIndexes, setSelected, spyTapAndOpen, swapQuery, taps } from '../_helpers/rows';

const case_ = (id: string) => ({ annotation: [{ type: 'case', description: id }] });

test.describe('vi-query-grid-row: item rendering', () => {
    test('renders one cell per column with the item\'s formatted values', case_('rows.row-item-cells-values'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const row = await rowOf(grid, 0);
        await expect(row.locator('.column')).toHaveCount(9);

        const expected = await page.evaluate(() => {
            const w = window as any;
            const q = w.q;
            q.disableLazyLoading = true;
            try {
                const item = q.items[0];
                const culture = w.Vidyano.CultureInfo.currentCulture;
                return q.columns.filter((c: any) => !c.isHidden).map((c: any) => {
                    const value = item.getValue(c.name);
                    if (value == null)
                        return { name: c.name, text: '' };

                    if (c.type === 'Boolean')
                        return { name: c.name, text: '', checked: !!value };

                    if (c.type === 'Date')
                        return { name: c.name, text: value.localeFormat(culture.dateFormat.shortDatePattern, true) };

                    return { name: c.name, text: String(value) };
                });
            }
            finally {
                q.disableLazyLoading = false;
            }
        });

        expect(expected.map(e => e.name)).toEqual(await headerNames(grid));

        const [first] = await visibleRows(grid);
        expect(first.index).toBe(0);
        expect(first.texts).toEqual(expected.map(e => e.text));
        expect(first.texts.slice(0, 2)).toEqual(['Aaron', 'Lemmens']);

        // The boolean cell shows its value as a checked/unchecked icon
        const isActive = expected.find(e => e.name === 'IsActive')!;
        const icon = row.locator('vi-query-grid-cell-boolean vi-icon');
        if (isActive.checked)
            await expect(icon).toHaveAttribute('is-selected', '');
        else
            await expect(icon).not.toHaveAttribute('is-selected', '');
    });

    test('row state classes for item, loading and past-end rows', case_('rows.row-item-state-classes'), async ({ page }) => {
        await gridPage(page);
        const held = await holdPageLoads(page);
        const grid = await mountGrid(page);

        const itemRows = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
            .filter((r: any) => r.item instanceof (window as any).Vidyano.QueryResultItem)
            .map((r: any) => ({ loading: r.classList.contains('loading'), hidden: r.classList.contains('hidden'), isGroup: r.hasAttribute('is-group'), display: getComputedStyle(r).display })));
        expect(itemRows.length).toBeGreaterThan(10);
        for (const r of itemRows)
            expect(r).toEqual({ loading: false, hidden: false, isGroup: false, display: 'grid' });

        // A page that is still loading shows its rows as placeholders with the loading class
        await scrollToRow(grid, 5000);
        await expect.poll(() => held.count).toBeGreaterThan(0);
        await expect.poll(() => grid.evaluate((g: any) => {
            const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
            const view = scroller.getBoundingClientRect();
            const inView = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => {
                const b = r.getBoundingClientRect();
                return b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1;
            });

            return inView.length > 0 && inView.every((r: any) => r.classList.contains('loading'));
        })).toBe(true);

        await held.release();
        await waitForGridReady(grid);
        const loaded = await visibleRows(grid);
        expect(loaded.length).toBeGreaterThan(10);
        expect(loaded.every(r => r.index >= 4990)).toBe(true);
        await expect.poll(() => grid.evaluate((g: any) => {
            const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
            const view = scroller.getBoundingClientRect();
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].some((r: any) => {
                const b = r.getBoundingClientRect();
                return b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1 && r.classList.contains('loading');
            });
        })).toBe(false);
    });

    test('rows past the last item of a short query are hidden', case_('rows.row-item-state-classes'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        const state = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].map((r: any) => ({
            hasItem: !!r.item,
            hidden: r.classList.contains('hidden'),
            display: getComputedStyle(r).display
        })));

        const shown = state.filter(s => s.hasItem);
        const pastEnd = state.filter(s => !s.hasItem);
        expect(shown).toHaveLength(10);
        expect(pastEnd.length).toBeGreaterThan(0);
        for (const s of shown)
            expect(s).toEqual({ hasItem: true, hidden: false, display: 'grid' });

        for (const s of pastEnd)
            expect(s).toEqual({ hasItem: false, hidden: true, display: 'none' });

        expect((await visibleRows(grid)).map(r => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    test('group items render as a full group header row', case_('rows.row-group-item-state'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await page.evaluate(async () => { await (window as any).q.group('BirthDate'); });
        await waitForGridReady(grid);

        const header = await groupRowOf(grid, 0);
        await expect(header).toHaveAttribute('is-group', '');
        await expect(header.locator('vi-query-grid-row-group')).toBeVisible();

        const display = await header.evaluate((r: any) => ({
            cells: [...r.querySelectorAll('.column')].map((c: Element) => getComputedStyle(c).display),
            selector: getComputedStyle(r.shadowRoot.querySelector('[part=selector]')).display,
            actions: getComputedStyle(r.shadowRoot.querySelector('[part=actions]')).display,
            groupspacer: getComputedStyle(r.shadowRoot.querySelector('[part=groupspacer]')).display,
            filter: getComputedStyle(r.shadowRoot.querySelector('[part=filter]')).display
        }));
        expect(display.cells.length).toBe(9);
        expect(display.cells.every(d => d === 'none')).toBe(true);
        expect(display.selector).toBe('none');
        expect(display.actions).toBe('none');

        const [, second] = await visibleRows(grid);
        expect(second.isGroup).toBe(false);
        expect(second.index).toBe(0);
        const expected = await page.evaluate(() => {
            const q = (window as any).q;
            q.disableLazyLoading = true;
            try {
                return [q.items[0].getValue('FirstName'), q.items[0].getValue('LastName')];
            }
            finally {
                q.disableLazyLoading = false;
            }
        });
        expect(second.texts.slice(0, 2)).toEqual(expected);
        const itemRow = await rowOf(grid, 0);
        await expect(itemRow).not.toHaveAttribute('is-group', '');

        // The grid's [has-grouping] ::part(groupspacer) { display: block } rule must not beat the row's own
        // [is-group] .pinned { display: none }: group header rows hide the group spacer, item rows keep it
        expect(display.groupspacer).toBe('none');
        expect(display.filter).toBe('none');
        expect(await itemRow.evaluate((r: any) => getComputedStyle(r.shadowRoot.querySelector('[part=groupspacer]')).display)).toBe('block');
    });

    test('visible rows never show stale cells after scrolling down and back up', case_('rows.row-cell-values-after-scroll'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const names = await headerNames(grid);
        const columns = ['FirstName', 'LastName', 'Email'].map(c => names.indexOf(c));
        expect(columns.every(c => c >= 0)).toBe(true);

        await scrollToRowAndWait(grid, 2000);
        await scrollToRowAndWait(grid, 37);

        const visible = await visibleRows(grid);
        expect(visible.length).toBeGreaterThan(10);
        expect(visible[0].index).toBe(37);

        const values = await page.evaluate(indexes => {
            const q = (window as any).q;
            q.disableLazyLoading = true;
            try {
                return indexes.map(i => ['FirstName', 'LastName', 'Email'].map(c => q.items[i]?.getValue(c) ?? null));
            }
            finally {
                q.disableLazyLoading = false;
            }
        }, visible.map(r => r.index));

        visible.forEach((row, i) => {
            expect(row.index, `row ${i} is contiguous`).toBe(visible[0].index + i);
            expect(columns.map(c => row.texts[c]), `row ${i} shows its item`).toEqual(values[i]);
        });
    });

    test('a row switches cleanly between group header and item', case_('rows.row-group-item-recycle'), async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page);
        const grid = await mountGrid(page);
        await page.evaluate(async () => { await (window as any).q.group('BirthDate'); });
        await waitForGridReady(grid);

        const consistent = () => grid.evaluate((g: any) => {
            const q = g.query;
            const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
            const view = scroller.getBoundingClientRect();
            const visible = (e: Element | null) => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0;
            const text = (cell: Element) => {
                const walker = document.createTreeWalker(cell.shadowRoot ?? cell, NodeFilter.SHOW_TEXT);
                let result = '';
                for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                    if (!node.parentElement?.closest('style'))
                        result += node.textContent;
                }

                return result.trim();
            };
            const problems: string[] = [];
            let count = 0;

            q.disableLazyLoading = true;
            try {
                for (const r of [...g.shadowRoot.querySelectorAll('vi-query-grid-row')] as any[]) {
                    const b = r.getBoundingClientRect();
                    if (getComputedStyle(r).display === 'none' || b.height === 0 || b.bottom <= view.top + 1 || b.top >= view.bottom - 1)
                        continue;

                    count++;
                    const groupElement = r.querySelector('vi-query-grid-row-group');
                    const cells = [...r.querySelectorAll('.column')];
                    if (r.hasAttribute('is-group')) {
                        const label = groupElement?.shadowRoot?.querySelector('label');
                        const expected = `${r.item.name} (${r.item.items.length})`;
                        if (!visible(groupElement) || label?.textContent.trim() !== expected)
                            problems.push(`group row without label ${expected}`);

                        if (cells.some(visible))
                            problems.push(`group row ${expected} shows cells`);
                    }
                    else {
                        if (visible(groupElement))
                            problems.push('item row shows a group header');

                        const expected = ['FirstName', 'LastName'].map(c => r.item?.getValue?.(c) ?? '');
                        const actual = cells.slice(0, 2).map(text);
                        if (expected.join('|') !== actual.join('|'))
                            problems.push(`item row shows ${actual.join(' ')} instead of ${expected.join(' ')}`);
                    }
                }
            }
            finally {
                q.disableLazyLoading = false;
            }

            return count > 0 ? problems : ['no visible rows'];
        });

        // Mark the element that shows q.items[0] (row 1, right below the first group header)
        const marked = await rowOf(grid, 0);
        await marked.evaluate((r: any) => r.__marker = true);
        const markedRow = () => grid.evaluate((g: any) => {
            const r = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].find((r: any) => r.__marker) as any;
            if (!r)
                return null;

            const groupElement = r.querySelector('vi-query-grid-row-group');
            return {
                isGroup: r.hasAttribute('is-group'),
                label: groupElement && getComputedStyle(groupElement).display !== 'none' ? groupElement.shadowRoot.querySelector('label').textContent.trim() : null,
                cellsVisible: [...r.querySelectorAll('.column')].some((c: Element) => getComputedStyle(c).display !== 'none')
            };
        });

        await (await groupRowOf(grid, 0)).locator('vi-query-grid-row-group').click();
        await expect.poll(markedRow).toEqual({ isGroup: true, label: '1946 (184)', cellsVisible: false });
        await waitForGridReady(grid);
        expect(await consistent()).toEqual([]);

        await (await groupRowOf(grid, 0)).locator('vi-query-grid-row-group').click();
        await expect.poll(markedRow).toEqual({ isGroup: false, label: null, cellsVisible: true });
        await waitForGridReady(grid);
        expect(await consistent()).toEqual([]);
        expect((await visibleRows(grid))[1].index).toBe(0);

        // Across group boundaries, both ways
        for (const index of [160, 345, 530, 340, 150, 0]) {
            await scrollToRowAndWaitGrouped(index);
            expect(await consistent(), `at row ${index}`).toEqual([]);
        }

        expect(errors).toEqual([]);

        async function scrollToRowAndWaitGrouped(index: number) {
            await scrollToRow(grid, index);
            await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(index * await rowHeight(grid));
            await waitForGridReady(grid);
        }
    });
});

test.describe('vi-query-grid-row: pinned controls', () => {
    test('selector and actions stay in place on horizontal scroll', case_('rows.row-pinned-controls-fixed'), async ({ page }) => {
        await gridPage(page, { width: 600 });
        const grid = await mountGrid(page);

        const offset = await getScrollOffset(grid);
        expect(offset.scrollWidth).toBeGreaterThan(offset.width + 200);

        const measure = async () => {
            const result: { selector: number[]; actions: number[]; cells: number[] } = { selector: [], actions: [], cells: [] };
            for (let i = 0; i < 4; i++) {
                const row = await rowOf(grid, i);
                result.selector.push((await boxes(row.locator('[part=selector]')))[0].x);
                result.actions.push((await boxes(row.locator('[part=actions]')))[0].x);
                result.cells.push(...(await boxes(row.locator('.column'))).map(b => b.x));
            }

            return result;
        };

        const before = await measure();

        const body = (await grid.boundingBox())!;
        await page.mouse.move(body.x + body.width / 2, body.y + body.height / 2);
        await page.mouse.wheel(200, 0);
        await expect.poll(async () => (await getScrollOffset(grid)).left).toBe(200);
        await expect.poll(async () => (await measure()).cells[0]).toBeCloseTo(before.cells[0] - 200, 0);

        const after = await measure();
        after.selector.forEach((x, i) => expect(x).toBeCloseTo(before.selector[i], 0));
        after.actions.forEach((x, i) => expect(x).toBeCloseTo(before.actions[i], 0));
        after.cells.forEach((x, i) => expect(Math.abs(x - (before.cells[i] - 200)), `cell ${i}`).toBeLessThanOrEqual(1));
    });
});

test.describe('vi-query-grid-row: selection', () => {
    test('item.isSelected is reflected on the row and its selector icon', case_('rows.row-selected-reflects-model'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const row = await rowOf(grid, 2);
        const icon = row.locator('[part=selector] vi-icon');

        await setSelected(grid, 2, true);
        await expect(row).toHaveAttribute('selected', '');
        await expect(icon).toHaveAttribute('is-selected', '');
        expect((await visibleRows(grid)).filter(r => r.selected).map(r => r.index)).toEqual([2]);

        await setSelected(grid, 2, false);
        await expect(row).not.toHaveAttribute('selected', '');
        await expect(icon).not.toHaveAttribute('is-selected', '');
        expect((await visibleRows(grid)).filter(r => r.selected)).toEqual([]);
    });

    test('selector clicks do not open the item', case_('rows.row-selector-no-open'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await spyTapAndOpen(page);
        const log = requestLog(page);

        await (await rowOf(grid, 0)).locator('[part=selector]').click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([0]);

        // Opening is async (GetPersistentObject first), so let the network settle to prove nothing was requested
        await log.quiet(300);
        expect(await taps(page)).toEqual([]);
        expect(await opens(page)).toEqual([]);
        expect(log.of('GetPersistentObject')).toEqual([]);
    });

    test('selection follows the item, not the row element', case_('rows.row-selection-survives-recycling'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const rowA = await rowOf(grid, 0);
        await rowA.evaluate((r: any) => r.__marker = true);
        await rowA.locator('[part=selector]').click();
        await expect(rowA).toHaveAttribute('selected', '');

        await scrollToRowAndWait(grid, 1000);
        expect((await visibleRows(grid)).filter(r => r.selected)).toEqual([]);

        // The element that showed A now shows another item B; toggling A off-screen must not touch it
        const markedState = () => grid.evaluate((g: any) => {
            const r = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].find((r: any) => r.__marker) as any;
            return r ? { email: r.item?.getValue?.('Email') ?? null, selected: r.hasAttribute('selected') } : null;
        });
        const b = await markedState();
        expect(b).not.toBeNull();
        expect(b!.email).not.toBeNull();
        expect(b!.email).not.toBe('Aaron_Lemmens59@skynet.be');
        expect(b!.selected).toBe(false);

        await setSelected(grid, 0, false);
        await expect.poll(() => selectedIndexes(grid)).toEqual([]);
        expect(await markedState()).toEqual(b);

        await setSelected(grid, 0, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([0]);
        await waitForGridReady(grid);
        expect((await visibleRows(grid)).filter(r => r.selected)).toEqual([]);
        expect(await markedState()).toEqual(b);

        await scrollToRowAndWait(grid, 0);
        expect((await visibleRows(grid)).filter(r => r.selected).map(r => r.index)).toEqual([0]);
    });
});

test.describe('vi-query-grid-row: opening items', () => {
    test('clicking a readable row opens its persistent object', case_('rows.row-open-bare'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await spyTapAndOpen(page);
        const log = requestLog(page);

        await (await rowOf(grid, 0)).locator('.column').first().click();
        await expect.poll(() => opens(page)).toHaveLength(1);
        expect((await opens(page))[0]).toMatchObject({ objectId: '3', ownerIsQ: true });
        expect(await taps(page)).toEqual(['3']);
        expect(log.of('GetPersistentObject')).toHaveLength(1);
    });

    for (const asLookup of [true, false]) {
        test(`lookup queries fire item-tap but never open (grid.asLookup ${asLookup})`, case_('rows.row-open-aslookup-query'), async ({ page }) => {
            await gridPage(page);
            const grid = await mountGrid(page, { queryOptions: { asLookup: true }, props: { asLookup } });
            await spyTapAndOpen(page);
            const log = requestLog(page);

            await (await rowOf(grid, 0)).locator('.column').first().click();
            await expect.poll(() => taps(page)).toEqual(['3']);

            // Opening is async (GetPersistentObject first), so let the network settle to prove nothing was requested
            await log.quiet(300);
            expect(await opens(page)).toEqual([]);
            expect(log.of('GetPersistentObject')).toEqual([]);
        });
    }

    test('clicking the inline-actions trigger does not open the item', case_('rows.row-open-ellipsis-no-tap'), async ({ page }) => {
        await gridPage(page);
        // Safety net: no action may reach the backend from this test
        await page.route(/\/ExecuteAction$/, route => route.abort());
        const grid = await mountGrid(page);
        await spyTapAndOpen(page);
        const log = requestLog(page);

        const row = await rowOf(grid, 0);
        await row.locator('[part=actions]').click();
        await expect(row.locator('vi-popup[part=actions]')).toHaveAttribute('open', '');

        await page.evaluate(() => (window as any).q.actions.find((a: any) => a.name === 'BulkEdit').canExecute = false);
        const button = row.locator('vi-popup[part=actions] > vi-action-button[name=BulkEdit]');
        await expect(button).toHaveAttribute('disabled', '');
        await button.click();

        // Opening is async (GetPersistentObject first), so let the network settle to prove nothing was requested
        await log.quiet(300);
        expect(await taps(page)).toEqual([]);
        expect(await opens(page)).toEqual([]);
        expect(log.of('GetPersistentObject')).toEqual([]);
        expect(log.of('ExecuteAction')).toEqual([]);
    });
});

test.describe('vi-query-grid-row: inline actions', () => {
    const openActions = async (grid: any, index: number) => {
        const row = await rowOf(grid, index);
        await row.locator('[part=actions]').click();
        const popup = row.locator('vi-popup[part=actions]');
        await expect(popup).toHaveAttribute('open', '');
        return { row, popup };
    };

    test('the ellipsis opens a popup of overflow action buttons', case_('rows.row-actions-open'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const { row, popup } = await openActions(grid, 0);
        await expect(row).toHaveAttribute('actions-open', '');

        const buttons = popup.locator(':scope > vi-action-button');
        await expect(buttons).toHaveCount(3);
        await expect(buttons.first()).toBeVisible();
        const missing = await buttons.evaluateAll(els => els.map(e => ['overflow', 'force-label', 'inverse', 'open-on-hover'].filter(a => !e.hasAttribute(a))));
        expect(missing).toEqual([[], [], []]);
    });

    test('lists visible single-item actions, groups once', case_('rows.row-actions-list-people'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const { popup } = await openActions(grid, 0);
        const buttons = popup.locator(':scope > vi-action-button');
        await expect(buttons).toHaveCount(3);

        const list = await buttons.evaluateAll(els => els.map(e => ({
            name: e.getAttribute('name'),
            isGroup: e.hasAttribute('is-group'),
            label: (e.shadowRoot?.querySelector('.label')?.textContent ?? '').trim()
        })));
        expect(list).toEqual([
            { name: 'BulkEdit', isGroup: false, label: 'Edit' },
            { name: 'Delete', isGroup: false, label: 'Delete' },
            { name: 'TestActionsGroup', isGroup: true, label: 'Test actions' }
        ]);
    });

    test('opening inline actions selects the row exclusively', case_('rows.row-actions-selects-row'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await setSelected(grid, 3, true);
        await setSelected(grid, 5, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([3, 5]);

        await openActions(grid, 1);
        await expect.poll(() => selectedIndexes(grid)).toEqual([1]);
        await expect(await rowOf(grid, 3)).not.toHaveAttribute('selected', '');
        await expect(await rowOf(grid, 5)).not.toHaveAttribute('selected', '');

        await page.keyboard.press('Escape');
        await expect((await rowOf(grid, 1)).locator('vi-popup[part=actions]')).not.toHaveAttribute('open', '');
        expect(await selectedIndexes(grid)).toEqual([1]);
    });

    test('opening inline actions on a row excluded from select-all resets select-all', case_('rows.row-actions-selects-row'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        // Select all, then deselect row 1 (inverse state): row 1 is the only loaded row outside the selection
        await grid.locator('vi-query-grid-select-all').click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);
        await (await rowOf(grid, 1)).locator('[part=selector]').click();
        await expect.poll(async () => (await selectAllState(grid)).inverse).toBe(true);

        await openActions(grid, 1);
        await expect.poll(() => selectedIndexes(grid)).toEqual([1]);
        expect(await selectAllState(grid)).toMatchObject({ allSelected: false, inverse: false, selectedItems: 1, selectedItemCount: 1 });
    });

    test('opening inline actions on a row inside select-all keeps select-all', case_('rows.row-actions-selects-row'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await grid.locator('vi-query-grid-select-all').click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);
        const before = await selectAllState(grid);

        // The row is already selected (select-all selects every loaded item), so opening leaves the selection alone
        await openActions(grid, 1);
        expect(await selectAllState(grid)).toEqual(before);
        expect(before).toMatchObject({ allSelected: true, inverse: false, selectedItemCount: 10000 });
    });

    test('reopening shows each button exactly once', case_('rows.row-actions-reopen-no-duplicates'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const { popup } = await openActions(grid, 0);
        await expect(popup.locator(':scope > vi-action-button')).toHaveCount(3);

        await page.keyboard.press('Escape');
        await expect(popup).not.toHaveAttribute('open', '');

        await openActions(grid, 0);
        await expect(popup.locator(':scope > vi-action-button')).toHaveCount(3);
        const names = await popup.locator(':scope > vi-action-button').evaluateAll(els => els.map(e => e.getAttribute('name')));
        expect(new Set(names).size).toBe(3);
    });
});

test.describe('vi-query-grid-row: context menu', () => {
    test('right-click opens the actions menu and suppresses the native menu', case_('rows.row-ctx-opens'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await page.evaluate(() => {
            const w = window as any;
            w.__contextmenu = [];
            document.addEventListener('contextmenu', e => w.__contextmenu.push(e.defaultPrevented));
        });

        const row = await rowOf(grid, 1);
        await row.locator('.column').first().click({ button: 'right' });

        expect(await page.evaluate(() => (window as any).__contextmenu)).toEqual([true]);

        const popup = grid.locator('vi-popup[open]:not([part=actions])');
        await expect(popup).toHaveCount(1);
        await expect(row.locator('vi-popup[part=actions]')).not.toHaveAttribute('open', '');
        expect(await popup.locator(':scope > vi-action-button').evaluateAll(els => els.map(e => e.getAttribute('name')))).toEqual(['BulkEdit', 'Delete', 'TestActionsGroup']);
        await expect(row).toHaveAttribute('actions-open', '');
    });

    test('right-click selects the row unless it is already selected', case_('rows.row-ctx-selects-row'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await (await rowOf(grid, 4)).locator('.column').first().click({ button: 'right' });
        await expect.poll(() => selectedIndexes(grid)).toEqual([4]);
        await expect(await rowOf(grid, 4)).toHaveAttribute('selected', '');
        await page.keyboard.press('Escape');
        await expect(grid.locator('vi-popup[open]')).toHaveCount(0);

        await page.evaluate(() => (window as any).q.selectedItems = []);
        await setSelected(grid, 1, true);
        await setSelected(grid, 2, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([1, 2]);

        await (await rowOf(grid, 2)).locator('.column').first().click({ button: 'right' });
        await expect(grid.locator('vi-popup[open]:not([part=actions])')).toHaveCount(1);
        expect(await selectedIndexes(grid)).toEqual([1, 2]);
        await expect(await rowOf(grid, 1)).toHaveAttribute('selected', '');
        await expect(await rowOf(grid, 2)).toHaveAttribute('selected', '');
    });
});

/** The rows that intersect the grid viewport, in DOM order, with their stripe parity and computed backgrounds. */
async function inViewRows(grid: Locator) {
    return grid.evaluate((g: any) => {
        const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
        const view = scroller.getBoundingClientRect();
        const cellText = (cell: Element) => {
            const walker = document.createTreeWalker(cell.shadowRoot ?? cell, NodeFilter.SHOW_TEXT);
            let text = '';
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (!node.parentElement?.closest('style'))
                    text += node.textContent;
            }

            return text.trim();
        };

        return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
            .map((r: any) => ({ r, b: r.getBoundingClientRect() }))
            .filter(({ r, b }) => getComputedStyle(r).display !== 'none' && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1)
            .map(({ r, b }) => {
                const siblings = [...r.parentElement.children].filter((c: Element) => c.tagName === r.tagName);
                const pinned = [...r.shadowRoot.querySelectorAll('.pinned')].filter((p: Element) => getComputedStyle(p).display !== 'none');
                return {
                    // nth-of-type is 1-based: the first row is an odd row
                    odd: siblings.indexOf(r) % 2 === 0,
                    top: b.top,
                    height: b.height,
                    loading: r.classList.contains('loading'),
                    selected: r.hasAttribute('selected'),
                    hovered: r.matches(':hover'),
                    isGroup: r.hasAttribute('is-group'),
                    host: getComputedStyle(r).backgroundColor,
                    cursor: getComputedStyle(r).cursor,
                    cells: [...r.querySelectorAll('.column')].map((c: Element) => ({ background: getComputedStyle(c).backgroundColor, visibility: getComputedStyle(c).visibility, text: cellText(c) })),
                    pinned: pinned.map((p: Element) => getComputedStyle(p).backgroundColor)
                };
            });
    });
}

/** Waits until every row in the viewport is a loading placeholder (with page loads held). */
async function waitForLoadingRows(grid: Locator) {
    await expect.poll(async () => {
        const shown = await inViewRows(grid);
        return shown.length > 0 && shown.every(r => r.loading);
    }).toBe(true);
}

/** The prefix parts (pinned controls) of a row that take visible space, in DOM order. */
async function shownParts(row: Locator) {
    return row.evaluate((r: any) => [...r.shadowRoot.querySelectorAll('[part]')]
        .filter((p: Element) => ['groupspacer', 'reorder', 'selector', 'actions', 'filter'].includes(p.getAttribute('part')!))
        .filter((p: Element) => {
            const style = getComputedStyle(p);
            return style.display !== 'none' && style.visibility !== 'hidden' && p.getBoundingClientRect().width > 0;
        })
        .map((p: Element) => p.getAttribute('part')));
}

test.describe('vi-query-grid-row: item rendering transitions', () => {
    test('hidden rows reappear when the result grows again', case_('rows.row-null-to-item'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const state = () => grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].map((r: any) => ({ hidden: r.classList.contains('hidden'), hasItem: !!r.item })));
        const pool = (await state()).length;

        // A search narrow enough to give fewer items than the row pool ('Aaron' alone matches 110 people)
        await page.evaluate(async () => {
            const q = (window as any).q;
            q.textSearch = 'Aaron Lemmens';
            await q.search();
        });
        await waitForGridReady(grid);

        const total = await grid.evaluate((g: any) => g.query.totalItems);
        expect(total).toBeGreaterThan(0);
        expect(total).toBeLessThan(pool);
        await expect.poll(async () => (await state()).filter(s => !s.hidden).length).toBe(Math.min(total, pool));
        expect((await state()).filter(s => s.hidden).every(s => !s.hasItem)).toBe(true);
        expect((await visibleRows(grid)).map(r => r.index)).toEqual([...Array(total).keys()]);

        await page.evaluate(async () => {
            const q = (window as any).q;
            q.textSearch = '';
            await q.search();
        });
        await waitForGridReady(grid);

        await expect.poll(async () => (await state()).filter(s => s.hidden).length).toBe(0);
        expect((await state()).every(s => s.hasItem)).toBe(true);
        const visible = await visibleRows(grid);
        expect(visible.length).toBeGreaterThan(total);
        visible.forEach((row, i) => {
            expect(row.index, `row ${i}`).toBe(i);
            expect(row.texts[0], `row ${i} FirstName`).not.toBe('');
        });
    });

    test('recycled rows show no stale values while their page loads', case_('rows.row-item-to-placeholder-no-stale'), async ({ page }) => {
        await gridPage(page);
        const held = await holdPageLoads(page);
        const grid = await mountGrid(page);

        const initial = new Set((await visibleRows(grid)).map(r => `${r.texts[0]} ${r.texts[1]}`));
        expect(initial.size).toBeGreaterThan(10);

        await scrollToRow(grid, 5000);
        await expect.poll(() => held.count).toBeGreaterThan(0);
        await waitForLoadingRows(grid);

        const shown = await inViewRows(grid);
        expect(shown.length).toBeGreaterThan(10);
        for (const [i, row] of shown.entries()) {
            const visibleCells = row.cells.filter(c => c.visibility !== 'hidden');
            expect(visibleCells.map(c => c.text).filter(t => t !== ''), `loading row ${i} shows no values`).toEqual([]);
            expect(initial.has(`${row.cells[0].text} ${row.cells[1].text}`) && visibleCells.length > 0, `loading row ${i} shows no stale pair`).toBe(false);
        }

        await held.release();
        await waitForGridReady(grid);
    });

    test('cells follow the column set on a query swap', case_('rows.row-columns-change'), async ({ page }) => {
        await gridPage(page, { width: 1600 });
        const grid = await mountGrid(page);
        await expect((await rowOf(grid, 0)).locator('.column')).toHaveCount(9);

        await swapQuery(grid, 'People', (q: any) => { q.columns.find((c: any) => c.name === 'Email').isHidden = true; });
        expect(await headerNames(grid)).not.toContain('Email');
        await expect((await rowOf(grid, 0)).locator('.column')).toHaveCount(8);

        const hiddenEmails = await grid.evaluate((g: any) => {
            const q = g.query;
            q.disableLazyLoading = true;
            try {
                return [...Array(10).keys()].map(i => q.items[i].getValue('Email'));
            }
            finally {
                q.disableLazyLoading = false;
            }
        });
        const swapped = await visibleRows(grid);
        expect(swapped.length).toBeGreaterThan(10);
        for (const row of swapped) {
            expect(row.texts).toHaveLength(8);
            expect(row.texts.some(t => t.includes('@') || hiddenEmails.includes(t))).toBe(false);
        }

        await grid.evaluate((g: any) => {
            const w = window as any;
            g.query = w.previousQ;
            w.q = g.query;
        });
        await waitForGridReady(grid);
        expect(await headerNames(grid)).toContain('Email');
        await expect((await rowOf(grid, 0)).locator('.column')).toHaveCount(9);

        const emailColumn = (await headerNames(grid)).indexOf('Email');
        const restored = await visibleRows(grid);
        const emails = await grid.evaluate((g: any, indexes: number[]) => {
            const q = g.query;
            q.disableLazyLoading = true;
            try {
                return indexes.map(i => q.items[i].getValue('Email'));
            }
            finally {
                q.disableLazyLoading = false;
            }
        }, restored.map(r => r.index));
        restored.forEach((row, i) => {
            expect(row.texts).toHaveLength(9);
            expect(row.texts[emailColumn], `row ${i} Email`).toBe(emails[i]);
        });
    });
});

test.describe('vi-query-grid-row: row styling', () => {
    test('default stripe colors and override variables', case_('rows.row-stripes'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await page.mouse.move(1, 1);

        const check = async (odd: string, even: string, evenHost: string) => {
            const shown = (await inViewRows(grid)).filter(r => !r.hovered && !r.selected);
            expect(shown.length).toBeGreaterThan(10);
            expect(shown.some(r => r.odd)).toBe(true);
            expect(shown.some(r => !r.odd)).toBe(true);
            for (const [i, row] of shown.entries()) {
                const color = row.odd ? odd : even;
                expect(row.host, `row ${i} host`).toBe(row.odd ? odd : evenHost);
                expect(row.cells.map(c => c.background), `row ${i} cells`).toEqual(row.cells.map(() => color));
                expect(row.pinned.length, `row ${i} pinned parts`).toBeGreaterThan(0);
                expect(row.pinned, `row ${i} pinned parts`).toEqual(row.pinned.map(() => color));
            }
        };

        await check('rgb(250, 250, 250)', 'rgb(255, 255, 255)', 'rgb(255, 255, 255)');

        await grid.evaluate((g: HTMLElement) => {
            g.style.setProperty('--vi-query-grid-row-odd-color', 'rgb(1, 2, 3)');
            g.style.setProperty('--vi-query-grid-row-even-color', 'rgb(4, 5, 6)');
        });
        await check('rgb(1, 2, 3)', 'rgb(4, 5, 6)', 'rgb(255, 255, 255)');
    });

    test('loading rows use #FCFCFC odd stripes and ignore hover', case_('gap.row-loading-stripe-colors'), async ({ page }) => {
        await gridPage(page);
        const held = await holdPageLoads(page);
        const grid = await mountPrepared(page, {
            prepare: (q: any) => {
                const column = q.columns.find((c: any) => c.name === 'FirstName');
                column.typeHints = { ...(column.typeHints ?? {}), hoverstyle: 'background-color: rgb(255, 255, 0)' };
            }
        });

        await scrollToRow(grid, 5000);
        await expect.poll(() => held.count).toBeGreaterThan(0);
        await waitForLoadingRows(grid);
        await page.mouse.move(1, 1);

        const shown = (await inViewRows(grid)).filter(r => !r.hovered);
        expect(shown.some(r => r.odd)).toBe(true);
        for (const [i, row] of shown.entries())
            expect(row.host, `loading row ${i}`).toBe(row.odd ? 'rgb(252, 252, 252)' : 'rgb(255, 255, 255)');

        // Hover an odd loading row in the middle of the viewport
        const target = shown.filter(r => r.odd)[Math.floor(shown.filter(r => r.odd).length / 2)];
        await page.mouse.move(400, target.top + target.height / 2);
        await expect.poll(async () => (await inViewRows(grid)).some(r => r.hovered)).toBe(true);

        const hovered = (await inViewRows(grid)).find(r => r.hovered)!;
        expect(hovered.loading).toBe(true);
        expect(hovered.host).toBe('rgb(252, 252, 252)');
        expect(hovered.cursor).not.toBe('pointer');
        expect(hovered.cells.map(c => c.background)).not.toContain('rgb(255, 255, 0)');

        await held.release();
        await waitForGridReady(grid);
    });

    test('hovered item rows show a pointer and the hover background', case_('rows.row-hover-cursor-background'), async ({ page }) => {
        const HOVER = 'rgb(200, 220, 240)';
        await gridPage(page, { styles: `:root { --color-semi-faint: ${HOVER}; }` });
        const grid = await mountGrid(page);
        await page.mouse.move(1, 1);

        const row = await rowOf(grid, 1);
        const [box] = await boxes(row);
        await page.mouse.move(box.x + 300, box.y + box.height / 2);
        await expect.poll(async () => (await inViewRows(grid)).filter(r => r.hovered).length).toBe(1);

        const hovered = (await inViewRows(grid)).find(r => r.hovered)!;
        expect(hovered.cursor).toBe('pointer');
        expect(hovered.host).toBe(HOVER);
        expect(hovered.cells.map(c => c.background)).toEqual(hovered.cells.map(() => HOVER));
        expect(hovered.pinned.length).toBeGreaterThan(0);
        expect(hovered.pinned).toEqual(hovered.pinned.map(() => HOVER));

        await page.mouse.move(1, 1);
        await expect.poll(async () => (await inViewRows(grid)).filter(r => r.hovered).length).toBe(0);
        const restored = (await inViewRows(grid)).find(r => Math.abs(r.top - box.y) < 1)!;
        const stripe = restored.odd ? 'rgb(250, 250, 250)' : 'rgb(255, 255, 255)';
        expect(restored.cells.map(c => c.background)).toEqual(restored.cells.map(() => stripe));
        expect(restored.pinned).toEqual(restored.pinned.map(() => stripe));
    });

    test('hovering the selector or ellipsis tints its icon', case_('gap.row-selector-hover-feedback'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await page.mouse.move(1, 1);

        const row = await rowOf(grid, 1);
        const selectorIcon = row.locator('[part=selector] > vi-icon');
        const actionsIcon = row.locator('[part=actions] > vi-icon');
        await expect(selectorIcon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(actionsIcon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

        await row.locator('[part=selector]').hover();
        await expect(selectorIcon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.05)');
        await expect(actionsIcon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

        await row.locator('[part=actions]').hover();
        await expect(actionsIcon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.05)');
        await expect(selectorIcon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

        await page.mouse.move(1, 1);
        await expect(actionsIcon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    });

    test('rows are at least as wide as the viewport', case_('rows.row-min-width'), async ({ page }) => {
        await gridPage(page, { width: 2500 });
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        const result = await grid.evaluate((g: any) => {
            const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller as HTMLElement;
            const tracks = [...getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').matchAll(/(\d+(?:\.\d+)?)px/g)].reduce((sum, m) => sum + parseFloat(m[1]), 0);
            return {
                viewport: scroller.clientWidth,
                tracks,
                widths: [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => getComputedStyle(r).display !== 'none').map((r: any) => r.getBoundingClientRect().width)
            };
        });

        expect(result.tracks).toBeLessThan(result.viewport - 200);
        expect(result.widths).toHaveLength(10);
        for (const width of result.widths)
            expect(Math.abs(width - result.viewport)).toBeLessThanOrEqual(1);
    });
});

test.describe('vi-query-grid-row: pinned controls and reorder handle', () => {
    test('pinned controls paint above scrolled cells', case_('rows.row-pinned-on-top'), async ({ page }) => {
        await gridPage(page, { width: 600 });
        const grid = await mountGrid(page);

        await scrollGrid(grid, { left: 300 });
        await expect.poll(async () => (await getScrollOffset(grid)).left).toBe(300);
        await waitForGridReady(grid);

        const row = await rowOf(grid, 1);
        const [selector] = await boxes(row.locator('[part=selector]'));
        await expect.poll(async () => {
            const chain = await deepHitChain(page, selector.x + selector.width / 2, selector.y + selector.height / 2);
            return { selector: chain.some(e => e.part === 'selector'), cell: chain.some(e => e.classes.includes('column')) };
        }).toEqual({ selector: true, cell: false });
    });

    test('a reorderable grid adds a drag-handle column', case_('rows.row-reorder-layout'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Reorder' });
        await expect(grid).toHaveAttribute('can-reorder', '');

        const layout = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
            .filter((r: any) => getComputedStyle(r).display !== 'none')
            .map((r: any) => {
                const row = r.getBoundingClientRect();
                const reorder = r.shadowRoot.querySelector('[part=reorder]');
                const box = reorder?.getBoundingClientRect();
                const pinnedRight = Math.max(...[...r.shadowRoot.querySelectorAll('.pinned')]
                    .filter((p: Element) => getComputedStyle(p).display !== 'none' && getComputedStyle(p).visibility !== 'hidden')
                    .map((p: Element) => p.getBoundingClientRect().right));
                return {
                    reorder: !!reorder && getComputedStyle(reorder).display !== 'none' && getComputedStyle(reorder).visibility !== 'hidden',
                    hamburger: !!reorder?.querySelector('vi-icon[source=Hamburger]'),
                    cursor: reorder ? getComputedStyle(reorder).cursor : null,
                    width: box?.width ?? 0,
                    offset: box ? box.left - row.left : -1,
                    cellsAfterPinned: Math.min(...[...r.querySelectorAll('.column')].map((c: Element) => c.getBoundingClientRect().left)) >= pinnedRight - 1
                };
            }));

        expect(layout).toHaveLength(12);
        for (const [i, row] of layout.entries())
            expect(row, `row ${i}`).toEqual({ reorder: true, hamburger: true, cursor: 'grabbing', width: 32, offset: 0, cellsAfterPinned: true });
    });

    test('clicking the reorder handle does not open the item', case_('rows.row-reorder-click-no-open'), async ({ page }) => {
        await gridPage(page);
        // Safety net: a reorder must never reach the shared backend from this test
        await page.route(/\/ExecuteAction$/, route => route.abort());
        const grid = await mountGrid(page, { query: 'QueryGrid_Reorder' });
        await spyTapAndOpen(page);
        const log = requestLog(page);
        const before = (await visibleRows(grid)).map(r => r.texts.join('|'));

        await (await rowOf(grid, 0)).locator('[part=reorder]').click();

        await log.quiet(300);
        expect(await taps(page)).toEqual([]);
        expect(await opens(page)).toEqual([]);
        expect(log.of('GetPersistentObject')).toEqual([]);
        expect(log.of('ExecuteAction')).toEqual([]);
        expect((await visibleRows(grid)).map(r => r.texts.join('|'))).toEqual(before);
    });
});

test.describe('vi-query-grid-row: grid flags on rows', () => {
    const matrix = [
        { query: 'QueryGrid_Select', flat: { areas: 'none', parts: [] as string[] }, grouped: { areas: '"grouping"', parts: ['groupspacer'] } },
        { query: 'QueryGrid_SelectAndFilter', flat: { areas: '"spacer" "filter"', parts: ['filter'] }, grouped: { areas: '"spacer spacer" "grouping filter"', parts: ['groupspacer', 'filter'] } },
        { query: 'QueryGrid_SelectAndInlineActions', flat: { areas: '"spacer"', parts: ['actions'] }, grouped: { areas: '"grouping spacer"', parts: ['groupspacer', 'actions'] } },
        { query: 'People', flat: { areas: '"spacer" "filter"', parts: ['actions'] }, grouped: { areas: '"spacer spacer" "grouping filter"', parts: ['groupspacer', 'actions'] } }
    ];

    for (const { query, flat, grouped } of matrix) {
        for (const [mode, expected] of [['flat', flat], ['grouped by Gender', grouped]] as const) {
            test(`noSelection lays rows out like the headers (${query}, ${mode})`, case_('rows.row-matrix-no-selection'), async ({ page }) => {
                await gridPage(page, { width: 1600 });
                const grid = await mountGrid(page, { query, props: { noSelection: true } });
                if (mode !== 'flat') {
                    await page.evaluate(async () => { await (window as any).q.group('Gender'); });
                    await waitForGridReady(grid);
                }

                await expect(grid).not.toHaveAttribute('can-select', '');
                const controls = await grid.evaluate((g: any) => {
                    const controls = g.shadowRoot.querySelector('header .controls');
                    return { areas: getComputedStyle(controls).gridTemplateAreas, width: controls.getBoundingClientRect().width };
                });
                const height = await rowHeight(grid);
                expect(controls.areas).toBe(expected.areas);
                expect(Math.abs(controls.width - expected.parts.length * height)).toBeLessThanOrEqual(1);

                const row = await rowOf(grid, 0);
                expect(await shownParts(row)).toEqual(expected.parts);

                const [rowBox] = await boxes(row);
                const cells = await boxes(row.locator('.column'));
                const headers = await boxes(grid.locator('vi-query-grid-column-header'));
                expect(cells).toHaveLength(headers.length);
                expect(Math.abs(cells[0].x - rowBox.x - controls.width), 'first cell starts after the controls').toBeLessThanOrEqual(1);
                cells.forEach((cell, k) => {
                    expect(Math.abs(cell.x - headers[k].x), `cell ${k} left`).toBeLessThanOrEqual(1);
                    expect(Math.abs(cell.width - headers[k].width), `cell ${k} width`).toBeLessThanOrEqual(1);
                });
            });
        }
    }

    test('noSelection with filter and inline actions keeps cells aligned with headers', case_('rows.row-matrix-no-selection-filter-inline'), async ({ page }) => {
        await gridPage(page, { width: 1600 });
        const grid = await mountGrid(page, { props: { noSelection: true } });

        const height = await rowHeight(grid);
        const controlsWidth = await grid.evaluate((g: any) => g.shadowRoot.querySelector('header .controls').getBoundingClientRect().width);
        expect(Math.abs(controlsWidth - height)).toBeLessThanOrEqual(1);

        for (const index of [0, 1, 2]) {
            const row = await rowOf(grid, index);
            expect(await shownParts(row)).toEqual(['actions']);
            const cells = await boxes(row.locator('.column'));
            const headers = await boxes(grid.locator('vi-query-grid-column-header'));
            expect(cells).toHaveLength(9);
            cells.forEach((cell, k) => {
                expect(Math.abs(cell.x - headers[k].x), `row ${index} cell ${k} left`).toBeLessThanOrEqual(1);
                expect(Math.abs(cell.width - headers[k].width), `row ${index} cell ${k} width`).toBeLessThanOrEqual(1);
            });
        }
    });

    test('noInlineActions hides the ellipsis', case_('rows.row-matrix-no-inline-actions'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { props: { noInlineActions: true } });

        const parts = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
            .filter((r: any) => getComputedStyle(r).display !== 'none')
            .map((r: any) => {
                const actions = r.shadowRoot.querySelector('[part=actions]');
                return !!actions && getComputedStyle(actions).display !== 'none' && getComputedStyle(actions).visibility !== 'hidden' && actions.getBoundingClientRect().width > 0;
            }));
        expect(parts.length).toBeGreaterThan(10);
        expect(parts.every(shown => !shown)).toBe(true);
        const shown = await shownParts(await rowOf(grid, 1));
        expect(shown).toContain('selector');
        expect(shown).not.toContain('actions');
    });

    test('noInlineActions also turns off the context menu', case_('rows.row-matrix-no-inline-actions-ctx'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { props: { noInlineActions: true } });
        await recordContextMenu(page);

        await (await rowOf(grid, 1)).locator('.column').first().click({ button: 'right' });

        await expect.poll(() => contextMenuEvents(page)).toEqual([false]);
        await nextFrames(page, 2);
        await expect(grid.locator('vi-popup[open]')).toHaveCount(0);
        expect(await contextPopupCount(grid)).toBe(0);
        expect(await selectedIndexes(grid)).toEqual([]);
        await expect(await rowOf(grid, 1)).not.toHaveAttribute('actions-open', '');
    });
});

/** PeopleTop10 sorted on FirstName: id 3 (Aaron) is row 0, id 1 (Jonas) row 2 and id 10 (Laure) row 3. */
async function top10WithHints(page: Page, hints: Record<string, Record<string, string>>) {
    await gridPage(page);
    await patchItemHints(page, hints);
    const grid = await mountGrid(page, { query: 'PeopleTop10' });
    expect(await grid.evaluate((g: any) => [0, 2, 3].map(i => g.query.items[i].id))).toEqual(['3', '1', '10']);

    return grid;
}

/** Whether a part is effectively shown and clickable. */
async function partState(row: Locator, part: string) {
    return row.locator(`[part=${part}]`).evaluate((p: Element) => ({ visibility: getComputedStyle(p).visibility, pointerEvents: getComputedStyle(p).pointerEvents }));
}

/** The item ids of the rows (any position) that carry the given class. */
async function rowIdsWithClass(grid: Locator, className: string) {
    return grid.evaluate((g: any, className) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
        .filter((r: any) => r.classList.contains(className) && getComputedStyle(r).display !== 'none')
        .map((r: any) => r.item?.id ?? null), className);
}

test.describe('vi-query-grid-row: type hints (extraclass)', () => {
    test('item extraclass adds classes to its row only', case_('rows.row-extraclass-added'), async ({ page }) => {
        const grid = await top10WithHints(page, { '3': { extraclass: 'vip highlight' } });

        const row = await rowOf(grid, 0);
        await expect(row).toHaveClass(/(^|\s)vip(\s|$)/);
        await expect(row).toHaveClass(/(^|\s)highlight(\s|$)/);
        expect(await rowIdsWithClass(grid, 'vip')).toEqual(['3']);
        expect(await rowIdsWithClass(grid, 'highlight')).toEqual(['3']);
    });

    test('disabled and readonly rows hide selector and actions', case_('rows.row-extraclass-disabled-css'), async ({ page }) => {
        const grid = await top10WithHints(page, { '1': { extraclass: 'disabled' }, '10': { extraclass: 'readonly' } });

        for (const index of [2, 3]) {
            const row = await rowOf(grid, index);
            expect(await partState(row, 'selector'), `row ${index} selector`).toEqual({ visibility: 'hidden', pointerEvents: 'none' });
            expect(await partState(row, 'actions'), `row ${index} actions`).toEqual({ visibility: 'hidden', pointerEvents: 'none' });
        }

        // Other rows keep their controls
        expect(await partState(await rowOf(grid, 1), 'selector')).toEqual({ visibility: 'visible', pointerEvents: 'auto' });
    });

    test('a disabled row shows no pointer cursor, a readonly row does', case_('rows.row-extraclass-disabled-css'), async ({ page }) => {
        const grid = await top10WithHints(page, { '1': { extraclass: 'disabled' }, '10': { extraclass: 'readonly' } });

        // A readonly row still opens, so it keeps the pointer; a disabled row ignores clicks, so it must not show one
        const readonly = await rowOf(grid, 3);
        await readonly.locator('.column').first().hover();
        await expect(readonly).toHaveCSS('cursor', 'pointer');

        const disabled = await rowOf(grid, 2);
        await disabled.locator('.column').first().hover();
        await expect(disabled).toHaveCSS('cursor', 'default');
    });

    test('extraclass classes move with the item on recycle', case_('rows.row-extraclass-recycled'), async ({ page }) => {
        await gridPage(page);
        await patchItemHints(page, { '3': { extraclass: 'vip highlight' } });
        const grid = await mountGrid(page);
        expect(await rowIdsWithClass(grid, 'vip')).toEqual(['3']);

        await scrollToRowAndWait(grid, 1000);
        expect(await rowIdsWithClass(grid, 'vip')).toEqual([]);
        expect(await rowIdsWithClass(grid, 'highlight')).toEqual([]);

        await scrollToRowAndWait(grid, 0);
        expect(await rowIdsWithClass(grid, 'vip')).toEqual(['3']);
        expect(await rowIdsWithClass(grid, 'highlight')).toEqual(['3']);
        const row = await rowOf(grid, 0);
        await expect(row).toHaveClass(/(^|\s)vip(\s|$)/);
        expect((await visibleRows(grid))[0].texts).toContain('Aaron_Lemmens59@skynet.be');
    });

    test('an item extraclass with consecutive spaces adds each class', case_('rows.row-extraclass-double-space'), async ({ page }) => {
        const errors = pageErrors(page);
        const grid = await top10WithHints(page, { '3': { extraclass: 'a  b' } });

        const row = await rowOf(grid, 0);
        await expect(row).toHaveClass(/(^|\s)a(\s|$)/);
        await expect(row).toHaveClass(/(^|\s)b(\s|$)/);
        expect(errors).toEqual([]);
    });

    test('extraclass \'Disabled\' (any case) disables the row like \'disabled\'', case_('gap.row-extraclass-mixed-case-disabled'), async ({ page }) => {
        const grid = await top10WithHints(page, { '1': { extraclass: 'Disabled' } });
        await spyTapAndOpen(page);
        await recordContextMenu(page);
        const log = requestLog(page);
        const row = await rowOf(grid, 2);

        await row.locator('.column').first().click();
        await row.locator('.column').first().click({ button: 'right' });
        await log.quiet(300);
        expect(await taps(page)).toEqual([]);
        expect(await opens(page)).toEqual([]);
        await expect(contextPopup(grid)).toHaveCount(0);
        expect(await contextMenuEvents(page)).toEqual([false]);

        await setSelected(grid, 2, true);
        expect(await selectedIndexes(grid)).toEqual([]);

        expect(await partState(row, 'selector')).toEqual({ visibility: 'hidden', pointerEvents: 'none' });
        expect(await partState(row, 'actions')).toEqual({ visibility: 'hidden', pointerEvents: 'none' });
    });
});

test.describe('vi-query-grid-row: selection rules', () => {
    test('disabled and readonly items cannot be selected', case_('rows.row-selection-ignoreselect'), async ({ page }) => {
        const grid = await top10WithHints(page, { '1': { extraclass: 'disabled' }, '10': { extraclass: 'readonly' } });

        await setSelected(grid, 2, true);
        await setSelected(grid, 3, true);
        await setSelected(grid, 1, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([1]);
        expect(await grid.evaluate((g: any) => [2, 3].map(i => g.query.items[i].isSelected))).toEqual([false, false]);
        await expect(await rowOf(grid, 2)).not.toHaveAttribute('selected', '');
        await expect(await rowOf(grid, 3)).not.toHaveAttribute('selected', '');
        await expect(await rowOf(grid, 1)).toHaveAttribute('selected', '');
    });

    test('maxSelectedItems=1 keeps only the last selected row', case_('rows.row-selection-max-one'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountPrepared(page, {
            queryOptions: { asLookup: true },
            props: { asLookup: true },
            prepare: (q: any) => { q.maxSelectedItems = 1; }
        });

        await (await rowOf(grid, 1)).locator('[part=selector]').click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([1]);

        await (await rowOf(grid, 2)).locator('[part=selector]').click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([2]);
        await expect(await rowOf(grid, 2)).toHaveAttribute('selected', '');
        await expect(await rowOf(grid, 1)).not.toHaveAttribute('selected', '');
        expect(await grid.evaluate((g: any) => g.query.selectedItems.length)).toBe(1);
    });
});

test.describe('vi-query-grid-row: opening rules', () => {
    test('non-readable queries fire item-tap but do not open', case_('rows.row-open-canread-false'), async ({ page }) => {
        await gridPage(page);
        await page.route(/\/GetQuery$/, async route => {
            const response = await route.fetch();
            const json = await response.json();
            if (json.query)
                json.query.canRead = false;

            await route.fulfill({ response, json });
        });
        const grid = await mountGrid(page);
        expect(await grid.evaluate((g: any) => g.query.canRead)).toBe(false);
        await spyTapAndOpen(page);
        const log = requestLog(page);

        await (await rowOf(grid, 0)).locator('.column').first().click();
        await expect.poll(() => taps(page)).toEqual(['3']);
        await log.quiet(300);
        expect(await opens(page)).toEqual([]);
        expect(log.of('GetPersistentObject')).toEqual([]);
    });

    test('the openaction hint executes the action instead of opening', case_('rows.row-openaction'), async ({ page }) => {
        await gridPage(page);
        await patchItemHints(page, { '3': { openaction: 'TestCountSingle' } });
        const grid = await mountGrid(page);
        await spyTapAndOpen(page);
        await page.evaluate(() => {
            const w = window as any;
            w.__sequence = [];
            document.addEventListener('item-tap', () => w.__sequence.push('item-tap'));
            const fetch = w.service.hooks.onFetch.bind(w.service.hooks);
            w.service.hooks.onFetch = (request: Request) => {
                w.__sequence.push(new URL(request.url).pathname.split('/').pop());
                return fetch(request);
            };
        });
        const log = requestLog(page);

        await (await rowOf(grid, 0)).locator('.column').first().click();
        await expect.poll(() => grid.evaluate((g: any) => g.query.notification)).toBe('1');
        await log.quiet(300);

        expect(await taps(page)).toEqual(['3']);
        expect(await opens(page)).toEqual([]);
        expect(log.of('GetPersistentObject')).toEqual([]);
        const executed = log.of('ExecuteAction');
        expect(executed).toHaveLength(1);
        expect(executed[0].action).toMatch(/TestCountSingle$/);
        expect(executed[0].body.selectedItems).toHaveLength(1);
        expect(executed[0].body.selectedItems[0].id).toBe('3');
        expect(await page.evaluate(() => (window as any).__sequence)).toEqual(['item-tap', 'ExecuteAction']);
    });

    test('disabled rows ignore clicks', case_('rows.row-open-disabled'), async ({ page }) => {
        const grid = await top10WithHints(page, { '1': { extraclass: 'disabled' } });
        await spyTapAndOpen(page);
        const log = requestLog(page);

        await (await rowOf(grid, 2)).locator('.column').first().click();
        await log.quiet(300);
        expect(await taps(page)).toEqual([]);
        expect(await opens(page)).toEqual([]);
        expect(log.of('GetPersistentObject')).toEqual([]);
    });

    test('readonly rows still open', case_('rows.row-open-readonly'), async ({ page }) => {
        const grid = await top10WithHints(page, { '10': { extraclass: 'readonly' } });
        await spyTapAndOpen(page);

        await (await rowOf(grid, 3)).locator('.column').first().click();
        await expect.poll(() => opens(page)).toHaveLength(1);
        expect((await opens(page))[0]).toMatchObject({ objectId: '10' });
        expect(await taps(page)).toEqual(['10']);
    });

    test('shift+click opens the item in a new window', case_('rows.row-open-ctrl-new-tab'), async ({ page }) => {
        const grid = await openView(page, VIEWS.People);
        await page.evaluate(() => {
            const w = window as any;
            w.__opened = [];
            w.open = (url: any) => {
                w.__opened.push(String(url));
                return null;
            };
        });
        const url = page.url();
        const log = requestLog(page);

        await (await rowOf(grid, 0)).locator('.column').first().click({ modifiers: ['Shift'] });
        await expect.poll(() => page.evaluate(() => (window as any).__opened.length)).toBe(1);
        await log.quiet(300);

        const opened: string[] = await page.evaluate(() => (window as any).__opened);
        expect(opened).toHaveLength(1);
        expect(opened[0]).toMatch(/\/3$/);
        expect(page.url()).toBe(url);
        expect(log.of('GetPersistentObject')).toEqual([]);
    });
});

/** Opens row `index`'s inline actions popup with a click on its ellipsis. */
async function openInline(grid: Locator, index: number) {
    const row = await rowOf(grid, index);
    await row.locator('[part=actions]').click();
    const popup = row.locator('vi-popup[part=actions]');
    await expect(popup).toHaveAttribute('open', '');
    return { row, popup };
}

/** The names of the top-level action buttons in a popup. */
async function buttonNames(popup: Locator) {
    return popup.locator(':scope > vi-action-button').evaluateAll(els => els.map(e => e.getAttribute('name')));
}

/** A bare grid page with an empty band below the grid, so a click there lands outside the grid. */
async function gridPageWithOutside(page: Page) {
    await gridPage(page, { styles: '#test-container { bottom: 40px; }' });
}

test.describe('vi-query-grid-row: inline actions details', () => {
    test('opening on a selected row keeps the multi-selection', case_('rows.row-actions-keep-selection'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await setSelected(grid, 1, true);
        await setSelected(grid, 2, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([1, 2]);

        const { popup } = await openInline(grid, 2);
        expect(await selectedIndexes(grid)).toEqual([1, 2]);

        await popup.locator(':scope > vi-action-button[name=TestActionsGroup]').hover();
        const many = grid.locator('vi-action-button[name=TestCountMany]');
        const single = grid.locator('vi-action-button[name=TestCountSingle]');
        await expect(many).toBeVisible();
        await expect(single).toBeVisible();
        await expect(many).not.toHaveAttribute('disabled', '');
        await expect(single).toHaveAttribute('disabled', '');
        expect(await selectedIndexes(grid)).toEqual([1, 2]);
    });

    test('QueryGrid_InlineActions lists its single One action', case_('rows.row-actions-inlineactions-view'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_InlineActions' });

        const { popup } = await openInline(grid, 0);
        const buttons = popup.locator(':scope > vi-action-button');
        await expect(buttons).toHaveCount(1);
        await expect(buttons.first()).toHaveAttribute('name', 'One');
        await expect(buttons.first()).not.toHaveAttribute('disabled', '');
        expect(await buttons.first().evaluate((e: Element) => (e.shadowRoot?.querySelector('.label')?.textContent ?? '').trim())).toBe('One');
    });

    test('a grouped action runs on the row\'s item', case_('rows.row-actions-execute-subaction'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await spyTapAndOpen(page);
        const log = requestLog(page);

        const { popup } = await openInline(grid, 0);
        await popup.locator(':scope > vi-action-button[name=TestActionsGroup]').hover();
        const single = grid.locator('vi-action-button[name=TestCountSingle]');
        await expect(single).toBeVisible();
        await expect(single).not.toHaveAttribute('disabled', '');
        await single.click();

        await expect.poll(() => grid.evaluate((g: any) => g.query.notification)).toBe('1');
        await log.quiet(300);
        const executed = log.of('ExecuteAction');
        expect(executed).toHaveLength(1);
        expect(executed[0].action).toMatch(/TestCountSingle$/);
        expect(executed[0].body.selectedItems).toHaveLength(1);
        expect(executed[0].body.selectedItems[0].id).toBe('3');
        await expect(grid.locator('vi-popup[open]')).toHaveCount(0);
        expect(await taps(page)).toEqual([]);
        expect(await opens(page)).toEqual([]);
    });

    test('an open actions popup paints above following rows', case_('gap.row-actions-open-zindex'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const below = await rowOf(grid, 3);
        await below.evaluate((r: any) => {
            r.__marker = true;
            r.querySelectorAll('.column').forEach((c: any) => c.__marker = true);
        });
        const [rowBox] = await boxes(below);

        const { popup } = await openInline(grid, 2);
        const buttons = await boxes(popup.locator(':scope > vi-action-button'));
        const content = {
            left: Math.min(...buttons.map(b => b.x)),
            right: Math.max(...buttons.map(b => b.x + b.width)),
            top: Math.min(...buttons.map(b => b.y)),
            bottom: Math.max(...buttons.map(b => b.y + b.height))
        };
        const y = rowBox.y + rowBox.height / 2;
        expect(y).toBeGreaterThan(content.top);
        expect(y).toBeLessThan(content.bottom);
        const x = (content.left + content.right) / 2;

        const open = await deepHitChain(page, x, y);
        expect(open.some(e => e.tag === 'vi-action-button' || e.tag === 'vi-popup')).toBe(true);
        expect(open.some(e => e.marked)).toBe(false);

        await page.keyboard.press('Escape');
        await expect(popup).not.toHaveAttribute('open', '');
        await expect.poll(async () => (await deepHitChain(page, x, y)).some(e => e.marked)).toBe(true);
    });

    test('no qualifying action opens no inline popup', case_('rows.row-actions-empty-popup'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_InlineActions' });
        await setSelected(grid, 1, true);
        await setSelected(grid, 2, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([1, 2]);

        // One needs exactly one selected item, so nothing qualifies for the 2 selected rows
        const row = await rowOf(grid, 2);
        await row.locator('[part=actions]').click();
        await nextFrames(page, 5);

        await expect(grid.locator('vi-popup[open]')).toHaveCount(0);
        await expect(row).not.toHaveAttribute('actions-open', '');
        expect(await selectedIndexes(grid)).toEqual([1, 2]);
    });

    for (const how of ['Escape', 'a pointerdown outside'] as const) {
        test(`closing the inline popup clears its buttons and actions-open (${how})`, case_('rows.row-actions-close-cleanup'), async ({ page }) => {
            await gridPageWithOutside(page);
            const grid = await mountGrid(page);

            const { row, popup } = await openInline(grid, 0);
            await expect(row).toHaveAttribute('actions-open', '');
            await expect(popup.locator(':scope > vi-action-button')).toHaveCount(3);

            if (how === 'Escape')
                await page.keyboard.press('Escape');
            else
                await page.mouse.click(640, 700);

            await expect(popup).not.toHaveAttribute('open', '');
            await expect(row).not.toHaveAttribute('actions-open', '');
            await expect(grid.locator('vi-action-button:visible')).toHaveCount(0);
            await expect(popup.locator(':scope > vi-action-button')).toHaveCount(0);
        });
    }
});

test.describe('vi-query-grid-row: context menu details', () => {
    test('the context menu opens at the pointer', case_('rows.row-ctx-position'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);

        const cell = (await rowOf(grid, 1)).locator('.column').nth(1);
        const [box] = await boxes(cell);
        const point = { x: box.x + 20, y: box.y + 10 };
        await page.mouse.click(point.x, point.y, { button: 'right' });

        const first = contextPopup(grid).locator(':scope > vi-action-button').first();
        await expect(first).toBeVisible();
        const [button] = await boxes(first);
        expect(Math.abs(button.x - point.x)).toBeLessThanOrEqual(4);
        expect(button.y - point.y).toBeGreaterThanOrEqual(0);
        expect(button.y - point.y).toBeLessThanOrEqual(10);
    });

    test('QueryGrid_Select shows MoreThanOne only for a multi-selection', case_('rows.row-ctx-select-view'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Select' });
        await setSelected(grid, 1, true);
        await setSelected(grid, 2, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([1, 2]);

        await (await rowOf(grid, 2)).locator('.column').first().click({ button: 'right' });
        const popup = contextPopup(grid);
        await expect(popup).toHaveCount(1);
        expect(await buttonNames(popup)).toEqual(['MoreThanOne']);
        expect(await popup.locator(':scope > vi-action-button').first().evaluate((e: Element) => (e.shadowRoot?.querySelector('.label')?.textContent ?? '').trim())).toBe('More than one');
        expect(await selectedIndexes(grid)).toEqual([1, 2]);
    });

    test('QueryGrid_Select: right-click on an unselected row opens no popup and keeps the selection', case_('rows.row-ctx-select-view'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Select' });
        await setSelected(grid, 1, true);
        await setSelected(grid, 2, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([1, 2]);
        await recordContextMenu(page);

        // With only row 4 selected MoreThanOne would not qualify, so there is no menu to show
        await (await rowOf(grid, 4)).locator('.column').first().click({ button: 'right' });
        await expect.poll(() => contextMenuEvents(page)).toEqual([false]);
        await nextFrames(page, 5);
        await expect(contextPopup(grid)).toHaveCount(0);
        expect(await selectedIndexes(grid)).toEqual([1, 2]);
    });

    for (const modifier of ['Shift', 'Control'] as const) {
        test(`${modifier} right-click leaves the native menu`, case_('rows.row-ctx-modifiers-native'), async ({ page }) => {
            await gridPage(page);
            const grid = await mountGrid(page);
            await recordContextMenu(page);

            await (await rowOf(grid, 1)).locator('.column').first().click({ button: 'right', modifiers: [modifier] });
            await expect.poll(() => contextMenuEvents(page)).toEqual([false]);
            await nextFrames(page, 5);
            expect(await contextPopupCount(grid)).toBe(0);
            await expect(contextPopup(grid)).toHaveCount(0);
        });
    }

    for (const variant of ['grid.asLookup', 'a lookup query'] as const) {
        test(`lookup grids and lookup queries have no context menu (${variant})`, case_('rows.row-ctx-lookup-none'), async ({ page }) => {
            await gridPage(page);
            const grid = variant === 'grid.asLookup'
                ? await mountGrid(page, { props: { asLookup: true } })
                : await mountGrid(page, { queryOptions: { asLookup: true } });
            await recordContextMenu(page);

            await (await rowOf(grid, 1)).locator('.column').first().click({ button: 'right' });
            await expect.poll(() => contextMenuEvents(page)).toEqual([false]);
            await nextFrames(page, 5);
            expect(await contextPopupCount(grid)).toBe(0);
            await expect(contextPopup(grid)).toHaveCount(0);
        });
    }

    test('disabled and readonly rows have no context menu', case_('rows.row-ctx-disabled-readonly-none'), async ({ page }) => {
        const grid = await top10WithHints(page, { '1': { extraclass: 'disabled' }, '10': { extraclass: 'readonly' } });

        for (const index of [2, 3]) {
            await (await rowOf(grid, index)).locator('.column').first().click({ button: 'right' });
            await nextFrames(page, 5);
            expect(await contextPopupCount(grid), `row ${index}`).toBe(0);
            await expect(contextPopup(grid)).toHaveCount(0);
            expect(await selectedIndexes(grid)).toEqual([]);
        }
    });

    test('group header rows have no context menu', case_('rows.row-ctx-non-item-none'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await page.evaluate(async () => { await (window as any).q.group('BirthDate'); });
        await waitForGridReady(grid);
        await recordContextMenu(page);

        await (await groupRowOf(grid, 0)).locator('vi-query-grid-row-group').click({ button: 'right' });
        await expect.poll(() => contextMenuEvents(page)).toEqual([false]);
        await nextFrames(page, 5);
        expect(await contextPopupCount(grid)).toBe(0);
        await expect(contextPopup(grid)).toHaveCount(0);
    });

    test('loading rows have no context menu', case_('rows.row-ctx-non-item-none'), async ({ page }) => {
        await gridPage(page);
        const held = await holdPageLoads(page);
        const grid = await mountGrid(page);
        await scrollToRow(grid, 5000);
        await expect.poll(() => held.count).toBeGreaterThan(0);
        await waitForLoadingRows(grid);
        await recordContextMenu(page);

        const target = (await inViewRows(grid))[3];
        await page.mouse.click(400, target.top + target.height / 2, { button: 'right' });
        await expect.poll(() => contextMenuEvents(page)).toEqual([false]);
        await nextFrames(page, 5);
        expect(await contextPopupCount(grid)).toBe(0);
        await expect(contextPopup(grid)).toHaveCount(0);

        await held.release();
        await waitForGridReady(grid);
    });

    for (const query of ['QueryGrid_None', 'QueryGrid_Filter']) {
        test(`without a qualifying action right-click opens no menu and keeps the selection (${query})`, case_('rows.row-ctx-empty-views'), async ({ page }) => {
            await gridPage(page);
            const grid = await mountGrid(page, { query });
            await recordContextMenu(page);

            const row = await rowOf(grid, 0);
            await row.locator('.column').first().click({ button: 'right' });
            await expect.poll(() => contextMenuEvents(page)).toEqual([false]);
            await nextFrames(page, 5);
            expect(await contextPopupCount(grid)).toBe(0);
            await expect(grid.locator('vi-popup[open]')).toHaveCount(0);
            expect(await selectedIndexes(grid)).toEqual([]);
            await expect(row).not.toHaveAttribute('selected', '');
        });
    }

    test('right-click without a qualifying action shows no popup and keeps the selection', case_('rows.row-ctx-empty-no-popup'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_None' });
        await recordContextMenu(page);

        await (await rowOf(grid, 0)).locator('.column').first().click({ button: 'right' });
        await expect.poll(() => contextMenuEvents(page)).toEqual([false]);
        await nextFrames(page, 5);
        await expect(page.locator('vi-popup[open]')).toHaveCount(0);
        expect(await grid.evaluate((g: any) => g.query.selectedItems.length)).toBe(0);
    });

    for (const how of ['context menu', 'ellipsis'] as const) {
        test(`opening actions on a row deselected in inverse mode clears select-all (${how})`, case_('gap.row-ctx-inverse-mode-clears-select-all'), async ({ page }) => {
            await gridPage(page);
            const grid = await mountGrid(page);

            await grid.locator('vi-query-grid-select-all').click();
            await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);
            const row = await rowOf(grid, 3);
            await row.locator('[part=selector]').click();
            await expect.poll(async () => (await selectAllState(grid)).inverse).toBe(true);

            if (how === 'context menu') {
                await row.locator('.column').first().click({ button: 'right' });
                await expect(contextPopup(grid)).toHaveCount(1);
            }
            else
                await openInline(grid, 3);

            await expect.poll(() => selectedIndexes(grid)).toEqual([3]);
            expect(await selectAllState(grid)).toMatchObject({ allSelected: false, inverse: false, selectedItems: 1 });
            expect((await inViewRows(grid)).filter(r => r.selected)).toHaveLength(1);
            await expect(row).toHaveAttribute('selected', '');
            await expect(grid.locator('vi-query-grid-select-all')).toHaveAttribute('partial', '');
        });
    }

    test('in select-all mode the menu counts the selected items like the action bar', case_('gap.row-ctx-allselected-rule-count'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await grid.locator('vi-query-grid-select-all').click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);

        // A rule between the loaded selection and the whole result tells the two counts apart. The action bar's
        // canExecute counts query.selectedItems, so the menu must list exactly the actions the bar enables.
        const expected = await grid.evaluate((g: any) => {
            const q = g.query;
            const alwaysTrue = (window as any).Vidyano.ExpressionParser.alwaysTrue;
            const loaded = q.selectedItems.length;
            const single = q.actions.find((a: any) => a.isVisible && a.definition.selectionRule !== alwaysTrue && !a.group && a.selectionRule(1) && !a.selectionRule(2));
            const upToLoaded = q.actions.find((a: any) => a.isVisible && a.definition.selectionRule !== alwaysTrue && !a.group && a !== single);
            upToLoaded.selectionRule = (count: number) => count >= 1 && count <= loaded;

            return { loaded, total: q.selectedItemCount, single: single?.name, upToLoaded: upToLoaded.name };
        });
        expect(expected.total).toBe(10000);
        expect(expected.loaded).toBeGreaterThan(1);
        expect(expected.loaded).toBeLessThan(expected.total);

        await (await rowOf(grid, 1)).locator('.column').first().click({ button: 'right' });
        const popup = contextPopup(grid);
        await expect(popup).toHaveCount(1);
        const names = await buttonNames(popup);
        expect(names).toContain(expected.upToLoaded);
        if (expected.single)
            expect(names).not.toContain(expected.single);
    });

    test('the menu lists the actions the app shows for the row\'s selection', case_('rows.row-ctx-actions-after-selection'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await setSelected(grid, 1, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([1]);

        // Like an app hook that shows an action only for some rows
        const name = await grid.evaluate((g: any) => {
            const q = g.query;
            const alwaysTrue = (window as any).Vidyano.ExpressionParser.alwaysTrue;
            const action = q.actions.find((a: any) => a.isVisible && a.definition.selectionRule !== alwaysTrue && !a.group && a.selectionRule(1));
            const target = q.items[3];
            action.isVisible = false;
            q.propertyChanged.attach((_: any, args: any) => {
                if (args.propertyName === 'selectedItems')
                    action.isVisible = q.selectedItems.includes(target);
            });

            return action.name;
        });

        await (await rowOf(grid, 3)).locator('.column').first().click({ button: 'right' });
        const popup = contextPopup(grid);
        await expect(popup).toHaveCount(1);
        expect(await buttonNames(popup)).toContain(name);
        expect(await selectedIndexes(grid)).toEqual([3]);
    });

    test('the context menu opens at the pointer on a scrolled document', case_('gap.row-ctx-position-scrolled-document'), async ({ page }) => {
        await gridPage(page, {
            styles: `
                html, body { height: auto; }
                body { min-height: 2000px; }
                #test-container { position: static; display: block; }
                #test-container > vi-query-grid { display: flex; height: 600px; }
                #spacer { height: 400px; }`
        });
        await page.evaluate(() => {
            const spacer = document.createElement('div');
            spacer.id = 'spacer';
            document.getElementById('test-container')!.appendChild(spacer);
        });
        const grid = await mountGrid(page);

        await page.evaluate(() => window.scrollTo(0, 200));
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(200);
        await waitForGridReady(grid);

        const [gridBox] = await boxes(grid);
        expect(gridBox.y).toBeCloseTo(200, 0);
        const point = { x: 300, y: 300 };
        await page.mouse.click(point.x, point.y, { button: 'right' });

        const first = contextPopup(grid).locator(':scope > vi-action-button').first();
        await expect(first).toBeAttached();
        const [button] = await boxes(first);
        expect(button.y - point.y).toBeGreaterThanOrEqual(0);
        expect(button.y - point.y).toBeLessThanOrEqual(10);
        expect(Math.abs(button.x - point.x)).toBeLessThanOrEqual(4);
    });

    test('a second right-click replaces the first menu', case_('rows.row-ctx-replaces-previous'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const first = await rowOf(grid, 3);
        await first.locator('.column').first().click({ button: 'right' });
        await expect(contextPopup(grid)).toHaveCount(1);
        await expect(first).toHaveAttribute('actions-open', '');

        // A row above the open menu: the menu covers the rows below the pointer, and Playwright would scroll
        // the grid to reach one of those, which closes the new menu again
        const second = await rowOf(grid, 1);
        await second.locator('.column').first().click({ button: 'right' });
        await expect(second).toHaveAttribute('actions-open', '');
        await expect(contextPopup(grid)).toHaveCount(1);
        await expect(first).not.toHaveAttribute('actions-open', '');
        await expect(page.locator('vi-popup[open]')).toHaveCount(1);
    });

    for (const how of ['Escape', 'an outside click'] as const) {
        test(`the context popup is removed when closed (${how})`, case_('rows.row-ctx-removed-on-close'), async ({ page }) => {
            await gridPageWithOutside(page);
            const grid = await mountGrid(page);
            const baseline = await deepPopupCount(page);

            const row = await rowOf(grid, 1);
            await row.locator('.column').first().click({ button: 'right' });
            await expect(contextPopup(grid)).toHaveCount(1);
            expect(await contextPopupCount(grid)).toBe(1);
            expect(await deepPopupCount(page)).toBeGreaterThan(baseline);
            await expect.poll(() => selectedIndexes(grid)).toEqual([1]);

            if (how === 'Escape')
                await page.keyboard.press('Escape');
            else
                await page.mouse.click(640, 700);

            await expect.poll(() => contextPopupCount(grid)).toBe(0);
            await expect.poll(() => deepPopupCount(page)).toBe(baseline);
            await expect(page.locator('vi-popup[open]')).toHaveCount(0);
            await expect(row).not.toHaveAttribute('actions-open', '');
            expect(await selectedIndexes(grid)).toEqual([1]);
        });
    }
});

/** Replaces window.open with a recorder (window.__opened). */
async function recordWindowOpen(page: Page) {
    await page.evaluate(() => {
        const w = window as any;
        w.__opened = [];
        w.open = (url: any) => {
            w.__opened.push(String(url));
            return null;
        };
    });
}

test.describe('vi-query-grid-row: opening edge cases', () => {
    test('an unknown openaction only warns', case_('rows.row-openaction-unknown'), async ({ page }) => {
        const warnings: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'warning')
                warnings.push(msg.text());
        });
        await gridPage(page, { expectedErrors: [/^No action definition found for DoesNotExist$/] });
        await patchItemHints(page, { '3': { openaction: 'DoesNotExist' } });
        const grid = await mountGrid(page);
        await spyTapAndOpen(page);
        const log = requestLog(page);

        await (await rowOf(grid, 0)).locator('.column').first().click();
        await expect.poll(() => warnings).toContain('Unknown openaction \'DoesNotExist\'.');
        await log.quiet(300);
        expect(await opens(page)).toEqual([]);
        expect(log.of('GetPersistentObject')).toEqual([]);
        expect(log.of('ExecuteAction')).toEqual([]);
    });

    test('ctrl+click opens normally when the app has no getUrlForPersistentObject', case_('rows.row-open-ctrl-without-url-helper'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        expect(await page.evaluate(() => 'getUrlForPersistentObject' in (window as any).app)).toBe(false);
        await spyTapAndOpen(page);
        await recordWindowOpen(page);
        const log = requestLog(page);

        await (await rowOf(grid, 0)).locator('.column').first().click({ modifiers: ['Control'] });
        await expect.poll(() => opens(page)).toHaveLength(1);
        await log.quiet(300);
        expect(await opens(page)).toHaveLength(1);
        expect((await opens(page))[0]).toMatchObject({ objectId: '3' });
        expect(await page.evaluate(() => (window as any).__opened)).toEqual([]);
    });

    test('when two rows are clicked quickly only the last opens', case_('rows.row-open-race-last-wins'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        let first = true;
        let releaseFirst: () => void;
        const firstReleased = new Promise<void>(resolve => releaseFirst = resolve);
        await page.route(/\/GetPersistentObject$/, async route => {
            if (first) {
                first = false;
                await firstReleased;
            }

            await route.continue();
        });
        await spyTapAndOpen(page);
        const log = requestLog(page);
        const second = await grid.evaluate((g: any) => {
            g.query.disableLazyLoading = true;
            try {
                return g.query.items[1].id;
            }
            finally {
                g.query.disableLazyLoading = false;
            }
        });

        await (await rowOf(grid, 0)).locator('.column').first().click();
        await (await rowOf(grid, 1)).locator('.column').first().click();
        // The first item's load only answers once the second row was clicked (the service sends the second load after it)
        await expect.poll(() => taps(page)).toHaveLength(2);
        releaseFirst!();
        await expect.poll(() => opens(page)).toHaveLength(1);
        await expect.poll(() => log.of('GetPersistentObject').length).toBe(2);
        await log.quiet(300);

        expect(await taps(page)).toEqual(['3', second]);
        expect((await opens(page)).map(o => o.objectId)).toEqual([second]);
    });

    test('a double click opens once', case_('rows.row-open-dblclick-once'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await spyTapAndOpen(page);
        const log = requestLog(page);

        await (await rowOf(grid, 0)).locator('.column').first().dblclick();
        await expect.poll(() => opens(page)).toHaveLength(1);
        await log.quiet(300);
        expect(await opens(page)).toHaveLength(1);
        expect((await opens(page))[0]).toMatchObject({ objectId: '3' });
    });

    test('a failing PO load does not open and sets the query notification', case_('rows.row-open-po-error'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await page.route(/\/GetPersistentObject$/, route => route.fulfill({ contentType: 'application/json', json: { exception: 'Boom' } }));
        await spyTapAndOpen(page);
        const log = requestLog(page);

        await (await rowOf(grid, 0)).locator('.column').first().click();
        await expect.poll(() => grid.evaluate((g: any) => g.query.notification)).toBe('Boom');
        expect(await grid.evaluate((g: any) => g.query.notificationType)).toBe('Error');
        await log.quiet(300);
        expect(await opens(page)).toEqual([]);
    });

    test('right and middle clicks do not open', case_('rows.row-open-non-left-buttons'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await spyTapAndOpen(page);
        const log = requestLog(page);
        const cell = (await rowOf(grid, 0)).locator('.column').first();

        await cell.click({ button: 'right' });
        await expect(contextPopup(grid)).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(contextPopup(grid)).toHaveCount(0);

        await cell.click({ button: 'middle' });
        await log.quiet(300);
        expect(await taps(page)).toEqual([]);
        expect(await opens(page)).toEqual([]);
        expect(log.of('GetPersistentObject')).toEqual([]);
    });

    test('loading rows ignore clicks', case_('rows.row-open-placeholder-ignored'), async ({ page }) => {
        await gridPage(page);
        const held = await holdPageLoads(page);
        const grid = await mountGrid(page);
        await scrollToRow(grid, 5000);
        await expect.poll(() => held.count).toBeGreaterThan(0);
        await waitForLoadingRows(grid);
        await spyTapAndOpen(page);
        const log = requestLog(page);

        const target = (await inViewRows(grid))[3];
        await page.mouse.click(400, target.top + target.height / 2);
        await nextFrames(page, 5);
        expect(await taps(page)).toEqual([]);

        await held.release();
        await waitForGridReady(grid);
        await log.quiet(300);
        expect(await taps(page)).toEqual([]);
        expect(await opens(page)).toEqual([]);
        expect(log.of('GetPersistentObject')).toEqual([]);
    });
});

test.describe('vi-query-grid-row: pointer, touch and keyboard semantics', () => {
    test('a press-drag-release inside one row does not open the item', case_('rows.row-drag-within-row-no-open'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await spyTapAndOpen(page);
        const log = requestLog(page);

        const emailColumn = (await headerNames(grid)).indexOf('Email');
        const cell = (await rowOf(grid, 3)).locator('.column').nth(emailColumn);
        const [box] = await boxes(cell);
        const y = box.y + box.height / 2;
        await page.mouse.move(box.x + 10, y);
        await page.mouse.down();
        await page.mouse.move(box.x + 50, y, { steps: 5 });
        await page.mouse.up();

        await log.quiet(300);
        expect(await taps(page)).toEqual([]);
        expect(await opens(page)).toEqual([]);
        expect(log.of('GetPersistentObject')).toEqual([]);

        await cell.click();
        await expect.poll(() => opens(page)).toHaveLength(1);
    });

    test.describe('touch', () => {
        test.use({ hasTouch: true });

        test('a touch tap opens or selects exactly once', case_('rows.row-touch-tap-opens-once'), async ({ page }) => {
            await gridPage(page);
            const grid = await mountGrid(page);
            await spyTapAndOpen(page);
            const log = requestLog(page);

            const [cell] = await boxes((await rowOf(grid, 0)).locator('.column').first());
            await page.touchscreen.tap(cell.x + cell.width / 2, cell.y + cell.height / 2);
            await expect.poll(() => opens(page)).toHaveLength(1);
            await log.quiet(300);
            expect(await taps(page)).toEqual(['3']);
            expect(await opens(page)).toHaveLength(1);
            expect(log.of('GetPersistentObject')).toHaveLength(1);

            const [selector] = await boxes((await rowOf(grid, 2)).locator('[part=selector]'));
            await page.touchscreen.tap(selector.x + selector.width / 2, selector.y + selector.height / 2);
            await expect.poll(() => selectedIndexes(grid)).toEqual([2]);
            await log.quiet(300);
            expect(await grid.evaluate((g: any) => g.query.selectedItems.length)).toBe(1);
            expect(await opens(page)).toHaveLength(1);
            expect(await taps(page)).toEqual(['3']);
        });
    });

    test('item-tap reaches ancestors and preventDefault there cancels opening', case_('rows.item-tap-on-ancestor'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await spyTapAndOpen(page);
        await page.evaluate(() => {
            const w = window as any;
            w.__ancestorTaps = [];
            w.__preventTap = false;
            document.getElementById('test-container')!.addEventListener('item-tap', (e: any) => {
                w.__ancestorTaps.push({ composed: e.composed, cancelable: e.cancelable, targetIsGrid: e.target === w.grid, email: e.detail?.item?.getValue('Email') });
                if (w.__preventTap)
                    e.preventDefault();
            });
        });
        const log = requestLog(page);
        const emails = await grid.evaluate((g: any) => {
            g.query.disableLazyLoading = true;
            try {
                return [0, 1, 2].map(i => g.query.items[i].getValue('Email'));
            }
            finally {
                g.query.disableLazyLoading = false;
            }
        });

        await (await rowOf(grid, 0)).locator('.column').first().click();
        await expect.poll(() => opens(page)).toHaveLength(1);
        await (await rowOf(grid, 1)).locator('.column').first().click();
        await expect.poll(() => opens(page)).toHaveLength(2);
        expect(await page.evaluate(() => (window as any).__ancestorTaps)).toEqual([
            { composed: true, cancelable: true, targetIsGrid: true, email: emails[0] },
            { composed: true, cancelable: true, targetIsGrid: true, email: emails[1] }
        ]);

        await log.quiet(300);
        log.clear();
        await page.evaluate(() => (window as any).__preventTap = true);
        await (await rowOf(grid, 2)).locator('.column').first().click();
        await expect.poll(() => page.evaluate(() => (window as any).__ancestorTaps.length)).toBe(3);
        await log.quiet(300);
        expect(await opens(page)).toHaveLength(2);
        expect(log.of('GetPersistentObject')).toEqual([]);
    });
});

test.describe('vi-query-grid-row: initialization and lifecycle', () => {
    /** Samples every frame: while the grid has [initializing], any shown row control or group row is a violation. */
    async function startInitSampler(page: Page) {
        await page.evaluate(() => {
            const w = window as any;
            w.__init = { frames: 0, violations: [] as string[], stop: false };
            const shown = (e: Element) => {
                const style = getComputedStyle(e);
                const box = e.getBoundingClientRect();
                return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
            };
            const sample = () => {
                const g = document.querySelector('#test-container > vi-query-grid') as any;
                if (g?.shadowRoot && g.hasAttribute('initializing')) {
                    w.__init.frames++;
                    for (const r of [...g.shadowRoot.querySelectorAll('vi-query-grid-row')] as any[]) {
                        for (const part of ['selector', 'actions', 'filter', 'groupspacer']) {
                            const element = r.shadowRoot?.querySelector(`[part=${part}]`);
                            if (element && shown(element))
                                w.__init.violations.push(`${part} shown`);
                        }

                        if (r.hasAttribute('is-group') && shown(r))
                            w.__init.violations.push('group row shown');
                    }
                }

                if (!w.__init.stop)
                    requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
        });
    }

    async function stopInitSampler(page: Page): Promise<{ frames: number; violations: string[] }> {
        return page.evaluate(() => {
            const w = window as any;
            w.__init.stop = true;
            return { frames: w.__init.frames, violations: [...new Set(w.__init.violations as string[])] };
        });
    }

    test('rows hide pinned parts while the grid initializes', case_('rows.row-init-hides-controls'), async ({ page }) => {
        await gridPage(page);
        await startInitSampler(page);
        const grid = await mountGrid(page);

        const result = await stopInitSampler(page);
        expect(result.frames).toBeGreaterThan(0);
        expect(result.violations).toEqual([]);

        const shown = await shownParts(await rowOf(grid, 0));
        expect(shown).toContain('selector');
        expect(shown).toContain('actions');
    });

    test('rows hide group rows while a pre-grouped grid initializes', case_('rows.row-init-hides-controls'), async ({ page }) => {
        await gridPage(page);
        await startInitSampler(page);
        const grid = await mountPrepared(page, { prepare: async (q: any) => { await q.group('Gender'); } });

        const result = await stopInitSampler(page);
        expect(result.frames).toBeGreaterThan(0);
        expect(result.violations).toEqual([]);

        await expect((await groupRowOf(grid, 0)).locator('vi-query-grid-row-group')).toBeVisible();
        const shown = await shownParts(await rowOf(grid, 0));
        expect(shown).toContain('selector');
        expect(shown).toContain('actions');
    });

    test('two grids on one page measure independently', case_('rows.row-width-two-grids'), async ({ page }) => {
        await gridPage(page, { width: 1600, styles: '#two { display: flex; height: 100%; } #two > vi-query-grid { height: 100%; flex: none; }' });
        await page.evaluate(async () => {
            const w = window as any;
            const [people, top10] = await Promise.all([w.service.getQuery('People'), w.service.getQuery('PeopleTop10')]);
            const two = document.createElement('div');
            two.id = 'two';
            document.getElementById('test-container')!.appendChild(two);

            // Both grids are created and attached in the same task
            for (const [query, width] of [[people, 1000], [top10, 560]] as const) {
                const grid = document.createElement('vi-query-grid') as any;
                grid.style.width = `${width}px`;
                grid.query = query;
                two.appendChild(grid);
            }
        });

        for (const [index, width] of [[0, 1000], [1, 560]]) {
            const grid = page.locator('#two > vi-query-grid').nth(index);
            await waitForGridReady(grid);
            await expect(grid).not.toHaveAttribute('initializing', '');
            expect((await grid.boundingBox())!.width).toBeCloseTo(width, 0);

            const tracks = await grid.evaluate((g: any) => [...getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').matchAll(/(\d+(?:\.\d+)?)px/g)].map(m => parseFloat(m[1])));
            expect(tracks, `grid ${index} tracks`).toHaveLength(9);

            const cells = await boxes((await rowOf(grid, 0)).locator('.column'));
            const headers = await boxes(grid.locator('vi-query-grid-column-header'));
            expect(cells).toHaveLength(9);
            expect(headers).toHaveLength(9);
            tracks.forEach((track, k) => {
                expect(Math.abs(cells[k].width - track), `grid ${index} cell ${k}`).toBeLessThanOrEqual(1);
                expect(Math.abs(headers[k].width - track), `grid ${index} header ${k}`).toBeLessThanOrEqual(1);
            });
        }
    });

    test('no runtime errors across row state changes', case_('rows.row-no-errors'), async ({ page }) => {
        const errors = pageErrors(page);
        page.on('console', msg => {
            if (msg.type() === 'error')
                errors.push(msg.text());
        });
        await gridPage(page);
        const grid = await mountGrid(page);
        await spyTapAndOpen(page);

        // Scroll through the result without waiting for pages, so rows switch between items and placeholders
        for (let index = 0; index <= 9000; index += 1500) {
            await scrollToRow(grid, index);
            await nextFrames(page, 2);
        }
        await scrollToRowAndWait(grid, 9000);
        await scrollToRowAndWait(grid, 0);

        // Grouping, collapsing and ungrouping
        await page.evaluate(async () => { await (window as any).q.group('BirthDate'); });
        await waitForGridReady(grid);
        await (await groupRowOf(grid, 0)).locator('vi-query-grid-row-group').click();
        await waitForGridReady(grid);
        await (await groupRowOf(grid, 0)).locator('vi-query-grid-row-group').click();
        await waitForGridReady(grid);
        await page.evaluate(async () => { await (window as any).q.group(''); });
        await waitForGridReady(grid);

        // Both menus, hovering and opening
        await openInline(grid, 1);
        await page.keyboard.press('Escape');
        await (await rowOf(grid, 2)).locator('.column').first().click({ button: 'right' });
        await expect(contextPopup(grid)).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(contextPopup(grid)).toHaveCount(0);
        for (const index of [3, 4, 5])
            await (await rowOf(grid, index)).locator('.column').first().hover();
        await (await rowOf(grid, 0)).locator('.column').first().click();
        await expect.poll(() => opens(page)).toHaveLength(1);

        // Swapping the query
        await swapQuery(grid, 'PeopleTop10');
        await scrollToRowAndWait(grid, 0);
        expect((await visibleRows(grid)).length).toBe(10);

        expect(errors).toEqual([]);
    });

    test('rows keep working after detach and reattach', case_('rows.row-reattach'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const before = (await visibleRows(grid)).map(r => ({ index: r.index, texts: r.texts }));

        await page.evaluate(() => {
            const w = window as any;
            const container = document.getElementById('test-container')!;
            w.grid.remove();
            container.appendChild(w.grid);
        });
        await waitForGridReady(grid);
        expect((await visibleRows(grid)).map(r => ({ index: r.index, texts: r.texts }))).toEqual(before);

        await (await rowOf(grid, 1)).locator('[part=selector]').click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([1]);

        await spyTapAndOpen(page);
        await (await rowOf(grid, 2)).locator('.column').first().click();
        await expect.poll(() => opens(page)).toHaveLength(1);
    });
});
