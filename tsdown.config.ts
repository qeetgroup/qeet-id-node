import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

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
  // VERSION comes from package.json, the one place a release changes it.
  define: { __QEET_ID_SDK_VERSION__: JSON.stringify(version) },
});
