import { build } from "esbuild";

await build({
  entryPoints: ["server/vercelHandler.ts"],
  outfile: "api/[...path].js",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  tsconfig: "tsconfig.json",
  sourcemap: false,
});
