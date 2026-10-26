import { expect, Locator, Page } from '@playwright/test';
import { BASE, gridPage, nextFrames, openView, pageErrors, test, waitForGridReady } from '../_helpers/query-grid';
import { loadQuery, mountLoaded, patchItems, readCells, setDtoValue } from '../_helpers/cells';

const DATA_TYPES_VIEW = 'components/query-grid_data-types';
const RED = 'rgb(255, 0, 0)';

/**
 * Loads QueryGrid_DataTypes into `window.q` with only Id, Text and CommonMark visible, sets the CommonMark
 * values of the first items and the column type hints (displayingrid 'True' unless given otherwise).
 */
async function prepareMarkdown(page: Page, markdown: string | string[], hints: Record<string, string | undefined> = {}) {
    await loadQuery(page, 'QueryGrid_DataTypes');
    await page.evaluate(({ values, hints }) => {
        const q = (window as any).q;
        q.columns.forEach((c: any) => c.isHidden = !['Id', 'Text', 'CommonMark'].includes(c.name));

        const column = q.getColumn('CommonMark');
        const merged: Record<string, string> = { ...(column.typeHints ?? {}), ...hints };
        Object.keys(merged).filter(k => merged[k] == null).forEach(k => delete merged[k]);
        column.typeHints = merged;
        values.forEach((value, i) => q.items[i].values.CommonMark = value);
    }, { values: Array.isArray(markdown) ? markdown : [markdown], hints: Object.fromEntries(Object.entries(hints).map(([k, v]) => [k, v ?? null])) });
}

/** Loads QueryGrid_DataTypes, sets the CommonMark value of the first item and mounts the grid. */
async function mountWithMarkdown(page: Page, markdown: string | string[], options: { displayInGrid?: boolean; hints?: Record<string, string> } = {}) {
    const { displayInGrid = true, hints = {} } = options;

    await gridPage(page);
    await prepareMarkdown(page, markdown, { ...hints, ...(displayInGrid ? {} : { displayingrid: undefined }) });

    return mountLoaded(page);
}

/** Gives the first six QueryGrid_DataTypes items a CommonMark value, so the client can replace it. */
async function withMarkdownValues(page: Page) {
    await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
        if (['1', '2', '3', '4', '5', '6'].includes(id!))
            setDtoValue(item, 'CommonMark', 'x');
    });
}

/** The first CommonMark cell of the first row. */
function firstMarkdownCell(grid: Locator) {
    return grid.locator('vi-query-grid-row').first().locator('vi-query-grid-cell-common-mark');
}

/** The CommonMark cell of the row whose item is `index`. */
function markdownCellOf(grid: Locator, index: number) {
    return grid.evaluateHandle((g: any, index) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            const row = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].find((r: any) => r.item === q.items[index]) as HTMLElement;
            return row.querySelector('vi-query-grid-cell-common-mark');
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, index);
}

/**
 * Assigns query A to a new grid, then query B to the same grid. Each row is the CommonMark value of item 0 and
 * where displayingrid 'True' is set: on the column, on the value, or nowhere.
 */
async function swapQueries(page: Page, a: { markdown: string | null; mode: 'column' | 'value' | 'none' }, b: { markdown: string | null; mode: 'column' | 'value' | 'none' }) {
    await gridPage(page);
    for (const [key, row] of [['qa', a], ['qb', b]] as const) {
        await prepareMarkdown(page, [], { displayingrid: row.mode === 'column' ? 'True' : undefined });
        await page.evaluate(({ key, row }) => {
            const w = window as any;
            const item = w.q.items[0];
            item.values.CommonMark = row.markdown;
            if (row.mode === 'value')
                item.getFullValue('CommonMark').typeHints.displayingrid = 'True';

            w[key] = w.q;
        }, { key, row });
    }

    await page.evaluate(() => (window as any).q = (window as any).qa);
    const grid = await mountLoaded(page);
    await page.evaluate(() => (window as any).grid.query = (window as any).qb);
    await waitForGridReady(grid);

    return grid;
}

