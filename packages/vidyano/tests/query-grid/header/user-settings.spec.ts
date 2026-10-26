import { expect } from '@playwright/test';
import { headerNames, savedSettings, test, waitForGridReady } from '../_helpers/query-grid';
import { dialogButton, dialogLists, dialogRow, header, headerGrid, headerWidths, menuItem, openConfigure, openMenu, pressRowButton, queryId, resizeColumn, waitForDialogClosed } from '../_helpers/header';

/**
 * QueryGridUserSettings runs in the browser: it lives in the vidyano bundle (exported from index.js),
 * not in the core package, so the "node" cases load it from the dev bundle on the bare page.
 */

const PEOPLE_COLUMNS = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];

test.describe('Load', () => {
    test('Load mirrors the query columns when no settings are stored', { annotation: [{ type: 'case', description: 'header.us-load-defaults' }] }, async ({ page }) => {
        await headerGrid(page);

        const result = await page.evaluate(() => {
            const w = window as any;
            const q = w.grid.query;
            delete w.service.application.userSettings.QueryGridSettings[q.id];

            const settings = w.m.QueryGridUserSettings.Load(q);
            return {
                columns: settings.columns.map((c: any) => ({ name: c.name, offset: c.offset, isPinned: c.isPinned, isHidden: c.isHidden, width: c.width ?? null })),
                expected: q.columns.map((c: any) => ({ name: c.name, offset: c.offset, isPinned: c.isPinned, isHidden: c.isHidden, width: c.width ?? null })),
                emailIsColumn: settings.getColumn('Email').column === q.columns.find((c: any) => c.name === 'Email')
            };
        });

        expect(result.columns.map(c => c.name)).toEqual(PEOPLE_COLUMNS);
        expect(result.columns.map(c => c.offset)).toEqual([10, 20, 35, 38, 42, 50, 60, 65, 70]);
        expect(result.columns).toEqual([...result.expected].sort((a, b) => a.offset - b.offset));
        expect(result.columns.every(c => !c.isPinned && !c.isHidden && c.width === null)).toBe(true);
        expect(result.emailIsColumn).toBe(true);
    });

    test('Load applies stored offset, pinned, hidden and width, with fallback per property', { annotation: [{ type: 'case', description: 'header.us-load-applies-stored' }] }, async ({ page }) => {
        await headerGrid(page);

        const columns = await page.evaluate(() => {
            const w = window as any;
            const q = w.grid.query;
            w.service.application.userSettings.QueryGridSettings[q.id] = {
                Email: { isHidden: true },
                LastName: { isPinned: true, width: '200px' },
                IsActive: { offset: 5 }
            };

            try {
                return w.m.QueryGridUserSettings.Load(q).columns.map((c: any) => ({ name: c.name, offset: c.offset, isPinned: c.isPinned, isHidden: c.isHidden, width: c.width ?? null }));
            }
            finally {
                delete w.service.application.userSettings.QueryGridSettings[q.id];
            }
        });

        expect(columns.map(c => c.name)).toEqual(['IsActive', 'FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact']);
        expect(columns.find(c => c.name === 'IsActive')).toEqual({ name: 'IsActive', offset: 5, isPinned: false, isHidden: false, width: null });
        expect(columns.find(c => c.name === 'LastName')).toEqual({ name: 'LastName', offset: 20, isPinned: true, isHidden: false, width: '200px' });
        expect(columns.find(c => c.name === 'Email')).toEqual({ name: 'Email', offset: 50, isPinned: false, isHidden: true, width: null });
        expect(columns.find(c => c.name === 'FirstName')).toEqual({ name: 'FirstName', offset: 10, isPinned: false, isHidden: false, width: null });
    });

    test('keeps the first column visible when stored settings hide every column', { annotation: [{ type: 'case', description: 'header.us-load-all-hidden-guard' }] }, async ({ page }) => {
        const allHidden = Object.fromEntries(PEOPLE_COLUMNS.map(n => [n, { isHidden: true }]));
        const grid = await headerGrid(page, { userSettings: allHidden });

        const visible = await page.evaluate(() => {
            const w = window as any;
            return w.m.QueryGridUserSettings.Load(w.grid.query).columns.filter((c: any) => !c.isHidden).map((c: any) => c.name);
        });
        expect(visible).toEqual(['FirstName']);

        expect(await headerNames(grid)).toEqual(['FirstName']);
    });

    test('Load creates the QueryGridSettings bag when it is missing', { annotation: [{ type: 'case', description: 'header.us-load-creates-bag' }] }, async ({ page }) => {
        await headerGrid(page);

        const result = await page.evaluate(() => {
            const w = window as any;
            const userSettings = w.service.application.userSettings;
            delete userSettings.QueryGridSettings;

            const settings = w.m.QueryGridUserSettings.Load(w.grid.query);
            return { columns: settings.columns.length, has: 'QueryGridSettings' in userSettings, bag: userSettings.QueryGridSettings };
        });

        expect(result).toEqual({ columns: 9, has: true, bag: {} });
    });

    test('scopes settings to the query id', { annotation: [{ type: 'case', description: 'header.us-load-keyed-by-query-id' }] }, async ({ page }) => {
        await headerGrid(page);

        const result = await page.evaluate(async () => {
            const w = window as any;
            const bag = w.service.application.userSettings.QueryGridSettings;
            const Load = w.m.QueryGridUserSettings.Load;

            const none = await w.service.getQuery('QueryGrid_None');
            const filter = await w.service.getQuery('QueryGrid_Filter');
            bag[none.id] = { Email: { isHidden: true, isPinned: true } };
            const filterEmail = Load(filter).getColumn('Email');
            const noneEmail = Load(none).getColumn('Email');

            const people = w.grid.query;
            const lookup = await w.service.getQuery('People', true);
            bag[people.id] = { Email: { isPinned: true } };
            const lookupEmail = Load(lookup).getColumn('Email');

            return {
                differentIds: none.id !== filter.id,
                filterEmail: { isHidden: filterEmail.isHidden, isPinned: filterEmail.isPinned },
                noneEmail: { isHidden: noneEmail.isHidden, isPinned: noneEmail.isPinned },
                lookup: { asLookup: lookup.asLookup, sameId: lookup.id === people.id, isPinned: lookupEmail.isPinned }
            };
        });

        expect(result).toEqual({
            differentIds: true,
            filterEmail: { isHidden: false, isPinned: false },
            noneEmail: { isHidden: true, isPinned: true },
            lookup: { asLookup: true, sameId: true, isPinned: true }
        });
    });

    test('ignores stored settings for unknown column names', { annotation: [{ type: 'case', description: 'gap.us-load-unknown-column-ignored' }] }, async ({ page }) => {
        await headerGrid(page);

        const result = await page.evaluate(() => {
            const w = window as any;
            const q = w.grid.query;
            w.service.application.userSettings.QueryGridSettings[q.id] = { Bogus: { isPinned: true }, Email: { isPinned: true } };

            const settings = w.m.QueryGridUserSettings.Load(q);
            return {
                names: settings.columns.map((c: any) => c.name),
                bogus: settings.getColumn('Bogus') === undefined,
                pinned: settings.columns.filter((c: any) => c.isPinned).map((c: any) => c.name)
            };
        });

        expect(result.names).toHaveLength(9);
        expect(result.names).not.toContain('Bogus');
        expect(result.bogus).toBe(true);
        expect(result.pinned).toEqual(['Email']);
    });
});

