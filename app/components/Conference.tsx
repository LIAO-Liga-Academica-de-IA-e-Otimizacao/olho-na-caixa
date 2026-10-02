"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { flushSync } from "react-dom";
import {
  activeCrate,
  emptyBook,
  readBook,
  setActive,
  writeBook,
  type CrateBook,
} from "@/lib/crate-store";
import { analyzeFrame, isConvexQuad, type FrameQuality, type Point } from "@/lib/frame-quality";
import {
  estimateFromLid,
  mouthQuad,
  readArcLid,
  type Quad,
  type RgbImage,
} from "@/lib/arc-height";
import { detectTopLayer } from "@/lib/yolo-detect";
import { testStillSet } from "@/lib/test-stills";
import type { TopLayer } from "@/lib/top-layer";
import { FruitBoxes } from "./FruitBoxes";
import { MouthGuide } from "./MouthGuide";
import { baseAreaCm2, fitsTolerance, interval, type Crate, type Estimate } from "@/lib/packing";
import { PHONE_PRESETS, readPhone, SIMULATOR_PHONE, writePhone } from "@/lib/phone";

const EXAMPLE_DENSITY = 0.55;
const DENSITY_STORAGE_KEY = "olho-na-caixa.density";

function readDensity(): string {
  if (typeof window === "undefined") return String(EXAMPLE_DENSITY);
  const raw = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  return raw && Number(raw) > 0 ? raw : String(EXAMPLE_DENSITY);
}

type ItemKind = "tangerine" | "tomato";
type Step = "item" | "crate" | "frames" | "corners" | "result";

type Shot = { url: string; quality: FrameQuality; time: number };

