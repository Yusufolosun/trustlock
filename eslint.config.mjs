import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import vitest from "eslint-plugin-vitest";

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        files: ["tests/**/*.test.ts"],
        plugins: { vitest },
        rules: {
            ...vitest.configs.recommended.rules,
            // Allow any in test utilities (e.g. event parsing)
            "@typescript-eslint/no-explicit-any": "off",
            // Allow non-null assertions in tests (simnet accounts)
            "@typescript-eslint/no-non-null-assertion": "off",
            // Allow unused vars prefixed with _
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    },
    {
        ignores: ["node_modules/", "dist/", "coverage/", "*.config.*"],
    }
);
