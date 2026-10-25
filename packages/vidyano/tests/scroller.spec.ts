import { test, expect, Page } from '@playwright/test';

const scrollerHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :root {
            --theme-h2: 32px;
            --theme-h4: 12px;
            --theme-h5: 6px;
          }
          :not(:defined) { display: none; }
          body { margin: 0; }
          vi-scroller { width: 200px; height: 200px; }
        </style>
      </head>
      <body>
        <div id="test-container"></div>
      </body>
    </html>
`;

async function setupPage(page: Page) {
    await page.setContent(scrollerHtml);
    await page.addScriptTag({ path: 'dev/wwwroot/index.js', type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-scroller'), { timeout: 10000 });
}

/** Mounts a 200x200 scroller around a content div of the given height, with the mouse already over it. */
async function mountScroller(page: Page, contentHeight: number, attributes: string = '') {
    await page.evaluate(({ contentHeight, attributes }) => {
        document.getElementById('test-container')!.innerHTML = `<vi-scroller ${attributes}><div id="content" style="width: 100px; height: ${contentHeight}px"></div></vi-scroller>`;
    }, { contentHeight, attributes });

    await page.mouse.move(100, 100);
    await settle(page);
}

async function settle(page: Page) {
    await page.evaluate(async () => {
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        await (document.querySelector('vi-scroller') as any).updateComplete;
    });
}

async function setContentHeight(page: Page, height: number) {
    await page.evaluate(height => document.getElementById('content')!.style.height = `${height}px`, height);
    await settle(page);
}

async function scrollToEnd(page: Page) {
    await page.evaluate(() => (document.querySelector('vi-scroller') as any).scroller.scrollTop = 1e6);
    await settle(page);
}

function getState(page: Page) {
    return page.evaluate(() => {
        const scroller = document.querySelector('vi-scroller') as any;
        return {
            innerHeight: scroller.innerHeight,
            scrollTop: scroller.scroller.scrollTop,
            verticalScrollOffset: scroller.verticalScrollOffset,
            vertical: scroller.vertical,
            atBottom: scroller.atBottom,
            scrollBottomShadow: scroller.scrollBottomShadow,
            thumbHeight: scroller.shadowRoot.querySelector('#vertical').offsetHeight
        };
    });
}

test.describe('Scroller', () => {
    for (const mode of [{ name: 'both directions', attributes: '' }, { name: 'no-horizontal', attributes: 'no-horizontal' }]) {
        test(`follows the content height as it shrinks and grows (${mode.name})`, async ({ page }) => {
            await setupPage(page);
            await mountScroller(page, 2000, mode.attributes);

            await setContentHeight(page, 500);
            expect(await getState(page)).toMatchObject({ innerHeight: 500, vertical: true, thumbHeight: 80, atBottom: false, scrollBottomShadow: true });

            await scrollToEnd(page);
            expect(await getState(page)).toMatchObject({ scrollTop: 300, verticalScrollOffset: 300, atBottom: true, scrollBottomShadow: false });

            await setContentHeight(page, 4000);
            expect(await getState(page)).toMatchObject({ innerHeight: 4000, thumbHeight: 40, scrollTop: 300, atBottom: false, scrollBottomShadow: true });

            await scrollToEnd(page);
            expect(await getState(page)).toMatchObject({ scrollTop: 3800, verticalScrollOffset: 3800, atBottom: true });

            await setContentHeight(page, 150);
            expect(await getState(page)).toMatchObject({ innerHeight: 200, scrollTop: 0, verticalScrollOffset: 0, vertical: false, atBottom: true, scrollBottomShadow: false });
        });
    }

    test('follows the content height when slotted elements are removed', async ({ page }) => {
        await setupPage(page);
        await page.evaluate(() => {
            document.getElementById('test-container')!.innerHTML = `<vi-scroller>${Array.from({ length: 20 }, () => '<div class="row" style="width: 100px; height: 50px"></div>').join('')}</vi-scroller>`;
        });
        await page.mouse.move(100, 100);
        await settle(page);
        expect((await getState(page)).innerHeight).toBe(1000);

        await page.evaluate(() => Array.from(document.querySelectorAll('.row')).slice(4).forEach(row => row.remove()));
        await settle(page);

        expect(await getState(page)).toMatchObject({ innerHeight: 200, vertical: false, atBottom: true, scrollBottomShadow: false });
    });

    test('follows the content height inside a slotted display: contents wrapper', async ({ page }) => {
        await setupPage(page);
        await page.evaluate(() => {
            document.getElementById('test-container')!.innerHTML = `<vi-scroller><div style="display: contents"><div id="content" style="width: 100px; height: 100px"></div></div></vi-scroller>`;
        });
        await page.mouse.move(100, 100);
        await settle(page);

        await setContentHeight(page, 1000);
        expect(await getState(page)).toMatchObject({ innerHeight: 1000, vertical: true, thumbHeight: 40, atBottom: false, scrollBottomShadow: true });
    });

    test('follows content that overflows the slotted element once it scrolls', async ({ page }) => {
        await setupPage(page);
        await page.evaluate(() => {
            document.getElementById('test-container')!.innerHTML = `<vi-scroller><div style="position: relative; width: 100px; height: 100px"><div id="spacer" style="position: absolute; width: 400px; height: 1px"></div></div></vi-scroller>`;
        });
        await page.mouse.move(100, 100);
        await settle(page);
        expect(await page.evaluate(() => (document.querySelector('vi-scroller') as any).innerWidth)).toBe(400);

        await page.evaluate(() => document.getElementById('spacer')!.style.width = '1000px');
        await page.evaluate(() => (document.querySelector('vi-scroller') as any).scroller.scrollLeft = 100);
        await settle(page);

        expect(await page.evaluate(() => {
            const scroller = document.querySelector('vi-scroller') as any;
            return { innerWidth: scroller.innerWidth, horizontalScrollOffset: scroller.horizontalScrollOffset, thumbWidth: scroller.shadowRoot.querySelector('#horizontal').offsetWidth };
        })).toEqual({ innerWidth: 1000, horizontalScrollOffset: 100, thumbWidth: 40 });
    });

    test('dragging the thumb after the content shrank follows the new scroll range', async ({ page }) => {
        await setupPage(page);
        await mountScroller(page, 2000);

        await setContentHeight(page, 1000);
        const thumb = await page.locator('vi-scroller #vertical').boundingBox();
        expect(thumb!.height).toBe(40);

        const x = thumb!.x + thumb!.width / 2;
        const y = thumb!.y + thumb!.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y + 60, { steps: 4 });
        await settle(page);

        // 60px of the 160px the thumb can travel maps onto 60/160 of the 800px scroll range.
        expect((await getState(page)).scrollTop).toBe(300);

        await page.mouse.move(x, y + 500, { steps: 4 });
        await page.mouse.up();
        await settle(page);

        expect(await getState(page)).toMatchObject({ scrollTop: 800, verticalScrollOffset: 800, atBottom: true });
    });
});
