import { defineConfig } from "tsup"

export default defineConfig({
  entry: { main: "src/main.ts" },
  format: ["esm"],
  target: "node20",
  clean: true,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
})
