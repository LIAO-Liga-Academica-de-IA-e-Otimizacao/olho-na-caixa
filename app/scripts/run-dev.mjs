/**
 * Starts `next dev` with PORT and HOSTNAME from app/.env.
 *
 * Defaults match the book: localhost:3001. Override in .env when that
 * address is taken or when the phone reverse needs another port.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(appRoot, true);

const port = process.env.PORT?.trim() || "3001";
const host = process.env.HOSTNAME?.trim() || "localhost";
const nextBin = path.join(appRoot, "node_modules/next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, "dev", "-H", host, "-p", port], {
  cwd: appRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
