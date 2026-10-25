import { test, expect, Page, Locator, Request } from '@playwright/test';

/**
 * `vi-consent` against a scripted `connect/consent/{requestId}`: no backend, the service is a mock with a session
 * (userName/authToken) and the OAuth endpoint is answered by Playwright routes. Covers what the screen shows, the exact
 * decision request it sends, the redirect that follows, and the expired / lost-session paths.
 */

const origin = 'http://localhost:4444';
const callback = 'http://127.0.0.1:6274/oauth/callback';

const consentRequest = {
    requestId: 'req-1',
    clientId: 'mcp-inspector',
    clientName: 'MCP Inspector',
    redirectUri: callback,
    redirectHost: '127.0.0.1:6274',
    isLoopback: true,
    resource: `${origin}/mcp`,
    scopes: [
        { name: 'vidyano.read', description: 'Read data you have access to' },
        { name: 'vidyano.write', description: 'Propose and make changes you are allowed to make' },
    ],
};

interface Scripted {
    get?: { status: number; body: unknown };
    decide?: (request: Request) => { status: number; body: unknown };
}

const testHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :root { --theme-h1: 40px; --theme-h2: 32px; --theme-h3: 22px; --theme-h4: 12px; --theme-h5: 6px; --theme-foreground: #333; --theme-color-error: #a80511; --theme-color-warning: #e5a300; --theme-box-shadow: none; --color: #1a73e8; --color-dark: #1557b0; }
          :not(:defined) { display: none; }
          body { margin: 0; }
        </style>
      </head>
      <body>
        <div id="test-container"></div>
      </body>
    </html>`;

async function setupPage(page: Page, scripted: Scripted = {}): Promise<{ consent: Locator; decisions: Request[] }> {
    const decisions: Request[] = [];

    await page.route(`${origin}/**`, route => {
        const request = route.request();
        const url = new URL(request.url());

        if (url.pathname === '/test-page')
            return route.fulfill({ contentType: 'text/html', body: testHtml });

        if (url.pathname === '/connect/consent/req-1') {
            if (request.method() === 'POST') {
                decisions.push(request);
                const answer = scripted.decide?.(request) ?? { status: 200, body: { redirectUri: `${callback}?code=vac_code&state=xyz` } };
                return route.fulfill({ status: answer.status, contentType: 'application/json', body: JSON.stringify(answer.body) });
            }

            const answer = scripted.get ?? { status: 200, body: consentRequest };
            return route.fulfill({ status: answer.status, contentType: 'application/json', body: JSON.stringify(answer.body) });
        }

        return route.fulfill({ status: 404, body: 'not found' });
    });

    // The application's redirect URI: the browser lands here with the code (or the error) after the decision.
    await page.route(`${callback}**`, route => route.fulfill({ contentType: 'text/html', body: '<!DOCTYPE html><html><body>callback</body></html>' }));

    await page.goto(`${origin}/test-page`);
    await page.addScriptTag({ path: 'dev/wwwroot/index.js', type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-consent'), { timeout: 10000 });

    await page.evaluate(({ origin }) => {
        const Vidyano = (window as any).Vidyano;

        class MockLanguage extends Vidyano.Observable {
            culture = 'en';
            messages = { NotYou: 'Not you?' };
        }

        class MockService extends Vidyano.Observable {
            serviceUri = origin;
            userName = 'alice';
            authToken = 'abc/def+g=';
            application = { friendlyUserName: 'Alice Example' };
            language = new MockLanguage();
            hooks = { onFetch: (request: Request) => fetch(request) };
        }

        const calls = { signIn: 0, signOut: 0 };
        (window as any).__calls = calls;

        const app = {
            service: new MockService(),
            redirectToSignIn: () => { calls.signIn++; },
            redirectToSignOut: () => { calls.signOut++; },
            changePath: () => { },
            addEventListener: () => { },
            removeEventListener: () => { },
        };
        (window as any).app = app;
        (window as any)[Symbol.for('Vidyano.App')] = app;

        const consent = document.createElement('vi-consent');
        consent.id = 'consent';
        document.getElementById('test-container')!.appendChild(consent);
    }, { origin });

    return { consent: page.locator('#consent'), decisions };
}

async function activate(consent: Locator, requestId: string | null = 'req-1') {
    await consent.evaluate((node, requestId) => {
        node.dispatchEvent(new CustomEvent('app-route-activate', { detail: { route: null, parameters: requestId ? { requestId } : {} }, bubbles: true, composed: true }));
    }, requestId);
}

test('vi-consent: shows the request and completes an allow decision with the session credential', async ({ page }) => {
    const { consent, decisions } = await setupPage(page);
    await activate(consent);

    await expect(consent.locator('h1')).toHaveText('Authorize MCP Inspector');
    await expect(consent.locator('.muted')).toContainText('MCP Inspector wants to access this application on your behalf and will return to 127.0.0.1:6274.');
    await expect(consent.locator('.warning')).toBeVisible(); // loopback redirect
    await expect(consent.locator('.user')).toContainText('Signed in as Alice Example.');
    await expect(consent.locator('li')).toHaveText(['Read data you have access to', 'Propose and make changes you are allowed to make']);

    await consent.locator('#allow').click();

    await page.waitForURL(`${callback}?code=vac_code&state=xyz`);
    expect(decisions).toHaveLength(1);
    const decision = decisions[0];
    expect(decision.postDataJSON()).toEqual({ decision: 'allow' });
    const headers = await decision.allHeaders();
    expect(headers['authorization']).toBe('Bearer alice/abc_def+g='); // the token's slashes travel as underscores, like the sign-in hash
    expect(headers['accept']).toBe('application/json');
    expect(headers['content-type']).toBe('application/json');
});

test('vi-consent: deny sends the browser back with access_denied and a non-loopback client shows no warning', async ({ page }) => {
    const { consent, decisions } = await setupPage(page, {
        get: { status: 200, body: { ...consentRequest, redirectUri: 'https://client.example.test/cb', redirectHost: 'client.example.test', isLoopback: false } },
        decide: () => ({ status: 200, body: { redirectUri: `${callback}?error=access_denied&state=xyz` } }),
    });
    await activate(consent);

    await expect(consent.locator('h1')).toHaveText('Authorize MCP Inspector');
    await expect(consent.locator('.muted')).toContainText('client.example.test');
    await expect(consent.locator('.warning')).toHaveCount(0);

    await consent.locator('#deny').click();

    await page.waitForURL(`${callback}?error=access_denied&state=xyz`);
    expect(decisions[0].postDataJSON()).toEqual({ decision: 'deny' });
});

test('vi-consent: an expired request explains itself and offers no decision', async ({ page }) => {
    const { consent, decisions } = await setupPage(page, {
        get: { status: 400, body: { error: 'expired', error_description: 'This authorization request has expired.' } },
    });
    await activate(consent);

    await expect(consent.locator('.error')).toContainText('This authorization request has expired. Start again from the application.');
    await expect(consent.locator('#allow')).toHaveCount(0);
    await expect(consent.locator('#deny')).toHaveCount(0);
    expect(decisions).toHaveLength(0);
});

test('vi-consent: a lost session goes to sign-in and "Not you?" signs out first', async ({ page }) => {
    const { consent } = await setupPage(page, {
        decide: () => ({ status: 401, body: { error: 'unauthorized', error_description: 'Sign in to continue.' } }),
    });
    await activate(consent);
    await expect(consent.locator('#allow')).toBeVisible();

    await consent.locator('#allow').click();
    await expect.poll(() => page.evaluate(() => (window as any).__calls.signIn)).toBe(1);

    await consent.locator('.user a').click();
    await expect.poll(() => page.evaluate(() => (window as any).__calls.signOut)).toBe(1);
    expect(page.url()).toBe(`${origin}/test-page`); // no navigation happened in this browser tab
});
