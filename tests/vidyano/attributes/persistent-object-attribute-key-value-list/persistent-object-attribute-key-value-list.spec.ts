import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';

test.describe.serial('KeyValueList Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(sharedBackend);
    });

test.describe('KeyValueList Attribute (Select)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "One" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

            const span = component.locator('span');
            await expect(span).toHaveText('One');
        });

        test('does not render vi-select element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

            const select = component.locator('vi-select');
            await expect(select).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays vi-select with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            const input = select.locator('input');
            await expect(input).toHaveValue('One');
        });

        test('opens dropdown when clicking on select', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Wait for popup to open (scroller becomes visible)
            const scroller = select.locator('vi-scroller');
            await expect(scroller).toBeVisible();
        });

        test('displays all options in dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            const options = select.locator('vi-select-option-item');
            await expect(options).toHaveCount(5); // One through Five (no empty option, clear button instead)
        });

        test('selects option from dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Three
            const three = select.locator('vi-select-option-item').filter({ hasText: 'Three' });
            await three.click();

            const input = select.locator('input');
            await expect(input).toHaveValue('Three');
        });

        test('displays clear button when value is set and not required', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

            await beginEdit(sharedPage, component);

            // Should have clear button since it has a value (One) and is not required
            const clearButton = component.locator('vi-button').filter({ has: sharedPage.locator('vi-icon[source="Remove"]') });
            await expect(clearButton).toBeVisible();
        });

        test('clears value when clear button is clicked', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const input = select.locator('input');
            await expect(input).toHaveValue('One');

            // Click clear button
            const clearButton = component.locator('vi-button').filter({ has: sharedPage.locator('vi-icon[source="Remove"]') });
            await clearButton.click();

            // Value should be cleared
            await expect(input).toHaveValue('');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Five
            const five = select.locator('vi-select-option-item').filter({ hasText: 'Five' });
            await five.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('5'); // Key is saved, not the display value
            const span = component.locator('span');
            await expect(span).toHaveText('Five');
            await expect(component.locator('vi-select')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Four
            const four = select.locator('vi-select-option-item').filter({ hasText: 'Four' });
            await four.click();

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('One');
            await expect(component.locator('vi-select')).toHaveCount(0);
        });
    });
});

test.describe('KeyValueList Attribute (Radio)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "Two" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRadio');

            const span = component.locator('span');
            await expect(span).toHaveText('Two');
        });
    });

    test.describe('Edit mode', () => {
        test('displays radio buttons after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRadio');

            await beginEdit(sharedPage, component);

            const radioButtons = component.locator('vi-checkbox[radio]');
            await expect(radioButtons).toHaveCount(6); // empty option + One through Five
        });

        test('displays initial value as checked', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRadio');

            await beginEdit(sharedPage, component);

            const twoRadio = component.locator('vi-checkbox[radio]').filter({ hasText: 'Two' });
            await expect(twoRadio).toHaveAttribute('checked');
        });

        test('selects option by clicking radio button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRadio');

            await beginEdit(sharedPage, component);

            const fiveRadio = component.locator('vi-checkbox[radio]').filter({ hasText: 'Five' });
            await fiveRadio.click();

            // Verify Five is now checked
            await expect(fiveRadio).toHaveAttribute('checked');
        });

        test('applies vertical orientation by default', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRadio');

            await beginEdit(sharedPage, component);

            const radioContainer = component.locator('#radiobuttons');
            await expect(radioContainer).toHaveAttribute('orientation', 'vertical');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRadio');

            await beginEdit(sharedPage, component);

            const oneRadio = component.locator('vi-checkbox[radio]').filter({ hasText: 'One' });
            await oneRadio.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('1'); // Key is saved
            const span = component.locator('span');
            await expect(span).toHaveText('One');
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRadio');

            await beginEdit(sharedPage, component);

            const threeRadio = component.locator('vi-checkbox[radio]').filter({ hasText: 'Three' });
            await threeRadio.click();

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Two');
        });
    });
});

