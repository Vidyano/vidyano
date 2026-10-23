import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const root = path.resolve(import.meta.dirname, '../..');

const tools = [
    { command: 'dotnet', args: ['--version'], install: 'winget install Microsoft.DotNet.SDK.10' }
];

function step(message) {
    console.log(`\x1b[36m◆\x1b[0m ${message}`);
}

function run(command) {
    const result = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true });
    if (result.status !== 0) {
        console.error(`${command} failed`);
        process.exit(result.status ?? 1);
    }
}

function mtime(file) {
    return fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
}

function ensureNodeModules() {
    const installed = mtime(path.join(root, 'node_modules/.package-lock.json'));
    if (installed >= Math.max(mtime(path.join(root, 'package.json')), mtime(path.join(root, 'package-lock.json'))))
        return;

    step('Installing npm packages');
    run('npm install');
}

function checkTools() {
    for (const tool of tools) {
        if (spawnSync(tool.command, tool.args, { stdio: 'ignore' }).status !== 0)
            console.warn(`\x1b[33m▲\x1b[0m ${tool.command} not found; install it with: ${tool.install}`);
    }
}

export function ensureDependencies() {
    ensureNodeModules();
    checkTools();
}
