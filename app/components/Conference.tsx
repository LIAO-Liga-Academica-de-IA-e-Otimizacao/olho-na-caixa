"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import {
  activeCrate,
  emptyBook,
  readBook,
  setActive,
  writeBook,
  type CrateBook,
} from "@/lib/crate-store";
import { analyzeFrame, blockedSlots, isConvexQuad, type FrameQuality, type Point, type SlotShot } from "@/lib/frame-quality";
import {
  estimateFromLid,
  mouthQuad,
  readArcLid,
  type Quad,
  type RgbImage,
} from "@/lib/arc-height";
import { detectTopLayer } from "@/lib/yolo-detect";
import { composeEvidence } from "@/lib/evidence";
import { appendRecord, readLog, writeLog, type EvidenceRecord, type EvidenceReplay } from "@/lib/evidence-store";
import { probeStillSet, testStillSet, type ProbeKind } from "@/lib/test-stills";
import type { TopLayer } from "@/lib/top-layer";
import { FruitBoxes } from "./FruitBoxes";
import { MouthGuide } from "./MouthGuide";
import { CameraOverlay } from "./CameraOverlay";
import { baseAreaCm2, fitsTolerance, interval, type Crate, type Estimate } from "@/lib/packing";
import { PHONE_PRESETS, readPhone, SIMULATOR_PHONE, writePhone } from "@/lib/phone";
import { positiveNumber } from "@/lib/positive-number";
import { DEV_TOOLS_ENABLED } from "@/lib/dev-tools";

const EXAMPLE_DENSITY = 0.55;
const DENSITY_STORAGE_KEY = "olho-na-caixa.density";

function readDensity(): string {
  if (typeof window === "undefined") return String(EXAMPLE_DENSITY);
  const raw = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  return raw && positiveNumber(raw) !== null ? raw : String(EXAMPLE_DENSITY);
}

type ItemKind = "tangerine" | "tomato";
type Step = "item" | "crate" | "frames" | "corners" | "result";

type Shot = { url: string; quality: FrameQuality; time: number };

