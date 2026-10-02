# A leitura que a simulação mediu

Este capítulo explica o código que produziu o erro citado no livro. A mesma leitura, para as fotos de 640 por 480 pixels, também roda na tela Conferir, em `app/lib/arc-height.ts`. A página Conta continua na conta de camadas de `app/lib/packing.ts`.

A Conferir não usa a pose que o renderizador gravou. Ela usa o arco calibrado em `app/lib/arc-cameras.json`: uma pose congelada por posição, mediana das fotos de treino dessa posição, com as retas altura = −2,00 + 0,932 × leitura na tangerina e altura = 0,79 + 0,931 × leitura no tomate. A pose gravada continua em `sim/detect/pair_cameras.json`, como referência do gerador. O [histórico](../simulacao/historico.md) conta a calibração e os erros: 2,3% na prova da tangerina e 2,8% na do tomate, ninguém fora de 10%. O que está abaixo é a mesma leitura, agora com o arco calibrado.

A ideia, nas duas frutas, é a mesma. A câmera fica acima da borda próxima e olha o monte. Uma fruta redonda aparece como um disco, e o centro do disco é a projeção do centro da fruta. Duas fotos do mesmo arco, de lugares um pouco diferentes, dão duas retas. As retas se encontram na fruta. O encontro da silhueta, aquele contorno escuro contra o fundo, cai no ar, fora da casca, e foi abandonado.

A tangerina usa três fotos e uma reta de unidades. O tomate usa duas fotos e o volume. Os números de uma não servem na outra: o raio, o deslocamento da reta calibrada e a reta de 8,859 frutas por centímetro são da tangerina desta caixa. Cenoura e banana não herdam esses números. A cenoura, quando entrar, usa a conta dos litros. A banana usa pencas, dedos e camadas de penca. O que as duas herdam é a caixa, o arco e a divisão treino/prova. A máscara e o leitor de altura são escritos para a forma da peça.

![Da foto da tangerina até as unidades](leitura-tangerina.svg)

## Tangerina

O código está em `sim/detect/fruit_height.py`, `choose_lid.py` e `profile.py`.

`fruit_centers` acha um ponto por fruta visível. A máscara fica com a casca (laranja, com verde) e rejeita o plástico vermelho-escuro da caixa e o fundo cinza. Um pico da transformada de distância é o centro do disco.

`matched_points` casa o mesmo fruto nas duas fotos pela cor e pelo encontro das retas. As retas têm de passar a menos de 2 cm uma da outra, e o encontro tem de cair dentro da caixa. `matched_tops` soma um raio de 2,55 cm, porque na tangerina o encontro foi tratado como o centro e a tampa é a casca de cima.

Há um terceiro quadro, do outro lado do arco e um pouco mais alto. `matched_tops_three` só aceita a fruta que aparece nos três. Quando poucas frutas concordam, elas costumam ser as mais altas, a coroa, e a média sobe.

`choose_lid.lid_cm` fica com a menor das duas médias. Se a dos três quadros está mais alta, a terceira câmera só viu a coroa, e vale a média dos dois. A reta abaixo pertence ao arco calibrado: foi ajustada nas 64 cenas de treino, com o rig congelado, antes da prova. A reta antiga, −4,22 + 0,9996 × leitura, pertencia à pose gravada e está no [histórico](../simulacao/historico.md):

> **altura da tampa, em cm = −2,00 + 0,932 × leitura**

`count_from_height` transforma essa altura em unidades. Abaixo de 5,5 cm, a tampa ainda é uma cúpula e a fórmula usa a fração de empacotamento φ = π / (3√3), cerca de 0,605, com um acréscimo de um sexto do diâmetro. Da segunda camada em diante, nas cenas desta caixa e deste diâmetro perto de 5,1 cm:

> **unidades = 15,57 + 8,859 × altura em cm**

A reta não é universal. Ela vale para esta boca, 28,2 cm por 39,2 cm, e para este calibre. Um centímetro a mais são cerca de nove tangerinas: 4% de uma caixa de 240, e perto de 10% de uma caixa de 100.

Nas 16 cenas de prova, com a altura verdadeira, a reta erra 0,7% em média. Com a altura lida das fotos pelo arco calibrado, o erro absoluto médio é 2,3%. Nenhuma passa de 10%. Nas 64 de treino, uma passa: a semente 2 em −12%. Uma caixa, no computador, leva uma fração de segundo. O teste `test_choose_lid.py` guarda a leitura com a pose gravada, que continua passando com 2,2% na prova.

## Tomate

O código está em `sim/detect/tomato_volume.py`. Ele reutiliza `matched_points`, com a máscara do tomate: vermelho claro entra, vermelho escuro da caixa fica de fora. Verde de tomate verde também entra, porque a casca não é cinza.

O tomate não soma o raio da tangerina. O encontro das retas já cai perto da casca, e somar 2,55 cm levanta o monte inteiro. A leitura também não é a média. A média sobe com um cruzamento falso lá em cima, por exemplo uma fruta vista pelo furo da grade.

O que entra na reta é a mediana, depois de dois cortes. Os pontos nos primeiros 3 cm dentro da parede próxima são a borda, não o monte. Um ponto mais de 6 cm acima da mediana é um cruzamento falso e sai. A mediana do que sobrou é a leitura.