test.describe('KeyValueList Attribute (Chip)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "Three" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListChip');

            const span = component.locator('span');
            await expect(span).toHaveText('Three');
        });
    });

    test.describe('Edit mode', () => {
        test('displays chip buttons after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListChip');

            await beginEdit(sharedPage, component);

            const chips = component.locator('vi-button[part="chip"]');
            await expect(chips).toHaveCount(6); // empty option + One through Five
        });

        test('displays selected chip as not inverse', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListChip');

            await beginEdit(sharedPage, component);

            const threeChip = component.locator('vi-button[part="chip"]').filter({ hasText: 'Three' });
            await expect(threeChip).not.toHaveAttribute('inverse');
        });

        test('displays unselected chips as inverse', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListChip');

            await beginEdit(sharedPage, component);

            const oneChip = component.locator('vi-button[part="chip"]').filter({ hasText: 'One' });
            await expect(oneChip).toHaveAttribute('inverse');
        });

        test('selects option by clicking chip button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListChip');

            await beginEdit(sharedPage, component);

            const fourChip = component.locator('vi-button[part="chip"]').filter({ hasText: 'Four' });
            await fourChip.click();

            // Verify Four is now not inverse (selected)
            await expect(fourChip).not.toHaveAttribute('inverse');
        });

        test('applies vertical orientation by default', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListChip');

            await beginEdit(sharedPage, component);

            const chipContainer = component.locator('#chips');
            await expect(chipContainer).toHaveAttribute('orientation', 'vertical');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListChip');

            await beginEdit(sharedPage, component);

            const fiveChip = component.locator('vi-button[part="chip"]').filter({ hasText: 'Five' });
            await fiveChip.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('5'); // Key is saved
            const span = component.locator('span');
            await expect(span).toHaveText('Five');
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListChip');

            await beginEdit(sharedPage, component);

            const twoChip = component.locator('vi-button[part="chip"]').filter({ hasText: 'Two' });
            await twoChip.click();

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Three');
        });
    });
});

test.describe('KeyValueList Attribute (ReadOnly)', () => {
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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListReadOnly');

            const span = component.locator('span');
            await expect(span).toHaveText('Four');
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly vi-select', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListReadOnly');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();
            await expect(select).toHaveAttribute('readonly');
        });

        test('displays readonly input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListReadOnly');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const input = select.locator('input');
            await expect(input).toHaveAttribute('readonly');
        });
    });
});

test.describe('KeyValueList Attribute (Required)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "One" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRequired');

            const span = component.locator('span');
            await expect(span).toHaveText('One');
        });
    });

    test.describe('Edit mode', () => {
        test('displays vi-select with initial value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRequired');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            const input = select.locator('input');
            await expect(input).toHaveValue('One');
        });

        test('does not display clear button when required', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRequired');

            await beginEdit(sharedPage, component);

            // Should NOT have clear button since attribute is required
            const clearButton = component.locator('vi-button').filter({ has: sharedPage.locator('vi-icon[source="Remove"]') });
            await expect(clearButton).toHaveCount(0);
        });

        test('can select value from options', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRequired');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select One
            const one = select.locator('vi-select-option-item').filter({ hasText: 'One' });
            await one.click();

            const input = select.locator('input');
            await expect(input).toHaveValue('One');
        });

        test('displays all options in dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRequired');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            const options = select.locator('vi-select-option-item');
            await expect(options).toHaveCount(5); // One through Five
        });
    });
});

test.describe('KeyValueList Attribute (Frozen)', () => {
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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            await expect(select).not.toHaveAttribute('disabled');

            await freeze(sharedPage, component);

            await expect(select).toHaveAttribute('disabled');
        });

        test('vi-select becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueList');

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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRadio');

            await beginEdit(sharedPage, component);

            await freeze(sharedPage, component);

            const radioButtons = component.locator('vi-checkbox[radio]');
            const count = await radioButtons.count();

            for (let i = 0; i < count; i++) {
                await expect(radioButtons.nth(i)).toHaveAttribute('disabled');
            }
        });

        test('radio buttons become enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRadio');

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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListChip');

            await beginEdit(sharedPage, component);

            await freeze(sharedPage, component);

            const chips = component.locator('vi-button[part="chip"]');
            const count = await chips.count();

            for (let i = 0; i < count; i++) {
                await expect(chips.nth(i)).toHaveAttribute('disabled');
            }
        });

        test('chip buttons become enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListChip');

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

test.describe('KeyValueList Attribute (Horizontal orientation)', () => {
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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListRadioHorizontal');

            await beginEdit(sharedPage, component);

            const radioContainer = component.locator('#radiobuttons');
            await expect(radioContainer).toHaveAttribute('orientation', 'horizontal');
        });
    });

    test.describe('Edit mode (Chip)', () => {
        test('applies horizontal orientation when specified', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-key-value-list', 'KeyValueListChipHorizontal');

            await beginEdit(sharedPage, component);

            const chipContainer = component.locator('#chips');
            await expect(chipContainer).toHaveAttribute('orientation', 'horizontal');
        });
    });
});

}); // End of KeyValueList Attribute Tests wrapper
