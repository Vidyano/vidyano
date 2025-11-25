import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';
import { selectDateFromPicker } from '../helpers/date-picker';
import { selectTimeFromPicker } from '../helpers/time-picker';

test.describe.serial('DateTime Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(sharedBackend);
    });

test.describe('DateTime Attribute', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial date and time value in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            const span = component.locator('vi-sensitive > span').first();
            await expect(span).toBeVisible();

            const text = await span.textContent();
            expect(text).toBeTruthy();
            expect(text).not.toBe('—');
        });

        test('does not render input elements', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            const dateInput = component.locator('vi-masked-input.date');
            await expect(dateInput).toHaveCount(0);

            const timeInput = component.locator('vi-masked-input.time');
            await expect(timeInput).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays date and time inputs after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date');
            await expect(dateInput).toBeVisible();

            const timeInput = component.locator('vi-masked-input.time');
            await expect(timeInput).toBeVisible();
        });

        test('date input has valid initial value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date');
            const dateValue = await dateInput.evaluate((el: any) => el.value);

            expect(dateValue).toBeTruthy();
            expect(dateValue).toMatch(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/);
        });

        test('time input displays placeholder or time value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            // Wait for the masked-input to be fully initialized
            await sharedPage.waitForTimeout(100);

            const timeInput = component.locator('vi-masked-input.time');
            const timeValue = await timeInput.evaluate((el: any) => el.value);

            // The time input should have either a valid time or placeholder
            expect(timeValue).toBeTruthy();
            expect(timeValue).toMatch(/(\d{1,2}:\d{2}|__:__)/);
        });

        test('can update date value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const dateInputElement = component.locator('vi-masked-input.date input');
            await dateInputElement.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('31122024', { delay: 50 });
            await dateInputElement.blur();

            const dateInput = component.locator('vi-masked-input.date');
            const dateValue = await dateInput.evaluate((el: any) => el.value);
            expect(dateValue).toContain('31');
            expect(dateValue).toContain('12');
            expect(dateValue).toContain('2024');
        });

        test('can update time value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const timeInputElement = component.locator('vi-masked-input.time input');
            await timeInputElement.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('1430', { delay: 50 });
            await timeInputElement.blur();

            const timeInput = component.locator('vi-masked-input.time');
            const timeValue = await timeInput.evaluate((el: any) => el.value);
            expect(timeValue).toBe('14:30');
        });

        test('displays date picker button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const datePicker = component.locator('vi-date-picker');
            await expect(datePicker).toBeVisible();
        });

        test('displays time picker button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const timePicker = component.locator('vi-time-picker');
            await expect(timePicker).toBeVisible();
        });

        test('marks time input as invalid when hours exceed 23', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const timeInputElement = component.locator('vi-masked-input.time input');
            await timeInputElement.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('9925', { delay: 50 });

            // Wait for the filled event to trigger validation
            await sharedPage.waitForTimeout(100);

            const timeInput = component.locator('vi-masked-input.time');
            const invalid = await timeInput.getAttribute('invalid');
            expect(invalid).not.toBeNull();
        });

        test('marks time input as invalid when minutes exceed 59', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const timeInputElement = component.locator('vi-masked-input.time input');
            await timeInputElement.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('1275', { delay: 50 });

            // Wait for the filled event to trigger validation
            await sharedPage.waitForTimeout(100);

            const timeInput = component.locator('vi-masked-input.time');
            const invalid = await timeInput.getAttribute('invalid');
            expect(invalid).not.toBeNull();
        });

        test('does not mark time input as invalid for valid time', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const timeInputElement = component.locator('vi-masked-input.time input');
            await timeInputElement.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('1430', { delay: 50 });

            // Wait for the filled event to trigger validation
            await sharedPage.waitForTimeout(100);

            const timeInput = component.locator('vi-masked-input.time');
            const invalid = await timeInput.getAttribute('invalid');
            expect(invalid).toBeNull();
        });

        test('maintains invalid state after toggling between valid and invalid times', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const timeInputElement = component.locator('vi-masked-input.time input');
            const timeInput = component.locator('vi-masked-input.time');

            // Start with valid time 11:25
            await timeInputElement.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('1125', { delay: 50 });
            await sharedPage.waitForTimeout(100);

            // Verify valid state
            let invalid = await timeInput.getAttribute('invalid');
            expect(invalid).toBeNull();

            // Change to invalid time by selecting first digit and typing 9 (91:25)
            await timeInputElement.click();
            await sharedPage.keyboard.press('Home'); // Go to start
            await sharedPage.keyboard.press('Shift+ArrowRight'); // Select first digit
            await sharedPage.keyboard.type('9', { delay: 50 });
            await sharedPage.waitForTimeout(100);

            // Verify invalid state
            invalid = await timeInput.getAttribute('invalid');
            expect(invalid).not.toBeNull();

            // Change back to valid time by selecting the 9 and typing 1 (11:25)
            await timeInputElement.click();
            await sharedPage.keyboard.press('Home');
            await sharedPage.keyboard.press('Shift+ArrowRight');
            await sharedPage.keyboard.type('1', { delay: 50 });
            await sharedPage.waitForTimeout(200); // Wait for setValue to complete

            // Verify valid state again
            invalid = await timeInput.getAttribute('invalid');
            expect(invalid).toBeNull();

            // Change to invalid time again (91:25) - this should still show invalid
            // even after server response from previous setValue arrives
            await timeInputElement.click();
            await sharedPage.keyboard.press('Home');
            await sharedPage.keyboard.press('Shift+ArrowRight');
            await sharedPage.keyboard.type('9', { delay: 50 });
            await sharedPage.waitForTimeout(300); // Wait long enough for any pending server response

            // This is the critical check - invalid should still be set
            invalid = await timeInput.getAttribute('invalid');
            expect(invalid).not.toBeNull();
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            const initialSpan = component.locator('vi-sensitive > span').first();
            const initialText = await initialSpan.textContent();

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date input');
            await dateInput.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('25122024', { delay: 50 });
            await dateInput.blur();

            const timeInput = component.locator('vi-masked-input.time input');
            await timeInput.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('1545', { delay: 50 });
            await timeInput.blur();

            await sharedPage.waitForTimeout(200);

            const savedValue = await save(sharedPage, component);
            expect(savedValue).not.toBeNull();

            const span = component.locator('vi-sensitive > span').first();
            const text = await span.textContent();

            expect(text).not.toBe(initialText);
            expect(text).toContain('25');
            expect(text).toContain('12');
            expect(text).toContain('2024');
            expect(text).toContain('15');
            expect(text).toContain('45');
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            const initialSpan = component.locator('vi-sensitive > span').first();
            const initialText = await initialSpan.textContent();

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date input');
            await dateInput.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('01012025', { delay: 50 });
            await dateInput.blur();

            await cancelEdit(sharedPage, component);

            const span = component.locator('vi-sensitive > span').first();
            const text = await span.textContent();

            expect(text).toBe(initialText);
        });
    });
});

