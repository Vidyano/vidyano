import { html, nothing, render, svg } from "/api/supervisor/lit-html.js";

const api = "/api/supervisor";
const views = [{ key: "frontend", label: "Frontend", icon: "layers" }, { key: "backend", label: "Backend", icon: "server" }, { key: "test", label: "Tests", icon: "flask" }];
const taskIcons = { ts: "code", sass: "brush", rollup: "package", server: "server", install: "package" };

const data = { instance: "", version: 0, logId: 0, tasks: [], log: [], runs: new Map(), tests: new Map(), catalog: new Map(), specRoots: [], specFiles: [], blockers: [], workspaces: [] };
const ui = { view: views.some(v => v.key === stored("view")) ? stored("view") : "frontend", workspace: stored("workspace") || null, workspaceMenu: false, connected: false, filter: null, follow: true, chosenFile: null, testId: null, open: {}, showOutput: false, outputRun: null, output: [], outputId: -1, outputFollow: true, railCollapsed: stored("railCollapsed") === "true", failFast: stored("failFast") !== "false", retryFlaky: stored("retryFlaky") !== "false", runMode: stored("runMode") === "remaining" ? "remaining" : "all", runMenu: false, contextMenu: null, notice: null, requested: new Set() };
const runModes = [{ key: "all", label: "Run all", hint: "Every test in the suite runs." }, { key: "remaining", label: "Run remaining", hint: "Only tests that failed or haven't run yet." }];
const finished = ["passed", "flaky", "skipped"];

let noticeTimer = null;
let frame = 0;
let polling = null;

function endpoint(action, params = {}) {
    const query = new URLSearchParams(params);
    if (ui.workspace)
        query.set("workspace", ui.workspace);

    const search = query.toString();
    return `${api}/${action}${search ? `?${search}` : ""}`;
}

function switchWorkspace(name) {
    ui.workspaceMenu = false;
    if (name === ui.workspace)
        return update();

    ui.workspace = name;
    store("workspace", name ?? "");
    data.instance = "";
    data.version = 0;
    data.logId = 0;
    ui.chosenFile = null;
    ui.testId = null;
    ui.showOutput = false;
    polling?.abort();
    update();
}

const paths = {
    sidebar: svg`<rect class="duo" x="3.5" y="4.5" width="17" height="15" rx="2.2"></rect><path d="M9.5 4.5v15"></path>`,
    layers: svg`<path class="duo" d="M12 3 3 8l9 5 9-5-9-5Z"></path><path d="m3 12.5 9 5 9-5"></path><path d="m3 17 9 5 9-5"></path>`,
    server: svg`<rect class="duo" x="3.5" y="4" width="17" height="7" rx="2.2"></rect><rect class="duo" x="3.5" y="13" width="17" height="7" rx="2.2"></rect><path d="M7.5 7.5h.01M7.5 16.5h.01M11 7.5h2M11 16.5h2"></path>`,
    flask: svg`<path d="M9 3h6"></path><path class="duo" d="M10 3v6.5L4.8 18.3A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.7L14 9.5V3"></path><path d="M7.2 15.5h9.6"></path>`,
    code: svg`<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"></path>`,
    cog: svg`<path class="duo" d="M10.3 3h3.4l.5 2.6 1.9 1.1 2.5-.9 1.7 2.9-2 1.8v2.2l2 1.8-1.7 2.9-2.5-.9-1.9 1.1-.5 2.6h-3.4l-.5-2.6-1.9-1.1-2.5.9-1.7-2.9 2-1.8v-2.2l-2-1.8 1.7-2.9 2.5.9 1.9-1.1.5-2.6Z"></path><circle cx="12" cy="12" r="2.8"></circle>`,
    brush: svg`<path class="duo" d="M14.5 4.5 19.5 9.5 11 18l-5-5 8.5-8.5Z"></path><path d="M6 13c-2 0-3 1.5-3 3.5S2 20 2 20s3.5 0 5-1 2-2.5 2-3.5"></path>`,
    package: svg`<path class="duo" d="M21 8 12 3 3 8v8l9 5 9-5V8Z"></path><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"></path>`,
    play: svg`<path class="solid" d="M8 5.6v12.8a1.1 1.1 0 0 0 1.7.94l10-6.4a1.1 1.1 0 0 0 0-1.88l-10-6.4A1.1 1.1 0 0 0 8 5.6Z"></path>`,
    stop: svg`<rect class="solid" x="6" y="6" width="12" height="12" rx="2.6"></rect>`,
    terminal: svg`<rect class="duo" x="3" y="4" width="18" height="16" rx="3"></rect><path d="m7 9.5 2.8 2.5L7 14.5M12.5 15H17"></path>`,
    list: svg`<path d="M9 6h12M9 12h12M9 18h12"></path><circle class="solid" cx="4.5" cy="6" r="1.4"></circle><circle class="solid" cx="4.5" cy="12" r="1.4"></circle><circle class="solid" cx="4.5" cy="18" r="1.4"></circle>`,
    check: svg`<path d="m5 12.5 4.5 4.5L19 7.5"></path>`,
    alert: svg`<path class="duo" d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"></path><path d="M12 9.5v4M12 17h.01"></path>`,
    open: svg`<path d="M14 4h6v6M20 4l-8.5 8.5"></path><path class="duo" d="M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5"></path>`,
    eraser: svg`<path class="duo" d="m7.5 20.5-4-4a1.5 1.5 0 0 1 0-2.1L13.4 4.5a1.5 1.5 0 0 1 2.1 0l4 4a1.5 1.5 0 0 1 0 2.1L10 20.5H7.5Z"></path><path d="M9 9l6 6M10 20.5h11"></path>`,
    file: svg`<path class="duo" d="M6.5 3h7l5 5v11.5a1.5 1.5 0 0 1-1.5 1.5h-10.5a1.5 1.5 0 0 1-1.5-1.5v-15a1.5 1.5 0 0 1 1.5-1.5Z"></path><path d="M13.5 3v5h5"></path>`,
    folder: svg`<path class="duo" d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2.2 2.2h7.3A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z"></path>`,
    folderOpen: svg`<path d="M3 17.5v-10A2.5 2.5 0 0 1 5.5 5H9l2.2 2.2h6.3A2.5 2.5 0 0 1 20 9.7v.8"></path><path class="duo" d="M3.2 18.6 5.6 11.8A1.8 1.8 0 0 1 7.3 10.6h13a1.2 1.2 0 0 1 1.1 1.6l-2.3 6.3a2.3 2.3 0 0 1-2.2 1.5H5a1.9 1.9 0 0 1-1.8-1.4Z"></path>`,
    zap: svg`<path class="duo" d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12l1-8Z"></path>`,
    repeat: svg`<path d="M4 11V9a4 4 0 0 1 4-4h11"></path><path d="m16 2 3 3-3 3"></path><path d="M20 13v2a4 4 0 0 1-4 4H5"></path><path d="m8 22-3-3 3-3"></path>`,
    chevronDown: svg`<path d="m6.5 9.5 5.5 5.5 5.5-5.5"></path>`,
    chevron: svg`<path d="m9 6 6 6-6 6"></path>`,
    expand: svg`<path d="m7 8 5 5 5-5M7 13l5 5 5-5"></path>`,
    collapse: svg`<path d="m7 16 5-5 5 5M7 11l5-5 5 5"></path>`
};

