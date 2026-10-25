import { expect, Locator, Page, TestInfo } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Shared helpers for the vi-query-grid test suite.
 *
 * Every test runs against the dev backend (`npm run dev`, http://localhost:5000) and its People data.
 * The helpers only use public API, real input, rendered DOM and the network.
 */

/**
 * Where this checkout's build is served: VIDYANO_DEV_URL from the dev supervisor's test runs, otherwise the dev backend
 * or this git worktree's build on it. The dev supervisor serves every worktree of the repo under /<worktree>/ (its own
 * index.js and app pages, while service calls fall through to the backend that serves it, in a supervisor run the
 * worktree's own), so specs run from a worktree test that worktree's source.
 */
export const BASE = process.env.VIDYANO_DEV_URL || devBase('http://localhost:5000');

function devBase(root: string) {
    try {
        const gitDir = path.resolve(execSync('git rev-parse --absolute-git-dir', { encoding: 'utf8' }).trim());
        const commonDir = path.resolve(execSync('git rev-parse --git-common-dir', { encoding: 'utf8' }).trim());
        if (gitDir === commonDir)
            return root;

        // Same name as the supervisor's Worktrees.NameOf: the worktree's git dir name, lower case, [a-z0-9-] only
        const name = path.basename(gitDir).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
        return `${root}/${name}`;
    }
    catch {
        return root;
    }
}

export interface GridPageOptions {
    width?: number;
    height?: number;
    /** Extra CSS added to the test page */
    styles?: string;
    /** Values returned by the stub app's configuration.getSetting, e.g. { 'vi-query-grid.single-click': 'false' } */
    settings?: Record<string, string>;
    /** Console errors the test causes on purpose, kept out of the output */
    expectedErrors?: RegExp[];
}

function getGridTestHtml(styles: string) {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --theme-h1: 40px;
        --theme-h2: 32px;
        --theme-h3: 22px;
        --theme-h4: 12px;
        --theme-h5: 6px;
        --theme-foreground: #333;
        --theme-light-border: #ddd;
        --theme-read-only: #f5f5f5;
        --theme-color-error: #f44336;
        --color: #1a73e8;
        --color-light: #4285f4;
        --color-lighter: #8ab4f8;
        --color-dark: #1557b0;
        --color-faint: rgba(26, 115, 232, 0.1);
      }
      html, body { margin: 0; padding: 0; height: 100%; font-family: Arial, sans-serif; font-size: 14px; }
      :not(:defined) { display: none; }
      #test-container { position: fixed; inset: 0; display: flex; flex-direction: column; }
      #test-container > vi-query-grid { flex: 1 1 auto; min-height: 0; }
      ${styles}
    </style>
  </head>
  <body>
    <div id="test-container"></div>
  </body>
</html>`;
}

/**
 * Opens the bare grid test page: the bundle from the dev backend, a signed in service, a stub app
 * and a stubbed settings save. Saves are recorded in `window.__saves` instead of reaching the backend.
 */
export async function gridPage(page: Page, options: GridPageOptions = {}) {
    const { width = 1280, height = 720, styles = '', settings = {}, expectedErrors = [] } = options;

    await page.setViewportSize({ width, height });

    page.on('console', msg => {
        // A request a test aborts with route.abort() fails as net::ERR_FAILED; real network failures have their own codes
        if (msg.type() === 'error' && !/^Failed to load resource: net::ERR_FAILED$/.test(msg.text()) && !expectedErrors.some(e => e.test(msg.text())))
            console.error(`[Browser] ${msg.text()}`);
    });

    await page.route('**/grid-test-page', route => route.fulfill({ contentType: 'text/html', body: getGridTestHtml(styles) }));
    await page.goto(`${BASE}/grid-test-page`);
    await page.addScriptTag({ url: `${BASE}/index.js`, type: 'module' });
    await page.waitForFunction(() => typeof (window as any).Vidyano !== 'undefined', null, { timeout: 15000 });

    await page.evaluate(async ({ base, settings }) => {
        const w = window as any;
        const m = await import(`${base}/index.js`);
        w.m = m;

        const service = new w.Vidyano.Service(base, undefined, false);
        await service.initialize(true);
        await service.signInUsingCredentials('admin', 'admin');
        w.service = service;

        stubUserSettings(service.application);

        const activeDialogs: any[] = [];
        w.app = {
            service,
            showDialog: async (dialog: any) => {
                document.body.appendChild(dialog);
                activeDialogs.push(dialog);
                try {
                    return await dialog.open();
                }
                finally {
                    dialog.remove();
                    activeDialogs.pop();
                }
            },
            showMessageDialog: async (options: any) => w.app.showDialog(new m.MessageDialog(options)),
            showAlert: (notification: string) => (w.__alerts ??= []).push(notification),
            changePath: (path: string) => (w.__paths ??= []).push(path),
            get activeElementPath() {
                const path: Element[] = [document.activeElement];
                let element = document.activeElement;
                while (element?.shadowRoot?.activeElement)
                    path.push(element = element.shadowRoot.activeElement);

                return path.reverse();
            },
            isTracking: false,
            // Dialogs register their keybindings on the app when they connect
            _registerKeybindings: () => {},
            _unregisterKeybindings: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            configuration: {
                getSetting: (key: string, defaultValue?: string) => key in settings ? settings[key] : defaultValue,
                getAttributeConfig: () => ({ noLabel: false, hasTemplate: false })
            }
        };
        w[Symbol.for('Vidyano.App')] = w.app;

        function stubUserSettings(application: any) {
            w.__saves = [];
            application.userSettings.QueryGridSettings = {};
            application.userSettings.QuerySettings = {};
            application.saveUserSettings = async () => {
                w.__saves.push(JSON.parse(JSON.stringify(application.userSettings)));
                return application.userSettings;
            };
        }
    }, { base: BASE, settings });
}

export interface MountOptions {
    /** Query name, or a page function body returning a Query (receives `service` and `m`) */
    query?: string;
    /** getQuery options, e.g. { textSearch: 'zzzzqqq' } */
    queryOptions?: Record<string, any>;
    /** Normalizes the sort so row indexes are stable. Default true. */
    sortByFirstName?: boolean;
    /** Properties set on the grid before it is attached */
    props?: Record<string, any>;
    /** In-memory QueryGridSettings for the query, seeded before the grid loads them */
    userSettings?: Record<string, any>;
    /** Wait for the grid to be ready. Default true. */
    wait?: boolean;
}

/**
 * Creates a vi-query-grid for the query and appends it to the test container.
 * The grid and its query are available in the page as `window.grid` and `window.q`.
 */
export async function mountGrid(page: Page, options: MountOptions = {}): Promise<Locator> {
    const { query = 'People', queryOptions, sortByFirstName = true, props = {}, userSettings, wait = true } = options;

    await page.evaluate(async ({ query, queryOptions, sortByFirstName, props, userSettings }) => {
        const w = window as any;
        const q = await w.service.getQuery(query, queryOptions);
        if (sortByFirstName && q.columns.some((c: any) => c.name === 'FirstName') && q.sortOptions.map((o: any) => `${o.name} ${o.direction}`).join(';') !== 'FirstName ASC') {
            q.sortOptions = [{ name: 'FirstName', direction: 'ASC' }];
            await q.search();
        }

        if (userSettings)
            w.service.application.userSettings.QueryGridSettings[q.id] = userSettings;

        const grid = document.createElement('vi-query-grid') as any;
        Object.entries(props).forEach(([key, value]) => grid[key] = value);
        grid.query = q;
        document.getElementById('test-container')!.appendChild(grid);

        w.grid = grid;
        w.q = q;
    }, { query, queryOptions, sortByFirstName, props, userSettings });

    const grid = page.locator('#test-container > vi-query-grid');
    if (wait)
        await waitForGridReady(grid);

    return grid;
}

/**
 * Waits until the grid finished measuring: no [initializing], px-only column tracks, the query is idle and
 * every row in the viewport shows its item. Then waits two animation frames.
 */
export async function waitForGridReady(grid: Locator, timeout = 15000) {
    await expect.poll(() => grid.evaluate((g: any) => {
        // The columns outside the visible width are measured after the rows show
        if (g.hasAttribute('initializing') || !g.query || g.query.isBusy || g._hasUnmeasuredColumns)
            return false;

        const tracks = getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').trim();
        if (g.query.items.length > 0 && !/^(\d+px\s+)+minmax\(0(px)?,\s*1fr\)$/.test(tracks))
            return false;

        const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
        const view = scroller.getBoundingClientRect();
        const rows = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => {
            const b = r.getBoundingClientRect();
            return getComputedStyle(r).display !== 'none' && b.height > 0 && b.bottom > view.top && b.top < view.bottom && !r.classList.contains('hidden');
        });

        return rows.every((r: any) => r.item && r.item.constructor?.name !== 'Object');
    }), { timeout }).toBe(true);

    await nextFrames(grid.page(), 2);
}

/** Stops the page clock (installed with `page.clock.install()` before the page loaded), so its timers only run through `page.clock.runFor`. */
export async function pauseClock(page: Page) {
    // pauseAt throws for a time in the past and fires every timer due by then; a second ahead covers the round trip
    await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 1000);
}

export async function nextFrames(page: Page, count = 1) {
    await page.evaluate(count => new Promise<void>(resolve => {
        const step = (n: number) => n === 0 ? resolve() : requestAnimationFrame(() => step(n - 1));
        step(count);
    }), count);
}

/** Waits until the grid's query is idle. */
export async function waitForQueryIdle(grid: Locator, timeout = 15000) {
    await expect.poll(() => grid.evaluate((g: any) => !!g.query && !g.query.isBusy), { timeout }).toBe(true);
}

/**
 * The scroller of the grid body. The "more columns" popups have their own vi-scroller that comes first
 * in tree order, so never use the first vi-scroller in the shadow root.
 */
export const GRID_SCROLLER = `(g) => [...g.shadowRoot.querySelectorAll('vi-scroller')].find(s => !s.closest('header, vi-popup'))`;

export async function scrollGrid(grid: Locator, offset: { top?: number; left?: number }) {
    await grid.evaluate((g: any, offset) => {
        const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller as HTMLElement;
        if (offset.top != null)
            scroller.scrollTop = offset.top;
        if (offset.left != null)
            scroller.scrollLeft = offset.left;
    }, offset);
}

export async function getScrollOffset(grid: Locator) {
    return grid.evaluate((g: any) => {
        const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller as HTMLElement;
        return { top: scroller.scrollTop, left: scroller.scrollLeft, height: scroller.clientHeight, width: scroller.clientWidth, scrollHeight: scroller.scrollHeight, scrollWidth: scroller.scrollWidth };
    });
}

export interface VisibleRow {
    index: number;
    top: number;
    height: number;
    isGroup: boolean;
    selected: boolean;
    texts: string[];
}

/**
 * The rows that intersect the grid viewport, sorted by position, with the absolute item index
 * (-1 for group rows and placeholders) and the text of each cell.
 */
export async function visibleRows(grid: Locator): Promise<VisibleRow[]> {
    return grid.evaluate((g: any) => {
        const q = g.query;
        const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
        const view = scroller.getBoundingClientRect();
        const cellText = (cell: Element) => {
            const root = cell.shadowRoot;
            if (!root)
                return (cell.textContent ?? '').trim();

            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let text = '';
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (node.parentElement?.closest('style'))
                    continue;

                text += node.textContent;
            }

            return text.trim();
        };

        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
                .map((r: any) => ({ r, b: r.getBoundingClientRect() }))
                .filter(({ r, b }) => getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden') && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1)
                .sort((a, b) => a.b.top - b.b.top)
                .map(({ r, b }) => ({
                    index: r.hasAttribute('is-group') ? -1 : q.items.findIndex((i: any) => i === r.item),
                    top: Math.round(b.top - view.top),
                    height: Math.round(b.height),
                    isGroup: r.hasAttribute('is-group'),
                    selected: r.hasAttribute('selected'),
                    texts: [...r.querySelectorAll('.column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])].map(cellText)
                }));
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    });
}

/** Header column names in DOM order. */
export async function headerNames(grid: Locator): Promise<string[]> {
    return grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].filter((h: any) => getComputedStyle(h).display !== 'none').map((h: any) => h.getAttribute('name')));
}

/** The px widths of the --vi-query-grid-columns tracks (without the filler). */
export async function columnTracks(grid: Locator): Promise<number[]> {
    const value = await grid.evaluate((g: any) => getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').trim());
    return [...value.matchAll(/(\d+(?:\.\d+)?)px/g)].map(m => parseFloat(m[1]));
}

/** Reads a value from the query without triggering lazy loading. */
export async function itemValues(grid: Locator, index: number, columns: string[]) {
    return grid.evaluate((g: any, { index, columns }) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            const item = q.items[index];
            return item ? Object.fromEntries(columns.map(c => [c, item.getValue(c)])) : null;
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, { index, columns });
}

export interface LoggedRequest {
    url: string;
    endpoint: string;
    time: number;
    skip?: number;
    top?: number;
    textSearch?: string;
    sortOptions?: string;
    action?: string;
    body: any;
}

/**
 * Records the service requests (ExecuteQuery, ExecuteAction, GetQuery, GetPersistentObject).
 */
export function requestLog(page: Page) {
    const requests: LoggedRequest[] = [];
    const pending = new Set<any>();

    page.on('request', request => {
        const match = /\/(ExecuteQuery|ExecuteAction|GetQuery|GetPersistentObject)$/.exec(request.url());
        if (!match || request.method() !== 'POST')
            return;

        let body: any = null;
        try {
            body = request.postDataJSON();
        }
        catch {
            // Not JSON
        }

        pending.add(request);
        requests.push({
            url: request.url(),
            endpoint: match[1],
            time: Date.now(),
            skip: body?.query?.skip,
            top: body?.query?.top,
            textSearch: body?.query?.textSearch,
            sortOptions: body?.query?.sortOptions,
            action: body?.action,
            body
        });
    });
    page.on('requestfinished', request => pending.delete(request));
    page.on('requestfailed', request => pending.delete(request));

    return {
        requests,
        of: (endpoint: LoggedRequest['endpoint']) => requests.filter(r => r.endpoint === endpoint),
        clear: () => requests.splice(0, requests.length),
        /** Resolves once no request has been pending for `quietMs` */
        async quiet(quietMs = 300, timeout = 15000) {
            const start = Date.now();
            let lastBusy = Date.now();
            while (Date.now() - start < timeout) {
                if (pending.size)
                    lastBusy = Date.now();
                else if (Date.now() - lastBusy >= quietMs)
                    return;

                await page.waitForTimeout(25);
            }

            throw new Error(`Network did not go quiet within ${timeout}ms`);
        }
    };
}

/** The settings payloads recorded by the stubbed saveUserSettings. */
export async function savedSettings(page: Page): Promise<any[]> {
    return page.evaluate(() => (window as any).__saves ?? []);
}

/**
 * Collects page errors so a test can assert none happened.
 */
export function pageErrors(page: Page) {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    return errors;
}

export interface OpenAppOptions {
    width?: number;
    height?: number;
    /** Keeps the user's stored grid and query settings, for a test that checks what is stored. */
    storedSettings?: boolean;
    /** Loads the Google Fonts this many milliseconds late instead of blocking them, so the text widens after the first layout. */
    fontsDelay?: number;
}

/**
 * Opens a path of the real dev app (auto signs in as the default user) with Google Fonts blocked, the
 * user's stored grid and query settings left out (as gridPage does) and the user settings save stubbed.
 */
export async function openApp(page: Page, path: string, options: OpenAppOptions = {}) {
    const { width = 1280, height = 720 } = options;
    await page.setViewportSize({ width, height });

    if (options.fontsDelay === undefined) {
        await page.route('**/fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
        await page.route('**/fonts.gstatic.com/**', route => route.abort());
    }
    else {
        await page.route('**/fonts.gstatic.com/**', async route => {
            await new Promise(resolve => setTimeout(resolve, options.fontsDelay));
            await route.continue();
        });
    }

    // The settings arrive with the application, so they are cleared before any grid can read them
    if (!options.storedSettings) {
        await page.route('**/GetApplication', async route => {
            const response = await route.fetch();
            const result = await response.json();
            const attribute = result.application?.attributes?.find((a: any) => a.name === 'UserSettings');
            if (attribute) {
                const settings = attribute.value ? JSON.parse(attribute.value) : {};
                settings.QueryGridSettings = {};
                settings.QuerySettings = {};
                attribute.value = JSON.stringify(settings);
            }
            await route.fulfill({ response, json: result });
        });
    }
    await page.addInitScript(() => {
        const w = window as any;
        w.__saves = [];
        const stub = () => {
            const app = document.querySelector('vi-app') as any;
            const application = app?.service?.application;
            if (!application)
                return requestAnimationFrame(stub);

            application.saveUserSettings = async () => {
                w.__saves.push(JSON.parse(JSON.stringify(application.userSettings)));
                return application.userSettings;
            };
        };
        stub();
    });

    await page.goto(`${BASE}/${path.replace(/^\//, '')}`);
}

/** Opens a view of the real dev app (see openApp) and returns the grid on that view once it is ready. */
export async function openView(page: Page, viewPath: string, options: OpenAppOptions = {}): Promise<Locator> {
    await openApp(page, viewPath, options);

    const grid = page.locator('vi-query-grid').first();
    await grid.waitFor({ state: 'attached', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await waitForGridReady(grid, 30000);

    return grid;
}

/** The routes of the views under Components → Query Grid, plus People and PeopleTop10. */
export const VIEWS = {
    People: 'home/people',
    PeopleTop10: 'home/people-top10',
    QueryGrid_None: 'components/query-grid_none',
    QueryGrid_Select: 'components/query-grid_select',
    QueryGrid_Filter: 'components/query-grid_filter',
    QueryGrid_InlineActions: 'components/query-grid_inline-actions',
    QueryGrid_SelectAndFilter: 'components/query-grid_select-and-filter',
    QueryGrid_SelectAndInlineActions: 'components/query-grid_select-and-inline-actions',
    QueryGrid_SelectAndFilterAndInlineActions: 'components/query-grid_select-and-filter-and-inline-actions'
} as const;

/**
 * Writes performance metrics to perf-results/<id>.json and attaches them to the test.
 */
export async function writePerf(testInfo: TestInfo, id: string, data: Record<string, any>) {
    const dir = path.join(process.cwd(), 'perf-results');
    fs.mkdirSync(dir, { recursive: true });

    const payload = { id, title: testInfo.title, timestamp: new Date().toISOString(), ...data };
    fs.writeFileSync(path.join(dir, `${id.replace(/[^\w.-]+/g, '_')}.json`), JSON.stringify(payload, null, 2));
    await testInfo.attach(`perf-${id}`, { body: JSON.stringify(payload, null, 2), contentType: 'application/json' });
}

/**
 * Starts recording host attribute and style changes plus per-frame visibility of the header and body.
 * Call before the query is assigned; read the result with `stopRecording`.
 */
export async function recordTransitions(page: Page) {
    await page.evaluate(() => {
        const w = window as any;
        w.__transitions = [];
        const sample = () => {
            const g = document.querySelector('#test-container > vi-query-grid') as any;
            if (g?.shadowRoot) {
                const header = g.shadowRoot.querySelector('header');
                const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
                w.__transitions.push({
                    t: performance.now(),
                    initializing: g.hasAttribute('initializing'),
                    columns: getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').trim(),
                    header: header ? getComputedStyle(header).visibility : null,
                    body: scroller ? getComputedStyle(scroller).visibility : null,
                    rowsInitializing: [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => r.hasAttribute('initializing')).length,
                    rows: g.shadowRoot.querySelectorAll('vi-query-grid-row').length
                });
            }

            if (!w.__stopTransitions)
                requestAnimationFrame(sample);
        };
        w.__stopTransitions = false;
        requestAnimationFrame(sample);
    });
}

export async function stopRecording(page: Page): Promise<any[]> {
    return page.evaluate(() => {
        const w = window as any;
        w.__stopTransitions = true;
        return w.__transitions;
    });
}