test.describe('NullableDateTime Attribute', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.afterEach(async () => {
        // Ensure any pending operations complete
        await sharedPage.waitForTimeout(100);

        // Clear the test container and attribute map to prevent state accumulation
        await sharedPage.evaluate(() => {
            const container = document.getElementById('test-container');
            if (container)
                container.innerHTML = '';

            // Clear the attribute map to remove stale references
            if ((window as any).attributeMap)
                (window as any).attributeMap = {};
        });
    });

    test.describe('Non-edit mode', () => {
        test('displays empty dash for null value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'NullableDateTime');

            const span = component.locator('vi-sensitive > span').first();
            await expect(span).toHaveText('—');
        });
    });

    test.describe('Edit mode', () => {
        test('displays date and time inputs with placeholders for null value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'NullableDateTime');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date');
            await expect(dateInput).toBeVisible();

            const timeInput = component.locator('vi-masked-input.time');
            await expect(timeInput).toBeVisible();
        });

        test('can set date and time from null', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'NullableDateTime');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date input');
            await dateInput.click();
            await sharedPage.keyboard.type('15062024', { delay: 50 });

            const timeInput = component.locator('vi-masked-input.time input');
            await timeInput.click();
            await sharedPage.keyboard.type('1030', { delay: 50 });

            await sharedPage.waitForTimeout(200);

            const savedValue = await save(sharedPage, component);
            expect(savedValue).not.toBeNull();
        });

        test('displays clear button when value is set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'NullableDateTime');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date input');
            await dateInput.click();
            await sharedPage.keyboard.type('15062024', { delay: 50 });

            const timeInput = component.locator('vi-masked-input.time input');
            await timeInput.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('1030', { delay: 50 });

            await sharedPage.waitForTimeout(200);

            await save(sharedPage, component);

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('vi-button:has(vi-icon[source="Remove"])');
            await expect(clearButton).toBeVisible();
        });

        test('can clear value using clear button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'NullableDateTime');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date input');
            await dateInput.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('15062024', { delay: 50 });

            const timeInput = component.locator('vi-masked-input.time input');
            await timeInput.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('1030', { delay: 50 });

            await sharedPage.waitForTimeout(200);

            await save(sharedPage, component);

            await sharedPage.waitForTimeout(200);

            await beginEdit(sharedPage, component);

            await sharedPage.waitForTimeout(100);

            const clearButton = component.locator('vi-button:has(vi-icon[source="Remove"])');
            await expect(clearButton).toBeVisible({ timeout: 10000 });
            await clearButton.click();

            await save(sharedPage, component);

            const span = component.locator('vi-sensitive > span').first();
            await expect(span).toHaveText('—');
        });
    });
});

