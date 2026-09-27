"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { readCrate, writeCrate } from "@/lib/crate-store";
import { analyzeFrame, isConvexQuad, type FrameQuality, type Point } from "@/lib/frame-quality";
import { markTopLayer, type TopLayer } from "@/lib/top-layer";
import {
  fitsTolerance,
  interval,
  tangerineCount,
  tomatoMassKg,
  type Crate,
  type Estimate,
} from "@/lib/packing";

const TEST_CLIP = "/test-arc.mp4";
const EXAMPLE_DENSITY = 0.55;

type ItemKind = "tangerine" | "tomato";
type Step = "item" | "crate" | "film" | "frames" | "corners" | "result";
type CapturePhase = "idle" | "recording" | "review";

type Shot = { url: string; quality: FrameQuality; time: number };

const STEPS: { id: Step; label: string }[] = [
  { id: "item", label: "Item" },
  { id: "crate", label: "Caixa" },
  { id: "film", label: "Filme" },
  { id: "frames", label: "Quadros" },
  { id: "corners", label: "Borda" },
  { id: "result", label: "Resultado" },
];

const CORNER_ORDER = [
  "superior esquerdo",
  "superior direito",
  "inferior direito",
  "inferior esquerdo",
];

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

function grabShot(video: HTMLVideoElement): Omit<Shot, "time"> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context || canvas.width === 0) throw new Error("frame");
  context.drawImage(video, 0, 0);
  return {
    url: canvas.toDataURL("image/jpeg", 0.85),
    quality: analyzeFrame(context.getImageData(0, 0, canvas.width, canvas.height)),
  };
}

function formatClock(seconds: number): string {
  const totalHundredths = Math.round(Math.max(0, seconds) * 100);
  const minutes = Math.floor(totalHundredths / 6000);
  const remainder = totalHundredths % 6000;
  const whole = Math.floor(remainder / 100);
  const hundredths = remainder % 100;
  return `${minutes}:${String(whole).padStart(2, "0")},${String(hundredths).padStart(2, "0")}`;
}

