import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";

const complexityLimit = Number(process.env.ESLINT_COMPLEXITY_LIMIT ?? "10");
const cognitiveLimit = Number(process.env.ESLINT_COGNITIVE_LIMIT ?? "15");
const cognitiveSeverity = process.env.CI_STRICT === "1" ? "error" : "warn";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "reports/**",
      "artifacts/**",
      "tools/**",
      ".venv/**",
      "eslint.config.mjs",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        process: "readonly",
      },
    },
    plugins: {
      sonarjs,
    },
    rules: {
      complexity: ["error", complexityLimit],
      "sonarjs/cognitive-complexity": [cognitiveSeverity, cognitiveLimit],
    },
  },
];
