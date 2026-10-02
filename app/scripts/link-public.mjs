/**
 * Puts the ONNX file and the wasm runtime where Next can serve them. A
 * symlink that leaves public/ is not a file the dev server will hand to the
 * browser. Hard links stay inside public/ and share the bytes.
 */

import { copyFile, link, lstat, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "..");

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
async function placeFile(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  await replaceWithLink(from, to);
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
