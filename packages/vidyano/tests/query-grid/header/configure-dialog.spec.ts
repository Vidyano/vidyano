import { expect } from '@playwright/test';
import { columnTracks, headerNames, nextFrames, openView, savedSettings, test, VIEWS, waitForGridReady } from '../_helpers/query-grid';
import { configureDialog, dialogButton, dialogLabels, dialogLists, dialogRow, dragRowAbove, focusedRowButton, headerGrid, headerWidths, openConfigure, openMenu, pressRowButton, queryId, resizeColumn, storedGridSettings, waitForDialogClosed } from '../_helpers/header';

const LABELS = ['First name', 'Last name', 'Birth date', 'Gender', 'Contact preference', 'Email', 'Phone number', 'Emergency contact', 'Is active'];
const DEFAULT_ORDER = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];

test.describe('Open and rendering', () => {
    test('opens as a modal dialog inside vi-app and round-trips in the dev app', { annotation: [{ type: 'case', description: 'header.dlg-open-modal' }] }, async ({ page }) => {
        const grid = await openView(page, VIEWS.QueryGrid_Filter);
        const before = await headerNames(grid);

        let dialog = await openConfigure(grid);
        const state = await page.evaluate(() => {
            const app = document.querySelector('vi-app')!;
            const d = app.shadowRoot!.querySelector('vi-query-grid-configure-dialog');
            const native = d?.shadowRoot!.querySelector('dialog') as HTMLDialogElement;
            return { inApp: !!d, open: native?.open, modal: native?.matches(':modal'), backdrop: native ? getComputedStyle(native, '::backdrop').display : null };
        });
        expect(state).toEqual({ inApp: true, open: true, modal: true, backdrop: 'block' });

        // Cancel leaves the grid unchanged
        await dialogButton(dialog, 'Cancel').click();
        await waitForDialogClosed(grid);
        expect(await headerNames(grid)).toEqual(before);
        expect(await savedSettings(page)).toHaveLength(0);

        // Save after a keyboard pin puts Email first
        dialog = await openConfigure(grid);
        await pressRowButton(dialog, 'Email', 'Pin');
        await expect(dialogRow(dialog, 'Email')).toHaveAttribute('is-pinned', '');
        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);
        await expect.poll(() => headerNames(grid).then(n => n[0])).toBe('Email');
        expect(await savedSettings(page)).toHaveLength(1);
    });

    for (const [query, label] of [['People', 'People'], ['QueryGrid_Filter', 'People (Filter)']]) {
        test(`shows the query label in the header (${query})`, { annotation: [{ type: 'case', description: 'header.dlg-header-label' }] }, async ({ page }) => {
            const grid = await headerGrid(page, { query });

            const dialog = await openConfigure(grid);
            await expect(dialog.locator('header')).toHaveText(label);
        });
    }

    test('lists all columns ordered by offset', { annotation: [{ type: 'case', description: 'header.dlg-lists-columns' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        const dialog = await openConfigure(grid);
        const lists = await dialogLists(dialog);
        expect(lists.unpinned.rows.map(r => r.label)).toEqual(LABELS);
        expect(lists.unpinned.visible).toBe(true);
        expect(lists.pinned.rows).toHaveLength(0);
        expect(lists.pinned.visible).toBe(false);
        await expect(dialog.locator('vi-sortable[group="pinned"]')).toBeHidden();
    });

    test('places pinned columns in the pinned list and marks hidden ones', { annotation: [{ type: 'case', description: 'header.dlg-lists-reflect-settings' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { userSettings: { Email: { isPinned: true }, PhoneNumber: { isPinned: true }, Gender: { isHidden: true } } });

        const dialog = await openConfigure(grid);
        await expect(dialog.locator('vi-sortable[group="pinned"]')).toBeVisible();

        const lists = await dialogLists(dialog);
        expect(lists.pinned.rows).toEqual([
            { label: 'Email', pinned: true, hidden: false },
            { label: 'Phone number', pinned: true, hidden: false }
        ]);
        expect(lists.unpinned.rows).toHaveLength(7);
        expect(lists.unpinned.rows.map(r => r.label)).toEqual(['First name', 'Last name', 'Birth date', 'Gender', 'Contact preference', 'Emergency contact', 'Is active']);
        for (const row of lists.unpinned.rows)
            expect(row).toEqual({ label: row.label, pinned: false, hidden: row.label === 'Gender' });
    });

    test('shows Reset, Save and Cancel buttons', { annotation: [{ type: 'case', description: 'header.dlg-footer-buttons' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const dialog = await openConfigure(grid);

        const buttons = dialog.locator('footer vi-button');
        await expect(buttons).toHaveText(['Reset', 'Save', 'Cancel']);
        for (const label of ['Reset', 'Save', 'Cancel'] as const)
            await expect(dialogButton(dialog, label)).toBeVisible();

        const footer = (await dialog.locator('footer').boundingBox())!;
        const [reset, save, cancel] = await Promise.all((['Reset', 'Save', 'Cancel'] as const).map(async l => (await dialogButton(dialog, l).boundingBox())!));
        // Reset on the left, Save and Cancel together on the right
        expect(reset.x - footer.x).toBeLessThan(save.x - (reset.x + reset.width));
        expect(save.x + save.width).toBeLessThanOrEqual(cancel.x);
        expect(footer.x + footer.width - (cancel.x + cancel.width)).toBeLessThan(save.x - (reset.x + reset.width));
        expect(cancel.x - (save.x + save.width)).toBeLessThan(save.x - (reset.x + reset.width));
    });

    test('scrolls the unpinned list when the viewport is short', { annotation: [{ type: 'case', description: 'header.dlg-scroll-constrained' }] }, async ({ page }) => {
        const grid = await headerGrid(page, {}, { width: 1600, height: 400 });
        const dialog = await openConfigure(grid);

        const scroller = dialog.locator('main > vi-scroller');
        const view = async () => (await scroller.boundingBox())!;
        const isActive = dialogRow(dialog, 'Is active');
        const inView = async () => {
            const v = await view();
            const r = (await isActive.boundingBox())!;
            return r.y >= v.y - 1 && r.y + r.height <= v.y + v.height + 1;
        };

        expect(await scroller.evaluate((s: any) => s.scroller.scrollHeight > s.scroller.clientHeight)).toBe(true);
        expect(await inView()).toBe(false);

        const v = await view();
        await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2);
        await page.mouse.wheel(0, 400);
        await expect.poll(inView).toBe(true);

        const footer = (await dialog.locator('footer').boundingBox())!;
        expect(footer.y + footer.height).toBeLessThanOrEqual(400);
        for (const label of ['Reset', 'Save', 'Cancel'] as const)
            await expect(dialogButton(dialog, label)).toBeInViewport();
    });
});

test.describe('Pin and visibility toggles', () => {
    test('moves a row to the pinned list when its pin is toggled by keyboard', { annotation: [{ type: 'case', description: 'header.dlg-pin-moves-list-keyboard' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const dialog = await openConfigure(grid);

        await pressRowButton(dialog, 'Last name', 'Pin');
        await expect(dialogRow(dialog, 'Last name')).toHaveAttribute('is-pinned', '');
        await expect(dialog.locator('vi-sortable[group="pinned"]')).toBeVisible();
        await expect.poll(() => dialogLabels(dialog, 'pinned')).toEqual(['Last name']);
        expect(await dialogLabels(dialog, 'unpinned')).toEqual(LABELS.filter(l => l !== 'Last name'));

        await pressRowButton(dialog, 'Last name', 'Pin');
        await expect(dialogRow(dialog, 'Last name')).not.toHaveAttribute('is-pinned');
        await expect.poll(() => dialogLabels(dialog, 'unpinned')).toEqual(LABELS);
        await expect(dialog.locator('vi-sortable[group="pinned"]')).toBeHidden();
    });

    test('keeps focus on the Pin button of a row that moves to the other list', { annotation: [{ type: 'case', description: 'header.dlg-pin-keeps-focus' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const dialog = await openConfigure(grid);

        await pressRowButton(dialog, 'Last name', 'Pin');
        await expect.poll(() => dialogLabels(dialog, 'pinned')).toEqual(['Last name']);
        await nextFrames(page, 3);
        expect(await focusedRowButton(dialog)).toEqual({ label: 'Last name', icon: 'Pin' });

        await page.keyboard.press('Enter');
        await expect.poll(() => dialogLabels(dialog, 'unpinned')).toEqual(LABELS);
        await nextFrames(page, 3);
        expect(await focusedRowButton(dialog)).toEqual({ label: 'Last name', icon: 'Pin' });
    });

    test('keeps focus on another row when a pin toggle updates the lists', { annotation: [{ type: 'case', description: 'header.dlg-pin-keeps-other-focus' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const dialog = await openConfigure(grid);

        // Focus moves before the lists are updated on the next frame
        await dialog.evaluate((d: any) => {
            const rows = [...d.shadowRoot.querySelectorAll('vi-query-grid-configure-dialog-column')] as any[];
            const row = (label: string) => rows.find(r => r.shadowRoot.querySelector('label').textContent.trim() === label);
            row('Last name').shadowRoot.querySelector('vi-button[icon="Pin"]').click();
            row('Gender').shadowRoot.querySelector('vi-button[icon="Eye"]').focus();
        });
        await expect.poll(() => dialogLabels(dialog, 'pinned')).toEqual(['Last name']);
        await nextFrames(page, 3);
        expect(await focusedRowButton(dialog)).toEqual({ label: 'Gender', icon: 'Eye' });

        await page.keyboard.press('Enter');
        await expect(dialogRow(dialog, 'Gender')).toHaveAttribute('is-hidden', '');
    });
});

test.describe('Reorder', () => {
    test('reorders rows by dragging within the unpinned list', { annotation: [{ type: 'case', description: 'header.dlg-drag-reorder' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const id = await queryId(page);
        const dialog = await openConfigure(grid);

        await dragRowAbove(dialog, 'Email', 'First name');
        await expect.poll(() => dialogLabels(dialog, 'unpinned')).toEqual(['Email', ...LABELS.filter(l => l !== 'Email')]);

        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);
        await expect.poll(() => headerNames(grid)).toEqual(['Email', ...DEFAULT_ORDER.filter(n => n !== 'Email')]);

        const saves = await savedSettings(page);
        expect(saves).toHaveLength(1);
        expect(saves[0].QueryGridSettings[id]).toEqual({
            Email: { offset: 10 },
            FirstName: { offset: 20 },
            LastName: { offset: 35 },
            BirthDate: { offset: 38 },
            Gender: { offset: 42 },
            ContactPreference: { offset: 50 }
        });
    });

    test('pinning from the menu and a dialog reorder keep each column\'s width', { annotation: [{ type: 'case', description: 'header.hdr-widths-preserved-after-hide-pin' }] }, async ({ page }) => {
        const grid = await headerGrid(page, {}, { width: 2500, height: 600 });
        const widths = await headerWidths(grid);
        const truncated = async () => grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].filter((h: any) => {
            const label = h.shadowRoot.querySelector('label') as HTMLElement;
            return label && label.scrollWidth > label.clientWidth;
        }).map((h: any) => h.getAttribute('name')));
        const truncatedBefore = await truncated();
        const expectOwnWidths = async (order: string[], label: string) => {
            await expect.poll(() => headerNames(grid), label).toEqual(order);
            await waitForGridReady(grid);
            const after = await headerWidths(grid);
            for (const name of order)
                expect(Math.abs(after[name] - widths[name]), `${label}: ${name}`).toBeLessThanOrEqual(1);

            expect((await truncated()).filter(n => !truncatedBefore.includes(n)), label).toEqual([]);
        };

        const h = await openMenu(grid, 'PhoneNumber');
        await h.locator('vi-popup-menu-item[icon="Pin"]').click();
        const pinned = ['PhoneNumber', ...DEFAULT_ORDER.filter(n => n !== 'PhoneNumber')];
        await expectOwnWidths(pinned, 'pinned');

        const dialog = await openConfigure(grid);
        await dragRowAbove(dialog, 'Email', 'First name');
        await expect.poll(() => dialogLabels(dialog, 'unpinned')).toEqual(['Email', ...LABELS.filter(l => l !== 'Email' && l !== 'Phone number')]);
        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);
        await expectOwnWidths(['PhoneNumber', 'Email', ...DEFAULT_ORDER.filter(n => n !== 'PhoneNumber' && n !== 'Email')], 'reordered');
        expect(await savedSettings(page)).toHaveLength(2);
    });

    test('reorders rows within the pinned list', { annotation: [{ type: 'case', description: 'header.dlg-drag-pinned-list' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { userSettings: { Email: { isPinned: true }, PhoneNumber: { isPinned: true } } });
        expect((await headerNames(grid)).slice(0, 2)).toEqual(['Email', 'PhoneNumber']);
        const dialog = await openConfigure(grid);

        await dragRowAbove(dialog, 'Phone number', 'Email');
        await expect.poll(() => dialogLabels(dialog, 'pinned')).toEqual(['Phone number', 'Email']);

        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);
        await expect.poll(() => headerNames(grid)).toEqual(['PhoneNumber', 'Email', ...DEFAULT_ORDER.filter(n => n !== 'PhoneNumber' && n !== 'Email')]);
        expect(await savedSettings(page)).toHaveLength(1);
    });

    test('cannot drag a row between the pinned and unpinned lists', { annotation: [{ type: 'case', description: 'header.dlg-drag-cross-list-blocked' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { userSettings: { Email: { isPinned: true } } });
        const dialog = await openConfigure(grid);
        const before = await dialogLists(dialog);

        await dragRowAbove(dialog, 'Last name', 'Email');
        await nextFrames(page, 2);

        const after = await dialogLists(dialog);
        expect(after.pinned.rows.map(r => r.label)).toEqual(['Email']);
        expect(after.unpinned.rows.map(r => r.label).sort()).toEqual(before.unpinned.rows.map(r => r.label).sort());
        await expect(dialogRow(dialog, 'Last name')).not.toHaveAttribute('is-pinned');

        // Dragging a pinned row into the unpinned list is blocked as well
        await dragRowAbove(dialog, 'Email', 'Birth date');
        await nextFrames(page, 2);
        expect(await dialogLabels(dialog, 'pinned')).toEqual(['Email']);
        await expect(dialogRow(dialog, 'Email')).toHaveAttribute('is-pinned', '');
    });

    test('changes nothing when a row is dropped where it started', { annotation: [{ type: 'case', description: 'header.dlg-drag-same-index' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const id = await queryId(page);
        const dialog = await openConfigure(grid);

        const box = (await dialogRow(dialog, 'Gender').boundingBox())!;
        const x = box.x + 60;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y + box.height * 1.5, { steps: 10 });
        await page.mouse.move(x, y, { steps: 10 });
        await page.mouse.up();
        await expect.poll(() => dialogLabels(dialog, 'unpinned')).toEqual(LABELS);

        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        expect((await savedSettings(page))[0].QueryGridSettings[id]).toBeUndefined();
        expect(await headerNames(grid)).toEqual(DEFAULT_ORDER);
    });
});

test.describe('Save', () => {
    test('applies the changes to the grid on Save', { annotation: [{ type: 'case', description: 'header.dlg-save-applies' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const id = await queryId(page);
        const dialog = await openConfigure(grid);

        await pressRowButton(dialog, 'Last name', 'Pin');
        await expect(dialogRow(dialog, 'Last name')).toHaveAttribute('is-pinned', '');
        await pressRowButton(dialog, 'Gender', 'Eye');
        await expect(dialogRow(dialog, 'Gender')).toHaveAttribute('is-hidden', '');

        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);

        await expect.poll(() => headerNames(grid)).toEqual(['LastName', 'FirstName', 'BirthDate', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive']);
        expect((await savedSettings(page))[0].QueryGridSettings[id]).toEqual({ LastName: { isPinned: true }, Gender: { isHidden: true } });
    });

    test('still saves when nothing changed', { annotation: [{ type: 'case', description: 'header.dlg-save-unchanged' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const id = await queryId(page);
        const names = await headerNames(grid);
        const widths = await headerWidths(grid);

        const dialog = await openConfigure(grid);
        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);

        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        expect(id in (await savedSettings(page))[0].QueryGridSettings).toBe(false);
        expect(await headerNames(grid)).toEqual(names);
        expect(await headerWidths(grid)).toEqual(widths);
    });

    test('disables the Eye button of the only visible row', { annotation: [{ type: 'case', description: 'header.dlg-hide-all' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const id = await queryId(page);
        const dialog = await openConfigure(grid);
        const eye = (label: string) => dialogRow(dialog, label).locator('vi-button[icon="Eye"]');

        for (const label of LABELS.slice(0, -1)) {
            await expect(eye(label)).not.toHaveAttribute('disabled');
            await pressRowButton(dialog, label, 'Eye');
            await expect(dialogRow(dialog, label)).toHaveAttribute('is-hidden', '');
        }

        // Is active is the last visible row: its Eye button no longer toggles it
        await expect(eye('Is active')).toHaveAttribute('disabled', '');
        await pressRowButton(dialog, 'Is active', 'Eye');
        await eye('Is active').click({ force: true });
        await expect(dialogRow(dialog, 'Is active')).not.toHaveAttribute('is-hidden');

        // Showing another row enables it again
        await pressRowButton(dialog, 'Email', 'Eye');
        await expect(dialogRow(dialog, 'Email')).not.toHaveAttribute('is-hidden');
        await expect(eye('Is active')).not.toHaveAttribute('disabled');
        await expect(eye('Email')).not.toHaveAttribute('disabled');
        await pressRowButton(dialog, 'Email', 'Eye');
        await expect(eye('Is active')).toHaveAttribute('disabled', '');

        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await expect.poll(() => headerNames(grid)).toEqual(['IsActive']);
        expect((await savedSettings(page))[0].QueryGridSettings[id]).toEqual(Object.fromEntries(DEFAULT_ORDER.slice(0, -1).map(name => [name, { isHidden: true }])));
    });
});

test.describe('Cancel', () => {
    test('discards changes on Cancel', { annotation: [{ type: 'case', description: 'header.dlg-cancel-discards' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const settingsBefore = JSON.stringify(await storedGridSettings(page) ?? null);
        const namesBefore = await headerNames(grid);
        const widthsBefore = await headerWidths(grid);
        const tracksBefore = await columnTracks(grid);

        let dialog = await openConfigure(grid);
        await dragRowAbove(dialog, 'Email', 'First name');
        await expect.poll(() => dialogLabels(dialog, 'unpinned').then(l => l[0])).toBe('Email');
        await pressRowButton(dialog, 'Last name', 'Pin');
        await expect(dialogRow(dialog, 'Last name')).toHaveAttribute('is-pinned', '');
        await pressRowButton(dialog, 'Gender', 'Eye');
        await expect(dialogRow(dialog, 'Gender')).toHaveAttribute('is-hidden', '');

        await dialogButton(dialog, 'Cancel').click();
        await waitForDialogClosed(grid);

        expect(await savedSettings(page)).toHaveLength(0);
        expect(JSON.stringify(await storedGridSettings(page) ?? null)).toBe(settingsBefore);
        expect(await headerNames(grid)).toEqual(namesBefore);
        expect(await headerWidths(grid)).toEqual(widthsBefore);
        expect(await columnTracks(grid)).toEqual(tracksBefore);

        dialog = await openConfigure(grid);
        const lists = await dialogLists(dialog);
        expect(lists.pinned.rows).toHaveLength(0);
        expect(lists.unpinned.rows).toEqual(LABELS.map(label => ({ label, pinned: false, hidden: false })));
    });

    test('closes as cancel on Escape', { annotation: [{ type: 'case', description: 'header.dlg-escape-cancels' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const namesBefore = await headerNames(grid);

        const dialog = await openConfigure(grid);
        await pressRowButton(dialog, 'Gender', 'Eye');
        await expect(dialogRow(dialog, 'Gender')).toHaveAttribute('is-hidden', '');

        await page.keyboard.press('Escape');
        await expect(configureDialog(page)).toHaveCount(0);
        await waitForGridReady(grid);

        expect(await savedSettings(page)).toHaveLength(0);
        expect(await headerNames(grid)).toEqual(namesBefore);
    });

    test('stays open when the backdrop is clicked', { annotation: [{ type: 'case', description: 'header.dlg-backdrop-no-close' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const dialog = await openConfigure(grid);

        const box = (await dialog.locator('dialog').boundingBox())!;
        expect(box.x > 5 && box.y > 5).toBe(true);
        await page.mouse.click(5, 5);
        await nextFrames(page, 2);

        await expect(dialog.locator('dialog')).toBeVisible();
        expect(await dialog.locator('dialog').evaluate((d: HTMLDialogElement) => d.open)).toBe(true);
        expect(await savedSettings(page)).toHaveLength(0);
    });
});

test.describe('Reset', () => {
    const SEEDED = { IsActive: { offset: 20 }, LastName: { offset: 35 }, Email: { isPinned: true }, Gender: { isHidden: true } };

    test('restores the server defaults in the dialog on Reset', { annotation: [{ type: 'case', description: 'header.dlg-reset-defaults' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { userSettings: structuredClone(SEEDED) });
        const dialog = await openConfigure(grid);

        const seeded = await dialogLists(dialog);
        expect(seeded.pinned.rows.map(r => r.label)).toEqual(['Email']);
        expect(seeded.unpinned.rows.find(r => r.label === 'Gender')!.hidden).toBe(true);

        await dialogButton(dialog, 'Reset').click();
        await expect.poll(() => dialogLabels(dialog, 'unpinned')).toEqual(LABELS);

        const lists = await dialogLists(dialog);
        expect(lists.pinned.rows).toHaveLength(0);
        expect(lists.pinned.visible).toBe(false);
        expect(lists.unpinned.rows).toEqual(LABELS.map(label => ({ label, pinned: false, hidden: false })));
        expect(await savedSettings(page)).toHaveLength(0);
    });

    test('returns the grid to defaults on Reset then Save', { annotation: [{ type: 'case', description: 'header.dlg-reset-save' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { userSettings: { ...structuredClone(SEEDED), FirstName: { width: '200px' } } });
        const id = await queryId(page);
        expect(await headerNames(grid)).not.toEqual(DEFAULT_ORDER);

        const dialog = await openConfigure(grid);
        await dialogButton(dialog, 'Reset').click();
        await expect.poll(() => dialogLabels(dialog, 'unpinned')).toEqual(LABELS);
        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);

        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        expect(id in (await savedSettings(page))[0].QueryGridSettings).toBe(false);
        await expect.poll(() => headerNames(grid)).toEqual(DEFAULT_ORDER);

        // A new grid on the same query no longer gets the stored 200px width: the columns are content-sized
        await page.evaluate(() => {
            const w = window as any;
            const q = w.grid.query;
            w.grid.remove();
            const grid = document.createElement('vi-query-grid') as any;
            grid.query = q;
            document.getElementById('test-container')!.appendChild(grid);
            w.grid = grid;
        });
        await waitForGridReady(grid);
        expect(await headerNames(grid)).toEqual(DEFAULT_ORDER);
        expect(await columnTracks(grid)).not.toContain(200);
        expect((await headerWidths(grid)).FirstName).toBeLessThan(200);
    });

    test('Reset then Cancel keeps stored widths', { annotation: [{ type: 'case', description: 'header.dlg-reset-cancel-keeps-widths' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const id = await queryId(page);
        const widths = await headerWidths(grid);

        await resizeColumn(grid, 'LastName', 60);
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await waitForGridReady(grid);
        const lastName = (await savedSettings(page))[0].QueryGridSettings[id].LastName.width;
        expect(Math.abs(parseFloat(lastName) - (widths.LastName + 60))).toBeLessThanOrEqual(1);

        const dialog = await openConfigure(grid);
        await dialogButton(dialog, 'Reset').click();
        await dialogButton(dialog, 'Cancel').click();
        await waitForDialogClosed(grid);
        expect(await savedSettings(page)).toHaveLength(1);

        await resizeColumn(grid, 'Email', 30);
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(2);

        const stored = (await savedSettings(page))[1].QueryGridSettings[id];
        expect(Math.abs(parseFloat(stored.Email.width) - (widths.Email + 30))).toBeLessThanOrEqual(1);
        expect(stored.LastName).toEqual({ width: lastName });
        expect(Math.abs((await headerWidths(grid)).LastName - parseFloat(lastName))).toBeLessThanOrEqual(1);
    });
});

test.describe('Lifecycle', () => {
    test('leaves the grid unchanged until Save', { annotation: [{ type: 'case', description: 'header.dlg-grid-untouched-while-open' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const names = await headerNames(grid);
        const tracks = await columnTracks(grid);

        const dialog = await openConfigure(grid);
        await dragRowAbove(dialog, 'Email', 'First name');
        await expect.poll(() => dialogLabels(dialog, 'unpinned').then(l => l[0])).toBe('Email');
        await pressRowButton(dialog, 'Last name', 'Pin');
        await expect(dialogRow(dialog, 'Last name')).toHaveAttribute('is-pinned', '');
        await pressRowButton(dialog, 'Gender', 'Eye');
        await expect(dialogRow(dialog, 'Gender')).toHaveAttribute('is-hidden', '');
        await nextFrames(page, 2);

        expect(await headerNames(grid)).toEqual(names);
        expect(await grid.locator('vi-query-grid-column-header').count()).toBe(names.length);
        expect(await columnTracks(grid)).toEqual(tracks);
        expect(await savedSettings(page)).toHaveLength(0);
    });

    test('reflects the last saved state when reopened', { annotation: [{ type: 'case', description: 'header.dlg-reopen-after-save' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        let dialog = await openConfigure(grid);

        await dragRowAbove(dialog, 'Is active', 'Last name');
        const expected = ['First name', 'Is active', ...LABELS.filter(l => l !== 'First name' && l !== 'Is active')];
        await expect.poll(() => dialogLabels(dialog, 'unpinned')).toEqual(expected);
        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);
        await expect.poll(() => headerNames(grid)).toEqual(['FirstName', 'IsActive', ...DEFAULT_ORDER.filter(n => n !== 'FirstName' && n !== 'IsActive')]);

        dialog = await openConfigure(grid);
        await expect.poll(() => dialogLabels(dialog, 'unpinned')).toEqual(expected);
        expect((await dialogLists(dialog)).pinned.rows).toHaveLength(0);
    });

    test('moves the dialog when its header is dragged', { annotation: [{ type: 'case', description: 'header.dlg-drag-header-moves' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const dialog = await openConfigure(grid);
        const native = dialog.locator('dialog');

        const before = (await native.boundingBox())!;
        const headerBox = (await dialog.locator('header').boundingBox())!;
        const x = headerBox.x + headerBox.width / 2;
        const y = headerBox.y + headerBox.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 100, y + 50, { steps: 10 });
        await page.mouse.up();

        await expect.poll(async () => {
            const after = (await native.boundingBox())!;
            return Math.abs(after.x - before.x - 100) <= 10 && Math.abs(after.y - before.y - 50) <= 10;
        }).toBe(true);

        // The dialog stays inside the viewport
        const after = (await native.boundingBox())!;
        const viewport = page.viewportSize()!;
        expect(after.x).toBeGreaterThanOrEqual(0);
        expect(after.y).toBeGreaterThanOrEqual(0);
        expect(after.x + after.width).toBeLessThanOrEqual(viewport.width);
        expect(after.y + after.height).toBeLessThanOrEqual(viewport.height);
        await expect(native).toBeVisible();
    });
});

test.describe('vi-query-grid-configure-dialog-column', () => {
    test('renders a handle icon, the label and the pin/eye buttons', { annotation: [{ type: 'case', description: 'header.col-render' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const dialog = await openConfigure(grid);

        const row = dialogRow(dialog, 'Contact preference');
        await expect(row.locator('vi-icon[source="Hamburger"]')).toHaveCount(1);
        await expect(row.locator('label')).toHaveText('Contact preference');
        await expect(row.locator('vi-button[icon="Pin"]')).toBeVisible();
        await expect(row.locator('vi-button[icon="Eye"]')).toBeVisible();

        const box = (await row.boundingBox())!;
        expect(Math.round(box.height)).toBe(32);
        const minWidth = await row.evaluate(r => parseFloat(getComputedStyle(r).fontSize) * 20);
        expect(box.width).toBeGreaterThanOrEqual(minWidth - 0.5);
    });

    test('toggles visibility on Enter without moving the row', { annotation: [{ type: 'case', description: 'header.col-toggle-eye-keyboard' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const dialog = await openConfigure(grid);
        const row = dialogRow(dialog, 'Contact preference');
        const index = LABELS.indexOf('Contact preference');

        await pressRowButton(dialog, 'Contact preference', 'Eye');
        await expect(row).toHaveAttribute('is-hidden', '');
        expect((await dialogLabels(dialog, 'unpinned')).indexOf('Contact preference')).toBe(index);

        await pressRowButton(dialog, 'Contact preference', 'Eye');
        await expect(row).not.toHaveAttribute('is-hidden');
        expect((await dialogLabels(dialog, 'unpinned')).indexOf('Contact preference')).toBe(index);
    });

    test('dims the pin button when unpinned and the eye button when hidden', { annotation: [{ type: 'case', description: 'header.col-pin-opacity' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const dialog = await openConfigure(grid);
        const row = dialogRow(dialog, 'Contact preference');
        const pin = row.locator('vi-button[icon="Pin"]');
        const eye = row.locator('vi-button[icon="Eye"]');

        await expect(pin).toHaveCSS('opacity', '0.5');
        await expect(eye).toHaveCSS('opacity', '1');

        await pressRowButton(dialog, 'Contact preference', 'Pin');
        await expect(row).toHaveAttribute('is-pinned', '');
        await expect(pin).toHaveCSS('opacity', '1');
        await expect(eye).toHaveCSS('opacity', '1');

        await pressRowButton(dialog, 'Contact preference', 'Eye');
        await expect(row).toHaveAttribute('is-hidden', '');
        await expect(eye).toHaveCSS('opacity', '0.5');
        await expect(pin).toHaveCSS('opacity', '1');
    });

    test('restores the original state after two toggles', { annotation: [{ type: 'case', description: 'header.col-toggle-twice' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const id = await queryId(page);
        const dialog = await openConfigure(grid);
        const row = dialogRow(dialog, 'Birth date');
        const index = LABELS.indexOf('Birth date');

        await pressRowButton(dialog, 'Birth date', 'Pin');
        await expect(row).toHaveAttribute('is-pinned', '');
        await expect.poll(() => dialogLabels(dialog, 'pinned')).toEqual(['Birth date']);
        await pressRowButton(dialog, 'Birth date', 'Pin');
        await expect(row).not.toHaveAttribute('is-pinned');
        await pressRowButton(dialog, 'Birth date', 'Eye');
        await expect(row).toHaveAttribute('is-hidden', '');
        await pressRowButton(dialog, 'Birth date', 'Eye');
        await expect(row).not.toHaveAttribute('is-hidden');

        await expect.poll(() => dialogLabels(dialog, 'unpinned').then(l => l.indexOf('Birth date'))).toBe(index);
        expect(await dialogLabels(dialog, 'unpinned')).toEqual(LABELS);
        await expect(dialog.locator('vi-sortable[group="pinned"]')).toBeHidden();

        await dialogButton(dialog, 'Save').click();
        await waitForDialogClosed(grid);
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        expect((await savedSettings(page))[0].QueryGridSettings[id]?.BirthDate).toBeUndefined();
        expect(await headerNames(grid)).toEqual(DEFAULT_ORDER);
    });

    test('shows a grab cursor on the row', { annotation: [{ type: 'case', description: 'header.col-grab-cursor' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const dialog = await openConfigure(grid);
        const row = dialogRow(dialog, 'Contact preference');

        await expect(row).toHaveCSS('cursor', 'grab');
        await expect(row.locator('label')).toHaveCSS('pointer-events', 'none');
        await expect(row.locator('vi-icon[source="Hamburger"]')).toHaveCSS('pointer-events', 'none');
    });

    test('truncates a long label with an ellipsis', { annotation: [{ type: 'case', description: 'header.col-label-ellipsis' }] }, async ({ page }) => {
        // A narrow viewport caps the dialog width, so the long QueryGrid_ColumnOptions label cannot fit
        const grid = await headerGrid(page, { query: 'QueryGrid_ColumnOptions' }, { width: 480, height: 720 });
        const dialog = await openConfigure(grid);
        const row = dialogRow(dialog, 'First name of the person as registered in the population register');

        const state = await row.evaluate((r: any) => {
            const label = r.shadowRoot.querySelector('label') as HTMLElement;
            const style = getComputedStyle(label);
            const box = r.getBoundingClientRect();
            const inside = [...r.shadowRoot.querySelectorAll('vi-button')].every((b: any) => {
                const bb = b.getBoundingClientRect();
                return bb.left >= box.left - 0.5 && bb.right <= box.right + 0.5 && bb.top >= box.top - 0.5 && bb.bottom <= box.bottom + 0.5;
            });
            return { overflows: label.scrollWidth > label.clientWidth, textOverflow: style.textOverflow, oneLine: label.scrollHeight <= label.clientHeight, inside, rowRight: box.right };
        });

        expect(state).toEqual({ overflows: true, textOverflow: 'ellipsis', oneLine: true, inside: true, rowRight: state.rowRight });
        expect(state.rowRight).toBeLessThanOrEqual(480);
    });

    // Covers both buttons in both lists
    test('a mouse click on Pin or Eye toggles the row', { annotation: [{ type: 'case', description: 'header.col-toggle-mouse' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const dialog = await openConfigure(grid);
        const row = dialogRow(dialog, 'Last name');

        await row.locator('vi-button[icon="Eye"]').click();
        await expect(row).toHaveAttribute('is-hidden', '');
        expect(await dialogLabels(dialog, 'unpinned')).toEqual(LABELS);

        await row.locator('vi-button[icon="Pin"]').click();
        await expect(row).toHaveAttribute('is-pinned', '');
        await expect.poll(() => dialogLabels(dialog, 'pinned')).toEqual(['Last name']);
        expect(await dialogLabels(dialog, 'unpinned')).toEqual(LABELS.filter(l => l !== 'Last name'));
        await expect(row).toHaveAttribute('is-hidden', '');

        await row.locator('vi-button[icon="Eye"]').click();
        await expect(row).not.toHaveAttribute('is-hidden');
        expect(await dialogLabels(dialog, 'pinned')).toEqual(['Last name']);

        await row.locator('vi-button[icon="Pin"]').click();
        await expect(row).not.toHaveAttribute('is-pinned');
        await expect.poll(() => dialogLabels(dialog, 'unpinned')).toEqual(LABELS);
        await expect(dialog.locator('vi-sortable[group="pinned"]')).toBeHidden();
    });
});
