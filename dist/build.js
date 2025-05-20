const fs = require("fs").promises;
const exec = require('child_process').exec;

const version = process.argv[2];
if (!version) {
    console.error("Must provide a version as the first argument");
    return;
}

async function bumpVersion(fileName, fnc) {
    console.info("Updating " + fileName);
    const package = JSON.parse(await fs.readFile(fileName, "utf8"));
    fnc(package);
    await fs.writeFile(fileName, JSON.stringify(package, null, 2));    
}

function execCommand(command) {
    return new Promise((resolve, reject) => {
        const process = exec(command, { stdio: ['inherit', 'inherit', 'pipe'] });

        let stderr = '';
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('exit', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command "${command}" exited with code ${code}\n${stderr}`));
            }
        });

        process.on('error', (error) => {
            reject(error);
        });
    });
}

(async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
        await bumpVersion("package.json", data => data.version = version);
        await bumpVersion("package-lock.json", data => data.packages[""].version = data.version = version);

        console.info("Executing TypeScript ES2020 build");
        await execCommand("tsc --project tsconfig.es2020.json");

        console.info("Executing full ES2020 rollup");
        await execCommand("./node_modules/rollup/dist/bin/rollup -c --environment BUILD:full --bundleConfigAsCjs");

        console.info("Renaming files");
        await fs.rename("vidyano.js", `vidyano.es2020.js`);
        await fs.rename("vidyano.d.ts", `vidyano.es2020.d.ts`);

        console.info("Executing TypeScript build");
        await execCommand("tsc --project tsconfig.json");

        console.info("Executing full rollup");
        await execCommand("./node_modules/rollup/dist/bin/rollup -c --environment BUILD:full --bundleConfigAsCjs");

        console.info("Executing base rollup");
        await execCommand("./node_modules/rollup/dist/bin/rollup -c --environment BUILD:base --bundleConfigAsCjs");

        console.info("Moving base files");
        await fs.rename("vidyano-base.js", "dist/client/index.js");
        await fs.rename("vidyano-base.d.ts", "dist/client/index.d.ts");
    } catch (error) {
        console.error("Error during execution:", error);
    } finally {
        process.env.NODE_ENV = originalNodeEnv;
    }
})();
