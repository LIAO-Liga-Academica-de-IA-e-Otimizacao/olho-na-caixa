"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { readCrate, writeCrate } from "@/lib/crate-store";
import { analyzeFrame, isConvexQuad, type FrameQuality, type Point } from "@/lib/frame-quality";
import { estimateFromLid, readArcLid, type RgbImage } from "@/lib/arc-height";
import { detectTopLayer } from "@/lib/yolo-detect";
import type { TopLayer } from "@/lib/top-layer";
import { FruitBoxes } from "./FruitBoxes";
import { fitsTolerance, interval, type Crate, type Estimate } from "@/lib/packing";

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

function imageToRgb(url: string): Promise<RgbImage> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("O quadro não pôde ser lido."));
        return;
      }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const rgb = new Float32Array(canvas.width * canvas.height * 3);
      for (let index = 0, pixel = 0; index < pixels.data.length; index += 4, pixel += 3) {
        rgb[pixel] = pixels.data[index] / 255;
        rgb[pixel + 1] = pixels.data[index + 1] / 255;
        rgb[pixel + 2] = pixels.data[index + 2] / 255;
      }
      resolve({ width: canvas.width, height: canvas.height, rgb });
    };
    image.onerror = () => reject(new Error("O quadro não pôde ser lido."));
    image.src = url;
  });
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageSlotRef = useRef<"top" | "a" | "b" | "c">("top");
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
  const [filmLabel, setFilmLabel] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [topShot, setTopShot] = useState<Shot | null>(null);
  const [topFileName, setTopFileName] = useState<string | null>(null);
  const [corners, setCorners] = useState<Point[]>([]);
  const [arcA, setArcA] = useState<string | null>(null);
  const [arcB, setArcB] = useState<string | null>(null);
  const [arcC, setArcC] = useState<string | null>(null);
  const [arcNames, setArcNames] = useState<{ a: string | null; b: string | null; c: string | null }>({
    a: null,
    b: null,
    c: null,
  });
  const [lidCm, setLidCm] = useState<number | null>(null);
  const [arcNote, setArcNote] = useState<string | null>(null);
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
      detectTopLayer(
        { data: pixels.data, width: pixels.width, height: pixels.height },
        corners,
        Number(lengthCm),
        Number(widthCm),
        item,
      )
        .then((found) => {
          if (cancelled) return;
          setLayer(found);
          setPassageMs(Date.now() - startedAtRef.current);
        })
        .catch(() => {
          if (!cancelled) setLayerNote("O modelo da camada de cima não pôde ser lido.");
        });
    };
    image.onerror = () => {
      if (!cancelled) setLayerNote("O quadro de cima não pôde ser lido.");
    };
    image.src = topShot.url;
    return () => {
      cancelled = true;
    };
  }, [step, topShot, corners, item, lengthCm, widthCm]);

  useEffect(() => {
    if (step !== "result") return;
    if (!arcA || !arcB || (item === "tangerine" && !arcC)) {
      setLidCm(null);
      setArcNote(item === "tangerine" ? "Faltam os quadros A, B e C do arco." : "Faltam os quadros A e B do arco.");
      return;
    }
    let cancelled = false;
    setLidCm(null);
    setArcNote("Lendo a altura nos quadros do arco.");
    const urls = [arcA, arcB, item === "tangerine" ? arcC : null].filter((url): url is string => url !== null);
    Promise.all(urls.map((url) => imageToRgb(url)))
      .then((frames) => {
        if (cancelled) return;
        setLidCm(readArcLid(item, frames).heightCm);
        setArcNote(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setLidCm(null);
        setArcNote(reason instanceof Error ? reason.message : "A altura não pôde ser lida.");
      });
    return () => {
      cancelled = true;
    };
  }, [step, item, arcA, arcB, arcC]);

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

  async function startFromClip(src: string, label: string) {
    setFilmLabel(label);
    setError(null);
    stopTracks();
    setTopShot(null);
    setTopFileName(null);
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
    setFilmLabel("Câmera");
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

  function takeShot() {
    const video = scrubRef.current;
    if (!video) return;
    try {
      const shot = { ...grabShot(video), time: video.currentTime };
      setTopShot(shot);
      setTopFileName(null);
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

  function openImage(slot: "top" | "a" | "b" | "c") {
    imageSlotRef.current = slot;
    imageInputRef.current?.click();
  }

  function storeImage(file: File) {
    const url = URL.createObjectURL(file);
    const slot = imageSlotRef.current;
    if (slot === "top") {
      setTopShot({ url, time: 0, quality: { brightness: 0, clippedFraction: 0, warnings: [] } });
      setTopFileName(file.name);
      setCorners([]);
      return;
    }
    if (slot === "a") {
      setArcA(url);
      setArcNames((current) => ({ ...current, a: file.name }));
    } else if (slot === "b") {
      setArcB(url);
      setArcNames((current) => ({ ...current, b: file.name }));
    } else {
      setArcC(url);
      setArcNames((current) => ({ ...current, c: file.name }));
    }
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

  const diameterCm = layer?.medianDiameterCm && layer.medianDiameterCm > 0 ? layer.medianDiameterCm : 5.1;
  let estimate: Estimate | null = null;
  if (step === "result" && lidCm !== null && lidCm > 0) {
    estimate = estimateFromLid(item, lidCm, diameterCm, EXAMPLE_DENSITY);
  }
  const arcReady = Boolean(arcA && arcB && (item === "tomato" || arcC));
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
          <p className="lede">
            O vídeo, se houver, serve para escolher a vista de cima. A altura não sai dele. Sem vídeo, continue e abra
            as fotos do protocolo na próxima tela.
          </p>
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
                  className={filmLabel === "Clipe de teste" ? undefined : "secondary"}
                  aria-pressed={filmLabel === "Clipe de teste"}
                  onClick={() => {
                    startFromClip(TEST_CLIP, "Clipe de teste").catch(() => {
                      setFilmLabel(null);
                      setCapturePhase("idle");
                      setError("O clipe de teste não abriu.");
                    });
                  }}
                >
                  Gravar clipe de teste
                </button>
                <button
                  type="button"
                  className={filmLabel === "Câmera" ? undefined : "secondary"}
                  aria-pressed={filmLabel === "Câmera"}
                  onClick={() => {
                    startFromCamera().catch(() => {
                      setFilmLabel(null);
                      setCapturePhase("idle");
                      setError("A câmera não abriu.");
                    });
                  }}
                >
                  Gravar da câmera
                </button>
                <button
                  type="button"
                  className={filmLabel !== null && filmLabel !== "Clipe de teste" && filmLabel !== "Câmera" ? undefined : "secondary"}
                  aria-pressed={filmLabel !== null && filmLabel !== "Clipe de teste" && filmLabel !== "Câmera"}
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
              startFromClip(URL.createObjectURL(file), file.name).catch(() => {
                setFilmLabel(null);
                setCapturePhase("idle");
                setError("Esse vídeo não abriu.");
              });
            }}
          />
          {filmLabel && capturePhase === "review" ? <p className="ok">Vídeo escolhido: {filmLabel}.</p> : null}
          {error ? <p className="flag">{error}</p> : null}
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep("crate")}>
              Voltar
            </button>
            <button type="button" onClick={() => setStep("frames")}>
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {step === "frames" ? (
        <section className="card">
          <h1>Abra os quadros do arco</h1>
          <p className="lede">
            A altura sai das fotos do protocolo, com 640 por 480 pixels. O quadro A não tem sufixo, o B termina em -b
            e o C em -c. O clipe de teste não traz essas câmeras.
          </p>
          {recordingUrl ? (
            <>
              <video className="preview preview-wide" ref={scrubRef} src={recordingUrl} controls playsInline />
              <ShotPick
                label="Vista de cima, deste vídeo"
                shot={topShot}
                onTake={() => takeShot()}
                onSeek={() => topShot && seekTo(topShot.time)}
              />
            </>
          ) : null}
          <PickedStill
            label="Vista de cima"
            fileName={topFileName}
            url={topFileName ? topShot?.url ?? null : null}
            onOpen={() => openImage("top")}
          />
          <PickedStill label="Quadro A" fileName={arcNames.a} url={arcA} onOpen={() => openImage("a")} />
          <PickedStill label="Quadro B" fileName={arcNames.b} url={arcB} onOpen={() => openImage("b")} />
          {item === "tangerine" ? (
            <PickedStill label="Quadro C" fileName={arcNames.c} url={arcC} onOpen={() => openImage("c")} />
          ) : (
            <p className="note">O tomate não usa o quadro C.</p>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) storeImage(file);
            }}
          />
          {error ? <p className="flag">{error}</p> : null}
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep("film")}>
              Voltar
            </button>
            <button
              type="button"
              disabled={!topShot || !arcReady}
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
          {cornersReady ? <p className="ok">Quatro cantos marcados.</p> : null}
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
            Cada caixa é uma fruta que o YOLO marcou na camada de cima, uma vez, no quadro de cima. A fruta enterrada
            não entra. A altura do monte sai dos quadros do arco.
          </p>
          {topShot ? (
            <div className="marker">
              <img src={topShot.url} alt="Vista de cima com as caixas" />
              <FruitBoxes marks={layer?.marks ?? []} />
            </div>
          ) : null}
          {layer ? (
            <p className={layer.matchesItem ? "ok" : "flag"}>
              {layer.matchesItem
                ? `${layer.count} ${layer.count === 1 ? "caixa" : "caixas"} dentro da borda. Diâmetro mediano ${formatCm(layer.medianDiameterCm ?? 0)} cm. A leitura levou ${Math.round(layer.elapsedMs)} ms.`
                : item === "tangerine"
                  ? "Nenhuma tangerina dentro da borda. O total abaixo veio da altura do arco, não dessas caixas."
                  : "Nenhum tomate dentro da borda. O quilo por litro continua sendo o exemplo."}
            </p>
          ) : (
            <p className={layerNote ? "flag" : "note"}>{layerNote ?? "Lendo o modelo da camada de cima."}</p>
          )}
          {passageMs !== null ? (
            <p className="note">
              Esta passagem levou {formatClock(passageMs / 1000)} neste computador. O minuto oficial espera o celular de
              referência.
            </p>
          ) : null}
          {lidCm !== null && lidCm > 0 ? (
            <p className="ok">
              Altura lida no arco: {formatCm(lidCm)} cm. A boca desta conta é a da caixa plástica 01, 28,2 cm por 39,2
              cm.
            </p>
          ) : (
            <p className={arcNote ? "flag" : "note"}>{arcNote ?? "Lendo a altura nos quadros do arco."}</p>
          )}
          {item === "tomato" ? (
            <p className="note">Quilos por litro de exemplo: {EXAMPLE_DENSITY}. O lote ainda não foi pesado.</p>
          ) : (
            <p className="note">
              As marcas contam a camada de cima. O total usa a altura do arco, nesta boca de 28,2 cm por 39,2 cm.
            </p>
          )}
          {estimate ? (
            <>
              <div className="result">
                <span>Estimativa da foto</span>
                <strong>{formatEstimate(estimate)}</strong>
              </div>
              <p className="note">
                Este intervalo é o orçado no livro. Nas fotos do simulador, o erro medido foi 2,3% na tangerina e 2,8%
                nos litros do tomate. Uma foto da cozinha não herda esse número.
              </p>
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
            <p className="flag">A altura ainda não saiu dos quadros do arco.</p>
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
      <button type="button" className={shot ? undefined : "secondary"} aria-pressed={shot !== null} onClick={onTake}>
        {shot ? `${label} · escolhida` : label}
      </button>
      {shot ? (
        <>
          <img src={shot.url} alt="" />
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

function PickedStill({
  label,
  fileName,
  url,
  onOpen,
}: {
  label: string;
  fileName: string | null;
  url: string | null;
  onOpen: () => void;
}) {
  const picked = fileName !== null && url !== null;
  return (
    <div className="still-pick">
      <button type="button" className={picked ? undefined : "secondary"} aria-pressed={picked} onClick={onOpen}>
        {picked ? `${label} · escolhido` : label}
      </button>
      {picked ? (
        <>
          <img src={url} alt="" />
          <p className="ok shot-moment">{fileName}</p>
        </>
      ) : (
        <p className="note shot-moment">Ainda não escolhido.</p>
      )}
    </div>
  );
}
