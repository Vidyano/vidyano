import commonjs from 'rollup-plugin-commonjs';
import execute from 'rollup-plugin-execute'
import nodeResolve from '@rollup/plugin-node-resolve';
import vulcanize from './rollup/vulcanize.js';
import dts from "rollup-plugin-dts";

const vidyano = {
	input: 'rollup/vidyano.ts',
	external: ['String', "__decorate"],
	plugins: [
		nodeResolve(),
		commonjs(),
		vulcanize(),
		execute('uglifyjs wwwroot/dist/vidyano.js -o wwwroot/dist/vidyano.min.js')
	],
	output: [{ file: 'wwwroot/dist/vidyano.js' }],
	watch: {
		chokidar: {
		  usePolling: true,
		  interval: 5000
		}
	}
};

const vidyano_dts = {
	input: 'rollup/vidyano.ts',
	plugins: [
		dts({
			respectExternal: true
		})
	],
	output: [{ file: "wwwroot/dist/vidyano.d.ts", format: "es" }],
	watch: {
		chokidar: {
		  usePolling: true,
		  interval: 5000
		}
	}
};

export default [
	vidyano,
	vidyano_dts
];