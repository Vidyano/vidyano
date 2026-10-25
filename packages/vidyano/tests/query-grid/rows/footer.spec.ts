import { expect, Locator, test } from '@playwright/test';
import { getScrollOffset, GRID_SCROLLER, gridPage, headerNames, mountGrid, nextFrames, openView, scrollGrid, VIEWS, waitForGridReady } from '../_helpers/query-grid';
import { clickHeaderMenuItem, hostVar } from '../_helpers/grid';
import { boxes, injectTotalItem, mountPrepared, rowOf, swapQuery } from '../_helpers/rows';

const case_ = (id: string) => ({ annotation: [{ type: 'case', description: id }] });

const TOTALS = [
    { key: 'FirstName', value: 'Total' },
    { key: 'Email', value: null },
    { key: 'IsActive', value: 'True' }
];

test.describe('vi-query-grid-footer: presence and layout', () => {
    for (const [name, path] of Object.entries(VIEWS)) {
        test(`no view renders a footer (${name})`, case_('rows.ftr-matrix-absent'), async ({ page }) => {
            const grid = await openView(page, path);

            expect(await grid.evaluate((g: any) => g.query.totalItem)).toBeNull();
            await expect(grid.locator('vi-query-grid-footer')).toBeHidden();
            await expect(grid.locator('footer')).toBeHidden();

            const bottoms = await grid.evaluate((g: any, scrollerFn) => {
                const scroller = new Function(`return (${scrollerFn})`)()(g);
                return { scroller: scroller.getBoundingClientRect().bottom, host: g.getBoundingClientRect().bottom };
            }, GRID_SCROLLER);
            expect(Math.abs(bottoms.scroller - bottoms.host)).toBeLessThanOrEqual(1);
        });
    }

    test('a total item renders a footer below the scroller', case_('rows.ftr-rendered'), async ({ page }) => {
        await gridPage(page);
        await injectTotalItem(page, TOTALS);
        const grid = await mountGrid(page);

        expect(await grid.evaluate((g: any) => !!g.query.totalItem)).toBe(true);
        const footer = grid.locator('vi-query-grid-footer');
        await expect(footer).toBeVisible();

        const layout = await grid.evaluate((g: any, scrollerFn) => {
            const scroller = new Function(`return (${scrollerFn})`)()(g);
            const footer = g.shadowRoot.querySelector('vi-query-grid-footer');
            const wrapper = g.shadowRoot.querySelector('footer');
            return {
                scrollerBottom: scroller.getBoundingClientRect().bottom,
                footerTop: footer.getBoundingClientRect().top,
                wrapperTop: wrapper.getBoundingClientRect().top,
                paddingLeft: getComputedStyle(wrapper).paddingLeft,
                controlsWidth: getComputedStyle(g).getPropertyValue('--vi-query-grid-controls-width').trim()
            };
        }, GRID_SCROLLER);

        expect(layout.footerTop).toBeGreaterThanOrEqual(layout.scrollerBottom - 1);
        expect(Math.abs(layout.wrapperTop - layout.scrollerBottom)).toBeLessThanOrEqual(1);
        expect(layout.controlsWidth).toMatch(/^\d+(\.\d+)?px$/);
        expect(parseFloat(layout.paddingLeft)).toBeCloseTo(parseFloat(layout.controlsWidth), 0);
        expect(parseFloat(layout.controlsWidth)).toBeGreaterThan(0);
    });

    test('one footer cell per column, aligned with headers and cells', case_('rows.ftr-alignment'), async ({ page }) => {
        await gridPage(page, { width: 1600 });
        await injectTotalItem(page, TOTALS);
        const grid = await mountGrid(page);

        const footerCells = await boxes(grid.locator('vi-query-grid-footer .column'));
        const headers = await boxes(grid.locator('vi-query-grid-column-header'));
        const cells = await boxes((await rowOf(grid, 0)).locator('.column'));

        expect(footerCells).toHaveLength(9);
        expect(headers).toHaveLength(9);
        expect(cells).toHaveLength(9);

        footerCells.forEach((cell, k) => {
            expect(Math.abs(cell.x - headers[k].x), `footer ${k} left vs header`).toBeLessThanOrEqual(1);
            expect(Math.abs(cell.width - headers[k].width), `footer ${k} width vs header`).toBeLessThanOrEqual(1);
            expect(Math.abs(cell.x - cells[k].x), `footer ${k} left vs cell`).toBeLessThanOrEqual(1);
            expect(Math.abs(cell.width - cells[k].width), `footer ${k} width vs cell`).toBeLessThanOrEqual(1);
        });
    });
});

