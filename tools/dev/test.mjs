import { supervisorApi } from './protocol.mjs';

let run = null;
let scope = '';

async function call(action, options) {
    const response = await fetch(`${supervisorApi}/${action}`, { cache: 'no-store', ...options });
    if (!response.ok)
        throw new Error(`${action} answered ${response.status}`);

    return response.json();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

process.on('SIGINT', async () => {
    if (run)
        await fetch(`${supervisorApi}/cancel${scope}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: run }) }).catch(() => {});

    process.exit(130);
});

try {
    const created = await call('run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) });
    run = created.id;
    scope = created.workspace ? `?workspace=${encodeURIComponent(created.workspace)}` : '';
} catch {
    console.error('npm run dev is not running (the dev supervisor on localhost:5000 does not answer). Start it, then run the tests again.');
    process.exit(1);
}

let after = -1;
let failures = 0;
for (;;) {
    try {
        const output = await call(`output?id=${run}&after=${after}${scope.replace('?', '&')}`);
        failures = 0;
        for (const line of output.lines) {
            process.stdout.write(`${line.text}\n`);
            after = line.id;
        }

        if (output.done)
            process.exit(output.exitCode ?? 1);
    } catch {
        if (++failures > 60) {
            console.error('Lost the dev supervisor (the backend restarted or stopped); the run is gone.');
            process.exit(1);
        }
    }

    await sleep(300);
}