test.describe('DateTime Attribute (ReadOnly)', () => {
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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeReadOnly');

            const span = component.locator('vi-sensitive > span').first();
            await expect(span).toBeVisible();

            const text = await span.textContent();
            expect(text).toBeTruthy();
            expect(text).not.toBe('—');
        });
    });

    test.describe('Edit mode', () => {
        test('displays disabled date input when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeReadOnly');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date');
            await expect(dateInput).toBeVisible();

            const disabled = await dateInput.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('displays disabled time input when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeReadOnly');

            await beginEdit(sharedPage, component);

            const timeInput = component.locator('vi-masked-input.time');
            await expect(timeInput).toBeVisible();

            const disabled = await timeInput.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('does not display date picker when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeReadOnly');

            await beginEdit(sharedPage, component);

            const datePicker = component.locator('vi-date-picker');
            await expect(datePicker).toHaveCount(0);
        });

        test('does not display time picker when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeReadOnly');

            await beginEdit(sharedPage, component);

            const timePicker = component.locator('vi-time-picker');
            await expect(timePicker).toHaveCount(0);
        });
    });
});

test.describe('DateTime Attribute (Required)', () => {
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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeRequired');

            const span = component.locator('vi-sensitive > span').first();
            await expect(span).toBeVisible();

            const text = await span.textContent();
            expect(text).toBeTruthy();
        });

        test('has required attribute set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeRequired');

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });
    });

    test.describe('Edit mode', () => {
        test('displays date and time inputs after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeRequired');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date');
            await expect(dateInput).toBeVisible();

            const timeInput = component.locator('vi-masked-input.time');
            await expect(timeInput).toBeVisible();
        });

        test('required attribute is present in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeRequired');

            await beginEdit(sharedPage, component);

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });

        test('does not display clear button when required', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeRequired');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('vi-button:has(vi-icon[source="Remove"])');
            await expect(clearButton).toHaveCount(0);
        });
    });

    test.describe('Validation', () => {
        test('can save with valid date and time', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeRequired');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date input');
            await dateInput.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('04072024', { delay: 50 });

            const timeInput = component.locator('vi-masked-input.time input');
            await timeInput.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('0900', { delay: 50 });

            await sharedPage.waitForTimeout(200);

            const savedValue = await save(sharedPage, component);
            expect(savedValue).not.toBeNull();
        });
    });
});

