import { expect, Locator, Page } from '@playwright/test';
import { columnTracks, gridPage, headerNames, mountGrid, pageErrors, test } from '../_helpers/query-grid';
import { CellInfo, iconStyles, ItemDto, itemsValues, keepColumns, loadLanguagesQuery, loadPersonQuery, loadQuery, mountLoaded, patchItems, readCells, rowCells, setColumnHints, setDtoNull, setDtoValue, wheelGrid } from '../_helpers/cells';

const RED = 'rgb(255, 0, 0)';
const CHECKED = 'rgb(85, 85, 85)';
const UNCHECKED = 'rgb(187, 187, 187)';
const WHITE = 'rgb(255, 255, 255)';

/** Every visible IsActive cell has one icon, checked exactly when its item is active. */
async function expectIconsFollowItems(grid: Locator) {
    const rows = await readCells(grid);
    const values = await itemsValues(grid, rows.map(r => r.index), ['Email', 'IsActive']);
    rows.forEach((row, i) => {
        expect(row.cells.Email.text, `row ${row.index} shows its item`).toBe(values[i]!.Email);
        expect(row.cells.IsActive.icons.map(icon => icon.selected), `IsActive of row ${row.index}`).toEqual([values[i]!.IsActive]);
    });

    return rows;
}

/** The icons of the cell that are rendered (not hidden). */
function visibleIcons(cell: CellInfo) {
    return cell.icons.filter(i => !i.hidden);
}

/** Replaces the type hints of a column of `window.q` (undefined removes them). */
async function replaceColumnHints(page: Page, column: string, hints: Record<string, string> | undefined) {
    await page.evaluate(({ column, hints }) => (window as any).q.getColumn(column).typeHints = hints, { column, hints });
}

/** Sends the column's value as an explicit null for the QueryGrid_DataTypes items that match. */
async function patchNull(page: Page, column: string, match: (id: string | null, item: ItemDto) => boolean) {
    await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
        if (match(id, item))
            setDtoNull(item, column);
    });
}

/** The icon style of the given column for item `index`. */
async function iconOf(grid: Locator, index: number, column = 'IsActive') {
    const row = (await iconStyles(grid, column)).find(r => r.index === index);
    expect(row, `row ${index} is in the viewport`).toBeTruthy();
    expect(row!.icon, `row ${index} has an icon`).toBeTruthy();

    return row!.icon!;
}

