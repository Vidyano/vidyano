import { supervisorApi } from './protocol.mjs';

try {
    const response = await fetch(`${supervisorApi}/status`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) {
        console.error('The dev supervisor does not report status yet. Restart npm run dev.');
        process.exitCode = 1;
    }
    else {
        const status = await response.json();
        console.log(`server  ${status.server.status}  ${status.server.url}`);
        for (const task of status.tasks)
            console.log(`${task.key.padEnd(24)}${task.status.padEnd(10)}${task.detail ?? ''}${task.problems?.length ? ` (${task.problems.length} problems)` : ''}`);
    }
} catch {
    console.error('Cannot reach the dev supervisor. Start npm run dev, then try again.');
    process.exitCode = 1;
}
