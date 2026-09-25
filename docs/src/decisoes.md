# Decisões fechadas

Registro do que o time escolheu em 24 de setembro de 2026. Onde a frase original deixava duas leituras, a leitura usada daqui para a frente está escrita por extenso.

## 1. Produtos desta fase

A entrega inicial é a opção A: **tangerina em unidades** e **tomate em quilos**.

A frase do time foi “A, e só entrar com banana e tangerina depois”. A opção A já inclui a tangerina, então adiar a tangerina anularia o A. A leitura que vale é esta:

- Agora: tangerina e tomate.
- Banana: só numa fase seguinte, depois que a estimativa de tangerina estiver com erro médio dentro de 10%.
- Cenoura: fora desta fase. Não foi escolhida.

Se a intenção era adiar a tangerina e entregar outro par, este parágrafo precisa ser reescrito antes de qualquer coleta.

## 2. Balança

A foto é a medição. A balança só entra quando a estimativa pela imagem não atingir uma precisão boa o bastante para a meta daquele item.

Na prática: o app calcula pela imagem e mostra um intervalo. Se esse intervalo não cabe na meta (10% nesta fase), o operador digita o peso do visor. Não há leitura automática do visor. Não se despeja a caixa em recipientes menores para “fazer caber” na balança. Se a caixa for pesada demais para a balança e a foto também estiver incerta, o app registra a estimativa da foto e marca a caixa como incerta.

## 3. De onde vêm os centímetros

O tamanho da caixa vem de um catálogo medido pelo time.

Alguém mede, com trena, o vão **interno** das caixas que a cozinha piloto realmente recebe: comprimento, largura e altura. Na operação, o operador escolhe esse modelo (ou aceita a sugestão do app). A borda da caixa na foto é a régua. Medida de site, e medida externa, não entram na conta.

Um cartão de tamanho conhecido, para caixa que não esteja no catálogo, fica fora do caminho crítico. Só será feito se sobrar tempo no fim do prazo.

## 4. Como a caixa é filmada

O operador dá a volta com o celular num arco ao redor da caixa, e o app escolhe os quadros. O detalhe está em [Captura em arco](captura.md).

O arco não descobre sozinho o tamanho da caixa. Os centímetros continuam vindo da decisão 3.

## 5. Ajuda do operador

Nesta fase a pessoa marca a borda com quatro toques quando o app não fechar o retângulo sozinho. A marcação automática substitui os toques depois que isso estiver estável. Até lá, os quatro toques existem para a conta não depender de um detector de borda inacabado.

## 6. Caixa tampada

O operador abre a tampa e filma o miolo. Caixa lacrada, sem abertura, não tem o que estimar.

## 7. Onde o cálculo roda

Nesta fase, o celular filma e um notebook na mesma sala processa, pela rede local. Custo de API: zero. A versão que roda inteira no celular fica para quando o método já estiver medido. A demonstração final deve sobreviver sem internet externa; a rede local do notebook é o plano atual, e por isso o notebook precisa estar na sala.

## 8. Qual conta cada item usa

Combinado:

| Item | Fase | O que o app entrega | Conta |
| :--- | :--- | :--- | :--- |
| Tangerina | Agora | Unidades | Frutas da camada de cima × número de camadas |
| Tomate | Agora | Quilos | Volume do monte × quilos por litro, medidos no nosso lote |
| Banana | Depois | Unidades | Pencas visíveis × dedos por penca × camadas de penca |
| Cenoura | Fora | Quilos | A mesma lógica do tomate, se um dia entrar |

O passo a passo está em [Como a quantidade é calculada](calculo.md).

## 9. Variedade

Uma variedade por item: a que a cozinha mais recebe. O nome ainda não está escolhido. Sai de uma visita, não de um catálogo genérico. Se na demonstração chegar outra variedade, o app avisa. Não usa a tabela da variedade errada.

## 10. Quais caixas entram no catálogo

Só as que forem vistas na cozinha piloto, medidas por dentro. A lista fica aberta até essa visita. Altura de caixa plástica (18, 24 ou 31 cm, ou o que a trena mostrar por dentro) é uma escolha explícita: errar a altura erra todos os quilos daquele modelo.

## 11. Qual conjunto publica o erro

Um conjunto de caixas ajusta os coeficientes (quilos por litro, passo entre camadas, e o resto). Outro conjunto, fotografado em outro dia e por outra pessoa, só é aberto no fim. O número do relatório é o desse segundo conjunto. Coeficiente ajustado nas mesmas caixas em que se publica o erro não entra no texto.

Na coleta, cada caixa também tem a altura do monte medida com régua. Essa régua separa “a foto lateral errou” de “o quilo por litro está errado”.

## 12. O que o relatório mostra

Além da margem de erro média e do desvio padrão:

- o viés (se o app chuta para mais ou para menos)
- a fração de caixas que ficaram dentro da meta
- o percentil 90 do erro absoluto (a faixa em que 90% das caixas caíram)

A comparação com a meta usa a média. Os outros números existem para o caso de a banca ler “≤ 10%” como exigência caixa a caixa.

## 13. Pontos extras

Os quatro primeiros bônus são consequência do método, não um projeto à parte:

- peso pela imagem, porque a foto é a medição (decisão 2)
- recusa de foto ruim (tremida, estourada, sem a borda), pedindo outro arco
- menos de um minuto, porque não se fraciona caixa e o modelo de detecção fica pequeno
- custo de API igual a zero, declarado, porque o processamento é local (decisão 7)

Generalizar para um item novo só na última semana, e só se tangerina e tomate já tiverem passado. Não é trabalho desta fase.

## 14. Celular de referência

Na primeira semana o time escolhe um aparelho concreto, o mais fraco que possa aparecer na demonstração, e escreve o modelo aqui. Todo teste de tempo roda nesse aparelho. Número medido no notebook do time não vale como tempo de captura.

## O que ainda está em aberto

| Pendência | Quando fecha |
| :--- | :--- |
| Variedade de tangerina e de tomate | Visita à cozinha |
| Lista de caixas e as medidas internas | A mesma visita, com trena |
| Modelo do celular de entrada | Primeira semana |
| Cartão de referência para caixa fora do catálogo | Só se sobrar tempo |
