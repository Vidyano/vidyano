import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import vulcanize from './rollup/vulcanize.js';
import { dts } from "rollup-plugin-dts";
import replace from "@rollup/plugin-replace";
import terser from '@rollup/plugin-terser';

const pjson = require('./package.json');
const forRelease = process.env.NODE_ENV === 'production';

export default [
	{
		input: './rollup/vidyano.ts',
		external: ['String', "__decorate"],
		plugins: [
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
		output: [{ file: 'vidyano.js' }, { file: "wwwroot/dist/vidyano.js" }],
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
		input: './rollup/vidyano.ts',
		external: ["tslib"],
		plugins: [
			dts({
				respectExternal: true
			}),
			replace({
				preventAssignment: true
			})
		],
		output: [{ file: "vidyano.d.ts", format: "es" }, { file: "wwwroot/dist/vidyano.d.ts", format: "es" }],
	},
	{
		input: 'wwwroot/libs/vidyano/vidyano.ts',
		external: ['String', "__decorate"],
		plugins: [
			nodeResolve(),
			commonjs(),
			vulcanize(),
			replace({
				"vidyano-latest-version": pjson.version,
				"process.env.NODE_ENV": "'production'",
				preventAssignment: true
			}),
			forRelease ? terser() : null,
		],
		output: [{ file: 'vidyano-base.js' }, { file: "wwwroot/dist/vidyano-base.js" }],
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
		input: 'wwwroot/libs/vidyano/vidyano.ts',
		external: ["tslib"],
		plugins: [
			dts({
				respectExternal: true
			}),
			replace({
				preventAssignment: true
			})
		],
		output: [{ file: "vidyano-base.d.ts", format: "es" }, { file: "wwwroot/dist/vidyano-base.d.ts", format: "es" }],
	}
];