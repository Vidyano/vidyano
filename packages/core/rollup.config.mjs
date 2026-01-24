import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pjson = require('./package.json');

import nodeResolve from '@rollup/plugin-node-resolve';
import vulcanize from '../../rollup.vulcanize.js';
import { dts } from "rollup-plugin-dts";
import replace from "@rollup/plugin-replace";
import terser from '@rollup/plugin-terser';

const terserMinify = terser({
    mangle: false,
    compress: false,
    format: {
        beautify: false,
        comments: false,
    },
});

export default [
    // Declaration bundle
    {
        input: 'rollup/index.d.ts',
        external: ["tslib", "bignumber.js"],
        plugins: [
            dts({ respectExternal: true })
        ],
        output: [{ file: "dist/index.d.ts", format: "es" }],
        watch: false
    },
    // Implementation bundle
    {
        input: 'src/index.js',
        external: ['String', "__decorate"],
        plugins: [
            nodeResolve(),
            vulcanize(),
            replace({
                "vidyano-latest-version": pjson.version,
                "process.env.NODE_ENV": "'production'",
                preventAssignment: true
            }),
        ],
        output: [
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
        }
    }
];
