import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated application workspaces are user/model output, not platform code.
    "workspaces/**",
    // Rust/Cargo build outputs and generated Tauri assets.
    "templates/**/src-tauri/target/**",
    "templates/**/src-tauri/gen/**",
  ]),
]);

export default eslintConfig;
