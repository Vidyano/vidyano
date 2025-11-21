import { Page, TestInfo } from '@playwright/test';
import { spawn, ChildProcess, execSync } from 'child_process';

export async function startBackend(testInfoOrPath: TestInfo | string): Promise<ChildProcess> {
    let csFilePath: string;

    if (typeof testInfoOrPath === 'string') {
        csFilePath = testInfoOrPath;
    } else {
        // Get test file path and construct path to .cs file
        const testFile = testInfoOrPath.file;
        const dir = testFile.substring(0, testFile.lastIndexOf('/'));
        const csFile = execSync(`find "${dir}" -maxdepth 1 -name "*.cs" -type f`, { encoding: 'utf-8' }).trim();
        if (!csFile)
            throw new Error('No .cs file found in test directory');

        csFilePath = execSync(`realpath --relative-to="$(pwd)" "${csFile}"`, { encoding: 'utf-8' }).trim();
    }

    // Start the backend process
    // Gracefully stop any existing process on port 44355
    try {
        const pidOutput = execSync('lsof -ti:44355 2>/dev/null', { encoding: 'utf-8' }).trim();
        if (pidOutput) {
            const pids = pidOutput.split('\n').filter(p => p);
            if (pids.length > 0) {
                // Try graceful shutdown with SIGINT first
                execSync(`echo "${pids.join(' ')}" | xargs -r kill -INT 2>/dev/null`, { stdio: 'ignore' });

                // Wait for graceful shutdown (up to 3 seconds)
                for (let i = 0; i < 6; i++) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    try {
                        execSync('lsof -ti:44355 2>/dev/null', { stdio: 'ignore' });
                    } catch {
                        // Port is free
                        break;
                    }
                }

                // If still running, force kill
                try {
                    execSync('lsof -ti:44355 | xargs -r kill -9 2>/dev/null', { stdio: 'ignore' });
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch {
                    // Already stopped
                }
            }
        }
    } catch (error) {
        // No process was running on the port, which is fine
    }

    return new Promise((resolve, reject) => {
        const process = spawn('dotnet', ['run', csFilePath], {
            stdio: 'pipe',
            detached: false
        });

        let isReady = false;
        const timeout = setTimeout(() => {
            if (!isReady) {
                process.kill('SIGKILL');
                reject(new Error('Backend failed to start within timeout period (30s)'));
            }
        }, 30000);

        // Wait for "Now listening" in stdout
        process.stdout?.on('data', (data) => {
            const output = data.toString();

            if (!isReady && output.includes('Now listening')) {
                isReady = true;
                clearTimeout(timeout);
                resolve(process);
            }
        });

        process.stderr?.on('data', (data) => {
            // Only log errors, suppress warnings and info
            const output = data.toString();
            if (output.toLowerCase().includes('error') || output.toLowerCase().includes('exception')) {
                console.error(`[Backend Error] ${output.trim()}`);
            }
        });

        process.on('error', (error) => {
            if (!isReady) {
                clearTimeout(timeout);
                reject(new Error(`Backend process error: ${error.message}`));
            }
        });

        process.on('exit', (code) => {
            if (!isReady) {
                clearTimeout(timeout);
                reject(new Error(`Backend exited with code ${code} before becoming ready`));
            }
        });
    });
}

export async function stopBackend(process: ChildProcess | undefined): Promise<void> {
    if (!process || !process.pid)
        return;

    return new Promise((resolve) => {
        let resolved = false;

        // Set up exit handler
        const onExit = () => {
            if (!resolved) {
                resolved = true;
                resolve();
            }
        };

        process.once('exit', onExit);

        // Try graceful shutdown first
        process.kill('SIGINT');

        // Wait up to 3 seconds for graceful shutdown
        setTimeout(() => {
            if (!resolved) {
                // Kill the entire process tree (parent and all children)
                try {
                    if (process.pid) {
                        // Use pkill to kill the entire process tree
                        execSync(`pkill -9 -P ${process.pid} 2>/dev/null || true`, { stdio: 'ignore' });
                        process.kill('SIGKILL');
                    }
                } catch (error) {
                    // Process might already be dead
                }

                // Give it a moment, then resolve
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        resolve();
                    }
                }, 500);
            }
        }, 3000);
    });
}

