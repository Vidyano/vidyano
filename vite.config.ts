import { defineConfig } from "vite"

export default defineConfig({
    test: {
        include: ["test/**/*.test.ts"],
        globals: true,
        environment: "node",
        coverage: {
            provider: "v8",
            include: ["src/**/*.js"],
            exclude: ["src/**/*.ts"],
        }
    }
})