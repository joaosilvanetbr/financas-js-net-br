import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.vitest.test.ts", "tests/**/*.vitest.test.tsx"],
    exclude: ["node_modules", ".test-build"],
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