test.describe('Icon rendering', () => {
    test('true renders a checked Selected icon and no text', { annotation: [{ type: 'case', description: 'cells.bool-true' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const active = (await rowCells(grid, 0)).IsActive;
        expect(active.icons).toHaveLength(1);
        expect(active.icons[0]).toMatchObject({ source: 'Selected', selected: true, hidden: false });
        expect(active.text).toBe('');
    });

    test('false renders an unchecked icon', { annotation: [{ type: 'case', description: 'cells.bool-false' }] }, async ({ page }) => {
        await gridPage(page);
        let grid = await mountGrid(page);

        const hermans = await rowCells(grid, 16);
        expect([hermans.FirstName.text, hermans.LastName.text]).toEqual(['Aaron', 'Hermans']);
        expect(hermans.IsActive.icons).toHaveLength(1);
        expect(hermans.IsActive.icons[0]).toMatchObject({ source: 'Selected', selected: false, checkDisplay: 'none' });
        expect((await rowCells(grid, 0)).IsActive.icons[0].checkDisplay).not.toBe('none');

        await grid.evaluate(g => g.remove());
        grid = await mountGrid(page, { query: 'PeopleTop10' });
        const luna = (await readCells(grid)).find(r => r.cells.FirstName.text === 'Luna' && r.cells.LastName.text === 'Janssen');
        expect(luna, 'Luna Janssen is shown').toBeTruthy();
        expect(luna!.cells.IsActive.icons).toHaveLength(1);
        expect(luna!.cells.IsActive.icons[0]).toMatchObject({ selected: false, checkDisplay: 'none' });
    });

    test('NullableBoolean and YesNo use the boolean cell', { annotation: [{ type: 'case', description: 'cells.bool-types-routing' }] }, async ({ page }) => {
        // Id 1 has true and Id 3 false for both columns
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'NullableBooleanPlain', 'YesNo']);
        const grid = await mountLoaded(page);

        const byId = Object.fromEntries((await readCells(grid)).map(r => [r.cells.Id.text, r.cells]));
        for (const column of ['NullableBooleanPlain', 'YesNo']) {
            for (const [id, selected] of [['1', true], ['3', false]] as const) {
                const cell = byId[id][column];
                expect(cell.tag, `${column} of Id ${id}`).toBe('vi-query-grid-cell-boolean');
                expect(cell.text, `${column} of Id ${id}`).toBe('');
                expect(visibleIcons(cell).map(i => [i.source, i.selected]), `${column} of Id ${id}`).toEqual([['Selected', selected]]);
            }
        }
    });

    test('booleans in person 3 detail queries', { annotation: [{ type: 'case', description: 'cells.bool-detail-queries' }] }, async ({ page }) => {
        await gridPage(page);
        await loadLanguagesQuery(page);
        let grid = await mountLoaded(page);

        const languages = Object.fromEntries((await readCells(grid)).map(r => [r.cells.Language.text, r.cells]));
        const checked = (cells: Record<string, CellInfo>) => ['CanSpeak', 'CanRead', 'CanWrite', 'IsNative'].filter(c => cells[c].icons.some(i => i.selected));
        expect(checked(languages.Dutch)).toEqual(['CanSpeak', 'CanRead', 'CanWrite', 'IsNative']);
        expect(checked(languages.English)).toEqual(['CanSpeak', 'CanRead']);

        await grid.evaluate(g => g.remove());
        await loadPersonQuery(page, 'Person_Addresses');
        grid = await mountLoaded(page);

        const addresses = await readCells(grid);
        expect(addresses.some(r => r.cells.Street.text === 'Gillesstraat 039c')).toBe(true);
        for (const row of addresses) {
            expect(row.cells.IsPrimary.tag).toBe('vi-query-grid-cell-boolean');
            expect(row.cells.IsPrimary.icons.map(i => i.selected), row.cells.Street.text).toEqual([row.cells.Street.text === 'Gillesstraat 039c']);
        }
    });
});

