import commonjs from 'rollup-plugin-commonjs';
import execute from 'rollup-plugin-execute'
import nodeResolve from '@rollup/plugin-node-resolve';
import vulcanize from './dist/vulcanize.js';

export default [
	{
        inlineDynamicImports: true,
		input: 'dist/input.ts',
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
	}
];