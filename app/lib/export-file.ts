import { Capacitor } from "@capacitor/core";

export type ConferenceFileDelivery = "downloaded" | "shared" | "cancelled";

export async function deliverConferenceFile(
  contents: string,
  fileName: string,
): Promise<ConferenceFileDelivery> {
  const safeName = safeFileName(fileName);
  if (Capacitor.isNativePlatform()) {
    return deliverNativeFile(contents, safeName);
  }
  return downloadFile(contents, safeName);
}

function safeFileName(fileName: string): string {
  const name = fileName.replace(/[\\/]+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
  return name && name !== "." && name !== ".." ? name : "conferencias.json";
}

function downloadFile(contents: string, fileName: string): "downloaded" {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("Não foi possível baixar o arquivo neste navegador.");
  }
  const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}

async function deliverNativeFile(contents: string, fileName: string): Promise<"shared" | "cancelled"> {
  try {
    const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: `conference-exports/${fileName}`,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({ files: [uri], title: "Conferências", dialogTitle: "Exportar conferências" });
    return "shared";
  } catch (error) {
    if (isShareCancelled(error)) return "cancelled";
    throw new Error("Não foi possível preparar ou compartilhar o arquivo de conferências.", { cause: error });
  }
}

function isShareCancelled(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("message" in error)) return false;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && /^share cancel+ed$/i.test(message.trim());
}
