/**
 * Starts `next dev` with PORT and HOSTNAME from app/.env.
 *
 * Defaults match the book: localhost:3001. Override in .env when that
 * address is taken or when the phone reverse needs another port.
 *
 * Node resolves "localhost" to one address. On this machine that is ::1,
 * so a server started with -H localhost refuses 127.0.0.1. adb reverse and
 * `make dev-usb` use that IPv4 loopback, and the phone then cannot open
 * Conferir. Loopback hosts listen on one family and mirror the other.
 */

import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Where Next should bind, and which other loopback should be forwarded to it.
 * A non-loopback HOSTNAME is used as written and is not mirrored.
 */
export function listenPlan(host) {
  if (host === "localhost" || host === "127.0.0.1") {
    return { nextHost: "127.0.0.1", mirrorHost: "::1" };
  }
  if (host === "::1") {
    return { nextHost: "::1", mirrorHost: "127.0.0.1" };
  }
  return { nextHost: host, mirrorHost: null };
}

/** TCP forwarder so the other loopback reaches the same port. */
export function mirrorLoopback(port, fromHost, toHost) {
  const server = net.createServer((client) => {
    const upstream = net.connect({ host: toHost, port: Number(port) });
    const closeBoth = () => {
      client.destroy();
      upstream.destroy();
    };
    upstream.on("error", closeBoth);
    client.on("error", closeBoth);
    client.pipe(upstream);
    upstream.pipe(client);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(port), fromHost, () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

async function main() {
  nextEnv.loadEnvConfig(appRoot, true);
  const port = process.env.PORT?.trim() || "3001";
  const host = process.env.HOSTNAME?.trim() || "localhost";
  const plan = listenPlan(host);
  const nextBin = path.join(appRoot, "node_modules/next/dist/bin/next");

  let mirror = null;
  if (plan.mirrorHost) {
    try {
      mirror = await mirrorLoopback(port, plan.mirrorHost, plan.nextHost);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`Não foi possível abrir ${plan.mirrorHost}:${port} (${detail}).`);
      process.exit(1);
    }
    console.log(`http://localhost:${port} atende 127.0.0.1 e ::1.`);
  }

  const child = spawn(process.execPath, [nextBin, "dev", "-H", plan.nextHost, "-p", port], {
    cwd: appRoot,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    mirror?.close();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

if (isDirectRun()) {
  main();
}
