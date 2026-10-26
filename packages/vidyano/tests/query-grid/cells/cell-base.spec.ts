import { expect, Locator, Page } from '@playwright/test';
import { columnTracks, gridPage, headerNames, mountGrid, nextFrames, test, waitForGridReady } from '../_helpers/query-grid';
import { itemsValues, keepColumns, loadLanguagesQuery, loadQuery, mountLoaded, patchItems, readCells, rowCells, rowCenter, setColumnHints, wheelGrid } from '../_helpers/cells';

const RED = 'rgb(255, 0, 0)';
const GREEN = 'rgb(0, 128, 0)';
const BLUE = 'rgb(0, 0, 255)';
const LEMMENS = 'Aaron_Lemmens59@skynet.be';
const BLACK_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC';

/** Moves the pointer onto the column header (outside every row). */
async function moveToHeader(page: Page, grid: Locator) {
    const header = await grid.locator('vi-query-grid-column-header').first().boundingBox();
    await page.mouse.move(header!.x + header!.width / 2, header!.y + header!.height / 2, { steps: 5 });
}

/** The item index of the data row under the given page y coordinate (-1 when none). */
async function rowAt(grid: Locator, y: number) {
    const rows = await readCells(grid);
    return rows.find(r => Object.values(r.cells).some(c => c.box.top <= y && c.box.bottom > y))?.index ?? -1;
}

