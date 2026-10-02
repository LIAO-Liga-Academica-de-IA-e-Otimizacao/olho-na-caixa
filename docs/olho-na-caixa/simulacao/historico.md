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
| A menor das duas médias, menos 4,22 cm | Se a dos três está mais alta, a terceira câmera só viu a coroa | 2,2% | nenhuma. De −6,0% a +4,5% | Ficou na época. A calibração do arco, na seção abaixo, trocou a pose por cena pela pose congelada, e a leitura publicada hoje é altura = −2,00 + 0,932 × leitura. |

A reta que ficou na época, ajustada nas 64 de treino e só então aplicada às 16, é:

> **altura da tampa, em cm = −4,22 + 0,9996 × leitura**

No treino, com essa reta, o erro absoluto médio é 1,6%, o pior caso é 8,4%, e ninguém passa de 10%. Uma caixa, no computador, leva uma fração de segundo. O teste `test_choose_lid.py` exige que toda linha da planilha, treino e prova, fique dentro de 10%. A reta do arco calibrado substituiu esta na Conferir; o teste continua guardando a antiga com a pose gravada.

A margem zero, “fica a menor, sem uma folga”, foi escolhida por leave-one-out no treino. A prova da regra da mediana truncada já tinha sido vista, e essa regra foi trocada. A margem da regra que ficou não foi escolhida olhando a prova.

## Tomate: o que foi tentado

O tomate não herda o raio de 2,55 cm, o deslocamento de 4,22 cm nem a reta das unidades. O que se mede é a altura média da tampa. Os litros são a base vezes essa altura. O quilo seria esses litros vezes o quilo por litro do lote, e o simulador não pesa. O erro abaixo é o erro do litro.

A máscara da tangerina rejeita vermelho com pouco verde, e isso apaga parte do tomate maduro, que parece a caixa. A máscara do tomate aceita o vermelho claro e o verde da fruta, e continua rejeitando o vermelho escuro do plástico.

| Tentativa | O que a foto fazia | Prova: erro médio | Prova: fora de 10% | Decisão |
| :--- | :--- | :--- | :--- | :--- |
| A mesma regra da tangerina | A menor das duas médias, somando o raio, com uma reta nova no treino do tomate | 4,8% | 1 de 8, a semente 1025 em +18,3%. No leave-one-out do treino o pior caso passava de 30% | Abandonada. A média sobe com a coroa e com um cruzamento falso. Numa tampa de 8 cm, um centímetro já é mais de 10% do volume. |
| Silhueta na parede do fundo | O mesmo passeio da tangerina, agora com a máscara do tomate | 12,2% | 2 de 8. A semente 1025 ficou em −48% | Abandonada. A correlação no treino era 0,989, mas a reta, feita para montes baixos que liam alto, derrubava o monte cuja foto já estava perto. |
| Grade no fundo com as frutas casadas | Cada centro vira uma esfera, e o vazio vale zero | 12,6% | 5 de 8 | Abandonada. O arco vê cerca de 15 a 20 frutas, não o monte inteiro. O vazio das que faltam come o volume. |
| Mediana, sem somar raio | Tira os 3 cm da parede próxima e o ponto que passa de 6 cm acima da mediana | 3,0% | nenhuma. De −4,5% a +5,9%. Cinco das oito passam de 3% | Ficou na época, com o limite escrito: não segurava 3% em toda caixa, nem 10% em duas do treino. A calibração do arco a substituiu pela reta altura = 0,79 + 0,931 × leitura. |

A reta que ficou na época, nas 32 de treino, é:

> **altura da tampa, em cm = −1,09 + 0,998 × leitura**

Nas 32 de treino, duas passam de 10%: a semente 1011 em +11,5%, com a tampa em 8,8 cm, e a 1014 em +10,7%, com a tampa em 10,0 cm. A mediana das frutas vistas ficou cerca de 2 cm acima da média do fundo. O arco não mostrou o vão que puxa essa média para baixo. O teste `test_tomato_volume.py` exige 10% nas 8 de prova. Ele não exige 3% em toda caixa, porque esse número não foi alcançado.