test.describe('DateTime Attribute (Frozen)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('date input becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const innerInput = component.locator('vi-masked-input.date input');
            await expect(innerInput).toBeVisible();
            await expect(innerInput).toBeEnabled();

            await freeze(sharedPage, component);

            await expect(innerInput).toBeDisabled({ timeout: 5000 });
        });

        test('time input becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);

            const innerInput = component.locator('vi-masked-input.time input');
            await expect(innerInput).toBeVisible();

            await expect(innerInput).toBeEnabled();

            await freeze(sharedPage, component);

            await expect(innerInput).toBeDisabled();
        });

        test('date input becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const innerInput = component.locator('vi-masked-input.date input');
            await expect(innerInput).toBeDisabled();

            await unfreeze(sharedPage, component);

            await expect(innerInput).toBeEnabled();
        });

        test('time input becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const innerInput = component.locator('vi-masked-input.time input');
            await expect(innerInput).toBeDisabled();

            await unfreeze(sharedPage, component);

            await expect(innerInput).toBeEnabled();
        });
    });

    test.describe('Picker Interactions', () => {
        test.describe('Date Picker', () => {
            test('date picker button is visible in edit mode', async () => {
                const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

                await beginEdit(sharedPage, component);

                const datePicker = component.locator('#datepicker');
                await expect(datePicker).toBeVisible();
            });

            test('can select date using date picker', async () => {
                const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

                await beginEdit(sharedPage, component);

                // Use the picker to select day 15 (should be in current month)
                await selectDateFromPicker(sharedPage, component, 15);

                // Verify the date input was updated
                const dateInput = component.locator('vi-masked-input.date');
                const newValue = await dateInput.evaluate((el: any) => el.value);
                expect(newValue).toContain('15');
            });

            test('date picker selection updates attribute value after save', async () => {
                const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

                await beginEdit(sharedPage, component);

                // Select day 20 using the picker
                await selectDateFromPicker(sharedPage, component, 20);

                // Save the value
                const savedValue = await save(sharedPage, component);

                // Verify the saved value contains the selected day
                expect(savedValue).toBeTruthy();
                // The saved value is a Date object, check it's valid
                expect(savedValue).toBeInstanceOf(Date);
            });
        });

        test.describe('Time Picker', () => {
            test('time picker button is visible in edit mode', async () => {
                const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

                await beginEdit(sharedPage, component);

                const timePicker = component.locator('#timepicker');
                await expect(timePicker).toBeVisible();
            });

            test('can select time using time picker', async () => {
                const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

                await beginEdit(sharedPage, component);

                // Use the picker to select 14:30
                await selectTimeFromPicker(sharedPage, component, 14, 30);

                // Verify the time input was updated
                const timeInput = component.locator('vi-masked-input.time');
                const timeValue = await timeInput.evaluate((el: any) => el.value);
                expect(timeValue).toContain('14');
                expect(timeValue).toContain('30');
            });

            test('time picker selection updates attribute value after save', async () => {
                const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

                await beginEdit(sharedPage, component);

                // Select time 09:45 using the picker
                await selectTimeFromPicker(sharedPage, component, 9, 45);

                // Save the value
                const savedValue = await save(sharedPage, component);

                // Verify the saved value is a valid Date
                expect(savedValue).toBeTruthy();
                expect(savedValue).toBeInstanceOf(Date);

                // Verify the time is correct
                expect(savedValue.getHours()).toBe(9);
                expect(savedValue.getMinutes()).toBe(45);
            });
        });

        test.describe('Combined Picker Usage', () => {
            test('can set both date and time using pickers', async () => {
                const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

                await beginEdit(sharedPage, component);

                // Select day 25 using date picker
                await selectDateFromPicker(sharedPage, component, 25);

                // Select time 16:15 using time picker
                await selectTimeFromPicker(sharedPage, component, 16, 15);

                // Verify both inputs were updated
                const dateInput = component.locator('vi-masked-input.date');
                const timeInput = component.locator('vi-masked-input.time');

                const dateValue = await dateInput.evaluate((el: any) => el.value);
                const timeValue = await timeInput.evaluate((el: any) => el.value);

                expect(dateValue).toContain('25');
                expect(timeValue).toContain('16');
                expect(timeValue).toContain('15');

                // Save and verify
                const savedValue = await save(sharedPage, component);
                expect(savedValue).toBeInstanceOf(Date);
                expect(savedValue.getDate()).toBe(25);
                expect(savedValue.getHours()).toBe(16);
                expect(savedValue.getMinutes()).toBe(15);
            });

            test('picker selection works after manual input', async () => {
                const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

                await beginEdit(sharedPage, component);

                const dateInputElement = component.locator('vi-masked-input.date input');
                await dateInputElement.click();
                await sharedPage.keyboard.press('Control+A');
                await sharedPage.keyboard.type('10062024', { delay: 50 });
                await dateInputElement.blur();

                await sharedPage.waitForTimeout(200);
                const dateInput = component.locator('vi-masked-input.date');
                const initialDateValue = await dateInput.evaluate((el: any) => el.value);

                if (!initialDateValue.includes('10') || !initialDateValue.includes('06'))
                    throw new Error(`Date was not set correctly. Expected to contain 10 and 06, got: ${initialDateValue}`);

                await selectTimeFromPicker(sharedPage, component, 11, 30);

                const dateValue = await dateInput.evaluate((el: any) => el.value);
                const timeInput = component.locator('vi-masked-input.time');
                const timeValue = await timeInput.evaluate((el: any) => el.value);

                expect(dateValue).toContain('10');
                expect(dateValue).toContain('06');
                expect(timeValue).toContain('11');
                expect(timeValue).toContain('30');
            });

            test('manual input works after picker selection', async () => {
                const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTime');

                await beginEdit(sharedPage, component);

                await selectDateFromPicker(sharedPage, component, 18);

                const timeInputElement = component.locator('vi-masked-input.time input');
                await timeInputElement.click();
                await sharedPage.keyboard.press('Control+A');
                await sharedPage.keyboard.type('2245', { delay: 50 });
                await sharedPage.waitForTimeout(100);

                const dateInput = component.locator('vi-masked-input.date');
                const dateValue = await dateInput.evaluate((el: any) => el.value);
                const timeInput = component.locator('vi-masked-input.time');
                const timeValue = await timeInput.evaluate((el: any) => el.value);

                expect(dateValue).toContain('18');
                expect(timeValue).toContain('22');
                expect(timeValue).toContain('45');
            });
        });
    });
});

