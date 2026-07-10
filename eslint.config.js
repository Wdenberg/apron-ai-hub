import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
  // Architectural guardrail: UI layer (components + routes) must not call
  // Supabase directly. All data access goes through src/services/** and
  // src/hooks/**. Documented exceptions are listed in `ignores` below.
  {
    files: ["src/components/**/*.{ts,tsx}", "src/routes/**/*.{ts,tsx}"],
    ignores: [
      // Integration-managed auth guards — must talk to Supabase directly.
      "src/routes/_authenticated/route.tsx",
      "src/routes/admin/route.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package.",
            },
            {
              name: "@/integrations/supabase/client",
              message:
                "UI components/routes must not import the Supabase client directly. Use a hook from src/hooks/** backed by a service in src/services/**.",
            },
            {
              name: "@/integrations/supabase/client.server",
              message:
                "The admin Supabase client is server-only. Use it inside a service or server function, never in UI code.",
            },
          ],
          patterns: [
            {
              group: ["@supabase/supabase-js"],
              message:
                "Do not instantiate Supabase clients in UI code. Add methods to src/services/** and expose them via src/hooks/**.",
            },
          ],
        },
      ],
    },
  },
);
