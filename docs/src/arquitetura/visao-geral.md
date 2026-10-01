# Arquitetura do repositório

Este capítulo é o mapa para quem chega no código. Ele diz onde cada coisa mora, o que já roda no celular (ou no navegador que imita o celular), e o que só existe no computador da simulação.

Se você quer saber se já dá para abrir o aplicativo e conferir o erro novo da tangerina ou do tomate, a resposta é não. Esse erro foi medido no simulador. A tela Conferir ainda não chama essa leitura.

![Dois programas que ainda não se falam](dois-programas.svg)

## O que cada pasta é

O repositório tem três lugares grandes, e cada um tem um trabalho só.

**`app/`** é o aplicativo. É o que o operador vai usar. As telas estão em `app/app/`. A conta que a tela executa hoje está em `app/lib/packing.ts`. A marca da fruta, por enquanto, é a cor da casca, em `app/lib/top-layer.ts`. Você sobe isso com `make dev` e abre `http://localhost:3001`.

**`sim/`** é o simulador. O Blender assenta frutas numa caixa de plástico, tira fotos e grava a verdade (quantas frutas ficaram dentro, qual a altura média da tampa). O Python em `sim/detect/` lê essas fotos e compara com a verdade. É aqui que estão os 2,2% da tangerina e os 3,0% dos litros do tomate. Nada disso é importado pelo aplicativo.

**`docs/`** é este livro. Ele descreve o método. Quando o livro e o código discordam sobre o desafio, vale o enunciado de fora do repositório. Quando discordam sobre o método que o time escolheu, vale este livro.

Há ainda `scripts/` para abrir o Chrome com uma câmera falsa, e o `Makefile` na raiz, que é a lista curta de comandos. Se um comando não está no `make help`, ele não é o caminho de todos os dias.

## O que você pode testar hoje no aplicativo

O aplicativo já percorre a jornada da cozinha com um clipe desenhado, sem fruta de verdade. O roteiro está em [Etapas de construção](../etapas.md). Em resumo:

1. `make dev`, e o endereço `http://localhost:3001`.
2. Em Conferir, grave o clipe de teste, marque os quatro cantos e veja os anéis na casca laranja.
3. Em Conta, os números de exemplo devem mostrar 112 unidades de tangerina. Esse 112 sai da conta de camadas, não da leitura nova.

O que esse teste não mede: a altura pelos centros das frutas, a reta das unidades e os litros do tomate. Esses três moram no simulador.

## O que a simulação já mediu

A tangerina, no simulador, com o protocolo dos três quadros, ficou com erro absoluto médio de 2,2% nas 16 caixas de prova, e nenhuma passou de 10%. O tomate, nos litros, ficou com erro absoluto médio de 3,0% nas 8 caixas de prova, e nenhuma passou de 10%. Cinco dessas oito passaram de 3%. Duas caixas de treino, com a tampa perto de 9 cm e de 10 cm, passaram de 10%. O detalhe de cada número está em [A leitura que a simulação mediu](leitura.md) e em [Simulação no computador](../simulacao.md).

Esses números são erro de simulação. Não são a margem da cozinha, e não aparecem na tela.

## Como as duas contas convivem

O capítulo [Como a quantidade é calculada](../calculo.md) descreve a conta que o aplicativo executa: camadas para a tangerina, litros vezes quilo por litro para o tomate. A simulação, depois, mediu a altura de outro jeito e, para a tangerina, trocou a conta de camadas por uma reta. Essa reta não substituiu `packing.ts`. Até alguém ligar as duas, o livro precisa das duas descrições, e este capítulo diz qual código é qual.

O quilo por litro do tomate continua sendo um número do lote, digitado depois de uma pesagem. Nem o aplicativo nem o simulador descobrem esse número numa foto.