export function getAttributeHtml(customStyles = '') {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :not(:defined) { display: none; }
          * { display: block; padding: 1px; }
          ${customStyles}
        </style>
      </head>
      <body>
        <div id="test-container"></div>
      </body>
    </html>
    `;
}

export async function setupPage(
    page: Page,
    customStyles = ''
) {
    // Log browser console messages to the terminal
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error')
            console.error(`[Browser] ${text}`);
        else if (type === 'warning')
            console.warn(`[Browser] ${text}`);
        else
            console.log(`[Browser] ${text}`);
    });

    // Serve the test page with a container
    await page.route('**/test-page', route => {
        route.fulfill({
            contentType: 'text/html',
            body: getAttributeHtml(customStyles)
        });
    });

    await page.goto('http://localhost:44355/test-page');
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });

    // Wait for Vidyano to load
    await page.waitForFunction(() => typeof (window as any).Vidyano !== 'undefined', { timeout: 10000 });

    // Initialize service once
    await page.evaluate(async () => {
        const Service = (window as any).Vidyano.Service;

        const service = new Service("http://localhost:44355");
        await service.initialize();
        await service.signInUsingCredentials("admin", "admin");
        (window as any).service = service;
    });
}

export async function setupAttribute(
    page: Page,
    componentTag: string,
    attributeName: string
) {
    const componentId = `component-${Math.random().toString(36).substring(2, 15)}`;

    // Wait for the custom element to be defined
    await page.waitForFunction((tag) => !!customElements.get(tag), componentTag, { timeout: 10000 });

    await page.evaluate(async ({ componentTag, componentId, attributeName }) => {
        const randomObjectId = Math.random().toString(36).substring(2, 15);
        const persistentObject = await (window as any).service.getPersistentObject(null, "Mock_Attribute", randomObjectId);
        const attribute = persistentObject.getAttribute(attributeName);

        // Create and add component to the page
        const container = document.getElementById('test-container');
        if (!container)
            throw new Error('Test container not found');

        const component = document.createElement(componentTag);
        component.id = componentId;
        (component as any).attribute = attribute;

        // Store attribute reference by component ID for later operations
        if (!(window as any).attributeMap)
            (window as any).attributeMap = {};
        (window as any).attributeMap[componentId] = attribute;

        container.appendChild(component);
    }, { componentTag, componentId, attributeName });

    return page.locator(`#${componentId}`);
}

export async function beginEdit(page: Page, component: any) {
    const componentId = await component.getAttribute('id');
    await page.evaluate((id) => {
        (window as any).attributeMap[id].parent.beginEdit();
    }, componentId);
}

export async function cancelEdit(page: Page, component: any) {
    const componentId = await component.getAttribute('id');
    await page.evaluate((id) => {
        (window as any).attributeMap[id].parent.cancelEdit();
    }, componentId);
}

export async function save(page: Page, component: any) {
    const componentId = await component.getAttribute('id');
    return await page.evaluate(async (id) => {
        const attribute = (window as any).attributeMap[id];
        await attribute.parent.save();
        return attribute.value;
    }, componentId);
}

export async function freeze(page: Page, component: any) {
    const componentId = await component.getAttribute('id');
    await page.evaluate((id) => {
        const attribute = (window as any).attributeMap[id];
        attribute.parent.freeze();
    }, componentId);
}

export async function unfreeze(page: Page, component: any) {
    const componentId = await component.getAttribute('id');
    await page.evaluate((id) => {
        const attribute = (window as any).attributeMap[id];
        attribute.parent.unfreeze();
    }, componentId);
}
