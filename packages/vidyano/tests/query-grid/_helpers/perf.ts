import { test as base, expect, CDPSession, Locator, Page, TestInfo } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { gridPage, nextFrames, waitForGridReady, writePerf } from './query-grid';

/**
 * Helpers for the vi-query-grid performance specs. Tests tagged @timing (see perfCase) run in project vidyano-perf on
 * one worker, since parallel workers would skew their timings; the others run in project vidyano in parallel.
 *
 * Everything is black-box: rendered DOM (deep, through open shadow roots), MutationObservers, rAF/ResizeObserver
 * frame sampling, PerformanceObserver (longtask, event), CDP metrics and the network log.
 */

/** The keys every perf result JSON holds (the committed schema snapshot). */
export const PERF_SCHEMA_KEYS = ['id', 'title', 'timestamp', 'testId', 'gitSha', 'chromeVersion', 'cpuThrottle', 'viewport', 'dataset', 'counts', 'timings', 'frames', 'cdp', 'memory', 'repetitions', 'saves', 'requests'].sort();

/** ExecuteAction names a perf scenario must never send (shared server state). */
const FORBIDDEN_ACTIONS = /(^|\.)(Save|Delete|Reorder|BulkEdit|ResetTest|SaveFilter)$/i;

/**
 * The perf `test`: every test gets a guard that records the ExecuteActions of its page and fails when one writes
 * shared server state. The settings save must be the stub (it records into window.__saves).
 */
export const test = base.extend<{ writeGuard: void }>({
    writeGuard: [async ({ page }, use, testInfo) => {
        const actions: string[] = [];
        page.on('request', request => {
            if (!/\/ExecuteAction$/.test(request.url()) || request.method() !== 'POST')
                return;

            try {
                actions.push(request.postDataJSON()?.action ?? '?');
            }
            catch {
                actions.push('?');
            }
        });

        await use();

        const forbidden = actions.filter(a => FORBIDDEN_ACTIONS.test(a));
        testInfo.annotations.push({ type: 'executeActions', description: actions.join(', ') || '(none)' });
        expect(forbidden, 'perf scenarios never write shared server state').toEqual([]);
    }, { auto: true }]
});

export { expect };

let gitSha: string;
function getGitSha() {
    if (gitSha === undefined) {
        try {
            gitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        }
        catch {
            gitSha = 'unknown';
        }
    }

    return gitSha;
}

export interface PerfData {
    cpuThrottle?: number;
    dataset?: Record<string, any>;
    counts?: Record<string, any>;
    timings?: Record<string, any>;
    frames?: Record<string, any>;
    cdp?: Record<string, any>;
    memory?: Record<string, any>;
    repetitions?: number;
    requests?: Record<string, any>;
}

/** Reads the dataset description of the grid on the page (window.grid or the given locator). */
export async function datasetOf(grid: Locator) {
    return grid.evaluate((g: any) => ({
        query: g.query?.name,
        totalItems: g.query?.totalItems,
        visibleColumns: g.columns?.length,
        pageSize: g.query?.pageSize,
        rowHeight: parseInt(getComputedStyle(g).getPropertyValue('--vi-query-grid-row-height'))
    }));
}

/**
 * Writes the full perf result (all PERF_SCHEMA_KEYS) via the shared writePerf and returns the payload.
 */
export async function recordPerf(page: Page | null, testInfo: TestInfo, id: string, data: PerfData = {}) {
    const viewport = page?.viewportSize() ?? null;
    const saves = page ? await page.evaluate(() => (window as any).__saves?.length ?? null).catch(() => null) : null;
    const payload = {
        testId: id,
        gitSha: getGitSha(),
        chromeVersion: page?.context().browser()?.version() ?? null,
        cpuThrottle: data.cpuThrottle ?? 1,
        viewport: viewport ? { w: viewport.width, h: viewport.height } : null,
        dataset: data.dataset ?? {},
        counts: data.counts ?? {},
        timings: data.timings ?? {},
        frames: data.frames ?? {},
        cdp: data.cdp ?? {},
        memory: data.memory ?? {},
        repetitions: data.repetitions ?? 1,
        saves,
        requests: data.requests ?? {}
    };

    await writePerf(testInfo, id, payload);
    return payload;
}

/** The file writePerf writes for a case id. */
export function perfResultPath(id: string) {
    return path.join(process.cwd(), 'perf-results', `${id.replace(/[^\w.-]+/g, '_')}.json`);
}

export function readPerfResult(id: string) {
    return JSON.parse(fs.readFileSync(perfResultPath(id), 'utf8'));
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Statistics                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------ */

export function percentile(values: number[], p: number) {
    if (!values.length)
        return NaN;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1));
    return sorted[index];
}

export const median = (values: number[]) => percentile(values, 50);

/** p50/p95/p99/max and dropped frames (> 1.5 x 16.7ms) of frame deltas. */
export function frameStats(deltas: number[]) {
    return {
        count: deltas.length,
        p50: round(percentile(deltas, 50)),
        p95: round(percentile(deltas, 95)),
        p99: round(percentile(deltas, 99)),
        max: round(deltas.length ? Math.max(...deltas) : NaN),
        dropped: deltas.filter(d => d > 25).length
    };
}

export const round = (n: number, digits = 1) => Number.isFinite(n) ? Math.round(n * 10 ** digits) / 10 ** digits : n;

/** The 60Hz frame budget (ms). */
export const VSYNC_MS = 1000 / 60;

/**
 * Missed vsyncs of frame intervals: an interval of n x the vsync interval (rounded) misses n - 1 vsyncs.
 * `droppedPct` is missed / (presented + missed) in %.
 */
