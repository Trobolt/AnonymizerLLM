import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [".."],
    },
  },
  resolve: {
    alias: {
      "@": __dirname,
      "@testing-library/react": path.resolve(
        __dirname,
        "node_modules/@testing-library/react"
      ),
      "@testing-library/jest-dom": path.resolve(
        __dirname,
        "node_modules/@testing-library/jest-dom"
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["../tests/frontend/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
