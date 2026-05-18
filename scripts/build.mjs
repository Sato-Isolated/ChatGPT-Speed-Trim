import { build } from "esbuild";

const watch = process.argv.includes("--watch");

const entries = {
  background: "src/background/index.ts",
  content: "src/content/index.ts",
  "page-main": "src/page/main.ts",
  popup: "src/popup/index.ts"
};

const base = {
  entryPoints: entries,
  outdir: "dist",
  bundle: true,
  sourcemap: true,
  format: "iife",
  target: "chrome120",
  logLevel: "info"
};

if (watch) {
  const ctx = await build({
    ...base,
    watch: true
  });
  console.log("Watching extension build...");
  await new Promise(() => {});
} else {
  await build(base);
  console.log("Extension build complete.");
}
