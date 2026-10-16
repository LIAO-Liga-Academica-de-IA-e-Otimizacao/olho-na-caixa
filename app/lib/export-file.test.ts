import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";

const pluginMocks = vi.hoisted(() => ({
  writeFile: vi.fn(),
  share: vi.fn(),
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Encoding: { UTF8: "utf8" },
  Filesystem: { writeFile: pluginMocks.writeFile },
}));

vi.mock("@capacitor/share", () => ({ Share: { share: pluginMocks.share } }));

describe("deliverConferenceFile", () => {
  beforeEach(() => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    pluginMocks.writeFile.mockResolvedValue({ uri: "file:///cache/conference.json" });
    pluginMocks.share.mockResolvedValue({ activityType: "mail" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    pluginMocks.writeFile.mockReset();
    pluginMocks.share.mockReset();
  });

  it("downloads a JSON file in the browser and releases its object URL afterward", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const anchor = { href: "", download: "", style: { display: "" }, click: vi.fn(), remove: vi.fn() };
    const createObjectURL = vi.fn().mockReturnValue("blob:conference-export");
    const revokeObjectURL = vi.fn();
    let cleanup: (() => void) | undefined;
    const setTimeout = vi.fn((callback: () => void) => { cleanup = callback; return 1; });
    const appendChild = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn().mockReturnValue(anchor), body: { appendChild } });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("window", { setTimeout });
    const { deliverConferenceFile } = await import("./export-file");

    await expect(deliverConferenceFile('{"records":[]}', "team.json")).resolves.toBe("downloaded");
    expect(anchor.download).toBe("team.json");
    expect(anchor.href).toBe("blob:conference-export");
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json;charset=utf-8");
    expect(await blob.text()).toBe('{"records":[]}');
    expect(revokeObjectURL).not.toHaveBeenCalled();
    cleanup?.();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:conference-export");
    expect(pluginMocks.writeFile).not.toHaveBeenCalled();
  });

  it("writes UTF-8 JSON to cache and shares the resulting URI", async () => {
    const { deliverConferenceFile } = await import("./export-file");

    const result = await deliverConferenceFile("{\"lots\":[]}", "team conference.json");

    expect(result).toBe("shared");
    expect(pluginMocks.writeFile).toHaveBeenCalledWith({
      path: "conference-exports/team_conference.json",
      data: "{\"lots\":[]}",
      directory: "CACHE",
      encoding: "utf8",
      recursive: true,
    });
    expect(pluginMocks.share).toHaveBeenCalledWith({
      files: ["file:///cache/conference.json"],
      title: "Conferências",
      dialogTitle: "Exportar conferências",
    });
  });

  it("reports native share cancellation without claiming delivery", async () => {
    pluginMocks.share.mockRejectedValue(new Error("Share canceled"));
    const { deliverConferenceFile } = await import("./export-file");

    await expect(deliverConferenceFile("{}", "conferencias.json")).resolves.toBe("cancelled");
  });

  it("throws a Portuguese error when native file preparation fails", async () => {
    pluginMocks.writeFile.mockRejectedValue(new Error("disk unavailable"));
    const { deliverConferenceFile } = await import("./export-file");

    await expect(deliverConferenceFile("{}", "conferencias.json")).rejects.toThrow(
      "Não foi possível preparar ou compartilhar o arquivo de conferências.",
    );
    expect(pluginMocks.share).not.toHaveBeenCalled();
  });
});
