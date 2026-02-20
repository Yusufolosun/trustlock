import { defineConfig } from "vitest/config";
import {
    vitestSetupFilePath,
    getClarinetVitestsArgv,
} from "@stacks/clarinet-sdk/vitest";

export default defineConfig({
    test: {
        environment: "clarinet",
        pool: "forks",
        isolate: false,
        maxWorkers: 1,
        setupFiles: [vitestSetupFilePath],
        environmentOptions: {
            clarinet: {
                ...getClarinetVitestsArgv(),
            },
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov", "json-summary"],
            reportsDirectory: "./coverage",
            include: ["tests/**/*.ts"],
        },
    },
});