function formatCm(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatEstimate(estimate: Estimate): string {
  const { low, high } = interval(estimate);
  const digits = estimate.unit === "kg" ? 1 : 0;
  return `${estimate.value.toFixed(digits)} ${estimate.unit} · entre ${low.toFixed(digits)} e ${high.toFixed(digits)}`;
}

export function Conference() {
  const liveRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrubRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startedAtRef = useRef(Date.now());
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const drawRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [step, setStep] = useState<Step>("item");
  const [item, setItem] = useState<ItemKind>("tangerine");
  const [name, setName] = useState("Caixa da cozinha");
  const [lengthCm, setLengthCm] = useState("50");
  const [widthCm, setWidthCm] = useState("30");
  const [heightCm, setHeightCm] = useState("22");
  const [capturePhase, setCapturePhase] = useState<CapturePhase>("idle");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [topShot, setTopShot] = useState<Shot | null>(null);
  const [sideShot, setSideShot] = useState<Shot | null>(null);
  const [corners, setCorners] = useState<Point[]>([]);
  const [fillHeight, setFillHeight] = useState("21");
  const [diameter, setDiameter] = useState("6");
  const [topCount, setTopCount] = useState("28");
  const [scaleKg, setScaleKg] = useState("");
  const [layer, setLayer] = useState<TopLayer | null>(null);
  const [layerNote, setLayerNote] = useState<string | null>(null);
  const [passageMs, setPassageMs] = useState<number | null>(null);

  useEffect(() => {
    const saved = readCrate();
    if (!saved) return;
    setName(saved.name);
    setLengthCm(String(saved.lengthCm));
    setWidthCm(String(saved.widthCm));
    setHeightCm(String(saved.heightCm));
  }, []);

  useEffect(() => {
    if (capturePhase !== "recording") return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [capturePhase]);

  useEffect(() => {
    return () => {
      if (drawRef.current !== null) cancelAnimationFrame(drawRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (step !== "result" || !topShot || corners.length !== 4) return;
    let cancelled = false;
    setLayer(null);
    setLayerNote(null);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        if (!cancelled) setLayerNote("O quadro de cima não pôde ser lido.");
        return;
      }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      try {
        const found = markTopLayer(
          { data: pixels.data, width: pixels.width, height: pixels.height },
          corners,
          Number(lengthCm),
          Number(widthCm),
          item,
        );
        if (cancelled) return;
        setLayer(found);
        setPassageMs(Date.now() - startedAtRef.current);
        if (found.medianDiameterCm !== null) setDiameter(found.medianDiameterCm.toFixed(1));
        if (item === "tangerine") setTopCount(String(found.count));
      } catch {
        if (!cancelled) setLayerNote("A borda não deu para usar como régua.");
      }
    };
    image.onerror = () => {
      if (!cancelled) setLayerNote("O quadro de cima não pôde ser lido.");
    };
    image.src = topShot.url;
    return () => {
      cancelled = true;
    };
  }, [step, topShot, corners, item, lengthCm, widthCm]);

  const crate: Crate = {
    name: name.trim() || "Caixa",
    lengthCm: Number(lengthCm),
    widthCm: Number(widthCm),
    heightCm: Number(heightCm),
  };
  const crateReady = crate.lengthCm > 0 && crate.widthCm > 0 && crate.heightCm > 0;

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
      setRecordingUrl((current) => {
        if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
      stopTracks();
      setCapturePhase("review");
    };
    recorderRef.current = recorder;
    recorder.start(200);
    setSeconds(0);
  }

  async function startFromClip(src: string) {
    setError(null);
    stopTracks();
    setTopShot(null);
    setSideShot(null);
    setCorners([]);
    flushSync(() => setCapturePhase("recording"));
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
    flushSync(() => setCapturePhase("recording"));
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

  function takeShot(which: "top" | "side") {
    const video = scrubRef.current;
    if (!video) return;
    try {
      const shot = { ...grabShot(video), time: video.currentTime };
      if (which === "top") setTopShot(shot);
      else setSideShot(shot);
      setError(null);
    } catch {
      setError("Espere a imagem aparecer e escolha de novo.");
    }
  }

  function seekTo(time: number) {
    const video = scrubRef.current;
    if (!video) return;
    const go = () => {
      video.currentTime = time;
    };
    if (video.readyState >= 1) go();
    else video.addEventListener("loadedmetadata", go, { once: true });
    video.pause();
  }

  function addCorner(event: MouseEvent<HTMLImageElement>) {
    if (corners.length >= 4) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
    setCorners((current) => [...current, point]);
  }

  const height = Number(fillHeight);
  const diameterCm = Number(diameter);
  const count = Number(topCount);
  const numbersReady =
    height > 0 && diameterCm > 0 && height <= crate.heightCm && (item === "tomato" || count >= 0);
  let estimate: Estimate | null = null;
  if (step === "result" && numbersReady) {
    estimate =
      item === "tangerine"
        ? tangerineCount(count, diameterCm, height)
        : tomatoMassKg(crate, height, EXAMPLE_DENSITY);
  }
  const needsScale = estimate ? !fitsTolerance(estimate, 0.1) || estimate.flags.length > 0 : false;
  const typedScale = Number(scaleKg);
  const cornersReady = corners.length === 4 && isConvexQuad(corners);

  return (
    <>
      <p className="steps">
        {STEPS.map((entry, index) => (
          <span key={entry.id} className={entry.id === step ? "step is-current" : "step"}>
            {index + 1}. {entry.label}
          </span>
        ))}
      </p>

      {step === "item" ? (
        <section className="card">
          <h1>O que chegou?</h1>
          <button
            type="button"
            className={item === "tangerine" ? "choice" : "choice secondary"}
            aria-pressed={item === "tangerine"}
            onClick={() => setItem("tangerine")}
          >
            Tangerina, em unidades
          </button>
          <button
            type="button"
            className={item === "tomato" ? "choice" : "choice secondary"}
            aria-pressed={item === "tomato"}
            onClick={() => setItem("tomato")}
          >
            Tomate, em quilos
          </button>
          <div className="actions">
            <button type="button" onClick={() => setStep("crate")}>
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {step === "crate" ? (
        <section className="card">
          <h1>Vão interno</h1>
          <p className="lede">Medido por dentro, em centímetros. Fica salvo neste aparelho.</p>
          <label>
            Nome
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Comprimento
            <input inputMode="decimal" value={lengthCm} onChange={(event) => setLengthCm(event.target.value)} />
          </label>
          <label>
            Largura
            <input inputMode="decimal" value={widthCm} onChange={(event) => setWidthCm(event.target.value)} />
          </label>
          <label>
            Altura
            <input inputMode="decimal" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} />
          </label>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep("item")}>
              Voltar
            </button>
            <button
              type="button"
              disabled={!crateReady}
              onClick={() => {
                writeCrate(crate);
                setStep("film");
              }}
            >
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {step === "film" ? (
        <section className="card">
          <h1>Filme o arco</h1>
          <p className="lede">Sem webcam, use o clipe de teste. Ele já traz uma caixa desenhada.</p>
          {capturePhase === "review" && recordingUrl ? (
            <video className="preview" src={recordingUrl} controls playsInline />
          ) : (
            <video className="preview" ref={liveRef} muted playsInline />
          )}
          <canvas ref={canvasRef} className="capture-canvas" />
          <div className="actions">
            {capturePhase === "recording" ? (
              <button type="button" onClick={() => recorderRef.current?.stop()}>
                Parar · {seconds}s
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    startFromClip(TEST_CLIP).catch(() => {
                      setCapturePhase("idle");
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
                      setCapturePhase("idle");
                      setError("A câmera não abriu.");
                    });
                  }}
                >
                  Gravar da câmera
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Abrir um vídeo
                </button>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              startFromClip(URL.createObjectURL(file)).catch(() => {
                setCapturePhase("idle");
                setError("Esse vídeo não abriu.");
              });
            }}
          />
          {error ? <p className="flag">{error}</p> : null}
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep("crate")}>
              Voltar
            </button>
            <button type="button" disabled={!recordingUrl} onClick={() => setStep("frames")}>
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {step === "frames" && recordingUrl ? (
        <section className="card">
          <h1>Escolha dois quadros</h1>
          <p className="lede">
            Pause o vídeo num instante visto de cima e noutro visto de lado. No clipe de teste, os dois podem ser o
            mesmo desenho.
          </p>
          <video className="preview preview-wide" ref={scrubRef} src={recordingUrl} controls playsInline />
          <ShotPick
            label="Vista de cima"
            shot={topShot}
            onTake={() => takeShot("top")}
            onSeek={() => topShot && seekTo(topShot.time)}
          />
          <ShotPick
            label="Vista de lado"
            shot={sideShot}
            onTake={() => takeShot("side")}
            onSeek={() => sideShot && seekTo(sideShot.time)}
          />
          {error ? <p className="flag">{error}</p> : null}
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep("film")}>
              Voltar
            </button>
            <button
              type="button"
              disabled={!topShot || !sideShot}
              onClick={() => {
                setCorners([]);
                setStep("corners");
              }}
            >
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {step === "corners" && topShot ? (
        <section className="card">
          <h1>Marque a borda</h1>
          <p className="lede">
            Toque os quatro cantos internos, nesta ordem: {CORNER_ORDER.join(", ")}.
            {corners.length < 4 ? ` Falta o ${CORNER_ORDER[corners.length]}.` : ""}
          </p>
          <div className="marker">
            <img src={topShot.url} alt="Vista de cima" onClick={addCorner} />
            {corners.map((point, index) => (
              <span
                key={`${point.x}-${point.y}`}
                className="dot"
                style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
              >
                {index + 1}
              </span>
            ))}
          </div>
          {corners.length === 4 && !cornersReady ? (
            <p className="flag">Esses quatro pontos se cruzam. Toque de novo, seguindo a ordem.</p>
          ) : null}
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setCorners([])}>
              Refazer
            </button>
            <button type="button" disabled={!cornersReady} onClick={() => setStep("result")}>
              Continuar
            </button>
          </div>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep("frames")}>
              Voltar
            </button>
          </div>
        </section>
      ) : null}

      {step === "result" ? (
        <section className="card">
          <h1>{item === "tangerine" ? "Tangerina" : "Tomate"}</h1>
          <p className="lede">
            As marcas saem da cor da casca, uma vez, no quadro de cima. Laranja conta como tangerina e vermelho como
            tomate. Ainda não é o YOLO. A altura do monte continua digitada.
          </p>
          {topShot ? (
            <div className="marker">
              <img src={topShot.url} alt="Vista de cima com as marcas" />
              {layer?.marks.map((mark) => (
                <span
                  key={`${mark.x}-${mark.y}`}
                  className="fruit-mark"
                  style={{
                    left: `${mark.x * 100}%`,
                    top: `${mark.y * 100}%`,
                    width: `${mark.radius * 2 * 100}%`,
                  }}
                />
              ))}
            </div>
          ) : null}
          {layer ? (
            <p className={layer.matchesItem ? "ok" : "flag"}>
              {layer.matchesItem
                ? `${layer.count} ${layer.count === 1 ? "marca" : "marcas"} dentro da borda. Diâmetro mediano ${formatCm(layer.medianDiameterCm ?? 0)} cm. A leitura levou ${Math.round(layer.elapsedMs)} ms.`
                : item === "tangerine"
                  ? "Nenhuma tangerina dentro da borda. A contagem abaixo não veio de uma fruta marcada."
                  : "Nenhum tomate dentro da borda. O quilo por litro continua sendo o exemplo."}
            </p>
          ) : (
            <p className={layerNote ? "flag" : "note"}>{layerNote ?? "Lendo o quadro de cima."}</p>
          )}
          {passageMs !== null ? (
            <p className="note">
              Esta passagem levou {formatClock(passageMs / 1000)} neste computador. O minuto oficial espera o celular de
              referência.
            </p>
          ) : null}
          <label>
            Altura do monte (cm)
            <input value={fillHeight} inputMode="decimal" onChange={(event) => setFillHeight(event.target.value)} />
          </label>
          <label>
            Diâmetro mediano (cm)
            <input value={diameter} inputMode="decimal" onChange={(event) => setDiameter(event.target.value)} />
          </label>
          {item === "tangerine" ? (
            <label>
              Frutas visíveis em cima
              <input value={topCount} inputMode="numeric" onChange={(event) => setTopCount(event.target.value)} />
            </label>
          ) : (
            <p className="note">Quilos por litro de exemplo: {EXAMPLE_DENSITY}. O lote ainda não foi pesado.</p>
          )}
          {estimate ? (
            <>
              <div className="result">
                <span>Estimativa da foto</span>
                <strong>{formatEstimate(estimate)}</strong>
              </div>
              {estimate.flags.length > 0 ? (
                <p className="flag">A altura não fecha com um número inteiro de camadas.</p>
              ) : null}
              {needsScale ? (
                <>
                  <p className="flag">
                    A incerteza orçada ainda passa de 10%. Se a caixa couber na balança, digite o peso do visor. Se não
                    couber, fica a estimativa da foto.
                  </p>
                  <label>
                    Peso da balança (kg)
                    <input value={scaleKg} inputMode="decimal" onChange={(event) => setScaleKg(event.target.value)} />
                  </label>
                  {item === "tomato" && typedScale > 0 ? (
                    <div className="result">
                      <span>Resultado</span>
                      <strong>{typedScale.toFixed(1)} kg</strong>
                    </div>
                  ) : null}
                  {item === "tangerine" && typedScale > 0 ? (
                    <p className="note">
                      O peso não vira unidades sem a massa média de uma fruta deste lote. A contagem da foto permanece, e
                      a caixa fica marcada como incerta.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="ok">O intervalo cabe na meta.</p>
              )}
            </>
          ) : (
            <p className="flag">A altura do monte precisa caber na caixa, e os outros campos precisam ser positivos.</p>
          )}
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep("corners")}>
              Voltar
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

function ShotPick({
  label,
  shot,
  onTake,
  onSeek,
}: {
  label: string;
  shot: Shot | null;
  onTake: () => void;
  onSeek: () => void;
}) {
  const quality =
    shot && shot.quality.warnings.length > 0 ? shot.quality.warnings.join(" ") : "luz aceitável";
  return (
    <div className="shot-pick">
      <button type="button" onClick={onTake}>
        {label}
      </button>
      {shot ? (
        <>
          <p className={shot.quality.warnings.length > 0 ? "flag shot-moment" : "ok shot-moment"}>
            {formatClock(shot.time)} · {quality}
          </p>
          <button type="button" className="secondary" onClick={onSeek}>
            Pular para este quadro
          </button>
        </>
      ) : (
        <p className="note shot-moment">Ainda não escolhida.</p>
      )}
    </div>
  );
}
