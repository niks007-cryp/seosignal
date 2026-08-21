import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const viteCachePath = resolve(process.cwd(), "node_modules", ".vite");

await rm(viteCachePath, { recursive: true, force: true });
console.log("[dev] Cleared stale Vite cache.");
