import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../../_helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../_helpers/attribute';
import { startBackend, stopBackend, BackendProcess } from '../../_helpers/backend';

test.describe.serial('FlagsEnum Attribute', () => {
    let sharedBackend: BackendProcess;
    let sharedPage: Page;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage, '', sharedBackend.port);
    });

    test.afterAll(async () => {
        await sharedPage?.close();
        await stopBackend(sharedBackend);
    });

test.describe('Default', () => {
    test.describe('Non-edit mode', () => {
        test('displays initial value "Email" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            const span = component.locator('span');
            await expect(span).toHaveText('Email');
        });

        test('does not render vi-popup element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            const popup = component.locator('vi-popup');
            await expect(popup).toBeHidden();
        });
    });

    test.describe('Edit mode', () => {
        test('displays vi-popup with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await expect(popup).toBeVisible();

            const span = popup.locator('[slot="header"] span');
            await expect(span).toHaveText('Email');
        });

        test('opens popup when clicking header', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            // Wait for popup to open (list becomes visible)
            const list = popup.locator('ul');
            await expect(list).toBeVisible();
        });

        test('displays all flag options as checkboxes', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            const checkboxes = component.locator('li vi-checkbox');
            // NotificationOptions has: None=0, Email=1, SMS=2, Push=4, InApp=8, WeeklyDigest=16, All=31
            await expect(checkboxes).toHaveCount(7);
        });

        test('displays initial flag as checked', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            const emailCheckbox = component.locator('li').filter({ hasText: 'Email' }).locator('vi-checkbox');
            await expect(emailCheckbox).toHaveAttribute('checked');
        });

        test('selects additional flag by clicking checkbox', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            // Click on SMS flag checkbox
            const smsCheckbox = component.locator('li').filter({ hasText: 'SMS' }).locator('vi-checkbox');
            await smsCheckbox.click();

            // Verify SMS is now checked
            await expect(smsCheckbox).toHaveAttribute('checked');

            // Verify the display value includes both flags
            const span = popup.locator('[slot="header"] span');
            await expect(span).toHaveText('Email, SMS');
        });

        test('deselects flag by clicking checked checkbox', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            // Email is initially checked, click to uncheck
            const emailCheckbox = component.locator('li').filter({ hasText: 'Email' }).locator('vi-checkbox');
            await emailCheckbox.click();

            // Verify Email is no longer checked
            await expect(emailCheckbox).not.toHaveAttribute('checked');

            // Verify None becomes the value
            const span = popup.locator('[slot="header"] span');
            await expect(span).toHaveText('None');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            // Select SMS flag in addition to Email
            const smsCheckbox = component.locator('li').filter({ hasText: 'SMS' }).locator('vi-checkbox');
            await smsCheckbox.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('Email, SMS');
            await expect(component.locator('vi-popup')).toBeHidden();
            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('Email, SMS');
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            // Select Push flag in addition to Email
            const pushCheckbox = component.locator('li').filter({ hasText: 'Push' }).locator('vi-checkbox');
            await pushCheckbox.click();

            await cancelEdit(sharedPage, component);

            await expect(component.locator('vi-popup')).toBeHidden();
            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('Email');
        });
    });
});

