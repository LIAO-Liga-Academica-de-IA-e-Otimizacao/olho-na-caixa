"use client";

import { useEffect, useState } from "react";
import { readCrate, writeCrate } from "@/lib/crate-store";

export default function MeasuresPage() {
  const [name, setName] = useState("Caixa da cozinha");
  const [lengthCm, setLengthCm] = useState("50");
  const [widthCm, setWidthCm] = useState("30");
  const [heightCm, setHeightCm] = useState("22");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const crate = readCrate();
    if (!crate) return;
    setName(crate.name);
    setLengthCm(String(crate.lengthCm));
    setWidthCm(String(crate.widthCm));
    setHeightCm(String(crate.heightCm));
  }, []);

  function save() {
    writeCrate({
      name: name.trim(),
      lengthCm: Number(lengthCm),
      widthCm: Number(widthCm),
      heightCm: Number(heightCm),
    });
    setSaved(true);
  }

  const valid =
    name.trim().length > 0 &&
    Number(lengthCm) > 0 &&
    Number(widthCm) > 0 &&
    Number(heightCm) > 0;

  return (
    <>
      <h1>Vão interno</h1>
      <p className="lede">
        Comprimento, largura e altura de dentro da caixa, em centímetros. O valor fica neste aparelho.
      </p>
      <form
        className="card"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) save();
        }}
      >
        <label>
          Nome do modelo
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Comprimento (cm)
          <input inputMode="decimal" value={lengthCm} onChange={(event) => setLengthCm(event.target.value)} />
        </label>
        <label>
          Largura (cm)
          <input inputMode="decimal" value={widthCm} onChange={(event) => setWidthCm(event.target.value)} />
        </label>
        <label>
          Altura (cm)
          <input inputMode="decimal" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} />
        </label>
        <div className="actions">
          <button type="submit" disabled={!valid}>
            Guardar
          </button>
        </div>
        {saved ? <p className="ok">Medidas guardadas neste navegador.</p> : null}
      </form>
    </>
  );
}
