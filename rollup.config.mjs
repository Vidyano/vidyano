/* Alias code */
import alias from '@rollup/plugin-alias';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const entries = [
	{ find: 'components', replacement: path.resolve(__dirname, 'src/app/web-components') },
	{ find: 'libs', replacement: path.resolve(__dirname, 'src/app/libs') },
	{ find: 'polymer', replacement: path.resolve(__dirname, 'src/app/libs/polymer/polymer') },
	{ find: 'vidyano', replacement: path.resolve(__dirname, 'src/vidyano') },
];
/* End of alias code */

const pjson = require('./package.json');
const forRelease = process.env.NODE_ENV === 'production';

import nodeResolve from '@rollup/plugin-node-resolve';
import vulcanize from './rollup.vulcanize.js';
import { dts } from "rollup-plugin-dts";
import replace from "@rollup/plugin-replace";
import terser from '@rollup/plugin-terser';

const productionPlugins = [
	forRelease ? terser({
		format: {
			comments: false,
		},
	}) : null,
];

export default 
[
	{
		input: './src/app/index.js',
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
			...productionPlugins,
		],
		output: [ { file: "dev/wwwroot/app.js", format: "es" }, { file: "dist/vidyano/index.js", format: "es" }],
		watch: {
			chokidar: {
			  usePolling: true,
			  interval: 500
			}
		}, onwarn(warning, warn) {
			if (warning.code === 'THIS_IS_UNDEFINED')
				return;

			warn(warning);
		},
	},
	forRelease ? {
		input: './src/app/index.js',
		external: ["tslib"],
		plugins: [
			alias({ entries }),
			dts({
				respectExternal: true
			}),
			replace({
				preventAssignment: true
			})
		],
		output: [ { file: "dev/wwwroot/app.d.ts", format: "es" }, { file: "dist/vidyano/index.d.ts", format: "es" }],
	} : null,
	{
		input: 'src/vidyano/index.js',
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
			...productionPlugins,
		],
		output: [ { file: "dist/core/index.js", format: "es" }],
		watch: {
			chokidar: {
			  usePolling: true,
			  interval: 500
			}
		}, onwarn(warning, warn) {
			if (warning.code === 'THIS_IS_UNDEFINED')
				return;

			warn(warning);
		}
	},
	forRelease ? {
		input: 'src/vidyano/index.js',
		external: ["tslib"],
		plugins: [
			alias({ entries }),
			dts({
				respectExternal: true
			}),
			replace({
				preventAssignment: true
			})
		],
		output: [ { file: "dist/core/index.d.ts", format: "es" }],
	} : null,
].filter(Boolean);