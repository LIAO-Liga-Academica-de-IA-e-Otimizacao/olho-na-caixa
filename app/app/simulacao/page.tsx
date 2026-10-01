import Link from "next/link";
import { SIMULATION_STATEMENT } from "@/lib/report";

export default function SimulationPage() {
  return (
    <>
      <h1>Simulação</h1>
      <p className="lede">
        Estas são as hipóteses propostas para a noite de render. As fotos de prova em sim/assets/preview/ não são essa
        noite, e não há erro de simulação para ler. O celular da cozinha não roda esta física.{" "}
        <Link href="/coleta/">Voltar à coleta.</Link>
      </p>

      <section className="card">
        <h2>Leva 1. A fórmula fecha</h2>
        <ul className="field-list">
          <li>20 cenas.</li>
          <li>Esferas iguais dentro de cada cena. O diâmetro é um só, sorteado entre 5 e 8 cm.</li>
          <li>A caixa é sorteada: comprimento de 40 a 60 cm, largura de 25 a 40 cm, altura interna de 15 a 25 cm.</li>
          <li>O monte está cheio. A fruta encosta na borda dos quatro lados. A altura do monte é a altura interna, sem desconto de coroa.</li>
          <li>Luz uniforme e fundo liso.</li>
          <li>A verdade é a contagem de esferas que o gerador colocou. O aplicativo só vê as imagens.</li>
        </ul>
        <p>
          O erro desta leva tem de cair perto de zero. Se não cair, o defeito está no código e a noite para. O detector
          não treina em cima de uma fórmula quebrada.
        </p>
      </section>

      <section className="card">
        <h2>Dois laços, os dois pela imagem</h2>
        <p>
          O laço do passo usa 300 cenas renderizadas. Só o passo entre camadas muda, a partir do valor inicial de cerca
          de 0,82. O coeficiente que sair fica marcado como simulação, e no aplicativo continua provisório até existir
          uma caixa real.
        </p>
        <p>
          O laço do detector usa essas mesmas cenas com luz, desfoque e fundo variados, para treinar o YOLO nano na
          camada de cima. Comparar a fórmula com a lista interna de objetos, sem foto, só verifica a álgebra. Esse
          atalho não é o teste.
        </p>
        <p>
          Um primeiro conjunto já foi gerado com a renderização simplificada: 80 tangerinas e 40 tomates, só a foto de
          cima. A semente divisível por 5 não entra no treino. Nas 24 cenas restantes o YOLO nano, a 320 pixels, erra a
          contagem visível em 5% em média, e o pior caso fica em 14%. Isso é a camada de cima no simulador, não a caixa
          inteira e não a cozinha. A Conferir desenha as caixas desse YOLO. A reta da caixa inteira, com a
          altura média verdadeira, fica em 0,7% nessas mesmas tangerinas. A foto colada na grade não mede essa altura.
          Uma vista por cima da borda, nas 16 tangerinas de prova, fica em 6,8% em média, e quatro delas passam de 10%.
          Dois quadros do arco, ficando com a leitura mais alta, vão a 7,9%, e seis ficam fora de 10%. Os centros das
          frutas, cruzados nos dois quadros, ficam em 4,1% em média, e duas delas passam de 10%. Com um terceiro quadro,
          e a fruta tendo de aparecer nos três, o erro médio fica em 3,8%, e duas ainda passam de 10%. Ficando com a
          menor das duas leituras, e tirando 4,2 cm medidos no treino, as 16 ficam em 2,2%, e nenhuma passa de 10%. No
          tomate, a mediana dos dois quadros, sem somar raio, deixa as 8 de prova em 3,0% nos litros, e nenhuma passa de
          10%. Cinco passam de 3%. Duas das 32 de treino passam de 10%, uma com a tampa em 8,8 cm e outra em 10,0 cm.
          A tela Conferir usa essa leitura quando você abre os quadros do protocolo. A marca da camada de cima continua pela cor. A página Conta continua na conta de camadas. O clipe de teste não traz essas câmeras.
        </p>
      </section>

      <section className="card">
        <h2>Leva 2. A cozinha imitada</h2>
        <p>Esta leva só abre depois que a primeira fechar. Nela entram, juntos:</p>
        <ul className="field-list">
          <li>Diâmetros misturados na mesma caixa.</li>
          <li>Camada de cima com buraco.</li>
          <li>Luz ruim.</li>
          <li>Câmera percorrendo o arco.</li>
          <li>Fruta um pouco achatada. O achatamento só existe se o modelo tridimensional for achatado.</li>
          <li>Monte que sobe acima da boca. A altura sai do quadro de lado e pode passar da altura interna.</li>
          <li>Quantidade sorteada. O monte pode ficar abaixo da boca ou passar dela.</li>
        </ul>
        <p>O erro desta leva mede o método dentro do simulador. Ele continua sendo erro de simulação.</p>
      </section>

      <section className="card">
        <h2>O que a cena não descobre</h2>
        <p>
          O quilo por litro do tomate é digitado na hora de montar a cena. O laço pode dizer se os litros do monte foram
          lidos certo. A massa de um tomate real não aparece da renderização.
        </p>
        <p>
          O gerador das fotos de prova assenta esferas e repete uma malha só, com o buraco do talo em direção
          aleatória. A noite proposta continua no Isaac Sim. As fotos antigas, de corpo rígido, ficam em
          sim/assets/preview/rigid-body/.
        </p>
        <p className="flag">
          A noite não foi autorizada. As fotos de prova não entram no relatório.
        </p>
        <p className="note">{SIMULATION_STATEMENT}</p>
      </section>
    </>
  );
}