Nas 32 cenas de treino, com o rig congelado, a reta ficou:

> **altura da tampa, em cm = 0,79 + 0,931 × leitura**

Os litros são a base vezes essa altura. A base é 28,2 × 39,2 cm². O quilo seria esses litros vezes o quilo por litro do lote. O simulador não pesa, então o erro que ele publica é o erro do litro, no caso em que o quilo por litro já é conhecido.

![Da foto do tomate até os litros](leitura-tomate.svg)

Nas 8 cenas de prova o erro absoluto médio é 2,8%. Nenhuma passa de 10%. Nas 32 de treino, uma passa: a semente 1011 em +10%. Um centímetro numa tampa dessas já é cerca de 10% do volume. A mediana das frutas vistas ficou cerca de 2 cm acima da média do fundo, e o arco não mostrou o vão que puxa essa média para baixo.

O teste `test_tomato_volume.py` exige que as 8 de prova fiquem dentro de 10%. Ele não exige 3% em toda caixa, porque esse número não foi alcançado.

## O que não foi aproveitado

Vale registrar o que foi medido e deixado de lado, para o próximo passo não repetir.

A foto colada na grade, olhando a parede de frente, não acompanha a altura: a correlação com a altura média foi −0,34. O plástico tapa o perfil.

A foto de cima, sozinha, também não carrega a altura. A camada de cima parece um punhado parecido de frutas em quase todo enchimento. O embedding dessa foto errou a altura em dezenas de centímetros.

Um quadro só, por cima da borda, acompanha a altura, mas quatro das 16 tangerinas de prova passaram de 10% depois da correção.

Ficar com o pixel mais alto entre dois quadros piora, porque o furo da grade mostra uma fruta acima do monte. O cruzamento das silhuetas encontra o ponto no ar.

Para o tomate, a mesma média da tangerina, com o raio somado, deixou uma caixa de prova 18% acima. A mediana sem o raio foi o que coube em 10% na prova. Ela não coube nas duas caixas baixas do treino.

A ordem dessas tentativas, com o número de cada uma, está em [Histórico dos experimentos](../simulacao/historico.md).

## Como conferir na tela

As fotos abaixo foram geradas neste computador e não entram no Git. Se a pasta não existir, a tela não tem o que ler.

1. Na raiz do repositório, rode `make dev`.
2. Abra `http://localhost:3001`. O livro, se estiver aberto, usa a porta 3000.
3. Em Conferir, escolha **Tomate**.
4. Na caixa, escolha o modelo com 39,2 por 28,2 por 25,7 cm. Se o cadastro estiver vazio, guarde esse modelo em Medidas primeiro. A conta dos litros usa esses números. No celular, deixe **Simulador, 35 mm**, que é a lente dessas fotos. No tomate, o quilo por litro começa no exemplo, 0,55: troque quando o lote for pesado. Continuar.
5. Em Filme, continue sem gravar.
6. Em Quadros, abra estes arquivos, nesta ordem. Cada quadro mostra o molde tracejado da boca: na foto real, a boca entra nesse molde. Cada quadro também tem **Fotografar**: a câmera abre com o molde sobre a imagem, e o que couber no molde é o que a leitura recebe.
   - Vista de cima: `sim/assets/detect/images/val/tomato-s1005.png`
   - Quadro A: `sim/assets/detect/sides/tomato/val/tomato-s1005.png`
   - Quadro B: `sim/assets/detect/sides/tomato/val/tomato-s1005-b.png`
7. Continuar. Nos quadros de teste a borda já vem nos cantos da boca; na foto com molde, ela vem no quadro cheio. Confira, ou ajuste os quatro cantos internos na ordem que a tela pede.
8. O resultado mostra a altura lida e os quilos. Nesta caixa a tela lê cerca de 13,1 cm, o que dá cerca de 8,0 kg. A leitura em Python, na mesma foto, é 12,6 cm. A diferença é a transformada de distância do navegador, que não é a do OpenCV. As duas ficam dentro de 10% da altura verdadeira, 12,7 cm.

Para a tangerina, o item é **Tangerina** e os quatro arquivos são:

- Vista de cima: `sim/assets/detect/images/val/tangerine-s5.png`
- Quadro A: `sim/assets/detect/sides/val/tangerine-s5.png`
- Quadro B: `sim/assets/detect/sides/val/tangerine-s5-b.png`
- Quadro C: `sim/assets/detect/sides/val/tangerine-s5-c.png`

O total é a reta da altura, não a quantidade de caixas do YOLO. Nesta caixa a tela lê cerca de 7,6 cm e cerca de 83 unidades. A leitura em Python, na mesma foto, é 7,6 cm. A cena tem 86 frutas.

## A camada de captura

Três números separam a foto do simulador da foto da cozinha, e os três ficam salvos no aparelho. A lente sai da ficha técnica do celular, em milímetros equivalentes: o rig guarda posições, e os raios saem da lente digitada. A boca sai da trena: comprimento, largura e altura internos. A conta dos litros e a reta das unidades usam essa boca; mais de 2% longe da boca calibrada, a tela pede a balança. O molde tracejado da tela Quadros é a projeção dessa boca nas três posições do arco. A foto real entra recortada ao meio 4:3, sem esticar, para os raios continuarem válidos.
