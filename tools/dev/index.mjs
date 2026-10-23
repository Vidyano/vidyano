import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { supervisorApi } from './protocol.mjs';
import { ensureDependencies, root } from './setup.mjs';

const project = 'dev/Dev.csproj';
const sources = path.join(root, 'dev');
const backendSource = /\.(cs|csproj)$|^App_Data[\\/](Model[\\/]|[^\\/]+\.json$)/;
const ignored = /^(bin|obj|wwwroot|Supervisor)[\\/]/;
const crashRestartMs = 3000;
// A restart ends every test run, so it waits for them, but not forever
const maxDeferMs = 10 * 60000;

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

// The supervisor's queued and running test runs, which a restart would end; none when it does not answer
async function activeRuns() {
    try {
        const response = await fetch(`${supervisorApi}/busy`, { cache: 'no-store', signal: AbortSignal.timeout(2000) });
        return response.ok ? (await response.json()).runs ?? [] : [];
    } catch {
        return [];
    }
}

async function restart(file) {
    changedFile = file;
    if (deferring)
        return;

    deferring = true;
    const deadline = Date.now() + maxDeferMs;
    let waitingFor = '';
    for (let runs = await activeRuns(); runs.length > 0 && !stopping; runs = await activeRuns()) {
        if (Date.now() > deadline) {
            step(`Test runs are still active after ${maxDeferMs / 60000} minutes; restarting the backend anyway`);
            break;
        }

        const active = runs.map(run => `run #${run.id} in ${run.workspace}`).join(', ');
        if (active !== waitingFor) {
            waitingFor = active;
            step(`${changedFile} changed; deferring the backend restart until ${active} ${runs.length === 1 ? 'finishes' : 'finish'}`);
        }

        await sleep(2000);
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

watch();
start();