export function droppedFrames(deltas: number[], interval = VSYNC_MS) {
    const missed = deltas.reduce((sum, d) => sum + Math.max(0, Math.round(d / interval) - 1), 0);
    return { missed, droppedPct: round(deltas.length + missed ? missed / (deltas.length + missed) * 100 : 0, 2) };
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Chrome trace frames                                                                                           */
/* ------------------------------------------------------------------------------------------------------------ */

/** Default user timing marks (performance.mark in the page) that bound the measured window of a frame trace. */
export const TRACE_START = 'perf-trace-start';
export const TRACE_END = 'perf-trace-end';

const FRAME_TRACE_CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing'];

/** Starts a Chrome trace with the frame categories (DrawFrame, BeginFrame, PipelineReporter, user timing). */
export async function startFrameTrace(page: Page) {
    await page.context().browser()!.startTracing(page, { categories: FRAME_TRACE_CATEGORIES });
}

/** Stops the trace started by startFrameTrace and returns its events. */
export async function stopFrameTrace(page: Page): Promise<any[]> {
    const buffer = await page.context().browser()!.stopTracing();
    const trace = JSON.parse(buffer.toString('utf8'));
    return Array.isArray(trace) ? trace : trace.traceEvents ?? [];
}

export interface TraceFrameStats {
    source: 'trace';
    /** Frames drawn by the page's compositor (DrawFrame) in the window */
    drawn: number;
    /** BeginFrames (vsync ticks) the compositor received in the window and their median interval */
    beginFrames: number;
    vsyncMs: number;
    /** p50/p95/p99/max of the intervals between drawn frames (ms) */
    count: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
    /** Intervals > 25ms (same rule as frameStats) */
    dropped: number;
    /** Vsyncs without a drawn frame between two drawn frames, and their share in % */
    missed: number;
    droppedPct: number;
    /** Missed frames and their share in % against a 60Hz vsync (equal to missed/droppedPct on a 60Hz display) */
    missed60: number;
    droppedPct60: number;
    /** PipelineReporter states of the frames in the window (STATE_PRESENTED_ALL, STATE_DROPPED, ...) */
    pipeline: Record<string, number>;
    /**
     * PipelineReporter frames that were dropped or presented without the main thread update, in % of the frames that
     * wanted an update. Informational only: Chrome can emit several reporters per vsync (e.g. a partial one next to the
     * presented one), so the budget uses the DrawFrame intervals (missed/droppedPct) instead.
     */
    pipelineDroppedPct: number;
    windowMs: number;
}

/**
 * Per-frame stats of the window between the user timing marks `start` and `end` (performance.mark in the page) of a
 * trace from startFrameTrace/stopFrameTrace. Frames are the DrawFrame events of the renderer that holds the marks.
 * Returns null when the marks or the frames are missing.
 */
export function traceFrames(events: any[], start = TRACE_START, end = TRACE_END): TraceFrameStats | null {
    const startMark = events.find(e => e.name === start && e.cat?.includes('blink.user_timing'));
    const endMark = events.find(e => e.name === end && e.cat?.includes('blink.user_timing') && e.pid === startMark?.pid);
    if (!startMark || !endMark)
        return null;

    const pid = startMark.pid;
    const from = startMark.ts;
    const to = endMark.ts;
    const inWindow = (e: any) => e.pid === pid && e.ts >= from && e.ts <= to;

    const draws = events.filter(e => e.name === 'DrawFrame' && e.ph === 'I' && inWindow(e));
    // The page's own layer tree (the one with the most drawn frames)
    const trees = new Map<any, number>();
    draws.forEach(e => trees.set(e.args?.layerTreeId, (trees.get(e.args?.layerTreeId) ?? 0) + 1));
    const tree = [...trees.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const drawTimes = draws.filter(e => e.args?.layerTreeId === tree).map(e => e.ts).sort((a, b) => a - b);
    if (drawTimes.length < 2)
        return null;

    const begins = events.filter(e => e.name === 'BeginFrame' && e.ph === 'I' && inWindow(e) && e.args?.layerTreeId === tree).map(e => e.ts).sort((a, b) => a - b);
    const beginDeltas = begins.slice(1).map((t, n) => (t - begins[n]) / 1000);
    const vsyncMs = beginDeltas.length >= 10 ? median(beginDeltas) : VSYNC_MS;

    const deltas = drawTimes.slice(1).map((t, n) => (t - drawTimes[n]) / 1000);
    const stats = frameStats(deltas);
    const { missed, droppedPct } = droppedFrames(deltas, vsyncMs);
    const { missed: missed60, droppedPct: droppedPct60 } = droppedFrames(deltas, Math.max(vsyncMs, VSYNC_MS));

    const pipeline: Record<string, number> = {};
    for (const e of events) {
        if (e.name !== 'PipelineReporter' || e.ph !== 'b' || !inWindow(e))
            continue;

        const reporter = e.args?.frame_reporter ?? e.args?.chrome_frame_reporter;
        if (reporter?.layer_tree_host_id !== undefined && reporter.layer_tree_host_id !== tree)
            continue;

        const state = reporter?.state ?? 'unknown';
        pipeline[state] = (pipeline[state] ?? 0) + 1;
    }
    const bad = (pipeline.STATE_DROPPED ?? 0) + (pipeline.STATE_PRESENTED_PARTIAL ?? 0);
    const wanted = Object.entries(pipeline).filter(([state]) => state !== 'STATE_NO_UPDATE_DESIRED').reduce((sum, [, n]) => sum + n, 0);

    return {
        source: 'trace',
        drawn: drawTimes.length,
        beginFrames: begins.length,
        vsyncMs: round(vsyncMs, 2),
        ...stats,
        missed,
        droppedPct,
        missed60,
        droppedPct60,
        pipeline,
        pipelineDroppedPct: round(wanted ? bad / wanted * 100 : 0, 2),
        windowMs: round((to - from) / 1000)
    };
}

/** Trace events of script execution: a Layout nested in one of them was forced synchronously by script. */
const SCRIPT_EVENTS = new Set(['FunctionCall', 'EvaluateScript', 'v8.callFunction', 'v8.run', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'RunMicrotasks', 'v8.evaluateModule']);

export interface TraceLayoutStats {
    /** Layout events on the main thread of the page in the window */
    layouts: number;
    layoutMs: number;
    /** Style recalcs (UpdateLayoutTree) in the window */
    styleRecalcs: number;
    styleMs: number;
    /** Layouts that ran inside script (forced synchronous layouts) and the script events that forced them */
    forced: number;
    forcedBy: Record<string, number>;
}

/**
 * Layout work of the window between the user timing marks `start` and `end` of a trace from startFrameTrace /
 * stopFrameTrace, on the thread that holds the marks (the page's main thread). Returns null without marks.
 */
export function traceLayouts(events: any[], start = TRACE_START, end = TRACE_END): TraceLayoutStats | null {
    const startMark = events.find(e => e.name === start && e.cat?.includes('blink.user_timing'));
    const endMark = events.find(e => e.name === end && e.cat?.includes('blink.user_timing') && e.pid === startMark?.pid);
    if (!startMark || !endMark)
        return null;

    const { pid, tid } = startMark;
    const from = startMark.ts;
    const to = endMark.ts;
    const onThread = (e: any) => e.pid === pid && e.tid === tid;

    // Complete events (ph X) and begin/end pairs as [ts, end] spans
    const spans = (names: (name: string) => boolean) => {
        const result: { name: string; ts: number; end: number }[] = [];
        const open = new Map<string, any[]>();
        for (const e of events) {
            if (!onThread(e) || !names(e.name))
                continue;

            if (e.ph === 'X')
                result.push({ name: e.name, ts: e.ts, end: e.ts + (e.dur ?? 0) });
            else if (e.ph === 'B')
                (open.get(e.name) ?? open.set(e.name, []).get(e.name)!).push(e);
            else if (e.ph === 'E') {
                const begin = open.get(e.name)?.pop();
                if (begin)
                    result.push({ name: e.name, ts: begin.ts, end: e.ts });
            }
        }

        return result.filter(s => s.ts >= from && s.ts <= to);
    };

    const layouts = spans(name => name === 'Layout');
    const styles = spans(name => name === 'UpdateLayoutTree');
    const scripts = spans(name => SCRIPT_EVENTS.has(name));
    const forcedBy: Record<string, number> = {};
    let forced = 0;
    for (const layout of layouts) {
        const script = scripts.find(s => s.ts <= layout.ts && s.end >= layout.end);
        if (script) {
            forced++;
            forcedBy[script.name] = (forcedBy[script.name] ?? 0) + 1;
        }
    }

    const ms = (list: { ts: number; end: number }[]) => round(list.reduce((sum, s) => sum + (s.end - s.ts), 0) / 1000, 2);
    return { layouts: layouts.length, layoutMs: ms(layouts), styleRecalcs: styles.length, styleMs: ms(styles), forced, forcedBy };
}

/** The 60fps budget the scroll flings are held to at 1x CPU: p95 frame interval and dropped frames (% of frames). */
export const FRAME_BUDGET = { p95: 20, droppedPct: 5 };

/**
 * Checks frame stats (frameStats + droppedFrames, or traceFrames) against FRAME_BUDGET. Trace stats are held to their
 * 60Hz drops (droppedPct60), so a faster display does not count vsyncs a 60fps budget never asked for. `hard` asserts;
 * otherwise a miss is only reported as a 'perf-warning' annotation. Returns the misses.
 */
export function checkFrameBudget(testInfo: TestInfo, label: string, frameStats: { p95: number; droppedPct: number; droppedPct60?: number }, options: { hard?: boolean } = {}) {
    const stats = { p95: frameStats.p95, droppedPct: frameStats.droppedPct60 ?? frameStats.droppedPct };
    const misses: string[] = [];
    if (!(stats.p95 <= FRAME_BUDGET.p95))
        misses.push(`p95 ${stats.p95}ms > ${FRAME_BUDGET.p95}ms`);

    if (!(stats.droppedPct <= FRAME_BUDGET.droppedPct))
        misses.push(`dropped ${stats.droppedPct}% > ${FRAME_BUDGET.droppedPct}%`);

    if (options.hard) {
        expect(stats.p95, `${label}: p95 frame interval`).toBeLessThanOrEqual(FRAME_BUDGET.p95);
        expect(stats.droppedPct, `${label}: dropped frames %`).toBeLessThanOrEqual(FRAME_BUDGET.droppedPct);
    }
    else if (misses.length)
        testInfo.annotations.push({ type: 'perf-warning', description: `${label}: ${misses.join(', ')} (60fps budget, report-only)` });

    return misses;
}

/* ------------------------------------------------------------------------------------------------------------ */
/* CDP                                                                                                            */
/* ------------------------------------------------------------------------------------------------------------ */

const cdpSessions = new WeakMap<Page, CDPSession>();
export async function cdp(page: Page) {
    let session = cdpSessions.get(page);
    if (!session) {
        session = await page.context().newCDPSession(page);
        cdpSessions.set(page, session);
    }

    return session;
}

export async function setCpuThrottle(page: Page, rate: number) {
    await (await cdp(page)).send('Emulation.setCPUThrottlingRate', { rate });
}

export async function cdpMetrics(page: Page): Promise<Record<string, number>> {
    const session = await cdp(page);
    await session.send('Performance.enable');
    const { metrics } = await session.send('Performance.getMetrics');
    return Object.fromEntries(metrics.map(m => [m.name, m.value]));
}

export async function collectGarbage(page: Page) {
    const session = await cdp(page);
    await session.send('HeapProfiler.enable');
    for (let i = 0; i < 3; i++)
        await session.send('HeapProfiler.collectGarbage');
}

/**
 * Counts the live elements whose prototype chain holds the prototype of the custom element `tag`. The prototypes of
 * subclasses (e.g. another cell type extending vi-query-grid-cell-default) also hold it and are not counted.
 */
export async function liveInstances(page: Page, tag: string) {
    const session = await cdp(page);
    const proto = await session.send('Runtime.evaluate', { expression: `customElements.get(${JSON.stringify(tag)}).prototype` });
    const result = await session.send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId!, objectGroup: 'perf' });
    const count = await session.send('Runtime.callFunctionOn', { objectId: result.objects.objectId!, functionDeclaration: 'function() { return this.filter(o => !Object.prototype.hasOwnProperty.call(o, "constructor")).length; }', returnByValue: true, objectGroup: 'perf' });
    await session.send('Runtime.releaseObjectGroup', { objectGroup: 'perf' });

    return count.result.value as number;
}