A escolha entre média crua, mediana e mediana aparada foi feita por leave-one-out no treino. A prova foi olhada depois disso.

## Sem a posição gravada da câmera

A leitura publicada usa a origem e a rotação com que o Blender tirou a foto. Um vídeo de celular não traz esses números. A tentativa seguinte lê a pose na própria foto: os quatro cantos da boca, o retângulo de catálogo 28,2 cm por 39,2 cm na altura da borda, e a lente fixa do estúdio, 35 mm num sensor de 36 mm. Essa lente é do gerador, igual em toda foto. Ela não é estimada do pixel. A origem e a rotação saem dos cantos, por IPPE, ficando a solução com a câmera fora da parede próxima. O cruzamento dos centros da fruta é o mesmo de antes. O código está em `sim/detect/rim_pose.py`.

A primeira versão punha um canto por foto, por IPPE, e lia a altura com essa pose. Não segurou: na prova da tangerina, 15 cenas com leitura, erro médio da contagem 12,6%, quatro fora de 10% (sementes 10, 25, 30 e 45, esta última em +87%). A semente 20 não teve leitura. No treino o erro médio foi 6,0%, com 9 de 63 fora. No tomate a reta saiu com inclinação 0,78, o treino errou 20,5% e a prova 10,0%, com três de 7 fora. A mediana da câmera recuperada ficou a 3,5 cm da origem do Blender, e alguns quadros erraram a borda próxima por mais de 100 pixels.

O teste de ruído explicou o motivo. Com a pose verdadeira deslocada de só 0,5 cm, e o deslocamento publicado, a contagem da prova já erra 8,4% em média, com 4 de 12 fora e cenas sem leitura. Com 1 cm o erro vai a 25%. A leitura precisa da pose a uns 3 mm. Cada pixel de canto vale uns 8 mm de pose nessa vista de raspão. Nenhum detector de borda entrega meio pixel com viés zero, então um canto por foto nunca fecha.

O que fechou foi calibrar o arco, não a foto. As três posições de câmera são as mesmas em toda cena. O código novo detecta a borda próxima pelo degrau de densidade de bordas em faixas laterais: o trilho sólido tem pouca borda e a grade tem muita. Esse degrau senta uns 6 a 9 pixels abaixo da borda, com desvio estreito, medido nas medianas do treino (+8,8, +5,8 e +7,4 pixels por câmera na tangerina; +7,6, +6,2 e +7,4 no tomate). Esse deslocamento equivale a marcar a borda uma vez por posição do arco. Tirado o viés, cada cena de treino dá uma pose por IPPE, e a mediana robusta das cenas de treino vira a pose congelada do arco, a 1 cm da origem do Blender. A reta da leitura é ajustada de novo só no treino. A prova entra congelada, sem a pose gravada em nenhum ponto da pontuação.

Com o arco calibrado só pelo treino, a tangerina ficou altura = −2,00 + 0,932 × leitura: treino com erro médio 2,0% (1 fora, a semente 2 em −12%) e prova com erro médio 2,3%, ninguém fora. O tomate ficou altura = 0,79 + 0,931 × leitura: treino com erro médio 3,5% nos litros (1 fora, a semente 1011 em +10%) e prova com erro médio 2,8%, ninguém fora. O cruzamento dos centros da fruta é o mesmo de antes. O teste `test_rim_pose.py` exige os cantos de três fotos de treino a menos de 25 pixels da boca projetada.

Na cozinha isso vira protocolo: três posições marcadas no chão ou no balcão, uma marcação da borda por posição feita uma vez, e a mesma reta do treino. A Conferir usa esse arco desde a exportação do rig para `app/lib/arc-cameras.json`, com um conjunto de poses por fruta e as retas novas em `app/lib/arc-height.ts`. A pose gravada continua em `sim/detect/pair_cameras.json`, como referência do gerador.

## Validação cruzada do arco calibrado

