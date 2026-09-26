"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

const TEST_CLIP = "/test-arc.mp4";

type Phase = "idle" | "recording" | "review";

function pickMimeType(): string | undefined {
  const candidates = ["video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function waitForDimensions(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
  });
}

export default function CapturePage() {
  const liveRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const drawRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (phase !== "recording") return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (drawRef.current !== null) cancelAnimationFrame(drawRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function recordFromVideo(video: HTMLVideoElement) {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("missing canvas");
    await waitForDimensions(video);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("missing canvas");

    const draw = () => {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawRef.current = requestAnimationFrame(draw);
    };
    draw();

    chunksRef.current = [];
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(canvas.captureStream(30), mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      if (drawRef.current !== null) cancelAnimationFrame(drawRef.current);
      drawRef.current = null;
      video.pause();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      setClipUrl((current) => {
        if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
      stopTracks();
      setPhase("review");
    };
    recorderRef.current = recorder;
    recorder.start(200);
    setSeconds(0);
  }

  async function startFromClip(src: string) {
    setError(null);
    stopTracks();
    flushSync(() => setPhase("recording"));
    const video = liveRef.current;
    if (!video) throw new Error("missing preview");
    video.srcObject = null;
    video.src = src;
    video.loop = true;
    video.muted = true;
    await video.play();
    await recordFromVideo(video);
  }

  async function startFromCamera() {
    setError(null);
    stopTracks();
    flushSync(() => setPhase("recording"));
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    streamRef.current = stream;
    const video = liveRef.current;
    if (!video) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("missing preview");
    }
    video.src = "";
    video.srcObject = stream;
    await video.play();
    await recordFromVideo(video);
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  return (
    <>
      <h1>Filme o arco</h1>
      <p className="lede">
        Comece olhando a face longa da caixa e termine olhando de cima. O vídeo fica neste aparelho.
      </p>

      <section className="card">
        {phase === "review" && clipUrl ? (
          <video className="preview" src={clipUrl} controls playsInline />
        ) : (
          <video className="preview" ref={liveRef} muted playsInline />
        )}
        <canvas ref={canvasRef} className="capture-canvas" />

        <div className="actions">
          {phase === "recording" ? (
            <button type="button" onClick={stopRecording}>
              Parar · {seconds}s
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  startFromClip(TEST_CLIP).catch(() => {
                    setPhase("idle");
                    setError("O clipe de teste não abriu.");
                  });
                }}
              >
                Gravar clipe de teste
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  startFromCamera().catch(() => {
                    setPhase("idle");
                    setError("A câmera não abriu.");
                  });
                }}
              >
                Gravar da câmera
              </button>
            </>
          )}
        </div>

        {phase !== "recording" ? (
          <div className="actions">
            <button type="button" className="secondary" onClick={() => fileInputRef.current?.click()}>
              Abrir um vídeo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const url = URL.createObjectURL(file);
                startFromClip(url).catch(() => {
                  URL.revokeObjectURL(url);
                  setPhase("idle");
                  setError("Esse vídeo não abriu.");
                });
              }}
            />
          </div>
        ) : null}

        {error ? <p className="flag">{error}</p> : null}
        {phase === "review" ? (
          <p className="ok">Vídeo guardado só nesta sessão do navegador. Nada foi enviado.</p>
        ) : (
          <p className="note">
            Sem webcam, use o clipe de teste: uma caixa desenhada e um quadrado laranja que anda. O replay tem de
            mostrar os dois. Ainda não há detector.
          </p>
        )}
      </section>
    </>
  );
}