/** Opens the Data types view in the dev app with an item-tap recorder (which prevents opening) and a changePath spy. */
async function openDataTypes(page: Page) {
    const grid = await openView(page, DATA_TYPES_VIEW);
    await grid.evaluate(g => {
        const w = window as any;
        w.__taps = 0;
        w.__tapItems = [];
        w.__paths = [];
        w.app.changePath = (path: string) => w.__paths.push(path);
        g.addEventListener('item-tap', (e: any) => {
            w.__taps++;
            w.__tapItems.push(e.detail.item);
            e.preventDefault();
        });
    });

    return grid;
}

/** Serves https://example.com/ (external links) with a stub page for the whole browser context. */
async function stubExternal(page: Page) {
    await page.context().route('https://example.com/**', route => route.fulfill({ contentType: 'text/html', body: '<!DOCTYPE html><title>stub</title>' }));
}

/** Records the pages the test page opens (popups and new tabs); call `urls()` for their current URLs. */
function recordPopups(page: Page) {
    const pages: Page[] = [];
    page.context().on('page', p => pages.push(p));

    return { get length() { return pages.length; }, urls: () => pages.map(p => p.url()).filter(u => u !== 'about:blank' && u !== '') };
}

test.describe('Rendering mode', () => {
    test('CommonMark columns use the common-mark cell', { annotation: [{ type: 'case', description: 'cells.cm-routing' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        const grid = await mountLoaded(page);

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        expect(rows.every(r => r.cells.CommonMark.tag === 'vi-query-grid-cell-common-mark')).toBe(true);
        expect(await grid.evaluate((g: any) => {
            const Base = customElements.get('vi-query-grid-cell-default');
            const cells = [...g.shadowRoot.querySelectorAll('vi-query-grid-cell-common-mark')];
            return cells.length > 0 && cells.every(c => c instanceof Base);
        })).toBe(true);
    });

    test('without displayingrid the markdown source is shown literally', { annotation: [{ type: 'case', description: 'cells.cm-plain-default' }] }, async ({ page }) => {
        const grid = await mountWithMarkdown(page, '**Hello world!**', { displayInGrid: false });

        const cell = (await readCells(grid)).find(r => r.index === 0)!.cells.CommonMark;
        expect(cell.text).toBe('**Hello world!**');
        await expect(firstMarkdownCell(grid).locator('strong')).toHaveCount(0);
    });

    test('displayingrid \'True\' renders sanitized markdown', { annotation: [{ type: 'case', description: 'cells.cm-markdown' }] }, async ({ page }) => {
        const grid = await mountWithMarkdown(page, '**Hello world!**');

        const cell = firstMarkdownCell(grid);
        await expect(cell.locator('p > strong')).toHaveText('Hello world!');
        expect((await readCells(grid)).find(r => r.index === 0)!.cells.CommonMark.text).toBe('Hello world!');
        await expect(cell).toHaveText('Hello world!');
    });

    test('displayingrid is parsed as a boolean', { annotation: [{ type: 'case', description: 'cells.cm-displayingrid-parse' }] }, async ({ page }) => {
        await gridPage(page);

        for (const [hint, markdown] of [['true', true], ['yes', false], ['1', false], ['False', false], ['', false]] as const) {
            await page.evaluate(() => document.querySelector('#test-container > vi-query-grid')?.remove());
            await prepareMarkdown(page, '**Hello world!**', { displayingrid: hint });
            const grid = await mountLoaded(page);

            const cell = firstMarkdownCell(grid);
            await expect(cell.locator('strong'), `displayingrid '${hint}'`).toHaveCount(markdown ? 1 : 0);
            expect((await readCells(grid)).find(r => r.index === 0)!.cells.CommonMark.text, `displayingrid '${hint}'`).toBe(markdown ? 'Hello world!' : '**Hello world!**');
        }
    });

    test('default-cell hints apply to CommonMark cells', { annotation: [{ type: 'case', description: 'cells.cm-inherits-hints' }] }, async ({ page }) => {
        let grid = await mountWithMarkdown(page, 'x', { hints: { displayformat: '**{0}**' } });
        await expect(firstMarkdownCell(grid).locator('strong')).toHaveText('x');
        await expect(firstMarkdownCell(grid)).not.toHaveAttribute('tag');

        await grid.evaluate(g => g.remove());
        await prepareMarkdown(page, 'x', { displayformat: '**{0}**', tag: 'rgb(0, 128, 0)' });
        grid = await mountLoaded(page);

        const cell = firstMarkdownCell(grid);
        await expect(cell.locator('strong')).toHaveText('x');
        await expect(cell).toHaveAttribute('tag');
        expect((await readCells(grid)).find(r => r.index === 0)!.cells.CommonMark.textStyle['background-color']).toBe('rgb(0, 128, 0)');
    });
});

test.describe('Markdown output', () => {
    test('line breaks become spaces', { annotation: [{ type: 'case', description: 'cells.cm-breaks' }] }, async ({ page }) => {
        const grid = await mountWithMarkdown(page, 'a\nb');

        const p = firstMarkdownCell(grid).locator('p');
        await expect(p).toHaveCount(1);
        expect(await p.evaluate(e => e.innerHTML)).toBe('a b');
    });

    test('vi-icon is allowed and keeps its source', { annotation: [{ type: 'case', description: 'cells.cm-vi-icon' }] }, async ({ page }) => {
        const grid = await mountWithMarkdown(page, '<vi-icon source="Pin"></vi-icon> pinned');

        const icon = firstMarkdownCell(grid).locator('vi-icon[source="Pin"]');
        await expect(icon).toHaveCount(1);
        await expect(icon).not.toHaveAttribute('unresolved');
        await expect(icon).toBeVisible();
        expect(await icon.evaluate(e => [getComputedStyle(e).display, getComputedStyle(e).pointerEvents])).toEqual(['inline-block', 'all']);
        await expect(firstMarkdownCell(grid)).toContainText('pinned');
    });

    test('several blocks stay on one row and end with an ellipsis', { annotation: [{ type: 'case', description: 'cells.cm-one-row' }] }, async ({ page }) => {
        const long = Array.from({ length: 12 }, (_, i) => `paragraph ${i}`).join('\n\n');
        await withMarkdownValues(page);
        const grid = await mountWithMarkdown(page, ['a\n\nb', '- a\n- b', '1. one\n2. two', long, 'a\nb', '# Title\n\n> quote']);

        // The long value gets a 100px wide text box so it cannot fit
        for (const [index, text, narrow] of [[0, 'a b', false], [1, 'a b', false], [2, 'one two', false], [3, 'paragraph 0 paragraph 1', true], [4, 'a b', false], [5, 'Title quote', false]] as const) {
            const cell = await markdownCellOf(grid, index);
            const box = await cell.evaluate((c: any, narrow) => {
                const text = c.shadowRoot.querySelector('#text') as HTMLElement;
                if (narrow)
                    text.style.width = '100px';

                const cs = getComputedStyle(text);
                return { text: text.innerText.replace(/\s+/g, ' ').trim(), scrollHeight: text.scrollHeight, rowHeight: c.getBoundingClientRect().height, overflows: text.scrollWidth > text.clientWidth, textOverflow: cs.textOverflow, whiteSpace: cs.whiteSpace };
            }, narrow);

            expect(box.text.startsWith(text), `item ${index}: ${box.text}`).toBe(true);
            expect(box.scrollHeight, `item ${index}`).toBeLessThanOrEqual(Math.round(box.rowHeight));
            expect(box.overflows, `item ${index}`).toBe(narrow);
            expect([box.textOverflow, box.whiteSpace], `item ${index}`).toEqual(['ellipsis', 'nowrap']);
        }
    });

    test('http links get target=_blank and rel=noopener', { annotation: [{ type: 'case', description: 'cells.cm-http-link-attrs' }] }, async ({ page }) => {
        const grid = await mountWithMarkdown(page, '[ext](https://example.com)');

        const link = firstMarkdownCell(grid).locator('a');
        await expect(link).toHaveText('ext');
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener');
    });

    test('markdown element styling inside the cell', { annotation: [{ type: 'case', description: 'cells.cm-styles' }] }, async ({ page }) => {
        // Id 4 has [People](http://localhost:5000/home/people)
        const grid = await openDataTypes(page);

        const cell = grid.locator('vi-query-grid-cell-common-mark', { has: page.locator('a', { hasText: /^People$/ }) });
        await expect(cell).toHaveCount(1);
        const styles = await cell.evaluate((c: HTMLElement) => {
            const p = c.shadowRoot!.querySelector('p')!;
            const a = c.shadowRoot!.querySelector('a')!;
            const probe = document.createElement('span');
            probe.style.color = 'var(--theme-color)';
            c.shadowRoot!.appendChild(probe);
            const themeColor = getComputedStyle(probe).color;
            probe.remove();

            const ps = getComputedStyle(p);
            const as = getComputedStyle(a);
            const hs = getComputedStyle(c);
            return {
                p: [ps.marginTop, ps.marginBottom, ps.display, ps.whiteSpace],
                a: [as.display, as.lineHeight, as.color === themeColor],
                host: [hs.paddingLeft, hs.paddingRight, Math.round(c.getBoundingClientRect().height)]
            };
        });

        expect(styles).toEqual({
            p: ['0px', '0px', 'inline', 'nowrap'],
            a: ['inline-block', '32px', true],
            host: ['6px', '6px', 32]
        });
    });
});

test.describe('Sanitization', () => {
    test('script tags are removed', { annotation: [{ type: 'case', description: 'cells.cm-xss-script' }] }, async ({ page }) => {
        const grid = await mountWithMarkdown(page, '<script>window.__xss=1</script>ok');

        const cell = firstMarkdownCell(grid);
        await expect(cell).toHaveText('ok');
        await expect(cell.getByText('ok')).toBeVisible();
        await expect(cell.locator('script')).toHaveCount(0);
        await nextFrames(page, 5);
        expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    });

    test('event-handler attributes on images are stripped', { annotation: [{ type: 'case', description: 'cells.cm-xss-onerror' }] }, async ({ page }) => {
        const grid = await mountWithMarkdown(page, '<img src="x" onerror="window.__xss=2">');

        const img = firstMarkdownCell(grid).locator('img');
        await expect(img).toHaveCount(1);
        expect(await img.getAttribute('onerror')).toBeNull();
        // The broken image has finished loading (failed) once complete is true and it has no natural size
        await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth === 0)).toBe(true);
        await nextFrames(page, 2);
        expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    });

    test('javascript: links lose their href', { annotation: [{ type: 'case', description: 'cells.cm-xss-js-href' }] }, async ({ page }) => {
        // The view's own payload: Id 10 has [click me](javascript:window.__xss='href')
        const grid = await openDataTypes(page);

        const link = grid.locator('vi-query-grid-cell-common-mark a', { hasText: 'click me' });
        await expect(link).toHaveCount(1);
        expect(await link.getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i);

        await link.click();
        await nextFrames(page, 5);
        expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
        expect(await page.evaluate(() => (window as any).__taps)).toBe(0);
    });

    test('inline event attributes on links are stripped', { annotation: [{ type: 'case', description: 'cells.cm-xss-event-attr' }] }, async ({ page }) => {
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '11')
                setDtoValue(item, 'CommonMark', '<a href="#" onclick="window.__xss=4">x</a>');
        });
        const grid = await openDataTypes(page);

        const link = grid.locator('vi-query-grid-cell-common-mark a', { hasText: /^x$/ });
        await expect(link).toHaveCount(1);
        expect(await link.getAttribute('onclick')).toBeNull();

        await link.click();
        await nextFrames(page, 5);
        expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    });

    test('iframes and styles are removed', { annotation: [{ type: 'case', description: 'cells.cm-xss-iframe-style' }] }, async ({ page }) => {
        await withMarkdownValues(page);
        const grid = await mountWithMarkdown(page, ['<iframe src="https://example.com/"></iframe>', `x<style>p, strong { color: ${RED} !important; } body { display: none !important; }</style>`, '**neighbour**']);

        await expect(grid.locator('vi-query-grid-cell-common-mark iframe')).toHaveCount(0);
        const styled = await (await markdownCellOf(grid, 1)).evaluate((c: any) => {
            const text = c.shadowRoot.querySelector('#text') as HTMLElement;
            const x = [text, ...text.querySelectorAll('*')].find(e => [...e.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() === 'x'))!;
            return { styles: text.querySelectorAll('style').length, color: getComputedStyle(x).color };
        });
        expect(styled.styles).toBe(0);
        expect(styled.color).not.toBe(RED);
        const neighbour = grid.locator('vi-query-grid-cell-common-mark strong', { hasText: 'neighbour' });
        await expect(neighbour).toHaveCount(1);
        expect(await neighbour.evaluate(e => getComputedStyle(e).color)).not.toBe(RED);
        expect(await page.evaluate(() => getComputedStyle(document.body).display)).not.toBe('none');
        const texts = (await readCells(grid)).filter(r => r.index <= 2).map(r => r.cells.Text.textStyle.color);
        expect(texts.length).toBe(3);
        expect(texts.filter(c => c === RED)).toEqual([]);
    });
});

