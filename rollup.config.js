import commonjs from 'rollup-plugin-commonjs';
import execute from 'rollup-plugin-execute';
import nodeResolve from '@rollup/plugin-node-resolve';
import vulcanize from './rollup/vulcanize.js';
import dts from "rollup-plugin-dts";
import replace from "@rollup/plugin-replace";

export default [
	{
		input: 'rollup/vidyano.ts',
		external: ['String', "__decorate"],
		plugins: [
			nodeResolve(),
			commonjs(),
			vulcanize(),
			replace({
				"moment$1 as moment": "moment"
			})
		],
		output: [{ file: 'wwwroot/dist/vidyano.js' }],
		watch: {
			chokidar: {
			  usePolling: true,
			  interval: 5000
			}
		}
	},
	{
		input: "wwwroot/dist/vidyano.js",
		plugins: [execute('uglifyjs wwwroot/dist/vidyano.js -o wwwroot/dist/vidyano.min.js')],
		output: [{ file: 'wwwroot/dist/vidyano.min.js' }]
	},
	{
		input: 'rollup/vidyano.ts',
		external: ["codemirror", "tslib"],
		plugins: [
			dts({
				respectExternal: true
			}),
			replace({
				"moment_d as moment": "moment"
			})
		],
		output: [{ file: "wwwroot/dist/vidyano.d.ts", format: "es" }]
	}
];