test.describe('Icon styling and layout', () => {
    test('default checked and unchecked colors', { annotation: [{ type: 'case', description: 'cells.bool-colors' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const checked = await iconOf(grid, 0);
        expect(checked.fills).toEqual({ box: CHECKED, backdrop: CHECKED, check: WHITE });
        const unchecked = await iconOf(grid, 16);
        expect(unchecked.fills.box).toBe(UNCHECKED);
        expect(unchecked.checkDisplay).toBe('none');
    });

    test('the checked-color CSS variable overrides the checked fill', { annotation: [{ type: 'case', description: 'cells.bool-color-var' }] }, async ({ page }) => {
        await gridPage(page, { styles: `vi-query-grid { --vi-query-grid-cell-boolean-checked-color: ${RED}; }` });
        const grid = await mountGrid(page);

        const checked = await iconOf(grid, 0);
        expect([checked.fills.box, checked.fills.backdrop]).toEqual([RED, RED]);
        expect((await iconOf(grid, 16)).fills.box).toBe(UNCHECKED);
    });

    test('a foreground hint does not recolor the icon', { annotation: [{ type: 'case', description: 'cells.bool-foreground-no-icon-effect' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await setColumnHints(page, 'IsActive', { foreground: RED });
        const grid = await mountLoaded(page);

        const checked = await iconOf(grid, 0);
        expect([checked.fills.box, checked.fills.backdrop]).toEqual([CHECKED, CHECKED]);
        expect((await iconOf(grid, 16)).fills.box).toBe(UNCHECKED);
    });

    test('a 16px icon centered in a row-height box', { annotation: [{ type: 'case', description: 'cells.bool-layout' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const icons = (await iconStyles(grid, 'IsActive')).filter(r => r.icon);
        expect(icons.length).toBeGreaterThan(5);
        for (const { index, icon } of icons) {
            expect(Math.round(icon!.iconBox.height), `row ${index}`).toBe(32);
            expect([Math.round(icon!.svgBox!.width), Math.round(icon!.svgBox!.height)], `row ${index}`).toEqual([16, 16]);
            const cell = icon!.cellBox;
            const svg = icon!.svgBox!;
            expect(Math.abs((svg.left + svg.width / 2) - (cell.left + cell.width / 2)), `row ${index} horizontal`).toBeLessThanOrEqual(1);
            expect(Math.abs((svg.top + svg.height / 2) - (cell.top + cell.height / 2)), `row ${index} vertical`).toBeLessThanOrEqual(1);
        }
    });

    test('the IsActive column width comes from its header', { annotation: [{ type: 'case', description: 'cells.bool-column-width' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const names = await headerNames(grid);
        const tracks = await columnTracks(grid);
        const track = tracks[names.indexOf('IsActive')];
        const header = await grid.evaluate((g: any) => {
            const h = g.shadowRoot.querySelector('vi-query-grid-column-header[name="IsActive"]') as HTMLElement;
            return h.getBoundingClientRect().width;
        });
        expect(Math.abs(track - header)).toBeLessThanOrEqual(1);

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows)
            expect(Math.abs(row.cells.IsActive.box.width - header), `row ${row.index}`).toBeLessThanOrEqual(1);
    });
});

test.describe('Text keys', () => {
    test('truekey and falsekey replace the icon with text', { annotation: [{ type: 'case', description: 'cells.bool-text-keys' }] }, async ({ page }) => {
        await gridPage(page);

        for (const [hints, expected] of [[{ truekey: 'HideColumn', falsekey: 'ClearFilter' }, ['Hide column', 'Clear']], [{ truekey: 'Active!', falsekey: 'Inactive!' }, ['Active!', 'Inactive!']]] as const) {
            await page.evaluate(() => document.querySelector('#test-container > vi-query-grid')?.remove());
            await loadQuery(page);
            await setColumnHints(page, 'IsActive', hints);
            const grid = await mountLoaded(page);

            for (const [index, text] of [[0, expected[0]], [16, expected[1]]] as const) {
                const cell = (await rowCells(grid, index)).IsActive;
                expect(cell.text, `row ${index} with ${JSON.stringify(hints)}`).toBe(text);
                expect(visibleIcons(cell), `row ${index} with ${JSON.stringify(hints)}`).toEqual([]);
            }
        }
    });

    test('with only truekey, true shows text and false an icon', { annotation: [{ type: 'case', description: 'cells.bool-only-truekey-mixed' }] }, async ({ page }) => {
        // Tall enough to show rows 16 and 41 (both inactive) on the first render
        await gridPage(page, { height: 1500 });
        await loadQuery(page);
        await setColumnHints(page, 'IsActive', { truekey: 'HideColumn' });
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        expect(rows.some(r => r.index === 41)).toBe(true);
        const values = await itemsValues(grid, rows.map(r => r.index), ['IsActive']);
        rows.forEach((row, i) => {
            const cell = row.cells.IsActive;
            if (values[i]!.IsActive) {
                expect(cell.text, `row ${row.index}`).toBe('Hide column');
                expect(visibleIcons(cell), `row ${row.index}`).toEqual([]);
            }
            else {
                expect(cell.text, `row ${row.index}`).toBe('');
                expect(visibleIcons(cell).map(i => i.selected), `row ${row.index}`).toEqual([false]);
            }
        });
        expect(values.filter(v => !v!.IsActive).length).toBeGreaterThanOrEqual(2);
    });

    test('item-level key hints are ignored', { annotation: [{ type: 'case', description: 'cells.bool-item-hints-ignored' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(() => (window as any).q.items[0].typeHints.truekey = 'HideColumn');
        const grid = await mountLoaded(page);

        const active = (await rowCells(grid, 0)).IsActive;
        expect(active.text).toBe('');
        expect(visibleIcons(active).map(i => i.selected)).toEqual([true]);
    });
});

test.describe('Null and missing values', () => {
    test('null renders an em dash', { annotation: [{ type: 'case', description: 'cells.bool-null-dash' }] }, async ({ page }) => {
        // Id 2 has a null NullableBoolean (sent as an explicit null value)
        await patchNull(page, 'NullableBoolean', id => id === '2');
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'NullableBoolean']);
        await replaceColumnHints(page, 'NullableBoolean', {});
        const grid = await mountLoaded(page);

        const cell = (await readCells(grid)).find(r => r.cells.Id.text === '2')!.cells.NullableBoolean;
        expect(cell.text).toBe('—');
        expect(visibleIcons(cell)).toEqual([]);
    });

    test('nullkey replaces the dash and is translated', { annotation: [{ type: 'case', description: 'cells.bool-null-nullkey' }] }, async ({ page }) => {
        // A key without a translation is shown as is
        await patchNull(page, 'NullableBoolean', id => id === '2');
        await gridPage(page);

        for (const [nullkey, expected] of [['n/a', 'n/a'], ['HideColumn', 'Hide column']]) {
            await page.evaluate(() => document.querySelector('#test-container > vi-query-grid')?.remove());
            await loadQuery(page, 'QueryGrid_DataTypes');
            await keepColumns(page, ['Id', 'Text', 'NullableBoolean']);
            await replaceColumnHints(page, 'NullableBoolean', { nullkey });
            const grid = await mountLoaded(page);

            const cell = (await readCells(grid)).find(r => r.cells.Id.text === '2')!.cells.NullableBoolean;
            expect(cell.text, nullkey).toBe(expected);
            expect(visibleIcons(cell), nullkey).toEqual([]);
        }
    });

    test('a missing value renders like null', { annotation: [{ type: 'case', description: 'cells.bool-missing-value' }] }, async ({ page }) => {
        // Id 1 has no NullableBoolean value at all; Id 2 has an explicit null value
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '1')
                setDtoValue(item, 'NullableBoolean', null);
            else if (id === '2')
                setDtoNull(item, 'NullableBoolean');
        });
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'NullableBoolean']);
        await replaceColumnHints(page, 'NullableBoolean', {});
        const grid = await mountLoaded(page);

        let byId = Object.fromEntries((await readCells(grid)).map(r => [r.cells.Id.text, r.cells.NullableBoolean]));
        expect(byId['1'].text).toBe('—');
        expect(visibleIcons(byId['1'])).toEqual([]);
        expect(byId['2'].text).toBe('—');
        expect(visibleIcons(byId['2'])).toEqual([]);

        await grid.evaluate(g => g.remove());
        await replaceColumnHints(page, 'NullableBoolean', { nullkey: 'HideColumn' });
        const withKey = await mountLoaded(page);
        byId = Object.fromEntries((await readCells(withKey)).map(r => [r.cells.Id.text, r.cells.NullableBoolean]));
        expect([byId['1'].text, byId['2'].text]).toEqual(['Hide column', 'Hide column']);
    });

    test('null without typeHints renders a dash', { annotation: [{ type: 'case', description: 'cells.bool-null-no-typehints-crash' }] }, async ({ page }) => {
        // Id 2 has a null NullableBooleanPlain (an explicit null value); its column gets no typeHints at all
        await patchNull(page, 'NullableBooleanPlain', id => id === '2');
        const errors = pageErrors(page);
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'NullableBooleanPlain', 'Int32']);
        await replaceColumnHints(page, 'NullableBooleanPlain', undefined);
        const grid = await mountLoaded(page);

        const byId = Object.fromEntries((await readCells(grid)).map(r => [r.cells.Id.text, r.cells]));
        expect(byId['2'].NullableBooleanPlain.text).toBe('—');
        expect(visibleIcons(byId['2'].NullableBooleanPlain)).toEqual([]);
        expect(byId['2'].Int32.text).toBe('0');
        expect(byId['1'].Text.text).toBe('Alpha');
        expect(visibleIcons(byId['1'].NullableBooleanPlain).map(i => i.selected)).toEqual([true]);
        expect(errors).toEqual([]);
    });
});

