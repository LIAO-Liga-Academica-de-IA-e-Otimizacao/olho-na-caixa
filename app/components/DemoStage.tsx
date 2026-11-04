"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FruitBoxes } from "./FruitBoxes";
import { MouthGuide } from "./MouthGuide";
import {
  demoFrames,
  demoPlan,
  demoTruth,
  guideOf,
  STUDIO_CRATE,
  type DemoFrame,
  type DemoSlotId,
  type DemoTruth,
} from "@/lib/demo-scenes";
import { warpRgba } from "@/lib/quad-warp";
import { estimateFromLid, readArcLid, type RgbImage } from "@/lib/arc-height";
import { detectTopLayer } from "@/lib/yolo-detect";
import { baseAreaCm2, fitsTolerance, interval } from "@/lib/packing";
import type { Estimate } from "@/lib/packing";
import type { ProduceItem, TopLayer } from "@/lib/top-layer";

const EXAMPLE_DENSITY = 0.55;
const PROTOCOL_WIDTH = 640;
const PROTOCOL_HEIGHT = 480;

type Readout = {
  layer: TopLayer | null;
  layerNote: string | null;
  heightCm: number | null;
  heightNote: string | null;
  topUrl: string | null;
};

const EMPTY_READOUT: Readout = {
  layer: null,
  layerNote: null,
  heightCm: null,
  heightNote: null,
  topUrl: null,
};

