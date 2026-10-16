"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeFrame, type FrameQuality } from "@/lib/frame-quality";
import type { Quad } from "@/lib/arc-height";
import { MouthGuide } from "./MouthGuide";

type CameraOverlayProps = {
  slotLabel: string;
  guide: Quad | null;
  hint: string;
  onCapture: (url: string, quality: FrameQuality) => void;
  onClose: () => void;
};

export function CameraOverlay({ slotLabel, guide, hint, onCapture, onClose }: CameraOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const closedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    stopStream();
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onClose();
  }, [onClose, stopStream]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>(".camera-overlay-close")?.focus();

    let cancelled = false;
    void (async () => {
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia) {
        setError("Este aparelho não permite abrir a câmera aqui. Feche esta janela e escolha uma foto para importar.");
        return;
      }
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled || closedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          return;
        }
        video.srcObject = stream;
        void video.play().catch(() => {
          if (!cancelled) setError("A câmera abriu, mas o vídeo não iniciou. Feche e tente novamente.");
        });
      } catch (reason: unknown) {
        if (cancelled || closedRef.current) return;
        const name = reason instanceof DOMException ? reason.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError("O acesso à câmera foi recusado. Feche esta janela e escolha uma foto para importar.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setError("Não encontramos uma câmera neste aparelho. Feche esta janela e escolha uma foto para importar.");
        } else {
          setError("Não foi possível abrir a câmera. Feche esta janela e escolha uma foto para importar.");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [stopStream]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const cropWidth = Math.min(sourceWidth, (sourceHeight * 4) / 3);
    const cropHeight = Math.min(sourceHeight, (sourceWidth * 3) / 4);
    const cropX = (sourceWidth - cropWidth) / 2;
    const cropY = (sourceHeight - cropHeight) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      setError("O quadro não pôde ser preparado. Feche e tente novamente.");
      return;
    }
    context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    try {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const quality = analyzeFrame({ data: pixels.data, width: pixels.width, height: pixels.height });
      onCapture(canvas.toDataURL("image/jpeg", 0.92), quality);
      close();
    } catch {
      setError("O quadro não pôde ser lido. Feche e tente novamente.");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="camera-overlay"
      aria-labelledby="camera-overlay-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="camera-overlay-panel">
        <header className="camera-overlay-header">
          <div>
            <p className="camera-overlay-eyebrow">Câmera</p>
            <h2 id="camera-overlay-title">{slotLabel}</h2>
          </div>
          <button
            type="button"
            className="camera-overlay-close secondary"
            aria-label="Fechar câmera"
            onClick={close}
          >
            Fechar
          </button>
        </header>
        <div className="camera-overlay-frame">
          <video
            ref={videoRef}
            className="camera-overlay-video"
            muted
            playsInline
            autoPlay
            aria-label={`Prévia da câmera para ${slotLabel}`}
            onLoadedData={() => setReady(true)}
          />
          <MouthGuide quad={guide} label="Molde da boca na foto" />
          {!ready && !error ? <p className="camera-overlay-status">Abrindo a câmera…</p> : null}
        </div>
        <p className="camera-overlay-hint">{hint}</p>
        {error ? <p className="camera-overlay-error" role="alert">{error}</p> : null}
        <div className="camera-overlay-actions">
          <button type="button" onClick={capture} disabled={!ready || Boolean(error)}>
            Fotografar
          </button>
        </div>
      </div>
    </dialog>
  );
}
