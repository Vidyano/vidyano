import { expect, test } from '@playwright/test';
import { columnTracks, gridPage, headerNames, mountGrid } from '../_helpers/query-grid';
import { loadQuery } from '../_helpers/cells';

// QueryGridColumn lives in the web components bundle, so these cases run on the bare page through the public export (m.QueryGridColumn) without creating a grid.

test.describe('QueryGridColumn', () => {
    test.beforeEach(async ({ page }) => {
        await gridPage(page);
        await loadQuery(page, 'People', { sortByFirstName: false });
    });

    test('read-only getters delegate to the wrapped QueryColumn', { annotation: [{ type: 'case', description: 'cells.qgc-delegates' }] }, async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as any;
            const q = w.q;
            const column = q.getColumn('FirstName');
            const gc = new w.m.QueryGridColumn(column, {});
            return {
                column: gc.column === column,
                query: gc.query === q,
                name: gc.name,
                label: gc.label,
                type: gc.type,
                canSort: gc.canSort,
                canFilter: gc.canFilter,
                canListDistincts: gc.canListDistincts,
                canGroupBy: gc.canGroupBy,
                birthDateCanGroupBy: new w.m.QueryGridColumn(q.getColumn('BirthDate'), {}).canGroupBy,
                emergencyContactType: new w.m.QueryGridColumn(q.getColumn('EmergencyContact'), {}).type
            };
        });

        expect(result).toEqual({
            column: true,
            query: true,
            name: 'FirstName',
            label: 'First name',
            type: 'String',
            canSort: true,
            canFilter: true,
            canListDistincts: true,
            canGroupBy: false,
            birthDateCanGroupBy: true,
            emergencyContactType: 'Reference'
        });
    });

    test('undefined settings fall back to the QueryColumn, live', { annotation: [{ type: 'case', description: 'cells.qgc-fallback' }] }, async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as any;
            const column = w.q.getColumn('FirstName');
            const gc = new w.m.QueryGridColumn(column, {});
            const read = () => ({ offset: gc.offset, isPinned: gc.isPinned, isHidden: gc.isHidden, width: gc.width });
            const before = read();
            column.width = '120px';
            column.isPinned = true;
            column.offset = 99;
            return { before, after: read() };
        });

        expect(result.before).toEqual({ offset: 10, isPinned: false, isHidden: false, width: undefined });
        expect(result.after).toEqual({ offset: 99, isPinned: true, isHidden: false, width: '120px' });
    });

    test('defined settings win, including falsy values', { annotation: [{ type: 'case', description: 'cells.qgc-userdata-precedence' }] }, async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as any;
            const read = (gc: any) => ({ offset: gc.offset, isPinned: gc.isPinned, isHidden: gc.isHidden, width: gc.width });
            const truthy = read(new w.m.QueryGridColumn(w.q.getColumn('FirstName'), { offset: 5, isPinned: true, isHidden: true, width: '80px' }));

            const column = w.q.getColumn('LastName');
            column.offset = 10;
            column.isPinned = true;
            column.isHidden = true;
            column.width = '99px';
            const falsy = read(new w.m.QueryGridColumn(column, { offset: 0, isPinned: false, isHidden: false, width: '' }));

            return { truthy, falsy };
        });

        expect(result.truthy).toEqual({ offset: 5, isPinned: true, isHidden: true, width: '80px' });
        expect(result.falsy).toEqual({ offset: 0, isPinned: false, isHidden: false, width: '' });
    });

    test('isPinned notifies only on change', { annotation: [{ type: 'case', description: 'cells.qgc-ispinned-notify' }] }, async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as any;
            const data: any = { isPinned: false };
            const gc = new w.m.QueryGridColumn(w.q.getColumn('FirstName'), data);
            const events: any[][] = [];
            gc.propertyChanged.attach((_: any, args: any) => events.push([args.propertyName, args.newValue, args.oldValue]));

            const steps: any[] = [];
            gc.isPinned = true;
            steps.push({ events: events.splice(0), data: data.isPinned });
            gc.isPinned = true;
            steps.push({ events: events.splice(0), data: data.isPinned });
            gc.isPinned = false;
            steps.push({ events: events.splice(0), data: data.isPinned });

            return steps;
        });

        expect(result).toEqual([
            { events: [['isPinned', true, false]], data: true },
            { events: [], data: true },
            { events: [['isPinned', false, true]], data: false }
        ]);
    });

    test('sortDirection reflects the query\'s sort options live', { annotation: [{ type: 'case', description: 'cells.qgc-sortdirection-live' }] }, async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as any;
            const q = w.q;
            const lastName = new w.m.QueryGridColumn(q.getColumn('LastName'), {});
            const firstName = new w.m.QueryGridColumn(q.getColumn('FirstName'), {});
            const read = () => [lastName.sortDirection, firstName.sortDirection];

            q.sortOptions = [{ name: 'LastName', direction: 'DESC' }];
            const sorted = read();
            q.sortOptions = [];
            return { sorted, cleared: read() };
        });

        expect(result).toEqual({ sorted: ['DESC', ''], cleared: ['', ''] });
    });

    test('distincts returns the column\'s current distincts', { annotation: [{ type: 'case', description: 'cells.qgc-distincts-live' }] }, async ({ page }) => {
        const result = await page.evaluate(async () => {
            const w = window as any;
            const column = w.q.getColumn('Gender');
            const gc = new w.m.QueryGridColumn(column, {});
            await column.refreshDistincts();

            const distincts = gc.distincts;
            return {
                same: distincts === column.distincts,
                values: [...(distincts.matching ?? []), ...(distincts.remaining ?? [])].map((v: string) => String(v))
            };
        });

        expect(result.same).toBe(true);
        for (const gender of ['Female', 'Male', 'Unknown'])
            expect(result.values.some(v => v.includes(gender)), gender).toBe(true);
    });

    test('Load copies pin state but leaves an unset width live', { annotation: [{ type: 'case', description: 'cells.qgc-load-snapshot' }] }, async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as any;
            const settings = w.m.QueryGridUserSettings.Load(w.q);
            const gc = settings.getColumn('FirstName');
            const column = w.q.getColumn('FirstName');
            const before = { isPinned: gc.isPinned, width: gc.width };
            column.isPinned = true;
            column.width = '120px';
            return { before, after: { isPinned: gc.isPinned, width: gc.width } };
        });

        expect(result.before).toEqual({ isPinned: false, width: undefined });
        expect(result.after).toEqual({ isPinned: false, width: '120px' });
    });

    test('offset, isHidden and width setters write through silently', { annotation: [{ type: 'case', description: 'cells.qgc-setters-write-through' }] }, async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as any;
            const data: any = {};
            const gc = new w.m.QueryGridColumn(w.q.getColumn('FirstName'), data);
            const events: string[] = [];
            gc.propertyChanged.attach((_: any, args: any) => events.push(args.propertyName));

            gc.offset = 7;
            gc.isHidden = true;
            gc.width = '50px';
            return { data, events, read: { offset: gc.offset, isHidden: gc.isHidden, width: gc.width } };
        });

        expect(result.data).toEqual({ offset: 7, isHidden: true, width: '50px' });
        expect(result.events).toEqual([]);
        expect(result.read).toEqual({ offset: 7, isHidden: true, width: '50px' });
    });

    test('the isPinned setter can unpin a server-pinned column', { annotation: [{ type: 'case', description: 'cells.qgc-ispinned-unpin-server-pinned' }] }, async ({ page }) => {
        const result = await page.evaluate(() => {
            const w = window as any;
            const column = w.q.getColumn('FirstName');
            column.isPinned = true;
            const data: any = {};
            const gc = new w.m.QueryGridColumn(column, data);
            const events: any[][] = [];
            gc.propertyChanged.attach((_: any, args: any) => events.push([args.propertyName, args.newValue, args.oldValue]));

            const pinned = gc.isPinned;
            gc.isPinned = false;
            return { pinned, events, isPinned: gc.isPinned, data: data.isPinned };
        });

        expect(result).toEqual({ pinned: true, events: [['isPinned', false, true]], isPinned: false, data: false });
    });
});

