import net from "node:net";
import { describe, expect, it } from "vitest";
import { listenPlan, mirrorLoopback } from "./run-dev.mjs";

describe("listenPlan", () => {
  it("puts localhost on both loopbacks", () => {
    expect(listenPlan("localhost")).toEqual({ nextHost: "127.0.0.1", mirrorHost: "::1" });
    expect(listenPlan("127.0.0.1")).toEqual({ nextHost: "127.0.0.1", mirrorHost: "::1" });
    expect(listenPlan("::1")).toEqual({ nextHost: "::1", mirrorHost: "127.0.0.1" });
  });

  it("leaves a chosen network address alone", () => {
    expect(listenPlan("0.0.0.0")).toEqual({ nextHost: "0.0.0.0", mirrorHost: null });
  });
});

describe("mirrorLoopback", () => {
  it("forwards the other loopback to the listener on the same port", async () => {
    const echo = net.createServer((socket) => {
      socket.pipe(socket);
    });
    await new Promise<void>((resolve, reject) => {
      echo.once("error", reject);
      echo.listen(0, "127.0.0.1", () => resolve());
    });
    const address = echo.address();
    if (!address || typeof address === "string") throw new Error("echo did not bind");
    const mirror = await mirrorLoopback(address.port, "::1", "127.0.0.1");
    const received = await new Promise<string>((resolve, reject) => {
      const client = net.connect({ host: "::1", port: address.port }, () => client.write("ping"));
      client.once("data", (chunk) => {
        client.end();
        resolve(chunk.toString());
      });
      client.once("error", reject);
    });
    mirror.close();
    echo.close();
    expect(received).toBe("ping");
  });
});
