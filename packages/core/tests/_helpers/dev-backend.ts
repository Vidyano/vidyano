import { execFileSync } from 'child_process';

let refusal: string | null | undefined;

// Whether the dev supervisor of npm run dev answers, asked from a child process because the fixtures need the URL synchronously
function supervisorAnswers(url: string): boolean {
    const probe = `fetch(${JSON.stringify(`${url}/api/supervisor/status`)}, { signal: AbortSignal.timeout(2000) }).then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))`;
    try {
        execFileSync(process.execPath, ['-e', probe], { stdio: 'ignore', timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

/**
 * The URL of the dev backend (`npm run dev`) that the core specs run against. The dev supervisor passes it to its test
 * runs, and a worktree's runs get the worktree's own; outside the supervisor it is http://localhost:5000.
 *
 * The supervisor's test runs of the main checkout use that backend too, so a direct Playwright run of these specs is
 * refused while npm run dev is running, unless VIDYANO_DIRECT=1. CI runs are never refused.
 */
export function devBackendUrl(): string {
    const url = process.env.VIDYANO_BACKEND_URL || 'http://localhost:5000';
    if (refusal === undefined)
        refusal = !process.env.VIDYANO_DEV_EVENTS && !process.env.VIDYANO_DIRECT && !process.env.CI && supervisorAnswers(url)
            ? `npm run dev is running, and this spec uses its shared dev backend (${url}), which the dev supervisor's test runs use too. Run it with npm run test:dev -- <specs>, which queues it in the dev supervisor, or set VIDYANO_DIRECT=1 to run it directly anyway.`
            : null;

    if (refusal)
        throw new Error(refusal);

    return url;
}
