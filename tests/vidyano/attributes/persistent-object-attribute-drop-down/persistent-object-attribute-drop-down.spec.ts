import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';

test.describe.serial('DropDown Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(sharedBackend);
    });

test.describe('DropDown Attribute (Select)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "Monday" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDown');

            const span = component.locator('span');
            await expect(span).toHaveText('Monday');
        });

        test('does not render vi-select element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDown');

            const select = component.locator('vi-select');
            await expect(select).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays vi-select with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDown');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            const input = select.locator('input');
            await expect(input).toHaveValue('Monday');
        });

        test('opens dropdown when clicking on select', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDown');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Wait for popup to open (scroller becomes visible)
            const scroller = select.locator('vi-scroller');
            await expect(scroller).toBeVisible();
        });

        test('displays all options in dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDown');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            const options = select.locator('vi-select-option-item');
            await expect(options).toHaveCount(8); // empty option + Monday through Sunday
        });

        test('selects option from dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDown');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Wednesday
            const wednesday = select.locator('vi-select-option-item').filter({ hasText: 'Wednesday' });
            await wednesday.click();

            const input = select.locator('input');
            await expect(input).toHaveValue('Wednesday');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDown');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Friday
            const friday = select.locator('vi-select-option-item').filter({ hasText: 'Friday' });
            await friday.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('Friday');
            const span = component.locator('span');
            await expect(span).toHaveText('Friday');
            await expect(component.locator('vi-select')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDown');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Thursday
            const thursday = select.locator('vi-select-option-item').filter({ hasText: 'Thursday' });
            await thursday.click();

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Monday');
            await expect(component.locator('vi-select')).toHaveCount(0);
        });
    });
});

test.describe('DropDown Attribute (Radio)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "Tuesday" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRadio');

            const span = component.locator('span');
            await expect(span).toHaveText('Tuesday');
        });
    });

    test.describe('Edit mode', () => {
        test('displays radio buttons after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRadio');

            await beginEdit(sharedPage, component);

            const radioButtons = component.locator('vi-checkbox[radio]');
            await expect(radioButtons).toHaveCount(8); // empty option + Monday through Sunday
        });

        test('displays initial value as checked', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRadio');

            await beginEdit(sharedPage, component);

            const tuesdayRadio = component.locator('vi-checkbox[radio]').filter({ hasText: 'Tuesday' });
            await expect(tuesdayRadio).toHaveAttribute('checked');
        });

        test('selects option by clicking radio button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRadio');

            await beginEdit(sharedPage, component);

            const fridayRadio = component.locator('vi-checkbox[radio]').filter({ hasText: 'Friday' });
            await fridayRadio.click();

            // Verify Friday is now checked
            await expect(fridayRadio).toHaveAttribute('checked');
        });

        test('applies vertical orientation by default', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRadio');

            await beginEdit(sharedPage, component);

            const radioContainer = component.locator('#radiobuttons');
            await expect(radioContainer).toHaveAttribute('orientation', 'vertical');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRadio');

            await beginEdit(sharedPage, component);

            const mondayRadio = component.locator('vi-checkbox[radio]').filter({ hasText: 'Monday' });
            await mondayRadio.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('Monday');
            const span = component.locator('span');
            await expect(span).toHaveText('Monday');
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRadio');

            await beginEdit(sharedPage, component);

            const wednesdayRadio = component.locator('vi-checkbox[radio]').filter({ hasText: 'Wednesday' });
            await wednesdayRadio.click();

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Tuesday');
        });
    });
});

test.describe('DropDown Attribute (Chip)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "Wednesday" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownChip');

            const span = component.locator('span');
            await expect(span).toHaveText('Wednesday');
        });
    });

    test.describe('Edit mode', () => {
        test('displays chip buttons after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownChip');

            await beginEdit(sharedPage, component);

            const chips = component.locator('vi-button[part="chip"]');
            await expect(chips).toHaveCount(8); // empty option + Monday through Sunday
        });

        test('displays selected chip as not inverse', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownChip');

            await beginEdit(sharedPage, component);

            const wednesdayChip = component.locator('vi-button[part="chip"]').filter({ hasText: 'Wednesday' });
            await expect(wednesdayChip).not.toHaveAttribute('inverse');
        });

        test('displays unselected chips as inverse', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownChip');

            await beginEdit(sharedPage, component);

            const mondayChip = component.locator('vi-button[part="chip"]').filter({ hasText: 'Monday' });
            await expect(mondayChip).toHaveAttribute('inverse');
        });

        test('selects option by clicking chip button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownChip');

            await beginEdit(sharedPage, component);

            const thursdayChip = component.locator('vi-button[part="chip"]').filter({ hasText: 'Thursday' });
            await thursdayChip.click();

            // Verify Thursday is now not inverse (selected)
            await expect(thursdayChip).not.toHaveAttribute('inverse');
        });

        test('applies vertical orientation by default', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownChip');

            await beginEdit(sharedPage, component);

            const chipContainer = component.locator('#chips');
            await expect(chipContainer).toHaveAttribute('orientation', 'vertical');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownChip');

            await beginEdit(sharedPage, component);

            const fridayChip = component.locator('vi-button[part="chip"]').filter({ hasText: 'Friday' });
            await fridayChip.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('Friday');
            const span = component.locator('span');
            await expect(span).toHaveText('Friday');
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownChip');

            await beginEdit(sharedPage, component);

            const tuesdayChip = component.locator('vi-button[part="chip"]').filter({ hasText: 'Tuesday' });
            await tuesdayChip.click();

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Wednesday');
        });
    });
});

