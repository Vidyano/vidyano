import { expect, Locator, Page, test } from '@playwright/test';
import { gridPage, mountGrid, pageErrors, scrollGrid, visibleRows, waitForGridReady } from '../_helpers/query-grid';
import { CellInfo, itemsValues, keepColumns, loadLanguagesQuery, loadQuery, mountLoaded, patchItems, readCells, rowCells, setColumnHints, setDtoNull, setDtoValue, setItemValues, wheelGrid } from '../_helpers/cells';
import { injectTotalItem } from '../_helpers/rows';

const PEOPLE_COLUMNS = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];
const LEMMENS = 'Aaron_Lemmens59@skynet.be';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** Removes the grid of the previous step, if any. */
async function removeGrid(page: Page) {
    await page.evaluate(() => document.querySelector('#test-container > vi-query-grid')?.remove());
}

/** Rows of QueryGrid_DataTypes in the viewport, keyed by their Id text. */
async function cellsById(grid: Locator) {
    return Object.fromEntries((await readCells(grid)).map(r => [r.cells.Id.text, r.cells])) as Record<string, Record<string, CellInfo>>;
}

/** The culture's number separators. */
async function numberFormat(page: Page): Promise<{ decimal: string; group: string }> {
    return page.evaluate(() => {
        const nf = (window as any).Vidyano.CultureInfo.currentCulture.numberFormat;
        return { decimal: nf.numberDecimalSeparator, group: nf.numberGroupSeparator };
    });
}

/** Registers a cell class for a type, runs the body and restores the original registration. */
async function withCellType(page: Page, type: string, cellTag: string, body: () => Promise<void>) {
    await page.evaluate(({ type, cellTag }) => {
        const Base = customElements.get('vi-query-grid-cell-default') as any;
        const w = window as any;
        (w.__cellTypes ??= {})[type] = Base.getCellTypeConstructor(type);
        Base.registerCellType(type, customElements.get(cellTag));
    }, { type, cellTag });

    try {
        await body();
    }
    finally {
        await page.evaluate(type => (customElements.get('vi-query-grid-cell-default') as any).registerCellType(type, (window as any).__cellTypes[type]), type);
    }
}

