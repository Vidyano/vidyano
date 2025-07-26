/* Alias code */
import alias from '@rollup/plugin-alias';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const entries = [
    { find: 'components', replacement: path.resolve(__dirname, 'src/vidyano/web-components') },
    { find: 'libs', replacement: path.resolve(__dirname, 'src/vidyano/libs') },
    { find: 'polymer', replacement: path.resolve(__dirname, 'src/vidyano/libs/polymer/polymer') },
    { find: 'vidyano', replacement: path.resolve(__dirname, 'src/core') },
];
/* End of alias code */

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

const configs = [
    {
        input: isDevelopment ? './tests/components/index.js' : './src/vidyano/index.js',
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
            { file: "dev/wwwroot/index.js", format: "es" },
            { file: "dev/wwwroot/index.min.js", format: "es", plugins: [terserMinify] },
            { file: "dist/vidyano/index.js", format: "es" },
            { file: "dist/vidyano/index.min.js", format: "es", plugins: [terserMinify] }
        ],
        watch: {
            chokidar: {
                usePolling: true,
                interval: 5000
            }
        }, onwarn(warning, warn) {
            if (warning.code === 'THIS_IS_UNDEFINED')
                return;

            warn(warning);
        },
    }, {
        input: 'src/core/index.js',
        external: ['String', "__decorate"],
        plugins: [
            alias({ entries }),
            nodeResolve(),
            vulcanize(),
            replace({
                "vidyano-latest-version": pjson.version,
                "process.env.NODE_ENV": "'production'",
                preventAssignment: true
            }),
        ],
        output: [
            { file: "dist/core/index.js", format: "es" },
            { file: "dist/core/index.min.js", format: "es", plugins: [terserMinify] }
        ],
        watch: {
            chokidar: {
                usePolling: true,
                interval: 5000
            }
        }, onwarn(warning, warn) {
            if (warning.code === 'THIS_IS_UNDEFINED')
                return;

            warn(warning);
        }
    }
];

// Add TypeScript definitions generation for production build
if (!isDevelopment) {
    configs.push(...[
        {
            input: './src/vidyano/index.js',
            external: ["tslib", "bignumber.js", "lit"],
            plugins: [
                alias({ entries }),
                dts({ respectExternal: true })
            ],
            output: [{ file: "dev/wwwroot/index.d.ts", format: "es" }, { file: "dist/vidyano/index.d.ts", format: "es" }],
        }, {
            input: 'src/core/index.js',
            external: ["tslib", "bignumber.js"],
            plugins: [
                alias({ entries }),
                dts({ respectExternal: true })
            ],
            output: [{ file: "dist/core/index.d.ts", format: "es" }],
        }
    ]);
}

export default configs;