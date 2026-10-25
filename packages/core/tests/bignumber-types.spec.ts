import { test, expect } from "@playwright/test";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const tsc = path.join(root, "node_modules/typescript/bin/tsc");

const consumer = `import "@vidyano/core";
import { BigNumber } from "bignumber.js";

const formatted: string = new BigNumber(1).format("N2");
const localeFormatted: string = new BigNumber(1).plus(2).localeFormat("N2");
// @ts-expect-error
new BigNumber(1).notAMethod();

export { formatted, localeFormatted };
`;

// A consumer of the published d.ts bundle, under node_modules so its imports resolve the way an installed package's would
test.describe("BigNumber format types", () => {
    let dir: string;

    test.beforeAll(() => {
        const cache = path.join(root, "node_modules/.cache");
        fs.mkdirSync(cache, { recursive: true });
        dir = fs.mkdtempSync(path.join(cache, "bignumber-types-"));
        fs.writeFileSync(path.join(dir, "consumer.ts"), consumer);
    });

    test.afterAll(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    for (const moduleResolution of ["bundler", "node10"]) {
        test(`consumers get format and localeFormat on BigNumber with moduleResolution ${moduleResolution}`, () => {
            let output = "";
            try {
                execFileSync(process.execPath, [tsc, "--noEmit", "--strict", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", moduleResolution, "consumer.ts"], { cwd: dir, encoding: "utf8" });
            } catch (e) {
                output = `${e.stdout}${e.stderr}` || e.message;
            }

            expect(output).toBe("");
        });
    }
});
