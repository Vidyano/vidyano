import { execFile, spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { supervisorApi } from './protocol.mjs';
import { ensureDependencies, root } from './setup.mjs';

const project = 'dev/Dev.csproj';
const sources = path.join(root, 'dev');
const backendSource = /\.(cs|csproj)$|^App_Data[\\/](Model[\\/]|[^\\/]+\.json$)/;
const ignored = /^(bin|obj|wwwroot|Supervisor)[\\/]/;
const crashRestartMs = 3000;
// A Playwright test run's main process, also started through npm's .bin link; not a --list, which the supervisor runs
// to find the tests in a spec
const playwrightRun = /(playwright[\\/](test[\\/])?cli\.js|\.bin[\\/]playwright(\.cmd)?)["']?\s+test(?=\s|$)(?!.*\s--list(\s|$))/i;
// How long no test may run before a restart: npm test starts its second half a second or two after the first ends
const quietMs = 5000;
// Where the supervisor keeps the runs queued without a client while a restart is held (see Worktrees.Hold)
const heldRunsFile = 'node_modules/.cache/vidyano-dev/held-runs.json';

let backend = null;
let deferring = false;
let changedFile = null;
let restarting = false;
let stopping = false;
let startedAt = 0;
let pending = null;

function step(message) {
    console.log(`\x1b[36m◆\x1b[0m ${message}`);
}

function start() {
    step('Starting the backend (dotnet run)');
    startedAt = Date.now();
    backend = spawn('dotnet', ['run', '--project', project], { cwd: root, stdio: 'inherit', env: { ...process.env, VIDYANO_NODE: process.execPath, VIDYANO_DEV_PARENT: String(process.pid) } });
    backend.on('exit', code => {
        backend = null;
        if (stopping)
            return;

        if (restarting) {
            restarting = false;
            start();
        }
        else if (Date.now() - startedAt > 20000) {
            step(`The backend exited with code ${code}; restarting`);
            setTimeout(() => backend || stopping || start(), crashRestartMs);
        }
        else
            step(`The backend exited with code ${code}; it restarts when a backend file changes`);
    });
}

function kill(child) {
    if (process.platform === 'win32')
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else
        child.kill('SIGTERM');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Nothing listens when the backend is still building or has stopped, so no test can be running on it
function refused(error) {
    return error?.cause?.code === 'ECONNREFUSED';
}

// Has the supervisor start no more queued runs until the restart, so the running ones are the last it waits for:
// 'held', 'down' when nothing listens, or 'unknown' when it does not answer or knows no hold yet (an older backend)
async function hold(reason) {
    try {
        const response = await fetch(`${supervisorApi}/hold`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }), signal: AbortSignal.timeout(5000) });
        return response.ok ? 'held' : 'unknown';
    } catch (e) {
        return refused(e) ? 'down' : 'unknown';
    }
}

