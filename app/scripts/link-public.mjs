/**
 * Puts the ONNX file, the wasm runtime, and the val test stills where Next
 * can serve them. A symlink that leaves public/ is not a file the dev
 * server will hand to the browser. Hard links stay inside public/ and share
 * the bytes. The test stills are a temporary shortcut: the frames step
 * fills itself only with dev tools enabled and the URL flag ?test=1.
 */

import { copyFile, link, lstat, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "..");
const isDevelopment = process.env.npm_lifecycle_event !== "prebuild" &&
  process.env.NODE_ENV !== "production" &&
  (process.env.npm_lifecycle_event === "predev" || process.env.NODE_ENV === "development");
loadEnvConfig(appRoot, isDevelopment);
const enableDevFixtures = isDevelopment && process.env.NEXT_PUBLIC_DEV_TOOLS === "true";

await placeFile(
  path.join(repoRoot, "sim/assets/detect/top-layer.onnx"),
  path.join(appRoot, "public/models/top-layer.onnx"),
);
await placeFile(
  path.join(appRoot, "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm"),
  path.join(appRoot, "public/ort/ort-wasm-simd-threaded.wasm"),
);
await placeFile(
  path.join(appRoot, "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs"),
  path.join(appRoot, "public/ort/ort-wasm-simd-threaded.mjs"),
);
const testStillsRoot = path.join(appRoot, "public/test-stills");
if (enableDevFixtures) {
  await placeTree(
    path.join(repoRoot, "sim/assets/detect/images/val"),
    path.join(testStillsRoot, "images/val"),
  );
  await placeTree(
    path.join(repoRoot, "sim/assets/detect/sides/val"),
    path.join(testStillsRoot, "sides/val"),
  );
  await placeTree(
    path.join(repoRoot, "sim/assets/detect/sides/tomato/val"),
    path.join(testStillsRoot, "sides/tomato/val"),
  );
  await placeTree(
    path.join(repoRoot, "sim/assets/detect/probe"),
    path.join(testStillsRoot, "probe"),
  );
} else {
  await rm(testStillsRoot, { recursive: true, force: true });
}

async function placeFile(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  await replaceWithLink(from, to);
}

async function placeTree(fromDir, toDir) {
  const current = await lstat(toDir).catch(() => null);
  if (current?.isSymbolicLink()) await rm(toDir);
  await mkdir(toDir, { recursive: true });
  const entries = await readdir(fromDir, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(fromDir, entry.name);
    const to = path.join(toDir, entry.name);
    if (entry.isDirectory()) await placeTree(from, to);
    else if (entry.isFile()) await replaceWithLink(from, to);
  }
}

async function replaceWithLink(from, to) {
  const current = await lstat(to).catch(() => null);
  if (current?.isSymbolicLink()) await rm(to);
  else if (current) return;
  try {
    await link(from, to);
  } catch {
    await copyFile(from, to);
  }
}
