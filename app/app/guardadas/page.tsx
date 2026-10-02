"use client";

import { useEffect, useState } from "react";
import { readLog, type EvidenceLog } from "@/lib/evidence-store";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function GuardadasPage() {
  const [log, setLog] = useState<EvidenceLog>({ records: [] });

  useEffect(() => {
    setLog(readLog());
  }, []);

  return (
    <>
      <h1>Conferências guardadas</h1>
      <p className="lede">
        A foto de cima com as caixas do detector e o número de cada passagem, neste aparelho. Revisão posterior,
        sem rede.
      </p>
      {log.records.length === 0 ? (
        <p className="note">Nenhuma conferência guardada. O botão fica no fim da tela de resultado.</p>
      ) : (
        log.records.map((record) => (
          <section className="card" key={record.id}>
            <h1>
              {record.item === "tangerine" ? "Tangerina" : "Tomate"} · {record.crateName}
            </h1>
            <div className="marker">
              <img src={record.imageDataUrl} alt={`${record.headline} em ${record.crateName}`} />
            </div>
            <div className="result">
              <span>{formatDate(record.savedAtISO)}</span>
              <strong>{record.headline}</strong>
            </div>
          </section>
        ))
      )}
    </>
  );
}
