import { TestInfo } from '@playwright/test';
import { spawn, ChildProcess, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const isWindows = process.platform === 'win32';

// Map worker ID to port to enable parallel test execution
function getWorkerPort(testInfo: TestInfo): number {
    const workerId = testInfo.parallelIndex;
    return 44355 + workerId;
}

export interface BackendProcess extends ChildProcess {
    port: number;
}

// Gracefully stop any process listening on the port
async function freePort(port: number) {
    // Windows has no lsof or SIGINT for console processes, so it force-kills the listener
    if (isWindows) {
        killPort(port);
        return;
    }

    try {
        const pidOutput = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: 'utf-8' }).trim();
        if (pidOutput) {
            const pids = pidOutput.split('\n').filter(p => p);
            if (pids.length > 0) {
                // Try graceful shutdown with SIGINT first
                execSync(`echo "${pids.join(' ')}" | xargs -r kill -INT 2>/dev/null`, { stdio: 'ignore' });

                // Wait for graceful shutdown (up to 3 seconds)
                for (let i = 0; i < 6; i++) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    try {
                        execSync(`lsof -ti:${port} 2>/dev/null`, { stdio: 'ignore' });
                    } catch {
                        // Port is free
                        break;
                    }
                }

                // If still running, force kill
                try {
                    execSync(`lsof -ti:${port} | xargs -r kill -9 2>/dev/null`, { stdio: 'ignore' });
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch {
                    // Already stopped
                }
            }
        }
    } catch (error) {
        // No process was running on the port, which is fine
    }
}

export async function startBackend(testInfo: TestInfo, backendFile?: string): Promise<BackendProcess> {
    const testFile = testInfo.file;
    const dir = path.dirname(testFile);

    // Use the specified backend file, or derive it from the spec filename: foo.spec.ts -> foo.cs
    const csFile = path.join(dir, backendFile ?? path.basename(testFile).replace('.spec.ts', '.cs'));
    if (!fs.existsSync(csFile))
        throw new Error(`No matching .cs file found: ${csFile}`);

    const csFilePath = path.relative(process.cwd(), csFile);
    const port = getWorkerPort(testInfo);

    await freePort(port);

    // Start the backend process
    return new Promise((resolve, reject) => {
        const backendProcess = spawn('dotnet', ['run', csFilePath], {
            stdio: 'pipe',
            detached: false,
            env: { ...process.env, ASPNETCORE_URLS: `http://localhost:${port}` }
        }) as BackendProcess;

        backendProcess.port = port;

        let isReady = false;
        const timeout = setTimeout(() => {
            if (!isReady) {
                killTree(backendProcess);
                reject(new Error(`Backend failed to start within timeout period (30s) on port ${port}`));
            }
        }, 30000);

        // Wait for "Now listening" in stdout
        backendProcess.stdout?.on('data', (data) => {
            const output = data.toString();

            if (!isReady && output.includes('Now listening')) {
                isReady = true;
                clearTimeout(timeout);
                resolve(backendProcess);
            }
        });

        backendProcess.stderr?.on('data', (data) => {
            // Only log errors, suppress warnings and info
            const output = data.toString();
            if (output.toLowerCase().includes('error') || output.toLowerCase().includes('exception')) {
                console.error(`[Backend Error on port ${port}] ${output.trim()}`);
            }
        });

        backendProcess.on('error', (error) => {
            if (!isReady) {
                clearTimeout(timeout);
                reject(new Error(`Backend process error on port ${port}: ${error.message}`));
            }
        });

        backendProcess.on('exit', (code) => {
            if (!isReady) {
                clearTimeout(timeout);
                reject(new Error(`Backend exited with code ${code} before becoming ready on port ${port}`));
            }
        });
    });
}

function killPort(port: number) {
    try {
        const pids = new Set(execSync(`netstat -ano -p tcp`, { encoding: 'utf-8' })
            .split('\n')
            .map(line => line.trim().split(/\s+/))
            .filter(cols => cols[1]?.endsWith(`:${port}`) && cols[3] === 'LISTENING')
            .map(cols => cols[4]));

        for (const pid of pids)
            execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } catch {
        // No process was running on the port, which is fine
    }
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
