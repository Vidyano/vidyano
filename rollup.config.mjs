import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import vulcanize from './rollup/vulcanize.js';
import { dts } from "rollup-plugin-dts";
import replace from "@rollup/plugin-replace";
import cleanup from 'rollup-plugin-cleanup';

const pjson = require('./package.json');
const forRelease = process.env.NODE_ENV === 'production';

export default [
	{
		input: 'rollup/vidyano.ts',
		external: ['String', "__decorate"],
		plugins: [
			nodeResolve(),
			commonjs(),
			vulcanize(),
			replace({
				"moment$1 as moment": "moment",
				"vidyano-latest-version": pjson.version,
				"process.env.NODE_ENV": "'production'",
				preventAssignment: true
			}),
			forRelease ? cleanup({
				comments: "none"
			}) : null
		],
		output: [{ file: 'vidyano.js' }, { file: "wwwroot/dist/vidyano.js" }],
		watch: {
			chokidar: {
			  usePolling: true,
			  interval: 5000
			}
		}
	},
	{
		input: 'rollup/vidyano.ts',
		external: ["codemirror", "tslib"],
		plugins: [
			dts({
				respectExternal: true
			}),
			replace({
				"moment_d as moment": "moment",
				preventAssignment: true
			})
		],
		output: [{ file: "vidyano.d.ts", format: "es" }, { file: "wwwroot/dist/vidyano.d.ts", format: "es" }],
	}
];