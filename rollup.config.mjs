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

import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import vulcanize from './rollup.vulcanize.js';
import { dts } from "rollup-plugin-dts";
import replace from "@rollup/plugin-replace";
import terser from '@rollup/plugin-terser';

export default 
[
	{
		input: './src/index.ts',
		external: ['String', "__decorate"],
		plugins: [
			alias({ entries }),
			nodeResolve(),
			commonjs(),
			vulcanize(),
			replace({
				"vidyano-latest-version": pjson.version,
				"process.env.NODE_ENV": "'production'",
				preventAssignment: true
			}),
			forRelease ? terser({
				mangle: {
					keep_classnames: true,
				},
  				compress: false,
  				format: {
					beautify: false,
					comments: false,
  				},
			}) : null,
		],
		output: [ { file: "service/wwwroot/app.js" }],
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
	},
	{
		input: './src/index.ts',
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
		output: [ { file: "service/wwwroot/app.d.ts", format: "es" }],
	},
	{
		input: 'src/vidyano/index.ts',
		external: ['String', "__decorate"],
		plugins: [
    		alias({ entries }),
			nodeResolve(),
			commonjs(),
			vulcanize(),
			replace({
				"vidyano-latest-version": pjson.version,
				"process.env.NODE_ENV": "'production'",
				preventAssignment: true
			})
		],
		output: [ { file: "dist/vidyano.js" }],
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
	},
	{
		input: 'src/vidyano/index.ts',
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
		output: [ { file: "dist/vidyano.d.ts", format: "es" }],
	}
]