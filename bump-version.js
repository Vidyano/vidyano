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

(async () => {
    await bumpVersion("package.json", data => data.version = version);
    await bumpVersion("package-lock.json", data => data.packages[""].version = data.version = version);

    console.info("Executing rollup");
    const rollup = exec("./node_modules/rollup/dist/bin/rollup -c");
    rollup.stdout.pipe(process.stdout);
})();