test.describe('DropDown Attribute (ReadOnly)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownReadOnly');

            const span = component.locator('span');
            await expect(span).toHaveText('Thursday');
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly vi-select', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownReadOnly');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();
            await expect(select).toHaveAttribute('readonly');
        });

        test('displays readonly input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownReadOnly');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const input = select.locator('input');
            await expect(input).toHaveAttribute('readonly');
        });
    });
});

test.describe('DropDown Attribute (Required)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays em-dash when value is empty', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRequired');

            const span = component.locator('span');
            await expect(span).toHaveText('—');
        });
    });

    test.describe('Edit mode', () => {
        test('displays vi-select with empty value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRequired');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            const input = select.locator('input');
            await expect(input).toHaveValue('');
        });

        test('can select value from options', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRequired');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Monday
            const monday = select.locator('vi-select-option-item').filter({ hasText: 'Monday' });
            await monday.click();

            const input = select.locator('input');
            await expect(input).toHaveValue('Monday');
        });

        test('displays all options in dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRequired');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            const options = select.locator('vi-select-option-item');
            await expect(options).toHaveCount(7); // Monday through Sunday
        });
    });
});

test.describe('DropDown Attribute (Frozen)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode (Select)', () => {
        test('vi-select becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDown');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            await expect(select).not.toHaveAttribute('disabled');

            await freeze(sharedPage, component);

            await expect(select).toHaveAttribute('disabled');
        });

        test('vi-select becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDown');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toHaveAttribute('disabled');

            await unfreeze(sharedPage, component);

            await expect(select).not.toHaveAttribute('disabled');
        });
    });

    test.describe('Edit mode (Radio)', () => {
        test('radio buttons become disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRadio');

            await beginEdit(sharedPage, component);

            await freeze(sharedPage, component);

            const radioButtons = component.locator('vi-checkbox[radio]');
            const count = await radioButtons.count();

            for (let i = 0; i < count; i++) {
                await expect(radioButtons.nth(i)).toHaveAttribute('disabled');
            }
        });

        test('radio buttons become enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRadio');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);
            await unfreeze(sharedPage, component);

            const radioButtons = component.locator('vi-checkbox[radio]');
            const count = await radioButtons.count();

            for (let i = 0; i < count; i++) {
                await expect(radioButtons.nth(i)).not.toHaveAttribute('disabled');
            }
        });
    });

    test.describe('Edit mode (Chip)', () => {
        test('chip buttons become disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownChip');

            await beginEdit(sharedPage, component);

            await freeze(sharedPage, component);

            const chips = component.locator('vi-button[part="chip"]');
            const count = await chips.count();

            for (let i = 0; i < count; i++) {
                await expect(chips.nth(i)).toHaveAttribute('disabled');
            }
        });

        test('chip buttons become enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownChip');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);
            await unfreeze(sharedPage, component);

            const chips = component.locator('vi-button[part="chip"]');
            const count = await chips.count();

            for (let i = 0; i < count; i++) {
                await expect(chips.nth(i)).not.toHaveAttribute('disabled');
            }
        });
    });
});

test.describe('DropDown Attribute (Horizontal orientation)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode (Radio)', () => {
        test('applies horizontal orientation when specified', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownRadioHorizontal');

            await beginEdit(sharedPage, component);

            const radioContainer = component.locator('#radiobuttons');
            await expect(radioContainer).toHaveAttribute('orientation', 'horizontal');
        });
    });

    test.describe('Edit mode (Chip)', () => {
        test('applies horizontal orientation when specified', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-drop-down', 'DropDownChipHorizontal');

            await beginEdit(sharedPage, component);

            const chipContainer = component.locator('#chips');
            await expect(chipContainer).toHaveAttribute('orientation', 'horizontal');
        });
    });
});

}); // End of DropDown Attribute Tests wrapper
