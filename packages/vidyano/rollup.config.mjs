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

const commonPlugins = [
    alias({ entries }),
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
];

const onwarnHandler = (warning, warn) => {
    if (warning.code === 'THIS_IS_UNDEFINED')
        return;

    warn(warning);
};

// Development build: browser bundle only (for dev server)
const developmentConfig = [
    // Declaration bundle (with @vidyano/core bundled)
    {
        input: 'rollup/src/index.d.ts',
        external: ["tslib", "bignumber.js", "lit"],
        plugins: [
            alias({ entries: dtsEntries }),
            dts({ respectExternal: true })
        ],
        output: [
            { file: "../../dev/wwwroot/index.d.ts", format: "es" }
        ],
        watch: false
    },
    // Browser bundle (with @vidyano/core bundled)
    {
        input: 'tests/index.js',
        external: ['String', "__decorate"],
        plugins: [
            ...commonPlugins,
            nodeResolve(),
        ],
        output: [
            { file: "../../dev/wwwroot/index.js", format: "es" },
            { file: "../../dev/wwwroot/index.min.js", format: "es", plugins: [terserMinify] }
        ],
                onwarn: onwarnHandler,
    }
];

// Production build: both npm bundle and browser bundle (for publishing)
const productionConfig = [
    // Declaration bundle for npm (with @vidyano/core as external)
    {
        input: 'rollup/src/index.d.ts',
        external: ["@vidyano/core", "tslib", "bignumber.js", "lit"],
        plugins: [
            alias({ entries: dtsEntries }),
            dts({ respectExternal: true })
        ],
        output: [
            { file: "dist/index.d.ts", format: "es" }
        ],
        watch: false
    },
    // Declaration bundle for browser (with @vidyano/core bundled)
    {
        input: 'rollup/src/index.d.ts',
        external: ["tslib", "bignumber.js", "lit"],
        plugins: [
            alias({ entries: dtsEntries }),
            dts({ respectExternal: true })
        ],
        output: [
            { file: "dist/index.bundle.d.ts", format: "es" }
        ],
        watch: false
    },
    // NPM bundle (with @vidyano/core as external dependency)
    {
        input: 'src/index.js',
        external: ['String', "__decorate", "@vidyano/core"],
        plugins: [
            ...commonPlugins,
            nodeResolve({
                resolveOnly: [/^(?!@vidyano\/core)/]
            }),
        ],
        output: [
            { file: "dist/index.js", format: "es" },
            { file: "dist/index.min.js", format: "es", plugins: [terserMinify] }
        ],
                onwarn: onwarnHandler,
    },
    // Browser bundle (with @vidyano/core bundled - for CDN usage)
    {
        input: 'src/index.js',
        external: ['String', "__decorate"],
        plugins: [
            ...commonPlugins,
            nodeResolve(),
        ],
        output: [
            { file: "dist/index.bundle.js", format: "es" },
            { file: "dist/index.bundle.min.js", format: "es", plugins: [terserMinify] }
        ],
                onwarn: onwarnHandler,
    }
];

export default isDevelopment ? developmentConfig : productionConfig;