// The supervisor's runs of every checkout that a restart would end, and whether it holds its queued runs. A held run
// waits for the restart and is queued again on the new backend (see Worktrees.Hold). A supervisor that does not answer
// may still be running tests.
async function supervisorRuns() {
    try {
        const response = await fetch(`${supervisorApi}/busy`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (!response.ok)
            return { runs: ['the test runs of the supervisor, which does not answer'], held: false };

        const busy = await response.json();
        return { runs: (busy.runs ?? []).filter(run => !busy.held || run.status === 'running').map(run => `run #${run.id} in ${run.workspace}`), held: !!busy.held };
    } catch (e) {
        return { runs: refused(e) ? [] : ['the test runs of the supervisor, which does not answer'], held: false, down: refused(e) };
    }
}

// Playwright runs started outside the supervisor (npm test, npx playwright test), which use the backend too; processes
// that cannot be listed may be such runs
function playwrightRuns() {
    const [file, args] = process.platform === 'win32'
        ? ['powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }`]]
        : ['ps', ['-eo', 'pid=,args=']];
    return new Promise(resolve => execFile(file, args, { encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
        if (error)
            resolve(['the Playwright runs outside the supervisor, which cannot be listed']);
        else
            resolve(stdout.split(/\r?\n/).map(line => line.trim().match(/^(\d+)\s+(.*)$/)).filter(match => match && playwrightRun.test(match[2])).map(match => `Playwright (process ${match[1]})`));
    }));
}

async function activeRuns() {
    const supervised = await supervisorRuns();
    // Listing the processes starts powershell, which running tests would feel, so only once the supervisor is idle
    return { runs: supervised.runs.length > 0 ? supervised.runs : await playwrightRuns(), held: supervised.held };
}

async function restart(file) {
    changedFile = file;
    if (deferring)
        return;

    // A restart ends every test run, so it waits for all of them, however long they take, until no test ran for a while;
    // a backend that is not running has none left to end
    deferring = true;
    let held = backend ? await hold(`${file} changed`) : 'down';
    // An older backend knows no hold; then the queued runs count as active instead
    let holds = held === 'held';
    let waitingFor = '';
    let quietSince = null;
    while (backend && held !== 'down' && !stopping) {
        const active = await activeRuns();
        const runs = active.runs.join(', ');
        const changed = runs !== waitingFor;
        waitingFor = runs;
        if (changed && runs)
            step(`${changedFile} changed; deferring the backend restart until ${runs} ${active.runs.length === 1 ? 'finishes' : 'finish'} (stop and start npm run dev to restart now)`);

        // Held runs show the reason, so it says what the restart waits for; a backend that restarted on its own in the
        // meantime holds nothing
        if (changed || held !== 'held' || !active.held) {
            held = await hold(`${changedFile} changed${runs ? `; waiting for ${runs}` : ''}`);
            holds ||= held === 'held';
        }

        if (active.runs.length > 0)
            quietSince = null;
        else if (Date.now() - (quietSince ??= Date.now()) >= quietMs) {
            // The last word goes to the supervisor, right before the restart; one that restarted on its own since holds
            // nothing, and could start a queued run any moment
            const last = await supervisorRuns();
            if (last.down || last.runs.length === 0 && (last.held || !holds))
                break;
        }

        await sleep(1000);
    }

    deferring = false;
    if (stopping)
        return;

    step(`${changedFile} changed; restarting the backend`);
    if (backend) {
        restarting = true;
        kill(backend);
    }
    else
        start();
}

function modified(name) {
    try {
        return fs.statSync(path.join(sources, name)).mtimeMs;
    } catch {
        return null;
    }
}

function watch() {
    const watchedAt = Date.now();
    const seen = new Map();
    fs.watch(sources, { recursive: true }, (event, name) => {
        if (!name || ignored.test(name) || !backendSource.test(name))
            return;

        const mtime = modified(name);
        const unchanged = seen.has(name) ? seen.get(name) === mtime : mtime !== null && mtime < watchedAt;
        if (unchanged)
            return;

        seen.set(name, mtime);
        clearTimeout(pending);
        pending = setTimeout(() => restart(`dev/${name.replaceAll('\\', '/')}`), 500);
    });
}

async function stop() {
    if (stopping)
        process.exit(1);

    stopping = true;
    step('Stopping');
    if (backend) {
        const exited = new Promise(resolve => backend.once('exit', resolve));
        const timeout = new Promise(resolve => setTimeout(resolve, 10000));
        if (await Promise.race([exited.then(() => true), timeout.then(() => false)]) === false && backend)
            kill(backend);
    }

    // The runs held for a restart that is not coming; the next npm run dev must not run them
    fs.rmSync(path.join(root, heldRunsFile), { force: true });
    process.exit(0);
}

async function running() {
    try {
        await fetch('http://localhost:5000', { method: 'HEAD', signal: AbortSignal.timeout(2000) });
        return true;
    } catch {
        return false;
    }
}

if (await running()) {
    console.log('A backend already answers on http://localhost:5000; its supervisor is at http://localhost:5000/supervisor/');
    process.exit(0);
}

ensureDependencies();

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// Runs held for a restart of an earlier npm run dev that ended without stop(), e.g. a closed terminal
fs.rmSync(path.join(root, heldRunsFile), { force: true });
watch();
start();