export function DemoStage() {
  const [item, setItem] = useState<ProduceItem>("tangerine");
  const [slot, setSlot] = useState<DemoSlotId>("top");
  const [photo, setPhoto] = useState<{ key: string; url: string } | null>(null);
  const [seating, setSeating] = useState(false);
  const [missing, setMissing] = useState(false);
  const [reading, setReading] = useState(false);
  const [readout, setReadout] = useState<Readout | null>(null);

  const frames = demoFrames(item);
  const frame = frames.find((entry) => entry.id === slot) ?? frames[0];

  useEffect(() => {
    let cancelled = false;
    const current = demoFrames(item).find((entry) => entry.id === slot) ?? demoFrames(item)[0];
    const key = `${item}:${current.id}`;
    setSeating(true);
    setMissing(false);
    void seatFrame(current)
      .then((url) => {
        if (!cancelled) setPhoto({ key, url });
      })
      .catch(() => {
        if (!cancelled) {
          setPhoto(null);
          setMissing(true);
        }
      })
      .finally(() => {
        if (!cancelled) setSeating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item, slot]);

  function chooseItem(next: ProduceItem) {
    if (next === item) return;
    setItem(next);
    setSlot("top");
    setReadout(null);
  }

  async function readScene() {
    setReading(true);
    setReadout({ ...EMPTY_READOUT, layerNote: "Lendo a camada de cima.", heightNote: "Lendo a altura no arco." });
    const top = frames[0];
    const sides = frames.slice(1);
    try {
      const [layer, heightCm, topUrl] = await Promise.all([
        readLayer(top, item),
        readHeight(item, sides.map((entry) => entry.url)),
        Promise.resolve(top.url),
      ]);
      setReadout({ layer, layerNote: null, heightCm, heightNote: null, topUrl });
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : "A leitura não pôde ser feita.";
      setReadout({ ...EMPTY_READOUT, layerNote: message, heightNote: message });
    } finally {
      setReading(false);
    }
  }

  const photoUrl = photo?.key === `${item}:${frame.id}` ? photo.url : null;
  const estimate =
    readout?.heightCm && readout.heightCm > 0
      ? estimateFromLid(
          item,
          readout.heightCm,
          readout.layer?.medianDiameterCm && readout.layer.medianDiameterCm > 0
            ? readout.layer.medianDiameterCm
            : 5.1,
          EXAMPLE_DENSITY,
          baseAreaCm2(STUDIO_CRATE),
        )
      : null;

  return (
    <div className="demo">
      <h1>Demonstração</h1>
      <p className="lede">
        Fotos renderizadas, cada uma na posição do arco. A boca da caixa foi assentada no trapézio dessa posição.
        A Conferir continua sendo a jornada da cozinha.{" "}
        <Link href="/">Abrir a Conferir.</Link>
      </p>

      <div className="demo-layout">
        <section className="card demo-stage-card">
          <div className="preset-row" role="group" aria-label="Item">
            <button
              type="button"
              className={item === "tangerine" ? "preset is-on" : "preset"}
              aria-pressed={item === "tangerine"}
              onClick={() => chooseItem("tangerine")}
            >
              Tangerina
            </button>
            <button
              type="button"
              className={item === "tomato" ? "preset is-on" : "preset"}
              aria-pressed={item === "tomato"}
              onClick={() => chooseItem("tomato")}
            >
              Tomate
            </button>
          </div>
          <div className="preset-row" role="group" aria-label="Posição do arco">
            {frames.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={entry.id === frame.id ? "preset is-on" : "preset"}
                aria-pressed={entry.id === frame.id}
                onClick={() => setSlot(entry.id)}
              >
                {entry.title}
              </button>
            ))}
          </div>
          {missing ? (
            <p className="flag" role="alert">
              As fotos renderizadas não estão nesta máquina. Elas ficam fora do Git. Rode o aplicativo no computador
              que gerou as cenas.
            </p>
          ) : (
            <div className="demo-frame">
              {photoUrl ? (
                <img src={photoUrl} alt={`${frame.title} com a boca no molde`} />
              ) : (
                <p className="demo-wait">{seating ? "Assentando a foto no trapézio…" : ""}</p>
              )}
              <MouthGuide quad={guideOf(frame)} label={`Molde da boca no ${frame.title}`} />
            </div>
          )}
          <p className="note">{frame.blurb}</p>
        </section>

        <section className="card">
          <h2>Onde a câmera fica</h2>
          <p className="lede">A boca é o retângulo. O arco olha a borda próxima por baixo.</p>
          <Plan item={item} active={frame.id} />
          <p className="note">
            Caixa {STUDIO_CRATE.name}, {formatCm(STUDIO_CRATE.lengthCm)} cm por {formatCm(STUDIO_CRATE.widthCm)} cm,
            parede de {formatCm(STUDIO_CRATE.heightCm)} cm. Lente de 35 mm, a do simulador.
          </p>
          <div className="actions">
            <button type="button" onClick={() => void readScene()} disabled={reading || missing}>
              {reading ? "Lendo…" : "Ler esta caixa"}
            </button>
          </div>
        </section>
      </div>

      {readout ? (
        <section className="card demo-read">
          <h2>{item === "tangerine" ? "Tangerina" : "Tomate"}</h2>
          <p className="lede">
            A leitura usa as fotos originais do simulador, não o enquadramento da tela. As caixas são o YOLO na vista
            de cima. A altura sai do arco.
          </p>
          {readout.topUrl ? (
            <div className="marker">
              <img src={readout.topUrl} alt="Vista de cima com as caixas do modelo" />
              <FruitBoxes marks={readout.layer?.marks ?? []} />
            </div>
          ) : null}
          {readout.layer ? (
            <p className={readout.layer.matchesItem ? "ok" : "flag"}>
              {readout.layer.count} {readout.layer.count === 1 ? "caixa" : "caixas"} na camada de cima. Diâmetro
              mediano {formatCm(readout.layer.medianDiameterCm ?? 0)} cm.
            </p>
          ) : (
            <p className={readout.layerNote && !reading ? "flag" : "note"}>{readout.layerNote}</p>
          )}
          {readout.heightCm !== null && readout.heightCm > 0 ? (
            <p className="ok">
              Altura do monte: {formatCm(readout.heightCm)} cm (lida nos quadros do arco). Não é a parede da caixa.
            </p>
          ) : (
            <p className={readout.heightNote && !reading ? "flag" : "note"}>{readout.heightNote}</p>
          )}
          {item === "tomato" ? (
            <p className="note">Quilos por litro: {EXAMPLE_DENSITY.toLocaleString("pt-BR")}, o valor de exemplo.</p>
          ) : null}
          {estimate ? <EstimateBlock estimate={estimate} /> : null}
          {estimate && readout.heightCm !== null && readout.heightCm > 0 ? (
            <TruthBlock
              item={item}
              truth={demoTruth(item)}
              estimate={estimate}
              heightCm={readout.heightCm}
              visible={readout.layer?.count ?? null}
              density={EXAMPLE_DENSITY}
            />
          ) : null}
          <p className="note">Cena renderizada. Este número não é a margem de uma caixa de cozinha.</p>
        </section>
      ) : null}
    </div>
  );
}

