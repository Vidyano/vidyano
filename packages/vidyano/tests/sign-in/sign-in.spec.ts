import { test, expect, Page, Locator } from '@playwright/test';
import { startBackend, stopBackend, BackendProcess } from '../_helpers/backend';

/**
 * `vi-sign-in`'s passkey flows against a Vidyano 7 backend with passkeys on, in the full `vi-app` the backend serves,
 * with Chrome's virtual authenticator. Headless Chrome has no autofill list to pick a passkey from, so a spy on
 * `navigator.credentials.get` holds the conditional (autofill) request until a test picks the passkey; it also records
 * every request's mediation and abort signal.
 */

interface PasskeyRequest {
    mediation: string | null;
    signal: boolean;
    aborted: boolean;
}

function installPasskeySpy() {
    const spy = {
        requests: [] as { mediation: string | null; signal: AbortSignal | null; pick?: () => void; }[],
        availability: [] as ((available: boolean) => void)[],
        holdAvailability: false,
        cancelModal: false,
    };
    (window as any).__passkeys = spy;

    const get = navigator.credentials.get.bind(navigator.credentials);
    navigator.credentials.get = (options?: CredentialRequestOptions) => {
        const request: typeof spy.requests[number] = { mediation: options?.mediation ?? null, signal: options?.signal ?? null };
        spy.requests.push(request);

        if (options?.mediation !== 'conditional') {
            if (spy.cancelModal) {
                spy.cancelModal = false;
                return Promise.reject(new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError'));
            }

            return get(options);
        }

        if (options.signal?.aborted)
            return Promise.reject(options.signal.reason);

        return new Promise((resolve, reject) => {
            options.signal?.addEventListener('abort', () => reject(options.signal!.reason));
            request.pick = () => get({ publicKey: options.publicKey }).then(resolve, reject);
        });
    };

    PublicKeyCredential.isConditionalMediationAvailable = () => spy.holdAvailability ? new Promise(resolve => spy.availability.push(resolve)) : Promise.resolve(true);
}

let backend: BackendProcess | undefined;

test.describe.serial('SignIn passkeys', () => {
    let page: Page;
    let origin: string;
    let signIn: Locator;

    test.beforeAll(async ({ browser }, testInfo) => {
        backend = await startBackend(testInfo);
        origin = `http://localhost:${backend.port}`;

        page = await browser.newPage();
        signIn = page.locator('vi-sign-in');

        page.on('console', msg => {
            if (msg.type() === 'error')
                console.error(`[Browser] ${msg.text()}`);
        });

        await page.addInitScript(installPasskeySpy);
        await page.route('https://unpkg.com/@vidyano/vidyano/index.min.js', route => route.fulfill({ path: 'dev/wwwroot/index.js', contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
        await page.route('**/fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));

        const cdp = await page.context().newCDPSession(page);
        await cdp.send('WebAuthn.enable');
        await cdp.send('WebAuthn.addVirtualAuthenticator', {
            options: {
                protocol: 'ctap2',
                transport: 'internal',
                hasResidentKey: true,
                hasUserVerification: true,
                isUserVerified: true,
                automaticPresenceSimulation: true,
            }
        });

        // The passkey the tests sign in with
        await openSignIn();
        await page.evaluate(async () => {
            const service = (document.querySelector('vi-app') as any).service;
            await service.signInUsingCredentials('admin', 'admin');
            await service.registerPasskey('Test');
        });
    });

    test.afterAll(async () => {
        await page.close();
        await stopBackend(backend);
    });

    async function openSignIn() {
        await page.context().clearCookies();
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        }).catch(() => { });

        await page.goto(`${origin}/SignIn`);
        await expect(signIn.locator('section.username.active #username')).toBeVisible({ timeout: 10000 });
    }

    function passkeyRequests(): Promise<PasskeyRequest[]> {
        return page.evaluate(() => (window as any).__passkeys.requests.map((r: any) => ({ mediation: r.mediation, signal: !!r.signal, aborted: !!r.signal?.aborted })));
    }

    function changePath(path: string) {
        return page.evaluate(path => (document.querySelector('vi-app') as any).changePath(path), path);
    }

    async function expectSignedIn() {
        await expect(page).toHaveURL(`${origin}/`);
        expect(await page.evaluate(() => {
            const service = (document.querySelector('vi-app') as any).service;
            return service.isSignedIn && service.userName;
        })).toBe('admin');
    }

    const offered: PasskeyRequest = { mediation: 'conditional', signal: true, aborted: false };
    const withdrawn: PasskeyRequest = { mediation: 'conditional', signal: true, aborted: true };

    test('offers the passkey in the user name autofill', async () => {
        await openSignIn();

        await expect.poll(passkeyRequests).toEqual([offered]);
    });

    test('Next withdraws the autofill offer and Not you makes it again', async () => {
        await openSignIn();
        await expect.poll(passkeyRequests).toEqual([offered]);

        await signIn.locator('section.username #username').fill('admin');
        await signIn.locator('section.username .actions vi-button:not([inverse])').click();
        await expect(signIn.locator('section.password.active')).toBeVisible();
        await expect.poll(passkeyRequests).toEqual([withdrawn]);

        await signIn.locator('section.password .user vi-button').click();
        await expect(signIn.locator('section.username.active')).toBeVisible();
        await expect.poll(passkeyRequests).toEqual([withdrawn, offered]);
    });

    test('signs in with the passkey button', async () => {
        await openSignIn();
        await expect.poll(passkeyRequests).toEqual([offered]);

        await signIn.locator('section.username .passkey vi-button').click();

        await expectSignedIn();

        const [conditional, modal] = await passkeyRequests();
        expect(conditional).toEqual(withdrawn);
        expect(modal).toMatchObject({ mediation: null, signal: true });
    });

    test('a cancelled passkey prompt makes the autofill offer again', async () => {
        await openSignIn();
        await expect.poll(passkeyRequests).toEqual([offered]);

        await page.evaluate(() => (window as any).__passkeys.cancelModal = true);
        await signIn.locator('section.username .passkey vi-button').click();

        await expect.poll(passkeyRequests).toEqual([withdrawn, { mediation: null, signal: true, aborted: false }, offered]);
        await expect(page).toHaveURL(`${origin}/SignIn`);
        expect(await signIn.evaluate((node: any) => node.notification)).toBeNull();
    });

    test('leaving the route withdraws the autofill offer', async () => {
        await openSignIn();
        await expect.poll(passkeyRequests).toEqual([offered]);

        await changePath('SignIn/Home');

        await expect.poll(passkeyRequests).toEqual([withdrawn, offered]);
    });

    test('leaving the route while autofill availability is checked starts no request', async () => {
        await openSignIn();
        await expect.poll(passkeyRequests).toEqual([offered]);

        await page.evaluate(() => (window as any).__passkeys.holdAvailability = true);

        // The first route's check is still pending when the second one is left
        await changePath('SignIn/Home');
        await expect.poll(() => page.evaluate(() => (window as any).__passkeys.availability.length)).toBe(1);
        await changePath('SignIn/Other');
        await expect.poll(() => page.evaluate(() => (window as any).__passkeys.availability.length)).toBe(2);

        await page.evaluate(() => (window as any).__passkeys.availability[0](true));
        await page.evaluate(() => (window as any).__passkeys.availability[1](true));

        await expect.poll(passkeyRequests).toEqual([withdrawn, offered]);
    });

    test('an autofill sign-in completing after Next still navigates', async () => {
        await openSignIn();
        await expect.poll(passkeyRequests).toEqual([offered]);

        let held!: () => void;
        const isHeld = new Promise<void>(resolve => held = resolve);
        let release!: () => void;
        const released = new Promise<void>(resolve => release = resolve);

        await page.route('**/authenticate/passkey/assert', async route => {
            held();
            await released;
            await route.continue();
        });

        try {
            // Picked from the autofill list; the assertion is on its way to the service
            await page.evaluate(() => { (window as any).__passkeys.requests[0].pick(); });
            await isHeld;

            await signIn.locator('section.username #username').fill('admin');
            await signIn.locator('section.username .actions vi-button:not([inverse])').click();
            await expect(signIn.locator('section.password.active')).toBeVisible();
            await expect.poll(passkeyRequests).toEqual([withdrawn]);

            release();

            await expectSignedIn();
        }
        finally {
            release();
            await page.unroute('**/authenticate/passkey/assert');
        }
    });
});