test.describe('Grid integration', () => {
    test('a server-hidden column gets no header, cells or track', { annotation: [{ type: 'case', description: 'cells.base-measure-hidden-column' }] }, async ({ page }) => {
        // QueryGrid_ColumnOptions: Gender is hidden on the server (its values are still in the result)
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_ColumnOptions' });
        await expect(grid).not.toHaveAttribute('initializing');

        const names = await headerNames(grid);
        expect(names).not.toContain('Gender');
        expect(names.length).toBeGreaterThan(5);
        expect(await columnTracks(grid)).toHaveLength(names.length);

        const layout = await grid.evaluate((g: any) => {
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                const rows = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => r.item && getComputedStyle(r).display !== 'none');
                return {
                    hasGenderValue: rows.some((r: any) => r.item.getValue('Gender') != null),
                    cellsPerRow: rows.map((r: any) => [...r.querySelectorAll('.column')].filter((c: any) => getComputedStyle(c).display !== 'none').length),
                    genderCells: rows.flatMap((r: any) => [...r.querySelectorAll('.column')]).filter((c: any) => c.column?.name === 'Gender').length
                };
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        });

        expect(layout.hasGenderValue).toBe(true);
        expect(layout.cellsPerRow.length).toBeGreaterThan(5);
        expect(layout.cellsPerRow.every(count => count === names.length)).toBe(true);
        expect(layout.genderCells).toBe(0);
    });
});