test.describe('Link clicks', () => {
    test('in-app absolute links route through app.changePath', { annotation: [{ type: 'case', description: 'cells.cm-link-internal' }] }, async ({ page }) => {
        // Id 4 has [People](http://localhost:5000/home/people); the link is made absolute to where this build is served
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '4')
                setDtoValue(item, 'CommonMark', `[People](${BASE}/home/people)`);
        });
        const grid = await openDataTypes(page);
        const url = page.url();
        const popups: string[] = [];
        page.on('popup', p => popups.push(p.url()));

        const link = grid.locator('vi-query-grid-cell-common-mark a', { hasText: /^People$/ });
        await expect(link).toHaveCount(1);
        expect(await link.getAttribute('href')).toBe(`${BASE}/home/people`);

        await link.click();
        await expect.poll(() => page.evaluate(() => (window as any).__paths)).toEqual(['home/people']);
        // Wait so a popup or a navigation that would follow the click has had the time to start
        await page.waitForTimeout(500);
        expect(popups).toEqual([]);
        expect(page.url()).toBe(url);
        expect(await page.evaluate(() => (window as any).__taps)).toBe(0);

        // Control: a click on the same cell outside the link is an item tap
        const cell = grid.locator('vi-query-grid-cell-common-mark', { has: page.locator('a', { hasText: /^People$/ }) });
        const box = (await cell.boundingBox())!;
        const linkBox = (await link.boundingBox())!;
        await page.mouse.click(Math.min(linkBox.x + linkBox.width + 8, box.x + box.width - 2), box.y + box.height / 2);
        await expect.poll(() => page.evaluate(() => (window as any).__taps)).toBe(1);
    });

    test('a hashbang prefix is stripped from in-app links', { annotation: [{ type: 'case', description: 'cells.cm-link-hashbang' }] }, async ({ page }) => {
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '5')
                setDtoValue(item, 'CommonMark', `[home](${BASE}/#!/Home)`);
        });
        const grid = await openDataTypes(page);

        const link = grid.locator('vi-query-grid-cell-common-mark a', { hasText: /^home$/ });
        await expect(link).toHaveCount(1);
        await link.click();
        await expect.poll(() => page.evaluate(() => (window as any).__paths)).toEqual(['Home']);
        expect(await page.evaluate(() => (window as any).__taps)).toBe(0);
    });

    test('ctrl+click on an in-app link is left to the browser', { annotation: [{ type: 'case', description: 'cells.cm-link-ctrl' }] }, async ({ page }) => {
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '4')
                setDtoValue(item, 'CommonMark', `[People](${BASE}/home/people)`);
        });
        const grid = await openDataTypes(page);
        const popups = recordPopups(page);

        const link = grid.locator('vi-query-grid-cell-common-mark a', { hasText: /^People$/ });
        await expect(link).toHaveCount(1);
        await link.click({ modifiers: ['Control'] });

        await expect.poll(() => popups.urls()).toEqual([`${BASE}/home/people`]);
        expect(await page.evaluate(() => (window as any).__paths)).toEqual([]);
        expect(await page.evaluate(() => (window as any).__taps)).toBe(0);
    });

    test('external links open a new tab without opening the row', { annotation: [{ type: 'case', description: 'cells.cm-link-external' }] }, async ({ page }) => {
        await stubExternal(page);
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '6')
                setDtoValue(item, 'CommonMark', '[ext](https://example.com)');
        });
        const grid = await openDataTypes(page);
        const url = page.url();
        const popups = recordPopups(page);

        const link = grid.locator('vi-query-grid-cell-common-mark a', { hasText: /^ext$/ });
        await expect(link).toHaveCount(1);
        await link.click();

        await expect.poll(() => popups.urls()).toEqual(['https://example.com/']);
        expect(page.url()).toBe(url);
        expect(await page.evaluate(() => (window as any).__paths)).toEqual([]);
        expect(await page.evaluate(() => (window as any).__taps)).toBe(0);
    });

    test('clicking non-link markdown text taps the row', { annotation: [{ type: 'case', description: 'cells.cm-click-text-opens-row' }] }, async ({ page }) => {
        // Id 1 has '**bold** text'
        const grid = await openDataTypes(page);

        const cell = grid.locator('vi-query-grid-cell-common-mark', { has: page.locator('strong', { hasText: /^bold$/ }) }).first();
        // A point on the plain ' text' after the bold part, inside the visible cell (CommonMark is scrolled into view first)
        await cell.locator('strong').scrollIntoViewIfNeeded();
        await waitForGridReady(grid);
        const point = await cell.evaluate((c: HTMLElement) => {
            const strong = c.shadowRoot!.querySelector('strong')!.getBoundingClientRect();
            const box = c.getBoundingClientRect();
            return { x: Math.min(strong.right + 8, box.right - 8), y: box.top + box.height / 2 };
        });
        await page.mouse.click(point.x, point.y);

        await expect.poll(() => page.evaluate(() => (window as any).__taps)).toBe(1);
        expect(await cell.evaluate((c: HTMLElement) => {
            const row = c.closest('vi-query-grid-row') as any;
            return (window as any).__tapItems[0] === row.item && String(row.item.getValue('Id'));
        })).toBe('1');
    });

    test('rel=external links are not intercepted', { annotation: [{ type: 'case', description: 'cells.cm-link-rel-external' }] }, async ({ page }) => {
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '7')
                setDtoValue(item, 'CommonMark', `<a href="${BASE}/home/people" rel="external">abs</a>`);
            else if (id === '8')
                setDtoValue(item, 'CommonMark', '<a href="Home" rel="external">rel</a>');
        });
        const grid = await openDataTypes(page);
        const url = page.url();
        const popups = recordPopups(page);

        // An absolute in-app link: the browser follows it (in a new tab, it has target=_blank), the app does not route it
        const absolute = grid.locator('vi-query-grid-cell-common-mark a', { hasText: /^abs$/ });
        await expect(absolute).toHaveCount(1);
        await absolute.click();
        await expect.poll(async () => popups.length > 0 || page.url() !== url || (await page.evaluate(() => (window as any).__paths.length)) > 0).toBe(true);
        if (page.url() === url) {
            expect(await page.evaluate(() => (window as any).__paths)).toEqual([]);
            await expect.poll(() => popups.urls()).toEqual([`${BASE}/home/people`]);
            expect(await page.evaluate(() => (window as any).__taps)).toBe(0);
        }
        else
            expect(page.url()).toBe(`${BASE}/home/people`);

        if (page.url() !== url)
            return;

        // A relative link: the browser navigates to it
        const relative = grid.locator('vi-query-grid-cell-common-mark a', { hasText: /^rel$/ });
        await expect(relative).toHaveCount(1);
        const href = await relative.evaluate((a: HTMLAnchorElement) => a.href);
        const before = popups.length;
        await relative.click();
        await expect.poll(() => popups.length > before || page.url() !== url).toBe(true);
        if (page.url() !== url)
            expect(page.url()).toBe(href);
        else
            await expect.poll(() => popups.urls().at(-1)).toBe(href);
    });

    test('formatted text inside an in-app link routes in-app', { annotation: [{ type: 'case', description: 'cells.cm-link-nested' }] }, async ({ page }) => {
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '7')
                setDtoValue(item, 'CommonMark', `[**Bold link**](${BASE}/home/people)`);
        });
        const grid = await openDataTypes(page);
        const url = page.url();
        const popups = recordPopups(page);

        const bold = grid.locator('vi-query-grid-cell-common-mark a strong', { hasText: 'Bold link' });
        await expect(bold).toHaveCount(1);
        await bold.click();

        await expect.poll(() => page.evaluate(() => (window as any).__paths)).toEqual(['home/people']);
        // Wait so a popup or a navigation that would follow the click has had the time to start
        await page.waitForTimeout(500);
        expect(popups.length).toBe(0);
        expect(page.url()).toBe(url);
        expect(await page.evaluate(() => (window as any).__taps)).toBe(0);
    });

    test('link clicks outside vi-app raise no error', { annotation: [{ type: 'case', description: 'cells.cm-link-no-root-error' }] }, async ({ page }) => {
        await stubExternal(page);
        const errors = pageErrors(page);
        const grid = await mountWithMarkdown(page, '[ext](https://example.com/)');

        const link = firstMarkdownCell(grid).locator('a');
        await expect(link).toHaveText('ext');
        await link.click();
        // Wait so an error thrown by the click handler has been reported
        await nextFrames(page, 5);
        expect(errors).toEqual([]);
    });
});

