import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze, isDirty } from '../helpers/persistent-object';
import { startBackend, stopBackend, BackendProcess } from '../helpers/backend';

test.describe.serial('Numeric Attribute Tests', () => {
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

test.describe('Int32 Attribute', () => {
    test.describe('Non-edit mode', () => {
        test('displays initial value "-2147483648" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('-2147483648');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            const input = component.locator('input');
            await expect(input).not.toBeVisible();
        });

        test('does not mark object as dirty on component initialization', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            // Wait for component to render
            const span = component.locator('vi-sensitive > span');
            await expect(span).toBeVisible();

            // Object should not be dirty after just setting up the component
            expect(await isDirty(sharedPage, component)).toBe(false);
        });

        test('does not mark object as dirty when backend opens in edit mode (StateBehavior.OpenInEdit)', async () => {
            // Use backend's OpenInEdit - let it open in edit mode naturally
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32', { useBackendOpenInEdit: true });

            // Wait for input to be visible (object is in edit mode from backend)
            const input = component.locator('input');
            await expect(input).toBeVisible();

            // Object should not be dirty - backend opened it in edit mode but we haven't changed anything
            expect(await isDirty(sharedPage, component)).toBe(false);
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('-2147483648');
        });

        test('updates value when typing valid number', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('12345');

            await expect(input).toHaveValue('12345');
        });

        test('accepts negative numbers', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('-54321');

            await expect(input).toHaveValue('-54321');
        });

        test('accepts zero', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('0');

            await expect(input).toHaveValue('0');
        });

        test('rejects values exceeding maximum Int32 (2147483647)', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('2147483648');

            // Value should revert or not be accepted
            await expect(input).not.toHaveValue('2147483648');
        });

        test('rejects values below minimum Int32 (-2147483648)', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('-2147483649');

            // Value should revert or not be accepted
            await expect(input).not.toHaveValue('-2147483649');
        });

        test('does not mark object as dirty when entering edit mode without changes', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            // Verify object is not dirty initially
            expect(await isDirty(sharedPage, component)).toBe(false);

            await beginEdit(sharedPage, component);

            // Wait for input to be visible (edit mode is active)
            const input = component.locator('input');
            await expect(input).toBeVisible();

            // Object should still not be dirty - we haven't changed anything
            expect(await isDirty(sharedPage, component)).toBe(false);
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('999888');

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe(999888);

            // Wait for component to exit edit mode
            await expect(component.locator('input')).not.toBeVisible();

            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('999888');
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('777666');

            await cancelEdit(sharedPage, component);

            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('-2147483648');
            await expect(component.locator('input')).not.toBeVisible();
        });
    });
});

test.describe('Decimal Attribute', () => {



    test.describe('Non-edit mode', () => {
        test('displays initial value "1234567890123.456789" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('1234567890123.456789');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            const input = component.locator('input');
            await expect(input).not.toBeVisible();
        });

        test('does not mark object as dirty on component initialization', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            // Wait for component to render
            const span = component.locator('vi-sensitive > span');
            await expect(span).toBeVisible();

            // Object should not be dirty after just setting up the component
            expect(await isDirty(sharedPage, component)).toBe(false);
        });

        test('does not mark object as dirty when backend opens in edit mode (StateBehavior.OpenInEdit)', async () => {
            // Use backend's OpenInEdit - let it open in edit mode naturally
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal', { useBackendOpenInEdit: true });

            // Wait for input to be visible (object is in edit mode from backend)
            const input = component.locator('input');
            await expect(input).toBeVisible();

            // Object should not be dirty - backend opened it in edit mode but we haven't changed anything
            expect(await isDirty(sharedPage, component)).toBe(false);
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('1234567890123.456789');
        });

        test('accepts decimal values', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('123.45');

            await expect(input).toHaveValue('123.45');
        });

        test('accepts negative decimal values', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('-987.654');

            await expect(input).toHaveValue('-987.654');
        });

        test('accepts values with many decimal places', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('0.123456789');

            await expect(input).toHaveValue('0.123456789');
        });

        test('accepts whole numbers', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('12345');

            await expect(input).toHaveValue('12345');
        });

        test('allows typing trailing decimal separator while focused', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('153.');

            // While focused, trailing decimal separator should remain
            await expect(input).toHaveValue('153.');
            await expect(input).toBeFocused();

            // After blur, trailing separator should be removed
            await input.blur();
            await expect(input).toHaveValue('153');
        });

        test('preserves trailing zeros after decimal point while focused', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('150.10');

            // While focused, trailing zeros should remain
            await expect(input).toHaveValue('150.10');
            await expect(input).toBeFocused();

            // After blur, BigNumber normalization can remove trailing zeros
            await input.blur();
            await expect(input).toHaveValue('150.1');
        });

        test('allows typing just decimal separator after selecting all', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('123');

            // Select all text
            await input.press('Control+a');

            // Type decimal point to replace selected text
            await input.press('.');

            // While focused, should show just the decimal separator
            await expect(input).toHaveValue('.');
            await expect(input).toBeFocused();

            // Continue typing
            await input.press('1');
            await input.press('5');
            await expect(input).toHaveValue('.15');

            // After blur, should normalize to 0.15
            await input.blur();
            await expect(input).toHaveValue('0.15');
        });

        test('does not mark object as dirty when entering edit mode without changes', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            // Verify object is not dirty initially
            expect(await isDirty(sharedPage, component)).toBe(false);

            await beginEdit(sharedPage, component);

            // Wait for input to be visible (edit mode is active)
            const input = component.locator('input');
            await expect(input).toBeVisible();

            // Object should still not be dirty - we haven't changed anything
            expect(await isDirty(sharedPage, component)).toBe(false);
        });

        test('does not mark object as dirty when starting in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal', { startInEditMode: true });

            // Wait for input to be visible (edit mode is active from the start)
            const input = component.locator('input');
            await expect(input).toBeVisible();

            // Object should not be dirty - we just created it in edit mode and haven't changed anything
            expect(await isDirty(sharedPage, component)).toBe(false);
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new decimal value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('555.777');

            await save(sharedPage, component);

            // BigNumber object is returned for Decimal types - just verify the span shows correct value
            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('555.777');
            await expect(component.locator('input')).not.toBeVisible();
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('111.222');

            await cancelEdit(sharedPage, component);

            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('1234567890123.456789');
            await expect(component.locator('input')).not.toBeVisible();
        });
    });
});

