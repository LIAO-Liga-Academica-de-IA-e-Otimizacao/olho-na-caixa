# Decisões fechadas

Este capítulo registra o que o time escolheu em 24 de setembro de 2026. Onde a frase original deixava duas leituras, a leitura que vale daqui para a frente está escrita por extenso.

## 1. Produtos desta fase

A entrega inicial é a opção A: **tangerina em unidades** e **tomate em quilos**.

A frase do time foi “A, e só entrar com banana e tangerina depois”. A opção A já inclui a tangerina, então adiar a tangerina anularia essa opção. A leitura que vale é esta:

- Nesta fase, o aplicativo estima tangerina e tomate.
- A banana entra só numa fase seguinte, depois que a estimativa de tangerina estiver com erro médio dentro de 10%.
- A cenoura fica fora desta fase, porque não foi escolhida.

Se a intenção era adiar a tangerina e entregar outro par de produtos, este parágrafo precisa ser reescrito antes de qualquer coleta.

## 2. Balança

A foto é a medição. A balança entra quando a estimativa pela imagem não atinge uma precisão boa o bastante para a meta daquele item.

Na operação, o aplicativo calcula a quantidade pela imagem e mostra um intervalo. Se esse intervalo não cabe na meta de 10% desta fase, o operador lê o visor da balança e digita o peso. O aplicativo não lê o visor sozinho. A caixa permanece inteira: o operador não a reparte em recipientes menores para caber na balança. Quando a caixa passa do limite da balança e a foto também está incerta, o aplicativo guarda a estimativa da foto e marca a caixa como incerta.

## 3. De onde vêm os centímetros

O tamanho da caixa vem de um catálogo medido pelo time.

Alguém mede, com trena, o vão **interno** das caixas que a cozinha piloto realmente recebe: comprimento, largura e altura. Na operação, o operador escolhe esse modelo, ou aceita a sugestão do aplicativo. A borda da caixa na foto funciona como régua. A conta usa essas medidas internas. Medida publicada em site e medida externa da caixa ficam de fora.

Um cartão de tamanho conhecido, para uma caixa que não esteja no catálogo, fica fora do caminho crítico. Esse cartão só será feito se sobrar tempo no fim do prazo.

## 4. Como a caixa é filmada

O operador dá a volta com o celular num arco ao redor da caixa, e o aplicativo escolhe os quadros. O detalhe está em [Captura em arco](captura.md).

O arco serve para escolher as vistas e para ler a altura do monte. Os centímetros da caixa continuam vindo da decisão 3.

## 5. Ajuda do operador

Nesta fase, a pessoa marca a borda com quatro toques quando o aplicativo não fecha o retângulo sozinho. A marcação automática substitui esses toques depois que o detector de borda estiver estável. Até lá, os quatro toques existem para a conta não depender de um detector inacabado.

## 6. Caixa tampada

O operador abre a tampa e filma o miolo. Uma caixa lacrada, sem abertura, não oferece uma vista do conteúdo, então o aplicativo não produz estimativa para ela.

## 7. Onde o cálculo roda

Nesta fase, o celular filma e um notebook na mesma sala processa o vídeo, pela rede local. O custo de API é zero, porque o processamento fica nessa máquina. A versão que roda inteira no celular fica para quando o método já estiver medido. A demonstração final precisa funcionar sem internet externa. O plano atual é a rede local do notebook, e por isso o notebook precisa estar na sala.

## 8. Qual conta cada item usa

O time combinou a conta de cada item. A tabela abaixo é o resumo. O passo a passo está em [Como a quantidade é calculada](calculo.md).

| Item | Fase | O que o aplicativo entrega | Conta |
| :--- | :--- | :--- | :--- |
| Tangerina | Nesta fase | Unidades | Frutas da camada de cima, multiplicadas pelo número de camadas |
| Tomate | Nesta fase | Quilos | Volume do monte, multiplicado pelos quilos por litro medidos no lote |
| Banana | Fase seguinte | Unidades | Pencas visíveis, multiplicadas pelos dedos por penca e pelas camadas de penca |
| Cenoura | Fora desta fase | Quilos | A mesma lógica do tomate, se a cenoura entrar no escopo no futuro |

## 9. Variedade

Cada item usa uma variedade: a que a cozinha mais recebe. O nome dessa variedade ainda não está escolhido. Ele sai de uma visita à cozinha, e não de um catálogo genérico. Se na demonstração chegar outra variedade, o aplicativo avisa o operador e se recusa a usar a tabela da variedade errada.

## 10. Quais caixas entram no catálogo

O catálogo inclui só as caixas vistas na cozinha piloto, medidas por dentro. A lista fica aberta até essa visita. A altura da caixa plástica (18, 24 ou 31 cm, ou o valor que a trena mostrar por dentro) é uma escolha explícita de cada modelo. Errar essa altura erra todos os quilos daquele modelo.

## 11. Qual conjunto publica o erro

Um conjunto de caixas ajusta os coeficientes, entre eles os quilos por litro e o passo entre camadas. Outro conjunto, fotografado em outro dia e por outra pessoa, só é aberto no fim. O número do relatório é o erro desse segundo conjunto. Um coeficiente ajustado nas mesmas caixas em que se publica o erro não entra no texto do relatório.

Na coleta, cada caixa também tem a altura do monte medida com régua. Essa régua separa dois erros diferentes: a foto lateral leu mal a altura, ou o quilo por litro está errado.

## 12. O que o relatório mostra

O relatório mostra a margem de erro média e o desvio padrão. Além desses dois números, ele mostra:

- o viés, isto é, se o aplicativo estima para mais ou para menos;
- a fração de caixas que ficaram dentro da meta;
- o percentil 90 do erro absoluto, isto é, o valor abaixo do qual caíram 90% das caixas.

A comparação com a meta usa a média. Os outros números acompanham o relatório para o caso de a banca ler “≤ 10%” como uma exigência caixa a caixa.

## 13. Pontos extras

Os quatro primeiros bônus saem do próprio método. Eles não formam um projeto separado:

- O peso sai da imagem, porque a foto é a medição (decisão 2).
- O aplicativo recusa foto ruim (tremida, estourada ou sem a borda) e pede outro arco.
- A conferência fica em menos de um minuto, porque a caixa não é fracionada e o modelo de detecção fica pequeno.
- O custo de API é zero, porque o processamento é local (decisão 7).

Generalizar o método para um item novo fica para a última semana, e só acontece se tangerina e tomate já tiverem passado na meta. Esse trabalho não faz parte desta fase.

## 14. Celular de referência

Na primeira semana, o time escolhe um aparelho concreto: o mais fraco que possa aparecer na demonstração. O modelo desse aparelho será escrito neste parágrafo. Todo teste de tempo roda nesse aparelho. Um tempo medido no notebook do time não vale como tempo de captura.

## O que ainda está em aberto

| Pendência | Quando se resolve |
| :--- | :--- |
| Variedade de tangerina e de tomate | Na visita à cozinha |
| Lista de caixas e as medidas internas | Na mesma visita, com trena |
| Modelo do celular de entrada | Na primeira semana |
| Cartão de referência para caixa fora do catálogo | Só se sobrar tempo no fim do prazo |
