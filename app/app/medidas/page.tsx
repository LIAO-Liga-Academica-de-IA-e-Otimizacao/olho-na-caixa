"use client";

import { useEffect, useState } from "react";
import {
  activeCrate,
  emptyBook,
  readBook,
  removeCrate,
  setActive,
  upsertCrate,
  writeBook,
  type CrateBook,
} from "@/lib/crate-store";

function formatDims(lengthCm: number, widthCm: number, heightCm: number): string {
  const parts = [lengthCm, widthCm, heightCm].map((value) =>
    value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  );
  return `${parts[0]} × ${parts[1]} × ${parts[2]} cm`;
}

export default function MeasuresPage() {
  const [book, setBook] = useState<CrateBook>(emptyBook);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBook(readBook());
  }, []);

  function startNew() {
    setEditing(null);
    setName("");
    setLengthCm("");
    setWidthCm("");
    setHeightCm("");
    setSaved(false);
  }

  function startEdit(crateName: string) {
    const crate = book.crates.find((entry) => entry.name === crateName);
    if (!crate) return;
    setEditing(crate.name);
    setName(crate.name);
    setLengthCm(String(crate.lengthCm));
    setWidthCm(String(crate.widthCm));
    setHeightCm(String(crate.heightCm));
    setSaved(false);
  }

  function save() {
    const crate = {
      name: name.trim(),
      lengthCm: Number(lengthCm),
      widthCm: Number(widthCm),
      heightCm: Number(heightCm),
    };
    const next = editing && editing !== crate.name ? removeCrate(book, editing) : book;
    const updated = upsertCrate(next, crate);
    writeBook(updated);
    setBook(updated);
    setEditing(crate.name);
    setSaved(true);
  }

  function drop(crateName: string) {
    const updated = removeCrate(book, crateName);
    writeBook(updated);
    setBook(updated);
    if (editing === crateName) startNew();
  }

  function use(crateName: string) {
    const updated = setActive(book, crateName);
    writeBook(updated);
    setBook(updated);
  }

  const valid =
    name.trim().length > 0 &&
    Number(lengthCm) > 0 &&
    Number(widthCm) > 0 &&
    Number(heightCm) > 0;
  const current = activeCrate(book);

  return (
    <>
      <h1>Caixas</h1>
      <p className="lede">
        Cada modelo guarda o vão interno, em centímetros. A Conferir e a Conta usam a caixa marcada como em uso. Tudo
        fica neste aparelho.
      </p>

      {book.crates.length > 0 ? (
        <ul className="crate-list">
          {book.crates.map((crate) => {
            const inUse = current?.name === crate.name;
            return (
              <li key={crate.name} className={inUse ? "crate-row is-on" : "crate-row"}>
                <div>
                  <strong>{crate.name}</strong>
                  <span className="note"> · {formatDims(crate.lengthCm, crate.widthCm, crate.heightCm)}</span>
                  {inUse ? <span className="badge"> em uso</span> : null}
                </div>
                <div className="actions">
                  {inUse ? null : (
                    <button type="button" className="secondary" onClick={() => use(crate.name)}>
                      Usar
                    </button>
                  )}
                  <button type="button" className="secondary" onClick={() => startEdit(crate.name)}>
                    Editar
                  </button>
                  <button type="button" className="secondary" onClick={() => drop(crate.name)}>
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="note">Nenhuma caixa guardada. Meça a primeira abaixo.</p>
      )}

      <form
        className="card"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) save();
        }}
      >
        <h2>{editing ? `Editar ${editing}` : "Nova caixa"}</h2>
        <label>
          Nome do modelo
          <input
            value={name}
            onChange={(event) => {
              setSaved(false);
              setName(event.target.value);
            }}
          />
        </label>
        <label>
          Comprimento interno (cm)
          <input
            inputMode="decimal"
            value={lengthCm}
            onChange={(event) => {
              setSaved(false);
              setLengthCm(event.target.value);
            }}
          />
        </label>
        <label>
          Largura interna (cm)
          <input
            inputMode="decimal"
            value={widthCm}
            onChange={(event) => {
              setSaved(false);
              setWidthCm(event.target.value);
            }}
          />
        </label>
        <label>
          Altura interna (cm)
          <input
            inputMode="decimal"
            value={heightCm}
            onChange={(event) => {
              setSaved(false);
              setHeightCm(event.target.value);
            }}
          />
        </label>
        <div className="actions">
          {editing ? (
            <button type="button" className="secondary" onClick={startNew}>
              Nova
            </button>
          ) : null}
          <button type="submit" disabled={!valid}>
            Guardar
          </button>
        </div>
        {saved ? <p className="ok">Medidas guardadas neste navegador.</p> : null}
      </form>
    </>
  );
}
