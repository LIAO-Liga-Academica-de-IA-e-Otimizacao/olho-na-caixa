# Como a quantidade é calculada

A câmera vê a camada de cima. O fundo da caixa fica escondido. Tudo o que está embaixo é deduzido da altura do monte e de um número que o time mede em caixas já conhecidas.

Há duas contas. A tangerina usa a primeira. O tomate usa a segunda. As duas começam do mesmo lugar: o tamanho interno da caixa e a altura até onde a fruta chega.

## O que é medido em toda caixa

Três grandezas saem da visita e do vídeo. São estas.

**A base** é o comprimento interno vezes a largura interna, ambos lidos do catálogo. Uma caixa de 50 cm por 30 cm tem base de 1500 cm². Isso equivale a 15 litros a cada 10 cm de altura, porque 1500 cm² × 10 cm = 15000 cm³ = 15 L.

**A altura do monte, h.** No quadro de lado, a parede da caixa é um retângulo cujo tamanho real já é conhecido: o comprimento da face vezes a altura da caixa. O aplicativo endereita essa parede e lê até onde a fruta sobe. Se a caixa está cheia e a fruta encosta na borda, h é a altura interna menos a coroa.

**O tamanho da peça, d.** No quadro de cima, cada fruta visível é medida em centímetros, usando a borda como régua. O valor que entra na conta é a mediana dessas medidas. Uma fruta cortada, ou uma detecção dobrada, deixa de puxar o tamanho para cima ou para baixo.

O detector é um modelo pequeno de detecção de objetos (YOLO). Nesse quadro de cima, ele só responde três coisas: quantas peças há na camada visível, qual é o diâmetro mediano, e se o que está ali é mesmo o item escolhido. Ele não conta o que está embaixo.

## Tangerina: unidades

A tangerina é redonda e grande o bastante para a camada de cima ser contada peça a peça. A camada de baixo repete essa contagem, tantas vezes quantas a altura permitir.

As frutas ficam empilhadas. A primeira camada ocupa uma altura igual ao diâmetro, porque cada fruta encosta no fundo. A camada seguinte não sobe um diâmetro inteiro: ela encaixa no vão entre as frutas de baixo. Nesse encaixe, cada andar novo sobe cerca de 0,82 diâmetros. Esse 0,82 é a estimativa inicial, tirada da física de esferas no empacotamento hexagonal. O número que o aplicativo usa no fim é o que for medido nas caixas de calibração. A estimativa inicial só vale antes da primeira pesagem e da primeira contagem.

A fórmula, em uma linha:

> **número de camadas = 1 + (h − d) / (passo × d)**

O passo começa em 0,82 e depois é substituído pelo valor calibrado. O resultado é arredondado para o inteiro mais próximo. Se ele cair longe de um inteiro, mais de um quarto de camada, a pilha está irregular ou a altura foi mal lida. Nesse caso, o aplicativo pede outro arco em vez de publicar o número.

> **unidades = frutas visíveis na camada de cima × número de camadas**

O exemplo abaixo só acompanha a conta. Os números são inventados. A caixa tem altura de monte h = 21 cm, as tangerinas têm d = 6 cm, há 28 frutas visíveis em cima, e o passo ainda está na estimativa inicial de 0,82.

O passo em centímetros é 0,82 × 6 = 4,9 cm. A altura que sobra acima da primeira camada é 21 − 6 = 15 cm. Quinze dividido por 4,9 dá 3,06 andares acima do primeiro. Somando o primeiro andar, o resultado é 4,06, que arredonda para 4 camadas. As unidades são 28 × 4 = 112.

A conta segue as camadas, e não o volume de cada esfera. O volume de uma esfera depende do diâmetro ao cubo. Errar o diâmetro em 5% erra o volume de uma fruta em cerca de 15%, e a meta desta fase é 10%. Na conta por camadas, o diâmetro só define a distância entre andares, e esse efeito é linear.

O valor clássico 0,64, chamado de *random close packing*, é a fração do espaço que esferas iguais ocupam quando são jogadas ao acaso num volume enorme. Esse valor não é o resultado da conta. Ele serve de saneamento: o volume de todas as tangerinas estimadas, dividido pelo volume do monte, tem que cair numa faixa plausível, perto de 0,55 a 0,64 numa caixa de verdade. Se a fração cair muito fora dessa faixa, a contagem e a altura discordam, e a caixa é marcada.

## Tomate: quilos

Tomate pequeno, muito junto, conta mal uma a uma. A conta usada é a da densidade aparente: quantos quilos cabem em um litro daquele monte, incluindo o ar entre as frutas.

> **quilos = litros do monte × quilos por litro**

Os litros do monte são a base vezes a altura. No exemplo de 50 cm × 30 cm × 20 cm de altura, o monte tem 30 litros. Se o lote do time tiver dado 0,55 kg por litro, a caixa pesa 16,5 kg. O 0,55 deste parágrafo é ilustração. O número verdadeiro é a média das caixas pesadas na calibração, da variedade que a cozinha recebe, e de mais nenhuma outra.

Quilos por litro já embute polpa, ar e fruta amassada. A conta usa esse número medido no lote. Ela não multiplica a densidade da água por uma fração de empacotamento tirada de livro.

No tomate, o detector não é quem dá o peso. Ele confirma que o conteúdo é tomate, mede o calibre mediano (para escolher a linha da tabela, se um dia houver mais de uma variedade) e recusa caixa misturada ou com um buraco grande na camada de cima.

## Quando a balança entra

As duas contas acima rodam sempre. Cada uma sai com um intervalo. Se o intervalo da tangerina não cabe em 10%, ou se o do tomate não cabe em 10%, o operador digita o peso. Esse peso substitui a estimativa de quilos do tomate. Para a tangerina, o peso digitado só vira unidades se já existir a massa média de uma fruta daquele lote, medida na calibração: o peso total dividido pela contagem de uma amostra. Sem essa massa média, o aplicativo mantém a contagem da foto e marca a caixa como incerta.

Uma caixa acima do limite da balança permanece inteira. A estimativa que fica registrada é a da foto.

## Banana e cenoura, para quando existirem

Banana e cenoura não fazem parte desta fase. A conta já está combinada, para o time não reinventá-la depois.

A banana, em unidades de dedo, usa três fatores. O primeiro é o número de pencas visíveis na camada de cima. O segundo é a média de dedos dessas pencas, medida nelas, e não numa tabela genérica da variedade. O terceiro é quantas camadas de penca cabem na altura. A espessura de uma penca é medida no lote.

A cenoura, em quilos, usa a mesma conta do tomate. Cenoura fina e cenoura grossa não compartilham o mesmo quilo por litro, porque o ar entre as peças muda. Essa distinção só passa a importar se a cenoura entrar no escopo.

## De onde vem cada número

| Número | Onde nasce | Pode vir de um valor de livro? |
| :--- | :--- | :--- |
| Comprimento, largura e altura da caixa | Na trena, no vão interno, uma vez por modelo | Não pode |
| Altura do monte | No quadro de lado, ou na altura interna quando a caixa está cheia até a borda | Não pode |
| Frutas no topo e diâmetro | No quadro de cima, com o detector | Não pode |
| Passo entre camadas | Nas caixas contadas à mão na calibração. A estimativa inicial, antes dessa contagem, é 0,82 | Só antes da primeira calibração |
| Quilos por litro | Nas caixas pesadas na calibração | Não pode |
| Dedos por penca e espessura da penca | No lote de banana, se a fase seguinte abrir | Não pode |