Sem Blender novo, a prova cresceu por revezamento: 5 dobras por semente com resto 0 a 4, a dobra 0 é a prova publicada. Em cada dobra a pose mediana e a reta são refeitas só com as outras quatro; as 16 tangerinas (8 tomates) presas são pontuadas congeladas. O viés do degrau em pixels continua a constante publicada, medida nas medianas do treino cheio. O roteiro está em `sim/detect/crossval.py`.

A dobra 0 reproduz a reta publicada nas duas frutas, o que confere o roteiro. As retas das dobras da tangerina ficam entre −2,00 + 0,932 × leitura e −2,18 + 0,940 × leitura, com erro médio por dobra entre 1,7% e 2,3%. Juntando as 80 cenas, cada uma presa uma vez: erro médio 2,1%, uma fora (a semente 2 em −10,1%, a mesma que o treino já apontava). No tomate as retas variam mais, de 0,78 + 0,931 × leitura a 1,41 + 0,899 × leitura, com erro médio por dobra entre 2,8% e 3,9%. Juntas as 40 cenas: erro médio 3,2% nos litros, uma fora (a semente 1011 em +11,3%, a mesma do treino).

## Cenas novas de prova

A prova cresceu com Blender de verdade, na placa NVIDIA: 8 tangerinas (sementes 85 a 120, passo 5) e 8 tomates (sementes 1045 a 1080, passo 5), todas com resto 0, portanto prova. O gerador aceita a lista de sementes (`--seeds 85,90,...` em `sim/render-dataset.py`), e as planilhas passam por fusão por semente em vez de reescrita, para não perder as colunas do pontuador. O roteiro está em `sim/detect/score_new.py`: o arco e a reta são refeitos só com o treino original, e as 16 cenas novas entram congeladas. A reta refeita reproduz a publicada nas duas frutas (−2,00 + 0,932 × leitura; 0,79 + 0,931 × leitura), o que confere o roteiro.

Nas 8 tangerinas novas, erro médio 2,5%, nenhuma fora de 10% (pior: semente 105 em +7,4%). Junto com as 16 antigas, a prova combinada de 24 fica em 2,4%, ninguém fora (pior: semente 15 em +8,7%, cena antiga). Nos 8 tomates novos, erro médio 3,9% nos litros, nenhum fora (pior: semente 1070 em −7,0%). Junto com os 8 antigos, a prova combinada de 16 fica em 3,3%, ninguém fora.

## O detector, em paralelo

O YOLO nano não mede a altura. Ele marca a camada de cima, numa foto de 320 pixels. Nas 24 cenas que não entraram no treino, com confiança 0,55 e supressão de caixas sobrepostas em 0,45, a precisão e a revocação das caixas ficam em 94%. O erro absoluto médio da contagem visível é cerca de 5%, e o pior caso é 14%, no tomate da semente 1010 (42 frutas visíveis, 36 marcadas). O mAP50 é 0,97. Esse ponto de corte foi escolhido nessas mesmas 24 cenas, então ele não é uma prova cega. A Conferir desenha essas caixas a partir da exportação ONNX do mesmo peso, `sim/assets/detect/top-layer.pt`.

## O que não entrou

Uma contagem direta, da foto para o número de frutas, foi deixada de lado: a camada de cima fica perto de 48 peças em enchimentos muito diferentes, e o que muda é a altura.

Baixar a fração φ para a conta fechar não foi feito. A fração é a da geometria, não um ajuste.

A noite de 300 cenas e a leva das esferas iguais, descritas em [Simulação no computador](../simulacao.md), não foram executadas. Os números deste capítulo são das 88 tangerinas e dos 48 tomates do conjunto do detector, com prova combinada de 24 e 16 cenas.

Rafael contou 42 tangerinas na caixa da semente 5 e 45 na da semente 1, em fotos de cima anteriores. Esses pixels foram substituídos. Com diâmetro 5,3 cm e passo 0,82, as alturas médias de 12,1 cm e 20,1 cm não publicam as verdades 86 e 159. Foi essa conta de camadas, nas fotos antigas, que motivou medir a altura de outro jeito.
