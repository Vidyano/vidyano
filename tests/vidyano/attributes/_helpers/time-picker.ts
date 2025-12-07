import { Page } from '@playwright/test';

/**
 * Opens the time picker and selects a specific time
 * @param page - The Playwright page
 * @param component - The date-time attribute component
 * @param hours - Hours to select (0-23)
 * @param minutes - Minutes to select (0-59, will be rounded to nearest 5-minute interval)
 */
export async function selectTimeFromPicker(
    page: Page,
    component: any,
    hours: number,
    minutes: number
): Promise<void> {
    // Round minutes to nearest 5-minute interval (time picker only shows 5-minute intervals)
    const roundedMinutes = Math.round(minutes / 5) * 5;

    // Locate the time picker within the component
    const timePicker = component.locator('#timepicker');

    // Click the popup to open the time picker
    const popup = timePicker.locator('#popup');
    await popup.click();

    // Wait for the clock face to be visible
    await timePicker.locator('#clockHost .face').waitFor({ state: 'visible' });

    // Click the hour item
    const hourItem = timePicker.locator(`.item[data-hours="${hours}"]`);
    await hourItem.click();

    // Wait for state to switch to minutes
    await page.waitForTimeout(100);

    // Click the minute item
    const minuteItem = timePicker.locator(`.item[data-minutes="${roundedMinutes}"]`);
    await minuteItem.click();

    // Wait for the popup to close
    await page.waitForTimeout(100);
}