/**
 * Counts the live objects whose prototype chain holds the prototype that `prototypeExpression` evaluates to in the
 * page (e.g. 'Vidyano.Query.prototype'). Prototypes themselves are not counted.
 */
export async function liveObjects(page: Page, prototypeExpression: string) {
    const session = await cdp(page);
    const proto = await session.send('Runtime.evaluate', { expression: prototypeExpression });
    const result = await session.send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId!, objectGroup: 'perf' });
    const count = await session.send('Runtime.callFunctionOn', { objectId: result.objects.objectId!, functionDeclaration: 'function() { return this.filter(o => !Object.prototype.hasOwnProperty.call(o, "constructor")).length; }', returnByValue: true, objectGroup: 'perf' });
    await session.send('Runtime.releaseObjectGroup', { objectGroup: 'perf' });

    return count.result.value as number;
}

/* ------------------------------------------------------------------------------------------------------------ */
/* In-page instrumentation                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

/**
 * Installs window.__perf: long task / event timing buffers, deep DOM counters, mutation recording, a frame driver
 * and coverage probes. Call after gridPage/openView (the bare page has no CSP; the app gets it via evaluate).
 */
export async function installPerf(page: Page) {
    await page.evaluate(() => {
        const w = window as any;
        if (w.__perf)
            return;

        const perf: any = w.__perf = { longTasks: [], events: [] };

        try {
            new PerformanceObserver(list => perf.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
        }
        catch {
            // longtask not supported
        }

        try {
            new PerformanceObserver(list => perf.events.push(...list.getEntries().map((e: any) => ({ name: e.name, start: e.startTime, duration: e.duration, processing: e.processingEnd - e.processingStart })))).observe({ type: 'event', buffered: true, durationThreshold: 16 } as any);
        }
        catch {
            // event timing not supported
        }

        /** Total blocking time and longest task of the long tasks that started in [from, to]. */
        perf.tbt = (from: number, to: number = Infinity) => {
            const tasks = perf.longTasks.filter((t: any) => t.start >= from - 1 && t.start <= to);
            return {
                tbt: tasks.reduce((sum: number, t: any) => sum + Math.max(0, t.duration - 50), 0),
                longest: tasks.reduce((max: number, t: any) => Math.max(max, t.duration), 0),
                count: tasks.length
            };
        };

        const allRoots = (root: Document | ShadowRoot | Element, roots: (Document | ShadowRoot)[] = []) => {
            const walk = (r: Document | ShadowRoot | Element) => {
                for (const el of r.querySelectorAll('*')) {
                    if (el.shadowRoot) {
                        roots.push(el.shadowRoot);
                        walk(el.shadowRoot);
                    }
                }
            };
            if (root instanceof Document || root instanceof ShadowRoot)
                roots.push(root);
            else if (root.shadowRoot) {
                roots.push(root.shadowRoot);
                walk(root.shadowRoot);
            }

            walk(root);
            return roots;
        };
        perf.allRoots = allRoots;

        /** Number of elements in the tree of `root`, through every open shadow root (the root itself included). */
        perf.deepCount = (root: Document | Element = document) => {
            let count = root instanceof Element ? 1 : 0;
            const walk = (r: Document | ShadowRoot | Element) => {
                for (const el of r.querySelectorAll('*')) {
                    count++;
                    if (el.shadowRoot)
                        walk(el.shadowRoot);
                }
            };
            if (root instanceof Element && root.shadowRoot)
                walk(root.shadowRoot);

            walk(root);
            return count;
        };

        /** All elements matching `selector` in the tree of `root`, through open shadow roots. */
        perf.deepAll = (root: Document | Element, selector: string) => [...(root instanceof Element ? [root] : []), ...allRoots(root)].flatMap((r: any) => [...r.querySelectorAll(selector)]);

        perf.scroller = (g: any) => ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any);

        perf.rows = (g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')];

        perf.cellText = (cell: Element) => {
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

        /** Rows that intersect the grid viewport, sorted by position. */
        perf.visibleRows = (g: any) => {
            const view = perf.scroller(g).getBoundingClientRect();
            return perf.rows(g)
                .map((r: any) => ({ r, b: r.getBoundingClientRect() }))
                .filter(({ r, b }: any) => !r.classList.contains('hidden') && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1 && getComputedStyle(r).display !== 'none')
                .sort((a: any, b: any) => a.b.top - b.b.top);
        };

        /**
         * Coverage of the grid viewport by rows: the largest vertical gap (px) not covered by a row, the number of
         * visible rows without a loaded item (placeholder/blank), the number of visible rows and whether a search runs.
         */
        perf.coverage = (g: any) => {
            const scroller = perf.scroller(g);
            const view = scroller.getBoundingClientRect();
            const rows = perf.visibleRows(g);
            const contentBottom = Math.min(view.bottom, view.top + scroller.scroller.scrollHeight - scroller.scroller.scrollTop);
            let covered = view.top;
            let gap = 0;
            for (const { b } of rows) {
                if (b.top > covered)
                    gap = Math.max(gap, b.top - covered);

                covered = Math.max(covered, b.bottom);
            }

            gap = Math.max(gap, contentBottom - covered);
            const q = g.query;
            const blank = rows.filter(({ r }: any) => {
                if (r.hasAttribute('is-group'))
                    return false;

                const item = r.item;
                if (!item || item.constructor?.name === 'Object' || r.classList.contains('loading'))
                    return true;

                const cell = r.querySelector('.column');
                return !cell || (perf.cellText(cell) === '' && !cell.shadowRoot?.querySelector('vi-icon:not([hidden])') && item.getValue(cell.column?.name) != null && item.getValue(cell.column?.name) !== '');
            }).length;

            return { gap: Math.max(0, Math.round(gap * 10) / 10), blank, rows: rows.length, top: scroller.scroller.scrollTop, q: !!q, busy: !!q?.isBusy };
        };

        /** The row index (absolute item index) the first visible row shows, or -1. */
        perf.topRowIndex = (g: any) => {
            const first = perf.visibleRows(g)[0];
            if (!first)
                return -1;

            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                return q.items.indexOf(first.r.item);
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        };

        /**
         * Records mutations in the grid tree (every open shadow root that exists now, incl. rows and cells).
         * `perf.takeMutations()` returns a classified summary.
         */
        perf.observe = (g: any) => {
            const records: MutationRecord[] = [];
            const times: number[] = [];
            const observer = new MutationObserver(list => {
                records.push(...list);
                const now = performance.now();
                list.forEach(() => times.push(now));
            });
            for (const root of allRoots(g))
                observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true, attributeOldValue: true });

            observer.observe(g, { attributes: true, attributeOldValue: true });
            perf.__observer = { observer, records, times, g };
        };

        const isCell = (el: any) => !!el && el.nodeType === 1 && el.tagName.startsWith('VI-QUERY-GRID-CELL-');
        const isRow = (el: any) => !!el && el.nodeType === 1 && el.tagName === 'VI-QUERY-GRID-ROW';
        const up = (node: any) => node.parentNode instanceof ShadowRoot ? node.parentNode.host : node.parentNode;
        const owner = (node: any) => {
            let cell: any = null;
            let row: any = null;
            for (let n = node; n; n = up(n)) {
                if (!cell && isCell(n))
                    cell = n;

                if (isRow(n)) {
                    row = n;
                    break;
                }
            }

            return { cell, row };
        };

        perf.takeMutations = () => {
            const state = perf.__observer;
            if (!state)
                return null;

            state.records.push(...state.observer.takeRecords());
            state.observer.disconnect();
            perf.__observer = null;

            const g = state.g;
            const rows = perf.rows(g);
            const summary = {
                total: state.records.length,
                rowAdds: 0, rowRemoves: 0, cellAdds: 0, cellRemoves: 0,
                rowRecords: 0, cellRecords: 0, cellTextWrites: 0, cellAttributeWrites: 0, rowAttributeWrites: 0,
                hostRecords: 0, hostStyleRecords: 0, otherRecords: 0,
                /** [after-highlighted] toggles on the row after a changed selection: the rows are not in display order, so it replaces a sibling selector */
                adjacencyRecords: 0,
                perRow: {} as Record<number, number>,
                perRowText: {} as Record<number, number>,
                maxTextWritesPerCell: 0,
                cellsWithTextWrites: 0,
                /** childList records inside rows (cells included) */
                rowChildListRecords: 0,
                /** childList records inside cells, per cell tag name */
                cellChildList: {} as Record<string, number>,
                other: [] as string[]
            };
            const textPerCell = new Map<any, number>();

            for (const record of state.records) {
                for (const node of [...record.addedNodes, ...record.removedNodes] as any[]) {
                    const added = [...record.addedNodes].includes(node);
                    if (isRow(node))
                        added ? summary.rowAdds++ : summary.rowRemoves++;

                    if (isCell(node))
                        added ? summary.cellAdds++ : summary.cellRemoves++;
                }

                if (record.target === g) {
                    summary.hostRecords++;
                    if (record.attributeName === 'style')
                        summary.hostStyleRecords++;

                    continue;
                }

                if (isRow(record.target) && record.attributeName === 'after-highlighted') {
                    summary.adjacencyRecords++;
                    continue;
                }

                const { cell, row } = owner(record.target);
                if (row) {
                    summary.rowRecords++;
                    if (record.type === 'childList') {
                        summary.rowChildListRecords++;
                        if (cell) {
                            const tag = cell.tagName.toLowerCase();
                            summary.cellChildList[tag] = (summary.cellChildList[tag] ?? 0) + 1;
                        }
                    }

                    const index = rows.indexOf(row);
                    summary.perRow[index] = (summary.perRow[index] ?? 0) + 1;

                    if (cell) {
                        summary.cellRecords++;
                        const text = record.type === 'characterData' || (record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].some(n => n.nodeType === 3));
                        if (text) {
                            summary.cellTextWrites++;
                            summary.perRowText[index] = (summary.perRowText[index] ?? 0) + 1;
                            textPerCell.set(cell, (textPerCell.get(cell) ?? 0) + 1);
                        }
                        else if (record.type === 'attributes')
                            summary.cellAttributeWrites++;
                    }
                    else if (record.type === 'attributes' && record.target === row)
                        summary.rowAttributeWrites++;
                }
                else {
                    summary.otherRecords++;
                    if (summary.other.length < 20) {
                        const t: any = record.target;
                        const host = t.getRootNode?.()?.host;
                        summary.other.push(`${record.type}:${t.nodeName?.toLowerCase()}${t.id ? '#' + t.id : ''}${record.attributeName ? '@' + record.attributeName : ''} in ${host?.tagName?.toLowerCase() ?? 'document'}`);
                    }
                }
            }

            summary.cellsWithTextWrites = textPerCell.size;
            summary.maxTextWritesPerCell = Math.max(0, ...textPerCell.values());
            return summary;
        };

        /**
         * Runs `count` steps, one per frame. `step(i)` runs in a task before frame i (so the browser dispatches the
         * scroll event in that frame, like input), `measure(i)` runs after the frame's rAF callbacks and layout,
         * right before paint (ResizeObserver timing). Resolves with the measurements and the rAF frame deltas.
         */
        perf.runFrames = (count: number, step: (i: number) => void, measure?: (i: number) => any) => new Promise(resolve => {
            const probe = document.createElement('div');
            probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none;opacity:0;z-index:-1';
            document.body.appendChild(probe);

            const samples: any[] = [];
            const times: number[] = [];
            let i = 0;
            let wide = false;
            let initial = true;

            const ro = new ResizeObserver(() => {
                if (initial) {
                    initial = false;
                    setTimeout(next, 0);
                    return;
                }

                if (measure)
                    samples.push(measure(i));

                i++;
                setTimeout(next, 0);
            });

            const next = () => {
                if (i >= count) {
                    ro.disconnect();
                    probe.remove();
                    resolve({ samples, deltas: times.slice(1).map((t, n) => t - times[n]), duration: times.length ? times[times.length - 1] - times[0] : 0 });
                    return;
                }

                step(i);
                requestAnimationFrame(t => {
                    times.push(t);
                    probe.style.width = (wide = !wide) ? '2px' : '1px';
                });
            };

            ro.observe(probe);
        });

        /**
         * Resolves with the time (performance.now) of the first frame (post-layout, pre-paint) in which `check()` is
         * true, and the number of frames rendered until then (1 = the first frame after the call).
         */
        perf.whenFrame = (check: () => boolean, timeout = 15000) => new Promise((resolve, reject) => {
            const start = performance.now();
            let frames = 0;
            const probe = document.createElement('div');
            probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none;opacity:0;z-index:-1';
            document.body.appendChild(probe);
            let wide = false;

            const done = (value: any, error?: boolean) => {
                ro.disconnect();
                probe.remove();
                error ? reject(value) : resolve(value);
            };

            // `frames` is 1 in the first rendered frame after the call
            const ro = new ResizeObserver(() => {
                frames++;
                let ok = false;
                try {
                    ok = check();
                }
                catch {
                    ok = false;
                }

                if (ok)
                    return done({ time: performance.now(), frames });

                if (performance.now() - start > timeout)
                    return done(new Error('whenFrame timed out'), true);

                requestAnimationFrame(() => probe.style.width = (wide = !wide) ? '2px' : '1px');
            });

            ro.observe(probe);
        });

        /** True when every visible data row's cell for `column` shows the item's value as text (string columns). */
        perf.firstColumnMatches = (g: any, column: string) => {
            if (g.hasAttribute('initializing'))
                return false;

            const q = g.query;
            const rows = perf.visibleRows(g);
            if (!rows.length)
                return false;

            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                return rows.every(({ r }: any) => {
                    if (r.hasAttribute('is-group'))
                        return true;

                    const item = r.item;
                    if (!item || typeof item.getValue !== 'function')
                        return false;

                    const cell = [...r.querySelectorAll('.column')].find((c: any) => c.column?.name === column) as any;
                    return !!cell && perf.cellText(cell) === perf.expectedText(item, cell.column);
                });
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        };

        /** The text a cell is expected to show for an item (default cell formatting rules for People/Wide types). */
        perf.expectedText = (item: any, gridColumn: any) => {
            const column = gridColumn.column ?? gridColumn;
            const V = w.Vidyano;
            let value = item.getValue(column.name);
            if (value == null)
                return '';

            if ((column.type === 'Time' || column.type === 'NullableTime') && typeof value === 'string') {
                value = value.trimEnd('0').trimEnd('.');
                if (value.startsWith('0:'))
                    value = value.substr(2);
                if (value.endsWith(':00'))
                    value = value.substr(0, value.length - 3);
            }

            switch (column.type) {
                case 'Date':
                case 'NullableDate':
                    return value.localeFormat(V.CultureInfo.currentCulture.dateFormat.shortDatePattern, true);
                case 'DateTime':
                case 'NullableDateTime':
                case 'DateTimeOffset':
                case 'NullableDateTimeOffset':
                    return value.localeFormat(V.CultureInfo.currentCulture.dateFormat.shortDatePattern + ' ' + V.CultureInfo.currentCulture.dateFormat.shortTimePattern, true);
            }

            const format = column.getTypeHint('displayformat', null);
            if (format && format !== '{0}')
                return String.format(format, value);

            return (value.localeFormat ? value.localeFormat() : value.toLocaleString()).trim();
        };

        /**
         * Checks every cell of the visible data rows that intersects the viewport (x) against the expected rendering.
         * Boolean cells must show the Selected icon with [is-selected] iff the value is true.
         */
        perf.checkVisibleCells = (g: any) => {
            const q = g.query;
            const view = perf.scroller(g).getBoundingClientRect();
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            const wrong: string[] = [];
            let checked = 0;
            let offscreen = 0;
            let offscreenWithText = 0;
            let offscreenNonEmpty = 0;
            let offscreenValued = 0;
            let offscreenFilled = 0;
            try {
                for (const { r } of perf.visibleRows(g)) {
                    if (r.hasAttribute('is-group'))
                        continue;

                    const item = r.item;
                    if (!item || typeof item.getValue !== 'function') {
                        wrong.push(`row ${perf.rows(g).indexOf(r)} has no item`);
                        continue;
                    }

                    for (const cell of r.querySelectorAll('.column') as any) {
                        const b = cell.getBoundingClientRect();
                        const inView = b.right > view.left + 1 && b.left < view.right - 1;
                        const column = cell.column;
                        const isBool = ['Boolean', 'NullableBoolean', 'YesNo'].includes(column.type) && cell.tagName === 'VI-QUERY-GRID-CELL-BOOLEAN';
                        const text = perf.cellText(cell);
                        if (!inView) {
                            offscreen++;
                            if (isBool ? item.getValue(column.name) != null : cell.tagName === 'VI-QUERY-GRID-CELL-DEFAULT' && perf.expectedText(item, column) !== '')
                                offscreenNonEmpty++;

                            if (text !== '' || (isBool && cell.shadowRoot?.querySelector('vi-icon:not([hidden])')))
                                offscreenWithText++;

                            // An off-screen cell holds the value of its row (filled) or still the value of an earlier row (deferred)
                            if (item.getFullValue(column.name) != null) {
                                offscreenValued++;
                                if (cell.value?.item === item && (cell.tagName !== 'VI-QUERY-GRID-CELL-DEFAULT' || text === perf.expectedText(item, column)))
                                    offscreenFilled++;
                            }

                            continue;
                        }

                        checked++;
                        if (isBool) {
                            const value = item.getValue(column.name);
                            const icon = cell.shadowRoot?.querySelector('vi-icon');
                            if (value == null)
                                continue;

                            if (!icon || icon.hasAttribute('hidden') || icon.hasAttribute('is-selected') !== !!value)
                                wrong.push(`${item.getValue('FirstName') ?? item.id}.${column.name}: icon is-selected=${icon?.hasAttribute('is-selected')} value=${value}`);

                            continue;
                        }

                        if (cell.tagName !== 'VI-QUERY-GRID-CELL-DEFAULT') {
                            // Image / CommonMark: only require that a value renders something
                            continue;
                        }

                        const expected = perf.expectedText(item, column);
                        if (text !== expected)
                            wrong.push(`${column.name}: '${text}' != '${expected}'`);
                    }
                }
            }
            finally {
                q.disableLazyLoading = lazy;
            }

            return { checked, wrong, offscreen, offscreenWithText, offscreenNonEmpty, offscreenValued, offscreenFilled };
        };

        /** Records rAF frame deltas until `perf.stopFrames()`. */
        perf.startFrames = () => {
            const state = perf.__frames = { times: [] as number[], stop: false };
            const tick = (t: number) => {
                state.times.push(t);
                if (!state.stop)
                    requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        };
        perf.stopFrames = () => {
            const state = perf.__frames;
            state.stop = true;
            return state.times.slice(1).map((t: number, n: number) => t - state.times[n]);
        };

        /** The visible distinct rows (checkbox + label) of the column filter of `column`. */
        perf.filterItems = (g: any, column: string) => {
            const header = g.shadowRoot.querySelector(`vi-query-grid-column-header[name="${column}"]`);
            return header ? perf.deepAll(header, '.item').filter((e: any) => {
                const b = e.getBoundingClientRect();
                return b.height > 0 && b.width > 0 && e.checkVisibility();
            }) : [];
        };

        /** Deep elementFromPoint through open shadow roots. */
        perf.deepElementFromPoint = (x: number, y: number) => {
            let root: Document | ShadowRoot = document;
            let hit: Element | null = null;
            for (;;) {
                const next = root.elementFromPoint(x, y);
                if (!next || next === hit)
                    return hit;

                hit = next;
                if (!next.shadowRoot)
                    return hit;

                root = next.shadowRoot;
            }
        };

        /** Header/cell left positions per column name: header and the first visible data row. */
        perf.columnLefts = (g: any) => {
            const headers = Object.fromEntries([...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].map((h: any) => [h.column.name, h.getBoundingClientRect().left]));
            const first = perf.visibleRows(g).find(({ r }: any) => !r.hasAttribute('is-group'));
            const cells = first ? Object.fromEntries([...first.r.querySelectorAll('.column')].map((c: any) => [c.column.name, c.getBoundingClientRect().left])) : {};
            return { headers, cells };
        };
    });
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Mounting                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

export interface PrefetchOptions {
    queryOptions?: Record<string, any>;
    sortByFirstName?: boolean;
    userSettings?: Record<string, any>;
}

/** Gets (and searches) the query in the page as window.q, so a grid can be mounted on an already-searched query. */
export async function prefetch(page: Page, query: string, options: PrefetchOptions = {}) {
    const { queryOptions, sortByFirstName = true, userSettings } = options;
    await page.evaluate(async ({ query, queryOptions, sortByFirstName, userSettings }) => {
        const w = window as any;
        const q = await w.service.getQuery(query, queryOptions);
        if (sortByFirstName && q.columns.some((c: any) => c.name === 'FirstName') && q.sortOptions.map((o: any) => `${o.name} ${o.direction}`).join(';') !== 'FirstName ASC') {
            q.sortOptions = [{ name: 'FirstName', direction: 'ASC' }];
            await q.search();
        }

        if (userSettings)
            w.service.application.userSettings.QueryGridSettings[q.id] = JSON.parse(JSON.stringify(userSettings));

        w.q = q;
    }, { query, queryOptions, sortByFirstName, userSettings });
}

export interface AppendResult {
    /** ms from append to the first frame without [initializing] whose `column` cells match their items */
    firstRows: number;
    /** ms from append to the removal of [initializing] */
    initializingFalse: number;
    /** [initializing] removals / re-adds and initializing-changed(false) events seen so far */
    removals: number;
    readds: number;
    falseEvents: number;
    start: number;
    end: number;
    /** With `recordTemplate`: the computed --vi-query-grid-columns right after the append and after every change, until the first rows */
    templates?: string[];
}

/**
 * Creates a vi-query-grid for window.q, attaches the initializing observers, appends it and waits for the first
 * frame in which the rows of `column` are filled. The grid is window.grid.
 */
export async function appendGrid(page: Page, options: { column?: string; props?: Record<string, any>; recordTemplate?: boolean } = {}): Promise<AppendResult> {
    const { column = 'FirstName', props = {}, recordTemplate = false } = options;
    return page.evaluate(async ({ column, props, recordTemplate }) => {
        const w = window as any;
        const perf = w.__perf;
        w.grid?.remove();

        const grid = document.createElement('vi-query-grid') as any;
        Object.entries(props).forEach(([key, value]) => grid[key] = value);
        grid.query = w.q;

        const stats = w.__init = { removals: 0, readds: 0, falseEvents: 0, initializingFalse: NaN };
        new MutationObserver(records => records.forEach(r => {
            const has = grid.hasAttribute('initializing');
            if (r.oldValue !== null && !has) {
                stats.removals++;
                if (Number.isNaN(stats.initializingFalse))
                    stats.initializingFalse = performance.now() - start;
            }
            else if (r.oldValue === null && has && stats.removals > 0)
                stats.readds++;
        })).observe(grid, { attributes: true, attributeFilter: ['initializing'], attributeOldValue: true });
        grid.addEventListener('initializing-changed', (e: CustomEvent) => {
            if (e.detail?.value === false)
                stats.falseEvents++;
        });

        // Every distinct computed column template, from the append on (style writes are the only way it changes)
        const templates: string[] = [];
        const template = () => getComputedStyle(grid).getPropertyValue('--vi-query-grid-columns').trim();
        const sample = () => {
            const value = template();
            if (templates[templates.length - 1] !== value)
                templates.push(value);
        };
        const templateObserver = recordTemplate ? new MutationObserver(sample) : null;
        templateObserver?.observe(grid, { attributes: true, attributeFilter: ['style'] });

        w.grid = grid;
        const start = performance.now();
        document.getElementById('test-container')!.appendChild(grid);
        if (recordTemplate)
            sample();

        const { time } = await perf.whenFrame(() => perf.firstColumnMatches(grid, column));
        if (templateObserver) {
            templateObserver.takeRecords().forEach(sample);
            templateObserver.disconnect();
        }

        return { firstRows: time - start, initializingFalse: stats.initializingFalse, removals: stats.removals, readds: stats.readds, falseEvents: stats.falseEvents, start, end: time, ...(recordTemplate ? { templates } : {}) };
    }, { column, props, recordTemplate });
}

export const gridLocator = (page: Page) => page.locator('#test-container > vi-query-grid');

/** Scrolls the grid body to a row (top = row * rowHeight, clamped by the browser). */
export async function scrollToRow(grid: Locator, row: number) {
    await grid.evaluate((g: any, row) => {
        const scroller = (window as any).__perf.scroller(g).scroller as HTMLElement;
        scroller.scrollTop = row * g.rowHeight;
    }, row);
}

/** Waits until every visible row of the grid shows its loaded item (and the query is idle). */
export async function waitFilled(grid: Locator, timeout = 15000) {
    await expect.poll(() => grid.evaluate((g: any) => {
        const c = (window as any).__perf.coverage(g);
        return !g.query.isBusy && c.blank === 0 && c.gap <= 1 && c.rows > 0;
    }), { timeout }).toBe(true);
}

/** Mounts and waits ready; returns the locator. Thin wrapper so specs read the same. */
export async function mountPrefetched(page: Page, query: string, options: PrefetchOptions & { column?: string; props?: Record<string, any> } = {}) {
    await prefetch(page, query, options);
    const result = await appendGrid(page, { column: options.column, props: options.props });
    const grid = gridLocator(page);
    await waitForGridReady(grid);
    return { grid, result };
}

/** Moves the mouse off the grid rows (onto the empty header controls corner is still over the grid, so use x=1,y=1). */
export async function parkMouse(page: Page) {
    await page.mouse.move(1, 1);
    await nextFrames(page, 1);
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Spec shortcuts                                                                                                 */
/* ------------------------------------------------------------------------------------------------------------ */

/** Test details with the case id annotation; `timing` tags (@timing) a test whose result depends on wall-clock or frame timing. */
export function perfCase(id: string, { timing = false } = {}) {
    return { annotation: [{ type: 'case', description: id }], ...(timing ? { tag: '@timing' } : {}) };
}

/** Opens the bare grid page and installs the perf instrumentation. */
export async function perfPage(page: Page, options: Parameters<typeof gridPage>[1] = {}) {
    await gridPage(page, options);
    await installPerf(page);
}

/** QueryGridSettings that give every People column the same width (and optionally pin some). */
export function peopleWidths(width = 300, pinned: string[] = []) {
    const columns = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];
    return Object.fromEntries(columns.map(c => [c, { width: `${width}px`, ...(pinned.includes(c) ? { isPinned: true } : {}) }]));
}

/**
 * The scroll scenarios used by the "nothing is created while scrolling" cases: small steps, a rAF fling, a jump and
 * wheel steps. Each ends with the window filled.
 */
export async function runScrollScenarios(page: Page, grid: Locator) {
    // Small steps: one row per frame
    await grid.evaluate((g: any) => {
        const perf = (window as any).__perf;
        const scroller = perf.scroller(g).scroller;
        return perf.runFrames(20, (i: number) => scroller.scrollTop = (i + 1) * g.rowHeight);
    });
    await waitFilled(grid);

    // Fling to row 3,000 in 60 frames
    await grid.evaluate((g: any) => {
        const perf = (window as any).__perf;
        const scroller = perf.scroller(g).scroller;
        const start = scroller.scrollTop;
        const end = 3000 * g.rowHeight;
        return perf.runFrames(60, (i: number) => scroller.scrollTop = start + (end - start) * (1 - Math.pow(1 - (i + 1) / 60, 3)));
    });
    await waitFilled(grid);

    // Jump
    await scrollToRow(grid, 7000);
    await waitFilled(grid);

    // Wheel
    const box = (await grid.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 20; i++)
        await page.mouse.wheel(0, 500);

    await waitFilled(grid);
    await page.mouse.move(1, 1);
}

/** Opens the column filter popup of `column` by clicking its header filter button. */
export async function openFilter(grid: Locator, column: string) {
    await grid.locator(`vi-query-grid-column-header[name="${column}"] vi-query-grid-column-filter`).click();
}