test.describe('Recycling', () => {
    test('a recycled cell switches from plain text to markdown', { annotation: [{ type: 'case', description: 'cells.cm-mode-text-to-md' }] }, async ({ page }) => {
        const grid = await swapQueries(page, { markdown: '**x**', mode: 'none' }, { markdown: '**y**', mode: 'value' });

        const cell = firstMarkdownCell(grid);
        await expect(cell.locator('strong')).toHaveText('y');
        expect((await readCells(grid)).find(r => r.index === 0)!.cells.CommonMark.text).toBe('y');
    });

    test('a recycled cell switching from markdown to text shows the literal text', { annotation: [{ type: 'case', description: 'cells.cm-mode-md-to-text' }] }, async ({ page }) => {
        const grid = await swapQueries(page, { markdown: '**x**', mode: 'column' }, { markdown: '**z**', mode: 'none' });

        await expect(firstMarkdownCell(grid).locator('strong')).toHaveCount(0);
        expect((await readCells(grid)).find(r => r.index === 0)!.cells.CommonMark.text).toBe('**z**');
    });

    test('a null value clears rendered markdown', { annotation: [{ type: 'case', description: 'cells.cm-null-clear' }] }, async ({ page }) => {
        const grid = await swapQueries(page, { markdown: '**x**', mode: 'column' }, { markdown: null, mode: 'column' });

        const cell = await markdownCellOf(grid, 0);
        expect(await cell.evaluate((c: any) => c.shadowRoot.querySelectorAll('p, strong, em, a').length)).toBe(0);
        expect((await readCells(grid)).find(r => r.index === 0)!.cells.CommonMark.text).toBe('');
    });
});
