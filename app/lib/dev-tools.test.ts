import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("DEV_TOOLS_ENABLED", () => {
  it("enables tools only for development with the explicit flag", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEV_TOOLS", "true");
    vi.resetModules();

    const { DEV_TOOLS_ENABLED } = await import("./dev-tools");
    expect(DEV_TOOLS_ENABLED).toBe(true);
  });

  it("keeps tools disabled in production even when the flag is true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_TOOLS", "true");
    vi.resetModules();

    const { DEV_TOOLS_ENABLED } = await import("./dev-tools");
    expect(DEV_TOOLS_ENABLED).toBe(false);
  });

  it("keeps tools disabled in development unless the flag is true", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEV_TOOLS", "false");
    vi.resetModules();

    const { DEV_TOOLS_ENABLED } = await import("./dev-tools");
    expect(DEV_TOOLS_ENABLED).toBe(false);
  });
});
