import alias from '@rollup/plugin-alias';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entries = [
    { find: 'components', replacement: path.resolve(__dirname, 'src/web-components') },
    { find: 'libs', replacement: path.resolve(__dirname, 'src/libs') },
    { find: 'polymer', replacement: path.resolve(__dirname, 'src/libs/polymer/polymer') },
];

const dtsEntries = [
    { find: 'components', replacement: path.resolve(__dirname, 'rollup/src/web-components') },
    { find: 'libs', replacement: path.resolve(__dirname, 'rollup/src/libs') },
    { find: 'polymer', replacement: path.resolve(__dirname, 'rollup/src/libs/polymer/polymer') },
];

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pjson = require('./package.json');

import nodeResolve from '@rollup/plugin-node-resolve';
import vulcanize from './rollup.vulcanize.js';
import { dts } from "rollup-plugin-dts";
import replace from "@rollup/plugin-replace";
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import postcssHost from 'postcss-host';

const terserMinify = terser({
    mangle: false,
    compress: false,
    format: {
        beautify: false,
        comments: false,
    },
});

const isDevelopment = process.env.NODE_ENV !== 'production';

export default [
    // Declaration bundle
    {
        input: 'rollup/src/index.d.ts',
        external: ["tslib", "bignumber.js", "lit"],
        plugins: [
            alias({ entries: dtsEntries }),
            dts({ respectExternal: true })
        ],
        output: [
            { file: "../../dev/wwwroot/index.d.ts", format: "es" },
            { file: "dist/index.d.ts", format: "es" }
        ],
        watch: false
    },
    // Implementation bundle
    {
        input: isDevelopment ? 'tests/index.js' : 'src/index.js',
        external: ['String', "__decorate"],
        plugins: [
            alias({ entries }),
            nodeResolve(),
            postcss({
                extensions: ['.css'],
                inject: false,
                modules: false,
                plugins: [postcssHost]
            }),
            vulcanize(),
            replace({
                "vidyano-latest-version": pjson.version,
                "process.env.NODE_ENV": "'production'",
                preventAssignment: true
            }),
        ],
        output: [
            { file: "../../dev/wwwroot/index.js", format: "es" },
            { file: "../../dev/wwwroot/index.min.js", format: "es", plugins: [terserMinify] },
            { file: "dist/index.js", format: "es" },
            { file: "dist/index.min.js", format: "es", plugins: [terserMinify] }
        ],
        watch: {
            chokidar: {
                usePolling: false
            }
        },
        onwarn(warning, warn) {
            if (warning.code === 'THIS_IS_UNDEFINED')
                return;

            warn(warning);
        },
    }
];
