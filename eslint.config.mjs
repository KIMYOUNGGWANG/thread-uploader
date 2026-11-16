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
    "*.js",
    "scripts/*.js",
    "scripts/*.mjs",
    // Remotion compositor has its own tsconfig/deps
    "video/**",
    // Local, untracked work areas. Without these `npm run lint` walks every git worktree under .claude/worktrees
    // (6,000+ files, ~40k findings) and the real result drowns.
    ".claude/**",
    "scratch/**",
  ]),
]);

export default eslintConfig;
