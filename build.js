const fs = require("fs").promises;
const path = require("path");
const { exec } = require('child_process');

const version = process.argv[2];
if (!version) {
    console.error("Error: Must provide a version as the first argument (e.g., 1.2.3)");
    process.exit(1);
}

const subPackageDirs = ["vidyano", "core"];
const distDir = "dist";
const rootDir = ".";

async function cleanDistSubdirectory(subDirPath) {
    console.info(`Cleaning directory: ${subDirPath} (preserving package.json)`);

    const items = await fs.readdir(subDirPath);
    for (const item of items) {
        if (!["package.json", "readme", "readme.md"].includes(item.toLowerCase())) {
            const itemPath = path.join(subDirPath, item);
            await fs.rm(itemPath, { recursive: true, force: true });
        }
    }
}

async function bumpVersion(filePath, newVersion) {
    console.info(`Updating version to ${newVersion} in ${filePath}`);

    const content = await fs.readFile(filePath, "utf8");
    const packageData = JSON.parse(content);

    packageData.version = newVersion;
    if (filePath.endsWith("package-lock.json") && packageData.packages && packageData.packages[""]) {
        packageData.packages[""].version = newVersion;
    }

    await fs.writeFile(filePath, JSON.stringify(packageData, null, 2) + "\n");
}

function execCommand(command, options) { // Modified to accept options
    return new Promise((resolve, reject) => {
        const cwdInfo = options && options.cwd ? ` in ${options.cwd}` : '';
        console.log(`Executing: ${command}${cwdInfo}`);
        const childProcess = exec(command, options); // Pass options to exec

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
            const fullSubDirPath = path.join(distDir, subDir);

            await cleanDistSubdirectory(fullSubDirPath);
        }

        await bumpVersion(path.join(rootDir, "package.json"), version);
        await bumpVersion(path.join(rootDir, "package-lock.json"), version);

        for (const subDir of subPackageDirs) {
            const packageJsonPath = path.join(distDir, subDir, "package.json");
            await bumpVersion(packageJsonPath, version);
        }

        await execCommand("npx sass src:src -q");

        await execCommand("tsc --project tsconfig.es2020.json");
        await execCommand("npx rollup -c --environment NODE_ENV:production --bundleConfigAsCjs");

        const vidyanoDistPath = path.join(distDir, "vidyano");
        try {
            await fs.rename(path.join(vidyanoDistPath, `index.js`), path.join(vidyanoDistPath, `index.es2020.js`));
            await fs.rename(path.join(vidyanoDistPath, `index.d.ts`), path.join(vidyanoDistPath, `index.es2020.d.ts`));
        } catch(err) {
            throw new Error(`Failed to rename ES2020 output files in ${vidyanoDistPath}: ${err.message}`);
        }

        await execCommand("tsc --project tsconfig.json");
        await execCommand("npx rollup -c --environment NODE_ENV:production --bundleConfigAsCjs");

        console.info("--- Running npm pack in dist subdirectories ---");
        for (const subDir of subPackageDirs) {
            const packageDistPath = path.join(distDir, subDir);
            await execCommand("npm pack", { cwd: packageDistPath });
            console.info(`Successfully packed ${packageDistPath}`);
        }

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