test.describe('Strings, enums and references', () => {
    test('string values render verbatim', { annotation: [{ type: 'case', description: 'cells.def-fmt-string' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const cells = await rowCells(grid, 0);
        expect(cells.FirstName.text).toBe('Aaron');
        expect(cells.LastName.text).toBe('Lemmens');
        expect(cells.Email.text).toBe('Aaron_Lemmens59@skynet.be');
        expect(cells.PhoneNumber.text).toBe('0475 26 85 00');
    });

    test('enum values render as the raw enum name', { annotation: [{ type: 'case', description: 'cells.def-fmt-enum' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const cells = await rowCells(grid, 0);
        expect(cells.Gender.text).toBe('Male');
        expect(cells.ContactPreference.text).toBe('Email');

        await scrollGrid(grid, { top: 36 * 32 });
        await waitForGridReady(grid);
        expect((await rowCells(grid, 41)).Gender.text).toBe('Unknown');
    });

    test('reference values render only the display value', { annotation: [{ type: 'case', description: 'cells.def-fmt-reference' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const contact = (await rowCells(grid, 0)).EmergencyContact;
        expect(contact.text).toBe('Thomas Decock');
        expect(contact.textChildElements).toBe(0);
        expect(contact.text).not.toContain('5568');
    });

    test('multi-line strings stay on one line', { annotation: [{ type: 'case', description: 'cells.def-fmt-multiline' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'MultiLine']);
        const grid = await mountLoaded(page);

        const multiLine = (await cellsById(grid))['1'].MultiLine;
        expect(multiLine.text).toBe('Alpha line 1\nAlpha line 2');
        expect(Math.round(multiLine.box.height)).toBe(32);
        expect(multiLine.textStyle['white-space']).toBe('nowrap');
        expect(multiLine.textBox!.height).toBeLessThanOrEqual(32);
    });
});

test.describe('Dates and times', () => {
    test('Date shows the culture\'s short date without the time', { annotation: [{ type: 'case', description: 'cells.def-fmt-date' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        expect((await rowCells(grid, 0)).BirthDate.text).toBe('10/11/1947');

        await scrollGrid(grid, { top: 45 * 32 });
        await waitForGridReady(grid);
        expect((await rowCells(grid, 50)).BirthDate.text).toBe('02/11/1954');
    });

    test('DateTime and DateTimeOffset show short date and short time', { annotation: [{ type: 'case', description: 'cells.def-fmt-datetime' }] }, async ({ page }) => {
        // Id 1: DateTime 2024-01-15 13:45:30 and DateTimeOffset 2024-01-15 13:45:30 +02:00
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'DateTime', 'DateTimeOffset']);
        const grid = await mountLoaded(page);

        const first = (await cellsById(grid))['1'];
        expect(first.DateTime.text).toBe('15/01/2024 13:45');
        expect(first.DateTimeOffset.text).toBe('15/01/2024 13:45');
    });

    test('Time values are trimmed', { annotation: [{ type: 'case', description: 'cells.def-fmt-time' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Time']);
        const raw = ['0:13:58:27.4362902', '0:12:30:00.0000000', '1:02:00:00.0000000', '0:00:00:00.0000000'];
        await setItemValues(page, raw.map((value, index) => ({ index, column: 'Time', value })));
        let grid = await mountLoaded(page);

        let byId = await cellsById(grid);
        expect(['1', '2', '3', '4'].map(id => byId[id].Time.text)).toEqual(['13:58:27.4362902', '12:30', '1:02:00', '00:00']);

        // An empty NullableTime renders nothing
        await removeGrid(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Time']);
        await page.evaluate(() => Object.defineProperty((window as any).q.getColumn('Time'), 'type', { get: () => 'NullableTime', configurable: true }));
        await setItemValues(page, [{ index: 0, column: 'Time', value: '' }]);
        grid = await mountLoaded(page);

        byId = await cellsById(grid);
        expect(byId['1'].Time.text).toBe('');
    });
});

test.describe('Numbers', () => {
    test('Int32 values render with localeFormat', { annotation: [{ type: 'case', description: 'cells.def-fmt-int' }] }, async ({ page }) => {
        await gridPage(page);
        await loadLanguagesQuery(page);
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        const years = Object.fromEntries(rows.map(r => [r.cells.Language.text, r.cells.YearsStudied.text]));
        expect(years).toMatchObject({ Dutch: '15', English: '13' });
    });

    test('Decimal and Double use \'G\' with the culture\'s decimal separator', { annotation: [{ type: 'case', description: 'cells.def-fmt-decimal' }] }, async ({ page }) => {
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '1') {
                setDtoValue(item, 'Decimal', '1234567890123.456789');
                setDtoValue(item, 'DecimalFormatted', '1234567890123.456789');
                setDtoValue(item, 'Double', '0.5');
            }
            else if (id === '3')
                setDtoValue(item, 'Decimal', '');
        });
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Decimal', 'DecimalFormatted', 'Double']);
        const grid = await mountLoaded(page);
        const { decimal, group } = await numberFormat(page);

        const byId = await cellsById(grid);
        expect(byId['1'].Decimal.text).toBe(`1234567890123${decimal}456789`);
        expect(byId['1'].Double.text).toBe(`0${decimal}5`);
        expect(byId['3'].Decimal.text).toBe('0');
        expect(byId['1'].DecimalFormatted.text).toBe(['1', '234', '567', '890', '123'].join(group) + `${decimal}46`);
        for (const column of ['Decimal', 'DecimalFormatted', 'Double'])
            expect(byId['1'][column].hostStyle['text-align'], column).toBe('right');
    });

    test('Int64 values keep full precision', { annotation: [{ type: 'case', description: 'cells.def-fmt-int64' }] }, async ({ page }) => {
        // Id 1: Int64 = 9007199254740993, larger than Number.MAX_SAFE_INTEGER
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Int64']);
        const grid = await mountLoaded(page);

        expect((await cellsById(grid))['1'].Int64.text).toBe('9007199254740993');
    });

    test('zero is rendered, not blanked', { annotation: [{ type: 'case', description: 'cells.def-fmt-zero' }] }, async ({ page }) => {
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '1') {
                setDtoValue(item, 'Int32', '0');
                setDtoValue(item, 'NullableInt32', '');
            }
            else if (id === '4')
                setDtoValue(item, 'Int32', '');
        });
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Int32', 'NullableInt32']);
        const grid = await mountLoaded(page);

        const byId = await cellsById(grid);
        expect(byId['1'].Int32.text).toBe('0');
        expect(byId['4'].Int32.text).toBe('0');
        expect(byId['1'].NullableInt32.text).toBe('');
    });
});

test.describe('Display format hint', () => {
    test('displayformat on a Date column', { annotation: [{ type: 'case', description: 'cells.def-fmt-date-custom' }] }, async ({ page }) => {
        await gridPage(page);

        for (const [format, expected] of [['{0}', '10/11/1947'], ['{0:yyyy}', '1947'], ['{0:y}', 'november 1947'], ['Born {0}', 'Born 10/11/1947']]) {
            await removeGrid(page);
            await loadQuery(page);
            await setColumnHints(page, 'BirthDate', { displayformat: format });
            const grid = await mountLoaded(page);

            expect((await rowCells(grid, 0)).BirthDate.text, format).toBe(expected);
        }
    });

    test('a displayformat without a spec keeps the short date and time', { annotation: [{ type: 'case', description: 'cells.def-fmt-datetime-custom' }] }, async ({ page }) => {
        // Id 1: DateTime 2024-01-15 13:45:30 and DateTimeOffset 2024-01-15 13:45:30 +02:00
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'DateTime', 'DateTimeOffset']);
        await setColumnHints(page, 'DateTime', { displayformat: 'at {0}' });
        await setColumnHints(page, 'DateTimeOffset', { displayformat: '{0} (local)' });
        const grid = await mountLoaded(page);

        const first = (await cellsById(grid))['1'];
        expect(first.DateTime.text).toBe('at 15/01/2024 13:45');
        expect(first.DateTimeOffset.text).toBe('15/01/2024 13:45 (local)');
    });

    test('numeric displayformat uses the culture\'s separators', { annotation: [{ type: 'case', description: 'cells.def-fmt-int-format' }] }, async ({ page }) => {
        await gridPage(page);
        const { decimal } = await numberFormat(page);

        for (const [format, expected] of [['{0:N2}', { Dutch: `15${decimal}00`, English: `13${decimal}00` }], ['{0} jaar', { Dutch: '15 jaar', English: '13 jaar' }]] as const) {
            await removeGrid(page);
            await loadLanguagesQuery(page);
            await setColumnHints(page, 'YearsStudied', { displayformat: format });
            const grid = await mountLoaded(page);

            const rows = await readCells(grid);
            expect(Object.fromEntries(rows.map(r => [r.cells.Language.text, r.cells.YearsStudied.text])), format).toMatchObject(expected);
        }
    });

    test('string displayformat wraps the value', { annotation: [{ type: 'case', description: 'cells.def-fmt-string-format' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await setColumnHints(page, 'FirstName', { displayformat: 'Dr. {0}' });
        const grid = await mountLoaded(page);

        const cells = await rowCells(grid, 0);
        expect(cells.FirstName.text).toBe('Dr. Aaron');
        expect(cells.LastName.text).toBe('Lemmens');
    });

    test('item-level displayformat applies to every default cell of the row', { annotation: [{ type: 'case', description: 'cells.def-fmt-item-format' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(() => (window as any).q.items[0].typeHints.displayformat = '{0}!');
        const grid = await mountLoaded(page);

        const first = await rowCells(grid, 0);
        expect([first.FirstName.text, first.LastName.text, first.Gender.text, first.ContactPreference.text, first.Email.text, first.PhoneNumber.text, first.EmergencyContact.text])
            .toEqual(['Aaron!', 'Lemmens!', 'Male!', 'Email!', 'Aaron_Lemmens59@skynet.be!', '0475 26 85 00!', 'Thomas Decock!']);
        expect(first.BirthDate.text).toBe('10/11/1947!');
        expect(first.IsActive.text).toBe('');
        expect(first.IsActive.icons.map(i => i.selected)).toEqual([true]);

        const second = await rowCells(grid, 1);
        expect(Object.values(second).filter(c => c.text.endsWith('!')).map(c => c.column)).toEqual([]);
    });
});

test.describe('Booleans in the default cell', () => {
    test('the default cell translates truekey and falsekey', { annotation: [{ type: 'case', description: 'cells.def-fmt-boolean-registry' }] }, async ({ page }) => {
        await gridPage(page);
        await withCellType(page, 'Boolean', 'vi-query-grid-cell-default', async () => {
            await loadQuery(page);
            await setColumnHints(page, 'IsActive', { truekey: 'HideColumn', falsekey: 'ClearFilter' });
            const grid = await mountLoaded(page);

            expect((await rowCells(grid, 0)).IsActive.text).toBe('Hide column');
            expect((await rowCells(grid, 16)).IsActive.text).toBe('Clear');
        });
    });

    test('the default cell shows Yes, No and nothing for a null YesNo', { annotation: [{ type: 'case', description: 'cells.def-fmt-yesno-registry' }] }, async ({ page }) => {
        // Id 1 YesNo is true, Id 3 false; Id 2 is made null client-side
        await gridPage(page);
        await withCellType(page, 'YesNo', 'vi-query-grid-cell-default', async () => {
            await loadQuery(page, 'QueryGrid_DataTypes');
            await keepColumns(page, ['Id', 'Text', 'YesNo']);
            await setItemValues(page, [{ index: 1, column: 'YesNo', value: null }]);
            const grid = await mountLoaded(page);

            const byId = await cellsById(grid);
            expect(byId['1'].YesNo.tag).toBe('vi-query-grid-cell-default');
            expect(['1', '3', '2'].map(id => byId[id].YesNo.text)).toEqual(['Yes', 'No', '']);
        });
    });
});

test.describe('Null and missing values', () => {
    test('null and empty values render as empty text', { annotation: [{ type: 'case', description: 'cells.def-fmt-null-empty' }] }, async ({ page }) => {
        // QueryGrid_DataTypes has no NullableDecimal column; Id 2 has null Text, NullableInt32 and NullableDate,
        // Id 3 has an empty Text and Id 13 (generated) has a null NullableInt32 and NullableDate
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'NullableInt32', 'NullableDate']);
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        const byId = Object.fromEntries(rows.map(r => [r.cells.Id.text, r.cells]));
        const full = byId['1'];
        expect(full.Text.text).toBe('Alpha');
        expect(full.NullableInt32.text).toBe('7');
        expect(full.NullableDate.text).not.toBe('');

        for (const [id, columns] of [['2', ['Text', 'NullableInt32', 'NullableDate']], ['3', ['Text']], ['13', ['NullableInt32', 'NullableDate']]] as const) {
            for (const column of columns) {
                const cell = byId[id][column];
                expect(cell.text, `${column} of Id ${id}`).toBe('');
                expect(Math.abs(cell.box.width - full[column].box.width), `${column} of Id ${id} keeps the column width`).toBeLessThanOrEqual(1);
            }
        }

        for (const row of rows) {
            for (const cell of Object.values(row.cells))
                expect(cell.text, `${cell.column} of row ${row.index}`).not.toMatch(/null|undefined/);
        }
    });

    test('a value missing from the item renders empty', { annotation: [{ type: 'case', description: 'cells.def-fmt-missing-value' }] }, async ({ page }) => {
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '1')
                setDtoValue(item, 'Text', null);
        });
        const errors = pageErrors(page);
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'Int32', 'MultiLine']);
        const grid = await mountLoaded(page);

        const first = (await cellsById(grid))['1'];
        expect(first.Text.text).toBe('');
        expect(first.Int32.text).toBe('42');
        expect(first.MultiLine.text).toBe('Alpha line 1\nAlpha line 2');
        expect(Math.abs(first.Text.box.width - (await cellsById(grid))['4'].Text.box.width)).toBeLessThanOrEqual(1);
        expect(errors).toEqual([]);
    });
});