test.describe('UInt64 Attribute', () => {



    test.describe('Non-edit mode', () => {
        test('displays initial value "1234567890123456789" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'UInt64');

            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('1234567890123456789');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'UInt64');

            const input = component.locator('input');
            await expect(input).not.toBeVisible();
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'UInt64');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('1234567890123456789');
        });

        test('accepts positive large integers', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'UInt64');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('9876543210');

            await expect(input).toHaveValue('9876543210');
        });

        test('rejects negative numbers for unsigned type', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'UInt64');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('-123');

            // Value should revert or not be accepted
            await expect(input).not.toHaveValue('-123');
        });

        test('accepts zero', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'UInt64');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('0');

            await expect(input).toHaveValue('0');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'UInt64');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('555666777888');

            await save(sharedPage, component);

            // BigNumber object is returned for large integer types - just verify the span shows correct value
            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('555666777888');
            await expect(component.locator('input')).not.toBeVisible();
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'UInt64');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('111222333444');

            await cancelEdit(sharedPage, component);

            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('1234567890123456789');
            await expect(component.locator('input')).not.toBeVisible();
        });
    });
});

test.describe('Byte Attribute', () => {



    test.describe('Non-edit mode', () => {
        test('displays initial value "128" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Byte');

            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('128');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Byte');

            const input = component.locator('input');
            await expect(input).not.toBeVisible();
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Byte');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('128');
        });

        test('accepts values within Byte range (0-255)', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Byte');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('200');

            await expect(input).toHaveValue('200');
        });

        test('rejects values exceeding maximum Byte (255)', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Byte');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('256');

            // Value should revert or not be accepted
            await expect(input).not.toHaveValue('256');
        });

        test('rejects negative numbers for unsigned Byte', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Byte');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('-1');

            // Value should revert or not be accepted
            await expect(input).not.toHaveValue('-1');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Byte');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('42');

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe(42);
            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('42');
            await expect(component.locator('input')).not.toBeVisible();
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Byte');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('100');

            await cancelEdit(sharedPage, component);

            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('128');
            await expect(component.locator('input')).not.toBeVisible();
        });
    });
});

test.describe('Int32 Attribute (ReadOnly)', () => {



    test.describe('Non-edit mode', () => {
        test('displays initial value "-2147483648" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32ReadOnly');

            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('-2147483648');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32ReadOnly');

            const input = component.locator('input');
            await expect(input).not.toBeVisible();
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly input when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32ReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toBeVisible();

            const readonly = await input.getAttribute('readonly');
            expect(readonly).not.toBeNull();
        });

        test('input shows correct value when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32ReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('-2147483648');
        });
    });
});

test.describe('Int32 Attribute (Required)', () => {



    test.describe('Non-edit mode', () => {
        test('displays initial value "0" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32Required');

            const span = component.locator('vi-sensitive > span');
            await expect(span).toHaveText('0');
        });

        test('has required attribute set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32Required');

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32Required');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('0');
        });

        test('required attribute is still present in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32Required');

            await beginEdit(sharedPage, component);

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });

        test('allows updating to non-zero value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32Required');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('123');

            await expect(input).toHaveValue('123');
        });
    });

    test.describe('Validation', () => {
        test('allows saving with valid numeric value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32Required');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('456');

            const savedValue = await save(sharedPage, component);
            expect(savedValue).toBe(456);
        });
    });
});

test.describe('Int32 Attribute (Frozen)', () => {



    test.describe('Edit mode', () => {
        test('input becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toBeVisible();

            let disabled = await input.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await input.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('input becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const input = component.locator('input');
            let disabled = await input.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await input.getAttribute('disabled');
            expect(disabled).toBeNull();
        });
    });
});

