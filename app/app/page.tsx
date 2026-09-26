"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "recording" | "review";

function pickMimeType(): string | undefined {
  const candidates = ["video/webm;codecs=vp9", "video/webm", "video/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export default function CapturePage() {
  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
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
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    setError(null);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    streamRef.current = stream;
    if (liveRef.current) {
      liveRef.current.srcObject = stream;
      await liveRef.current.play();
    }
    chunksRef.current = [];
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      setClipUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
      stream.getTracks().forEach((track) => track.stop());
      setPhase("review");
    };
    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setPhase("recording");
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

        <div className="actions">
          {phase === "recording" ? (
            <button type="button" onClick={stopRecording}>
              Parar · {seconds}s
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                startRecording().catch(() => {
                  setError("A câmera não abriu. Permita o acesso neste navegador e tente de novo.");
                });
              }}
            >
              {phase === "review" ? "Gravar de novo" : "Começar"}
            </button>
          )}
        </div>

        {error ? <p className="flag">{error}</p> : null}
        {phase === "review" ? (
          <p className="ok">Vídeo guardado só nesta sessão do navegador. Nada foi enviado.</p>
        ) : (
          <p className="note">Ainda não há detector. Esta tela só confere a captura.</p>
        )}
      </section>
    </>
  );
}