test.describe('vi-query-grid-footer: values', () => {
    test('cells show the total per column, empty when missing or null', case_('rows.ftr-values'), async ({ page }) => {
        await gridPage(page);
        await injectTotalItem(page, TOTALS);
        const grid = await mountGrid(page);

        const columns = await grid.evaluate((g: any) => g.query.columns.filter((c: any) => !c.isHidden).map((c: any) => c.name));
        const texts = await footerCellTexts(grid);
        const byName = Object.fromEntries(columns.map((c: string, i: number) => [c, texts[i]]));

        expect(byName.FirstName).toBe('Total');
        expect(byName.Email).toBe('');
        for (const name of ['LastName', 'BirthDate', 'Gender', 'ContactPreference', 'PhoneNumber', 'EmergencyContact'])
            expect(byName[name], name).toBe('');

        expect(texts.some(t => /null|undefined/.test(t ?? ''))).toBe(false);
    });

    for (const [label, totals] of [
        ['missing', TOTALS.filter(t => t.key !== 'IsActive')],
        ['null', [...TOTALS.filter(t => t.key !== 'IsActive'), { key: 'IsActive', value: null }]]
    ] as const) {
        test(`a boolean column with a ${label} total stays empty`, case_('rows.ftr-boolean-empty'), async ({ page }) => {
            await gridPage(page);
            await injectTotalItem(page, [...totals]);
            const grid = await mountGrid(page);

            const footer = grid.locator('vi-query-grid-footer');
            await expect(footer).toBeVisible();
            const byName = await footerTexts(grid);
            expect(byName.FirstName).toBe('Total');
            expect(byName.IsActive).toBe('');
            expect(await footer.locator('vi-query-grid-cell-boolean vi-icon:not([hidden])').count()).toBe(0);
        });
    }

    test('a null total keeps the style hint of its column', case_('rows.ftr-null-style'), async ({ page }) => {
        await gridPage(page);
        await injectTotalItem(page, TOTALS);
        const grid = await mountPrepared(page, {
            prepare: (q: any) => {
                const column = q.columns.find((c: any) => c.name === 'Email');
                column.typeHints = { ...(column.typeHints ?? {}), style: 'background-color: rgb(1, 2, 3)' };
            }
        });

        const names = await headerNames(grid);
        const backgrounds = await grid.locator('vi-query-grid-footer .column').evaluateAll(cells => cells.map(c => getComputedStyle(c).backgroundColor));
        expect(backgrounds[names.indexOf('Email')]).toBe('rgb(1, 2, 3)');
    });

    test('the column DisplayFormat formats the total', case_('rows.ftr-displayformat-column'), async ({ page }) => {
        await gridPage(page);
        await injectTotalItem(page, TOTALS);
        const grid = await mountPrepared(page, {
            prepare: (q: any) => {
                const column = q.columns.find((c: any) => c.name === 'FirstName');
                column.typeHints = { ...(column.typeHints ?? {}), displayformat: 'Σ {0}' };
            }
        });

        const byName = await footerTexts(grid);
        expect(byName.FirstName).toBe('Σ Total');
        expect(byName.Email).toBe('');
    });

    test('item DisplayFormat overrides the column format for every column', case_('rows.ftr-displayformat-item'), async ({ page }) => {
        await gridPage(page);
        await injectTotalItem(page, [...TOTALS, { key: 'LastName', value: 'Sum' }], { displayformat: '[{0}]' });
        const grid = await mountPrepared(page, {
            prepare: (q: any) => {
                const column = q.columns.find((c: any) => c.name === 'FirstName');
                column.typeHints = { ...(column.typeHints ?? {}), displayformat: 'Σ {0}' };
            }
        });

        const byName = await footerTexts(grid);
        expect(byName.FirstName).toBe('[Total]');
        expect(byName.LastName).toBe('[Sum]');
        expect(byName.Email).toBe('');

        const nonEmpty = Object.entries(byName).filter(([, text]) => text !== '');
        expect(nonEmpty.map(([name]) => name).sort()).toEqual(['FirstName', 'IsActive', 'LastName']);
        for (const [name, text] of nonEmpty)
            expect(text, name).toMatch(/^\[.+\]$/);
    });
});