test.describe('Multiple Flags', () => {

    test.describe('Non-edit mode', () => {
        test('displays combined value "Email, SMS, Push" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnumMultiple');

            const span = component.locator('span');
            await expect(span).toHaveText('Email, SMS, Push');
        });
    });

    test.describe('Edit mode', () => {
        test('displays multiple flags as checked', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnumMultiple');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            const emailCheckbox = component.locator('li').filter({ hasText: 'Email' }).locator('vi-checkbox');
            const smsCheckbox = component.locator('li').filter({ hasText: 'SMS' }).locator('vi-checkbox');
            const pushCheckbox = component.locator('li').filter({ hasText: 'Push' }).locator('vi-checkbox');

            await expect(emailCheckbox).toHaveAttribute('checked');
            await expect(smsCheckbox).toHaveAttribute('checked');
            await expect(pushCheckbox).toHaveAttribute('checked');
        });

        test('deselecting one flag keeps others selected', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnumMultiple');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            // Deselect SMS flag
            const smsCheckbox = component.locator('li').filter({ hasText: 'SMS' }).locator('vi-checkbox');
            await smsCheckbox.click();

            // Verify the display value reflects the change
            const span = popup.locator('[slot="header"] span');
            await expect(span).toHaveText('Email, Push');

            // Verify Email and Push are still checked
            const emailCheckbox = component.locator('li').filter({ hasText: 'Email' }).locator('vi-checkbox');
            const pushCheckbox = component.locator('li').filter({ hasText: 'Push' }).locator('vi-checkbox');

            await expect(emailCheckbox).toHaveAttribute('checked');
            await expect(pushCheckbox).toHaveAttribute('checked');
        });
    });
});

test.describe('None', () => {

    test.describe('Non-edit mode', () => {
        test('displays "None" when no flags selected', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnumNone');

            const span = component.locator('span');
            await expect(span).toHaveText('None');
        });
    });

    test.describe('Edit mode', () => {
        test('displays None flag as checked when no flags selected', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnumNone');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            const noneCheckbox = component.locator('li').filter({ hasText: 'None' }).locator('vi-checkbox');
            await expect(noneCheckbox).toHaveAttribute('checked');
        });

        test('selecting a flag unchecks None', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnumNone');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            // Select Email flag
            const emailCheckbox = component.locator('li').filter({ hasText: 'Email' }).locator('vi-checkbox');
            await emailCheckbox.click();

            // Verify None is no longer checked
            const noneCheckbox = component.locator('li').filter({ hasText: 'None' }).locator('vi-checkbox');
            await expect(noneCheckbox).not.toHaveAttribute('checked');

            // Verify the display value
            const span = popup.locator('[slot="header"] span');
            await expect(span).toHaveText('Email');
        });

        test('deselecting all flags checks None', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnumNone');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const header = popup.locator('[slot="header"]');
            await header.click();

            // Select Email flag first
            const emailCheckbox = component.locator('li').filter({ hasText: 'Email' }).locator('vi-checkbox');
            await emailCheckbox.click();

            // Verify value is Email
            let span = popup.locator('[slot="header"] span');
            await expect(span).toHaveText('Email');

            // Deselect Email flag
            await emailCheckbox.click();

            // Verify None is checked again
            const noneCheckbox = component.locator('li').filter({ hasText: 'None' }).locator('vi-checkbox');
            await expect(noneCheckbox).toHaveAttribute('checked');

            // Verify the display value
            span = popup.locator('[slot="header"] span');
            await expect(span).toHaveText('None');
        });
    });
});

test.describe('ReadOnly', () => {

    test.describe('Non-edit mode', () => {
        test('displays initial value in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnumReadOnly');

            const span = component.locator('span');
            await expect(span).toHaveText('InApp');
        });
    });

    test.describe('Edit mode', () => {
        test('displays disabled vi-popup', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnumReadOnly');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await expect(popup).toBeVisible();
            await expect(popup).toHaveAttribute('disabled');
        });

        test('displays value in header span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnumReadOnly');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            const span = popup.locator('[slot="header"] span');
            await expect(span).toHaveText('InApp');
        });
    });
});

test.describe('Frozen', () => {

    test.describe('Edit mode', () => {
        test('vi-popup becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await expect(popup).toBeVisible();

            await expect(popup).not.toHaveAttribute('disabled');

            await freeze(sharedPage, component);

            await expect(popup).toHaveAttribute('disabled');
        });

        test('vi-popup becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-flags-enum', 'FlagsEnum');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const popup = component.locator('vi-popup');
            await expect(popup).toHaveAttribute('disabled');

            await unfreeze(sharedPage, component);

            await expect(popup).not.toHaveAttribute('disabled');
        });
    });
});

}); // End of FlagsEnum Attribute wrapper
