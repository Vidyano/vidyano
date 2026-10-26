import { test, expect, Page } from '@playwright/test';

const viewport = { width: 800, height: 600 };

async function setupPlacementPage(page: Page, options: { top: number; left: number; placement?: string; content: string }) {
    await page.setViewportSize(viewport);
    // Load the bundle first: elements on the page would otherwise upgrade before it registers the flex layout style module
    await page.addScriptTag({ path: 'dev/wwwroot/index.js', type: 'module' });
    await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              :not(:defined) { display: none; }
              body { margin: 0; }
              #test-container { position: absolute; top: ${options.top}px; left: ${options.left}px; }
              #toggle { width: 100px; height: 30px; }
            </style>
          </head>
          <body>
            <div id="test-container">
              <vi-popup id="menu" placement="${options.placement ?? 'bottom-start'}">
                <div slot="header" id="toggle">Open</div>
                ${options.content}
              </vi-popup>
            </div>
          </body>
        </html>
    `);
    await page.waitForFunction(() => !!customElements.get('vi-popup'), { timeout: 10000 });
}

/**
 * Opens the popup and waits until refit stops moving or resizing it, then measures it.
 */
async function openPopup(page: Page) {
    await page.locator('#toggle').click();
    await expect(page.locator('vi-popup#menu')).toHaveAttribute('open', '');

    return page.evaluate(async () => {
        const host = document.getElementById('menu')!;
        const popup = host.shadowRoot!.getElementById('popup')!;
        const rect = (el: Element) => {
            const r = el.getBoundingClientRect();
            return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
        };
        const measure = () => ({
            toggle: rect(document.getElementById('toggle')!),
            popup: rect(popup),
            content: rect(document.getElementById('content')!),
            overflow: getComputedStyle(popup).overflow,
            scrollsX: popup.scrollWidth > popup.clientWidth,
            scrollsY: popup.scrollHeight > popup.clientHeight
        });

        let previous = '';
        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => requestAnimationFrame(resolve));
            const current = JSON.stringify(measure());
            if (current === previous)
                break;

            previous = current;
        }

        return measure();
    });
}

function expectInViewport(box: { top: number; bottom: number; left: number; right: number }) {
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(viewport.height);
    expect(box.right).toBeLessThanOrEqual(viewport.width);
}

test.describe('Popup placement', () => {
    test('opens below its anchor without a cap when the content fits', async ({ page }) => {
        await setupPlacementPage(page, { top: 20, left: 20, content: '<div id="content" style="width: 200px; height: 100px"></div>' });

        const m = await openPopup(page);
        expect(m.popup.top).toBeGreaterThanOrEqual(m.toggle.bottom);
        expect(m.overflow).toBe('visible');
        expect(m.scrollsY).toBe(false);
    });

    test('flips above its anchor when only the space above fits the content', async ({ page }) => {
        await setupPlacementPage(page, { top: 520, left: 20, content: '<div id="content" style="width: 200px; height: 300px"></div>' });

        const m = await openPopup(page);
        expect(m.popup.bottom).toBeLessThanOrEqual(m.toggle.top);
        expectInViewport(m.popup);
        expect(m.overflow).toBe('visible');
    });

    test('shifts sideways to stay inside the viewport', async ({ page }) => {
        await setupPlacementPage(page, { top: 20, left: 680, content: '<div id="content" style="width: 300px; height: 100px"></div>' });

        const m = await openPopup(page);
        expect(m.popup.top).toBeGreaterThanOrEqual(m.toggle.bottom);
        expectInViewport(m.popup);
        expect(m.overflow).toBe('visible');
    });

    test('shifts a popup placed to the side up instead of scrolling it', async ({ page }) => {
        // 450px fits neither below the anchor's top (right-start) nor above its bottom (right-end), only by shifting
        await setupPlacementPage(page, { top: 280, left: 20, placement: 'right-start', content: '<div id="content" style="width: 200px; height: 450px"></div>' });

        const m = await openPopup(page);
        expect(m.popup.left).toBeGreaterThanOrEqual(m.toggle.right);
        expectInViewport(m.popup);
        expect(m.overflow).toBe('visible');
    });

    test('scrolls only when the content fits on no side, without covering the anchor', async ({ page }) => {
        await setupPlacementPage(page, { top: 250, left: 20, content: '<div id="content" style="width: 200px; height: 1000px"></div>' });

        const m = await openPopup(page);
        expectInViewport(m.popup);
        expect(m.popup.top >= m.toggle.bottom || m.popup.bottom <= m.toggle.top).toBe(true);
        expect(m.overflow).toBe('auto');
        expect(m.scrollsY).toBe(true);
        expect(m.scrollsX).toBe(false);
    });

    test('scrolls content wider than the viewport', async ({ page }) => {
        await setupPlacementPage(page, { top: 20, left: 20, content: '<div id="content" style="width: 1000px; height: 100px"></div>' });

        const m = await openPopup(page);
        expectInViewport(m.popup);
        expect(m.overflow).toBe('auto');
        expect(m.scrollsX).toBe(true);
        expect(m.scrollsY).toBe(false);
    });

    test('drops the cap again once the content fits', async ({ page }) => {
        await setupPlacementPage(page, { top: 250, left: 20, content: '<div id="content" style="width: 200px; height: 1000px"></div>' });

        expect((await openPopup(page)).overflow).toBe('auto');

        await page.evaluate(() => document.getElementById('content')!.style.height = '100px');
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('menu')!.shadowRoot!.getElementById('popup')!).overflow)).toBe('visible');
    });

    test('keeps a stable cap on content that shrinks to the popup', async ({ page }) => {
        await setupPlacementPage(page, { top: 20, left: 20, content: '<div id="content" style="width: 1000px; max-width: 100%; height: 100px"></div>' });

        const m = await openPopup(page);
        expectInViewport(m.popup);
        expect(m.overflow).toBe('auto');

        const widths = await page.evaluate(async () => {
            const popup = document.getElementById('menu')!.shadowRoot!.getElementById('popup')!;
            const widths: number[] = [];
            for (let i = 0; i < 10; i++) {
                await new Promise(resolve => requestAnimationFrame(resolve));
                widths.push(popup.getBoundingClientRect().width);
            }

            return widths;
        });
        expect(new Set(widths).size).toBe(1);
    });

    test('lifts a previous cap on a vi-scroller when its full content fits elsewhere', async ({ page }) => {
        await setupPlacementPage(page, { top: 135, left: 20, content: '<vi-scroller id="content"><div style="width: 200px; height: 210px"></div></vi-scroller>' });

        // In a 300px high viewport 210px fits neither below nor above the anchor, so the scroller is capped to about 130px
        await page.setViewportSize({ width: viewport.width, height: 300 });
        const capped = await openPopup(page);
        expect(capped.content.bottom - capped.content.top).toBeLessThan(210);
        await page.evaluate(() => (document.getElementById('menu') as any).close());
        await expect(page.locator('vi-popup#menu')).not.toHaveAttribute('open');

        // Below the anchor 180px would still fit the capped scroller, but only above it the full 210px fit
        await page.setViewportSize(viewport);
        await page.evaluate(() => document.getElementById('test-container')!.style.top = '390px');
        const m = await openPopup(page);
        expect(m.content.bottom).toBeLessThanOrEqual(m.toggle.top);
        expect(m.content.bottom - m.content.top).toBe(210);
    });

    for (const [name, content] of [
        ['popup', '<div id="content" style="width: 200px; height: 1000px"></div>'],
        ['vi-scroller', '<vi-scroller id="content"><div style="width: 200px; height: 1000px"></div></vi-scroller>']
    ]) {
        test(`keeps the scroll position of a capped ${name} when it refits`, async ({ page }) => {
            await setupPlacementPage(page, { top: 250, left: 20, content });
            await openPopup(page);

            const scrollTop = await page.evaluate(async () => {
                const host = document.getElementById('menu') as any;
                const content = document.getElementById('content') as any;
                const scrolled: HTMLElement = content.scroller ?? host.shadowRoot.getElementById('popup');
                scrolled.scrollTop = 200;

                await host.refit();
                return scrolled.scrollTop;
            });
            expect(scrollTop).toBe(200);
        });
    }

    test('caps a single slotted vi-scroller instead of the popup', async ({ page }) => {
        await setupPlacementPage(page, { top: 250, left: 20, content: '<vi-scroller id="content"><div style="width: 200px; height: 1000px"></div></vi-scroller>' });

        const m = await openPopup(page);
        expectInViewport(m.content);
        expect(m.overflow).toBe('visible');
    });
});