test.describe('vi-query-grid-footer: cell templates', () => {
    test('totals look like the column\'s cells', case_('rows.ftr-cell-templates'), async ({ page }) => {
        await gridPage(page, { width: 1600 });
        // The total repeats the BirthDate and IsActive values of the first item in the response
        let sourceId: string | undefined;
        await page.route(/\/(GetQuery|ExecuteQuery)$/, async route => {
            const response = await route.fetch();
            const json = await response.json();
            const result = /GetQuery$/.test(route.request().url()) ? json.query?.result : json.result;
            const first = result?.items?.[0];
            if (first) {
                sourceId = first.id;
                result.totalItem = { id: 'total', values: [{ key: 'FirstName', value: 'Total' }, ...first.values.filter((v: any) => v.key === 'BirthDate' || v.key === 'IsActive')] };
            }

            await route.fulfill({ response, json });
        });
        const grid = await mountGrid(page);
        await expect(grid.locator('vi-query-grid-footer')).toBeVisible();

        const index = await grid.evaluate((g: any, id) => g.query.items.findIndex((i: any) => i.id === id), sourceId);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(await grid.evaluate((g: any, index) => [g.query.items[index].getValue('BirthDate'), g.query.items[index].getValue('IsActive')].every(v => v != null), index)).toBe(true);

        const describe = (cells: Locator) => cells.evaluateAll((els, fn) => {
            const shownText = new Function(`return (${fn})`)();
            return els.map(e => {
                const icon = e.shadowRoot?.querySelector('vi-icon');
                return { tag: e.tagName.toLowerCase(), text: shownText(e), checked: icon && !icon.hasAttribute('hidden') ? icon.hasAttribute('is-selected') : null };
            });
        }, SHOWN_TEXT);

        const names = await headerNames(grid);
        const footer = await describe(grid.locator('vi-query-grid-footer .column'));
        const cells = await describe((await rowOf(grid, index)).locator('.column'));
        expect(footer).toHaveLength(names.length);
        for (const name of ['BirthDate', 'IsActive'])
            expect(footer[names.indexOf(name)], name).toEqual(cells[names.indexOf(name)]);

        const birthDate = footer[names.indexOf('BirthDate')];
        expect(birthDate.text).not.toBe('');
        expect(birthDate.text).not.toMatch(/GMT|:\d\d:/);
        expect(footer[names.indexOf('IsActive')].checked).not.toBeNull();
        expect(footer[names.indexOf('FirstName')].text).toBe('Total');
    });
});

test.describe('vi-query-grid-footer: style', () => {
    test('footer text style', case_('rows.ftr-style'), async ({ page }) => {
        await gridPage(page);
        await injectTotalItem(page, TOTALS);
        const grid = await mountGrid(page);

        const rowHeight = await grid.evaluate((g: any) => getComputedStyle(g).getPropertyValue('--vi-query-grid-row-height').trim());
        expect(rowHeight).toMatch(/^\d+px$/);

        const styles = await grid.locator('vi-query-grid-footer .column').evaluateAll(els => els.map(e => {
            const style = getComputedStyle(e);
            return { fontWeight: style.fontWeight, whiteSpace: style.whiteSpace, textOverflow: style.textOverflow, lineHeight: style.lineHeight };
        }));
        expect(styles).toHaveLength(9);
        for (const style of styles)
            expect(style).toEqual({ fontWeight: '700', whiteSpace: 'nowrap', textOverflow: 'ellipsis', lineHeight: rowHeight });
    });

    test('numeric totals are right-aligned', case_('rows.ftr-is-numeric'), async ({ page }) => {
        await gridPage(page, { width: 1600 });
        const grid = await mountGrid(page, { query: 'QueryGrid_DataTypes' });
        await expect(grid.locator('vi-query-grid-footer')).toBeVisible();

        const columns: { name: string; type: string }[] = await grid.evaluate((g: any) => g.query.columns.filter((c: any) => !c.isHidden).map((c: any) => ({ name: c.name, type: c.type })));
        const cells = await grid.locator('vi-query-grid-footer .column').evaluateAll(els => els.map(e => {
            const style = getComputedStyle(e);
            const box = e.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(e.shadowRoot?.querySelector('#text') ?? e);
            const text = range.getBoundingClientRect();
            return { text: range.toString(), textAlign: style.textAlign, paddingRight: parseFloat(style.paddingRight), paddingLeft: parseFloat(style.paddingLeft), left: box.left, right: box.right, textLeft: text.left, textRight: text.right };
        }));
        expect(cells).toHaveLength(columns.length);

        const cellOf = (name: string) => cells[columns.findIndex(c => c.name === name)];
        for (const name of ['Int32', 'Decimal']) {
            const cell = cellOf(name);
            expect(columns.find(c => c.name === name)!.type, name).toMatch(/^(Int32|Decimal)$/);
            expect(cell.text, name).not.toBe('');
            expect(cell.textAlign, name).toBe('right');
            expect(Math.abs(cell.right - cell.paddingRight - cell.textRight), `${name} text ends at the right edge`).toBeLessThanOrEqual(1);
        }

        const text = cellOf('Text');
        expect(text.text).toBe('Total');
        expect(['start', 'left']).toContain(text.textAlign);
        expect(Math.abs(text.textLeft - (text.left + text.paddingLeft)), 'Text total starts at the left edge').toBeLessThanOrEqual(1);
    });
});

