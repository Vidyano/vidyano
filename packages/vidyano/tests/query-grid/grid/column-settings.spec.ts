import { expect, Locator, Page } from '@playwright/test';
import { columnTracks, gridPage, headerNames, mountGrid, nextFrames, pageErrors, requestLog, savedSettings, test, waitForGridReady, waitForQueryIdle } from '../_helpers/query-grid';
import { clickHeaderMenuItem, columnTokens, header, headerBoxes, initializingAdds, rows, settle, watchInitializing } from '../_helpers/grid';
import { configureDialog, dialogButton, dialogRow, openConfigure, pressRowButton } from '../_helpers/header';

const PEOPLE_COLUMNS = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];

/** The names of the headers whose label is truncated. */
async function truncatedLabels(grid: Locator): Promise<string[]> {
    return (await headerBoxes(grid)).filter(h => h.labelScrollWidth > h.labelClientWidth).map(h => h.name);
}

/** Presses the FirstName resizer and drags it by dx in 10 steps, leaving the mouse down. */
async function startResize(page: Page, grid: Locator, dx: number) {
    const resizer = await header(grid, 'FirstName').locator('.resizer').boundingBox();
    const x = resizer!.x + resizer!.width / 2;
    const y = resizer!.y + resizer!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y, { steps: 10 });
    await nextFrames(page, 2);
}