test.describe('Accessors', () => {
    test('getColumn and query accessors', { annotation: [{ type: 'case', description: 'header.us-getcolumn-unknown' }] }, async ({ page }) => {
        await headerGrid(page);

        const result = await page.evaluate(() => {
            const w = window as any;
            const q = w.grid.query;
            const settings = w.m.QueryGridUserSettings.Load(q);
            return { unknown: settings.getColumn('Nope') === undefined, name: settings.getColumn('FirstName').name, sameQuery: settings.query === q };
        });

        expect(result).toEqual({ unknown: true, name: 'FirstName', sameQuery: true });
    });
});

test.describe('save()', () => {
    test('save() stores only what differs from the defaults', { annotation: [{ type: 'case', description: 'header.us-save-diff-only' }] }, async ({ page }) => {
        await headerGrid(page);
        const id = await queryId(page);

        const stored = await page.evaluate(async () => {
            const w = window as any;
            const settings = w.m.QueryGridUserSettings.Load(w.grid.query);
            settings.getColumn('Gender').isHidden = true;
            settings.getColumn('FirstName').width = '150px';
            await settings.save(false);

            return w.service.application.userSettings.QueryGridSettings[w.grid.query.id];
        });

        const expected = { FirstName: { width: '150px' }, Gender: { isHidden: true } };
        expect(stored).toEqual(expected);

        const saves = await savedSettings(page);
        expect(saves).toHaveLength(1);
        expect(saves[0].QueryGridSettings[id]).toEqual(expected);
    });

    test('save() removes the query entry when nothing differs', { annotation: [{ type: 'case', description: 'header.us-save-no-diff-deletes-key' }] }, async ({ page }) => {
        await headerGrid(page);
        const id = await queryId(page);

        const hasKey = await page.evaluate(async () => {
            const w = window as any;
            const q = w.grid.query;
            const settings = w.m.QueryGridUserSettings.Load(q);
            settings.getColumn('Gender').isHidden = true;
            settings.getColumn('FirstName').width = '150px';
            await settings.save(false);

            const before = q.id in w.service.application.userSettings.QueryGridSettings;
            settings.getColumn('Gender').isHidden = false;
            settings.getColumn('FirstName').width = undefined;
            await settings.save(false);

            return { before, after: q.id in w.service.application.userSettings.QueryGridSettings };
        });

        expect(hasKey).toEqual({ before: true, after: false });

        const saves = await savedSettings(page);
        expect(saves).toHaveLength(2);
        expect(id in saves[1].QueryGridSettings).toBe(false);
    });

    test('save() persists through one user-settings save request', { annotation: [{ type: 'case', description: 'header.us-save-hits-backend' }] }, async ({ page }) => {
        await headerGrid(page);
        const userSettingsId: string = await page.evaluate(() => (window as any).service.application.userSettingsId);

        const order: string[] = [];
        const getRequests: any[] = [];
        page.on('request', request => {
            if (request.method() === 'POST' && request.url().endsWith('/GetPersistentObject')) {
                const body = request.postDataJSON();
                getRequests.push(body);
                if (JSON.stringify(body).includes(userSettingsId))
                    order.push('get');
            }
        });

        // Never write the admin's settings to the shared backend: answer the save ourselves
        const saveRequests: any[] = [];
        await page.route('**/ExecuteAction', async route => {
            const body = route.request().postDataJSON();
            if (body?.action !== 'PersistentObject.Save')
                return route.continue();

            saveRequests.push(body);
            order.push('save');
            await route.fulfill({ json: { result: body.parent } });
        });

        const userSettings = await page.evaluate(async () => {
            const w = window as any;
            const application = w.service.application;
            // Restore the real saveUserSettings (gridPage stubs it on the instance)
            delete application.saveUserSettings;
            application.userSettings.QuerySettings['pw-untouched'] = { sortOptions: 'Name ASC' };

            const settings = w.m.QueryGridUserSettings.Load(w.grid.query);
            settings.getColumn('Gender').isHidden = true;
            await settings.save(false);

            return JSON.parse(JSON.stringify(application.userSettings));
        });

        expect(saveRequests).toHaveLength(1);
        expect(getRequests.some(r => JSON.stringify(r).includes(userSettingsId))).toBe(true);
        expect(order.indexOf('get')).toBeGreaterThanOrEqual(0);
        expect(order.indexOf('get')).toBeLessThan(order.indexOf('save'));
        const settingsValue = saveRequests[0].parent.attributes.find((a: any) => a.name === 'Settings').value;
        expect(JSON.parse(settingsValue)).toEqual(userSettings);
        expect(JSON.parse(settingsValue).QuerySettings['pw-untouched']).toEqual({ sortOptions: 'Name ASC' });
    });

    test('save() notifies \'columns\' unless refresh is disabled', { annotation: [{ type: 'case', description: 'header.us-save-notify' }] }, async ({ page }) => {
        await headerGrid(page);

        const result = await page.evaluate(async () => {
            const w = window as any;
            const settings = w.m.QueryGridUserSettings.Load(w.grid.query);
            const changes: string[] = [];
            const dispose = settings.propertyChanged.attach((_: any, detail: any) => changes.push(detail.propertyName));

            try {
                settings.getColumn('IsActive').offset = 5;
                await settings.save();
                const afterSave = changes.slice();
                const order = settings.columns.map((c: any) => c.name);

                settings.getColumn('Email').offset = 1;
                await settings.save(false);

                return { afterSave, afterSaveFalse: changes.slice(afterSave.length), order };
            }
            finally {
                dispose();
            }
        });

        expect(result.afterSave).toEqual(['columns']);
        expect(result.order).toEqual(['IsActive', ...PEOPLE_COLUMNS.filter(n => n !== 'IsActive')]);
        expect(result.afterSaveFalse).toEqual([]);
        expect(await savedSettings(page)).toHaveLength(2);
    });

    test('save() stores the first column as visible when every column is hidden', { annotation: [{ type: 'case', description: 'header.us-save-all-hidden-guard' }] }, async ({ page }) => {
        await headerGrid(page);
        const id = await queryId(page);

        const result = await page.evaluate(async () => {
            const w = window as any;
            const settings = w.m.QueryGridUserSettings.Load(w.grid.query);
            settings.columns.forEach((c: any) => c.isHidden = true);
            await settings.save(false);

            return { visible: settings.columns.filter((c: any) => !c.isHidden).map((c: any) => c.name), stored: w.service.application.userSettings.QueryGridSettings[w.grid.query.id] };
        });

        const expected = Object.fromEntries(PEOPLE_COLUMNS.slice(1).map(name => [name, { isHidden: true }]));
        expect(result.visible).toEqual(['FirstName']);
        expect(result.stored).toEqual(expected);
        expect((await savedSettings(page))[0].QueryGridSettings[id]).toEqual(expected);
    });

    test('column changes stay pending until save()', { annotation: [{ type: 'case', description: 'header.us-by-reference-mutation' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { userSettings: { LastName: { width: '170px' } } });
        const id = await queryId(page);

        const stored = await page.evaluate(() => {
            const w = window as any;
            w.grid.userSettings.getColumn('LastName').width = undefined;
            w.grid.userSettings.getColumn('Gender').isHidden = true;

            return JSON.parse(JSON.stringify(w.service.application.userSettings.QueryGridSettings[w.grid.query.id]));
        });
        expect(stored).toEqual({ LastName: { width: '170px' } });

        // An unrelated user settings save (a sort) keeps the stored entry
        await header(grid, 'LastName').locator('div.label > label').click();
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await waitForGridReady(grid);
        expect((await savedSettings(page))[0].QueryGridSettings[id]).toEqual({ LastName: { width: '170px' } });

        // The grid settings' own save stores the pending changes
        await page.evaluate(() => (window as any).grid.userSettings.save(false));
        expect((await savedSettings(page))[1].QueryGridSettings[id]).toEqual({ Gender: { isHidden: true } });
    });
});

test.describe('Persistence', () => {
    test('a recorded settings payload restores the layout in a fresh page', { annotation: [{ type: 'case', description: 'header.us-roundtrip' }] }, async ({ page, context }) => {
        const grid = await headerGrid(page);
        const id = await queryId(page);

        const width = (await headerWidths(grid)).LastName;
        await resizeColumn(grid, 'LastName', 190 - width);
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await waitForGridReady(grid);

        const h = await openMenu(grid, 'Gender');
        await menuItem(h, 'Hide column').click();
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(2);
        await waitForGridReady(grid);

        const payload = (await savedSettings(page))[1].QueryGridSettings[id];
        expect(Object.keys(payload).sort()).toEqual(['Gender', 'LastName']);
        expect(payload.Gender).toEqual({ isHidden: true });
        expect(Math.abs(parseFloat(payload.LastName.width) - 190)).toBeLessThanOrEqual(1);

        const fresh = await context.newPage();
        const freshGrid = await headerGrid(fresh, { userSettings: structuredClone(payload) });

        expect(await headerNames(freshGrid)).toEqual(PEOPLE_COLUMNS.filter(n => n !== 'Gender'));
        expect(Math.abs((await headerWidths(freshGrid)).LastName - parseFloat(payload.LastName.width))).toBeLessThanOrEqual(1);

        const loaded = await fresh.evaluate(() => {
            const w = window as any;
            const settings = w.m.QueryGridUserSettings.Load(w.grid.query);
            return { lastName: settings.getColumn('LastName').width, gender: settings.getColumn('Gender').isHidden };
        });
        expect(loaded).toEqual({ lastName: payload.LastName.width, gender: true });
        expect(await savedSettings(fresh)).toHaveLength(0);
    });
});

test.describe('Grid integration', () => {
    test('the grid shows visible columns, pinned first, then by offset', { annotation: [{ type: 'case', description: 'header.us-grid-columns-order' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { userSettings: { IsActive: { offset: 5 }, Email: { isPinned: true }, Gender: { isHidden: true } } });

        expect(await headerNames(grid)).toEqual(['Email', 'IsActive', 'FirstName', 'LastName', 'BirthDate', 'ContactPreference', 'PhoneNumber', 'EmergencyContact']);
    });

    test('excludes width "0" columns from the settings and the configure dialog', { annotation: [{ type: 'case', description: 'header.us-width-zero-excluded' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { query: 'QueryGrid_ColumnOptions' });

        const loaded = await page.evaluate(() => {
            const w = window as any;
            const settings = w.m.QueryGridUserSettings.Load(w.grid.query);
            return { emergencyContact: settings.getColumn('EmergencyContact') === undefined, names: settings.columns.map((c: any) => c.name) };
        });
        expect(loaded.emergencyContact).toBe(true);
        expect(loaded.names).not.toContain('EmergencyContact');
        expect(loaded.names).toHaveLength(8);

        expect(await headerNames(grid)).not.toContain('EmergencyContact');

        const dialog = await openConfigure(grid);
        const lists = await dialogLists(dialog);
        const labels = [...lists.pinned.rows, ...lists.unpinned.rows].map(r => r.label);
        expect(labels).toHaveLength(8);
        expect(labels).not.toContain('Emergency contact');
    });

    // ColumnOptions pins BirthDate on the server; a width stored for it must not make it impossible to unpin
    test('Unpin works on a server-pinned column, with and without a stored entry', { annotation: [{ type: 'case', description: 'header.us-unpin-server-pinned' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { query: 'QueryGrid_ColumnOptions' });
        const id = await queryId(page);
        const unpinnedOrder = ['FirstName', 'LastName', 'BirthDate', 'ContactPreference', 'Email', 'PhoneNumber', 'IsActive'];
        expect((await headerNames(grid))[0]).toBe('BirthDate');

        // Without a stored entry
        let h = await openMenu(grid, 'BirthDate');
        await expect(menuItem(h, 'Unpin')).toBeVisible();
        await menuItem(h, 'Unpin').click();
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await expect.poll(() => headerNames(grid)).toEqual(unpinnedOrder);
        expect((await savedSettings(page))[0].QueryGridSettings[id]).toEqual({ BirthDate: { isPinned: false } });
        await waitForGridReady(grid);
        await page.keyboard.press('Escape');

        // With a stored width only
        await page.evaluate(() => {
            const w = window as any;
            w.grid.remove();
            w.service.application.userSettings.QueryGridSettings[w.q.id] = { BirthDate: { width: '150px' } };
            const grid = document.createElement('vi-query-grid') as any;
            grid.query = w.q;
            document.getElementById('test-container')!.appendChild(grid);
            w.grid = grid;
        });
        await waitForGridReady(grid);
        expect((await headerNames(grid))[0]).toBe('BirthDate');

        h = await openMenu(grid, 'BirthDate');
        await menuItem(h, 'Unpin').click();
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(2);
        await expect.poll(() => headerNames(grid)).toEqual(unpinnedOrder);
        expect((await savedSettings(page))[1].QueryGridSettings[id]).toEqual({ BirthDate: { width: '150px', isPinned: false } });
    });

    test('Unpin from the configure dialog works on a server-pinned column with a stored width', { annotation: [{ type: 'case', description: 'header.us-unpin-server-pinned-dialog' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { query: 'QueryGrid_ColumnOptions', userSettings: { BirthDate: { width: '150px' } } });
        const id = await queryId(page);
        expect((await headerNames(grid))[0]).toBe('BirthDate');

        const dialog = await openConfigure(grid);
        await expect(dialogRow(dialog, 'Birth date')).toHaveAttribute('is-pinned', '');
        await pressRowButton(dialog, 'Birth date', 'Pin');
        await expect(dialogRow(dialog, 'Birth date')).not.toHaveAttribute('is-pinned');
        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);

        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await expect.poll(() => headerNames(grid)).toEqual(['FirstName', 'LastName', 'BirthDate', 'ContactPreference', 'Email', 'PhoneNumber', 'IsActive']);
        expect((await savedSettings(page))[0].QueryGridSettings[id]).toEqual({ BirthDate: { width: '150px', isPinned: false } });
    });
});
