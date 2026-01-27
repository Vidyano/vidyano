import nodeResolve from '@rollup/plugin-node-resolve';
import { dts } from "rollup-plugin-dts";

export default [
    // Declaration bundle
    {
        input: 'rollup/index.d.ts',
        external: ["@vidyano/core"],
        plugins: [
            dts({ respectExternal: true })
        ],
        output: [{ file: "dist/index.d.ts", format: "es" }],
        watch: false
    },
    // Implementation bundle
    {
        input: 'src/index.js',
        external: ["@vidyano/core"],
        plugins: [
            nodeResolve()
        ],
        output: [
            { file: "dist/index.js", format: "es" }
        ],
        onwarn(warning, warn) {
            if (warning.code === 'THIS_IS_UNDEFINED')
                return;

            warn(warning);
        }
    }
];