test.describe('Tag hint', () => {
    test('a tag hint renders the value as a colored tag', { annotation: [{ type: 'case', description: 'cells.def-tag-apply' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await setColumnHints(page, 'Gender', { tag: 'rgb(0, 128, 0)' });
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            const gender = row.cells.Gender;
            expect(gender.attributes).toContain('tag');
            expect(gender.textStyle['background-color']).toBe('rgb(0, 128, 0)');
            expect(gender.textStyle.color).toBe('rgb(255, 255, 255)');
            expect(parseFloat(gender.textStyle['border-radius'])).toBeGreaterThan(0);

            const tagBox = gender.textElementBox!;
            expect(tagBox.width).toBeLessThan(gender.box.width);
            expect(tagBox.height).toBeLessThan(gender.box.height);
            expect(Math.abs((tagBox.top - gender.box.top) - (gender.box.bottom - tagBox.bottom))).toBeLessThanOrEqual(1);

            expect(row.cells.FirstName.attributes).not.toContain('tag');
        }
    });

    test('tag text color comes from --foreground, not the foreground hint', { annotation: [{ type: 'case', description: 'cells.def-tag-foreground' }] }, async ({ page }) => {
        await gridPage(page);

        for (const [hints, expected] of [[{ foreground: 'rgb(255, 0, 0)' }, 'rgb(255, 255, 255)'], [{ style: '--foreground: rgb(0, 0, 0)' }, 'rgb(0, 0, 0)']] as const) {
            await removeGrid(page);
            await loadQuery(page);
            await setColumnHints(page, 'Gender', { tag: 'rgb(0, 128, 0)', ...hints });
            const grid = await mountLoaded(page);

            const rows = await readCells(grid);
            expect(rows.length).toBeGreaterThan(5);
            for (const row of rows) {
                expect(row.cells.Gender.attributes, `row ${row.index}`).toContain('tag');
                expect(row.cells.Gender.textStyle.color, `${JSON.stringify(hints)} in row ${row.index}`).toBe(expected);
            }
        }
    });

    test('an item-level tag turns every default cell of the row into a tag', { annotation: [{ type: 'case', description: 'cells.def-tag-item-level' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(() => (window as any).q.items[0].typeHints.tag = 'rgb(0, 0, 255)');
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        const first = rows.find(r => r.index === 0)!.cells;
        const defaults = Object.values(first).filter(c => c.tag === 'vi-query-grid-cell-default');
        expect(defaults).toHaveLength(8);
        for (const cell of defaults) {
            expect(cell.attributes, cell.column).toContain('tag');
            expect(cell.textStyle['background-color'], cell.column).toBe('rgb(0, 0, 255)');
        }
        expect(first.IsActive.attributes).not.toContain('tag');

        for (const row of rows.filter(r => r.index !== 0)) {
            for (const cell of Object.values(row.cells)) {
                expect(cell.attributes, `${cell.column} of row ${row.index}`).not.toContain('tag');
                expect(cell.textStyle['background-color'], `${cell.column} of row ${row.index}`).toBe(TRANSPARENT);
            }
        }
    });

    test('a tag follows the column alignment', { annotation: [{ type: 'case', description: 'cells.def-tag-align' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'Int32']);
        await setColumnHints(page, 'Text', { tag: 'rgb(0, 128, 0)' });
        await setColumnHints(page, 'Int32', { tag: 'rgb(0, 128, 0)' });
        const grid = await mountLoaded(page);

        const rows = (await readCells(grid)).filter(r => r.cells.Int32.text && r.cells.Text.text);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            const { Text: text, Int32: number } = row.cells;
            expect([text.attributes, number.attributes].map(a => a.includes('tag')), `row ${row.index}`).toEqual([true, true]);
            expect(number.textElementBox!.width, `row ${row.index}`).toBeLessThan(number.box.width - 12);
            expect(Math.abs(number.textElementBox!.right - (number.box.right - 6)), `Int32 of row ${row.index}`).toBeLessThanOrEqual(1);
            expect(Math.abs(text.textElementBox!.left - (text.box.left + 6)), `Text of row ${row.index}`).toBeLessThanOrEqual(1);
        }
    });

    test('a tag on a centered column is centered', { annotation: [{ type: 'case', description: 'cells.def-tag-align-center' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'Int32']);
        await setColumnHints(page, 'Int32', { tag: 'rgb(0, 128, 0)', horizontalcontentalignment: 'center' });
        const grid = await mountLoaded(page);

        const cells = (await readCells(grid)).map(r => r.cells.Int32).filter(c => c.text);
        expect(cells.length).toBeGreaterThan(5);
        for (const cell of cells) {
            expect(cell.attributes, cell.text).toContain('tag');
            expect(cell.textElementBox!.width, cell.text).toBeLessThan(cell.box.width - 12);
            expect(Math.abs((cell.textElementBox!.left - cell.box.left) - (cell.box.right - cell.textElementBox!.right)), cell.text).toBeLessThanOrEqual(1);
        }
    });

    test('tag state is cleared when a row is recycled', { annotation: [{ type: 'case', description: 'cells.def-tag-recycle' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(() => (window as any).q.items[0].getFullValue('Gender').typeHints.tag = 'rgb(0, 128, 0)');
        const grid = await mountLoaded(page);

        const check = async () => {
            const rows = await readCells(grid);
            for (const row of rows) {
                const tagged = row.cells.FirstName.text === 'Aaron' && row.cells.LastName.text === 'Lemmens';
                const gender = row.cells.Gender;
                expect(gender.attributes.includes('tag'), `row ${row.index}`).toBe(tagged);
                expect(gender.textStyle['background-color'] !== 'rgba(0, 0, 0, 0)', `row ${row.index}`).toBe(tagged);
            }

            return rows;
        };

        expect((await check()).some(r => r.index === 0)).toBe(true);
        await wheelGrid(page, grid, 40 * 32);
        expect((await check()).some(r => r.index === 0)).toBe(false);
        await wheelGrid(page, grid, -40 * 32);
        expect((await check())[0].index).toBe(0);
    });

    test('the tag is removed when the value becomes null', { annotation: [{ type: 'case', description: 'cells.def-tag-null-clear' }] }, async ({ page }) => {
        // NullableInt32 is null for Id 2 and for every fourth generated row (Id 13, 17, ...)
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'NullableInt32']);
        await setColumnHints(page, 'NullableInt32', { tag: 'rgb(0, 128, 0)' });
        const grid = await mountLoaded(page);

        const seen = { tagged: 0, empty: 0 };
        const check = async () => {
            for (const row of await readCells(grid)) {
                const cell = row.cells.NullableInt32;
                const empty = cell.text === '';
                expect(cell.attributes.includes('tag'), `NullableInt32 of Id ${row.cells.Id.text}`).toBe(!empty);
                expect(cell.textStyle['background-color'] === TRANSPARENT, `NullableInt32 of Id ${row.cells.Id.text}`).toBe(empty);
                seen[empty ? 'empty' : 'tagged']++;
            }
        };

        await check();
        for (const delta of [20 * 32, 20 * 32, -(20 * 32)]) {
            await wheelGrid(page, grid, delta);
            await check();
        }

        expect(seen.empty).toBeGreaterThan(5);
        expect(seen.tagged).toBeGreaterThan(5);
    });
});

test.describe('Extra class', () => {
    test('column extraclass adds classes to every cell host', { annotation: [{ type: 'case', description: 'cells.def-xclass-column' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await setColumnHints(page, 'LastName', { extraclass: 'foo bar' });
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            for (const cell of Object.values(row.cells)) {
                if (cell.column === 'LastName')
                    expect(cell.classes).toEqual(expect.arrayContaining(['column', 'foo', 'bar']));
                else
                    expect(cell.classes.filter(c => c === 'foo' || c === 'bar'), cell.column).toEqual([]);
            }
        }
    });

    test('item-level extraclass goes to the row, not the cells', { annotation: [{ type: 'case', description: 'cells.def-xclass-item-not-cell' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(() => (window as any).q.items[0].typeHints.extraclass = 'rowcls');
        const grid = await mountLoaded(page);

        const rows = await grid.evaluate((g: any) => {
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => r.item && getComputedStyle(r).display !== 'none').map((r: any) => ({
                    first: r.item === q.items[0],
                    row: r.classList.contains('rowcls'),
                    cells: [...r.querySelectorAll('.column')].filter((c: any) => c.classList.contains('rowcls')).length
                }));
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        });

        expect(rows.filter(r => r.first)).toEqual([{ first: true, row: true, cells: 0 }]);
        expect(rows.filter(r => !r.first && (r.row || r.cells))).toEqual([]);
    });

    test('value-level extraclass is ignored for an empty value', { annotation: [{ type: 'case', description: 'cells.def-xclass-empty-value' }] }, async ({ page }) => {
        // Id 1 NullableInt32 is 7, Id 2 is null (sent as an explicit null value); both values carry extraclass 'hot'
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '1')
                item.values.find(v => v.key === 'NullableInt32')!.typeHints = { extraclass: 'hot' };
            else if (id === '2')
                setDtoNull(item, 'NullableInt32', { extraclass: 'hot' });
        });
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'NullableInt32']);
        await setColumnHints(page, 'NullableInt32', { extraclass: 'colx' });
        const grid = await mountLoaded(page);

        const byId = await cellsById(grid);
        expect(byId['1'].NullableInt32.classes).toContain('hot');
        expect(byId['2'].NullableInt32.text).toBe('');
        expect(byId['2'].NullableInt32.classes).toContain('colx');
        expect(byId['2'].NullableInt32.classes).not.toContain('hot');
    });

    test('extraclass tolerates repeated whitespace', { annotation: [{ type: 'case', description: 'cells.def-xclass-whitespace' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page);
        await loadQuery(page);
        await setColumnHints(page, 'LastName', { extraclass: 'a  b' });
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            expect(row.cells.LastName.classes, `row ${row.index}`).toEqual(expect.arrayContaining(['column', 'a', 'b']));
            expect(row.cells.LastName.text, `row ${row.index}`).not.toBe('');
        }
        expect(errors).toEqual([]);
    });

    test('value-level extraclass follows the value on recycle', { annotation: [{ type: 'case', description: 'cells.def-xclass-value' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await setItemValues(page, [{ index: 0, column: 'LastName', valueHints: { extraclass: 'hot' } }]);
        const grid = await mountLoaded(page);

        const check = async () => {
            const rows = await readCells(grid);
            for (const row of rows) {
                for (const cell of Object.values(row.cells))
                    expect(cell.classes.includes('hot'), `${cell.column} of row ${row.index}`).toBe(cell.column === 'LastName' && row.cells.Email.text === LEMMENS);
            }

            return rows;
        };

        expect((await check())[0].index).toBe(0);
        await wheelGrid(page, grid, 40 * 32);
        expect((await check()).some(r => r.index === 0)).toBe(false);
        await wheelGrid(page, grid, -40 * 32);
        expect((await check())[0].index).toBe(0);
    });
});

test.describe('Box and overflow', () => {
    test('default cell box: row height and 6px padding', { annotation: [{ type: 'case', description: 'cells.def-text-box' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const rows = await readCells(grid, ['line-height', 'padding-left', 'padding-right']);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            for (const cell of Object.values(row.cells).filter(c => c.tag === 'vi-query-grid-cell-default')) {
                const label = `${cell.column} of row ${row.index}`;
                expect(Math.round(cell.box.height), label).toBe(32);
                expect(cell.textStyle['line-height'], label).toBe('32px');
                expect([cell.hostStyle['padding-left'], cell.hostStyle['padding-right']], label).toEqual(['6px', '6px']);
                if (cell.textBox)
                    expect(Math.abs(cell.textBox.left - (cell.box.left + 6)), label).toBeLessThanOrEqual(1);
            }
        }
    });

    test('the cell padding variable pads headers, cells and the footer alike', { annotation: [{ type: 'case', description: 'cells.def-text-padding-var' }] }, async ({ page }) => {
        await gridPage(page, { styles: 'vi-query-grid { --vi-query-grid-cell-padding: 20px; }' });
        await injectTotalItem(page, [{ key: 'FirstName', value: 'Total' }]);
        const grid = await mountGrid(page);

        const first = await rowCells(grid, 0);
        const cell = first.FirstName;
        expect([cell.hostStyle['padding-left'], cell.hostStyle['padding-right']]).toEqual(['20px', '20px']);
        const lefts = await grid.evaluate((g: any) => {
            const textLeft = (node: Node) => {
                const range = document.createRange();
                range.selectNodeContents(node);
                return range.getBoundingClientRect().left;
            };
            const header = g.shadowRoot.querySelector('vi-query-grid-column-header[name="FirstName"]').shadowRoot.querySelector('label');
            // Footer totals are cell templates, their text is in the cell's own shadow root
            const footer = [...g.shadowRoot.querySelector('vi-query-grid-footer').querySelectorAll('.column')]
                .map((c: Element) => c.shadowRoot?.querySelector('#text'))
                .find((t: Element) => t?.textContent.trim() === 'Total');
            return { header: textLeft(header), footer: textLeft(footer) };
        });
        expect(Math.abs(cell.textBox!.left - (cell.box.left + 20))).toBeLessThanOrEqual(1);
        expect(Math.abs(lefts.header - cell.textBox!.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(lefts.footer - cell.textBox!.left)).toBeLessThanOrEqual(1);
    });

    test('default cells are at least 44px wide', { annotation: [{ type: 'case', description: 'cells.base-measure-min-width' }] }, async ({ page }) => {
        // The Languages detail grid with YearsStudied relabelled 'X' and every value '1'
        await gridPage(page);
        await loadLanguagesQuery(page);
        await page.evaluate(() => {
            const q = (window as any).q;
            Object.defineProperty(q.getColumn('YearsStudied'), 'label', { get: () => 'X', configurable: true });
            for (let i = 0; i < q.items.length; i++)
                q.items[i].values.YearsStudied = 1;
        });
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(1);
        for (const row of rows) {
            expect(row.cells.YearsStudied.text).toBe('1');
            expect(row.cells.YearsStudied.box.width, `row ${row.index}`).toBeGreaterThanOrEqual(44 - 0.5);
        }
    });

    test('overflowing text is truncated with an ellipsis', { annotation: [{ type: 'case', description: 'cells.def-text-ellipsis' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(() => (window as any).q.getColumn('Email').width = '60px');
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            const email = row.cells.Email;
            expect(Math.abs(email.box.width - 60), 'Email cell width').toBeLessThanOrEqual(1);
            expect(email.textStyle.overflow).toBe('hidden');
            expect(email.textStyle['white-space']).toBe('nowrap');
            expect(email.textStyle['text-overflow']).toBe('ellipsis');
            expect(email.textBox!.width).toBeGreaterThan(email.textElementBox!.width);
            expect(Math.round(email.box.height)).toBe(32);
        }

        const overflows = await grid.evaluate((g: any) => {
            const rows = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => r.item && getComputedStyle(r).display !== 'none');
            const index = [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].filter((h: any) => getComputedStyle(h).display !== 'none').findIndex((h: any) => h.getAttribute('name') === 'Email');
            return rows.map((r: any) => {
                const cell = r.querySelectorAll('.column')[index] as HTMLElement;
                const text = [...cell.shadowRoot!.children].find(c => !['STYLE', 'LINK'].includes(c.tagName)) as HTMLElement;
                return text.scrollWidth > text.clientWidth;
            });
        });
        expect(overflows.length).toBeGreaterThan(5);
        expect(overflows.every(o => o)).toBe(true);
    });

    test('truncated cells expose no tooltip', { annotation: [{ type: 'case', description: 'cells.def-text-no-tooltip' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(() => (window as any).q.getColumn('Email').width = '60px');
        const grid = await mountLoaded(page);

        const titled = () => grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].flatMap((r: any) => [...r.querySelectorAll('.column')])
            .flatMap((c: any) => [c, ...(c.shadowRoot?.querySelectorAll('*') ?? [])]).filter((e: Element) => e.hasAttribute('title')).length);
        const tooltips = () => page.evaluate(() => {
            const all: Element[] = [];
            const walk = (root: Document | ShadowRoot) => root.querySelectorAll('*').forEach(e => {
                all.push(e);
                if (e.shadowRoot)
                    walk(e.shadowRoot);
            });
            walk(document);
            return all.filter(e => e.getAttribute('role') === 'tooltip' || /tooltip/i.test(e.tagName)).length;
        });

        expect(await titled()).toBe(0);
        const before = await tooltips();

        const email = (await rowCells(grid, 2)).Email;
        await page.mouse.move(email.box.left + email.box.width / 2, email.box.top + email.box.height / 2, { steps: 5 });
        // Give a delayed tooltip the time to appear before asserting it does not
        await page.waitForTimeout(800);
        expect(await titled()).toBe(0);
        expect(await tooltips()).toBe(before);
    });
});

test.describe('Recycling', () => {
    test('scrolling recycles rows and updates every cell', { annotation: [{ type: 'case', description: 'cells.def-text-recycle-scroll' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await wheelGrid(page, grid, 1600);

        const rows = await visibleRows(grid);
        const first = rows.find(r => r.top >= 0)!;
        expect(first.index).toBe(50);
        expect(first.texts).toEqual(['Aaron', 'Decoster', '02/11/1954', 'Male', 'Email', 'Aaron.Decoster23@gmail.com', '0477 08 73 78', 'Sterre Hermans', '']);

        const cells = await readCells(grid);
        expect(cells.find(r => r.index === 50)!.cells.IsActive.icons.map(i => i.selected)).toEqual([true]);

        const values = await itemsValues(grid, rows.map(r => r.index), ['FirstName', 'LastName', 'Email', 'PhoneNumber', 'IsActive']);
        rows.forEach((row, i) => {
            const item = values[i]!;
            expect(row.texts.length).toBe(PEOPLE_COLUMNS.length);
            expect([row.texts[0], row.texts[1], row.texts[5], row.texts[6]], `row ${row.index}`).toEqual([item.FirstName, item.LastName, item.Email, item.PhoneNumber]);
            expect(cells.find(r => r.index === row.index)!.cells.IsActive.icons.map(icon => icon.selected), `IsActive of row ${row.index}`).toEqual([item.IsActive]);
        });
    });

    test('a new search result replaces cell texts', { annotation: [{ type: 'case', description: 'cells.def-text-search-refresh' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await grid.evaluate(async (g: any) => {
            g.query.textSearch = 'Lemmens';
            await g.query.search();
        });
        await waitForGridReady(grid);

        const total = await grid.evaluate((g: any) => g.query.totalItems as number);
        expect(total).toBeGreaterThan(0);

        const rows = await visibleRows(grid);
        const items = rows.filter(r => r.index >= 0);
        expect(items.length).toBe(Math.min(total, items.length));
        expect(items.length).toBeGreaterThan(0);
        const values = await itemsValues(grid, items.map(r => r.index), ['FirstName', 'LastName', 'Email']);
        items.forEach((row, i) => {
            expect(row.index, 'row index within the result').toBeLessThan(total);
            expect([row.texts[0], row.texts[1], row.texts[5]], `row ${row.index}`).toEqual([values[i]!.FirstName, values[i]!.LastName, values[i]!.Email]);
            expect(row.texts[1], `LastName of row ${row.index}`).toBe('Lemmens');
        });

        for (const row of rows.filter(r => r.index < 0 && !r.isGroup))
            expect(row.texts.filter(t => t), `row at ${row.top}`).toEqual([]);
    });
});