const STEPS: { id: Step; label: string }[] = [
  { id: "item", label: "Item" },
  { id: "crate", label: "Caixa" },
  { id: "frames", label: "Fotos" },
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
  const imageSlotRef = useRef<"top" | "a" | "b" | "c">("top");
  const startedAtRef = useRef(Date.now());

  const [step, setStep] = useState<Step>("item");
  const [item, setItem] = useState<ItemKind>("tangerine");
  const [replayCrate, setReplayCrate] = useState<Crate | null>(null);
  const [replayNote, setReplayNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [book, setBook] = useState<CrateBook>(emptyBook);
  const [selected, setSelected] = useState<string | null>(null);
  const [phoneName, setPhoneName] = useState(DEV_TOOLS_ENABLED ? SIMULATOR_PHONE.name : "Outro");
  const [focalCm, setFocalCm] = useState(DEV_TOOLS_ENABLED ? String(SIMULATOR_PHONE.focal35Mm) : "");
  const [density, setDensity] = useState(String(EXAMPLE_DENSITY));
  const [photoSlot, setPhotoSlot] = useState<"top" | "a" | "b" | "c" | null>(null);
  const [autoStills, setAutoStills] = useState(false);
  const [cornerSource, setCornerSource] = useState<"full" | "true" | "manual">("full");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [topShot, setTopShot] = useState<Shot | null>(null);
  const [topFileName, setTopFileName] = useState<string | null>(null);
  const [corners, setCorners] = useState<Point[]>([]);
  const [arcA, setArcA] = useState<string | null>(null);
  const [arcB, setArcB] = useState<string | null>(null);
  const [arcC, setArcC] = useState<string | null>(null);
  const [arcQuality, setArcQuality] = useState<{ a: FrameQuality | null; b: FrameQuality | null; c: FrameQuality | null }>({
    a: null,
    b: null,
    c: null,
  });
  const [arcNames, setArcNames] = useState<{ a: string | null; b: string | null; c: string | null }>({
    a: null,
    b: null,
    c: null,
  });
  const [testMode] = useState(
    () => DEV_TOOLS_ENABLED && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("test") === "1",
  );
  const [lidCm, setLidCm] = useState<number | null>(null);
  const [arcNote, setArcNote] = useState<string | null>(null);
  const [scaleKg, setScaleKg] = useState("");
  const [layer, setLayer] = useState<TopLayer | null>(null);
  const [layerNote, setLayerNote] = useState<string | null>(null);
  const [passageMs, setPassageMs] = useState<number | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const availableCrates = replayCrate
    ? [replayCrate, ...book.crates.filter((entry) => entry.name !== replayCrate.name)]
    : book.crates;
  const crate: Crate | null = replayCrate?.name === selected ? replayCrate : activeCrate({ crates: book.crates, active: selected });
  const crateReady = crate !== null;

  useEffect(() => {
    const saved = readBook();
    setBook(saved);
    setSelected(saved.active);
    const phone = readPhone();
    if (phone && (DEV_TOOLS_ENABLED || phone.name !== SIMULATOR_PHONE.name)) {
      setPhoneName(phone.name);
      setFocalCm(String(phone.focal35Mm));
    }
    setDensity(readDensity());
  }, []);

  useEffect(() => {
    if (!DEV_TOOLS_ENABLED) return;
    const id = new URLSearchParams(window.location.search).get("replay");
    if (!id) return;
    let cancelled = false;
    const record = readLog().records.find((entry) => entry.id === id);
    const replay = record?.replay;
    if (!record || !replay) {
      setReplayNote("Esta conferência não tem as fotos originais para reutilizar. Guarde uma nova com as ferramentas de desenvolvimento ativas.");
      return;
    }
    setReplayNote("Carregando fotos da conferência guardada…");
    void Promise.all([replay.photos.top, replay.photos.a, replay.photos.b, replay.photos.c]
      .map((url) => url ? analyzeUrl(url) : Promise.resolve(null)))
      .then(([top, a, b, c]) => {
        if (cancelled) return;
        if (!top || !a || !b || (record.item === "tangerine" && !c)) {
          setReplayNote("As fotos guardadas não puderam ser lidas. Importe novas fotos para conferir.");
          return;
        }
        setItem(record.item);
        setReplayCrate(replay.crate);
        setSelected(replay.crate.name);
        setPhoneName("Conferência guardada");
        setFocalCm(String(replay.focal35Mm));
        setDensity(String(replay.densityKgPerLiter));
        setTopShot({ url: replay.photos.top, quality: top, time: 0 });
        setTopFileName("Vista de cima · conferência guardada");
        setArcA(replay.photos.a);
        setArcB(replay.photos.b);
        setArcC(replay.photos.c ?? null);
        setArcQuality({ a, b, c });
        setArcNames({ a: "Quadro A · conferência guardada", b: "Quadro B · conferência guardada", c: replay.photos.c ? "Quadro C · conferência guardada" : null });
        setCorners(replay.corners);
        setCornerSource("manual");
        setAutoStills(false);
        setReplayNote("Desenvolvimento: fotos, borda e medidas recuperadas. Confira ou troque as fotos antes de avançar. O cadastro de caixas não foi alterado.");
        setStep("frames");
      })
      .catch(() => {
        if (!cancelled) setReplayNote("Não foi possível recuperar esta conferência.");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setPhotoSlot(null);
    const heading = document.querySelector<HTMLElement>("main h1");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
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
    const focalNow = positiveNumber(focalCm);
    if (focalNow === null) {
      setLidCm(null);
      setArcNote("Informe uma distância focal maior que zero na tela da caixa.");
      return;
    }
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
  }, [step, item, arcA, arcB, arcC, focalCm]);

  const focal = positiveNumber(focalCm) ?? 0;
  const savedMouth = crate
    ? { lengthCm: crate.lengthCm, widthCm: crate.widthCm, heightCm: crate.heightCm }
    : undefined;
  const photoGuide =
    photoSlot === "top"
      ? FULL_QUAD
      : photoSlot === "a"
        ? mouthQuad(item, 0, focal, savedMouth)
        : photoSlot === "b"
          ? mouthQuad(item, 1, focal, savedMouth)
          : photoSlot === "c"
            ? mouthQuad(item, 2, focal, savedMouth)
            : null;
  const photoHint =
    photoSlot === "top" ? "Encha o quadro com a boca." : "Encaixe a boca no molde.";
  const densityKgPerLiter = positiveNumber(density) ?? 0;

  function closeCamera() {
    setPhotoSlot(null);
  }

  function openCamera(slot: "top" | "a" | "b" | "c") {
    setError(null);
    setPhotoSlot(slot);
  }

  function receivePhoto(url: string, quality: FrameQuality) {
    const slot = photoSlot;
    if (!slot) return;
    setAutoStills(false);
    if (slot === "top") {
      setTopShot({ url, time: 0, quality });
      setTopFileName("foto da câmera");
      setCornerSource("full");
      setCorners([]);
    } else if (slot === "a") {
      setArcA(url);
      setArcQuality((current) => ({ ...current, a: quality }));
      setArcNames((current) => ({ ...current, a: "foto da câmera" }));
    } else if (slot === "b") {
      setArcB(url);
      setArcQuality((current) => ({ ...current, b: quality }));
      setArcNames((current) => ({ ...current, b: "foto da câmera" }));
    } else {
      setArcC(url);
      setArcQuality((current) => ({ ...current, c: quality }));
      setArcNames((current) => ({ ...current, c: "foto da câmera" }));
    }
    setError(null);
    closeCamera();
  }

  /** Temporary shortcut: solid probes that trip (or pass) the light gate. */
  async function loadProbe(kind: ProbeKind) {
    const stills = probeStillSet(kind);
    setAutoStills(false);
    setError(null);
    const [topQ, aQ, bQ, cQ] = await Promise.all([
      analyzeUrl(stills.top),
      analyzeUrl(stills.a),
      analyzeUrl(stills.b),
      stills.c ? analyzeUrl(stills.c) : Promise.resolve(null),
    ]);
    if (!topQ || !aQ || !bQ || (item === "tangerine" && stills.c && !cQ)) {
      setError("A foto de prova não pôde ser lida.");
      return;
    }
    setTopShot({ url: stills.top, time: 0, quality: topQ });
    setTopFileName(`${stills.label} (teste)`);
    setArcA(stills.a);
    setArcB(stills.b);
    setArcC(item === "tangerine" ? stills.c : null);
    setArcQuality({ a: aQ, b: bQ, c: item === "tangerine" ? cQ : null });
    setArcNames({
      a: `${stills.label} (teste)`,
      b: `${stills.label}-b (teste)`,
      c: item === "tangerine" && stills.c ? `${stills.label}-c (teste)` : null,
    });
    setCorners([]);
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
    setArcQuality({ a: null, b: null, c: null });
    setArcNames({
      a: `${stills.label} (teste)`,
      b: `${stills.label}-b (teste)`,
      c: stills.c ? `${stills.label}-c (teste)` : null,
    });
    setCorners(stills.corners.map(([x, y]) => ({ x, y })));
    setCornerSource("true");
    setAutoStills(true);
  }

  function chooseItem(next: ItemKind) {
    if (next === item) return;
    setItem(next);
    setTopShot(null);
    setTopFileName(null);
    setArcA(null);
    setArcB(null);
    setArcC(null);
    setArcQuality({ a: null, b: null, c: null });
    setArcNames({ a: null, b: null, c: null });
    setCorners([]);
    setAutoStills(false);
    setError(null);
    setLayer(null);
    setLayerNote(null);
    setLidCm(null);
    setArcNote(null);
    setScaleKg("");
    setSavedNote(null);
    setPassageMs(null);
    startedAtRef.current = Date.now();
  }

  function openImage(slot: "top" | "a" | "b" | "c") {
    setError(null);
    imageSlotRef.current = slot;
    imageInputRef.current?.click();
  }

  function analyzeUrl(url: string): Promise<FrameQuality | null> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          if (!context || canvas.width === 0 || canvas.height === 0) {
            resolve(null);
            return;
          }
          context.drawImage(image, 0, 0);
          resolve(analyzeFrame(context.getImageData(0, 0, canvas.width, canvas.height)));
        } catch {
          resolve(null);
        }
      };
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  async function analyzeUpload(file: File): Promise<{ url: string; quality: FrameQuality } | null> {
    const source = URL.createObjectURL(file);
    try {
      return await new Promise((resolve) => {
        const image = new Image();
        image.onerror = () => resolve(null);
        image.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const context = canvas.getContext("2d");
            if (!context || !image.naturalWidth || !image.naturalHeight) return resolve(null);
            const width = Math.min(image.naturalWidth, image.naturalHeight * 4 / 3);
            const height = Math.min(image.naturalHeight, image.naturalWidth * 3 / 4);
            context.drawImage(image, (image.naturalWidth - width) / 2, (image.naturalHeight - height) / 2,
              width, height, 0, 0, 640, 480);
            resolve({
              url: canvas.toDataURL("image/jpeg", 0.92),
              quality: analyzeFrame(context.getImageData(0, 0, 640, 480)),
            });
          } catch {
            resolve(null);
          }
        };
        image.src = source;
      });
    } finally {
      URL.revokeObjectURL(source);
    }
  }

  async function originalPhoto(url: string): Promise<string> {
    if (url.startsWith("data:image/")) return url;
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onerror = () => reject(new Error("Foto indisponível"));
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          if (!context || !canvas.width || !canvas.height) throw new Error("Foto indisponível");
          context.drawImage(image, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch (reason) { reject(reason); }
      };
      image.src = url;
    });
  }

  async function saveEvidence() {
    if (saving) return;
    if (!topShot || !crate) {
      setSavedNote("Falta a foto de cima ou a caixa para guardar.");
      return;
    }
    setSaving(true);
    setSavedNote(null);
    try {
      const photo = await composeEvidence(topShot.url, layer?.marks ?? []);
      if (!photo) throw new Error("A foto não pôde ser guardada.");
      let replay: EvidenceReplay | undefined;
      if (DEV_TOOLS_ENABLED && arcA && arcB && (item === "tomato" || arcC)) {
        const [top, a, b, c] = await Promise.all([
          originalPhoto(topShot.url), originalPhoto(arcA), originalPhoto(arcB),
          arcC && item === "tangerine" ? originalPhoto(arcC) : Promise.resolve(undefined),
        ]);
        replay = { photos: { top, a, b, ...(c ? { c } : {}) }, crate: { ...crate },
          focal35Mm: focal, densityKgPerLiter, corners: corners.map((point) => ({ ...point })) };
      }
      const headline = estimate ? formatEstimate(estimate) : layer
        ? `${layer.count} ${layer.count === 1 ? "caixa" : "caixas"} na camada de cima` : "Sem leitura";
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID() : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
      const record: EvidenceRecord = { id, savedAtISO: new Date().toISOString(), item,
        crateName: crate.name, headline, imageDataUrl: photo, ...(replay ? { replay } : {}) };
      writeLog(appendRecord(readLog(), record));
      setSavedNote(`Guardada às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`);
    } catch (reason) {
      const full = reason instanceof DOMException && reason.name === "QuotaExceededError";
      setSavedNote(full ? "Não foi possível guardar: o armazenamento deste aparelho está cheio. As conferências anteriores foram mantidas."
        : "A conferência não pôde ser guardada. Tente novamente. As conferências anteriores foram mantidas.");
    } finally { setSaving(false); }
  }

  async function storeImage(file: File) {
    const slot = imageSlotRef.current;
    const photo = await analyzeUpload(file);
    if (!photo) {
      setError("A foto não pôde ser lida.");
      return;
    }
    const { url, quality } = photo;
    setAutoStills(false);
    if (slot === "top") {
      setTopShot({ url, time: 0, quality });
      setTopFileName(file.name);
      setCornerSource("full");
      setCorners([]);
      return;
    }
    if (slot === "a") {
      setArcA(url);
      setArcQuality((current) => ({ ...current, a: quality }));
      setArcNames((current) => ({ ...current, a: file.name }));
    } else if (slot === "b") {
      setArcB(url);
      setArcQuality((current) => ({ ...current, b: quality }));
      setArcNames((current) => ({ ...current, b: file.name }));
    } else {
      setArcC(url);
      setArcQuality((current) => ({ ...current, c: quality }));
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
  const usedShots: SlotShot[] = [
    ...(topShot ? [{ slot: "top" as const, label: "Vista de cima", quality: topShot.quality }] : []),
    ...(arcA ? [{ slot: "a" as const, label: "Quadro A", quality: arcQuality.a }] : []),
    ...(arcB ? [{ slot: "b" as const, label: "Quadro B", quality: arcQuality.b }] : []),
    ...(item === "tangerine" && arcC
      ? [{ slot: "c" as const, label: "Quadro C", quality: arcQuality.c }]
      : []),
  ];
  const blocked = blockedSlots(usedShots);
  const needsScale = estimate ? !fitsTolerance(estimate, 0.1) || estimate.flags.length > 0 : false;
  const typedScale = positiveNumber(scaleKg) ?? 0;
  const focalValue = positiveNumber(focalCm);
  const densityValue = positiveNumber(density);
  const cornersReady = corners.length === 4 && isConvexQuad(corners);
  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  return (
    <>
      <p className="steps" role="list" aria-label="Etapas da conferência">
        {STEPS.map((entry, index) => (
          <span
            key={entry.id}
            role="listitem"
            aria-current={entry.id === step ? "step" : undefined}
            className={
              entry.id === step ? "step is-current" : index < stepIndex ? "step is-done" : "step"
            }
          >
            {index + 1}. {entry.label}
          </span>
        ))}
      </p>

      {DEV_TOOLS_ENABLED && replayNote ? <p className="note" role="status">{replayNote}</p> : null}

      {step === "item" ? (
        <section className="card">
          <h1 tabIndex={-1}>O que chegou?</h1>
          <button
            type="button"
            className={item === "tangerine" ? "choice" : "choice secondary"}
            aria-pressed={item === "tangerine"}
            onClick={() => chooseItem("tangerine")}
          >
            Tangerina, em unidades
          </button>
          <button
            type="button"
            className={item === "tomato" ? "choice" : "choice secondary"}
            aria-pressed={item === "tomato"}
            onClick={() => chooseItem("tomato")}
          >
            Tomate, em quilos
          </button>
          <div className="actions">
            <button type="button" onClick={() => setStep("crate")}>
              Avançar
            </button>
          </div>
        </section>
      ) : null}

      {step === "crate" ? (
        <section className="card">
          <h1 tabIndex={-1}>Caixa e celular</h1>
          <p className="lede">
            Escolha um modelo do cadastro. A lente sai da ficha técnica do celular, em milímetros equivalentes. Os
            dois ficam salvos neste aparelho.
          </p>
          {availableCrates.length > 0 ? (
            <div role="group" aria-label="Modelo da caixa">
              {availableCrates.map((entry) => (
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
            {PHONE_PRESETS.filter((preset) => DEV_TOOLS_ENABLED || preset.name !== SIMULATOR_PHONE.name).map((preset) => (
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
          {focalValue === null ? <p className="flag">Informe um número maior que zero.</p> : null}
          {item === "tomato" ? (
            <label>
              Quilos por litro do lote
              <input
                inputMode="decimal"
                value={density}
                onChange={(event) => {
                  setDensity(event.target.value);
                  if (positiveNumber(event.target.value) !== null) {
                    window.localStorage.setItem(DENSITY_STORAGE_KEY, event.target.value);
                  }
                }}
              />
            </label>
          ) : null}
          {item === "tomato" && densityValue === null ? (
            <p className="flag">Informe a densidade do lote como um número maior que zero.</p>
          ) : null}
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep("item")}>
              Voltar
            </button>
            <button
              type="button"
              disabled={!crate || focalValue === null || (item === "tomato" && densityValue === null)}
              onClick={() => {
                if (!crate || !selected || focalValue === null || (item === "tomato" && densityValue === null)) return;
                const updated = setActive(book, selected);
                if (replayCrate?.name !== selected) {
                  writeBook(updated);
                  setBook(updated);
                  writePhone({ name: phoneName, focal35Mm: focalValue });
                }
                if (testMode && (autoStills || (!topShot && !arcA && !arcB && !arcC))) loadTestStills();
                setStep("frames");
              }}
            >
              Avançar
            </button>
          </div>
        </section>
      ) : null}

      {step === "frames" ? (
        <section className="card">
          <h1 tabIndex={-1}>Fotografe os quadros</h1>
          <p className="lede">
            Em cada posição, importe uma foto do aparelho ou abra a câmera para fotografar.
            Enquadre a boca da caixa no molde tracejado, sem cortar a borda. As fotos são recortadas no centro para 4:3.
          </p>
          {autoStills ? (
            <p className="note">Quadros de teste carregados sozinhos. Troque qualquer um abaixo.</p>
          ) : null}
          {photoSlot ? (
            <CameraOverlay
              slotLabel={photoSlot === "top" ? "Vista de cima" : `Quadro ${photoSlot.toUpperCase()}`}
              guide={photoGuide}
              hint={photoHint}
              onCapture={receivePhoto}
              onClose={closeCamera}
            />
          ) : null}
          <PickedStill
            label="Vista de cima"
            fileName={topFileName}
            url={topFileName ? topShot?.url ?? null : null}
            disabled={importing}
            onOpen={() => openImage("top")}
            onPhoto={() => void openCamera("top")}
          />
          <PickedStill
            label="Quadro A"
            fileName={arcNames.a}
            url={arcA}
            guide={mouthQuad(item, 0, focal, savedMouth)}
            disabled={importing}
            onOpen={() => openImage("a")}
            onPhoto={() => void openCamera("a")}
          />
          <PickedStill
            label="Quadro B"
            fileName={arcNames.b}
            url={arcB}
            guide={mouthQuad(item, 1, focal, savedMouth)}
            disabled={importing}
            onOpen={() => openImage("b")}
            onPhoto={() => void openCamera("b")}
          />
          {item === "tangerine" ? (
            <PickedStill
              label="Quadro C"
              fileName={arcNames.c}
              url={arcC}
              guide={mouthQuad(item, 2, focal, savedMouth)}
              disabled={importing}
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
              if (file) {
                setImporting(true);
                setError(null);
                void storeImage(file)
                  .catch(() => setError("A foto não pôde ser importada. Tente outra imagem PNG ou JPEG."))
                  .finally(() => setImporting(false));
              }
            }}
          />
          {importing ? <p className="note" role="status">Importando foto…</p> : null}
          {error ? <p className="flag" role="alert">{error}</p> : null}
          {testMode ? (
          <div className="actions">
            <span className="note">Provas da trava (teste):</span>
            <button type="button" className="secondary" onClick={() => void loadProbe("dark")}>
              Prova escura
            </button>
            <button type="button" className="secondary" onClick={() => void loadProbe("blown")}>
              Prova estourada
            </button>
            <button type="button" className="secondary" onClick={() => void loadProbe("ok")}>
              Prova ok
            </button>
          </div>
          ) : null}
          {blocked.map((shot) => (
            <p key={shot.slot} className="flag">
              {shot.label}: {shot.quality?.warnings.join(" ")} Fotografe de novo esse quadro.
            </p>
          ))}
          <p className="note" role="status">
            {usedShots.length} de {item === "tangerine" ? 4 : 3} fotos adicionadas.
            {!topShot || !arcReady ? " Adicione todas as fotos para avançar." : blocked.length > 0 ? " Troque as fotos com aviso de iluminação para avançar." : " Fotos prontas para conferir a borda."}
          </p>
          <div className="actions">
            <button type="button" className="secondary" disabled={importing} onClick={() => setStep("crate")}>
              Voltar
            </button>
            <button
              type="button"
              disabled={importing || !topShot || !arcReady || blocked.length > 0}
              onClick={() => {
                if (corners.length === 0 && cornerSource !== "manual") {
                  setCorners(FULL_CORNERS);
                  setCornerSource("full");
                }
                setStep("corners");
              }}
            >
              Avançar
            </button>
          </div>
        </section>
      ) : null}

      {step === "corners" && topShot ? (
        <section className="card">
          <h1 tabIndex={-1}>Confira a borda</h1>
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
          <div className="actions">
            {corners.length === 4 ? (
              <button type="button" className="secondary" onClick={() => { setCornerSource("manual"); setCorners([]); }}>
                Ajustar
              </button>
            ) : corners.length === 0 ? (
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
              <button type="button" className="secondary" onClick={() => { setCornerSource("manual"); setCorners([]); }}>
                Refazer
              </button>
            )}
          </div>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep("frames")}>
              Voltar
            </button>
            <button type="button" disabled={!cornersReady} onClick={() => setStep("result")}>
              Ver resultado
            </button>
          </div>
        </section>
      ) : null}

      {step === "result" ? (
        <section className="card">
          <h1 tabIndex={-1}>{item === "tangerine" ? "Tangerina" : "Tomate"}</h1>
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
                : layer.count === 0
                  ? item === "tangerine"
                    ? "Nenhuma fruta dentro da borda. O total abaixo veio da altura do arco, não dessas caixas."
                    : "Nenhuma fruta dentro da borda. O quilo por litro continua sendo o exemplo."
                  : `${layer.otherCount} de ${layer.count} caixas parecem ${item === "tangerine" ? "tomate" : "tangerina"}. Confira o item no primeiro passo; a contagem somou todas.`}
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
            <button type="button" className="secondary" disabled={saving} onClick={() => setStep("corners")}>
              Voltar
            </button>
            <button type="button" disabled={saving} onClick={() => void saveEvidence()}>
              {saving ? "Guardando…" : "Guardar conferência"}
            </button>
          </div>
          {savedNote ? <p className="note">{savedNote}</p> : null}
          {savedNote && savedNote.startsWith("Guardada") ? (
            <p className="note">
              <Link className="link-button" href="/guardadas/">
                Ver guardadas
              </Link>
            </p>
          ) : null}
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
  disabled = false,
}: {
  label: string;
  fileName: string | null;
  url: string | null;
  guide?: Quad | null;
  onOpen: () => void;
  onPhoto: () => void;
  disabled?: boolean;
}) {
  const picked = fileName !== null && url !== null;
  return (
    <div className="still-pick">
      <h2>{label}</h2>
      <div className="actions">
        <button type="button" className="secondary" disabled={disabled} aria-label={`${picked ? "Trocar" : "Importar"} foto: ${label}`} onClick={onOpen}>
          {picked ? "Trocar foto" : "Importar foto"}
        </button>
        <button type="button" className="secondary" disabled={disabled} aria-label={`Abrir câmera: ${label}`} onClick={onPhoto}>
          Abrir câmera
        </button>
      </div>
      {picked ? (
        <>
          <div className="still-frame">
            <img src={url} alt={`Foto adicionada: ${label}`} />
            <MouthGuide quad={guide} label={`Molde da boca no ${label}`} />
          </div>
          <p className="ok shot-moment">{fileName}</p>
        </>
      ) : (
        <>
          <div className="still-frame is-empty">
            <MouthGuide quad={guide} label={`Molde da boca no ${label}`} />
          </div>
          <p className="note shot-moment">Importe uma foto PNG ou JPEG, ou use a câmera.</p>
        </>
      )}
    </div>
  );
}