test.describe('Decimal Attribute with Unit Before (Currency)', () => {



    test.describe('Non-edit mode', () => {
        test('displays value with currency symbol', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'DecimalCurrency');

            const span = component.locator('vi-sensitive > span');
            // Verify currency symbol is present (full format depends on server-side formatting)
            await expect(span).toContainText('$');
        });
    });

    test.describe('Edit mode', () => {
        test('displays unit before input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'DecimalCurrency');

            await beginEdit(sharedPage, component);

            const unitBefore = component.locator('span.before');
            await expect(unitBefore).toBeVisible();
            await expect(unitBefore).toHaveText('$');
        });

        test('input displays value without unit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'DecimalCurrency');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('99.99');
        });

        test('updates value correctly with unit displayed', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'DecimalCurrency');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('150.75');

            await expect(input).toHaveValue('150.75');

            const unitBefore = component.locator('span.before');
            await expect(unitBefore).toHaveText('$');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with unit after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'DecimalCurrency');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('200.50');

            await save(sharedPage, component);

            // Verify currency symbol is displayed (value formatting depends on server config)
            const span = component.locator('vi-sensitive > span');
            await expect(span).toContainText('$');
        });
    });
});

test.describe('Decimal Attribute with Unit After (Weight)', () => {



    test.describe('Non-edit mode', () => {
        test('displays value with unit symbol', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'DecimalWeight');

            const span = component.locator('vi-sensitive > span');
            // Verify unit symbol is present (full format depends on server-side formatting)
            await expect(span).toContainText('kg');
        });
    });

    test.describe('Edit mode', () => {
        test('displays unit after input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'DecimalWeight');

            await beginEdit(sharedPage, component);

            const unitAfter = component.locator('span.after');
            await expect(unitAfter).toBeVisible();
            await expect(unitAfter).toHaveText('kg');
        });

        test('input displays value without unit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'DecimalWeight');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('75.5');
        });

        test('updates value correctly with unit displayed', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'DecimalWeight');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('82.3');

            await expect(input).toHaveValue('82.3');

            const unitAfter = component.locator('span.after');
            await expect(unitAfter).toHaveText('kg');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with unit after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'DecimalWeight');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('90');

            await save(sharedPage, component);

            // Verify unit symbol is displayed (value formatting depends on server config)
            const span = component.locator('vi-sensitive > span');
            await expect(span).toContainText('kg');
        });
    });
});

test.describe('Numeric Input Validation', () => {



    test.describe('Int32 - Invalid Input Rejection', () => {
        test('rejects non-numeric text input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('abc');

            // Should remain empty or revert
            const currentValue = await input.inputValue();
            expect(currentValue).not.toBe('abc');
        });

        test('rejects mixed alphanumeric input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('123abc456');

            const currentValue = await input.inputValue();
            expect(currentValue).not.toContain('abc');
        });

        test('rejects special characters except minus', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Int32');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('!@#$%');

            const currentValue = await input.inputValue();
            expect(currentValue).not.toMatch(/[!@#$%]/);
        });
    });

    test.describe('Decimal - Invalid Input Rejection', () => {
        test('rejects non-numeric text input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('xyz');

            const currentValue = await input.inputValue();
            expect(currentValue).not.toBe('xyz');
        });

        test('accepts only one decimal separator', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Decimal');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('123.45');

            // Try to add another decimal point
            await input.pressSequentially('.');

            const currentValue = await input.inputValue();
            const decimalCount = (currentValue.match(/\./g) || []).length;
            expect(decimalCount).toBeLessThanOrEqual(1);
        });
    });

    test.describe('UInt64 - Unsigned Type Validation', () => {
        test('prevents entering minus sign for unsigned type', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'UInt64');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('-');

            const currentValue = await input.inputValue();
            expect(currentValue).not.toContain('-');
        });

        test('rejects negative paste for unsigned type', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'UInt64');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();

            // Simulate pasting negative value
            await input.fill('-500');

            const currentValue = await input.inputValue();
            expect(currentValue).not.toBe('-500');
        });
    });

    test.describe('Byte - Range Validation', () => {
        test('prevents typing values character by character that would exceed max', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Byte');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();

            // Type 2, then 5, then 5 - should stop at 25 or prevent the third 5
            await input.pressSequentially('25');
            const intermediateValue = await input.inputValue();
            expect(parseInt(intermediateValue)).toBeLessThanOrEqual(255);

            // Try to add another 5 which would make 255 (valid) or prevent going to 256
            await input.pressSequentially('5');
            const finalValue = await input.inputValue();
            expect(parseInt(finalValue)).toBeLessThanOrEqual(255);
        });

        test('handles paste of out-of-range value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-numeric', 'Byte');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();

            // Try to paste 300 which exceeds Byte.MaxValue (255)
            await input.fill('300');

            const currentValue = await input.inputValue();
            expect(currentValue).not.toBe('300');
        });
    });
});

}); // End of Numeric Attribute Tests wrapper