test.describe('Date Attribute (Date-only)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial date value in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'Date');

            const span = component.locator('vi-sensitive > span').first();
            await expect(span).toBeVisible();

            const text = await span.textContent();
            expect(text).toBeTruthy();
            expect(text).not.toBe('—');
        });
    });

    test.describe('Edit mode', () => {
        test('displays only date input (no time input)', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'Date');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date');
            await expect(dateInput).toBeVisible();

            const timeInput = component.locator('vi-masked-input.time');
            await expect(timeInput).toHaveCount(0);
        });

        test('can update date value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'Date');

            await beginEdit(sharedPage, component);

            const dateInputElement = component.locator('vi-masked-input.date input');
            await dateInputElement.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('15062024', { delay: 50 });
            await dateInputElement.blur();

            const dateInput = component.locator('vi-masked-input.date');
            const dateValue = await dateInput.evaluate((el: any) => el.value);
            expect(dateValue).toContain('15');
            expect(dateValue).toContain('06');
            expect(dateValue).toContain('2024');
        });

        test('displays date picker but no time picker', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'Date');

            await beginEdit(sharedPage, component);

            const datePicker = component.locator('vi-date-picker');
            await expect(datePicker).toBeVisible();

            const timePicker = component.locator('vi-time-picker');
            await expect(timePicker).toHaveCount(0);
        });
    });
});

test.describe('NullableDate Attribute', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays empty dash for null value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'NullableDate');

            const span = component.locator('vi-sensitive > span').first();
            await expect(span).toHaveText('—');
        });
    });

    test.describe('Edit mode', () => {
        test('can set date from null', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'NullableDate');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date input');
            await dateInput.click();
            await sharedPage.keyboard.type('20072024', { delay: 50 });

            await sharedPage.waitForTimeout(200);

            const savedValue = await save(sharedPage, component);
            expect(savedValue).not.toBeNull();
        });
    });
});

