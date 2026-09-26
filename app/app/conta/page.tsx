"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readCrate } from "@/lib/crate-store";
import {
  fitsTolerance,
  interval,
  tangerineCount,
  tomatoMassKg,
  type Crate,
  type Estimate,
} from "@/lib/packing";

function formatEstimate(estimate: Estimate): string {
  const { low, high } = interval(estimate);
  const digits = estimate.unit === "kg" ? 1 : 0;
  return `${estimate.value.toFixed(digits)} ${estimate.unit} · entre ${low.toFixed(digits)} e ${high.toFixed(digits)}`;
}

export default function FormulaPage() {
  const [crate, setCrate] = useState<Crate | null>(null);
  const [stored, setStored] = useState(false);
  const [fillHeight, setFillHeight] = useState("21");
  const [diameter, setDiameter] = useState("6");
  const [topCount, setTopCount] = useState("28");
  const [density, setDensity] = useState("0.55");

  useEffect(() => {
    const saved = readCrate();
    setCrate(saved);
    setStored(saved !== null);
  }, []);

  const active: Crate = crate ?? {
    name: "Exemplo, ainda não medido",
    lengthCm: 50,
    widthCm: 30,
    heightCm: 22,
  };

  const height = Number(fillHeight);
  const diameterCm = Number(diameter);
  const count = Number(topCount);
  const bulkDensity = Number(density);
  const inputsReady =
    height > 0 && diameterCm > 0 && count >= 0 && bulkDensity > 0 && height <= active.heightCm;
  const tangerine = inputsReady ? tangerineCount(count, diameterCm, height) : null;
  const tomato = inputsReady ? tomatoMassKg(active, height, bulkDensity) : null;

  return (
    <>
      <h1>Conta de exemplo</h1>
      <p className="lede">
        Números digitados, sem foto e sem detector. A caixa é {active.name}, {active.lengthCm} × {active.widthCm} ×{" "}
        {active.heightCm} cm.
        {stored ? null : (
          <>
            {" "}
            <Link href="/medidas/">Guardar outro vão interno.</Link>
          </>
        )}
      </p>
      <section className="card">
        <label>
          Altura do monte (cm)
          <input value={fillHeight} inputMode="decimal" onChange={(event) => setFillHeight(event.target.value)} />
        </label>
        <label>
          Diâmetro mediano (cm)
          <input value={diameter} inputMode="decimal" onChange={(event) => setDiameter(event.target.value)} />
        </label>
        <label>
          Frutas visíveis em cima
          <input value={topCount} inputMode="numeric" onChange={(event) => setTopCount(event.target.value)} />
        </label>
        <label>
          Quilos por litro do tomate
          <input value={density} inputMode="decimal" onChange={(event) => setDensity(event.target.value)} />
        </label>

        {tangerine && tomato ? (
          <>
            <div className="result">
              <span>Tangerina</span>
              <strong>{formatEstimate(tangerine)}</strong>
            </div>
            {tangerine.flags.length > 0 ? (
              <p className="flag">A altura não fecha com um número inteiro de camadas.</p>
            ) : null}
            <p className={fitsTolerance(tangerine, 0.1) ? "ok" : "flag"}>
              {fitsTolerance(tangerine, 0.1)
                ? "O intervalo cabe em 10%."
                : "A incerteza orçada ainda passa de 10%. Na cozinha, a tela pediria a balança. Esse percentual é o orçamento do projeto, não um erro já medido."}
            </p>
            <div className="result">
              <span>Tomate</span>
              <strong>{formatEstimate(tomato)}</strong>
            </div>
          </>
        ) : (
          <p className="flag">A altura do monte precisa caber na caixa, e os outros campos precisam ser positivos.</p>
        )}
        <p className="note">0,55 kg/L é ilustração. O valor do lote ainda não foi pesado.</p>
      </section>
    </>
  );
}
