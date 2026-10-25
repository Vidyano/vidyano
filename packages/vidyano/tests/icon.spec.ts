import { test, expect, Page } from '@playwright/test';

const iconHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <div id="test-container"></div>
      </body>
    </html>
`;

async function setupPage(page: Page) {
    await page.setContent(iconHtml);
    await page.addScriptTag({ path: 'dev/wwwroot/index.js', type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-icon'), { timeout: 10000 });
}

async function collectGarbage(page: Page) {
    const session = await page.context().newCDPSession(page);
    await session.send('HeapProfiler.enable');
    for (let i = 0; i < 3; i++)
        await session.send('HeapProfiler.collectGarbage');
    await session.detach();
}

/** Mounts a host whose shadow tree renders a <vi-icon> that defines a not yet registered icon. */
async function mountIconHost(page: Page, name: string) {
    await page.evaluate(async name => {
        const host = document.createElement('div');
        host.attachShadow({ mode: 'open' }).innerHTML = `<vi-icon name="${name}"><svg viewBox="0 0 32 32"><path d="M0 0h32v32H0z"></path></svg></vi-icon>`;
        document.getElementById('test-container')!.appendChild(host);
        await (host.shadowRoot!.querySelector('vi-icon') as any).updateComplete;

        (window as any).hostRef = new WeakRef(host);
    }, name);
}

/** Renders a <vi-icon> with the given source and returns whether it resolved and the path it shows. */
function renderIcon(page: Page, source: string) {
    return page.evaluate(async source => {
        const icon = document.createElement('vi-icon') as any;
        icon.source = source;
        document.getElementById('test-container')!.appendChild(icon);
        await icon.updateComplete;
        await new Promise(requestAnimationFrame);

        return { unresolved: icon.unresolved, d: icon.shadowRoot.querySelector('#svgHost svg path')?.getAttribute('d') };
    }, source);
}

test.describe('Icon', () => {
    test('a removed host whose icon registered itself can be collected', async ({ page }) => {
        await setupPage(page);
        await mountIconHost(page, 'IconSpec_Leak');

        await page.evaluate(() => (window as any).hostRef.deref().remove());
        await collectGarbage(page);

        expect(await page.evaluate(() => (window as any).hostRef.deref() === undefined)).toBe(true);
    });

    test('an icon that registered itself still renders after its host is removed', async ({ page }) => {
        await setupPage(page);
        await mountIconHost(page, 'IconSpec_Render');

        await page.evaluate(() => (window as any).hostRef.deref().remove());
        await collectGarbage(page);

        expect(await renderIcon(page, 'IconSpec_Render')).toEqual({ unresolved: false, d: 'M0 0h32v32H0z' });
    });

    test('an alias added after an icon registered itself resolves to that icon', async ({ page }) => {
        await setupPage(page);
        await mountIconHost(page, 'IconSpec_Alias');

        await page.evaluate(() => (window as any).hostRef.deref().shadowRoot.querySelector('vi-icon').addAlias('IconSpec_AliasOther'));

        expect(await renderIcon(page, 'IconSpec_AliasOther')).toEqual({ unresolved: false, d: 'M0 0h32v32H0z' });
    });
});
