import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // Agent worktrees under .claude/ carry their own copy of the suite; run this checkout's only.
  test: { exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.claude/**"] },
})
