# Histórico dos experimentos

Este capítulo é o caderno das tentativas. Cada seção é uma leitura que foi medida, o número que ela deu, e a decisão de ficar com ela ou de deixá-la. O capítulo [Simulação no computador](../simulacao.md) descreve a cena. [A leitura que a simulação mediu](../arquitetura/leitura.md) descreve o código que ficou. Aqui está a ordem.

Todas as contas de tangerina usam as mesmas 80 cenas, sementes 1 a 80. A semente divisível por 5 é prova: 16 cenas. As outras 64 são treino. Quando há uma reta de correção, ela é ajustada só no treino. A prova entra depois, uma vez. O tomate usa as sementes 1001 a 1040: 32 de treino e 8 de prova, com a mesma regra.

A altura verdadeira, em toda a tabela, é a média da tampa: em cada célula de uma grade no fundo, a superfície mais alta da fruta, e zero onde o fundo está nu. Não é o pico. O erro é o da contagem de unidades, na tangerina, ou o dos litros, no tomate. Os dois são erro de simulação. Não são a margem da cozinha.

A meta que o livro usa para pedir a balança é 10%. No tomate, o time também queria ver se dava para ficar dentro de 3% em toda caixa. Onde a tabela diz “fora de 10%”, é uma cena de prova que passou desse limite.

## O que a altura verdadeira já permite

Antes de olhar qualquer foto, a altura média verdadeira foi ligada a uma reta, ajustada em despejos pares com 72 frutas ou mais:

> **unidades = 15,57 + 8,859 × altura em cm**

Abaixo de 5,5 cm a tampa ainda é uma cúpula, e a reta não entra: vale a fórmula do volume com a fração φ = π / (3√3), cerca de 0,605. Nas 16 tangerinas de prova, com essa altura verdadeira, o erro absoluto médio é 0,7%, e o pior caso é +2,0%. A reta vale para esta boca (28,2 cm por 39,2 cm) e para um diâmetro perto de 5,1 cm. Um centímetro a mais são cerca de nove tangerinas.

A decisão foi guardar a reta e passar a medir a altura na foto. Se a foto entregar a altura média, a contagem já está dentro de 10% antes mesmo do erro da câmera.

## Tangerina: o que foi tentado

A silhueta das esferas, calculada da lista interna e não de um pixel, acompanha a altura média com correlação 0,999 e fica, em média, 3,8 cm acima. Uma reta só no treino, altura = −3,39 + 0,979 × silhueta, traz as 16 de prova a 0,9%. Isso mostra que a grandeza certa existe. O problema passou a ser lê-la através do plástico.

| Tentativa | O que a foto fazia | Prova: erro médio | Prova: fora de 10% | Decisão |
| :--- | :--- | :--- | :--- | :--- |
| Foto colada na grade | Ler a casca pelos vãos da parede | 57% | a correlação com a altura foi −0,34 | Abandonada. O plástico tapa o perfil. Caixa cheia muitas vezes lia mais baixo. |
| Embedding da foto de cima | Uma reta em cima do vetor do YOLO | cerca de 100% | a altura saía com cerca de 17 cm de erro | Abandonada. A camada de cima parece igual em quase todo enchimento. |
| Um quadro, acima da borda próxima | A faixa entre a boca e a fruta do fundo | 6,8% depois da reta; 9,2% sem ela | 4 de 16. Pior caso +18,9% (sementes 20, 45, 55 e 70) | Não fechou. A correlação era 0,974, mas a reta levantava monte que a foto já tinha acertado. Sem correção, o pior caso ficava 36% abaixo. |
| Dois quadros, o pixel mais alto | O mesmo arco, separado cerca de 10 cm, ficando com o trecho mais alto | 7,9% | 6 de 16, de −10,3% a +21,0% | Abandonada. O pixel mais alto muitas vezes é uma fruta vista por um furo da grade, acima do monte. |
| Cruzamento do contorno | As duas linhas da silhueta se encontram | cerca de 18% | 9 de 16 | Abandonada. As linhas se encontram no ar, acima da casca. Sem correção o viés era cerca de +37%. A correlação era 0,917. |
| Centro da fruta, dois quadros | As retas do centro do disco se encontram na fruta | 4,1% | 2 de 16: +10,1% e +14,8% | Quase. Cerca de 22 frutas casavam. A leitura ficava uns 5 cm acima, de um jeito parecido em toda caixa. A correlação era 0,990. |
| Centro da fruta, três quadros | A fruta tem de aparecer nos três | 3,8% | 2 de 16: +11,5% e +14,3% | Sozinho, não. As duas que falhavam com dois quadros entraram (cerca de +2%). As novas falhas tinham poucas frutas, e elas eram as mais altas. A correlação era 0,995. |
| Mediana dos dois quadros, cortando o que passa da mediana dos três mais 3 cm | A coroa sairia, e o miolo ficaria | no treino o pior caso era 6,1% | a semente 5 de prova ficou em −16,8% | Abandonada depois de olhar a prova. Os pontos baixos e falsos puxavam a mediana. As duas médias, sozinhas, cabiam em 10% nessa caixa. |
| A menor das duas médias, menos 4,22 cm | Se a dos três está mais alta, a terceira câmera só viu a coroa | 2,2% | nenhuma. De −6,0% a +4,5% | Ficou. É a leitura publicada da tangerina. |