test.describe('Recycling', () => {
    test('icon state follows the item when rows are recycled', { annotation: [{ type: 'case', description: 'cells.bool-recycle' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const seen = new Set<number>();
        const step = async () => (await expectIconsFollowItems(grid)).forEach(r => seen.add(r.index));

        await step();
        for (let i = 0; i < 3; i++) {
            await wheelGrid(page, grid, 20 * 32);
            await step();
        }

        for (let i = 0; i < 3; i++) {
            await wheelGrid(page, grid, -20 * 32);
            await step();
        }

        // The walk crossed the two inactive people near the top (rows 16 and 41) and reached row 60
        expect(seen.has(16) && seen.has(41) && seen.has(60)).toBe(true);
        expect((await itemsValues(grid, [16, 41], ['IsActive'])).map(v => v!.IsActive)).toEqual([false, false]);
    });

    test('recycling between null and values stays consistent', { annotation: [{ type: 'case', description: 'cells.bool-null-to-value' }] }, async ({ page }) => {
        // Generated rows of NullableBooleanPlain cycle null, true, false; the nulls of even Ids are sent as explicit null values, the others are missing
        await patchNull(page, 'NullableBooleanPlain', (id, item) => Number(id) % 2 === 0 && !item.values.some(v => v.key === 'NullableBooleanPlain' && v.value != null));
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'NullableBooleanPlain']);
        await replaceColumnHints(page, 'NullableBooleanPlain', {});
        const grid = await mountLoaded(page);

        const seen = { null: 0, true: 0, false: 0 };
        const check = async () => {
            const rows = await readCells(grid);
            const values = await itemsValues(grid, rows.map(r => r.index), ['NullableBooleanPlain']);
            rows.forEach((row, i) => {
                const value = values[i]!.NullableBooleanPlain as boolean | null;
                const cell = row.cells.NullableBooleanPlain;
                const label = `Id ${row.cells.Id.text} (${value})`;
                if (value == null) {
                    expect(cell.text, label).toBe('—');
                    expect(visibleIcons(cell), label).toEqual([]);
                }
                else {
                    expect(cell.text, label).toBe('');
                    expect(visibleIcons(cell).map(icon => icon.selected), label).toEqual([value]);
                }
                seen[String(value) as keyof typeof seen]++;
            });
        };

        await check();
        for (const delta of [20 * 32, 20 * 32 + 16, 20 * 32, -(13 * 32), -(30 * 32)]) {
            await wheelGrid(page, grid, delta);
            await check();
        }

        expect(seen.null).toBeGreaterThan(5);
        expect(seen.true).toBeGreaterThan(5);
        expect(seen.false).toBeGreaterThan(5);
    });

    test('the text branch hides the icon after recycle', { annotation: [{ type: 'case', description: 'cells.bool-only-truekey-recycle-hides-icon' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await setColumnHints(page, 'IsActive', { truekey: 'HideColumn' });
        const grid = await mountLoaded(page);

        const check = async () => {
            const rows = await readCells(grid);
            const values = await itemsValues(grid, rows.map(r => r.index), ['IsActive']);
            rows.forEach((row, i) => {
                const cell = row.cells.IsActive;
                if (values[i]!.IsActive) {
                    expect(cell.text, `row ${row.index}`).toBe('Hide column');
                    expect(visibleIcons(cell), `row ${row.index}`).toEqual([]);
                }
                else {
                    expect(cell.text, `row ${row.index}`).toBe('');
                    expect(visibleIcons(cell).map(icon => icon.selected), `row ${row.index}`).toEqual([false]);
                }
            });
        };

        await check();
        for (let i = 0; i < 3; i++) {
            await wheelGrid(page, grid, 20 * 32);
            await check();
        }
    });
});
