import { expect, Page, test } from '@playwright/test';
import { gridPage } from '../_helpers/query-grid';

/**
 * Mounts a standalone vi-query-grid-filter-dialog-name for the Name attribute of a new People filter.
 * The attribute is available in the page as `window.attr`.
 */
async function mountName(page: Page, value: string | null) {
    await gridPage(page);
    await page.evaluate(async value => {
        const w = window as any;
        const query = await w.service.getQuery('People');
        const filter = await query.filters.createNew();
        filter.persistentObject.beginEdit();

        const attr = filter.persistentObject.attributes.Name;
        if (value != null)
            await attr.setValue(value);

        // Start from an unchanged attribute, so a change made by the editor shows in isValueChanged
        attr.isValueChanged = false;

        const element = document.createElement('vi-query-grid-filter-dialog-name') as any;
        element.attribute = attr;
        document.getElementById('test-container')!.appendChild(element);
        w.attr = attr;
    }, value);

    const element = page.locator('vi-query-grid-filter-dialog-name');
    await expect(element.locator('input.name')).toBeVisible();
    // The editor focuses the name (or group) input on connect, retrying until it can; wait for it so it doesn't steal focus later
    await expect(element.locator(value?.includes('\n') ? 'input.group' : 'input.name')).toBeFocused();

    return {
        element,
        name: element.locator('input.name'),
        group: element.locator('input.group'),
        chevron: element.locator('vi-icon[source="ChevronRight"]'),
        folder: element.locator('vi-button[icon="Folder"]'),
        value: () => page.evaluate(() => (window as any).attr.value)
    };
}

test.describe('Initial value', () => {
    test('plain or null value fills the name input and hides the group', { annotation: [{ type: 'case', description: 'filters.dn-plain-name' }] }, async ({ page, browser }) => {
        const plain = await mountName(page, 'My filter');
        await expect(plain.name).toHaveValue('My filter');
        await expect(plain.group).toBeHidden();
        await expect(plain.chevron).toBeHidden();

        const other = await browser.newPage();
        try {
            const empty = await mountName(other, null);
            await expect(empty.name).toHaveValue('');
            await expect(empty.group).toBeHidden();
            await expect(empty.chevron).toBeHidden();
        }
        finally {
            await other.close();
        }
    });

    test("'Group\\nName' is split into group and name", { annotation: [{ type: 'case', description: 'filters.dn-grouped-name' }] }, async ({ page }) => {
        const editor = await mountName(page, 'Group\nName');
        await expect(editor.group).toBeVisible();
        await expect(editor.group).toHaveValue('Group');
        await expect(editor.chevron).toBeVisible();
        await expect(editor.name).toHaveValue('Name');
    });

    test('only the first line break splits off the group, editing keeps the rest', { annotation: [{ type: 'case', description: 'filters.dn-multi-newline' }] }, async ({ page }) => {
        const editor = await mountName(page, 'A\nB\nC');
        await expect(editor.group).toHaveValue('A');
        await expect(editor.name).toHaveValue('B C');

        await editor.name.click();
        await page.keyboard.press('End');
        await page.keyboard.type('x');
        await expect.poll(editor.value).toBe('A\nB Cx');
    });
});

test.describe('Editing', () => {
    test('typing a name writes the attribute', { annotation: [{ type: 'case', description: 'filters.dn-type-name' }] }, async ({ page }) => {
        const editor = await mountName(page, null);
        await editor.name.click();
        await page.keyboard.type('abc');

        await expect.poll(editor.value).toBe('abc');
    });

    test("Folder reveals the group input and writes 'group\\nname'", { annotation: [{ type: 'case', description: 'filters.dn-toggle-group-on' }] }, async ({ page }) => {
        const editor = await mountName(page, 'N');
        await expect(editor.group).toBeHidden();

        await editor.folder.click();
        await expect(editor.group).toBeVisible();
        await expect(editor.group).toBeFocused();

        await page.keyboard.type('G');
        await expect.poll(editor.value).toBe('G\nN');
    });

    test('toggling grouping off clears and hides the group', { annotation: [{ type: 'case', description: 'filters.dn-toggle-group-off' }] }, async ({ page }) => {
        const editor = await mountName(page, 'N');
        await editor.folder.click();
        await expect(editor.group).toBeFocused();
        await page.keyboard.type('G');
        await expect.poll(editor.value).toBe('G\nN');

        await editor.folder.click();
        await expect(editor.group).toBeHidden();
        await expect.poll(editor.value).toBe('N');
    });

    test('empty group writes only the name', { annotation: [{ type: 'case', description: 'filters.dn-group-empty' }] }, async ({ page }) => {
        const editor = await mountName(page, 'N');
        await editor.folder.click();
        await expect(editor.group).toBeFocused();
        await expect(editor.group).toHaveValue('');
        await expect(editor.name).toHaveValue('N');

        // Typing and removing a group character leaves an empty group
        await page.keyboard.type('G');
        await expect.poll(editor.value).toBe('G\nN');
        await page.keyboard.press('Backspace');
        await expect(editor.group).toHaveValue('');
        await expect.poll(editor.value).toBe('N');
    });

    test('clearing the name writes an empty value and keeps the group input', { annotation: [{ type: 'case', description: 'filters.dn-name-empty-group-set' }] }, async ({ page }) => {
        const editor = await mountName(page, 'G\nN');
        await expect(editor.group).toHaveValue('G');

        // An empty name is an empty value (the filter needs a name), whatever the group
        await editor.name.click();
        await page.keyboard.press('Backspace');
        await expect(editor.name).toHaveValue('');
        await expect.poll(editor.value).toBe('');

        // The group is still there: typing a new name writes both again
        await expect(editor.group).toBeVisible();
        await expect(editor.group).toHaveValue('G');
        await page.keyboard.type('M');
        await expect.poll(editor.value).toBe('G\nM');
    });
});

