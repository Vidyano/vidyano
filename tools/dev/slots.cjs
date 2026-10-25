// Loaded with --require into the Playwright processes of the dev supervisor's test runs (see TestSlots.cs). The specs get
// slots-test.mjs for @playwright/test, whose `test` has one automatic fixture that waits for a test slot before every test
// and lets go of it after, so the runs of all checkouts together run at most the supervisor's budget of tests at once,
// and a run takes over the slots of another as soon as that one's tests end.
const { registerHooks } = require('module');
const { pathToFileURL } = require('url');
const path = require('path');

const run = process.env.VIDYANO_DEV_RUN;
const api = process.env.VIDYANO_DEV_SLOTS;

async function post(action) {
    return fetch(`${api}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ run, pid: process.pid }) });
}

async function acquire() {
    for (;;) {
        // A supervisor that cannot be reached or knows no slots holds nothing back
        let response;
        try {
            response = await post('slot');
        } catch {
            return;
        }

        if (!response.ok || (await response.json()).granted)
            return;
    }
}

async function release() {
    try {
        await post('slot-release');
    } catch {
    }
}

exports.gate = function (test) {
    return test.extend({
        // Its own timeout of 0 keeps the wait for a slot out of the test's timeout
        devSlot: [async ({}, use) => {
            await acquire();
            try {
                await use();
            } finally {
                await release();
            }
        }, { auto: true, timeout: 0 }]
    });
};

// The specs are ES modules and their helpers may be CommonJS; a resolve hook serves both
if (run && api) {
    const gated = pathToFileURL(path.join(__dirname, 'slots-test.mjs')).href;
    // The Playwright of the checkout that runs (its root is the working directory), not that of the main checkout, which
    // holds this file for the worktrees too: two Playwrights in one run refuse each other's tests
    // Its ES module entry (exports['./test'].import): the CommonJS one shows ES modules no named exports
    const playwright = pathToFileURL(path.join(path.dirname(require.resolve('playwright/package.json', { paths: [process.cwd()] })), 'test.mjs')).href;
    registerHooks({
        resolve(specifier, context, nextResolve) {
            if (specifier === '@playwright/test')
                return { url: gated, shortCircuit: true };

            if (specifier === 'vidyano-dev-playwright')
                return { url: playwright, shortCircuit: true };

            return nextResolve(specifier, context);
        }
    });
}
