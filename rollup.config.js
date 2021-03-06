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
				"moment_d as moment": "moment"
			})
		],
		output: [{ file: "vidyano.d.ts", format: "es" }, { file: "wwwroot/dist/vidyano.d.ts", format: "es" }],
	}
];