# A leitura que a simulação mediu

Este capítulo explica o código que produziu o erro citado no livro. Ele não é a conta de `app/lib/packing.ts`. Se você abrir a tela Conferir, não vai ver estes passos.

A ideia, nas duas frutas, é a mesma. A câmera fica acima da borda próxima e olha o monte. Uma fruta redonda aparece como um disco, e o centro do disco é a projeção do centro da fruta. Duas fotos do mesmo arco, de lugares um pouco diferentes, dão duas retas. As retas se encontram na fruta. O encontro da silhueta, aquele contorno escuro contra o fundo, cai no ar, fora da casca, e foi abandonado.

A tangerina usa três fotos e uma reta de unidades. O tomate usa duas fotos e o volume. Os números de uma não servem na outra: o raio, o deslocamento de 4,22 cm e a reta de 8,859 frutas por centímetro são da tangerina desta caixa.

![Da foto da tangerina até as unidades](leitura-tangerina.svg)

## Tangerina

O código está em `sim/detect/fruit_height.py`, `choose_lid.py` e `profile.py`.

`fruit_centers` acha um ponto por fruta visível. A máscara fica com a casca (laranja, com verde) e rejeita o plástico vermelho-escuro da caixa e o fundo cinza. Um pico da transformada de distância é o centro do disco.

`matched_points` casa o mesmo fruto nas duas fotos pela cor e pelo encontro das retas. As retas têm de passar a menos de 2 cm uma da outra, e o encontro tem de cair dentro da caixa. `matched_tops` soma um raio de 2,55 cm, porque na tangerina o encontro foi tratado como o centro e a tampa é a casca de cima.

Há um terceiro quadro, do outro lado do arco e um pouco mais alto. `matched_tops_three` só aceita a fruta que aparece nos três. Quando poucas frutas concordam, elas costumam ser as mais altas, a coroa, e a média sobe.

`choose_lid.lid_cm` fica com a menor das duas médias. Se a dos três quadros está mais alta, a terceira câmera só viu a coroa, e vale a média dos dois. O deslocamento foi medido nas 64 cenas de treino e congelado antes da prova:

> **altura da tampa, em cm = −4,22 + 0,9996 × leitura**

`count_from_height` transforma essa altura em unidades. Abaixo de 5,5 cm, a tampa ainda é uma cúpula e a fórmula usa a fração de empacotamento φ = π / (3√3), cerca de 0,605, com um acréscimo de um sexto do diâmetro. Da segunda camada em diante, nas cenas desta caixa e deste diâmetro perto de 5,1 cm:

> **unidades = 15,57 + 8,859 × altura em cm**

A reta não é universal. Ela vale para esta boca, 28,2 cm por 39,2 cm, e para este calibre. Um centímetro a mais são cerca de nove tangerinas: 4% de uma caixa de 240, e perto de 10% de uma caixa de 100.

Nas 16 cenas de prova, com a altura verdadeira, a reta erra 0,7% em média. Com a altura lida das fotos, o erro absoluto médio é 2,2%, entre −6,0% e +4,5%. Nenhuma passa de 10%. Nas 64 de treino, a pior fica em 8,4%. Uma caixa, no computador, leva uma fração de segundo. O teste `test_choose_lid.py` exige que toda linha da planilha fique dentro de 10%.

## Tomate

O código está em `sim/detect/tomato_volume.py`. Ele reutiliza `matched_points`, com a máscara do tomate: vermelho claro entra, vermelho escuro da caixa fica de fora. Verde de tomate verde também entra, porque a casca não é cinza.

O tomate não soma o raio da tangerina. O encontro das retas já cai perto da casca, e somar 2,55 cm levanta o monte inteiro. A leitura também não é a média. A média sobe com um cruzamento falso lá em cima, por exemplo uma fruta vista pelo furo da grade.

O que entra na reta é a mediana, depois de dois cortes. Os pontos nos primeiros 3 cm dentro da parede próxima são a borda, não o monte. Um ponto mais de 6 cm acima da mediana é um cruzamento falso e sai. A mediana do que sobrou é a leitura.

Nas 32 cenas de treino a reta ficou:

> **altura da tampa, em cm = −1,09 + 0,998 × leitura**

Os litros são a base vezes essa altura. A base é 28,2 × 39,2 cm². O quilo seria esses litros vezes o quilo por litro do lote. O simulador não pesa, então o erro que ele publica é o erro do litro, no caso em que o quilo por litro já é conhecido.

![Da foto do tomate até os litros](leitura-tomate.svg)

Nas 8 cenas de prova o erro absoluto médio é 3,0%, entre −4,5% e +5,9%. Nenhuma passa de 10%. Cinco passam de 3%. Nas 32 de treino, duas passam de 10%: a semente 1011 em +11,5%, com a tampa em 8,8 cm, e a 1014 em +10,7%, com a tampa em 10,0 cm. Um centímetro numa tampa dessas já é cerca de 10% do volume. A mediana das frutas vistas ficou cerca de 2 cm acima da média do fundo, e o arco não mostrou o vão que puxa essa média para baixo.

O teste `test_tomato_volume.py` exige que as 8 de prova fiquem dentro de 10%. Ele não exige 3% em toda caixa, porque esse número não foi alcançado.

## O que não foi aproveitado

Vale registrar o que foi medido e deixado de lado, para o próximo passo não repetir.

A foto colada na grade, olhando a parede de frente, não acompanha a altura: a correlação com a altura média foi −0,34. O plástico tapa o perfil.

A foto de cima, sozinha, também não carrega a altura. A camada de cima parece um punhado parecido de frutas em quase todo enchimento. O embedding dessa foto errou a altura em dezenas de centímetros.

Um quadro só, por cima da borda, acompanha a altura, mas quatro das 16 tangerinas de prova passaram de 10% depois da correção.

Ficar com o pixel mais alto entre dois quadros piora, porque o furo da grade mostra uma fruta acima do monte. O cruzamento das silhuetas encontra o ponto no ar.

Para o tomate, a mesma média da tangerina, com o raio somado, deixou uma caixa de prova 18% acima. A mediana sem o raio foi o que coube em 10% na prova. Ela não coube nas duas caixas baixas do treino.
