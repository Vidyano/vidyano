import { test, expect, Page } from '@playwright/test';
import { getTestHtml } from '../_helpers/page';

async function setupPage(page: Page) {
    await page.setContent(getTestHtml());
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-time-picker'), { timeout: 10000 });
}

async function createTimePicker(page: Page, hours?: number, minutes?: number) {
    const componentId = `component-${Math.random().toString(36).substring(2, 15)}`;

    await page.evaluate(({ componentId, hours, minutes }) => {
        const component = document.createElement('vi-time-picker') as any;
        component.id = componentId;

        if (hours !== undefined) {
            const time = new Date();
            time.setHours(hours, minutes ?? 0, 0, 0);
            component.time = time;
        }

        (window as any).timeChanges = [];
        component.addEventListener('time-changed', (e: CustomEvent) => (window as any).timeChanges.push(e.detail.value ? [e.detail.value.getHours(), e.detail.value.getMinutes()] : null));

        document.getElementById('test-container')!.appendChild(component);
    }, { componentId, hours, minutes });

    const component = page.locator(`#${componentId}`);
    await component.locator('#popup').click();
    await component.locator('#clockHost .face').waitFor({ state: 'visible' });
    await page.evaluate(() => (window as any).timeChanges = []);

    return component;
}

test.describe('Time Picker', () => {
    test.beforeEach(async ({ page }) => {
        await setupPage(page);
    });

    test.describe('Clock hand', () => {
        test('points at an outer ring hour', async ({ page }) => {
            const component = await createTimePicker(page, 16, 25);

            const hand = component.locator('.hand');
            await expect(hand).toHaveAttribute('style', /rotate\(120deg\)/);
            await expect(hand).not.toHaveClass(/inner/);
        });

        test('points at an inner ring hour with a shorter hand', async ({ page }) => {
            const component = await createTimePicker(page, 9, 0);

            const hand = component.locator('.hand');
            await expect(hand).toHaveAttribute('style', /rotate\(270deg\)/);
            await expect(hand).toHaveClass(/inner/);
            await expect.poll(() => hand.evaluate(el => el.getBoundingClientRect().width + el.getBoundingClientRect().height)).toBeLessThan(70);

            await component.locator('#current .minutes').click();
            await expect.poll(() => hand.evaluate(el => el.getBoundingClientRect().width + el.getBoundingClientRect().height)).toBeGreaterThan(85);
        });

        test('points at the exact minutes, also between the 5-minute marks', async ({ page }) => {
            const component = await createTimePicker(page, 13, 56);

            await component.locator('#current .minutes').click();

            const hand = component.locator('.hand');
            await expect(hand).toHaveAttribute('style', /rotate\(336deg\)/);
            await expect(hand).not.toHaveClass(/inner/);
        });

        test('points at midnight without a time', async ({ page }) => {
            const component = await createTimePicker(page);

            const hand = component.locator('.hand');
            await expect(hand).toHaveAttribute('style', /rotate\(0deg\)/);
            await expect(hand).not.toHaveClass(/inner/);
        });

        test('follows the picked hour and minutes', async ({ page }) => {
            const component = await createTimePicker(page, 16, 25);
            const hand = component.locator('.hand');

            await component.locator('.item[data-hours="3"]').click();
            await expect(component).toHaveAttribute('state', 'minutes');
            await expect(hand).toHaveAttribute('style', /rotate\(150deg\)/);

            await component.locator('.item[data-minutes="40"]').click();
            await expect(hand).toHaveAttribute('style', /rotate\(240deg\)/);

            await component.locator('#current .hours').click();
            await expect(hand).toHaveAttribute('style', /rotate\(90deg\)/);
            await expect(hand).toHaveClass(/inner/);
        });
    });

    test.describe('Selection', () => {
        test('picking an hour and then minutes sets the time', async ({ page }) => {
            const component = await createTimePicker(page, 16, 25);

            await component.locator('.item[data-hours="9"]').click();
            await component.locator('.item[data-minutes="45"]').click();

            await expect(component.locator('#current .hours')).toHaveText('09');
            await expect(component.locator('#current .minutes')).toHaveText('45');
            expect(await page.evaluate(() => (window as any).timeChanges)).toEqual([[9, 25], [9, 45]]);
        });

        test('starts from midnight without a time', async ({ page }) => {
            const component = await createTimePicker(page);

            await component.locator('.item[data-hours="14"]').click();

            expect(await page.evaluate(() => (window as any).timeChanges)).toEqual([[14, 0]]);
        });
    });
});
