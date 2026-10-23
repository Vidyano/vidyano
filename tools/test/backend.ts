import { TestInfo } from '@playwright/test';
import { spawn, ChildProcess, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const isWindows = process.platform === 'win32';

// A cold `dotnet run x.cs` compiles the backend first, which takes long in a fresh checkout or worktree
const startTimeout = Number(process.env.VIDYANO_BACKEND_START_TIMEOUT) || 120_000;
const listening = /Now listening on: (http:\/\/127\.0\.0\.1:(\d+))/;

export interface BackendProcess extends ChildProcess {
    /** The port the backend picked, known once startBackend resolves. */
    port: number;
    /** The backend's base URL, e.g. http://127.0.0.1:54321. */
    url: string;
}

/**
 * Starts the test backend next to the spec (foo.spec.ts -> foo.cs) on a port the OS picks, so parallel workers,
 * worktrees and other processes never collide on a fixed port, and resolves once it listens.
 */
export async function startBackend(testInfo: TestInfo, backendFile?: string): Promise<BackendProcess> {
    const testFile = testInfo.file;
    const dir = path.dirname(testFile);

    // Use the specified backend file, or derive it from the spec filename: foo.spec.ts -> foo.cs
    const csFile = path.join(dir, backendFile ?? path.basename(testFile).replace('.spec.ts', '.cs'));
    if (!fs.existsSync(csFile))
        throw new Error(`No matching .cs file found: ${csFile}`);

    const csFilePath = path.relative(process.cwd(), csFile);

    return new Promise((resolve, reject) => {
        // Kestrel rejects localhost:0, so it binds the loopback address and reports the port it got
        const backendProcess = spawn('dotnet', ['run', csFilePath], {
            stdio: 'pipe',
            detached: false,
            env: { ...process.env, ASPNETCORE_URLS: 'http://127.0.0.1:0' }
        }) as BackendProcess;

        let isReady = false;
        let output = '';
        const timeout = setTimeout(() => {
            if (!isReady) {
                killTree(backendProcess);
                reject(new Error(`Backend ${csFilePath} failed to start within ${startTimeout / 1000}s`));
            }
        }, startTimeout);

        // Wait for "Now listening on: <url>" in stdout, which can arrive split over chunks
        backendProcess.stdout?.on('data', (data) => {
            if (isReady)
                return;

            output = (output + data.toString()).slice(-4096);
            const match = listening.exec(output);
            if (match) {
                isReady = true;
                clearTimeout(timeout);
                backendProcess.url = match[1];
                backendProcess.port = Number(match[2]);
                resolve(backendProcess);
            }
        });

        backendProcess.stderr?.on('data', (data) => {
            // Only log errors, suppress warnings and info
            const text = data.toString();
            if (text.toLowerCase().includes('error') || text.toLowerCase().includes('exception'))
                console.error(`[Backend Error in ${csFilePath}] ${text.trim()}`);
        });

        backendProcess.on('error', (error) => {
            if (!isReady) {
                clearTimeout(timeout);
                reject(new Error(`Backend process error in ${csFilePath}: ${error.message}`));
            }
        });

        backendProcess.on('exit', (code) => {
            if (!isReady) {
                clearTimeout(timeout);
                reject(new Error(`Backend ${csFilePath} exited with code ${code} before becoming ready`));
            }
        });
    });
}

function killTree(process: ChildProcess) {
    if (isWindows && process.pid)
        execSync(`taskkill /pid ${process.pid} /T /F`, { stdio: 'ignore' });
    else
        process.kill('SIGKILL');
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
        if (process.exitCode !== null || process.signalCode !== null) {
            onExit();
            return;
        }

        // dotnet run leaves the backend running as a child process on Windows, so kill the whole tree
        if (isWindows) {
            try {
                killTree(process);
            } catch {
                // Process might already be dead
            }

            return;
        }

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
