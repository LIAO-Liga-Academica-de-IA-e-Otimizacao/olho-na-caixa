"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DEV_TOOLS_ENABLED } from "@/lib/dev-tools";
import { readLog, writeLog, EVIDENCE_LIMIT, type EvidenceLog, type EvidenceRecord } from "@/lib/evidence-store";
import { exportConferences, importConferences, MAX_TRANSFER_BYTES } from "@/lib/evidence-transfer";
import { deliverConferenceFile } from "@/lib/export-file";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function GuardadasPage() {
  const [log, setLog] = useState<EvidenceLog>({ records: [] });
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try { setLog(readLog()); }
    catch { setError("O armazenamento deste aparelho não está disponível."); }
  }, []);

  async function exportRecords(records: EvidenceRecord[]) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const contents = exportConferences(records);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const name = records.length === 1 ? records[0].item : "conferencias";
      const outcome = await deliverConferenceFile(contents, `olho-na-caixa-${name}-${timestamp}.json`);
      setNotice(outcome === "cancelled" ? "Exportação cancelada."
        : outcome === "shared" ? "Arquivo disponibilizado para compartilhar no aparelho."
        : "Arquivo exportado. Envie o arquivo JSON aos seus colegas.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível exportar. Tente novamente.");
    } finally { setBusy(false); }
  }

  async function importFile(file: File) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      if (file.size > MAX_TRANSFER_BYTES) throw new Error("O arquivo excede o limite de 25 MB. Peça a exportação de menos conferências por arquivo.");
      const contents = await file.text();
      // Read again after file I/O so a recent local save is preserved.
      const result = importConferences(contents, readLog());
      if (result.added > 0) writeLog(result.log);
      setLog(result.log);
      setNotice(`${result.added} ${result.added === 1 ? "conferência importada" : "conferências importadas"}.` +
        (result.duplicates > 0 ? ` ${result.duplicates} ${result.duplicates === 1 ? "já estava guardada" : "já estavam guardadas"} e ${result.duplicates === 1 ? "não foi duplicada" : "não foram duplicadas"}.` : ""));
    } catch (reason) {
      const quota = reason instanceof DOMException && reason.name === "QuotaExceededError";
      setError(quota ? "Não foi possível importar: o armazenamento deste aparelho está cheio. As conferências anteriores foram mantidas."
        : `${reason instanceof Error ? reason.message : "Não foi possível ler o arquivo."} Nenhuma conferência foi alterada.`);
    } finally { setBusy(false); }
  }

  return (
    <>
      <h1>Conferências guardadas</h1>
      <p className="lede">
        A foto de cima com as caixas do detector e o número de cada passagem, neste aparelho. Revisão posterior,
        sem rede.
      </p>
      <section className="card" aria-labelledby="transfer-title">
        <h2 id="transfer-title">Trocar conferências com a equipe</h2>
        <p className="note">
          Exporte um arquivo JSON e envie aos colegas. Importe o arquivo recebido para acrescentar
          conferências neste aparelho, sem substituir as que você já guardou.
          O arquivo inclui as fotos originais quando disponíveis.
        </p>
        <div className="actions">
          <button type="button" disabled={busy || log.records.length === 0} onClick={() => void exportRecords(log.records)}>
            Exportar todas
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
            Importar conferências
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          aria-label="Arquivo de conferências"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void importFile(file);
          }}
        />
        <p className="note">Até {EVIDENCE_LIMIT} conferências por aparelho; arquivos de até 25 MB.</p>
        {busy ? <p className="note" role="status">Preparando arquivo…</p> : null}
        {notice ? <p className="ok" role="status">{notice}</p> : null}
        {error ? <p className="flag" role="alert">{error}</p> : null}
      </section>
      {log.records.length === 0 ? (
        <p className="note">Nenhuma conferência guardada. O botão fica no fim da tela de resultado.</p>
      ) : (
        log.records.map((record) => (
          <section className="card" key={record.id}>
            <h2>
              {record.item === "tangerine" ? "Tangerina" : "Tomate"} · {record.crateName}
            </h2>
            <div className="marker">
              <img src={record.imageDataUrl} alt={`${record.headline} em ${record.crateName}`} />
            </div>
            <div className="result">
              <span>{formatDate(record.savedAtISO)}</span>
              <strong>{record.headline}</strong>
            </div>
            <div className="actions">
              <button type="button" className="secondary" disabled={busy}
                aria-label={`Exportar conferência: ${record.crateName}, ${formatDate(record.savedAtISO)}`}
                onClick={() => void exportRecords([record])}>
                Exportar conferência
              </button>
            </div>
            {DEV_TOOLS_ENABLED ? (
              record.replay ? (
                <div className="actions">
                  <Link className="link-button" href={`/?replay=${encodeURIComponent(record.id)}`}>
                    Reutilizar fotos (dev)
                  </Link>
                </div>
              ) : <p className="note">Sem fotos originais para reutilizar. Guarde uma nova conferência com as ferramentas de desenvolvimento ativas.</p>
            ) : null}
          </section>
        ))
      )}
    </>
  );
}