function icon(name, size = 18) {
    return html`<svg class="icon" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

function badge(state, size = 18) {
    const mark = state === "ok" ? svg`<path d="m7.6 12.4 3 3 5.8-6.2"></path>` : svg`<path d="m8.6 8.6 6.8 6.8M15.4 8.6l-6.8 6.8"></path>`;
    return html`<svg class="icon badge-icon ${state}" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"></circle>${mark}</svg>`;
}

function spinner(size = 18) {
    return html`<svg class="icon spin" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9"></path></svg>`;
}

const ansiColors = {
    30: "var(--faint)", 31: "var(--error)", 32: "var(--ok)", 33: "var(--warn)", 34: "#6f9dff", 35: "#f07ac0", 36: "#3cc8e0", 37: "var(--soft)",
    90: "var(--muted)", 91: "#ff8f9c", 92: "#7ee2a8", 93: "#ffcd7a", 94: "#9dbcff", 95: "#ff9fd6", 96: "#7fe0ef", 97: "var(--text)"
};

function ansi(text) {
    if (!text.includes("\x1b"))
        return text;

    const clean = text.replace(/\x1b\[[0-9;?]*[A-Za-ln-z]/g, "");
    const parts = [];
    const style = {};
    const pattern = /\x1b\[([0-9;]*)m/g;
    let last = 0;
    const push = part => {
        if (part)
            parts.push(html`<span style=${`${style.color ? `color: ${style.color};` : ""}${style.bold ? "font-weight: 600;" : ""}${style.dim ? "opacity: .65;" : ""}`}>${part}</span>`);
    };

    for (let match = pattern.exec(clean); match; match = pattern.exec(clean)) {
        push(clean.slice(last, match.index));
        last = pattern.lastIndex;
        for (const code of (match[1] || "0").split(";").map(Number)) {
            if (code === 0) {
                style.color = null;
                style.bold = style.dim = false;
            }
            else if (code === 1)
                style.bold = true;
            else if (code === 2)
                style.dim = true;
            else if (code === 22)
                style.bold = style.dim = false;
            else if (code === 39)
                style.color = null;
            else if (ansiColors[code])
                style.color = ansiColors[code];
        }
    }

    push(clean.slice(last));
    return parts;
}

function stored(key) {
    try {
        return localStorage.getItem(`supervisor.${key}`);
    } catch {
        return null;
    }
}

function store(key, value) {
    try {
        localStorage.setItem(`supervisor.${key}`, value);
    } catch {
        /* storage is a convenience only */
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function update() {
    if (!frame)
        frame = requestAnimationFrame(() => {
            frame = 0;
            draw();
        });
}

function notify(text) {
    ui.notice = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
        ui.notice = null;
        update();
    }, 1800);
    update();
}

async function post(action, body = {}) {
    const response = await fetch(endpoint(action), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok)
        throw new Error(`${action} failed with ${response.status}`);

    return response.status === 200 ? response.json() : null;
}

async function act(action, body, done) {
    try {
        const result = await post(action, body);
        if (done)
            notify(done);

        return result;
    } catch (e) {
        notify(e.message);
        return null;
    }
}

function merge(state) {
    if ((state.workspace ?? null) !== ui.workspace)
        return;

    data.workspaces = state.workspaces;
    if (state.instance !== data.instance) {
        data.instance = state.instance;
        data.log = [];
        data.runs.clear();
        data.tests.clear();
        data.catalog.clear();
        ui.requested.clear();
        ui.output = [];
        ui.outputId = -1;
        ui.outputRun = null;
    }

    data.version = state.version;
    data.tasks = state.tasks;
    data.specRoots = state.specRoots;
    data.blockers = state.blockers;

    if (state.log.length) {
        data.log.push(...state.log);
        data.logId = state.log.at(-1).id;
        if (data.log.length > 3000)
            data.log = data.log.slice(-2000);
    }

    for (const id of data.runs.keys()) {
        if (!state.runIds.includes(id))
            data.runs.delete(id);
    }

    for (const [key, test] of data.tests) {
        if (!state.runIds.includes(test.runId))
            data.tests.delete(key);
    }

    for (const run of state.runs)
        data.runs.set(run.id, run);

    for (const test of state.tests)
        data.tests.set(`${test.runId}/${test.id}`, test);

    for (const entry of state.catalog)
        data.catalog.set(entry.file, entry);

    if (state.specFiles) {
        data.specFiles = state.specFiles;
        for (const file of data.catalog.keys()) {
            if (!state.specFiles.includes(file))
                data.catalog.delete(file);
        }
    }

    update();
}

async function poll() {
    for (;;) {
        polling = new AbortController();
        try {
            const response = await fetch(endpoint("state", { instance: data.instance, since: data.version, log: data.logId }), { cache: "no-store", signal: polling.signal });
            if (response.status === 404 && ui.workspace) {
                notify(`Worktree ${ui.workspace} is not running`);
                switchWorkspace(null);
                continue;
            }

            if (!response.ok)
                throw new Error(String(response.status));

            ui.connected = true;
            merge(await response.json());
        } catch (e) {
            if (e.name === "AbortError")
                continue;

            ui.connected = false;
            update();
            await sleep(1000);
        }
    }
}

async function pollOutput() {
    for (;;) {
        const run = ui.showOutput ? currentRun() : null;
        if (run) {
            if (ui.outputRun !== run.id) {
                ui.outputRun = run.id;
                ui.output = [];
                ui.outputId = -1;
            }

            try {
                const response = await fetch(endpoint("output", { id: run.id, after: ui.outputId }), { cache: "no-store" });
                if (response.ok) {
                    const result = await response.json();
                    if (result.lines.length) {
                        ui.output.push(...result.lines);
                        ui.outputId = result.lines.at(-1).id;
                        if (ui.output.length > 4000)
                            ui.output = ui.output.slice(-3000);

                        update();
                    }
                }
            } catch {
                /* the state poll shows the connection status */
            }
        }

        await sleep(500);
    }
}

function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function duration(ms) {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function elapsed(ms) {
    const seconds = Math.round(ms / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function specRootOf(file) {
    return data.specRoots.find(r => file === r.path || file.startsWith(`${r.path}/`));
}

function shortPath(file) {
    const root = specRootOf(file);
    return root ? `${root.name}${file.slice(root.path.length)}` : file;
}

function specOf(file) {
    return file.replace(/:\d+$/, "");
}

function problemLocation(problem) {
    if (!problem.file)
        return "";

    return problem.line ? `${problem.file}:${problem.line}` : problem.file;
}

function taskKind(key) {
    return key.split("-")[0];
}

const stepLabels = { ts: "TypeScript", rollup: "Rollup", sass: "Sass" };

function packageOf(key) {
    if (key === "sass")
        return "vidyano";

    const dash = key.indexOf("-");
    return dash > 0 ? key.slice(dash + 1) : key;
}

function tasksIn(group) {
    return data.tasks.filter(t => t.group === group);
}

function taskState(t) {
    switch (t.status) {
        case "starting":
        case "building":
        case "stopping":
        case "waiting": return "busy";
        case "ok": return "ok";
        case "off": return "off";
        default: return "error";
    }
}

function groupState(list) {
    const states = list.map(taskState);
    if (states.includes("error"))
        return "error";

    if (states.includes("busy"))
        return "busy";

    return states.every(s => s === "off") ? "off" : "ok";
}

function runsList() {
    return [...data.runs.values()].sort((a, b) => a.id - b.id);
}

function testsOf(run) {
    return [...data.tests.values()].filter(t => t.runId === run.id);
}

function currentRun() {
    const runs = runsList();
    return runs.find(r => r.status === "running") ?? runs.findLast(r => r.status !== "queued") ?? runs.at(-1);
}

function runState(run) {
    switch (run?.status) {
        case "queued":
        case "running": return testsOf(run).some(t => t.status === "failed") ? "error" : "busy";
        case "passed": return "ok";
        case "failed": return "error";
        default: return "off";
    }
}

function viewState(key) {
    if (key === "test")
        return runState(currentRun());

    return groupState(tasksIn(key));
}

function stateIcon(state, size = 16) {
    switch (state) {
        case "ok":
        case "error": return badge(state, size);
        case "busy": return spinner(size);
        default: return html`<span class="hollow"></span>`;
    }
}

function resultIndex() {
    const results = new Map();
    const files = new Map();
    for (const run of runsList()) {
        for (const file of run.files)
            files.set(specOf(file.file), file.status === "pending" ? "queued" : file.status);
    }

    for (const test of [...data.tests.values()].sort((a, b) => a.runId - b.runId))
        results.set(test.id, test);

    return { results, files };
}

function counts(tests) {
    const of = status => tests.filter(t => t.status === status).length;
    return { total: tests.length, passed: of("passed"), failed: of("failed") };
}

function testState(status) {
    switch (status) {
        case "running": return "busy";
        case "passed": return "ok";
        case "failed": return "error";
        case "flaky":
        case "partial": return "warn";
        case "queued": return "queued";
        default: return "off";
    }
}

function displayStatus(result) {
    return !result ? "idle" : result.status === "pending" ? "queued" : result.status;
}

function folderState(statuses) {
    if (statuses.some(s => s === "running" || s === "starting"))
        return "running";

    if (statuses.includes("queued"))
        return "queued";

    if (statuses.includes("failed"))
        return "failed";

    if (statuses.length && statuses.every(s => s === "passed"))
        return "passed";

    return statuses.some(s => s === "passed" || s === "partial") ? "partial" : "idle";
}

function fileStatus(file, index) {
    const state = index.files.get(file) ?? "idle";
    const tests = data.catalog.get(file)?.tests ?? [];
    if (state === "running" || state === "starting" || state === "queued" || !tests.length)
        return state;

    const results = tests.map(t => index.results.get(t.id)?.status);
    if (results.includes("failed"))
        return "failed";

    const ran = results.filter(r => r === "passed" || r === "flaky" || r === "skipped").length;
    return ran === 0 ? (state === "failed" ? "failed" : "idle") : ran < tests.length ? "partial" : "passed";
}

function buildTree(files) {
    const root = { path: "", folders: new Map(), files: [] };
    for (const specRoot of data.specRoots)
        root.folders.set(specRoot.name, { path: specRoot.path, name: specRoot.name, folders: new Map(), files: [] });

    for (const file of files) {
        const specRoot = specRootOf(file);
        let node = specRoot ? root.folders.get(specRoot.name) : root;
        for (const part of file.slice(specRoot ? specRoot.path.length + 1 : 0).split("/").slice(0, -1)) {
            if (!node.folders.has(part))
                node.folders.set(part, { path: `${node.path}/${part}`, name: part, folders: new Map(), files: [] });

            node = node.folders.get(part);
        }

        node.files.push(file);
    }

    return root;
}

function folderPaths(node) {
    return [...node.folders.values()].flatMap(folder => [folder.path, ...folderPaths(folder)]);
}

function filesIn(node) {
    return [...node.files, ...[...node.folders.values()].flatMap(filesIn)];
}

function testCount(files) {
    return files.reduce((sum, file) => sum + (data.catalog.get(file)?.tests.length ?? 0), 0);
}

function selectedFile() {
    if (ui.chosenFile)
        return ui.chosenFile;

    const run = currentRun();
    const active = run?.files.find(f => f.status === "running") ?? run?.files.find(f => f.status === "failed") ?? run?.files[0];
    return active ? specOf(active.file) : null;
}

function explorerRows(index, selected) {
    const isOpen = path => ui.open[path] ?? (selected?.startsWith(`${path}/`) ?? false);
    const rows = [];
    const walk = (node, depth) => {
        for (const folder of [...node.folders.values()].sort((a, b) => a.name.localeCompare(b.name))) {
            const open = isOpen(folder.path);
            const files = filesIn(folder);
            rows.push({ key: folder.path, folder, files, depth, open, status: folderState(files.map(f => fileStatus(f, index))) });
            if (open)
                walk(folder, depth + 1);
        }

        for (const file of node.files)
            rows.push({ key: file, file, files: [file], depth, status: fileStatus(file, index) });
    };
    walk(buildTree(data.specFiles), 0);

    return rows;
}

function showView(key) {
    if (key === ui.view)
        return;

    ui.view = key;
    ui.filter = null;
    ui.follow = true;
    store("view", key);
    update();
}

function toggleFilter(key) {
    ui.filter = ui.filter === key ? null : key;
    ui.follow = true;
    update();
}

function shownByFilter(task) {
    return !ui.filter || ui.filter === task || ui.filter === `package:${packageOf(task)}`;
}

function openFile(target) {
    if (!target?.file)
        return;

    act("open", { file: target.file, line: target.line, column: target.column }, `Opening ${problemLocation(target)}`);
}

function startRun(targets, label, flags = []) {
    ui.showOutput = false;
    const options = [...ui.failFast ? ["-x"] : [], ...ui.retryFlaky ? ["--retries", "2"] : []];
    act("run", { args: [...[targets].flat(), ...options, ...flags] }, `Running ${label}`);
}

function remainingIn(files, index) {
    let count = 0;
    const targets = files.flatMap(file => {
        const tests = data.catalog.get(file)?.tests ?? [];
        if (!tests.length)
            return fileStatus(file, index) === "passed" ? [] : [file];

        const left = tests.filter(t => !finished.includes(index.results.get(t.id)?.status));
        count += left.length;
        return left.length === tests.length ? [file] : [...new Set(left.map(t => `${t.file}:${t.line}`))];
    });

    return { targets, count };
}

function runRemaining(files, label) {
    const { targets } = remainingIn(files, resultIndex());
    if (!targets.length) {
        notify(`Nothing left to run in ${label}`);
        return;
    }

    startRun(targets, `what's left in ${label}`);
}

function runSuite(mode) {
    ui.runMenu = false;
    if (mode === "remaining")
        runRemaining(data.specFiles, "the suite");
    else
        startRun([], "every test");
}

function chooseRunMode(key) {
    ui.runMode = key;
    ui.runMenu = false;
    store("runMode", key);
    update();
}

function runButton() {
    const mode = runModes.find(m => m.key === ui.runMode);
    return html`
        <div class="split-button ${ui.runMenu ? "open" : ""}">
            <button class="run-all split-main" title=${mode.hint} @click=${() => runSuite(mode.key)}>${icon("play", 16)}<span>${mode.label}</span></button>
            <button class="run-all split-toggle" title="Choose what Run does" aria-label="Choose what Run does" aria-haspopup="menu" aria-expanded=${ui.runMenu ? "true" : "false"} @click=${() => { ui.runMenu = !ui.runMenu; update(); }}>${icon("chevronDown", 16)}</button>
            ${ui.runMenu ? html`
                <div class="dropdown-menu run-menu" role="menu" aria-label="Run mode">
                    ${runModes.map(m => html`
                        <button class="dropdown-option" role="menuitemradio" aria-checked=${m.key === ui.runMode ? "true" : "false"} @click=${() => chooseRunMode(m.key)}>
                            <span class="option-check">${m.key === ui.runMode ? icon("check", 16) : nothing}</span>
                            <span class="option-text"><span class="option-label">${m.label}</span><span class="option-hint">${m.hint}</span></span>
                        </button>`)}
                </div>` : nothing}
        </div>`;
}

function openContextMenu(e, items, target) {
    e.preventDefault();
    e.stopPropagation();
    ui.runMenu = false;
    ui.contextMenu = { x: Math.min(e.clientX, window.innerWidth - 248), y: Math.min(e.clientY, window.innerHeight - 16 - items.length * 48), items, target };
    update();
}

function closeContextMenu() {
    if (!ui.contextMenu)
        return;

    ui.contextMenu = null;
    update();
}

function rowMenuItems(row, run) {
    const { targets, count } = remainingIn(row.files, resultIndex());
    const label = shortPath(row.folder ? row.folder.path : row.file);
    const remaining = () => {
        if (row.folder) {
            ui.chosenFile = null;
            ui.testId = null;
        }
        else
            chooseFile(row.file);

        runRemaining(row.files, label);
    };

    return [
        { icon: "play", label: "Run", run },
        { icon: "repeat", label: "Run remaining", hint: !targets.length ? "Nothing left" : count ? `${plural(count, "test")} failed or not run` : "Failed or not run", disabled: !targets.length, run: remaining }
    ];
}

function testMenuItems(test, status) {
    const done = finished.includes(status);
    return [
        { icon: "play", label: "Run", run: () => runTest(test) },
        { icon: "repeat", label: "Run remaining", hint: done ? "Nothing left" : status === "failed" ? "Failed" : "Not run yet", disabled: done, run: () => runTest(test) }
    ];
}

function contextMenu() {
    const menu = ui.contextMenu;
    if (!menu)
        return nothing;

    return html`
        <div class="dropdown-menu context-menu" role="menu" style="left: ${menu.x}px; top: ${menu.y}px" @contextmenu=${e => e.preventDefault()}>
            ${menu.items.map(item => html`
                <button class="dropdown-option" role="menuitem" ?disabled=${item.disabled} @click=${() => { ui.contextMenu = null; item.run(); update(); }}>
                    <span class="option-icon">${icon(item.icon, 15)}</span>
                    <span class="option-text"><span class="option-label">${item.label}</span>${item.hint ? html`<span class="option-hint">${item.hint}</span>` : nothing}</span>
                </button>`)}
        </div>`;
}

function runToggle(key, iconName, label, hint) {
    const on = ui[key];
    return html`
        <button class="run-toggle ${on ? "on" : ""}" role="switch" aria-checked=${on ? "true" : "false"} title=${hint} @click=${() => { ui[key] = !on; store(key, String(!on)); update(); }}>
            ${icon(iconName, 15)}<span>${label}</span><span class="switch"></span>
        </button>`;
}

function runFolder(folder) {
    ui.chosenFile = null;
    ui.testId = null;
    startRun(folder.path, shortPath(folder.path));
}

function runFile(file) {
    chooseFile(file);
    startRun(file, shortPath(file));
}

function runTest(test) {
    ui.testId = test.id;
    const title = test.title.split(" › ");
    const grep = `${title.join(" ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: @|$)`;
    startRun(`${test.file}:${test.line}`, title.at(-1), ["-g", grep]);
}

function chooseFile(file) {
    ui.chosenFile = file;
    ui.testId = null;
    ui.requested.add(file);
    act("load-tests", { file, refresh: true });
    update();
}

function stopRun() {
    const runs = runsList();
    const active = runs.find(r => r.status === "running") ?? runs.find(r => r.status === "queued");
    if (active)
        act("cancel", { id: active.id }, `Stopping run #${active.id}`);
}

function clearLog() {
    data.log = [];
    ui.follow = true;
    act("clear-log", {});
}

function follow(element, enabled) {
    if (element && enabled)
        element.scrollTop = element.scrollHeight;
}

function trackFollow(e, key) {
    const element = e.currentTarget;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
    if (ui[key] !== atBottom) {
        ui[key] = atBottom;
        update();
    }
}

function iconButton(name, label, onClick, { active = false, danger = false, hidden = false, disabled = false } = {}) {
    return html`<button class="icon-button ${active ? "active" : ""} ${danger ? "danger" : ""} ${hidden ? "invisible" : ""}" title=${label} aria-label=${label} ?disabled=${disabled || hidden} aria-hidden=${hidden ? "true" : "false"} @click=${onClick}>${icon(name)}</button>`;
}

function workspaceName(workspace) {
    return workspace.name ?? "main";
}

function workspacePath(workspace) {
    return workspace.name ? `/${workspace.name}/` : "/";
}

async function chooseWorkspace(workspace) {
    if (!workspace.running) {
        ui.workspaceMenu = false;
        try {
            await post("workspace", { name: workspace.name, action: "start" });
        } catch (e) {
            notify(e.message);
            return;
        }
    }

    switchWorkspace(workspace.name ?? null);
}

function stopWorkspace(workspace) {
    act("workspace", { name: workspace.name, action: "stop" }, `Stopped ${workspace.name}`);
    if (ui.workspace === workspace.name)
        switchWorkspace(null);
}

function workspacePicker() {
    if (data.workspaces.length < 2)
        return nothing;

    const current = data.workspaces.find(w => (w.name ?? null) === ui.workspace) ?? data.workspaces[0];
    return html`
        <div class="workspace-picker ${ui.workspaceMenu ? "open" : ""}">
            <button class="rail-button workspace-trigger" title=${`${workspaceName(current)} · ${current.branch ?? ""}`} aria-haspopup="menu" aria-expanded=${ui.workspaceMenu ? "true" : "false"} @click=${() => { ui.workspaceMenu = !ui.workspaceMenu; update(); }}>
                ${icon("folder", 20)}
                <span class="rail-label"><span class="workspace-name">${workspaceName(current)}</span><span class="workspace-branch">${current.branch ?? ""}</span></span>
                <span class="dropdown-chevron workspace-chevron">${icon("chevronDown", 14)}</span>
            </button>
            ${ui.workspaceMenu ? html`
                <div class="dropdown-menu workspace-menu" role="menu" aria-label="Worktrees">
                    ${data.workspaces.map(w => html`
                        <div class="workspace-row">
                            <button class="dropdown-option" role="menuitemradio" aria-checked=${w === current ? "true" : "false"} @click=${() => chooseWorkspace(w)}>
                                <span class="option-check">${w === current ? icon("check", 16) : nothing}</span>
                                <span class="option-text">
                                    <span class="option-label">${workspaceName(w)}</span>
                                    <span class="option-hint">${w.branch ?? ""} · ${workspacePath(w)}${w.running ? "" : " · stopped"}</span>
                                </span>
                            </button>
                            <a class="icon-button" href=${workspacePath(w)} target="_blank" title=${`Open ${workspacePath(w)}`} aria-label=${`Open ${workspacePath(w)}`}>${icon("open")}</a>
                            ${iconButton("stop", `Stop ${workspaceName(w)}`, () => stopWorkspace(w), { hidden: !w.name || !w.running })}
                        </div>`)}
                </div>` : nothing}
        </div>`;
}

function toggleRail() {
    ui.railCollapsed = !ui.railCollapsed;
    store("railCollapsed", String(ui.railCollapsed));
    update();
}

function rail() {
    return html`
        <nav class="rail ${ui.railCollapsed ? "collapsed" : ""}" aria-label="Views">
            ${workspacePicker()}
            ${views.map(v => {
                const state = viewState(v.key);
                return html`
                    <button class="rail-button ${v.key === ui.view ? "active" : ""}" title=${v.label} @click=${() => showView(v.key)}>
                        ${icon(v.icon, 20)}
                        <span class="rail-label">${v.label}</span>
                        ${state ? html`<span class="badge ${state}"></span>` : nothing}
                    </button>`;
            })}
            <span class="spacer"></span>
            <button class="rail-button rail-toggle" title=${ui.railCollapsed ? "Expand the sidebar" : "Collapse the sidebar"} aria-expanded=${ui.railCollapsed ? "false" : "true"} @click=${toggleRail}>
                ${icon("sidebar", 20)}
                <span class="rail-label">Collapse</span>
            </button>
        </nav>`;
}

function top(state, title, detail, actions = nothing) {
    return html`
        <header class="top">
            ${state ? html`<span class="glyph ${state}">${stateIcon(state, 26)}</span>` : nothing}
            <div class="titles">
                <h1>${title}</h1>
                <span class="detail">${detail || ""}</span>
            </div>
            <div class="tools">${actions}</div>
        </header>`;
}

function taskTop(view, shown) {
    const tools = html`
        ${iconButton("eraser", "Clear the log", clearLog)}`;

    const failing = shown.filter(t => taskState(t) === "error");
    if (failing.length) {
        const count = failing.reduce((sum, t) => sum + t.problems.length, 0);
        return top("error", count ? plural(count, "problem") : `${failing.map(t => t.label).join(", ")} down`, failing.map(t => t.detail).filter(Boolean).join(" · "), tools);
    }

    const busy = shown.filter(t => taskState(t) === "busy");
    if (busy.length)
        return top("busy", busy[0].detail ? `${busy[0].label} · ${busy[0].detail}` : busy.map(t => t.label).join(", "), "", tools);

    return top("ok", view === "frontend" ? "All compiled" : "Running", "", tools);
}

function taskMeta(t) {
    return taskState(t) === "ok" && t.took != null ? duration(t.took) : (t.detail || t.status).replace(/^https?:\/\//, "");
}

function packageTiles(shown) {
    const packages = new Map();
    // One-shot steps (npm ci in a worktree) only matter while they run or when they failed.
    for (const t of shown.filter(t => !t.once || taskState(t) !== "ok")) {
        const name = packageOf(t.key);
        packages.set(name, [...packages.get(name) ?? [], t]);
    }

    return [...packages].map(([name, tasks]) => tasks.length > 1 ? packageTile(name, tasks) : tile(tasks[0]));
}

function packageTile(name, tasks) {
    const key = `package:${name}`;
    const state = groupState(tasks);
    const failing = tasks.filter(t => taskState(t) === "error");
    const busy = tasks.find(t => taskState(t) === "busy");
    const problemCount = failing.reduce((sum, t) => sum + t.problems.length, 0);
    const meta = failing.length ? (problemCount ? plural(problemCount, "problem") : failing.map(t => t.detail).join(" · ")) : busy ? `${stepLabels[taskKind(busy.key)] ?? busy.label} · ${busy.detail || busy.status}` : duration(tasks.reduce((sum, t) => sum + (t.took ?? 0), 0));
    return html`
        <div class="tile package-tile ${ui.filter === key ? "selected" : ""} ${state}">
            <button class="package-head" title=${ui.filter === key ? "Show every log" : `Show only the ${name} logs`} @click=${() => toggleFilter(key)}>
                <span class="tile-icon" style="--tint: var(--tint-${name})">${icon("package", 18)}</span>
                <span class="tile-text">
                    <span class="tile-name">${name}</span>
                    <span class="tile-meta">${meta}</span>
                </span>
                <span class="tile-state ${state}">${stateIcon(state, 14)}</span>
            </button>
            <span class="steps">
                ${tasks.map(t => html`
                    <button class="step ${taskState(t)} ${ui.filter === t.key ? "selected" : ""}" title=${`${t.label} · ${taskMeta(t)}${ui.filter === t.key ? "" : " · click to show only its log"}`} @click=${() => toggleFilter(t.key)}>
                        ${stateIcon(taskState(t), 12)}<span>${stepLabels[taskKind(t.key)] ?? t.label}</span>
                    </button>`)}
            </span>
        </div>`;
}

function tile(t) {
    const state = taskState(t);
    const meta = taskMeta(t);
    return html`
        <button class="tile ${ui.filter === t.key ? "selected" : ""} ${state}" title=${ui.filter === t.key ? "Show every log" : `Show only the ${t.label} log`} @click=${() => toggleFilter(t.key)}>
            <span class="tile-icon" style="--tint: var(--tint-${taskKind(t.key)})">${icon(taskIcons[taskKind(t.key)] ?? "cog", 18)}</span>
            <span class="tile-text">
                <span class="tile-name">${t.label}</span>
                <span class="tile-meta">${meta}</span>
            </span>
            <span class="tile-state ${state}">${stateIcon(state, 14)}</span>
        </button>`;
}

function problems(list) {
    if (!list.length)
        return nothing;

    return html`
        <section class="problems">
            ${list.map(p => html`
                <button class="problem" title="Open in VS Code" @click=${() => openFile(p)}>
                    <span class="problem-icon">${icon("alert", 16)}</span>
                    <span class="problem-text"><span class="problem-message">${p.message}</span><span class="problem-where">${problemLocation(p)}</span></span>
                    ${p.file ? icon("open", 16) : nothing}
                </button>`)}
        </section>`;
}

function logView(view) {
    const entries = data.log.filter(e => ui.filter ? shownByFilter(e.task) : data.tasks.find(t => t.key === e.task)?.group === view);
    return html`
        <section class="sheet log" id="log" @scroll=${e => trackFollow(e, "follow")}>
            ${entries.length ? entries.map(e => html`
                <div class="line ${e.text.includes("\x1b") ? "" : e.level}">
                    <span class="line-dot" style="--tint: var(--tint-${taskKind(e.task)})" title=${e.task}></span>
                    <span class="line-time">${e.time}</span>
                    <span class="line-text">${ansi(e.text)}</span>
                </div>`) : html`<div class="empty">${icon("terminal", 28)}</div>`}
        </section>`;
}

function taskView(view) {
    const shown = tasksIn(view);
    const list = shown.filter(t => shownByFilter(t.key)).flatMap(t => t.problems.map(p => ({ task: t.key, ...p })));
    return html`
        ${taskTop(view, shown)}
        <div class="page">
            <div class="tiles">${packageTiles(shown)}</div>
            ${problems(list)}
            ${logView(view)}
        </div>`;
}

function progressItems(run) {
    const tests = testsOf(run);
    return run.files.flatMap(file => {
        const ofFile = tests.filter(t => t.spec === file.file);
        if (ofFile.length || ["passed", "failed", "cancelled"].includes(file.status))
            return ofFile;

        const status = file.status === "skipped" ? "not run" : "pending";
        return Array.from({ length: data.catalog.get(file.file)?.tests.length ?? 0 }, () => ({ status }));
    });
}

function progressBar(run) {
    const items = run ? progressItems(run) : [];
    const order = [["passed", "var(--ok)"], ["flaky", "var(--warn)"], ["failed", "var(--error)"], ["skipped", "var(--faint)"], ["not run", "var(--faint)"], ["running", "var(--accent)"]];
    return html`
        <div class="progress" role="progressbar" aria-label="Test progress">
            ${order.map(([status, color]) => {
                const count = items.filter(i => i.status === status).length;
                return count ? html`<span style="flex: ${count}; background: ${color}"></span>` : nothing;
            })}
            <span style="flex: ${items.filter(i => i.status === "pending").length}"></span>
        </div>`;
}

function remaining(run, total, done) {
    const ended = testsOf(run).map(t => t.ended).filter(Boolean);
    if (run.status !== "running" || !done || !ended.length || done >= total)
        return "";

    const last = Math.max(...ended);
    const left = (last - run.started) / done * (total - done) - (Date.now() - last);
    return `~${elapsed(Math.max(0, left))} left`;
}

function testTop(run, busy) {
    const tools = html`
        ${runToggle("failFast", "zap", "Fail fast", "Stop the run at the first failure")}
        ${runToggle("retryFlaky", "repeat", "Retry flaky", "Retry failed tests up to twice")}
        ${iconButton(ui.showOutput ? "list" : "terminal", ui.showOutput ? "Show the tests" : "Show the output", () => { ui.showOutput = !ui.showOutput; ui.outputFollow = true; update(); }, { active: ui.showOutput, disabled: !run })}
        ${busy
            ? html`<button class="run-all stop" title="Stop the run" @click=${stopRun}>${icon("stop", 16)}<span>Stop</span></button>`
            : runButton()}`;

    if (!run)
        return top("off", "No runs yet", "", tools);

    const c = counts(testsOf(run));
    const took = run.started ? elapsed(run.took ?? Date.now() - run.started) : "";
    if (run.status === "queued")
        return top("busy", "Queued", data.blockers.length ? `Waiting for ${data.blockers.join(", ")}` : "", tools);

    if (run.status === "running") {
        const items = progressItems(run);
        const done = items.filter(i => i.status !== "pending" && i.status !== "running").length;
        if (items.length && done === items.length)
            return top("busy", "Finishing up", `${took} elapsed`, tools);

        return top(runState(run), `${done} / ${items.length}`, [c.failed ? `${c.failed} failed` : "", `${took} elapsed`, remaining(run, items.length, done)].filter(Boolean).join(" · "), tools);
    }

    if (run.status === "cancelled")
        return top("off", "Stopped", `${c.passed} passed · ${took}`, tools);

    if (run.status === "passed")
        return top("ok", `${plural(c.passed, "test")} passed`, took, tools);

    return top("error", c.failed ? `${c.failed} failed` : "Failed", `${c.passed} passed · ${took}`, tools);
}

function testIcon(status) {
    const state = testState(status);
    return html`<span class="test-state ${state}">${state === "queued" || state === "off" ? html`<span class="hollow"></span>` : stateIcon(state === "warn" ? "ok" : state, 14)}</span>`;
}

function setAllFolders(open) {
    ui.open = Object.fromEntries(folderPaths(buildTree(data.specFiles)).map(path => [path, open]));
    update();
}

const rowSegments = [["passed", "var(--ok)"], ["flaky", "var(--warn)"], ["failed", "var(--error)"], ["skipped", "var(--faint)"], ["running", "var(--accent)"]];

function rowProgress(files, index, status) {
    if (status !== "running" && status !== "queued")
        return nothing;

    const tests = files.flatMap(f => data.catalog.get(f)?.tests ?? []);
    const counts = Object.fromEntries(rowSegments.map(([status]) => [status, 0]));
    for (const test of tests) {
        const status = index.results.get(test.id)?.status;
        if (status in counts)
            counts[status]++;
    }

    const touched = Object.values(counts).reduce((sum, n) => sum + n, 0);
    if (!touched)
        return nothing;

    return html`
        <span class="node-progress" aria-hidden="true">
            ${rowSegments.map(([status, color]) => counts[status] ? html`<span style="flex: ${counts[status]}; background: ${color}"></span>` : nothing)}
            <span style="flex: ${tests.length - touched}"></span>
        </span>`;
}

function explorer(rows, selected, index) {
    return html`
        <section class="sheet tree">
            <div class="sheet-head">
                <span class="sheet-title">${plural(testCount(data.specFiles), "test")}</span>
                ${iconButton("expand", "Expand every folder", () => setAllFolders(true))}
                ${iconButton("collapse", "Collapse every folder", () => setAllFolders(false))}
            </div>
            <div class="scroll">
                ${rows.map(row => {
                    const name = row.folder ? row.folder.name : row.file.split("/").at(-1).replace(/\.spec\.ts$/, "");
                    const click = row.folder ? () => { ui.open = { ...ui.open, [row.folder.path]: !row.open }; update(); } : () => chooseFile(row.file);
                    const run = row.folder ? () => runFolder(row.folder) : () => runFile(row.file);
                    return html`
                        <div class="node ${row.file && row.file === selected ? "selected" : ""} ${ui.contextMenu?.target === row.key ? "menu-target" : ""}" style="--depth: ${row.depth}" @click=${click} @dblclick=${run} @contextmenu=${e => openContextMenu(e, rowMenuItems(row, run), row.key)}>
                            <span class="chevron ${row.open ? "open" : ""}">${row.folder ? icon("chevron", 14) : nothing}</span>
                            <span class="node-icon ${row.folder ? "folder" : "spec"} ${testState(row.status)}">${icon(row.folder ? (row.open ? "folderOpen" : "folder") : "flask", 17)}</span>
                            <span class="node-name">${name}</span>
                            ${rowProgress(row.files, index, row.status)}
                            <button class="node-run" title="Run" aria-label=${`Run ${name}`} @click=${e => { e.stopPropagation(); run(); }}>${icon("play", 13)}</button>
                        </div>`;
                })}
            </div>
        </section>`;
}

function failureFor(row) {
    const errors = row?.result?.errors ?? [];
    if (!errors.length)
        return nothing;

    const where = errors.find(e => e.location)?.location ?? { file: row.test.file, line: row.test.line, column: row.test.column };
    return html`
        <div class="failure">
            <pre>${errors.map(e => e.message).join("\n\n")}</pre>
            <button class="failure-open" @click=${() => openFile(where)}>${icon("open", 14)} ${shortPath(where.file)}:${where.line}</button>
        </div>`;
}

function fileErrors(file) {
    const errors = runsList().flatMap(r => r.errors ?? []).filter(e => specOf(e.file ?? "") === file);
    return errors.length ? html`<div class="failure"><pre>${errors.map(e => e.message).join("\n\n")}</pre></div>` : icon("file", 28);
}

function testList(file, rows, cursor) {
    const entry = file ? data.catalog.get(file) : null;
    const loading = file && (!entry || entry.status === "loading");
    return html`
        <section class="sheet tests">
            <div class="sheet-head">
                <span class="sheet-title">${file ? shortPath(file).replace(/\.spec\.ts$/, "") : ""}</span>
                ${file ? html`${iconButton("open", "Open in VS Code", () => openFile({ file }))}${iconButton("play", "Run this file", () => runFile(file))}` : nothing}
            </div>
            <div class="scroll">
                ${rows.length ? rows.map((row, i) => {
                    const parts = row.test.title.split(" › ");
                    const selected = i === cursor;
                    return html`
                        <div class="test ${selected ? "selected" : ""} ${ui.contextMenu?.target === row.test.id ? "menu-target" : ""}" @click=${() => { ui.testId = selected ? "" : row.test.id; update(); }} @dblclick=${() => runTest(row.test)} @contextmenu=${e => openContextMenu(e, testMenuItems(row.test, row.result?.status), row.test.id)}>
                            ${testIcon(row.status)}
                            <span class="test-title">${parts.length > 1 ? html`<span class="test-scope">${parts.slice(0, -1).join(" › ")}</span>` : nothing}<span class="test-name">${parts.at(-1)}</span></span>
                            <span class="test-time">${row.result?.duration != null ? duration(row.result.duration) : ""}</span>
                            <button class="node-run" title="Run" aria-label="Run this test" @click=${e => { e.stopPropagation(); runTest(row.test); }}>${icon("play", 13)}</button>
                        </div>
                        ${selected && row.status === "failed" ? failureFor(row) : nothing}`;
                }) : html`<div class="empty">${loading ? spinner(24) : file ? fileErrors(file) : icon("file", 28)}</div>`}
            </div>
        </section>`;
}

function outputLineClass(text) {
    if (text.startsWith("──"))
        return "accent";

    // A passed test stays plain, also when its title says "Error" or "failed"
    if (/^\s*ok\s/.test(text))
        return "";

    return /^\s*x\s|✘|Error|failed/.test(text) ? "error" : "";
}

function outputView() {
    return html`
        <section class="sheet log output" id="output" @scroll=${e => trackFollow(e, "outputFollow")}>
            ${ui.output.length ? ui.output.map(line => html`<div class="line ${outputLineClass(line.text)}"><span class="line-text">${line.text}</span></div>`) : html`<div class="empty">${spinner(24)}</div>`}
        </section>`;
}

function testView() {
    const run = currentRun();
    const index = resultIndex();
    const selected = selectedFile();
    if (selected && !data.catalog.has(selected) && !ui.requested.has(selected)) {
        ui.requested.add(selected);
        act("load-tests", { file: selected, refresh: false });
    }

    const entry = selected ? data.catalog.get(selected) : null;
    const listed = entry?.tests.length ? entry.tests : run ? testsOf(run).filter(t => specOf(t.spec) === selected) : [];
    const rows = listed.map(test => {
        const result = index.results.get(test.id);
        return { test, result, status: displayStatus(result) };
    });
    const chosen = rows.findIndex(r => r.test.id === ui.testId);
    const cursor = ui.testId === "" ? -1 : chosen >= 0 ? chosen : rows.findIndex(r => r.status === "failed");
    const busy = runsList().some(r => r.status === "running" || r.status === "queued");

    return html`
        ${testTop(run, busy)}
        ${progressBar(run)}
        <div class="page">
            <div class="split">
                ${explorer(explorerRows(index, selected), selected, index)}
                ${ui.showOutput ? outputView() : testList(selected, rows, cursor)}
            </div>
        </div>`;
}

function title() {
    const state = !ui.connected ? "offline" : groupState(data.tasks);
    return `Dev Supervisor${ui.workspace ? ` · ${ui.workspace}` : ""}${state === "ok" ? "" : state === "busy" ? " · building" : state === "error" ? " · problems" : ` · ${state}`}`;
}

function content() {
    switch (ui.view) {
        case "test": return testView();
        default: return taskView(ui.view);
    }
}

function draw() {
    document.title = title();
    if (!data.instance) {
        render(html`<div class="booting">${spinner(28)}</div>`, document.body);
        return;
    }

    render(html`
        ${rail()}<main>${content()}</main>
        ${ui.view === "test" ? contextMenu() : nothing}
        ${ui.connected ? nothing : html`<div class="offline">${spinner(28)}<span>Reconnecting</span></div>`}
        ${ui.notice ? html`<div class="notice">${ui.notice}</div>` : nothing}`, document.body);

    follow(document.getElementById("log"), ui.follow);
    follow(document.getElementById("output"), ui.outputFollow);
}

document.addEventListener("pointerdown", e => {
    if (ui.workspaceMenu && !e.target.closest?.(".workspace-picker")) {
        ui.workspaceMenu = false;
        update();
    }

    if (ui.runMenu && !e.target.closest?.(".split-button")) {
        ui.runMenu = false;
        update();
    }

    if (!e.target.closest?.(".context-menu"))
        closeContextMenu();
});

window.addEventListener("blur", closeContextMenu);
document.addEventListener("wheel", closeContextMenu, { capture: true, passive: true });

document.addEventListener("keydown", e => {
    if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey)
        return;

    const view = views[Number(e.key) - 1];
    if (view)
        showView(view.key);
    else if (e.key === "Escape") {
        if (ui.contextMenu || ui.runMenu) {
            ui.contextMenu = null;
            ui.runMenu = false;
            update();
            return;
        }

        ui.showOutput = false;
        update();
    }
});

setInterval(() => {
    if (ui.connected && runsList().some(r => r.status === "running"))
        update();
}, 1000);

draw();
poll();
pollOutput();
