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

type Axis = 'vertical' | 'horizontal';

/** Mounts a scroller whose viewport and content have the given size along the axis; the other dimension stays 200px around 100px of content. */
async function mountAxis(page: Page, axis: Axis, viewport: number, content: number) {
    await page.evaluate(({ axis, viewport, content }) => {
        const [viewportStyle, contentStyle] = axis === 'vertical' ? [`height: ${viewport}px`, `width: 100px; height: ${content}px`] : [`width: ${viewport}px`, `width: ${content}px; height: 100px`];
        document.getElementById('test-container')!.innerHTML = `<vi-scroller style="${viewportStyle}"><div id="content" style="${contentStyle}"></div></vi-scroller>`;
    }, { axis, viewport, content });

    await page.mouse.move(100, 100);
    await settle(page);
}

/** Resizes the viewport, the content or both in the same frame. */
async function resizeAxis(page: Page, axis: Axis, size: { viewport?: number; content?: number }) {
    await page.evaluate(({ axis, size }) => {
        const dimension = axis === 'vertical' ? 'height' : 'width';
        if (size.viewport !== undefined)
            (document.querySelector('vi-scroller') as HTMLElement).style[dimension] = `${size.viewport}px`;

        if (size.content !== undefined)
            document.getElementById('content')!.style[dimension] = `${size.content}px`;
    }, { axis, size });
    await settle(page);
}

async function scrollAxisTo(page: Page, axis: Axis, offset: number) {
    await page.evaluate(({ axis, offset }) => (document.querySelector('vi-scroller') as any).scroller[axis === 'vertical' ? 'scrollTop' : 'scrollLeft'] = offset, { axis, offset });
    await settle(page);
}

/** The scroll state along the axis, with the thumb's position measured against its track. */
function getThumb(page: Page, axis: Axis) {
    return page.evaluate(axis => {
        const scroller = document.querySelector('vi-scroller') as any;
        const [start, end, size] = axis === 'vertical' ? ['top', 'bottom', 'height'] as const : ['left', 'right', 'width'] as const;
        const thumb = scroller.shadowRoot.querySelector(`#${axis}`).getBoundingClientRect() as DOMRect;
        const track = scroller.shadowRoot.querySelector(`.${axis}.scrollbar-parent`).getBoundingClientRect() as DOMRect;
        return {
            offset: axis === 'vertical' ? scroller.verticalScrollOffset : scroller.horizontalScrollOffset,
            range: axis === 'vertical' ? scroller.innerHeight - scroller.outerHeight : scroller.innerWidth - scroller.outerWidth,
            atEnd: axis === 'vertical' ? scroller.atBottom : scroller.atEnd,
            thumbSize: thumb[size],
            thumbStart: thumb[start] - track[start],
            thumbEnd: thumb[end] - track[start],
            trackSize: track[size]
        };
    }, axis);
}

/** Expects the thumb to sit as far along its track as the content is scrolled along its range. */
function expectThumbAtOffset(thumb: Awaited<ReturnType<typeof getThumb>>) {
    const expected = thumb.offset / thumb.range * (thumb.trackSize - thumb.thumbSize);
    expect(Math.abs(thumb.thumbStart - expected), `thumb at ${thumb.thumbStart}px, expected ${expected}px`).toBeLessThanOrEqual(1);
}

/** Scrolls to the start, the middle and the end, and expects the thumb to follow along the whole track. */
async function expectThumbFollowsScroll(page: Page, axis: Axis) {
    await scrollAxisTo(page, axis, 0);
    expect((await getThumb(page, axis)).thumbStart).toBe(0);

    await scrollAxisTo(page, axis, Math.round((await getThumb(page, axis)).range / 2));
    expectThumbAtOffset(await getThumb(page, axis));

    await scrollAxisTo(page, axis, 1e6);
    const thumb = await getThumb(page, axis);
    expect(thumb).toMatchObject({ offset: thumb.range, atEnd: true });
    expect(thumb.thumbEnd).toBe(thumb.trackSize);
}