test.describe('DateTime Attribute (Month Mode)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays value in friendly month format', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'Month');

            const span = component.locator('vi-sensitive > span').first();
            await expect(span).toBeVisible();

            const text = await span.textContent();
            expect(text).toBeTruthy();
            // Month mode displays friendly format like "January 2024" (from server's {0:y} format)
            expect(text).toMatch(/[A-Za-z]+ \d{4}/);
        });
    });

    test.describe('Edit mode', () => {
        test('does not display date or time masked inputs in month mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'Month');

            await beginEdit(sharedPage, component);

            const dateInput = component.locator('vi-masked-input.date');
            await expect(dateInput).toHaveCount(0);

            const timeInput = component.locator('vi-masked-input.time');
            await expect(timeInput).toHaveCount(0);
        });

        test('displays month navigation buttons', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'Month');

            await beginEdit(sharedPage, component);

            const prevButton = component.locator('vi-button:has(vi-icon[source="ChevronLeft"])');
            const nextButton = component.locator('vi-button:has(vi-icon[source="ChevronRight"])');

            await expect(prevButton).toBeVisible();
            await expect(nextButton).toBeVisible();
        });

        test('displays month mode span with value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'Month');

            await beginEdit(sharedPage, component);

            const monthModeSpan = component.locator('#monthMode');
            await expect(monthModeSpan).toBeVisible();
        });

        test('can navigate to previous month', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'Month');

            await beginEdit(sharedPage, component);

            const monthModeSpan = component.locator('#monthMode');
            const initialValue = await monthModeSpan.textContent();

            const prevButton = component.locator('vi-button:has(vi-icon[source="ChevronLeft"])');
            await prevButton.click();

            await sharedPage.waitForTimeout(200);

            const newValue = await monthModeSpan.textContent();
            expect(newValue).not.toBe(initialValue);
        });

        test('can navigate to next month', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'Month');

            await beginEdit(sharedPage, component);

            const monthModeSpan = component.locator('#monthMode');
            const initialValue = await monthModeSpan.textContent();

            const nextButton = component.locator('vi-button:has(vi-icon[source="ChevronRight"])');
            await nextButton.click();

            await sharedPage.waitForTimeout(200);

            const newValue = await monthModeSpan.textContent();
            expect(newValue).not.toBe(initialValue);
        });

        test('displays date picker with month mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'Month');

            await beginEdit(sharedPage, component);

            const datePicker = component.locator('vi-date-picker');
            await expect(datePicker).toBeVisible();

            const monthMode = await datePicker.getAttribute('month-mode');
            expect(monthMode).not.toBeNull();
        });
    });
});

test.describe('NullableMonth Attribute (Month Mode)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('does not display month navigation buttons when value is null', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'NullableMonth');

            await beginEdit(sharedPage, component);

            const prevButton = component.locator('vi-button:has(vi-icon[source="ChevronLeft"])');
            const nextButton = component.locator('vi-button:has(vi-icon[source="ChevronRight"])');

            await expect(prevButton).toHaveCount(0);
            await expect(nextButton).toHaveCount(0);
        });

        test('displays date picker even when value is null', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'NullableMonth');

            await beginEdit(sharedPage, component);

            const datePicker = component.locator('vi-date-picker');
            await expect(datePicker).toBeVisible();
        });
    });
});

test.describe('DateTime Attribute (Min/Max Date)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('date picker receives min and max date constraints', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeMinMax');

            await beginEdit(sharedPage, component);

            const datePicker = component.locator('vi-date-picker');
            await expect(datePicker).toBeVisible();
        });

        test('value within range is accepted', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeMinMax');

            await beginEdit(sharedPage, component);

            const dateInputElement = component.locator('vi-masked-input.date input');
            await dateInputElement.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('15062024', { delay: 50 });
            await dateInputElement.blur();

            await sharedPage.waitForTimeout(200);

            const isInvalid = await component.getAttribute('is-invalid');
            expect(isInvalid).toBeNull();
        });

        test('value before min date marks component as invalid', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeMinMax');

            await beginEdit(sharedPage, component);

            const dateInputElement = component.locator('vi-masked-input.date input');
            await dateInputElement.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('15122023', { delay: 50 });
            await dateInputElement.blur();

            await sharedPage.waitForTimeout(200);

            const isInvalid = await component.getAttribute('is-invalid');
            expect(isInvalid).not.toBeNull();
        });

        test('value after max date marks component as invalid', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-date-time', 'DateTimeMinMax');

            await beginEdit(sharedPage, component);

            const dateInputElement = component.locator('vi-masked-input.date input');
            await dateInputElement.click();
            await sharedPage.keyboard.press('Control+A');
            await sharedPage.keyboard.type('15012025', { delay: 50 });
            await dateInputElement.blur();

            await sharedPage.waitForTimeout(200);

            const isInvalid = await component.getAttribute('is-invalid');
            expect(isInvalid).not.toBeNull();
        });
    });
});

}); // End of DateTime Attribute Tests wrapper
