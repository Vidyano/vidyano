import { Page } from '@playwright/test';

/**
 * Opens the date picker and selects a specific date
 * @param page - The Playwright page
 * @param component - The date-time attribute component
 * @param day - Day to select (1-31)
 * @remarks Currently assumes the target date is in the currently displayed month.
 *          Future enhancement: Navigate to correct year/month before selecting day.
 */
export async function selectDateFromPicker(
    page: Page,
    component: any,
    day: number
): Promise<void> {
    // Locate the date picker within the component
    const datePicker = component.locator('#datepicker');

    // Click the popup to open the date picker
    const popup = datePicker.locator('#popup');
    await popup.click();

    // Wait for the calendar to be visible
    await datePicker.locator('.calendar .main').waitFor({ state: 'visible' });

    // Find and click the cell for the target day
    const cells = datePicker.locator('.cell[type="day"]');
    const cellCount = await cells.count();

    let clicked = false;
    for (let i = 0; i < cellCount; i++) {
        const cell = cells.nth(i);
        const cellText = await cell.textContent();

        // Check if this cell matches our target day
        if (cellText?.trim() === day.toString()) {
            // Additional check: make sure it's not blocked and not from another month
            const isBlocked = await cell.evaluate((el: Element) => el.hasAttribute('blocked'));
            const isOther = await cell.evaluate((el: Element) => el.hasAttribute('is-other'));

            if (!isBlocked && !isOther) {
                await cell.click();
                clicked = true;
                break;
            }
        }
    }

    if (!clicked)
        throw new Error(`Could not find day ${day} in the date picker`);

    // Wait for the popup to close (the picker may auto-close after selection)
    await page.waitForTimeout(100);
}