test.describe('Cell type registry', () => {
    test('getCellTypeConstructor maps built-in types to cell classes', { annotation: [{ type: 'case', description: 'cells.base-reg-builtins' }] }, async ({ page }) => {
        await gridPage(page);

        const result = await page.evaluate(() => {
            const Base = customElements.get('vi-query-grid-cell-default') as any;
            const get = (type: string) => Base.getCellTypeConstructor(type);
            const boolean = customElements.get('vi-query-grid-cell-boolean');
            return {
                Boolean: get('Boolean') === boolean,
                NullableBoolean: get('NullableBoolean') === boolean,
                YesNo: get('YesNo') === boolean,
                Image: get('Image') === customElements.get('vi-query-grid-cell-image'),
                CommonMark: get('CommonMark') === customElements.get('vi-query-grid-cell-common-mark'),
                undefinedTypes: ['String', 'Date', 'Int32', 'Enum', 'Reference', '', 'boolean'].filter(type => get(type) !== undefined)
            };
        });

        expect(result).toEqual({ Boolean: true, NullableBoolean: true, YesNo: true, Image: true, CommonMark: true, undefinedTypes: [] });
    });

    test('People rows get default cells and a boolean IsActive cell', { annotation: [{ type: 'case', description: 'cells.base-reg-people-routing' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        expect(await headerNames(grid)).toEqual(['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive']);

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            const cells = Object.values(row.cells);
            expect(cells.map(c => c.tag)).toEqual([...Array(8).fill('vi-query-grid-cell-default'), 'vi-query-grid-cell-boolean']);
            expect(cells.every(c => c.classes.includes('column'))).toBe(true);
        }

        // readCells finds cells by their 'column' class, so also count every cell element of each row
        const perRow = await grid.evaluate((g: any) => {
            const Cell = Object.getPrototypeOf(customElements.get('vi-query-grid-cell-default'));
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => r.item).map((r: any) => {
                const cells = [...r.querySelectorAll('*'), ...(r.shadowRoot?.querySelectorAll('*') ?? [])].filter(e => e instanceof Cell);
                return { count: cells.length, withColumn: cells.filter(c => c.classList.contains('column')).length };
            });
        });
        expect(perRow.length).toBeGreaterThan(5);
        expect(perRow.filter(r => r.count !== 9 || r.withColumn !== 9)).toEqual([]);
    });

    test('registerCellType makes the grid create a custom cell class', { annotation: [{ type: 'case', description: 'cells.base-reg-custom-subclass' }] }, async ({ page }) => {
        await gridPage(page);
        await page.evaluate(() => {
            const Base = customElements.get('vi-query-grid-cell-default') as any;
            class TestQueryGridCell extends Base {}
            customElements.define('test-query-grid-cell', TestQueryGridCell);
            Base.registerCellType('String', TestQueryGridCell);
        });

        try {
            const grid = await mountGrid(page);
            const cells = await rowCells(grid, 0);
            expect(Object.fromEntries(Object.values(cells).map(c => [c.column, c.tag]))).toEqual({
                FirstName: 'test-query-grid-cell',
                LastName: 'test-query-grid-cell',
                BirthDate: 'vi-query-grid-cell-default',
                Gender: 'vi-query-grid-cell-default',
                ContactPreference: 'vi-query-grid-cell-default',
                Email: 'test-query-grid-cell',
                PhoneNumber: 'test-query-grid-cell',
                EmergencyContact: 'vi-query-grid-cell-default',
                IsActive: 'vi-query-grid-cell-boolean'
            });
            expect(cells.FirstName.text).toBe('Aaron');
            expect(cells.LastName.text).toBe('Lemmens');
            expect(cells.Email.text).toBe('Aaron_Lemmens59@skynet.be');
            expect(await grid.evaluate((g: any) => {
                const Base = customElements.get('vi-query-grid-cell-default');
                const custom = [...g.shadowRoot.querySelectorAll('test-query-grid-cell')];
                return custom.length > 0 && custom.every(c => c instanceof Base);
            })).toBe(true);
        }
        finally {
            await page.evaluate(() => (customElements.get('vi-query-grid-cell-default') as any).registerCellType('String', undefined));
        }
    });

    test('overriding Boolean with the default cell renders text', { annotation: [{ type: 'case', description: 'cells.base-reg-override-builtin' }] }, async ({ page }) => {
        await gridPage(page);
        await page.evaluate(() => {
            const Base = customElements.get('vi-query-grid-cell-default') as any;
            Base.registerCellType('Boolean', Base);
        });

        let grid: Locator;
        try {
            grid = await mountGrid(page);
            const active = (await rowCells(grid, 0)).IsActive;
            expect([active.tag, active.text, active.icons.length]).toEqual(['vi-query-grid-cell-default', 'True', 0]);
            const inactive = (await rowCells(grid, 16)).IsActive;
            expect([inactive.tag, inactive.text, inactive.icons.length]).toEqual(['vi-query-grid-cell-default', 'False', 0]);
        }
        finally {
            await page.evaluate(() => (customElements.get('vi-query-grid-cell-default') as any).registerCellType('Boolean', customElements.get('vi-query-grid-cell-boolean')));
        }

        await grid.evaluate(g => g.remove());
        grid = await mountGrid(page);
        const active = (await rowCells(grid, 0)).IsActive;
        expect(active.tag).toBe('vi-query-grid-cell-boolean');
        expect(active.text).toBe('');
        expect(active.icons.map(i => i.selected)).toEqual([true]);
    });

    test('a registration made after rendering only affects new grids', { annotation: [{ type: 'case', description: 'cells.base-reg-late-registration' }] }, async ({ page }) => {
        await gridPage(page);
        let grid = await mountGrid(page);
        await page.evaluate(() => {
            const Base = customElements.get('vi-query-grid-cell-default') as any;
            class LateEnumCell extends Base {}
            customElements.define('test-late-enum-cell', LateEnumCell);
            Base.registerCellType('Enum', LateEnumCell);
        });

        try {
            const genderTags = async () => [...new Set((await readCells(grid)).map(r => r.cells.Gender.tag))];
            expect(await genderTags()).toEqual(['vi-query-grid-cell-default']);
            for (let i = 0; i < 5; i++) {
                await wheelGrid(page, grid, 40 * 32);
                expect(await genderTags(), `after scrolling ${(i + 1) * 40} rows`).toEqual(['vi-query-grid-cell-default']);
            }

            await grid.evaluate(g => g.remove());
            grid = await mountGrid(page);
            const rows = await readCells(grid);
            expect(rows.length).toBeGreaterThan(5);
            expect([...new Set(rows.map(r => r.cells.Gender.tag))]).toEqual(['test-late-enum-cell']);
            expect(rows.find(r => r.index === 0)!.cells.Gender.text).toBe('Male');
        }
        finally {
            await page.evaluate(() => (customElements.get('vi-query-grid-cell-default') as any).registerCellType('Enum', undefined));
        }
    });

    test('a query swap creates the cell for the new column type', { annotation: [{ type: 'case', description: 'cells.base-reg-same-name-type-change' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        expect((await rowCells(grid, 0)).IsActive.tag).toBe('vi-query-grid-cell-boolean');

        // A second People query whose IsActive column is a String with the value 'No' in row 0
        await page.evaluate(async () => {
            const w = window as any;
            const q = await w.service.getQuery('People');
            q.sortOptions = [{ name: 'FirstName', direction: 'ASC' }];
            await q.search();
            Object.defineProperty(q.getColumn('IsActive'), 'type', { get: () => 'String', configurable: true });
            q.items[0].values.IsActive = 'No';
            w.grid.query = q;
        });
        await waitForGridReady(grid);

        const cell = (await rowCells(grid, 0)).IsActive;
        expect(cell.tag).toBe('vi-query-grid-cell-default');
        expect(cell.text).toBe('No');
        expect(cell.icons).toEqual([]);
    });
});

test.describe('Defaults without hints', () => {
    test('cells without type hints are plain', { annotation: [{ type: 'case', description: 'cells.vm-plain-cells' }] }, async ({ page }) => {
        await gridPage(page);

        for (const load of [() => loadQuery(page), () => loadLanguagesQuery(page)]) {
            await page.evaluate(() => document.querySelector('#test-container > vi-query-grid')?.remove());
            await load();
            const grid = await mountLoaded(page);

            const cells = await grid.evaluate((g: any) => {
                const numeric = (type: string) => (window as any).Vidyano.DataType.isNumericType(type);
                const headers = [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].filter((h: any) => getComputedStyle(h).display !== 'none').map((h: any) => h.getAttribute('name'));
                const rows = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => r.item && !r.hasAttribute('is-group') && getComputedStyle(r).display !== 'none');
                return rows.flatMap((r: any) => [...r.querySelectorAll('.column')].map((c: any, i) => ({
                    column: headers[i],
                    tag: c.tagName.toLowerCase(),
                    numeric: numeric(g.query.getColumn(headers[i]).type),
                    attributes: c.getAttributeNames().filter((a: string) => ['tag', 'sensitive', 'right'].includes(a)),
                    classes: [...c.classList],
                    inherited: getComputedStyle(c).color === getComputedStyle(r).color && !c.style.color,
                    textAlign: getComputedStyle(c).textAlign
                })));
            });

            expect(cells.length).toBeGreaterThan(10);
            for (const cell of cells) {
                expect(cell.attributes, cell.column).toEqual([]);
                expect(cell.classes, cell.column).toEqual(['column']);
                expect(cell.inherited, `${cell.column} inherits its color`).toBe(true);
                if (cell.tag === 'vi-query-grid-cell-default')
                    expect(cell.textAlign, cell.column).toMatch(cell.numeric ? /^right$/ : /^(start|left)$/);
            }
        }
    });
});

test.describe('Type-hint resolution', () => {
    test('type hints merge with precedence value > item > column', { annotation: [{ type: 'case', description: 'cells.base-hint-precedence' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(({ RED, GREEN, BLUE }) => {
            const q = (window as any).q;
            const col = q.getColumn('FirstName');
            col.typeHints = { ...(col.typeHints ?? {}), foreground: RED };
            q.items[0].typeHints.foreground = GREEN;
            q.items[1].typeHints.foreground = GREEN;
            q.items[1].getFullValue('FirstName').typeHints.foreground = BLUE;
        }, { RED, GREEN, BLUE });
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        const color = (index: number, column: string) => rows.find(r => r.index === index)!.cells[column].textStyle.color;
        expect([color(0, 'FirstName'), color(0, 'LastName')]).toEqual([GREEN, GREEN]);
        expect([color(1, 'FirstName'), color(1, 'LastName')]).toEqual([BLUE, GREEN]);
        expect(color(2, 'FirstName')).toBe(RED);
        expect(color(2, 'LastName')).not.toBe(RED);
        expect(color(2, 'LastName')).toBe(color(2, 'Email'));
    });

    test('only lowercase type-hint keys are recognised', { annotation: [{ type: 'case', description: 'cells.base-hint-key-casing' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await setColumnHints(page, 'FirstName', { Foreground: RED });
        let grid = await mountLoaded(page);

        let rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows)
            expect(row.cells.FirstName.textStyle.color, `row ${row.index}`).toBe(row.cells.LastName.textStyle.color);
        expect(rows[0].cells.FirstName.textStyle.color).not.toBe(RED);

        await grid.evaluate(g => g.remove());
        await loadQuery(page);
        await setColumnHints(page, 'FirstName', { foreground: RED });
        grid = await mountLoaded(page);

        rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        expect(rows.every(r => r.cells.FirstName.textStyle.color === RED)).toBe(true);
    });

    test('hints are read when a value is assigned, not observed afterwards', { annotation: [{ type: 'case', description: 'cells.base-hint-snapshot' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const defaultColor = (await rowCells(grid, 0)).FirstName.textStyle.color;
        expect(defaultColor).not.toBe(RED);

        await page.evaluate(RED => (window as any).q.items[0].typeHints.foreground = RED, RED);
        await nextFrames(page, 5);
        expect((await rowCells(grid, 0)).FirstName.textStyle.color).toBe(defaultColor);

        await wheelGrid(page, grid, 60 * 32);
        expect((await readCells(grid)).some(r => r.index === 0)).toBe(false);
        await wheelGrid(page, grid, -60 * 32);

        const rows = await readCells(grid);
        const lemmens = rows.find(r => r.cells.Email.text === LEMMENS);
        expect(lemmens, 'the Aaron Lemmens row is shown').toBeTruthy();
        expect(lemmens!.cells.FirstName.textStyle.color).toBe(RED);
        expect(rows.filter(r => r !== lemmens).every(r => r.cells.FirstName.textStyle.color === defaultColor)).toBe(true);
    });
});

test.describe('Foreground', () => {
    test('a foreground hint colors only its column', { annotation: [{ type: 'case', description: 'cells.base-fg-column' }] }, async ({ page }) => {
        await gridPage(page);
        let grid = await mountGrid(page);
        const unhinted = (await rowCells(grid, 0)).LastName.textStyle.color;
        await grid.evaluate(g => g.remove());

        await loadQuery(page);
        await setColumnHints(page, 'FirstName', { foreground: RED });
        grid = await mountLoaded(page);

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            expect(row.cells.FirstName.textStyle.color).toBe(RED);
            expect(row.cells.LastName.textStyle.color).toBe(unhinted);
        }
    });

    test('item foreground does not leak to other items on recycle', { annotation: [{ type: 'case', description: 'cells.base-fg-recycle' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(RED => (window as any).q.items[0].typeHints.foreground = RED, RED);
        const grid = await mountLoaded(page);

        let rows = await readCells(grid);
        const defaultColor = rows.find(r => r.index === 1)!.cells.FirstName.textStyle.color;
        expect(defaultColor).not.toBe(RED);
        expect(rows.find(r => r.index === 0)!.cells.FirstName.textStyle.color).toBe(RED);

        await wheelGrid(page, grid, 40 * 32);
        rows = await readCells(grid);
        expect(rows.some(r => r.index === 0)).toBe(false);
        for (const row of rows)
            expect(Object.values(row.cells).filter(c => c.tag === 'vi-query-grid-cell-default').map(c => c.textStyle.color).filter(c => c !== defaultColor), `row ${row.index}`).toEqual([]);

        await wheelGrid(page, grid, -40 * 32);
        rows = await readCells(grid);
        expect(rows[0].index).toBe(0);
        for (const row of rows) {
            const red = row.cells.Email.text === 'Aaron_Lemmens59@skynet.be';
            expect(row.cells.FirstName.textStyle.color, `row ${row.index}`).toBe(red ? RED : defaultColor);
            expect(row.cells.Email.textStyle.color, `row ${row.index}`).toBe(red ? RED : defaultColor);
        }
    });

    test('foreground is removed when the cell value becomes null', { annotation: [{ type: 'case', description: 'cells.base-fg-null-clear' }] }, async ({ page }) => {
        // Generated rows: an even Id has a Text value with a red value-level foreground, an odd Id has no Text value
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id == null || parseInt(id) < 13)
                return;

            if (parseInt(id) % 2 === 0)
                item.values.find(v => v.key === 'Text')!.typeHints = { foreground: RED };
            else
                item.values = item.values.filter(v => v.key !== 'Text');
        });
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text']);
        const grid = await mountLoaded(page);

        const seen = { red: 0, empty: 0 };
        const check = async () => {
            for (const row of await readCells(grid)) {
                const id = parseInt(row.cells.Id.text);
                if (id < 13)
                    continue;

                const text = row.cells.Text;
                if (id % 2 === 0) {
                    expect(text.text, `Text of Id ${id}`).not.toBe('');
                    expect(text.textStyle.color, `Text of Id ${id}`).toBe(RED);
                    seen.red++;
                }
                else {
                    expect(text.text, `Text of Id ${id}`).toBe('');
                    expect(text.hostStyle.color, `Text of Id ${id}`).toBe(row.cells.Id.hostStyle.color);
                    seen.empty++;
                }
            }
        };

        for (const delta of [10 * 32, 20 * 32, 20 * 32 + 16, -(20 * 32), 30 * 32]) {
            await wheelGrid(page, grid, delta);
            await check();
        }

        expect(seen.red).toBeGreaterThan(10);
        expect(seen.empty).toBeGreaterThan(10);
    });
});

test.describe('Alignment', () => {
    test('numeric columns are right-aligned by default', { annotation: [{ type: 'case', description: 'cells.base-align-numeric' }] }, async ({ page }) => {
        await gridPage(page);
        await loadLanguagesQuery(page);
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        expect(rows.map(r => r.cells.YearsStudied.text).sort()).toEqual(['13', '15']);
        for (const row of rows) {
            const years = row.cells.YearsStudied;
            expect(Math.abs(years.textBox!.right - (years.box.right - 6)), `YearsStudied of row ${row.index}`).toBeLessThanOrEqual(1);

            for (const column of ['Language', 'ProficiencyLevel', 'CertificationLevel']) {
                const cell = row.cells[column];
                if (!cell.textBox)
                    continue;

                expect(Math.abs(cell.textBox.left - (cell.box.left + 6)), `${column} of row ${row.index}`).toBeLessThanOrEqual(1);
            }
        }
    });

    test('horizontalcontentalignment overrides the default', { annotation: [{ type: 'case', description: 'cells.base-align-hint-override' }] }, async ({ page }) => {
        await gridPage(page);
        await loadLanguagesQuery(page);
        await setColumnHints(page, 'YearsStudied', { horizontalcontentalignment: 'left' });
        let grid = await mountLoaded(page);

        const languages = await readCells(grid);
        expect(languages.length).toBeGreaterThan(1);
        for (const row of languages) {
            const years = row.cells.YearsStudied;
            expect(Math.abs(years.textBox!.left - (years.box.left + 6)), `YearsStudied of row ${row.index}`).toBeLessThanOrEqual(1);
        }

        await grid.evaluate(g => g.remove());
        await loadQuery(page);
        await setColumnHints(page, 'FirstName', { horizontalcontentalignment: 'center' });
        grid = await mountLoaded(page);

        // Truncated names fill the cell, so only names shorter than the column are checked
        const centered = (await readCells(grid)).map(r => r.cells.FirstName).filter(c => c.textBox && c.textBox.width < c.textElementBox!.width - 2);
        expect(centered.length).toBeGreaterThan(5);
        for (const cell of centered)
            expect(Math.abs((cell.textBox!.left - cell.box.left) - (cell.box.right - cell.textBox!.right)), cell.text).toBeLessThanOrEqual(1);
    });

    test('per-item alignment is restored on recycle', { annotation: [{ type: 'case', description: 'cells.base-align-recycle' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(() => (window as any).q.items[0].typeHints.horizontalcontentalignment = 'right');
        const grid = await mountLoaded(page);

        const check = async () => {
            const rows = await readCells(grid);
            for (const row of rows) {
                const right = row.cells.Email.text === LEMMENS;
                for (const column of ['FirstName', 'LastName', 'Email'])
                    expect(row.cells[column].hostStyle['text-align'], `${column} of row ${row.index}`).toMatch(right ? /^right$/ : /^(start|left)$/);
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

test.describe('Style hint', () => {
    test('a style hint applies its declarations to the cell', { annotation: [{ type: 'case', description: 'cells.base-style-apply' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await setColumnHints(page, 'LastName', { style: 'font-weight: 700; font-style: italic' });
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            expect([row.cells.LastName.textStyle['font-weight'], row.cells.LastName.textStyle['font-style']]).toEqual(['700', 'italic']);
            expect([row.cells.FirstName.textStyle['font-weight'], row.cells.FirstName.textStyle['font-style']]).toEqual(['400', 'normal']);
        }
    });

    test('style parsing skips empty declarations and keeps values with a colon', { annotation: [{ type: 'case', description: 'cells.base-style-parse' }] }, async ({ page }) => {
        await page.context().route('https://example.com/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(BLACK_PNG, 'base64') }));
        await gridPage(page);
        await loadQuery(page);
        await setColumnHints(page, 'LastName', { style: ' font-weight:700;; ;font-style : italic ; color' });
        await setColumnHints(page, 'FirstName', { style: 'background-image: url(https://example.com/pw-cell.png)' });
        const grid = await mountLoaded(page);

        const rows = await readCells(grid, ['color', 'font-weight', 'font-style', 'background-image']);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            const lastName = row.cells.LastName;
            expect([lastName.textStyle['font-weight'], lastName.textStyle['font-style']], `LastName of row ${row.index}`).toEqual(['700', 'italic']);
            expect(lastName.textStyle.color, `LastName of row ${row.index}`).toBe(row.cells.Email.textStyle.color);
            expect(row.cells.FirstName.hostStyle['background-image'], `FirstName of row ${row.index}`).toBe('url("https://example.com/pw-cell.png")');
        }
    });

    test('style declarations of a previous item are removed on recycle', { annotation: [{ type: 'case', description: 'cells.base-style-recycle' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(() => {
            const q = (window as any).q;
            q.items[0].typeHints.style = 'font-style: italic';
            q.items[1].typeHints.style = 'font-weight: 700';
        });
        const grid = await mountLoaded(page);
        const [, second] = await itemsValues(grid, [0, 1], ['Email']);

        const check = async () => {
            const rows = await readCells(grid);
            for (const row of rows) {
                const email = row.cells.Email.text;
                const expected = email === LEMMENS ? ['400', 'italic'] : email === second!.Email ? ['700', 'normal'] : ['400', 'normal'];
                for (const column of ['FirstName', 'Email'])
                    expect([row.cells[column].textStyle['font-weight'], row.cells[column].textStyle['font-style']], `${column} of row ${row.index}`).toEqual(expected);
            }

            return rows;
        };

        expect((await check())[0].index).toBe(0);
        await wheelGrid(page, grid, 30 * 32);
        expect((await check()).some(r => r.index <= 1)).toBe(false);
        await wheelGrid(page, grid, -30 * 32);
        expect((await check())[0].index).toBe(0);
    });
});

test.describe('Hover style', () => {
    test('hoverstyle applies while the pointer is over the row', { annotation: [{ type: 'case', description: 'cells.base-hover-apply-revert' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await setColumnHints(page, 'FirstName', { hoverstyle: `color: ${RED}` });
        const grid = await mountLoaded(page);

        const color = async (index: number, column: string) => (await rowCells(grid, index))[column].textStyle.color;
        const defaultColor = await color(3, 'FirstName');
        expect(defaultColor).not.toBe(RED);

        const center = await rowCenter(grid, 3);
        await page.mouse.move(center.x, center.y, { steps: 5 });
        await expect.poll(() => color(3, 'FirstName')).toBe(RED);
        expect(await color(3, 'LastName')).toBe(defaultColor);
        expect(await color(2, 'FirstName')).toBe(defaultColor);
        expect(await color(4, 'FirstName')).toBe(defaultColor);

        await moveToHeader(page, grid);
        await expect.poll(() => color(3, 'FirstName')).toBe(defaultColor);
    });

    for (const variant of ['style', 'foreground'] as const) {
        test(`hoverstyle temporarily overrides style and foreground (${variant})`, { annotation: [{ type: 'case', description: 'cells.base-hover-over-style' }] }, async ({ page }) => {
            await gridPage(page);
            await loadQuery(page);
            await setColumnHints(page, 'FirstName', variant === 'style' ? { style: `color: ${BLUE}`, hoverstyle: `color: ${RED}` } : { foreground: BLUE, hoverstyle: `color: ${RED}` });
            const grid = await mountLoaded(page);

            const color = async () => (await rowCells(grid, 3)).FirstName.textStyle.color;
            expect(await color()).toBe(BLUE);

            const center = await rowCenter(grid, 3);
            await page.mouse.move(center.x, center.y, { steps: 5 });
            await expect.poll(color).toBe(RED);

            await moveToHeader(page, grid);
            await expect.poll(color).toBe(BLUE);
        });
    }

    test('a hovered row picks up the new item\'s hoverstyle', { annotation: [{ type: 'case', description: 'cells.base-hover-recycle-new-hint' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(() => (window as any).q.items[45].getFullValue('FirstName').typeHints.hoverstyle = 'font-style: italic');
        const grid = await mountLoaded(page);

        const center = await rowCenter(grid, 0);
        await page.mouse.move(center.x, center.y, { steps: 5 });
        expect((await rowCells(grid, 0)).FirstName.textStyle['font-style']).toBe('normal');

        await wheelGrid(page, grid, 45 * 32, { move: false });
        expect(await rowAt(grid, center.y)).toBe(45);
        await expect.poll(async () => (await rowCells(grid, 45)).FirstName.textStyle['font-style']).toBe('italic');
        expect((await rowCells(grid, 45)).LastName.textStyle['font-style']).toBe('normal');
    });

    test('group header rows apply no hover styles', { annotation: [{ type: 'case', description: 'cells.base-hover-ignored-rows' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await setColumnHints(page, 'FirstName', { hoverstyle: `color: ${RED}` });
        await page.evaluate(async () => { await (window as any).q.group('Gender'); });
        const grid = await mountLoaded(page);

        const inlineColors = () => grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].flatMap((r: any) => [...r.querySelectorAll('.column')].map((c: any) => c.style.color)).filter(c => c));
        const female = await grid.evaluate((g: any) => {
            const row = [...g.shadowRoot.querySelectorAll('vi-query-grid-row[is-group]')].find((r: any) => r.item?.name === 'Female') as HTMLElement;
            const b = row.getBoundingClientRect();
            return { x: b.left + Math.min(b.width / 2, 300), y: b.top + b.height / 2 };
        });

        await page.mouse.move(female.x, female.y, { steps: 5 });
        await nextFrames(page, 3);
        expect(await inlineColors()).toEqual([]);
        expect((await readCells(grid)).every(r => r.cells.FirstName.textStyle.color !== RED)).toBe(true);

        // Control: hovering a data row applies the hover style
        const index = (await readCells(grid))[1].index;
        const center = await rowCenter(grid, index);
        await page.mouse.move(center.x, center.y, { steps: 5 });
        await expect.poll(async () => (await rowCells(grid, index)).FirstName.textStyle.color).toBe(RED);
    });

    test('hover style does not leak to a recycled row', { annotation: [{ type: 'case', description: 'cells.base-hover-no-recycle-leak' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(RED => (window as any).q.items[0].typeHints.hoverstyle = `color: ${RED}`, RED);
        const grid = await mountLoaded(page);
        const defaultColor = (await rowCells(grid, 1)).FirstName.textStyle.color;

        const center = await rowCenter(grid, 0);
        await page.mouse.move(center.x, center.y, { steps: 5 });
        await expect.poll(async () => (await rowCells(grid, 0)).FirstName.textStyle.color).toBe(RED);

        await wheelGrid(page, grid, 40 * 32, { move: false });
        const index = await rowAt(grid, center.y);
        expect(index).toBe(40);
        const cells = await rowCells(grid, index);
        expect(cells.Email.text).not.toBe(LEMMENS);
        expect(cells.FirstName.textStyle.color).toBe(defaultColor);
        expect(cells.Email.textStyle.color).toBe(defaultColor);

        await moveToHeader(page, grid);
        await expect.poll(async () => (await rowCells(grid, index)).FirstName.textStyle.color).toBe(defaultColor);
    });
});

test.describe('Sensitive', () => {
    test('app sensitivity blurs only sensitive cells and toggles live', { annotation: [{ type: 'case', description: 'cells.base-sens-blur-toggle' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'YesNo', 'Image', 'Secret']);
        // Secret is sensitive on the server; YesNo (boolean cell) and Image are made sensitive client-side
        await page.evaluate(() => {
            const q = (window as any).q;
            ['YesNo', 'Image'].forEach(name => Object.defineProperty(q.getColumn(name), 'isSensitive', { get: () => true, configurable: true }));
        });
        const grid = await mountLoaded(page);

        const blurred = async () => {
            const cells = (await rowCells(grid, 0));
            return Object.fromEntries(Object.values(cells).map(c => [c.column, c.filters.some(f => /blur\(/.test(f))]));
        };

        expect(await blurred()).toEqual({ Id: false, Text: false, YesNo: false, Image: false, Secret: false });

        await page.evaluate(() => (window as any).Vidyano.ServiceBus.send('vi-app:sensitive-changed', true));
        await expect.poll(blurred).toEqual({ Id: false, Text: false, YesNo: true, Image: true, Secret: true });

        await page.evaluate(() => (window as any).Vidyano.ServiceBus.send('vi-app:sensitive-changed', false));
        await expect.poll(blurred).toEqual({ Id: false, Text: false, YesNo: false, Image: false, Secret: false });
    });

    test('cells of a sensitive column reflect the sensitive attribute', { annotation: [{ type: 'case', description: 'cells.base-sens-attribute' }] }, async ({ page }) => {
        // QueryGrid_ColumnOptions: LastName is sensitive on the server
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_ColumnOptions' });

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            expect(Object.keys(row.cells)).toContain('LastName');
            for (const cell of Object.values(row.cells))
                expect(cell.attributes.includes('sensitive'), `${cell.column} of row ${row.index}`).toBe(cell.column === 'LastName');
        }
    });

    test('cells created while sensitivity is on are blurred at once', { annotation: [{ type: 'case', description: 'cells.base-sens-receive-last' }] }, async ({ page }) => {
        await gridPage(page);
        await page.evaluate(() => (window as any).Vidyano.ServiceBus.send('vi-app:sensitive-changed', true));
        try {
            const grid = await mountGrid(page, { query: 'QueryGrid_ColumnOptions' });

            const rows = await readCells(grid);
            expect(rows.length).toBeGreaterThan(5);
            for (const row of rows) {
                for (const cell of Object.values(row.cells))
                    expect(cell.filters.some(f => /blur\(/.test(f)), `${cell.column} of row ${row.index}`).toBe(cell.column === 'LastName');
            }
        }
        finally {
            await page.evaluate(() => (window as any).Vidyano.ServiceBus.send('vi-app:sensitive-changed', false));
        }
    });

    test('cells of a re-attached grid still follow app sensitivity', { annotation: [{ type: 'case', description: 'cells.base-sens-reattach' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_ColumnOptions' });
        await grid.evaluate(g => {
            const container = g.parentElement!;
            g.remove();
            container.appendChild(g);
        });

        const blurred = async () => Object.fromEntries(Object.values(await rowCells(grid, 0)).map(c => [c.column, c.filters.some(f => /blur\(/.test(f))]));
        try {
            await page.evaluate(() => (window as any).Vidyano.ServiceBus.send('vi-app:sensitive-changed', true));
            await expect.poll(async () => (await blurred()).LastName).toBe(true);
            expect(Object.entries(await blurred()).filter(([, blur]) => blur).map(([column]) => column)).toEqual(['LastName']);
        }
        finally {
            await page.evaluate(() => (window as any).Vidyano.ServiceBus.send('vi-app:sensitive-changed', false));
        }

        await expect.poll(async () => (await blurred()).LastName).toBe(false);
    });
});

test.describe('Width measurement', () => {
    test('a grouped grid measures from the first non-group row', { annotation: [{ type: 'case', description: 'cells.base-measure-grouped' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);
        await page.evaluate(async () => { await (window as any).q.group('Gender'); });
        const grid = await mountLoaded(page);

        const tracks = await columnTracks(grid);
        expect(tracks).toHaveLength(9);
        expect(tracks.every(t => t > 0)).toBe(true);

        const layout = await grid.evaluate((g: any) => {
            const box = (e: Element) => {
                const b = e.getBoundingClientRect();
                return { left: b.left, width: b.width };
            };
            const top = (e: Element) => e.getBoundingClientRect().top;
            const rows = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden')).sort((a, b) => top(a) - top(b)) as HTMLElement[];
            const firstItemRow = rows.find(r => !r.hasAttribute('is-group'))!;
            const groupRows = rows.filter(r => r.hasAttribute('is-group'));
            return {
                firstIsGroup: rows[0].hasAttribute('is-group'),
                headers: [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].filter((h: any) => getComputedStyle(h).display !== 'none').map(box),
                cells: [...firstItemRow.querySelectorAll('.column')].map((c: any) => ({ ...box(c), scrollWidth: c.scrollWidth })),
                groupRows: groupRows.length,
                visibleGroupCells: groupRows.flatMap(r => [...r.querySelectorAll('.column')]).filter((c: any) => c.checkVisibility() && c.getBoundingClientRect().width > 0 && c.getBoundingClientRect().height > 0).length
            };
        });

        expect(layout.firstIsGroup).toBe(true);
        expect(layout.groupRows).toBeGreaterThan(0);
        expect(layout.visibleGroupCells).toBe(0);
        expect(layout.cells).toHaveLength(9);
        layout.cells.forEach((cell, i) => {
            expect(tracks[i], `track ${i}`).toBeGreaterThanOrEqual(cell.scrollWidth - 1);
            expect(Math.abs(layout.headers[i].left - cell.left), `header ${i} left`).toBeLessThanOrEqual(1);
            expect(Math.abs(layout.headers[i].width - cell.width), `header ${i} width`).toBeLessThanOrEqual(1);
        });
    });

    test('detaching during measurement still initializes after re-attach', { annotation: [{ type: 'case', description: 'cells.base-measure-detach-reattach' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page);

        // Detect the first rendered item row with a MutationObserver, remove the grid in the next animation frame
        // (before the cells' ResizeObserver reports) and re-append it two frames later
        const wasInitializing = await page.evaluate(() => new Promise<boolean>((resolve, reject) => {
            const w = window as any;
            const container = document.getElementById('test-container')!;
            const grid = document.createElement('vi-query-grid') as any;
            grid.query = w.q;
            w.grid = grid;

            const timeout = setTimeout(() => reject(new Error('No row rendered')), 10000);
            let observer: MutationObserver | undefined;
            let done = false;
            const watch = () => {
                if (done || ![...(grid.shadowRoot?.querySelectorAll('vi-query-grid-row') ?? [])].some((r: any) => r.item && r.querySelector('.column')))
                    return;

                done = true;
                observer?.disconnect();
                clearTimeout(timeout);
                requestAnimationFrame(() => {
                    const initializing = grid.hasAttribute('initializing');
                    grid.remove();
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        container.appendChild(grid);
                        resolve(initializing);
                    }));
                });
            };

            container.appendChild(grid);
            const observe = () => {
                if (!grid.shadowRoot)
                    return void setTimeout(observe);

                observer = new MutationObserver(watch);
                observer.observe(grid.shadowRoot, { childList: true, subtree: true });
                watch();
            };
            observe();
        }));

        expect(wasInitializing).toBe(true);
        const grid = page.locator('#test-container > vi-query-grid');
        await waitForGridReady(grid);
        await expect(grid).not.toHaveAttribute('initializing');
        expect(await columnTracks(grid)).toHaveLength(9);
    });
});
