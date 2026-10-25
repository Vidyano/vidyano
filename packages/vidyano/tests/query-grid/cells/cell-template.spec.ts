import { expect, Page, test } from '@playwright/test';
import { gridPage, mountGrid } from '../_helpers/query-grid';
import { readCells, rowCells, wheelGrid } from '../_helpers/cells';
import { injectTotalItem } from '../_helpers/rows';

/**
 * Defines `window.__html`, a tag that builds Lit template results the way lit's `html` does, and
 * `window.__templates`, the disposers of the templates a test registers.
 */
async function templatePage(page: Page) {
    await gridPage(page);
    await page.evaluate(() => {
        const w = window as any;
        w.__html = (strings: TemplateStringsArray, ...values: unknown[]) => ({ ['_$litType$']: 1, strings, values });
        w.__templates = [];
    });
}

async function unregisterTemplates(page: Page) {
    await page.evaluate(() => (window as any).__templates.splice(0).forEach((dispose: () => void) => dispose()));
}

test.describe('Cell templates', () => {
    test.afterEach(async ({ page }) => unregisterTemplates(page));

    test('a template for a column type renders inside the default cell', { annotation: [{ type: 'case', description: 'cells.tpl-type' }] }, async ({ page }) => {
        await templatePage(page);
        await page.evaluate(() => {
            const w = window as any;
            const Base = customElements.get('vi-query-grid-cell-default') as any;
            w.__templates.push(Base.registerCellTemplate('String', (value: string, column: any, item: any) =>
                w.__html`<b class="tpl" data-column=${column.name} data-item=${item.id}>${value?.toUpperCase()}</b>`));
        });

        const grid = await mountGrid(page);
        const cells = await rowCells(grid, 0);
        expect(Object.fromEntries(Object.values(cells).map(c => [c.column, c.tag]))).toMatchObject({ FirstName: 'vi-query-grid-cell-default', Gender: 'vi-query-grid-cell-default', IsActive: 'vi-query-grid-cell-boolean' });
        expect([cells.FirstName.text, cells.LastName.text, cells.Email.text]).toEqual(['AARON', 'LEMMENS', 'AARON_LEMMENS59@SKYNET.BE']);
        expect(cells.Gender.text).toBe('Male');

        const rendered = await grid.evaluate((g: any) => {
            const row = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].find((r: any) => r.item === g.query.items[0]) as HTMLElement;
            return [...row.querySelectorAll('.column')].map(c => c.shadowRoot!.querySelector('#text > b.tpl')).filter(b => b).map(b => ({ column: b!.getAttribute('data-column'), item: b!.getAttribute('data-item') }));
        });
        expect(rendered.map(r => r.column)).toEqual(['FirstName', 'LastName', 'Email', 'PhoneNumber']);
        expect(new Set(rendered.map(r => r.item)).size).toBe(1);
    });

    test('a predicate template matches on the column', { annotation: [{ type: 'case', description: 'cells.tpl-predicate' }] }, async ({ page }) => {
        await templatePage(page);
        await page.evaluate(() => {
            const w = window as any;
            const Base = customElements.get('vi-query-grid-cell-default') as any;
            w.__templates.push(Base.registerCellTemplate((column: any) => column.name === 'Email', (value: string) => value.split('@')[1]));
        });

        const grid = await mountGrid(page);
        const cells = await rowCells(grid, 0);
        expect([cells.Email.text, cells.FirstName.text]).toEqual(['skynet.be', 'Aaron']);
    });

    test('a registered cell type wins over a template, the latest template over earlier ones', { annotation: [{ type: 'case', description: 'cells.tpl-precedence' }] }, async ({ page }) => {
        await templatePage(page);
        const resolved = await page.evaluate(() => {
            const w = window as any;
            const Base = customElements.get('vi-query-grid-cell-default') as any;
            w.__templates.push(Base.registerCellTemplate('Boolean', () => 'template'));
            w.__templates.push(Base.registerCellTemplate('String', () => 'first'));
            w.__templates.push(Base.registerCellTemplate((column: any) => column.name === 'FirstName', () => 'second'));

            return {
                boolean: Base.resolveCellType({ type: 'Boolean' }) === customElements.get('vi-query-grid-cell-boolean'),
                string: Base.resolveCellType({ type: 'String' }) === Base,
                image: Base.resolveCellType({ type: 'Image' }) === customElements.get('vi-query-grid-cell-image'),
                unknown: Base.resolveCellType({ type: 'Unknown' }) === Base
            };
        });
        expect(resolved).toEqual({ boolean: true, string: true, image: true, unknown: true });

        const grid = await mountGrid(page);
        const cells = await rowCells(grid, 0);
        expect([cells.FirstName.text, cells.LastName.text]).toEqual(['second', 'first']);
        expect([cells.IsActive.tag, cells.IsActive.text, cells.IsActive.icons.map(i => i.selected)]).toEqual(['vi-query-grid-cell-boolean', '', [true]]);
    });

    test('a displayformat keeps priority over a template', { annotation: [{ type: 'case', description: 'cells.tpl-displayformat' }] }, async ({ page }) => {
        await injectTotalItem(page, [{ key: 'FirstName', value: 'Total' }], { displayformat: '[{0}]' });
        await templatePage(page);
        await page.evaluate(() => {
            const w = window as any;
            const Base = customElements.get('vi-query-grid-cell-default') as any;
            w.__templates.push(Base.registerCellTemplate('String', () => 'template'));
        });

        const grid = await mountGrid(page);
        expect((await rowCells(grid, 0)).FirstName.text).toBe('template');
        await expect.poll(() => grid.evaluate((g: any) => {
            const cell = [...g.shadowRoot.querySelector('vi-query-grid-footer').querySelectorAll('.column')][0] as HTMLElement;
            return cell?.shadowRoot?.querySelector('#text')?.textContent;
        })).toBe('[Total]');
    });

    test('an open grid picks up registered and removed templates with its next values', { annotation: [{ type: 'case', description: 'cells.tpl-unregister' }] }, async ({ page }) => {
        await templatePage(page);
        const grid = await mountGrid(page);
        const firstNames = async () => [...new Set((await readCells(grid)).map(r => r.cells.FirstName.text === 'template' ? 'template' : 'text'))];
        expect(await firstNames()).toEqual(['text']);

        await page.evaluate(() => {
            const w = window as any;
            const Base = customElements.get('vi-query-grid-cell-default') as any;
            w.__templates.push(Base.registerCellTemplate('String', () => 'template'));
        });
        await wheelGrid(page, grid, 40 * 32);
        expect(await firstNames()).toEqual(['template']);

        await unregisterTemplates(page);
        await wheelGrid(page, grid, -40 * 32);
        expect(await firstNames()).toEqual(['text']);
        expect((await rowCells(grid, 0)).FirstName.text).toBe('Aaron');
    });

    test('a recycled cell renders the template for its new value', { annotation: [{ type: 'case', description: 'cells.tpl-recycle' }] }, async ({ page }) => {
        await templatePage(page);
        await page.evaluate(() => {
            const w = window as any;
            const Base = customElements.get('vi-query-grid-cell-default') as any;
            w.__calls = 0;
            w.__templates.push(Base.registerCellTemplate((column: any) => column.name === 'FirstName', (value: string, column: any, item: any) => {
                w.__calls++;
                return w.__html`<span>${value}|${item.values.LastName}</span>`;
            }));
        });

        const grid = await mountGrid(page);
        const check = async () => {
            const rows = await readCells(grid);
            expect(rows.length).toBeGreaterThan(5);
            const values = await grid.evaluate((g: any, indexes: number[]) => indexes.map(i => `${g.query.items[i].values.FirstName}|${g.query.items[i].values.LastName}`), rows.map(r => r.index));
            expect(rows.map(r => r.cells.FirstName.text)).toEqual(values);
            return rows;
        };

        const first = await check();
        const cellsBefore = await grid.evaluate((g: any) => g.shadowRoot.querySelectorAll('vi-query-grid-cell-default').length);
        for (const delta of [10 * 32, 40 * 32, -(25 * 32)]) {
            await wheelGrid(page, grid, delta);
            const rows = await check();
            expect(rows[0].index).not.toBe(first[0].index);
        }

        // The cells were recycled, not recreated
        expect(await grid.evaluate((g: any) => g.shadowRoot.querySelectorAll('vi-query-grid-cell-default').length)).toBe(cellsBefore);
        expect(await page.evaluate(() => (window as any).__calls)).toBeGreaterThan(0);
    });
});