test.describe('Scroller thumb across size changes', () => {
    // The thumb is the viewport's share of the content along the track, at least 40px.
    const changes = [
        { name: 'the viewport grows with the thumb held at its minimum', from: { viewport: 200, content: 4000 }, to: { viewport: 400 }, thumbSize: 40 },
        { name: 'the viewport shrinks with the thumb held at its minimum', from: { viewport: 400, content: 4000 }, to: { viewport: 200 }, thumbSize: 40 },
        { name: 'the viewport grows and the thumb grows with it', from: { viewport: 200, content: 800 }, to: { viewport: 400 }, thumbSize: 200 },
        { name: 'the viewport shrinks and the thumb shrinks with it', from: { viewport: 400, content: 800 }, to: { viewport: 200 }, thumbSize: 50 },
        { name: 'the viewport grows and the thumb leaves its minimum', from: { viewport: 200, content: 2000 }, to: { viewport: 400 }, thumbSize: 80 },
        { name: 'the viewport shrinks and the thumb drops to its minimum', from: { viewport: 400, content: 2000 }, to: { viewport: 200 }, thumbSize: 40 },
        { name: 'the content grows with the thumb held at its minimum', from: { viewport: 200, content: 4000 }, to: { content: 8000 }, thumbSize: 40 },
        { name: 'the content grows and the thumb drops to its minimum', from: { viewport: 200, content: 800 }, to: { content: 4000 }, thumbSize: 40 },
        { name: 'the content shrinks and the thumb leaves its minimum', from: { viewport: 200, content: 4000 }, to: { content: 800 }, thumbSize: 50 },
        { name: 'the viewport and the content grow together', from: { viewport: 200, content: 4000 }, to: { viewport: 400, content: 8000 }, thumbSize: 40 },
        { name: 'the viewport grows while the content shrinks', from: { viewport: 200, content: 4000 }, to: { viewport: 400, content: 2000 }, thumbSize: 80 }
    ];

    for (const axis of ['vertical', 'horizontal'] as const) {
        for (const change of changes) {
            test(`${axis}: the thumb spans its track after ${change.name}`, async ({ page }) => {
                await setupPage(page);
                await mountAxis(page, axis, change.from.viewport, change.from.content);
                await scrollAxisTo(page, axis, Math.round((await getThumb(page, axis)).range / 2));

                await resizeAxis(page, axis, change.to);
                const thumb = await getThumb(page, axis);
                expect(thumb.thumbSize).toBe(change.thumbSize);
                expect(thumb.trackSize).toBe(change.to.viewport ?? change.from.viewport);
                expectThumbAtOffset(thumb);

                await expectThumbFollowsScroll(page, axis);
            });
        }

        test(`${axis}: the thumb stays at the end of its track when the viewport grows while scrolled to the end`, async ({ page }) => {
            await setupPage(page);
            await mountAxis(page, axis, 200, 4000);
            await scrollAxisTo(page, axis, 1e6);

            await resizeAxis(page, axis, { viewport: 400 });
            const thumb = await getThumb(page, axis);
            expect(thumb).toMatchObject({ offset: 3600, range: 3600, atEnd: true, thumbSize: 40 });
            expect(thumb.thumbEnd).toBe(400);
        });

        test(`${axis}: dragging the thumb after the viewport grew follows its new travel`, async ({ page }) => {
            await setupPage(page);
            await mountAxis(page, axis, 200, 4000);
            await resizeAxis(page, axis, { viewport: 400 });

            const box = (await page.locator(`vi-scroller #${axis}`).boundingBox())!;
            expect(axis === 'vertical' ? box.height : box.width).toBe(40);

            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            const moveBy = (delta: number) => page.mouse.move(axis === 'vertical' ? x : x + delta, axis === 'vertical' ? y + delta : y, { steps: 4 });
            await page.mouse.move(x, y);
            await page.mouse.down();

            // Half of the 360px the thumb can travel maps onto half of the 3600px scroll range.
            await moveBy(180);
            await settle(page);
            expect((await getThumb(page, axis)).offset).toBe(1800);

            await moveBy(500);
            await page.mouse.up();
            await settle(page);

            const thumb = await getThumb(page, axis);
            expect(thumb).toMatchObject({ offset: 3600, atEnd: true });
            expect(thumb.thumbEnd).toBe(400);
        });
    }
});