test.describe('Column resize, hide and settings', () => {
    test('dragging a resizer updates the track live', { annotation: [{ type: 'case', description: 'grid.cw-resize-live' }] }, async ({ page }) => {
        await gridPage(page, { width: 2500, height: 600 });
        const grid = await mountGrid(page);

        const before = await columnTracks(grid);
        const w0 = (await headerBoxes(grid))[0].width;

        await startResize(page, grid, 100);
        const expected = Math.ceil(w0 + 100);
        await expect.poll(async () => (await columnTracks(grid))[0]).toBe(expected);

        const tracks = await columnTracks(grid);
        expect(tracks.slice(1)).toEqual(before.slice(1));
        expect(Math.abs((await headerBoxes(grid))[0].width - expected)).toBeLessThanOrEqual(1);
        (await rows(grid)).forEach(r => expect(Math.abs(r.cells[0].width - expected), `row ${r.index}`).toBeLessThanOrEqual(1));
        await expect(header(grid, 'FirstName')).toHaveClass(/\bresizing\b/);

        await page.mouse.up();
        await expect(header(grid, 'FirstName')).not.toHaveClass(/\bresizing\b/);
    });

    test('releasing a resize saves the width once without re-initializing', { annotation: [{ type: 'case', description: 'grid.cw-resize-save' }] }, async ({ page }) => {
        await gridPage(page, { width: 2500, height: 600 });
        const grid = await mountGrid(page);
        await watchInitializing(grid);
        const log = requestLog(page);
        const before = await columnTracks(grid);

        await startResize(page, grid, 100);
        await expect.poll(async () => (await columnTracks(grid))[0]).toBeGreaterThan(before[0]);
        expect(await savedSettings(page)).toHaveLength(0);

        await page.mouse.up();
        await expect.poll(async () => (await savedSettings(page)).length).toBe(1);

        const queryId = await grid.evaluate((g: any) => g.query.id);
        const saved = (await savedSettings(page))[0];
        const width: string = saved.QueryGridSettings[queryId].FirstName.width;
        expect(width).toMatch(/^\d+(\.\d+)?px$/);
        expect((await columnTracks(grid))[0]).toBe(Math.ceil(parseFloat(width)));

        await log.quiet();
        expect(log.of('ExecuteQuery')).toHaveLength(0);
        expect(await initializingAdds(page)).toBe(0);
        expect(await headerNames(grid)).toEqual(PEOPLE_COLUMNS);
        expect((await columnTracks(grid)).slice(1)).toEqual(before.slice(1));
        expect(await savedSettings(page)).toHaveLength(1);
    });

    test('hiding a middle column drops its track and keeps the other widths', { annotation: [{ type: 'case', description: 'grid.cw-hide-middle' }] }, async ({ page }) => {
        await gridPage(page, { width: 2500, height: 600 });
        const grid = await mountGrid(page);

        const before = await columnTracks(grid);
        const widthOf = Object.fromEntries(PEOPLE_COLUMNS.map((c, i) => [c, before[i]]));
        const truncatedBefore = await truncatedLabels(grid);

        await clickHeaderMenuItem(grid, 'Gender', 'Eye');
        await expect.poll(async () => (await savedSettings(page)).length).toBe(1);
        const queryId = await grid.evaluate((g: any) => g.query.id);
        expect((await savedSettings(page))[0].QueryGridSettings[queryId].Gender.isHidden).toBe(true);

        const remaining = PEOPLE_COLUMNS.filter(c => c !== 'Gender');
        await expect.poll(() => headerNames(grid)).toEqual(remaining);
        await expect.poll(async () => (await columnTokens(grid)).length).toBe(9);
        await settle(grid);

        const tokens = await columnTokens(grid);
        tokens.slice(0, 8).forEach(t => expect(t).toMatch(/^\d+px$/));
        expect(tokens[8]).toBe('minmax(0, 1fr)');

        const tracks = await columnTracks(grid);
        remaining.forEach((c, i) => expect(Math.abs(tracks[i] - widthOf[c]), c).toBeLessThanOrEqual(1));

        const headers = await headerBoxes(grid);
        remaining.forEach((c, i) => expect(Math.abs(headers[i].width - widthOf[c]), `${c} header`).toBeLessThanOrEqual(1));
        expect((await truncatedLabels(grid)).filter(c => !truncatedBefore.includes(c))).toEqual([]);
        for (const row of await rows(grid)) {
            expect(row.cells).toHaveLength(8);
            row.cells.forEach((cell, k) => expect(Math.abs(cell.x - headers[k].x), `row ${row.index} ${cell.name}`).toBeLessThanOrEqual(1));
        }
    });

    test('pinning a column keeps each column\'s own width', { annotation: [{ type: 'case', description: 'gap.grid-pin-keeps-own-widths' }] }, async ({ page }) => {
        await gridPage(page, { width: 2500, height: 600 });
        const grid = await mountGrid(page);
        await watchInitializing(grid);

        const before = await columnTracks(grid);
        const widthOf = Object.fromEntries(PEOPLE_COLUMNS.map((c, i) => [c, before[i]]));
        const truncatedBefore = await truncatedLabels(grid);

        await clickHeaderMenuItem(grid, 'Email', 'Pin');
        await expect.poll(async () => (await savedSettings(page)).length).toBe(1);
        const pinned = ['Email', ...PEOPLE_COLUMNS.filter(c => c !== 'Email')];
        await expect.poll(() => headerNames(grid)).toEqual(pinned);
        await settle(grid);

        expect(await initializingAdds(page)).toBe(0);
        const tracks = await columnTracks(grid);
        expect(tracks).toHaveLength(9);
        pinned.forEach((c, i) => expect(Math.abs(tracks[i] - widthOf[c]), c).toBeLessThanOrEqual(1));

        const headers = await headerBoxes(grid);
        pinned.forEach((c, i) => expect(Math.abs(headers[i].width - widthOf[c]), `${c} header`).toBeLessThanOrEqual(1));
        expect((await truncatedLabels(grid)).filter(c => !truncatedBefore.includes(c))).toEqual([]);
        for (const row of await rows(grid)) {
            expect(row.cells.map(c => c.name)).toEqual(pinned);
            row.cells.forEach((cell, k) => expect(Math.abs(cell.x - headers[k].x), `row ${row.index} ${cell.name}`).toBeLessThanOrEqual(1));
        }
    });

    test('hiding the last column keeps the grid rendered and aligned', { annotation: [{ type: 'case', description: 'gap.grid-hide-last-column' }] }, async ({ page }) => {
        await gridPage(page, { width: 2500, height: 600 });
        const grid = await mountGrid(page);

        await clickHeaderMenuItem(grid, 'IsActive', 'Eye');
        await expect.poll(async () => (await savedSettings(page)).length).toBe(1);
        await expect.poll(() => headerNames(grid)).toEqual(PEOPLE_COLUMNS.slice(0, 8));
        await expect(grid).not.toHaveAttribute('initializing');
        await settle(grid);

        // The old IsActive track may stay in --vi-query-grid-columns (it has no visible effect)
        const headers = await headerBoxes(grid);
        expect(headers.map(h => h.name)).toEqual(PEOPLE_COLUMNS.slice(0, 8));
        for (const row of await rows(grid)) {
            expect(row.cells.map(c => c.name)).toEqual(PEOPLE_COLUMNS.slice(0, 8));
            row.cells.forEach((cell, k) => expect(Math.abs(cell.x - headers[k].x), `row ${row.index} ${cell.name}`).toBeLessThanOrEqual(1));
        }

        const visibility = await grid.evaluate((g: any) => {
            const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as HTMLElement;
            return [getComputedStyle(g.shadowRoot.querySelector('header')).visibility, getComputedStyle(scroller).visibility];
        });
        expect(visibility).toEqual(['visible', 'visible']);
    });

    test('a saved width round-trips to a fresh page', { annotation: [{ type: 'case', description: 'grid.cw-resize-reload' }] }, async ({ page }) => {
        await gridPage(page, { width: 2500, height: 600 });
        let grid = await mountGrid(page);

        await startResize(page, grid, 100);
        await page.mouse.up();
        await expect.poll(async () => (await savedSettings(page)).length).toBe(1);

        const queryId = await grid.evaluate((g: any) => g.query.id);
        const saved = (await savedSettings(page))[0].QueryGridSettings[queryId];
        const width = parseFloat(saved.FirstName.width);
        expect(width).toBeGreaterThan(0);

        // A fresh page with the saved settings and a new query instance
        await gridPage(page, { width: 2500, height: 600 });
        grid = await mountGrid(page, { userSettings: saved });
        expect(await grid.evaluate((g: any) => g.query.id)).toBe(queryId);

        expect((await columnTokens(grid))[0]).toBe(`${Math.ceil(width)}px`);
        expect(Math.abs((await headerBoxes(grid))[0].width - Math.ceil(width))).toBeLessThanOrEqual(1);
    });

    test('a failed settings save raises no unhandled error', { annotation: [{ type: 'case', description: 'grid.up-save-failure' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page, { width: 2500, height: 600 });
        const grid = await mountGrid(page);

        await page.evaluate(() => {
            const w = window as any;
            w.__failedSaves = 0;
            w.service.application.saveUserSettings = async () => {
                w.__failedSaves++;
                throw new Error('pw: settings save failed');
            };
        });

        await clickHeaderMenuItem(grid, 'Gender', 'Eye');
        await expect.poll(() => page.evaluate(() => (window as any).__failedSaves)).toBe(1);
        await nextFrames(page, 2);
        await waitForQueryIdle(grid);

        // The column stays hidden for this session and the failure is shown on the query
        expect(errors).toEqual([]);
        await expect(grid).not.toHaveAttribute('initializing');
        expect(await grid.evaluate((g: any) => g.userSettings.getColumn('Gender').isHidden)).toBe(true);
        await expect.poll(() => headerNames(grid)).toEqual(PEOPLE_COLUMNS.filter(c => c !== 'Gender'));
        expect(await grid.evaluate((g: any) => ({ notification: g.query.notification, type: g.query.notificationType }))).toEqual({ notification: 'pw: settings save failed', type: 'Error' });
    });

    test('a failed width save keeps the width and shows the error', { annotation: [{ type: 'case', description: 'grid.cw-resize-save-failure' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page, { width: 2500, height: 600 });
        const grid = await mountGrid(page);
        const before = await columnTracks(grid);

        await page.evaluate(() => {
            const w = window as any;
            w.__failedSaves = 0;
            w.service.application.saveUserSettings = async () => {
                w.__failedSaves++;
                throw new Error('pw: settings save failed');
            };
        });

        await startResize(page, grid, 100);
        await page.mouse.up();
        await expect.poll(() => page.evaluate(() => (window as any).__failedSaves)).toBe(1);
        await nextFrames(page, 2);

        expect(errors).toEqual([]);
        expect((await columnTracks(grid))[0]).toBeGreaterThan(before[0]);
        expect(await grid.evaluate((g: any) => ({ notification: g.query.notification, type: g.query.notificationType }))).toEqual({ notification: 'pw: settings save failed', type: 'Error' });
    });

    test('showing a hidden column re-initializes and re-measures', { annotation: [{ type: 'case', description: 'grid.lc-reinit-on-unhide' }] }, async ({ page }) => {
        await gridPage(page, { width: 2500, height: 600 });
        const grid = await mountGrid(page, { userSettings: { Email: { isHidden: true } } });
        expect(await headerNames(grid)).toEqual(PEOPLE_COLUMNS.filter(c => c !== 'Email'));
        await watchInitializing(grid);

        const dialog = await openConfigure(grid);
        await pressRowButton(dialog, 'Email', 'Eye');
        await expect(dialogRow(dialog, 'Email')).not.toHaveAttribute('is-hidden');
        await dialogButton(dialog, 'Save').click();
        await expect(configureDialog(page)).toHaveCount(0);

        await expect.poll(() => initializingAdds(page)).toBeGreaterThan(0);
        await waitForGridReady(grid);
        await settle(grid);

        expect(await headerNames(grid)).toEqual(PEOPLE_COLUMNS);
        const tokens = await columnTokens(grid);
        expect(tokens).toHaveLength(10);
        tokens.slice(0, 9).forEach(t => expect(t).toMatch(/^\d+px$/));
        expect(tokens[9]).toBe('minmax(0, 1fr)');

        const email = (await headerBoxes(grid)).find(h => h.name === 'Email')!;
        expect(Math.abs(email.width - parseFloat(tokens[PEOPLE_COLUMNS.indexOf('Email')]))).toBeLessThanOrEqual(1);
        expect(email.labelScrollWidth).toBeLessThanOrEqual(email.labelClientWidth);
    });
});