function Plan({ item, active }: { item: ProduceItem; active: DemoSlotId }) {
  const plan = demoPlan(item);
  const center = {
    x: plan.crate.reduce((sum, point) => sum + point.x, 0) / plan.crate.length,
    y: plan.crate.reduce((sum, point) => sum + point.y, 0) / plan.crate.length,
  };
  const points = plan.crate.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <svg className="demo-plan" viewBox="0 0 100 100" role="img" aria-label="Posições do arco em volta da boca">
      {plan.marks
        .filter((mark) => mark.id !== "top")
        .map((mark) => (
          <line
            key={`${mark.id}-ray`}
            x1={mark.point.x}
            y1={mark.point.y}
            x2={center.x}
            y2={center.y}
            className={mark.id === active ? "is-on" : undefined}
          />
        ))}
      <polygon points={points} />
      <line x1={plan.near[0].x} y1={plan.near[0].y} x2={plan.near[1].x} y2={plan.near[1].y} className="near" />
      {plan.marks.map((mark) => (
        <g key={mark.id} className={mark.id === active ? "mark is-on" : "mark"}>
          <circle cx={mark.point.x} cy={mark.point.y} r={mark.id === "top" ? 3.2 : 2.6} />
          <text x={mark.point.x} y={mark.point.y + 5.6}>
            {mark.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function EstimateBlock({ estimate }: { estimate: Estimate }) {
  const { low, high } = interval(estimate);
  const digits = estimate.unit === "kg" ? 1 : 0;
  const fits = fitsTolerance(estimate, 0.1) && estimate.flags.length === 0;
  return (
    <>
      <div className="result">
        <span>{estimate.unit === "kg" ? "Quilos" : "Unidades"}</span>
        <strong>
          {estimate.value.toFixed(digits)} {estimate.unit}
        </strong>
      </div>
      <p className="note">
        Entre {low.toFixed(digits)} e {high.toFixed(digits)} {estimate.unit}.
      </p>
      {fits ? <p className="ok">O intervalo cabe na meta.</p> : <p className="flag">O intervalo não cabe em 10%.</p>}
    </>
  );
}

function TruthBlock({
  item,
  truth,
  estimate,
  heightCm,
  visible,
  density,
}: {
  item: ProduceItem;
  truth: DemoTruth;
  estimate: Estimate;
  heightCm: number;
  visible: number | null;
  density: number;
}) {
  const truthValue =
    item === "tangerine" ? truth.inside : (baseAreaCm2(STUDIO_CRATE) * truth.heightCm) / 1000 * density;
  const error = Math.abs(estimate.value / truthValue - 1) * 100;
  const heightError = Math.abs(heightCm / truth.heightCm - 1) * 100;
  return (
    <div className="demo-truth">
      <h2>Verdade do simulador</h2>
      <p className="lede">
        Semente {truth.seed}. Esses números saíram na hora em que a cena foi gerada. A Conferir não os vê.
      </p>
      <ul className="field-list">
        <li>
          {item === "tangerine" ? (
            <>
              Unidades verdadeiras: {truth.inside}. Leitura: {estimate.value.toFixed(0)} un. Erro absoluto{" "}
              {formatPct(error)}.
            </>
          ) : (
            <>
              Quilos verdadeiros nesta densidade: {truthValue.toFixed(1)} kg (altura de área {formatCm(truth.heightCm)}{" "}
              cm × {density.toLocaleString("pt-BR")} kg/L). Leitura: {estimate.value.toFixed(1)} kg. Erro absoluto{" "}
              {formatPct(error)}.
            </>
          )}
        </li>
        <li>
          Altura verdadeira do monte: {formatCm(truth.heightCm)} cm. Altura do monte lida no arco:{" "}
          {formatCm(heightCm)} cm. Erro {formatPct(heightError)}. A parede desta caixa tem{" "}
          {formatCm(STUDIO_CRATE.heightCm)} cm.
        </li>
        <li>
          Camada de cima na verdade: {truth.visible}
          {visible !== null ? `. Caixas do YOLO: ${visible}.` : "."}
        </li>
      </ul>
    </div>
  );
}

const seated = new Map<string, string>();

async function seatFrame(frame: DemoFrame): Promise<string> {
  const cached = seated.get(frame.url);
  if (cached) return cached;
  const image = await loadImage(frame.url);
  const canvas = document.createElement("canvas");
  canvas.width = PROTOCOL_WIDTH;
  canvas.height = PROTOCOL_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("O quadro não pôde ser preparado.");
  context.drawImage(image, 0, 0, PROTOCOL_WIDTH, PROTOCOL_HEIGHT);
  const pixels = context.getImageData(0, 0, PROTOCOL_WIDTH, PROTOCOL_HEIGHT);
  const border = [pixels.data[0], pixels.data[1], pixels.data[2]] as const;
  const warped = warpRgba(
    pixels.data,
    PROTOCOL_WIDTH,
    PROTOCOL_HEIGHT,
    frame.source.map(([x, y]) => ({ x, y })),
    frame.target.map(([x, y]) => ({ x, y })),
    border,
  );
  context.putImageData(new ImageData(warped, PROTOCOL_WIDTH, PROTOCOL_HEIGHT), 0, 0);
  const url = canvas.toDataURL("image/jpeg", 0.92);
  seated.set(frame.url, url);
  return url;
}

async function readLayer(top: DemoFrame, item: ProduceItem): Promise<TopLayer> {
  const image = await loadImage(top.url);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("O quadro de cima não pôde ser lido.");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  return detectTopLayer(
    { data: pixels.data, width: pixels.width, height: pixels.height },
    top.source.map(([x, y]) => ({ x: x / PROTOCOL_WIDTH, y: y / PROTOCOL_HEIGHT })),
    STUDIO_CRATE.lengthCm,
    STUDIO_CRATE.widthCm,
    item,
  );
}

async function readHeight(item: ProduceItem, urls: string[]): Promise<number> {
  const frames = await Promise.all(urls.map(loadRgb));
  return readArcLid(item, frames, 35).heightCm;
}

function loadRgb(url: string): Promise<RgbImage> {
  return loadImage(url).then((image) => {
    const canvas = document.createElement("canvas");
    canvas.width = PROTOCOL_WIDTH;
    canvas.height = PROTOCOL_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("O quadro não pôde ser lido.");
    context.drawImage(image, 0, 0, PROTOCOL_WIDTH, PROTOCOL_HEIGHT);
    const pixels = context.getImageData(0, 0, PROTOCOL_WIDTH, PROTOCOL_HEIGHT);
    const rgb = new Float32Array(PROTOCOL_WIDTH * PROTOCOL_HEIGHT * 3);
    for (let index = 0, pixel = 0; index < pixels.data.length; index += 4, pixel += 3) {
      rgb[pixel] = pixels.data[index] / 255;
      rgb[pixel + 1] = pixels.data[index + 1] / 255;
      rgb[pixel + 2] = pixels.data[index + 2] / 255;
    }
    return { width: PROTOCOL_WIDTH, height: PROTOCOL_HEIGHT, rgb };
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A foto renderizada não pôde ser aberta."));
    image.src = url;
  });
}

function formatCm(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPct(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
