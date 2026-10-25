import { randomUUID } from 'crypto';
import { supervisorApi } from './protocol.mjs';

const args = process.argv.slice(2);
let run = null;
let scope = '';
let instance = null;
let host = null;

async function call(action, options) {
    const response = await fetch(`${supervisorApi}/${action}`, { cache: 'no-store', ...options });
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `${action} answered ${response.status}`);
    }

    return response.json();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

process.on('SIGINT', async () => {
    if (run)
        await fetch(`${supervisorApi}/cancel${scope}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: run, instance }) }).catch(() => {});

    process.exit(130);
});

// A request sent again with the same key gets the run the supervisor already queued for it, so a lost answer never
// queues the run twice
async function queue(key) {
    const created = await call('run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args, cwd: process.cwd(), follow: true, key }) });
    run = created.id;
    scope = created.workspace ? `?workspace=${encodeURIComponent(created.workspace)}` : '';
    instance = created.instance;
    host = created.host;
}

function refused(e) {
    console.error(`The dev supervisor refused the run: ${e.message}`);
    process.exit(1);
}

try {
    await queue(randomUUID());
} catch (e) {
    // fetch throws a TypeError when nothing answers; an Error carries the supervisor's refusal
    if (e instanceof TypeError) {
        console.error('npm run dev is not running (the dev supervisor on localhost:5000 does not answer). Start it, then run the tests again.');
        process.exit(1);
    }

    refused(e);
}

// The output of the run, or null once the supervisor no longer has it: a restarted backend does not know the run, or
// numbers its runs from 1 again so the same id is another run
async function output(after) {
    const response = await fetch(`${supervisorApi}/output?id=${run}&after=${after}${scope.replace('?', '&')}`, { cache: 'no-store' });
    if (response.status === 404)
        return null;

    if (!response.ok)
        throw new Error(`output answered ${response.status}`);

    const result = await response.json();
    return result.instance === instance ? result : null;
}

// Whether the backend restarted since the run was queued, rather than the run or its worktree being stopped
async function restarted() {
    return (await call('busy')).host !== host;
}

let after = -1;
let failures = 0;
let started = false;
let requeue = null;
for (;;) {
    try {
        const current = requeue ? null : await output(after);
        if (current === null) {
            if (!requeue && !await restarted()) {
                console.error('The run was cancelled in the dev supervisor, or its worktree was stopped.');
                process.exit(1);
            }

            if (started) {
                console.error('The backend restarted during the run; the run is gone.');
                process.exit(1);
            }

            // The backend only restarts once no run is running (tools/dev/index.mjs), so a run that had not started yet
            // goes on the new one
            run = null;
            requeue ??= randomUUID();
            try {
                await queue(requeue);
            } catch (e) {
                if (!(e instanceof TypeError))
                    refused(e);

                throw e;
            }

            requeue = null;
            after = -1;
            failures = 0;
            console.log(`The backend restarted before the run started; queued it again as run #${run}`);
            continue;
        }

        failures = 0;
        started ||= current.status !== 'queued';
        for (const line of current.lines) {
            process.stdout.write(`${line.text}\n`);
            after = line.id;
        }

        if (current.done)
            process.exit(current.exitCode ?? 1);
    } catch {
        // A restart takes a while to build and start the backend again
        if (++failures > (started ? 60 : 1000)) {
            console.error(started ? 'Lost the dev supervisor (the backend restarted or stopped); the run is gone.' : 'The dev supervisor did not come back within 5 minutes; run the tests again once npm run dev is up.');
            process.exit(1);
        }
    }

    await sleep(300);
}
