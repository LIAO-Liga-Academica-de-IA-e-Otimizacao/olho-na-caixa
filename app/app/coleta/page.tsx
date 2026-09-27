"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readLots } from "@/lib/lots";
import { frozenReport, type FrozenReport } from "@/lib/report";

const ILLUSTRATION = frozenReport([
  { estimate: 104, truth: 100 },
  { estimate: 98, truth: 100 },
  { estimate: 108, truth: 100 },
  { estimate: 90, truth: 100 },
]);

function formatRatio(value: number): string {
  return value.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function ReportLines({ report }: { report: FrozenReport }) {
  return (
    <>
      <div className="result">
        <span>Viés</span>
        <strong>{formatRatio(report.bias)}</strong>
      </div>
      <div className="result">
        <span>Margem de erro média</span>
        <strong>{formatRatio(report.meanAbsolute)}</strong>
      </div>
      <div className="result">
        <span>Desvio padrão</span>
        <strong>{report.sampleStd === null ? "precisa de duas caixas" : formatRatio(report.sampleStd)}</strong>
      </div>
      <div className="result">
        <span>Dentro de 10%</span>
        <strong>{formatRatio(report.withinFraction)}</strong>
      </div>
      <div className="result">
        <span>Percentil 90</span>
        <strong>{formatRatio(report.p90Absolute)}</strong>
      </div>
    </>
  );
}

export default function CollectionPage() {
  const [storedCount, setStoredCount] = useState(0);

  useEffect(() => {
    setStoredCount(readLots().length);
  }, []);

  return (
    <>
      <h1>Coleta</h1>
      <p className="lede">
        Esta tela é o roteiro do que uma caixa real precisa guardar. Não há pesagem nesta etapa. O número do edital só
        sai de um conjunto congelado, fotografado depois que os coeficientes já foram travados.
      </p>

      <section className="card">
        <h2>Ficha de uma caixa</h2>
        <ul className="field-list">
          <li>Item: tangerina ou tomate.</li>
          <li>Papel: calibração, ou conjunto congelado.</li>
          <li>Modelo da caixa, com o nome e o vão interno em centímetros.</li>
          <li>Variedade, se já tiver nome. Sem nome, o campo fica em branco.</li>
          <li>Altura do monte medida com régua, em centímetros.</li>
          <li>Vídeo do arco. O arquivo permanece neste aparelho.</li>
          <li>
            Tangerina: duas contagens independentes. Se a diferença passar de 2% da média das duas, uma terceira pessoa
            conta.
          </li>
          <li>Tomate: o peso da balança, em quilos. Esse peso é a verdade, e substitui a estimativa da foto.</li>
        </ul>
        <p className="note">
          Caixas guardadas neste aparelho: {storedCount}. A coleta espera uma caixa real. As hipóteses da simulação, ainda
          sem render, estão em <Link href="/simulacao/">Simulação</Link>.
        </p>
      </section>

      <section className="card">
        <h2>Dois grupos</h2>
        <p>
          A calibração usa cerca de 30 caixas por item. Nela se escolhem o passo entre camadas e os quilos por litro. O
          erro dessa escolha não é o número publicado.
        </p>
        <p>
          O conjunto congelado tem pelo menos 20 caixas por item, de outro dia e de outra pessoa. Ninguém mexe no passo
          nem nos quilos por litro depois de olhar esse grupo. Enquanto ele estiver vazio, o passo e os quilos por
          litro continuam no exemplo.
        </p>
        <p className="flag">Nenhuma caixa congelada. O número do edital ainda não existe.</p>
      </section>

      {ILLUSTRATION ? (
        <section className="card">
          <h2>Ilustração do relatório</h2>
          <p className="lede">
            Quatro erros inventados, só para mostrar as cinco linhas. Isto não é fruta de cozinha e não entra no edital.
          </p>
          <ReportLines report={ILLUSTRATION} />
        </section>
      ) : null}
    </>
  );
}
