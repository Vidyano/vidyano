// Splits the vidyano spec files over the CI shards by their duration on CI, so every shard takes about as long.
// Playwright's --shard cuts the tests into slices in file order, which put the fast attribute specs in one shard and
// most of the query grid in the others.
//
//   npm run test:shard                          rewrites shard-weights.json from the durations of the latest passed
//                                               CI - Vidyano run of this repository on GitHub (needs the GitHub CLI)
//   node tools/test/shard.mjs <shard> <total>   prints the spec files of that shard, one per line
//   node tools/test/shard.mjs weights <log>...  rewrites shard-weights.json from the output of a full vidyano run
//
// Whole files are assigned (serial specs and a spec's beforeAll stay together), heaviest first, each to the shard
// with the least time so far. The files come from `playwright test --list`, so a new spec is never left out: a file
// without a weight counts its tests at the average time per test.
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WEIGHTS = path.join(ROOT, 'tools/test/shard-weights.json');
const weights = fs.existsSync(WEIGHTS) ? JSON.parse(fs.readFileSync(WEIGHTS, 'utf8')) : {};
const [mode, ...args] = process.argv.slice(2);

/** Writes the seconds per spec file in list reporter output. Replaced, not merged: only the ratios matter, and a local run is faster than CI. */
function writeWeights(output) {
    // A test line of the list reporter: "✓  12 [vidyano] › packages/vidyano/tests/x.spec.ts:10:5 › … (1.2s)"
    const seconds = {};
    for (const line of output.split('\n')) {
        const test = /\[vidyano\] › (\S+?\.spec\.ts):\d+:\d+ › .*\((\d+(?:\.\d+)?)(ms|s|m)\)\s*$/.exec(line);
        if (!test)
            continue;

        const file = test[1].replace(/\\/g, '/');
        const value = parseFloat(test[2]) * (test[3] === 'ms' ? 0.001 : test[3] === 'm' ? 60 : 1);
        seconds[file] = (seconds[file] ?? 0) + value;
    }

    if (Object.keys(seconds).length === 0)
        throw new Error('The output has no vidyano test durations; shard-weights.json is unchanged');

    fs.writeFileSync(WEIGHTS, JSON.stringify(Object.fromEntries(Object.keys(seconds).sort().map(file => [file, Math.round(seconds[file] * 10) / 10])), null, 2) + '\n');
    console.log(`${Object.keys(seconds).length} files written to ${path.relative(process.cwd(), WEIGHTS)}`);
}

if (mode === 'weights') {
    writeWeights(args.map(log => fs.readFileSync(log, 'utf8')).join('\n'));
    process.exit(0);
}

if (mode === 'reshard') {
    // The latest run that passed: every shard ran all its files, so no file is left out
    const [run] = JSON.parse(execSync('gh run list --workflow ci-vidyano.yml --status success --limit 1 --json databaseId,headBranch,createdAt', { cwd: ROOT, encoding: 'utf8' }));
    if (!run)
        throw new Error('No successful CI - Vidyano run found; shard-weights.json is unchanged');

    console.log(`Durations of CI run ${run.databaseId} (${run.headBranch}, ${run.createdAt})`);
    writeWeights(execSync(`gh run view ${run.databaseId} --log`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }));
    process.exit(0);
}

const [shard, total] = [Number(mode), Number(args[0])];
if (!(shard >= 1 && shard <= total))
    throw new Error('Usage: node tools/test/shard.mjs <shard> <total> | weights <log>... | reshard');

const list = JSON.parse(execSync('npx playwright test --list --reporter=json --project=vidyano', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }));
const count = suite => (suite.specs ?? []).reduce((n, spec) => n + spec.tests.length, 0) + (suite.suites ?? []).reduce((n, child) => n + count(child), 0);
const files = list.suites.map(suite => ({ file: suite.file.replace(/\\/g, '/'), tests: count(suite) }));

const measured = files.filter(f => f.file in weights);
const perTest = measured.reduce((s, f) => s + weights[f.file], 0) / Math.max(1, measured.reduce((n, f) => n + f.tests, 0)) || 1;
files.forEach(f => f.weight = weights[f.file] ?? f.tests * perTest);

const shards = Array.from({ length: total }, () => ({ weight: 0, files: [] }));
for (const f of [...files].sort((a, b) => b.weight - a.weight || a.file.localeCompare(b.file))) {
    const lightest = shards.reduce((min, s) => s.weight < min.weight ? s : min);
    lightest.weight += f.weight;
    lightest.files.push(f.file);
}

const mine = shards[shard - 1];
if (mine.files.length === 0)
    throw new Error(`Shard ${shard}/${total} has no spec files`);

console.error(`Shard ${shard}/${total}: ${mine.files.length} of ${files.length} spec files, ~${Math.round(mine.weight)}s of ~${Math.round(shards.reduce((s, x) => s + x.weight, 0))}s on CI`);
console.log(mine.files.sort().join('\n'));