test.describe('Focus', () => {
    test('connecting focuses the name or group input', { annotation: [{ type: 'case', description: 'filters.dn-focus-name' }] }, async ({ page, browser }) => {
        const deepActive = (p: Page) => p.evaluate(() => {
            let element = document.activeElement;
            while (element?.shadowRoot?.activeElement)
                element = element.shadowRoot.activeElement;

            return element ? `${element.tagName.toLowerCase()}.${element.className}` : null;
        });

        const plain = await mountName(page, 'My filter');
        await expect(plain.name).toBeFocused();
        expect(await deepActive(page)).toBe('input.flex name');

        const other = await browser.newPage();
        try {
            const grouped = await mountName(other, 'Group\nName');
            await expect(grouped.group).toBeFocused();
            expect(await deepActive(other)).toBe('input.flex group');
        }
        finally {
            await other.close();
        }
    });

    test('Folder button is not in the tab order', { annotation: [{ type: 'case', description: 'filters.dn-folder-not-tabbable' }] }, async ({ page }) => {
        const editor = await mountName(page, 'Group\nName');
        const folderFocused = () => editor.folder.evaluate((folder: Element) => {
            let element = document.activeElement;
            const path: Element[] = [];
            while (element) {
                path.push(element);
                element = element.shadowRoot?.activeElement ?? null;
            }

            return path.includes(folder);
        });

        await expect(editor.folder).toHaveAttribute('tabindex', '-1');

        // From the group input
        await editor.group.focus();
        await page.keyboard.press('Tab');
        expect(await folderFocused()).toBe(false);
        await editor.group.focus();
        await page.keyboard.press('Shift+Tab');
        expect(await folderFocused()).toBe(false);

        // From the name input
        await editor.name.focus();
        await page.keyboard.press('Tab');
        expect(await folderFocused()).toBe(false);
        await editor.name.focus();
        await page.keyboard.press('Shift+Tab');
        expect(await folderFocused()).toBe(false);
    });
});

test.describe('Lifecycle', () => {
    test('attaching does not change the attribute', { annotation: [{ type: 'case', description: 'filters.dn-no-write-on-init' }] }, async ({ page }) => {
        const editor = await mountName(page, 'Group\nName');
        await expect(editor.group).toHaveValue('Group');
        await expect(editor.name).toHaveValue('Name');

        const state = await page.evaluate(() => ({ value: (window as any).attr.value, changed: (window as any).attr.isValueChanged }));
        expect(state).toEqual({ value: 'Group\nName', changed: false });
    });

    test('assigning another attribute repopulates the inputs', { annotation: [{ type: 'case', description: 'filters.dn-attribute-swap' }] }, async ({ page }) => {
        const editor = await mountName(page, 'One');
        await expect(editor.name).toHaveValue('One');
        await expect(editor.group).toBeHidden();

        await page.evaluate(async () => {
            const w = window as any;
            const query = await w.service.getQuery('People');
            const filter = await query.filters.createNew();
            filter.persistentObject.beginEdit();

            const attr = filter.persistentObject.attributes.Name;
            await attr.setValue('G\nTwo');
            w.otherAttr = attr;
            (document.querySelector('vi-query-grid-filter-dialog-name') as any).attribute = attr;
        });

        await expect(editor.group).toBeVisible();
        await expect(editor.group).toHaveValue('G');
        await expect(editor.chevron).toBeVisible();
        await expect(editor.name).toHaveValue('Two');

        // Neither attribute was changed by the swap
        expect(await page.evaluate(() => [(window as any).attr.value, (window as any).otherAttr.value])).toEqual(['One', 'G\nTwo']);
    });
});
