# Como a quantidade é calculada

A câmera vê a camada de cima. O fundo da caixa ela não vê. Tudo que está escondido é deduzido da altura do monte e de um número que vocês medem em caixas já conhecidas.

Há duas contas. Tangerina usa a primeira. Tomate usa a segunda. As duas começam do mesmo lugar: o tamanho interno da caixa e a altura até onde a fruta chega.

## O que é medido em toda caixa

Três grandezas, e só estas, saem da visita e do vídeo.

**A base.** Comprimento interno vezes largura interna, lidos do catálogo. Uma caixa de 50 cm por 30 cm tem base de 1500 cm². Isso é 15 litros a cada 10 cm de altura, porque 1500 cm² × 10 cm = 15000 cm³ = 15 L.

**A altura do monte, h.** No quadro de lado, a parede da caixa é um retângulo cujo tamanho real já é conhecido (comprimento da face × altura da caixa). O app endereita essa parede e lê até onde a fruta sobe. Se a caixa está cheia e encosta na borda, h é a altura interna menos a coroa.

**O tamanho da peça, d.** No quadro de cima, cada fruta visível é medida em centímetros, usando a borda como régua. O valor que entra na conta é a mediana, não a maior nem a menor. A mediana segura uma fruta cortada ou uma detecção dobrada.

O detector (um YOLO pequeno) só responde, nesse quadro de cima: quantas peças há na camada visível, qual o diâmetro mediano, e se o que está ali é mesmo o item escolhido. Ele não conta o que está embaixo.

## Tangerina: unidades

A tangerina é redonda e grande o bastante para a camada de cima ser contada peça a peça. A camada de baixo repete essa contagem, tantas vezes quantas a altura permitir.

Imagine as frutas empilhadas. A primeira camada ocupa uma altura igual ao diâmetro, porque cada fruta encosta no fundo. A camada seguinte não sobe um diâmetro inteiro: ela encaixa no vão entre as de baixo. Nesse encaixe, cada andar novo sobe cerca de 0,82 diâmetros. Esse 0,82 é o chute da física de esferas (empacotamento hexagonal). O número que o app usa no fim é o que for medido nas caixas de calibração. O chute só existe antes da primeira pesagem e da primeira contagem.

A fórmula, em uma linha:

> **número de camadas = 1 + (h − d) / (passo × d)**

O passo começa em 0,82 e depois é substituído pelo valor calibrado. O resultado é arredondado para o inteiro mais próximo. Se ele cair longe de um inteiro (mais de um quarto de camada), a pilha está irregular ou a altura foi mal lida: o app pede outro arco em vez de publicar o número.

> **unidades = frutas visíveis na camada de cima × número de camadas**

Exemplo só para acompanhar a conta, com números inventados. Caixa com altura de monte h = 21 cm, tangerinas com d = 6 cm, 28 frutas visíveis em cima, passo ainda no chute 0,82.

O passo em centímetros é 0,82 × 6 = 4,9 cm. A altura que sobra acima da primeira camada é 21 − 6 = 15 cm. Quinze dividido por 4,9 dá 3,06 andares acima do primeiro. Somando o primeiro: 4,06, que arredonda para 4 camadas. Unidades: 28 × 4 = 112.

Por que não dividir o volume da caixa pelo volume de uma esfera? Porque o volume da esfera depende do diâmetro ao cubo. Errar o diâmetro em 5% erra o volume de uma fruta em cerca de 15%, e a meta é 10%. Na conta por camadas, o diâmetro só define a distância entre andares, e esse efeito é linear.

O 0,64 clássico de “random close packing” (a fração do espaço que esferas iguais ocupam quando jogadas ao acaso num volume enorme) não é o resultado. Ele serve de saneamento: o volume de todas as tangerinas estimadas, dividido pelo volume do monte, tem que cair numa faixa plausível, perto de 0,55 a 0,64 numa caixa de verdade. Se cair muito fora, a contagem e a altura estão brigando, e a caixa é marcada.

## Tomate: quilos

Tomate pequeno, muito junto, conta mal uma a uma. A conta boa é de densidade aparente: quantos quilos cabem em um litro daquele monte, incluindo o ar entre as frutas.

> **quilos = litros do monte × quilos por litro**

Os litros do monte são a base vezes a altura. No exemplo de 50 cm × 30 cm × 20 cm de altura: 30 litros. Se o lote de vocês tiver dado 0,55 kg por litro, a caixa pesa 16,5 kg. O 0,55 deste parágrafo é ilustração. O número verdadeiro é a média das caixas pesadas na calibração, da variedade que a cozinha recebe, e de mais nenhuma.

Quilos por litro já embute polpa, ar e fruta amassada. Não se multiplica “densidade da água” por uma fração de empacotamento tirada de livro.

O detector, no tomate, não é quem dá o peso. Ele confirma que é tomate, mede o calibre mediano (para escolher a linha da tabela, se um dia houver mais de uma variedade) e recusa caixa misturada ou com um buraco grande na camada de cima.

## Quando a balança entra

As duas contas acima rodam sempre. Cada uma sai com um intervalo. Se o intervalo da tangerina não cabe em 10%, ou o do tomate não cabe em 10%, o operador digita o peso. Esse peso substitui a estimativa de quilos do tomate. Para a tangerina, o peso digitado só vira unidades se já existir a massa média de uma fruta daquele lote, medida na calibração (peso total dividido pela contagem de uma amostra). Sem essa massa média, o app não inventa a conversão: mantém a contagem da foto e marca a caixa como incerta.

Caixa acima do limite da balança não é fracionada. Fica a estimativa da foto.

## Banana e cenoura, para quando existirem

Não fazem parte desta fase. A conta já está combinada, para não reinventar depois.

Banana, em unidades de dedo: pencas visíveis na camada de cima, vezes a média de dedos dessas pencas (medida nelas, não numa tabela genérica da variedade), vezes quantas camadas de penca cabem na altura. A espessura de uma penca é medida no lote.

Cenoura, em quilos: a mesma conta do tomate. Cenoura fina e cenoura grossa não compartilham o mesmo quilo por litro, porque o ar entre as peças muda. Isso só passa a importar se a cenoura entrar no escopo.

## De onde vem cada número

| Número | Nasce onde | Pode ser chute de livro? |
| :--- | :--- | :--- |
| Comprimento, largura, altura da caixa | Trena, vão interno, uma vez por modelo | Não |
| Altura do monte | Quadro de lado, ou caixa cheia até a borda | Não |
| Frutas no topo, diâmetro | Quadro de cima + detector | Não |
| Passo entre camadas | Caixas contadas à mão na calibração. Chute inicial: 0,82 | Só antes da primeira calibração |
| Quilos por litro | Caixas pesadas na calibração | Não |
| Dedos por penca e espessura da penca | Lote de banana, se a fase seguinte abrir | Não |