A reta que ficou, ajustada nas 64 de treino e só então aplicada às 16, é:

> **altura da tampa, em cm = −4,22 + 0,9996 × leitura**

No treino, com essa reta, o erro absoluto médio é 1,6%, o pior caso é 8,4%, e ninguém passa de 10%. Uma caixa, no computador, leva uma fração de segundo. O teste `test_choose_lid.py` exige que toda linha da planilha, treino e prova, fique dentro de 10%.

A margem zero, “fica a menor, sem uma folga”, foi escolhida por leave-one-out no treino. A prova da regra da mediana truncada já tinha sido vista, e essa regra foi trocada. A margem da regra que ficou não foi escolhida olhando a prova.

## Tomate: o que foi tentado

O tomate não herda o raio de 2,55 cm, o deslocamento de 4,22 cm nem a reta das unidades. O que se mede é a altura média da tampa. Os litros são a base vezes essa altura. O quilo seria esses litros vezes o quilo por litro do lote, e o simulador não pesa. O erro abaixo é o erro do litro.

A máscara da tangerina rejeita vermelho com pouco verde, e isso apaga parte do tomate maduro, que parece a caixa. A máscara do tomate aceita o vermelho claro e o verde da fruta, e continua rejeitando o vermelho escuro do plástico.

| Tentativa | O que a foto fazia | Prova: erro médio | Prova: fora de 10% | Decisão |
| :--- | :--- | :--- | :--- | :--- |
| A mesma regra da tangerina | A menor das duas médias, somando o raio, com uma reta nova no treino do tomate | 4,8% | 1 de 8, a semente 1025 em +18,3%. No leave-one-out do treino o pior caso passava de 30% | Abandonada. A média sobe com a coroa e com um cruzamento falso. Numa tampa de 8 cm, um centímetro já é mais de 10% do volume. |
| Silhueta na parede do fundo | O mesmo passeio da tangerina, agora com a máscara do tomate | 12,2% | 2 de 8. A semente 1025 ficou em −48% | Abandonada. A correlação no treino era 0,989, mas a reta, feita para montes baixos que liam alto, derrubava o monte cuja foto já estava perto. |
| Grade no fundo com as frutas casadas | Cada centro vira uma esfera, e o vazio vale zero | 12,6% | 5 de 8 | Abandonada. O arco vê cerca de 15 a 20 frutas, não o monte inteiro. O vazio das que faltam come o volume. |
| Mediana, sem somar raio | Tira os 3 cm da parede próxima e o ponto que passa de 6 cm acima da mediana | 3,0% | nenhuma. De −4,5% a +5,9%. Cinco das oito passam de 3% | Ficou, com o limite escrito. Não segura 3% em toda caixa, nem 10% em duas do treino. |

A reta que ficou, nas 32 de treino, é:

> **altura da tampa, em cm = −1,09 + 0,998 × leitura**

Nas 32 de treino, duas passam de 10%: a semente 1011 em +11,5%, com a tampa em 8,8 cm, e a 1014 em +10,7%, com a tampa em 10,0 cm. A mediana das frutas vistas ficou cerca de 2 cm acima da média do fundo. O arco não mostrou o vão que puxa essa média para baixo. O teste `test_tomato_volume.py` exige 10% nas 8 de prova. Ele não exige 3% em toda caixa, porque esse número não foi alcançado.

A escolha entre média crua, mediana e mediana aparada foi feita por leave-one-out no treino. A prova foi olhada depois disso.

## O detector, em paralelo

O YOLO nano não mede a altura. Ele marca a camada de cima, numa foto de 320 pixels. Nas 24 cenas que não entraram no treino, com confiança 0,55 e supressão de caixas sobrepostas em 0,45, a precisão e a revocação das caixas ficam em 94%. O erro absoluto médio da contagem visível é cerca de 5%, e o pior caso é 14%, no tomate da semente 1010 (42 frutas visíveis, 36 marcadas). O mAP50 é 0,97. Esse ponto de corte foi escolhido nessas mesmas 24 cenas, então ele não é uma prova cega. A tela Conferir ainda marca pela cor. O peso está em `sim/assets/detect/top-layer.pt`.

## O que não entrou

Uma contagem direta, da foto para o número de frutas, foi deixada de lado: a camada de cima fica perto de 48 peças em enchimentos muito diferentes, e o que muda é a altura.

Baixar a fração φ para a conta fechar não foi feito. A fração é a da geometria, não um ajuste.

A noite de 300 cenas e a leva das esferas iguais, descritas em [Simulação no computador](../simulacao.md), não foram executadas. Os números deste capítulo são das 80 tangerinas e dos 40 tomates do conjunto do detector.

Rafael contou 42 tangerinas na caixa da semente 5 e 45 na da semente 1, em fotos de cima anteriores. Esses pixels foram substituídos. Com diâmetro 5,3 cm e passo 0,82, as alturas médias de 12,1 cm e 20,1 cm não publicam as verdades 86 e 159. Foi essa conta de camadas, nas fotos antigas, que motivou medir a altura de outro jeito.
