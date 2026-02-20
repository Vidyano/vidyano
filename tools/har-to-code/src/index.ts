import fs from "node:fs";
import path from "node:path";
import { parseHarFile } from "./har-parser.js";
import { InteractionAnalyzer } from "./interaction-analyzer.js";
import { CodeGenerator } from "./code-generator.js";

const harPath = process.argv[2];
if (!harPath) {
    console.error("Usage: npx tsx tools/har-to-code/src/index.ts <har-file> [--output <file>]");
    process.exit(1);
}

const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;

const resolvedPath = path.resolve(harPath);
if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
}

const harContent = fs.readFileSync(resolvedPath, "utf-8");
const entries = parseHarFile(harContent);

if (entries.length === 0) {
    console.error("No Vidyano API entries found in HAR file.");
    process.exit(1);
}

console.error(`Found ${entries.length} Vidyano API entries.`);

const analyzer = new InteractionAnalyzer();
const steps = analyzer.analyze(entries);

console.error(`Analyzed ${steps.length} interaction steps.`);

const generator = new CodeGenerator();
const code = generator.generate(steps);

if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), code, "utf-8");
    console.error(`Written to ${outputPath}`);
}
else
    console.log(code);
