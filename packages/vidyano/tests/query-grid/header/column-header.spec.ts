import { expect } from '@playwright/test';
import { gridPage, headerNames, mountGrid, nextFrames, pageErrors, requestLog, savedSettings, test, visibleRows, waitForGridReady, waitForQueryIdle } from '../_helpers/query-grid';
import { closeMenu, configureDialog, deepFocusPath, header, headerGrid, headerWidths, menuItem, openMenu, openMenuByCaret, openMenus, queryId, resizeColumn, sortIcon, sortOptions } from '../_helpers/header';

const PEOPLE_COLUMNS = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];
const PEOPLE_LABELS = ['First name', 'Last name', 'Birth date', 'Gender', 'Contact preference', 'Email', 'Phone number', 'Emergency contact', 'Is active'];

test.describe('Rendering', () => {
    test('renders one header per visible column with its name and label', { annotation: [{ type: 'case', description: 'header.hdr-render-one-per-visible-column' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        const headers = grid.locator('vi-query-grid-column-header');
        await expect(headers).toHaveCount(9);
        expect(await headers.evaluateAll(hs => hs.map(h => h.getAttribute('name')))).toEqual(PEOPLE_COLUMNS);
        await expect(headers.locator('.label label')).toHaveText(PEOPLE_LABELS);
    });

    test('reflects can-sort and a pointer cursor only on sortable columns', { annotation: [{ type: 'case', description: 'header.hdr-can-sort-attr' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { query: 'QueryGrid_ColumnOptions' });

        const sortable = (await headerNames(grid)).filter(n => n !== 'PhoneNumber');
        expect(sortable).toEqual(expect.arrayContaining(['FirstName', 'LastName', 'Email', 'IsActive']));
        for (const name of sortable) {
            await expect(header(grid, name)).toHaveAttribute('can-sort', '');
            await expect(header(grid, name).locator('.label label')).toHaveCSS('cursor', 'pointer');
        }

        // PhoneNumber has CanSort=false on QueryGrid_ColumnOptions
        await expect(header(grid, 'PhoneNumber')).not.toHaveAttribute('can-sort');
        expect(await header(grid, 'PhoneNumber').locator('.label label').evaluate(l => getComputedStyle(l).cursor)).not.toBe('pointer');
    });

    test('sanitizes dots, spaces and a leading digit in the name attribute', { annotation: [{ type: 'case', description: 'header.hdr-name-sanitized' }] }, async ({ page }) => {
        await gridPage(page);
        await page.evaluate(() => {
            // Rename two columns client-side when the query constructs them
            const hooks = (window as any).service.hooks;
            const construct = hooks.onConstructQueryColumn.bind(hooks);
            const names: Record<string, string> = { LastName: 'Address.Street Name', Email: '1stName' };
            hooks.onConstructQueryColumn = (service: any, col: any, query: any) => construct(service, col.name in names ? { ...col, name: names[col.name] } : col, query);
        });
        const grid = await mountGrid(page);

        const names = await headerNames(grid);
        expect(names).toContain('Address_Street_Name');
        expect(names).toContain('_1stName');
        expect(names).not.toContain('LastName');
        expect(names).not.toContain('Email');
    });

    test('truncates a too-narrow label with an ellipsis and shows the full label as its tooltip', { annotation: [{ type: 'case', description: 'header.hdr-label-ellipsis-tooltip' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        await resizeColumn(grid, 'LastName', -400);
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await expect.poll(() => header(grid, 'LastName').evaluate(h => Math.round(h.getBoundingClientRect().width))).toBe(50);

        const label = await header(grid, 'LastName').locator('.label label').evaluate(l => {
            const style = getComputedStyle(l);
            return { overflows: l.scrollWidth > l.clientWidth, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace, lines: Math.round(l.getBoundingClientRect().height / parseFloat(style.lineHeight)) };
        });
        expect(label).toEqual({ overflows: true, textOverflow: 'ellipsis', whiteSpace: 'nowrap', lines: 1 });
        await expect(header(grid, 'LastName').locator('.label label')).toHaveAttribute('title', 'Last name');
    });

    test('draws a right border and a white background', { annotation: [{ type: 'case', description: 'header.hdr-border-background' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        const style = await header(grid, 'LastName').evaluate(h => {
            const s = getComputedStyle(h);
            return { width: s.borderRightWidth, style: s.borderRightStyle, color: s.borderRightColor, background: s.backgroundColor, boxSizing: s.boxSizing };
        });
        // --theme-light-border is #ddd on the test page
        expect(style).toEqual({ width: '1px', style: 'solid', color: 'rgb(221, 221, 221)', background: 'rgb(255, 255, 255)', boxSizing: 'border-box' });
    });

    test('honors --vi-query-grid-header-height for the label row', { annotation: [{ type: 'case', description: 'header.hdr-header-height-var' }] }, async ({ page }) => {
        const grid = await headerGrid(page, {}, { styles: 'vi-query-grid { --vi-query-grid-header-height: 48px; }' });

        const h = header(grid, 'LastName');
        await expect(h.locator('.label label')).toHaveCSS('line-height', '48px');

        const heights = await h.evaluate((el: any) => ({
            header: el.getBoundingClientRect().height,
            filter: el.shadowRoot.querySelector('vi-query-grid-column-filter').getBoundingClientRect().height
        }));
        expect(heights.filter).toBeGreaterThan(0);
        expect(Math.abs(heights.header - (48 + heights.filter))).toBeLessThanOrEqual(1);
    });

    test('shows a resizer hover line and a caret separator', { annotation: [{ type: 'case', description: 'gap.hdr-chrome-resizer-caret' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const h = header(grid, 'LastName');
        const resizer = h.locator('.resizer');
        const line = () => resizer.evaluate(r => {
            const s = getComputedStyle(r, '::after');
            return s.content === 'none' ? null : { width: s.width, color: s.backgroundColor };
        });

        expect(await line()).toBeNull();

        const box = (await resizer.boundingBox())!;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await expect.poll(line).toEqual({ width: '2px', color: 'rgb(136, 136, 136)' });

        // While resizing the line stays, even when the pointer leaves the handle
        await page.mouse.down();
        await page.mouse.move(x + 40, y, { steps: 8 });
        await expect(h).toHaveClass(/\bresizing\b/);
        await expect.poll(line).toEqual({ width: '2px', color: 'rgb(136, 136, 136)' });
        await page.mouse.up();
        await expect(h).not.toHaveClass(/\bresizing\b/);

        const caret = await h.locator('vi-button[icon="CaretDown"]:visible').evaluate(b => {
            const s = getComputedStyle(b, '::after');
            return { width: s.width, color: s.backgroundColor };
        });
        expect(caret).toEqual({ width: '1px', color: 'rgb(221, 221, 221)' });
    });
});

test.describe('Sort icon', () => {
    test('shows the sort icon only on the sorted column', { annotation: [{ type: 'case', description: 'header.hdr-sort-icon-asc-initial' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        const icon = sortIcon(grid, 'FirstName');
        await expect(icon).toHaveAttribute('source', 'SortAsc');
        await expect(icon).toBeVisible();
        expect((await icon.boundingBox())!.width).toBeGreaterThan(0);

        // An unsorted header may not render its icon at all, so measure whatever is there
        for (const name of PEOPLE_COLUMNS.filter(n => n !== 'FirstName')) {
            await expect(sortIcon(grid, name)).toBeHidden();
            expect((await sortIcon(grid, name).evaluateAll(icons => icons.map(i => i.getBoundingClientRect().width))).every(w => w === 0)).toBe(true);
        }
    });

    test('updates the icon when sort options change outside the header', { annotation: [{ type: 'case', description: 'header.hdr-sort-icon-tracks-model' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        await page.evaluate(async () => {
            const q = (window as any).grid.query;
            q.sortOptions = [{ name: 'Email', direction: 'DESC' }];
            await q.search();
        });

        await expect(sortIcon(grid, 'Email')).toHaveAttribute('source', 'SortDesc');
        await expect(sortIcon(grid, 'Email')).toBeVisible();
        await expect(sortIcon(grid, 'FirstName')).toBeHidden();
    });

    test('a header reused for another column follows that column\'s sort, not the old one\'s', { annotation: [{ type: 'case', description: 'header.hdr-sort-icon-reused-header' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const reused = await header(grid, 'Gender').elementHandle();

        const gender = await openMenu(grid, 'Gender');
        await menuItem(gender, 'Hide column').click();
        await expect.poll(() => headerNames(grid)).not.toContain('Gender');
        await waitForGridReady(grid);
        const name = await reused!.getAttribute('name');
        expect(name).not.toBe('Gender');

        const sortBy = (sortOptions: { name: string; direction: string }[]) => page.evaluate(async sortOptions => {
            const q = (window as any).grid.query;
            q.sortOptions = sortOptions;
            await q.search();
        }, sortOptions);
        const source = () => reused!.evaluate((h: any) => h.shadowRoot.querySelector('div.label > vi-icon').getAttribute('source'));

        await sortBy([{ name: name!, direction: 'DESC' }]);
        await expect.poll(source).toBe('SortDesc');

        await sortBy([{ name: 'Gender', direction: 'ASC' }]);
        await expect.poll(source).toBeNull();
    });

    test('a re-attached grid shows a sort made while it was detached', { annotation: [{ type: 'case', description: 'header.hdr-sort-icon-reattached' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        await grid.evaluate(async (g: any) => {
            const parent = g.parentNode;
            g.remove();
            g.query.sortOptions = [{ name: 'Email', direction: 'DESC' }];
            await g.query.search();
            parent.appendChild(g);
        });

        await expect(sortIcon(grid, 'Email')).toHaveAttribute('source', 'SortDesc');
        await expect(sortIcon(grid, 'Email')).toBeVisible();
        await expect(sortIcon(grid, 'FirstName')).toBeHidden();
    });
});

test.describe('Column menu: items', () => {
    test('opens a menu with the expected items in order', { annotation: [{ type: 'case', description: 'header.hdr-menu-items-order' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const h = await openMenuByCaret(grid, 'LastName');

        const entries = await h.locator('vi-popup-menu > vi-popup-menu-item, vi-popup-menu > vi-popup-menu-item-separator').evaluateAll(els => els.map(e => e.tagName === 'VI-POPUP-MENU-ITEM-SEPARATOR' ? '---' : (e.shadowRoot!.querySelector('span.label')!.textContent ?? '').trim()));
        expect(entries).toEqual(['Sort ascending', 'Sort descending', '---', 'Group by Last name', 'Pin', 'Hide column', '---', 'Manage']);

        const icons: [string, string][] = [['Sort ascending', 'SortAsc'], ['Sort descending', 'SortDesc'], ['Pin', 'Pin'], ['Hide column', 'Eye'], ['Manage', 'Configure']];
        for (const [label, icon] of icons) {
            await expect(menuItem(h, label)).toBeVisible();
            await expect(menuItem(h, label).locator('vi-icon[source]').first()).toHaveAttribute('source', icon);
        }

        // Last name cannot be grouped
        await expect(menuItem(h, 'Group by Last name')).toBeHidden();
    });

    test('shows Group by only for groupable columns', { annotation: [{ type: 'case', description: 'header.hdr-menu-groupby-visibility' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        for (const [name, label] of PEOPLE_COLUMNS.map((n, i) => [n, PEOPLE_LABELS[i]])) {
            const h = await openMenu(grid, name);
            const groupBy = menuItem(h, `Group by ${label}`);
            if (name === 'BirthDate' || name === 'Gender')
                await expect(groupBy).toBeVisible();
            else
                await expect(groupBy).toBeHidden();

            await closeMenu(h);
        }
    });

    test('hides the sort items and their separator when the column cannot sort', { annotation: [{ type: 'case', description: 'header.hdr-menu-sort-hidden-when-cannot-sort' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { query: 'QueryGrid_ColumnOptions' });
        const h = await openMenu(grid, 'PhoneNumber');

        await expect(menuItem(h, 'Sort ascending')).toBeHidden();
        await expect(menuItem(h, 'Sort descending')).toBeHidden();
        await expect(h.locator('vi-popup-menu-item-separator').first()).toBeHidden();
        await expect(menuItem(h, 'Pin')).toBeVisible();
        await expect(menuItem(h, 'Hide column')).toBeVisible();
        await expect(menuItem(h, 'Manage')).toBeVisible();
    });

    test('labels the pin item Pin or Unpin and marks it checked when pinned', { annotation: [{ type: 'case', description: 'header.hdr-menu-pin-label-state' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        const h = await openMenu(grid, 'Email');
        const pin = h.locator('vi-popup-menu-item[icon="Pin"]');
        await expect(pin.locator('span.label')).toHaveText('Pin');
        await expect(pin).not.toHaveAttribute('checked');

        await pin.click();
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await waitForGridReady(grid);

        await page.keyboard.press('Escape');
        await openMenu(grid, 'Email');
        await expect(pin.locator('span.label')).toHaveText('Unpin');
        await expect(pin).toHaveAttribute('checked');
    });

    test('the open menu\'s pin item follows a pin change made on the column', { annotation: [{ type: 'case', description: 'header.hdr-menu-pin-tracks-model' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const h = await openMenu(grid, 'FirstName');
        const pin = h.locator('vi-popup-menu-item[icon="Pin"]');
        await expect(pin.locator('span.label')).toHaveText('Pin');

        // FirstName is already the first column, so pinning it keeps every header in place
        await h.evaluate((el: any) => el.column.isPinned = true);
        await expect(pin.locator('span.label')).toHaveText('Unpin');
        await expect(pin).toHaveAttribute('checked');
    });

    test('opens the configure dialog from Manage and closes the menu', { annotation: [{ type: 'case', description: 'header.hdr-menu-manage-opens-dialog' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { query: 'QueryGrid_Filter' });
        const h = await openMenu(grid, 'FirstName');

        await menuItem(h, 'Manage').click();

        const dialog = configureDialog(page);
        await expect(dialog.locator('dialog')).toBeVisible();
        expect(await dialog.locator('dialog').evaluate((d: HTMLDialogElement) => d.open)).toBe(true);
        await expect(dialog.locator('header')).toHaveText(await page.evaluate(() => (window as any).grid.query.label));
        for (const label of ['Sort ascending', 'Sort descending', 'Pin', 'Hide column', 'Manage'])
            await expect(menuItem(h, label)).toBeHidden();
    });
});

test.describe('Column menu: opening and closing', () => {
    test('opens the column menu on right-click and suppresses the native menu', { annotation: [{ type: 'case', description: 'header.hdr-contextmenu-opens-menu' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        await page.evaluate(() => {
            const w = window as any;
            w.__contextmenus = [];
            document.addEventListener('contextmenu', e => w.__contextmenus.push(e), true);
        });

        await header(grid, 'LastName').locator('div.label').click({ button: 'right' });
        await expect(menuItem(header(grid, 'LastName'), 'Manage')).toBeVisible();
        await closeMenu(header(grid, 'LastName'));

        const email = header(grid, 'Email');
        await email.locator('vi-query-grid-column-filter').click({ button: 'right' });
        await expect(menuItem(email, 'Manage')).toBeVisible();
        await expect(email.locator('vi-query-grid-column-filter vi-input-search')).toBeHidden();

        expect(await page.evaluate(() => (window as any).__contextmenus.map((e: Event) => e.defaultPrevented))).toEqual([true, true]);
    });

    test('a never-opened header menu opens on the first click or right-click', { annotation: [{ type: 'case', description: 'header.hdr-menu-first-open-single-gesture' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        const grid = await headerGrid(page);

        const email = header(grid, 'Email');
        await email.locator('vi-button[icon="CaretDown"]:visible').click();
        await expect(menuItem(email, 'Manage')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menuItem(email, 'Manage')).toBeHidden();

        const lastName = header(grid, 'LastName');
        await lastName.locator('div.label').click({ button: 'right' });
        await expect(menuItem(lastName, 'Manage')).toBeVisible();

        expect(errors).toEqual([]);
    });

    test('closes the menu when the caret is clicked again', { annotation: [{ type: 'case', description: 'header.hdr-menu-toggle-caret' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const h = await openMenuByCaret(grid, 'LastName');

        await h.locator('vi-button[icon="CaretDown"]:visible').click();
        await expect(menuItem(h, 'Manage')).toBeHidden();
        await expect(menuItem(h, 'Sort ascending')).toBeHidden();
    });

    test('closes the menu on Escape', { annotation: [{ type: 'case', description: 'header.hdr-menu-escape' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const h = await openMenu(grid, 'FirstName');

        await page.keyboard.press('Escape');
        await expect(menuItem(h, 'Manage')).toBeHidden();
        await expect(menuItem(h, 'Sort ascending')).toBeHidden();
        expect(await openMenus(grid)).toEqual([]);
    });

    test('closes the menu on a click outside without sorting', { annotation: [{ type: 'case', description: 'header.hdr-menu-outside-click' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const h = await openMenu(grid, 'FirstName');
        const log = requestLog(page);

        // A data cell well away from the menu: the twelfth visible row, in the Email column
        const rows = await visibleRows(grid);
        expect(rows.length).toBeGreaterThan(12);
        const column = (await header(grid, 'Email').boundingBox())!;
        const viewTop = await grid.evaluate((g: any) => ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as HTMLElement).getBoundingClientRect().top);
        const point = { x: column.x + column.width / 2, y: viewTop + rows[11].top + rows[11].height / 2 };
        const menu = (await menuItem(h, 'Manage').boundingBox())!;
        expect(point.y > menu.y + menu.height || point.x > menu.x + menu.width).toBe(true);
        await page.mouse.click(point.x, point.y);

        await expect(menuItem(h, 'Manage')).toBeHidden();
        await log.quiet(300);
        expect(log.of('ExecuteQuery')).toHaveLength(0);
        expect(await sortOptions(page)).toEqual(['FirstName ASC']);
    });

    test('closes one header\'s menu when another header\'s menu opens', { annotation: [{ type: 'case', description: 'header.hdr-menu-single-open' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const firstName = await openMenu(grid, 'FirstName');

        const lastName = await openMenu(grid, 'LastName');
        await expect(menuItem(lastName, 'Manage')).toBeVisible();
        await expect(menuItem(firstName, 'Manage')).toBeHidden();
        expect(await openMenus(grid)).toEqual(['LastName']);
    });

    test('closes the menu after a sort or group item', { annotation: [{ type: 'case', description: 'header.hdr-menu-closes-after-item' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        const firstName = await openMenu(grid, 'FirstName');
        await menuItem(firstName, 'Sort descending').click();
        await expect.poll(() => sortOptions(page)).toEqual(['FirstName DESC']);
        await expect(menuItem(firstName, 'Manage')).toBeHidden();
        await waitForGridReady(grid);

        const gender = await openMenu(grid, 'Gender');
        await menuItem(gender, 'Group by Gender').click();
        await expect.poll(() => page.evaluate(() => (window as any).grid.query.groupingInfo?.groupedBy)).toBe('Gender');
        await expect(menuItem(gender, 'Manage')).toBeHidden();
        await waitForGridReady(grid);
        expect(await openMenus(grid)).toEqual([]);
    });

    test('no column menu stays open after Pin or Hide', { annotation: [{ type: 'case', description: 'header.hdr-menu-closes-after-pin-hide' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        const email = await openMenu(grid, 'Email');
        await menuItem(email, 'Pin').click();
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await expect.poll(() => headerNames(grid).then(n => n[0])).toBe('Email');
        await waitForGridReady(grid);
        await expect.poll(() => openMenus(grid)).toEqual([]);

        // Hiding Gender reuses its header element for the next column
        const gender = await openMenu(grid, 'Gender');
        await menuItem(gender, 'Hide column').click();
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(2);
        await expect.poll(() => headerNames(grid)).not.toContain('Gender');
        await waitForGridReady(grid);
        await expect.poll(() => openMenus(grid)).toEqual([]);
        await expect(grid.locator('vi-query-grid-column-header vi-popup-menu-item[icon="Configure"]:visible')).toHaveCount(0);
    });
});

test.describe('Sorting', () => {
    test('does not sort when the caret is clicked', { annotation: [{ type: 'case', description: 'header.hdr-caret-does-not-sort' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const log = requestLog(page);

        const h = await openMenuByCaret(grid, 'LastName');
        await closeMenu(h);

        // Let any (unexpected) sort request start before counting
        await log.quiet(300);
        expect(log.of('ExecuteQuery')).toHaveLength(0);
        expect(await sortOptions(page)).toEqual(['FirstName ASC']);

        await header(grid, 'LastName').locator('vi-query-grid-column-filter').click();
        await expect(header(grid, 'LastName').locator('vi-query-grid-column-filter vi-input-search')).toBeVisible();
        await log.quiet(300);
        expect(await sortOptions(page)).toEqual(['FirstName ASC']);
        expect(log.of('ExecuteQuery')).toHaveLength(0);
    });

    test('sorts an unsorted column ascending on label click, replacing the previous sort', { annotation: [{ type: 'case', description: 'header.hdr-sort-click-single-asc' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        await header(grid, 'LastName').locator('div.label > label').click();
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC']);
        await waitForGridReady(grid);

        await expect(sortIcon(grid, 'LastName')).toHaveAttribute('source', 'SortAsc');
        await expect(sortIcon(grid, 'LastName')).toBeVisible();
        await expect(sortIcon(grid, 'FirstName')).toBeHidden();

        const lastNames = (await visibleRows(grid)).filter(r => !r.isGroup).map(r => r.texts[1]);
        expect(lastNames.length).toBeGreaterThan(5);
        expect(lastNames).toEqual([...lastNames].sort((a, b) => a.localeCompare(b)));
    });

    test('label clicks toggle ASC to DESC and back, never unsorted', { annotation: [{ type: 'case', description: 'header.hdr-sort-click-asc-to-desc' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const label = header(grid, 'LastName').locator('div.label > label');

        await label.click();
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC']);
        await waitForQueryIdle(grid);

        await label.click();
        await expect.poll(() => sortOptions(page)).toEqual(['LastName DESC']);
        await expect(sortIcon(grid, 'LastName')).toHaveAttribute('source', 'SortDesc');
        await expect(sortIcon(grid, 'LastName')).toBeVisible();
        await waitForQueryIdle(grid);

        await label.click();
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC']);
        await expect(sortIcon(grid, 'LastName')).toHaveAttribute('source', 'SortAsc');
    });

    test('ignores label clicks on a non-sortable column', { annotation: [{ type: 'case', description: 'header.hdr-sort-disabled' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { query: 'QueryGrid_ColumnOptions' });
        const log = requestLog(page);

        await header(grid, 'PhoneNumber').locator('div.label > label').click();

        // Nothing should be sent; wait for the network to stay quiet to prove it
        await log.quiet(300);
        expect(log.of('ExecuteQuery')).toHaveLength(0);
        expect(await sortOptions(page)).toEqual(['FirstName ASC']);
        await expect(sortIcon(grid, 'FirstName')).toHaveAttribute('source', 'SortAsc');
        await expect(sortIcon(grid, 'PhoneNumber')).toBeHidden();
    });

    test('press-drag-release on a header label does not sort', { annotation: [{ type: 'case', description: 'header.header-label-drag-no-sort' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const label = header(grid, 'Email').locator('div.label > label');
        const log = requestLog(page);

        const box = (await label.boundingBox())!;
        expect(box.width).toBeGreaterThan(50);
        const y = box.y + box.height / 2;
        await page.mouse.move(box.x + 8, y);
        await page.mouse.down();
        await page.mouse.move(box.x + 38, y, { steps: 6 });
        await page.mouse.up();

        await log.quiet(300);
        expect(log.of('ExecuteQuery')).toHaveLength(0);
        expect(await sortOptions(page)).toEqual(['FirstName ASC']);

        await label.click();
        await expect.poll(() => sortOptions(page)).toEqual(['Email ASC']);
    });

    test('two quick clicks on a header end in the last requested direction', { annotation: [{ type: 'case', description: 'gap.hdr-rapid-sort-clicks' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        const grid = await headerGrid(page);
        const log = requestLog(page);

        await header(grid, 'LastName').locator('div.label > label').dblclick();
        await expect.poll(() => sortOptions(page)).toEqual(['LastName DESC']);
        await log.quiet(300);
        await waitForGridReady(grid);

        // ASC is sent as the bare column name
        expect(await sortOptions(page)).toEqual(['LastName DESC']);
        expect(log.of('ExecuteQuery').map(r => r.body?.query?.sortOptions)).toEqual(['LastName', 'LastName DESC']);
        await expect(sortIcon(grid, 'LastName')).toHaveAttribute('source', 'SortDesc');
        await expect(sortIcon(grid, 'LastName')).toBeVisible();

        // The rows follow the last request: the alphabetically last last names come first
        const lastNames = (await visibleRows(grid)).filter(r => !r.isGroup).map(r => r.texts[1]);
        expect(lastNames.length).toBeGreaterThan(5);
        expect(lastNames).toEqual([...lastNames].sort((a, b) => b.localeCompare(a)));
        const lastName = await page.evaluate(async () => {
            const w = window as any;
            const q = await w.service.getQuery('People', { sortOptions: 'LastName DESC' });
            return q.items[0].getValue('LastName');
        });
        expect(lastNames[0]).toBe(lastName);
        expect(errors).toEqual([]);
    });
});

test.describe('Multi-sort', () => {
    test('adds a secondary ascending sort on ctrl+click', { annotation: [{ type: 'case', description: 'header.hdr-multisort-ctrl-add' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        await header(grid, 'LastName').locator('div.label > label').click();
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC']);
        await waitForQueryIdle(grid);

        await header(grid, 'FirstName').locator('div.label > label').click({ modifiers: ['Control'] });
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC', 'FirstName ASC']);
        await expect(sortIcon(grid, 'LastName')).toHaveAttribute('source', 'SortAsc');
        await expect(sortIcon(grid, 'FirstName')).toHaveAttribute('source', 'SortAsc');
        await expect(sortIcon(grid, 'LastName')).toBeVisible();
        await expect(sortIcon(grid, 'FirstName')).toBeVisible();
    });

    test('ctrl+click flips a secondary sort to DESC in place, then removes it', { annotation: [{ type: 'case', description: 'header.hdr-multisort-ctrl-asc-to-desc' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const firstName = header(grid, 'FirstName').locator('div.label > label');

        await header(grid, 'LastName').locator('div.label > label').click();
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC']);
        await waitForQueryIdle(grid);
        await firstName.click({ modifiers: ['Control'] });
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC', 'FirstName ASC']);
        await waitForQueryIdle(grid);

        await firstName.click({ modifiers: ['Control'] });
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC', 'FirstName DESC']);
        await expect(sortIcon(grid, 'FirstName')).toHaveAttribute('source', 'SortDesc');
        await waitForQueryIdle(grid);

        await firstName.click({ modifiers: ['Control'] });
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC']);
        await expect(sortIcon(grid, 'FirstName')).toBeHidden();
        await expect(sortIcon(grid, 'LastName')).toHaveAttribute('source', 'SortAsc');
    });

    test('toggles the only sorted column between ASC and DESC on ctrl+click', { annotation: [{ type: 'case', description: 'header.hdr-multisort-ctrl-only-sort' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const lastName = header(grid, 'LastName').locator('div.label > label');

        await lastName.click();
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC']);
        await waitForQueryIdle(grid);

        await lastName.click({ modifiers: ['Control'] });
        await expect.poll(() => sortOptions(page)).toEqual(['LastName DESC']);
        await expect(sortIcon(grid, 'LastName')).toHaveAttribute('source', 'SortDesc');
        await waitForQueryIdle(grid);

        await lastName.click({ modifiers: ['Control'] });
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC']);
        await expect(sortIcon(grid, 'LastName')).toHaveAttribute('source', 'SortAsc');
        await expect(sortIcon(grid, 'LastName')).toBeVisible();
    });

    test('treats shift+click and meta+click as a plain single sort', { annotation: [{ type: 'case', description: 'header.hdr-sort-shift-meta-is-single' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const email = header(grid, 'Email').locator('div.label > label');
        const twoSorts = async () => {
            await page.evaluate(async () => {
                const q = (window as any).grid.query;
                q.sortOptions = [{ name: 'LastName', direction: 'ASC' }, { name: 'FirstName', direction: 'DESC' }];
                await q.search();
            });
            await waitForGridReady(grid);
            expect(await sortOptions(page)).toEqual(['LastName ASC', 'FirstName DESC']);
        };

        await twoSorts();
        await email.click({ modifiers: ['Shift'] });
        await expect.poll(() => sortOptions(page)).toEqual(['Email ASC']);
        await waitForQueryIdle(grid);

        await twoSorts();
        await email.click({ modifiers: ['Meta'] });
        await expect.poll(() => sortOptions(page)).toEqual(['Email ASC']);
        await expect(sortIcon(grid, 'LastName')).toBeHidden();
        await expect(sortIcon(grid, 'FirstName')).toBeHidden();
    });
});

test.describe('Sorting via menu', () => {
    test('\'Sort ascending\' and \'Sort descending\' menu items force their direction', { annotation: [{ type: 'case', description: 'gap.hdr-menu-sort-items-force-direction' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        const sortVia = async (name: string, label: 'Sort ascending' | 'Sort descending', expected: string[]) => {
            const h = await openMenu(grid, name);
            await menuItem(h, label).click();
            await expect.poll(() => sortOptions(page)).toEqual(expected);
            await waitForQueryIdle(grid);
            await expect(sortIcon(grid, name)).toHaveAttribute('source', expected[0].endsWith('ASC') ? 'SortAsc' : 'SortDesc');
            await expect(sortIcon(grid, name)).toBeVisible();
        };

        // ASC column: Sort ascending keeps ASC
        await sortVia('FirstName', 'Sort ascending', ['FirstName ASC']);
        // ASC column: Sort descending gives DESC
        await sortVia('FirstName', 'Sort descending', ['FirstName DESC']);
        // DESC column: Sort descending keeps DESC
        await sortVia('FirstName', 'Sort descending', ['FirstName DESC']);
        // DESC column: Sort ascending gives ASC
        await sortVia('FirstName', 'Sort ascending', ['FirstName ASC']);
        // Unsorted column: Sort descending gives DESC and replaces the sort
        await sortVia('LastName', 'Sort descending', ['LastName DESC']);
        await expect(sortIcon(grid, 'FirstName')).toBeHidden();
        // Unsorted column: Sort ascending gives ASC
        await sortVia('Email', 'Sort ascending', ['Email ASC']);
    });

    test('ctrl+click on \'Sort ascending\' or \'Sort descending\' adds or updates that column\'s sort', { annotation: [{ type: 'case', description: 'header.hdr-menu-sort-ctrl' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        const ctrlSortVia = async (name: string, label: 'Sort ascending' | 'Sort descending', expected: string[]) => {
            const h = await openMenu(grid, name);
            await menuItem(h, label).click({ modifiers: ['Control'] });
            await expect.poll(() => sortOptions(page)).toEqual(expected);
            await waitForQueryIdle(grid);
        };

        await header(grid, 'LastName').locator('div.label > label').click();
        await expect.poll(() => sortOptions(page)).toEqual(['LastName ASC']);
        await waitForQueryIdle(grid);

        // Adds a secondary sort with the item's direction
        await ctrlSortVia('FirstName', 'Sort descending', ['LastName ASC', 'FirstName DESC']);
        await expect(sortIcon(grid, 'LastName')).toHaveAttribute('source', 'SortAsc');
        await expect(sortIcon(grid, 'FirstName')).toHaveAttribute('source', 'SortDesc');
        // Updates the secondary sort in place
        await ctrlSortVia('FirstName', 'Sort ascending', ['LastName ASC', 'FirstName ASC']);
        // Updates the primary sort in place
        await ctrlSortVia('LastName', 'Sort descending', ['LastName DESC', 'FirstName ASC']);
        await expect(sortIcon(grid, 'LastName')).toHaveAttribute('source', 'SortDesc');
        // Adds a third sort ascending
        await ctrlSortVia('Email', 'Sort ascending', ['LastName DESC', 'FirstName ASC', 'Email ASC']);
    });
});

test.describe('Sort persistence and errors', () => {
    test('saves the sort to the user settings with one query request per click', { annotation: [{ type: 'case', description: 'header.hdr-sort-persists-querysettings' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const id = await page.evaluate(() => (window as any).grid.query.id);
        const log = requestLog(page);

        await header(grid, 'LastName').locator('div.label > label').click();
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await log.quiet(300);
        expect(log.of('ExecuteQuery')).toHaveLength(1);

        let saves = await savedSettings(page);
        expect(saves[0].QuerySettings[id].sortOptions).toBe('LastName ASC');
        expect(saves[0].QueryGridSettings).toEqual({});

        await waitForQueryIdle(grid);
        await header(grid, 'FirstName').locator('div.label > label').click({ modifiers: ['Control'] });
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(2);
        await waitForQueryIdle(grid);
        await header(grid, 'FirstName').locator('div.label > label').click({ modifiers: ['Control'] });
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(3);
        await log.quiet(300);
        expect(log.of('ExecuteQuery')).toHaveLength(3);

        saves = await savedSettings(page);
        expect(saves[2].QuerySettings[id].sortOptions).toBe('LastName ASC; FirstName DESC');
        expect(saves[2].QueryGridSettings).toEqual({});
    });

    test('restores a recorded sort in a fresh page', { annotation: [{ type: 'case', description: 'header.hdr-sort-roundtrip' }] }, async ({ page, context }) => {
        const grid = await headerGrid(page);
        const id = await queryId(page);
        const label = header(grid, 'LastName').locator('div.label > label');

        await label.click();
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await waitForQueryIdle(grid);
        await label.click();
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(2);
        const recorded = (await savedSettings(page))[1].QuerySettings[id].sortOptions;
        expect(recorded).toBe('LastName DESC');

        // The backend applies the stored QuerySettings when it returns the query; the shared Admin settings are never
        // written, so the fresh page hands the recorded sort to the query load itself
        const fresh = await context.newPage();
        const freshGrid = await headerGrid(fresh, { queryOptions: { sortOptions: recorded }, sortByFirstName: false });

        expect(await sortOptions(fresh)).toEqual(['LastName DESC']);
        await expect(sortIcon(freshGrid, 'LastName')).toHaveAttribute('source', 'SortDesc');
        await expect(sortIcon(freshGrid, 'LastName')).toBeVisible();
        await expect(sortIcon(freshGrid, 'FirstName')).toBeHidden();

        const lastNames = (await visibleRows(freshGrid)).map(r => r.texts[1]);
        expect(lastNames.length).toBeGreaterThan(5);
        expect(lastNames).toEqual([...lastNames].sort((a, b) => b.localeCompare(a)));
        expect(await savedSettings(fresh)).toHaveLength(0);
    });

    test('a failed sort restores the previous sort and saves nothing', { annotation: [{ type: 'case', description: 'gap.hdr-sort-backend-error' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        const grid = await headerGrid(page);

        await page.route('**/ExecuteQuery', route => route.fulfill({ json: { exception: 'Sort failed' } }), { times: 1 });
        await header(grid, 'LastName').locator('div.label > label').click();

        await expect.poll(() => page.evaluate(() => (window as any).grid.query.notification)).toBe('Sort failed');
        await waitForQueryIdle(grid);
        await nextFrames(page, 2);

        // The grid stays empty after a failed search, the next search uses the previous sort
        expect(await sortOptions(page)).toEqual(['FirstName ASC']);
        await expect(sortIcon(grid, 'FirstName')).toHaveAttribute('source', 'SortAsc');
        await expect(sortIcon(grid, 'FirstName')).toBeVisible();
        await expect(sortIcon(grid, 'LastName')).toBeHidden();
        expect((await visibleRows(grid)).map(r => r.texts.join(''))).toEqual((await visibleRows(grid)).map(() => ''));
        expect(await savedSettings(page)).toHaveLength(0);
        expect(errors).toEqual([]);
    });
});

test.describe('Grouping', () => {
    test('groups by Birth date (in years) from the menu without saving settings', { annotation: [{ type: 'case', description: 'header.hdr-groupby-birthdate' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        const h = await openMenu(grid, 'BirthDate');
        await menuItem(h, 'Group by Birth date').click();

        await expect.poll(() => page.evaluate(() => (window as any).grid.query.groupingInfo?.groupedBy)).toBe('BirthDate');
        await expect(grid).toHaveAttribute('has-grouping', '');
        await expect(grid.locator('vi-query-grid-grouping')).toBeVisible();
        await waitForGridReady(grid);

        const names: string[] = await page.evaluate(() => (window as any).grid.query.groupingInfo.groups.map((g: any) => g.name));
        expect(names.length).toBeGreaterThan(1);
        for (const name of names)
            expect(name).toMatch(/^\d{4}$/);

        expect((await visibleRows(grid)).some(r => r.isGroup)).toBe(true);
        expect(await savedSettings(page)).toHaveLength(0);
    });

    test('switches grouping to another column', { annotation: [{ type: 'case', description: 'header.hdr-groupby-switch' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const groupedBy = () => page.evaluate(() => (window as any).grid.query.groupingInfo?.groupedBy);
        const groupNames = (): Promise<string[]> => page.evaluate(() => (window as any).grid.query.groupingInfo.groups.map((g: any) => g.name));

        const birthDate = await openMenu(grid, 'BirthDate');
        await menuItem(birthDate, 'Group by Birth date').click();
        await expect.poll(groupedBy).toBe('BirthDate');
        await waitForGridReady(grid);
        await page.keyboard.press('Escape');

        const gender = await openMenu(grid, 'Gender');
        await menuItem(gender, 'Group by Gender').click();
        await expect.poll(groupedBy).toBe('Gender');
        await waitForGridReady(grid);

        const names = await groupNames();
        expect(names).toEqual(expect.arrayContaining(['Female', 'Male']));
        expect(names.every(n => ['Female', 'Male', 'Unknown'].includes(n))).toBe(true);

        const groupRows = (await visibleRows(grid)).filter(r => r.isGroup).map(r => r.texts.join(' '));
        expect(groupRows.length).toBeGreaterThan(0);
        expect(groupRows.some(t => /\b\d{4}\b/.test(t))).toBe(false);
        await expect(grid).toHaveAttribute('has-grouping', '');
    });

    test('retrying Group by after a failed request groups the grid', { annotation: [{ type: 'case', description: 'gap.hdr-groupby-error-retry' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const groupedBy = () => page.evaluate(() => (window as any).grid.query.groupingInfo?.groupedBy);

        await page.route('**/ExecuteQuery', route => route.fulfill({ json: { exception: 'Group failed' } }), { times: 1 });
        let gender = await openMenu(grid, 'Gender');
        await menuItem(gender, 'Group by Gender').click();
        await expect.poll(() => page.evaluate(() => (window as any).grid.query.notification)).toBe('Group failed');
        await waitForQueryIdle(grid);
        await expect(grid).not.toHaveAttribute('has-grouping');
        await page.keyboard.press('Escape');

        const log = requestLog(page);
        gender = await openMenu(grid, 'Gender');
        await menuItem(gender, 'Group by Gender').click();
        await expect.poll(() => log.of('ExecuteQuery').length).toBe(1);
        await expect.poll(groupedBy).toBe('Gender');
        await expect(grid).toHaveAttribute('has-grouping', '');
        await waitForGridReady(grid);
        expect((await visibleRows(grid)).some(r => r.isGroup)).toBe(true);
    });
});

test.describe('Pin and hide', () => {
    test('disables Hide column on the only visible column', { annotation: [{ type: 'case', description: 'header.hdr-hide-last-visible' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const id = await queryId(page);
        const columns = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];

        for (const [index, name] of columns.slice(0, -1).entries()) {
            const h = await openMenu(grid, name);
            await expect(menuItem(h, 'Hide column')).not.toHaveAttribute('disabled');
            await menuItem(h, 'Hide column').click();
            await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(index + 1);
            await expect.poll(() => headerNames(grid)).toEqual(columns.slice(index + 1));
            await waitForGridReady(grid);
            await page.keyboard.press('Escape');
        }

        const h = await openMenu(grid, 'IsActive');
        const hide = menuItem(h, 'Hide column');
        await expect(hide).toHaveAttribute('disabled', '');
        await expect(hide.locator('vi-button')).toHaveAttribute('disabled', '');

        // Neither a click nor a direct activation hides it
        await hide.click({ force: true });
        await hide.evaluate((item: HTMLElement) => item.click());
        await nextFrames(page, 2);
        expect(await savedSettings(page)).toHaveLength(columns.length - 1);
        expect(await headerNames(grid)).toEqual(['IsActive']);

        const stored = (await savedSettings(page)).at(-1).QueryGridSettings[id];
        expect(stored).toEqual(Object.fromEntries(columns.slice(0, -1).map(name => [name, { isHidden: true }])));
    });
});

test.describe('Resize', () => {
    test('clamps the column to a 50px minimum', { annotation: [{ type: 'case', description: 'header.hdr-resize-min-default' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const id = await page.evaluate(() => (window as any).grid.query.id);

        const resizer = (await header(grid, 'LastName').locator('.resizer').boundingBox())!;
        const x = resizer.x + resizer.width / 2;
        const y = resizer.y + resizer.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x - 400, y, { steps: 10 });
        await page.mouse.up();

        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        expect((await savedSettings(page))[0].QueryGridSettings[id]).toEqual({ LastName: { width: '50px' } });

        await expect.poll(() => header(grid, 'LastName').evaluate(h => Math.round(h.getBoundingClientRect().width))).toBe(50);
        const cellWidths = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].slice(0, 3).map((r: any) => {
            const cells = [...r.querySelectorAll('.column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])];
            return Math.round(cells[1].getBoundingClientRect().width);
        }));
        expect(cellWidths).toEqual([50, 50, 50]);
    });

    test('places an ew-resize handle on the header\'s right edge', { annotation: [{ type: 'case', description: 'header.hdr-resizer-geometry' }] }, async ({ page }) => {
        const grid = await headerGrid(page);

        for (const name of ['FirstName', 'Email']) {
            const h = header(grid, name);
            const box = (await h.boundingBox())!;
            const resizer = h.locator('.resizer');
            const r = (await resizer.boundingBox())!;
            const halfEm = await h.evaluate(el => parseFloat(getComputedStyle(el).fontSize) / 2);

            expect(Math.abs(r.width - halfEm), name).toBeLessThanOrEqual(0.5);
            expect(Math.abs(r.height - box.height), name).toBeLessThanOrEqual(1);
            expect(Math.abs(r.y - box.y), name).toBeLessThanOrEqual(1);
            expect(Math.abs(r.x + r.width / 2 - (box.x + box.width)), name).toBeLessThanOrEqual(4);
            await expect(resizer).toHaveCSS('cursor', 'ew-resize');
        }
    });

    test('honors --vi-query-grid--minimum-column-width', { annotation: [{ type: 'case', description: 'header.hdr-resize-min-custom' }] }, async ({ page }) => {
        const grid = await headerGrid(page, {}, { styles: 'vi-query-grid { --vi-query-grid--minimum-column-width: 80px; }' });
        const id = await queryId(page);

        await resizeColumn(grid, 'LastName', -400);
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        expect((await savedSettings(page))[0].QueryGridSettings[id]).toEqual({ LastName: { width: '80px' } });
        await expect.poll(() => header(grid, 'LastName').evaluate(h => Math.round(h.getBoundingClientRect().width))).toBe(80);
    });

    test('clicks, double-clicks and drags on the resizer never sort', { annotation: [{ type: 'case', description: 'header.hdr-resize-click-noop' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const widths = await headerWidths(grid);
        const log = requestLog(page);

        const r = (await header(grid, 'LastName').locator('.resizer').boundingBox())!;
        const x = r.x + r.width / 2;
        const y = r.y + r.height / 2;
        await page.mouse.click(x, y);
        await page.mouse.dblclick(x, y);

        await log.quiet(300);
        await nextFrames(page, 2);
        expect(await headerWidths(grid)).toEqual(widths);
        expect(await savedSettings(page)).toHaveLength(0);
        expect(log.of('ExecuteQuery')).toHaveLength(0);
        expect(await sortOptions(page)).toEqual(['FirstName ASC']);

        await resizeColumn(grid, 'LastName', 40);
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await log.quiet(300);
        expect(log.of('ExecuteQuery')).toHaveLength(0);
        expect(await sortOptions(page)).toEqual(['FirstName ASC']);
        expect((await savedSettings(page))[0].QuerySettings).toEqual({});
    });

    test('resizes a pinned column and keeps it pinned', { annotation: [{ type: 'case', description: 'header.hdr-resize-pinned' }] }, async ({ page }) => {
        const grid = await headerGrid(page, { userSettings: { Email: { isPinned: true } } });
        const id = await queryId(page);
        expect((await headerNames(grid))[0]).toBe('Email');
        const before = (await headerWidths(grid)).Email;

        await resizeColumn(grid, 'Email', 50);
        await expect.poll(() => savedSettings(page).then(s => s.length)).toBe(1);
        await expect.poll(() => headerWidths(grid).then(w => Math.abs(w.Email - (before + 50)) <= 1)).toBe(true);
        expect((await headerNames(grid))[0]).toBe('Email');

        const email = (await savedSettings(page))[0].QueryGridSettings[id].Email;
        expect(email.isPinned).toBe(true);
        expect(Math.abs(parseFloat(email.width) - (before + 50))).toBeLessThanOrEqual(1);
        expect(email.width).toMatch(/^\d+(\.\d+)?px$/);
    });
});

test.describe('Keyboard', () => {
    test('opens the menu with Enter on the focused caret and keeps the focus in the header', { annotation: [{ type: 'case', description: 'header.hdr-menu-keyboard-open' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        const email = header(grid, 'Email');

        await email.locator('vi-button[icon="CaretDown"]:visible').focus();
        await page.keyboard.press('Enter');
        await expect(menuItem(email, 'Manage')).toBeVisible();

        // The focus stays on the menu (its caret or an item) instead of falling back to the body
        await expect.poll(async () => (await deepFocusPath(page)).some(e => e.tag === 'vi-query-grid-column-header' && e.name === 'Email')).toBe(true);

        await page.keyboard.press('Escape');
        await expect(menuItem(email, 'Manage')).toBeHidden();
    });

    test('Tab moves through the filters menu and each header\'s caret and filter, in column order', { annotation: [{ type: 'case', description: 'gap.hdr-tab-order' }] }, async ({ page }) => {
        const grid = await headerGrid(page);
        await page.evaluate(() => {
            const before = document.createElement('button');
            before.id = 'before';
            before.textContent = 'before';
            document.body.prepend(before);
        });
        await page.locator('#before').focus();

        const describe = async () => {
            const path = await deepFocusPath(page);
            const tags = path.map(e => e.tag);
            if (tags.includes('vi-query-grid-row') || tags.some(t => t.startsWith('vi-query-grid-cell')))
                return 'row';
            if (tags.includes('vi-query-grid-filters'))
                return 'filters';

            const h = path.find(e => e.tag === 'vi-query-grid-column-header');
            if (h)
                return `${h.name}:${tags.includes('vi-query-grid-column-filter') ? 'filter' : path.at(-1)!.icon === 'CaretDown' ? 'caret' : path.at(-1)!.tag}`;

            return tags.includes('vi-query-grid') ? `grid:${path.at(-1)!.tag}` : 'outside';
        };

        const visited: string[] = [];
        for (let i = 0; i < 1 + PEOPLE_COLUMNS.length * 2 + 1; i++) {
            await page.keyboard.press('Tab');
            visited.push(await describe());
        }

        expect(visited).toEqual(['filters', ...PEOPLE_COLUMNS.flatMap(n => [`${n}:caret`, `${n}:filter`]), 'outside']);
    });
});
