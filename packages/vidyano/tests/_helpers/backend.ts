import { TestInfo } from '@playwright/test';
import { spawn, ChildProcess, execSync } from 'child_process';

// Map worker ID to port to enable parallel test execution
function getWorkerPort(testInfo: TestInfo): number {
    const workerId = testInfo.parallelIndex;
    return 44355 + workerId;
}

export interface BackendProcess extends ChildProcess {
    port: number;
}

export async function startBackend(testInfo: TestInfo, backendFile?: string): Promise<BackendProcess> {
    const testFile = testInfo.file;
    const dir = testFile.substring(0, testFile.lastIndexOf('/'));

    let csFile: string;
    if (backendFile) {
        // Use the specified backend file
        csFile = `${dir}/${backendFile}`;
    } else {
        // Derive from spec filename: foo.spec.ts -> foo.cs
        const specFileName = testFile.substring(testFile.lastIndexOf('/') + 1);
        const csFileName = specFileName.replace('.spec.ts', '.cs');
        csFile = `${dir}/${csFileName}`;
    }

    // Check if the .cs file exists
    try {
        execSync(`test -f "${csFile}"`, { encoding: 'utf-8' });
    } catch {
        throw new Error(`No matching .cs file found: ${csFile}`);
    }

    const csFilePath = execSync(`realpath --relative-to="$(pwd)" "${csFile}"`, { encoding: 'utf-8' }).trim();
    const port = getWorkerPort(testInfo);

    // Start the backend process
    // Gracefully stop any existing process on this port
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
                backendProcess.kill('SIGKILL');
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
