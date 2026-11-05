import { defineConfig } from "tsdown";

// Dual ES module + CommonJS build with matching declarations, one file per
// source module so bundlers can drop what a consumer doesn't import.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  platform: "node",
  target: "node22",
  unbundle: true,
  fixedExtension: true,
  dts: true,
  sourcemap: false,
  clean: true,
});