test.describe('vi-query-grid-footer: horizontal scroll', () => {
    test('the footer scrolls horizontally with the grid', case_('rows.ftr-horizontal-scroll'), async ({ page }) => {
        await gridPage(page, { width: 600 });
        await injectTotalItem(page, TOTALS);
        const grid = await mountGrid(page);

        const offset = await getScrollOffset(grid);
        expect(offset.scrollWidth).toBeGreaterThan(offset.width + 200);
        const before = await boxes(grid.locator('vi-query-grid-footer .column'));

        const body = (await grid.boundingBox())!;
        await page.mouse.move(body.x + body.width / 2, body.y + body.height / 2);
        await page.mouse.wheel(200, 0);
        await expect.poll(async () => (await getScrollOffset(grid)).left).toBe(200);
        await expect.poll(async () => (await boxes(grid.locator('vi-query-grid-footer .column')))[0].x).toBeCloseTo(before[0].x - 200, 0);

        const after = await boxes(grid.locator('vi-query-grid-footer .column'));
        const headers = await boxes(grid.locator('vi-query-grid-column-header'));
        expect(after).toHaveLength(9);
        after.forEach((cell, k) => {
            expect(Math.abs(cell.x - (before[k].x - 200)), `footer ${k} moved -200`).toBeLessThanOrEqual(1);
            expect(Math.abs(cell.x - headers[k].x), `footer ${k} aligned with its header`).toBeLessThanOrEqual(1);
        });
    });

    test('a pinned column keeps its total in place', case_('rows.ftr-pinned'), async ({ page }) => {
        await gridPage(page, { width: 600 });
        await injectTotalItem(page, TOTALS);
        const grid = await mountGrid(page);

        await clickHeaderMenuItem(grid, 'FirstName', 'Pin');
        await expect.poll(() => grid.evaluate((g: any) => g.columns[0]?.name === 'FirstName' && g.columns[0].isPinned)).toBe(true);
        await nextFrames(page, 2);
        const before = await boxes(grid.locator('vi-query-grid-footer .column'));

        await scrollGrid(grid, { left: 200 });
        await expect.poll(() => hostVar(grid, '--vi-query-grid-horizontal')).toBe('200px');
        await nextFrames(page, 2);

        const after = await boxes(grid.locator('vi-query-grid-footer .column'));
        const headers = await boxes(grid.locator('vi-query-grid-column-header'));
        expect(after).toHaveLength(9);
        expect(Math.abs(after[0].x - before[0].x), 'pinned total stays').toBeLessThanOrEqual(1);
        expect(Math.abs(after[0].x - headers[0].x), 'pinned total under its header').toBeLessThanOrEqual(1);
        after.slice(1).forEach((cell, k) => expect(Math.abs(cell.x - (before[k + 1].x - 200)), `footer ${k + 1} moved -200`).toBeLessThanOrEqual(1));
        expect((await footerTexts(grid)).FirstName).toBe('Total');

        // The pinned total paints above the totals that scroll under it
        const hit = await grid.evaluate((g: any, { x, y }) => {
            const cells = [...g.shadowRoot.querySelectorAll('vi-query-grid-footer .column')];
            return cells.indexOf(g.shadowRoot.elementFromPoint(x, y));
        }, { x: after[0].x + after[0].width / 2, y: after[0].y + after[0].height / 2 });
        expect(hit).toBe(0);

        // Totals scrolled past the pinned total do not show in the controls gutter to its left
        const gutter = await grid.evaluate((g: any, y) => {
            const wrapper = g.shadowRoot.querySelector('footer').getBoundingClientRect();
            const x = wrapper.left + parseFloat(getComputedStyle(g).getPropertyValue('--vi-query-grid-controls-width')) / 2;
            return g.shadowRoot.elementFromPoint(x, y)?.classList.contains('column') ?? false;
        }, after[0].y + after[0].height / 2);
        expect(gutter).toBe(false);
    });
});