const STEPS: { id: Step; label: string }[] = [
  { id: "item", label: "Item" },
  { id: "crate", label: "Caixa" },
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

/** Normalized full frame, the assumed mouth when the photo filled the view. */
const FULL_CORNERS: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** Full 640×480 frame, the capture mold for the top view: fill it with the mouth. */
const FULL_QUAD: Quad = [
  [0, 0],
  [640, 0],
  [640, 480],
  [0, 480],
];

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
      // Center-crop to 4:3, then scale to the 640×480 protocol. A symmetric
      // crop keeps the lens center in the middle, so the rig rays stay valid.
      const cropWidth = Math.min(image.naturalWidth, (image.naturalHeight * 4) / 3);
      const cropHeight = Math.min(image.naturalHeight, (image.naturalWidth * 3) / 4);
      const cropX = (image.naturalWidth - cropWidth) / 2;
      const cropY = (image.naturalHeight - cropHeight) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("O quadro não pôde ser lido."));
        return;
      }
      context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, 640, 480);
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLVideoElement>(null);
  const photoStreamRef = useRef<MediaStream | null>(null);
  const imageSlotRef = useRef<"top" | "a" | "b" | "c">("top");
  const startedAtRef = useRef(Date.now());

  const [step, setStep] = useState<Step>("item");
  const [item, setItem] = useState<ItemKind>("tangerine");
  const [book, setBook] = useState<CrateBook>(emptyBook);
  const [selected, setSelected] = useState<string | null>(null);
  const [phoneName, setPhoneName] = useState(SIMULATOR_PHONE.name);
  const [focalCm, setFocalCm] = useState(String(SIMULATOR_PHONE.focal35Mm));
  const [density, setDensity] = useState(String(EXAMPLE_DENSITY));
  const [photoSlot, setPhotoSlot] = useState<"top" | "a" | "b" | "c" | null>(null);
  const [autoStills, setAutoStills] = useState(false);
  const [cornerSource, setCornerSource] = useState<"full" | "true" | "manual">("full");
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

  const crate: Crate | null = activeCrate({ crates: book.crates, active: selected });
  const crateReady = crate !== null;

  useEffect(() => {
    const saved = readBook();
    setBook(saved);
    setSelected(saved.active);
    const phone = readPhone();
    if (phone) {
      setPhoneName(phone.name);
      setFocalCm(String(phone.focal35Mm));
    }
    setDensity(readDensity());
  }, []);

  useEffect(() => {
    return () => {
      photoStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (step !== "frames") closeCamera();
  }, [step]);

  useEffect(() => {
    if (step !== "result" || !topShot || corners.length !== 4 || !crate) return;
    const mouth = crate;
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
        mouth.lengthCm,
        mouth.widthCm,
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
  }, [step, topShot, corners, item, crate]);

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
    const focalNow = Number(focalCm) > 0 ? Number(focalCm) : SIMULATOR_PHONE.focal35Mm;
    Promise.all(urls.map((url) => imageToRgb(url)))
      .then((frames) => {
        if (cancelled) return;
        setLidCm(readArcLid(item, frames, focalNow).heightCm);
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

  const focal = Number(focalCm) > 0 ? Number(focalCm) : SIMULATOR_PHONE.focal35Mm;
  const photoGuide =
    photoSlot === "top"
      ? FULL_QUAD
      : photoSlot === "a"
        ? mouthQuad(item, 0, focal)
        : photoSlot === "b"
          ? mouthQuad(item, 1, focal)
          : photoSlot === "c"
            ? mouthQuad(item, 2, focal)
            : null;
  const photoHint =
    photoSlot === "top" ? "Encha o quadro com a boca." : "Encaixe a boca no molde.";
  const densityKgPerLiter = Number(density) > 0 ? Number(density) : EXAMPLE_DENSITY;

  function stopPhotoTracks() {
    photoStreamRef.current?.getTracks().forEach((track) => track.stop());
    photoStreamRef.current = null;
  }

  function closeCamera() {
    stopPhotoTracks();
    setPhotoSlot(null);
  }

  async function openCamera(slot: "top" | "a" | "b" | "c") {
    setError(null);
    closeCamera();
    flushSync(() => setPhotoSlot(slot));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      photoStreamRef.current = stream;
      const video = photoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("missing preview");
      }
      video.srcObject = stream;
      await video.play();
    } catch {
      closeCamera();
      setError("A câmera não abriu.");
    }
  }

  function shootPhoto() {
    const video = photoRef.current;
    const slot = photoSlot;
    if (!video || !slot || video.videoWidth === 0) {
      setError("Espere a imagem aparecer e fotografe de novo.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("A foto não pôde ser lida.");
      return;
    }
    context.drawImage(video, 0, 0);
    const url = canvas.toDataURL("image/jpeg", 0.85);
    const quality = analyzeFrame(context.getImageData(0, 0, canvas.width, canvas.height));
    setAutoStills(false);
    if (slot === "top") {
      setTopShot({ url, time: 0, quality });
      setTopFileName("foto da câmera");
      setCorners([]);
    } else if (slot === "a") {
      setArcA(url);
      setArcNames((current) => ({ ...current, a: "foto da câmera" }));
    } else if (slot === "b") {
      setArcB(url);
      setArcNames((current) => ({ ...current, b: "foto da câmera" }));
    } else {
      setArcC(url);
      setArcNames((current) => ({ ...current, c: "foto da câmera" }));
    }
    setError(null);
    closeCamera();
  }

  /** Temporary shortcut: opening the frames empty fills them with the book scenes. */
  function loadTestStills() {
    const stills = testStillSet(item);
    setTopShot({
      url: stills.top,
      time: 0,
      quality: { brightness: 0, clippedFraction: 0, warnings: [] },
    });
    setTopFileName(`${stills.label} (teste)`);
    setArcA(stills.a);
    setArcB(stills.b);
    setArcC(stills.c);
    setArcNames({
      a: `${stills.label} (teste)`,
      b: `${stills.label}-b (teste)`,
      c: stills.c ? `${stills.label}-c (teste)` : null,
    });
    setCorners(stills.corners.map(([x, y]) => ({ x, y })));
    setCornerSource("true");
    setAutoStills(true);
  }

  function openImage(slot: "top" | "a" | "b" | "c") {
    imageSlotRef.current = slot;
    imageInputRef.current?.click();
  }

  function storeImage(file: File) {
    const url = URL.createObjectURL(file);
    const slot = imageSlotRef.current;
    setAutoStills(false);
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
    setCornerSource("manual");
    setCorners((current) => [...current, point]);
  }

  const diameterCm = layer?.medianDiameterCm && layer.medianDiameterCm > 0 ? layer.medianDiameterCm : 5.1;
  let estimate: Estimate | null = null;
  if (step === "result" && lidCm !== null && lidCm > 0 && crate) {
    estimate = estimateFromLid(item, lidCm, diameterCm, densityKgPerLiter, baseAreaCm2(crate));
  }
  const arcReady = Boolean(arcA && arcB && (item === "tomato" || arcC));
  const needsScale = estimate ? !fitsTolerance(estimate, 0.1) || estimate.flags.length > 0 : false;
  const typedScale = Number(scaleKg);
  const cornersReady = corners.length === 4 && isConvexQuad(corners);
  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  return (
    <>
      <p className="steps">
        {STEPS.map((entry, index) => (
          <span
            key={entry.id}
            className={
              entry.id === step ? "step is-current" : index < stepIndex ? "step is-done" : "step"
            }
          >
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
          <h1>Caixa e celular</h1>
          <p className="lede">
            Escolha um modelo do cadastro. A lente sai da ficha técnica do celular, em milímetros equivalentes. Os
            dois ficam salvos neste aparelho.
          </p>
          {book.crates.length > 0 ? (
            <div role="group" aria-label="Modelo da caixa">
              {book.crates.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  className={selected === entry.name ? "choice" : "choice secondary"}
                  aria-pressed={selected === entry.name}
                  onClick={() => setSelected(entry.name)}
                >
                  {entry.name} · {formatCm(entry.lengthCm)} × {formatCm(entry.widthCm)} ×{" "}
                  {formatCm(entry.heightCm)} cm
                </button>
              ))}
            </div>
          ) : (
            <p className="flag">Nenhuma caixa guardada. Meça a primeira em Medidas.</p>
          )}
          <div className="actions">
            <Link className="link-button" href="/medidas/">
              Medir caixas
            </Link>
          </div>
          <div className="preset-row" role="group" aria-label="Modelo do celular">
            {PHONE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className={phoneName === preset.name ? "preset is-on" : "preset"}
                aria-pressed={phoneName === preset.name}
                onClick={() => {
                  setPhoneName(preset.name);
                  setFocalCm(String(preset.focal35Mm));
                }}
              >
                {preset.name} · {preset.focal35Mm} mm
              </button>
            ))}
          </div>
          <label>
            Distância focal equivalente (mm)
            <input
              inputMode="decimal"
              value={focalCm}
              onChange={(event) => {
                setFocalCm(event.target.value);
                setPhoneName("Outro");
              }}
            />
          </label>
          {item === "tomato" ? (
            <label>
              Quilos por litro do lote
              <input
                inputMode="decimal"
                value={density}
                onChange={(event) => {
                  setDensity(event.target.value);
                  if (Number(event.target.value) > 0) {
                    window.localStorage.setItem(DENSITY_STORAGE_KEY, event.target.value);
                  }
                }}
              />
            </label>
          ) : null}
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep("item")}>
              Voltar
            </button>
            <button
              type="button"
              disabled={!crate || !(Number(focalCm) > 0)}
              onClick={() => {
                if (!crate || !selected) return;
                const updated = setActive(book, selected);
                writeBook(updated);
                setBook(updated);
                writePhone({ name: phoneName, focal35Mm: focal });
                if (autoStills || (!topShot && !arcA && !arcB && !arcC)) loadTestStills();
                setStep("frames");
              }}
            >
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {step === "frames" ? (
        <section className="card">
          <h1>Fotografe os quadros</h1>
          <p className="lede">
            Fotografe cada posição com a boca dentro do molde tracejado. O aplicativo recorta o meio 4:3 da foto antes
            de ler, então encha o molde sem cortar a borda. O quadro A não tem sufixo, o B termina em -b e o C em -c.
          </p>
          {autoStills ? (
            <p className="note">Quadros de teste carregados sozinhos. Troque qualquer um abaixo.</p>
          ) : null}
          {photoSlot ? (
            <div className="camera-capture">
              <div className="camera-frame">
                <video ref={photoRef} className="camera-video" muted playsInline />
                <MouthGuide quad={photoGuide} label="Molde da boca na foto" />
              </div>
              <p className="note">{photoHint}</p>
              <div className="actions">
                <button type="button" onClick={() => shootPhoto()}>
                  Fotografar
                </button>
                <button type="button" className="secondary" onClick={() => closeCamera()}>
                  Fechar
                </button>
              </div>
            </div>
          ) : null}
          <PickedStill
            label="Vista de cima"
            fileName={topFileName}
            url={topFileName ? topShot?.url ?? null : null}
            onOpen={() => openImage("top")}
            onPhoto={() => void openCamera("top")}
          />
          <PickedStill
            label="Quadro A"
            fileName={arcNames.a}
            url={arcA}
            guide={mouthQuad(item, 0, focal)}
            onOpen={() => openImage("a")}
            onPhoto={() => void openCamera("a")}
          />
          <PickedStill
            label="Quadro B"
            fileName={arcNames.b}
            url={arcB}
            guide={mouthQuad(item, 1, focal)}
            onOpen={() => openImage("b")}
            onPhoto={() => void openCamera("b")}
          />
          {item === "tangerine" ? (
            <PickedStill
              label="Quadro C"
              fileName={arcNames.c}
              url={arcC}
              guide={mouthQuad(item, 2, focal)}
              onOpen={() => openImage("c")}
              onPhoto={() => void openCamera("c")}
            />
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
            <button type="button" className="secondary" onClick={() => setStep("crate")}>
              Voltar
            </button>
            <button
              type="button"
              disabled={!topShot || !arcReady}
              onClick={() => {
                if (corners.length !== 4 || !autoStills) {
                  setCorners(FULL_CORNERS);
                  setCornerSource("full");
                }
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
          <h1>Confira a borda</h1>
          {corners.length < 4 ? (
            <p className="lede">
              Toque os quatro cantos internos, nesta ordem: {CORNER_ORDER.join(", ")}.
              {corners.length > 0 ? ` Falta o ${CORNER_ORDER[corners.length]}.` : ""}
            </p>
          ) : cornerSource === "true" ? (
            <p className="lede">
              A borda veio dos cantos da boca na foto de teste. Confira e confirme. Se não fechar, ajuste.
            </p>
          ) : cornerSource === "manual" ? (
            <p className="lede">Quatro cantos marcados. Confira e confirme.</p>
          ) : (
            <p className="lede">
              A borda assumida é o quadro cheio. Se a boca encheu o quadro, confirme. Se não, ajuste.
            </p>
          )}
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
          {corners.length === 4 ? (
            <div className="actions">
              <button type="button" className="secondary" onClick={() => setCorners([])}>
                Ajustar
              </button>
              <button type="button" disabled={!cornersReady} onClick={() => setStep("result")}>
                Confirmar
              </button>
            </div>
          ) : (
            <div className="actions">
              {corners.length === 0 ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setCorners(FULL_CORNERS);
                    setCornerSource("full");
                  }}
                >
                  Usar o quadro cheio
                </button>
              ) : (
                <button type="button" className="secondary" onClick={() => setCorners([])}>
                  Refazer
                </button>
              )}
              <button type="button" disabled={!cornersReady} onClick={() => setStep("result")}>
                Continuar
              </button>
            </div>
          )}
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
          {lidCm !== null && lidCm > 0 && crate ? (
            <p className="ok">
              Altura lida no arco: {formatCm(lidCm)} cm. A boca desta conta é a {crate.name},{" "}
              {formatCm(crate.lengthCm)} cm por {formatCm(crate.widthCm)} cm.
            </p>
          ) : (
            <p className={arcNote ? "flag" : "note"}>{arcNote ?? "Lendo a altura nos quadros do arco."}</p>
          )}
          {item === "tomato" ? (
            <p className="note">
              Quilos por litro do lote: {densityKgPerLiter.toLocaleString("pt-BR")}. Troque na tela da caixa se o lote
              já foi pesado.
            </p>
          ) : (
            <p className="note">As marcas contam a camada de cima. O total usa a altura do arco nesta boca.</p>
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

function PickedStill({
  label,
  fileName,
  url,
  guide = null,
  onOpen,
  onPhoto,
}: {
  label: string;
  fileName: string | null;
  url: string | null;
  guide?: Quad | null;
  onOpen: () => void;
  onPhoto: () => void;
}) {
  const picked = fileName !== null && url !== null;
  return (
    <div className="still-pick">
      <div className="actions">
        <button type="button" className={picked ? undefined : "secondary"} aria-pressed={picked} onClick={onOpen}>
          {picked ? `${label} · escolhido` : label}
        </button>
        <button type="button" className="secondary" onClick={onPhoto}>
          Fotografar
        </button>
      </div>
      {picked ? (
        <>
          <div className="still-frame">
            <img src={url} alt="" />
            <MouthGuide quad={guide} label={`Molde da boca no ${label}`} />
          </div>
          <p className="ok shot-moment">{fileName}</p>
        </>
      ) : (
        <>
          <div className="still-frame is-empty">
            <MouthGuide quad={guide} label={`Molde da boca no ${label}`} />
          </div>
          <p className="note shot-moment">Enquadre a boca no molde e escolha a foto.</p>
        </>
      )}
    </div>
  );
}
