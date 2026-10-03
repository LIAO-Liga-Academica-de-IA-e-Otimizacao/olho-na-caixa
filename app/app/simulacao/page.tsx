import Link from "next/link";
import { SIMULATION_STATEMENT } from "@/lib/report";

export default function SimulationPage() {
  return (
    <>
      <h1>Simulação</h1>
      <p className="lede">
        O simulador já rodou. Os números abaixo são de caixa gerada, não de cozinha. O celular não executa o Blender.{" "}
        <Link href="/coleta/">Voltar à coleta.</Link>
      </p>

      <section className="card">
        <h2>O que foi medido</h2>
        <ul className="field-list">
          <li>Tangerina, prova do estúdio: 2,4% em 24 cenas, nenhuma fora de 10%.</li>
          <li>Tomate, litros, prova do estúdio: 3,3% em 16 cenas, nenhuma fora de 10%.</li>
          <li>Validação cruzada no conjunto original: 2,1% nas 80 tangerinas e 3,2% nos 40 tomates, uma fora em cada.</li>
          <li>Luz dura: 5,6% em 232 tangerinas e 10,1% em 240 tomates. Isso delimita o envelope. Não prova a reta.</li>
          <li>Camada de cima, YOLO nano: erro médio de contagem visível perto de 5% nas cenas que ficaram fora do treino.</li>
        </ul>
        <p>
          A Conferir usa essa leitura: arco calibrado e as caixas do YOLO na vista de cima. A página Conta continua na
          conta de camadas, com números de exemplo.
        </p>
        <p className="note">{SIMULATION_STATEMENT}</p>
      </section>
    </>
  );
}