test.describe('vi-query-grid-footer: lifecycle', () => {
    test('the footer follows totalItem across searches', case_('rows.ftr-updates-on-search'), async ({ page }) => {
        await gridPage(page);
        let total: string | null = 'Total';
        await page.route(/\/(GetQuery|ExecuteQuery)$/, async route => {
            const response = await route.fetch();
            const json = await response.json();
            const result = /GetQuery$/.test(route.request().url()) ? json.query?.result : json.result;
            if (result && total != null)
                result.totalItem = { id: 'total', values: [{ key: 'FirstName', value: total }] };

            await route.fulfill({ response, json });
        });
        const grid = await mountGrid(page);
        const footer = grid.locator('vi-query-grid-footer');
        await expect(footer).toBeVisible();
        expect((await footerTexts(grid)).FirstName).toBe('Total');

        total = 'Total 2';
        await page.evaluate(async () => { await (window as any).q.search(); });
        await waitForGridReady(grid);
        await expect.poll(async () => (await footerTexts(grid)).FirstName).toBe('Total 2');

        total = null;
        await page.evaluate(async () => { await (window as any).q.search(); });
        await waitForGridReady(grid);
        expect(await grid.evaluate((g: any) => g.query.totalItem)).toBeNull();
        await expect(footer).toBeHidden();
    });

    test('the footer follows column changes', case_('rows.ftr-columns-change'), async ({ page }) => {
        await gridPage(page, { width: 1600 });
        await injectTotalItem(page, TOTALS);
        const grid = await mountGrid(page);
        await expect(grid.locator('vi-query-grid-footer .column')).toHaveCount(9);

        await swapQuery(grid, 'People', (q: any) => { q.columns.find((c: any) => c.name === 'Email').isHidden = true; });
        await expect(grid.locator('vi-query-grid-footer .column')).toHaveCount(8);

        const footerCells = await boxes(grid.locator('vi-query-grid-footer .column'));
        const headers = await boxes(grid.locator('vi-query-grid-column-header:visible'));
        expect(headers).toHaveLength(8);
        footerCells.forEach((cell, k) => {
            expect(Math.abs(cell.x - headers[k].x), `footer ${k} left vs header`).toBeLessThanOrEqual(1);
            expect(Math.abs(cell.width - headers[k].width), `footer ${k} width vs header`).toBeLessThanOrEqual(1);
        });
        expect(Object.keys(await footerTexts(grid))).not.toContain('Email');
    });
});

/** The footer cell texts keyed by the visible column name (footer cells follow the grid's column order). */
async function footerTexts(grid: Locator): Promise<Record<string, string>> {
    const names = await headerNames(grid);
    const texts = await footerCellTexts(grid);
    expect(texts).toHaveLength(names.length);
    return Object.fromEntries(names.map((name, i) => [name, texts[i]]));
}

/** The text a cell shows, read from its shadow root when it has one (styles skipped); a function source for evaluate. */
const SHOWN_TEXT = `(cell) => {
    const root = cell.shadowRoot;
    if (!root)
        return cell.textContent ?? '';

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let text = '';
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.parentElement?.closest('style'))
            text += node.textContent;
    }

    return text.trim();
}`;

/** The text shown by each cell matched by the locator, in DOM order. */
async function shownTexts(cells: Locator): Promise<string[]> {
    return cells.evaluateAll((els, fn) => els.map(new Function(`return (${fn})`)()), SHOWN_TEXT);
}

/** The text shown by each footer cell, in DOM order. */
async function footerCellTexts(grid: Locator): Promise<string[]> {
    return shownTexts(grid.locator('vi-query-grid-footer .column'));
}
