"use client";

import { useEffect, useRef, useState } from "react";
import { FruitBoxes } from "@/components/FruitBoxes";
import { simStills, type SimStill } from "@/lib/sim-stills";
import { detectTopLayer } from "@/lib/yolo-detect";
import type { Mark, ProduceItem } from "@/lib/top-layer";

const FULL_FRAME = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

type FrameResult = {
  name: string;
  url: string;
  item: ProduceItem;
  count: number;
  elapsedMs: number;
  marks: Mark[];
};

export default function MarksPage() {
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);
  const runRef = useRef(0);
  const countRef = useRef(0);
  const [fallback, setFallback] = useState<ProduceItem>("tomato");
  const [results, setResults] = useState<FrameResult[]>([]);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
    folderRef.current?.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement || target instanceof HTMLInputElement) return;
      const last = countRef.current - 1;
      if (last < 0) return;
      if (event.key === "ArrowRight") setIndex((current) => Math.min(last, current + 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    void loadStills(simStills());
    return () => {
      runRef.current += 1;
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  countRef.current = results.length;
  const frame = results[Math.min(index, Math.max(0, results.length - 1))] ?? null;
  const shownIndex = frame ? results.indexOf(frame) : 0;

  async function loadStills(stills: SimStill[]) {
    const run = ++runRef.current;
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
    setResults([]);
    setIndex(0);
    setError(null);
    const probe = await fetch(stills[0]?.url ?? "", { cache: "no-store" });
    if (run !== runRef.current) return;
    if (!probe.ok) {
      setProgress(null);
      setError(`A foto do simulador respondeu ${probe.status}. Pare o make dev e suba de novo.`);
      return;
    }
    const next: FrameResult[] = [];
    let missing = 0;
    let modelError: string | null = null;
    for (let position = 0; position < stills.length; position += 1) {
      if (run !== runRef.current) return;
      setProgress(`${position + 1} de ${stills.length}`);
      try {
        const frame = await readUrl(stills[position].url, stills[position].name, stills[position].item);
        next.push(frame);
        setResults([...next]);
        if (next.length === 1) setIndex(0);
      } catch (error) {
        missing += 1;
        if (!modelError && error instanceof Error && error.message !== "frame") modelError = error.message;
        if (modelError && next.length === 0) break;
      }
    }
    if (run !== runRef.current) return;
    setProgress(null);
    if (next.length === 0 && modelError) {
      setError(`O modelo da camada de cima não abriu. ${modelError}`);
    } else if (next.length === 0) {
      setError("As fotos do simulador não abriram.");
    } else if (missing > 0) {
      setError(`${missing} fotos do conjunto não abriram.`);
    }
  }

  async function load(chosen: File[]) {
    const files = chosen.filter((file) => isImage(file));
    files.sort((left, right) => fileName(left).localeCompare(fileName(right), "pt-BR"));
    if (files.length === 0) {
      setError("Nenhuma imagem nessa escolha.");
      return;
    }
    const run = ++runRef.current;
    setError(null);
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
    setResults([]);
    setIndex(0);
    const next: FrameResult[] = [];
    for (let position = 0; position < files.length; position += 1) {
      if (run !== runRef.current) return;
      setProgress(`${position + 1} de ${files.length}`);
      const url = URL.createObjectURL(files[position]);
      urlsRef.current.push(url);
      try {
        next.push(await readUrl(url, fileName(files[position]), itemOf(fileName(files[position]), fallback)));
      } catch {
        setError(`Não foi possível ler ${fileName(files[position])}.`);
      }
      setResults([...next]);
    }
    if (run === runRef.current) setProgress(null);
  }

  return (
    <>
      <h1>Marcas</h1>
      <p className="lede">
        Cada caixa é uma fruta que o YOLO marcou na camada de cima. O miolo da caixa é o centro, e o tamanho é o da
        capa visível. A fruta enterrada não aparece. Esta página abre sozinha as 120 fotos de cima do simulador.
      </p>
      <section className="card">
        <p className="note">
          A primeira foto que termina a leitura já aparece. As setas e a lista trocam de foto enquanto o resto carrega.
          A pasta abaixo só serve para uma foto que não está nesse conjunto. O nome do arquivo decide o item.
        </p>
        <div className="actions">
          <button type="button" className={fallback === "tomato" ? undefined : "secondary"} aria-pressed={fallback === "tomato"} onClick={() => setFallback("tomato")}>
            Tomate
          </button>
          <button type="button" className={fallback === "tangerine" ? undefined : "secondary"} aria-pressed={fallback === "tangerine"} onClick={() => setFallback("tangerine")}>
            Tangerina
          </button>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => folderRef.current?.click()}>
            Abrir uma pasta
          </button>
          <button type="button" className="secondary" onClick={() => filesRef.current?.click()}>
            Abrir imagens
          </button>
        </div>
        <input
          ref={folderRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            void load(takeFiles(event.target));
          }}
        />
        <input
          ref={filesRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(event) => {
            void load(takeFiles(event.target));
          }}
        />
        {progress ? <p className="note">Lendo o modelo, {progress}.</p> : null}
        {error ? <p className="flag">{error}</p> : null}
      </section>

      {frame ? (
        <section className="card">
          <div className="marker">
            <img src={frame.url} alt={frame.name} />
            <FruitBoxes marks={frame.marks} />
          </div>
          <p className={frame.count > 0 ? "ok" : "flag"}>
            {frame.count} {frame.count === 1 ? "caixa" : "caixas"}. A leitura levou {Math.round(frame.elapsedMs)} ms.
            Item: {frame.item === "tomato" ? "tomate" : "tangerina"}.
          </p>
          <p className="note">{frame.name}</p>
          <label>
            Foto
            <select
              className="mark-jump"
              value={shownIndex}
              onChange={(event) => setIndex(Number(event.target.value))}
            >
              {results.map((item, itemIndex) => (
                <option key={`${item.name}-${itemIndex}`} value={itemIndex}>
                  {item.count} · {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="button" className="secondary" disabled={shownIndex <= 0} onClick={() => setIndex(shownIndex - 1)}>
              Anterior
            </button>
            <button
              type="button"
              className="secondary"
              disabled={shownIndex >= results.length - 1}
              onClick={() => setIndex(shownIndex + 1)}
            >
              Próxima
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

function takeFiles(input: HTMLInputElement): File[] {
  const files = [...(input.files ?? [])];
  input.value = "";
  return files;
}

function isImage(file: File): boolean {
  const name = fileName(file);
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(name);
}

function fileName(file: File): string {
  const relative = file.webkitRelativePath;
  return relative || file.name;
}

function itemOf(name: string, fallback: ProduceItem): ProduceItem {
  const lower = name.toLowerCase();
  if (lower.includes("tomato") || lower.includes("tomate")) return "tomato";
  if (lower.includes("tangerine") || lower.includes("tangerina")) return "tangerine";
  return fallback;
}

function readUrl(url: string, name: string, item: ProduceItem): Promise<FrameResult> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context || canvas.width === 0) {
        reject(new Error("frame"));
        return;
      }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      detectTopLayer(
        { data: pixels.data, width: pixels.width, height: pixels.height },
        FULL_FRAME,
        pixels.width,
        pixels.height,
        item,
      )
        .then((layer) => {
          resolve({
            name,
            url,
            item,
            count: layer.count,
            elapsedMs: layer.elapsedMs,
            marks: layer.marks,
          });
        })
        .catch(() => reject(new Error("model")));
    };
    image.onerror = () => reject(new Error("frame"));
    image.src = url;
  });
}
