const fs = require("fs").promises;
const path = require("path");
const { exec } = require('child_process');

const version = process.argv[2];
const gitHash = process.argv[3];

if (!version) {
    console.error("Error: Must provide a version as the first argument (e.g., 1.2.3)");
    process.exit(1);
}

if (!gitHash) {
    console.error("Error: Must provide a git hash as the second argument (e.g., abc123def456)");
    process.exit(1);
}

const subPackageDirs = ["core", "vidyano"];
const packagesDir = "packages";
const rootDir = ".";

async function cleanDistSubdirectory(distPath) {
    console.info(`Cleaning directory: ${distPath} (preserving package.json)`);

    try {
        const items = await fs.readdir(distPath);
        for (const item of items) {
            if (!["package.json", "readme", "readme.md"].includes(item.toLowerCase())) {
                const itemPath = path.join(distPath, item);
                await fs.rm(itemPath, { recursive: true, force: true });
            }
        }
    } catch (e) {
        // dist directory may not exist yet
        await fs.mkdir(distPath, { recursive: true });
    }
}

async function bumpVersion(filePath, newVersion, gitHash = null) {
    console.info(`Updating version to ${newVersion} in ${filePath}`);

    const content = await fs.readFile(filePath, "utf8");
    const packageData = JSON.parse(content);

    packageData.version = newVersion;
    if (gitHash && !filePath.endsWith("package-lock.json")) {
        packageData.gitHash = gitHash;
        console.info(`  Adding gitHash: ${gitHash}`);
    }
    if (filePath.endsWith("package-lock.json") && packageData.packages && packageData.packages[""]) {
        packageData.packages[""].version = newVersion;
    }

    await fs.writeFile(filePath, JSON.stringify(packageData, null, 2) + "\n");
}

function execCommand(command, options) {
    return new Promise((resolve, reject) => {
        const cwdInfo = options && options.cwd ? ` in ${options.cwd}` : '';
        console.log(`Executing: ${command}${cwdInfo}`);
        const childProcess = exec(command, options);

        childProcess.stdout.pipe(process.stdout);
        childProcess.stderr.pipe(process.stderr);

        childProcess.on('exit', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command "${command}"${cwdInfo} exited with code ${code}`));
            }
        });

        childProcess.on('error', (error) => {
            reject(new Error(`Failed to start command "${command}"${cwdInfo}: ${error.message}`));
        });
    });
}

(async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
        console.info("--- Starting build process ---");

        for (const subDir of subPackageDirs) {
            const distPath = path.join(packagesDir, subDir, "dist");
            await cleanDistSubdirectory(distPath);
        }

        await bumpVersion(path.join(rootDir, "package.json"), version);
        await bumpVersion(path.join(rootDir, "package-lock.json"), version);

        for (const subDir of subPackageDirs) {
            const packageJsonPath = path.join(packagesDir, subDir, "package.json");
            await bumpVersion(packageJsonPath, version, gitHash);
        }

        await execCommand("npx sass --no-source-map packages/vidyano/src:packages/vidyano/src -q");

        // Build core first (tsc then rollup) so @vidyano/core is available
        await execCommand("tsc --project packages/core/tsconfig.json");
        await execCommand("npx rollup -c --environment NODE_ENV:production --bundleConfigAsCjs", { cwd: path.join(packagesDir, "core") });

        // Now build vidyano (depends on @vidyano/core being built)
        await execCommand("tsc --project packages/vidyano/tsconfig.json");
        await execCommand("npx rollup -c --environment NODE_ENV:production --bundleConfigAsCjs", { cwd: path.join(packagesDir, "vidyano") });

        console.info("Build completed successfully!");
    } catch (error) {
        console.error("------------------------------------");
        console.error("Build script failed:", error.message);
        if (error.stack && error.message && !error.stack.includes(error.message)) {
            console.error(error.stack);
        }
        console.error("------------------------------------");
        process.exit(1);
    } finally {
        process.env.NODE_ENV = originalNodeEnv;
    }
})();