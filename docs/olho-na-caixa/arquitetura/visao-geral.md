# Arquitetura do repositório

Este capítulo é o mapa para quem chega no código. Ele diz onde cada coisa mora, o que já roda no celular (ou no navegador que imita o celular), e o que só existe no computador da simulação.

A tela Conferir lê a altura quando você abre as fotos do protocolo (os quadros A, B e, na tangerina, C). O erro de 2,2% e o de 3,0% foram medidos nessas fotos do simulador. Um vídeo qualquer não traz as três câmeras calibradas e não reproduz esse erro.

![A altura do arco está nos dois programas. O YOLO da camada de cima também.](dois-programas.svg)

## O que cada pasta é

O repositório tem três lugares grandes, e cada um tem um trabalho só.

**`app/`** é o aplicativo. É o que o operador vai usar. As telas estão em `app/app/`. A conta que a tela executa hoje está em `app/lib/packing.ts`. As caixas da camada de cima saem do YOLO, em `app/lib/yolo-detect.ts`. Você sobe isso com `make dev` e abre `http://localhost:3001`.

**`sim/`** é o simulador. O Blender assenta frutas numa caixa de plástico, tira fotos e grava a verdade (quantas frutas ficaram dentro, qual a altura média da tampa). O Python em `sim/detect/` lê essas fotos e compara com a verdade. É aqui que estão os 2,2% da tangerina e os 3,0% dos litros do tomate. A mesma leitura, em TypeScript, está em `app/lib/arc-height.ts` e é o que a Conferir chama quando recebe esses quadros.

**`docs/`** é este livro. Ele descreve o método. Quando o livro e o código discordam sobre o desafio, vale o enunciado de fora do repositório. Quando discordam sobre o método que o time escolheu, vale este livro.

Há ainda `scripts/` para abrir o Chrome com uma câmera falsa, e o `Makefile` na raiz, que é a lista curta de comandos. Se um comando não está no `make help`, ele não é o caminho de todos os dias.

## O que você pode testar hoje no aplicativo

O aplicativo já percorre a jornada da cozinha sem fruta de verdade, com fotos do simulador. O roteiro está em [Etapas de construção](../etapas.md). Em resumo:

1. `make dev`, e o endereço `http://localhost:3001`.
2. Em Medidas, guarde um modelo de caixa. Em Conferir, escolha o modelo, abra os quadros e confira a borda para ver as caixas do YOLO.
3. Em Conta, os números de exemplo devem mostrar 112 unidades de tangerina. Esse 112 sai da conta de camadas, não da leitura nova.

Para medir a altura, abra as fotos do protocolo na etapa Quadros. O roteiro exato está no fim de [A leitura que a simulação mediu](leitura.md).

## O que a simulação já mediu

A tangerina, no simulador, com o protocolo dos três quadros, ficou com erro absoluto médio de 2,2% nas 16 caixas de prova, e nenhuma passou de 10%. O tomate, nos litros, ficou com erro absoluto médio de 3,0% nas 8 caixas de prova, e nenhuma passou de 10%. Cinco dessas oito passaram de 3%. Duas caixas de treino, com a tampa perto de 9 cm e de 10 cm, passaram de 10%. O detalhe de cada número está em [A leitura que a simulação mediu](leitura.md) e em [Simulação no computador](../simulacao.md).

Esses números são erro de simulação. Não são a margem da cozinha. A tela mostra o intervalo orçado no livro, e ao lado lembra estes dois erros.

## Como as duas contas convivem

O capítulo [Como a quantidade é calculada](../calculo.md) descreve a conta de camadas, que a página Conta ainda executa em `packing.ts`. A Conferir, quando recebe os quadros do arco, usa a reta da tangerina e a mediana do tomate, em `arc-height.ts`. As duas contas continuam no livro porque servem a telas diferentes.

O quilo por litro do tomate continua sendo um número do lote, digitado depois de uma pesagem. Nem o aplicativo nem o simulador descobrem esse número numa foto.
