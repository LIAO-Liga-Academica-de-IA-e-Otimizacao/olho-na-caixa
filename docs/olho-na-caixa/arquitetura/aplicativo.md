# O aplicativo

O aplicativo é um site estático. No celular não haverá um servidor Node ao lado da câmera. Por isso o build usa export estático, e as telas que filmam e que contam rodam no próprio navegador. Server Actions ficam de fora. A decisão está em [Etapas de construção](../etapas.md), na seção da stack.

Hoje você usa o modo de desenvolvimento (`make dev`, porta 3001). O pacote Capacitor, que gera o projeto Android, está previsto e ainda não é o caminho do dia a dia.

## As telas

O menu fica em `app/components/Shell.tsx`. São quatro entradas.

**Conferir** (`app/app/page.tsx`) abre `Conference`. É a jornada: escolher tangerina ou tomate, escolher o modelo da caixa no cadastro, fotografar a vista de cima e os quadros do arco com os moldes, conferir a borda e ver o resultado.

**Medidas** (`app/app/medidas/page.tsx`) guarda o cadastro de caixas: cada modelo com o vão interno medido com trena, comprimento, largura e altura. A Conferir e a Conta usam a caixa marcada como em uso. Esse vão é a régua. A foto não inventa o centímetro da caixa.

**Conta** (`app/app/conta/page.tsx`) mostra a conta com números de exemplo, sem foto. É o lugar para ver a fórmula antiga sozinha. O exemplo da tangerina dá 112 unidades: 28 frutas visíveis, diâmetro 6 cm, altura de monte 21 cm, passo 0,82. A conta está no capítulo [Como a quantidade é calculada](../calculo.md).

**Coleta** (`app/app/coleta/page.tsx`) é o caderno dos lotes. O quilo por litro do tomate, quando existir, entra por uma pesagem do lote, não por uma rede neural.

**Simulação** (`app/app/simulacao/page.tsx`) não está no menu. É uma página de texto sobre o que o computador já rodou. Ela não executa o Blender e não mostra o erro ao vivo.

## O que cada arquivo de `app/lib/` faz

A pasta `app/lib/` é a conta e o estado, separados da tela. A tela chama essas funções. Ela não reimplementa a fórmula.

`packing.ts` é a conta que a tela usa hoje. `tangerineCount` multiplica as frutas visíveis pelo número de camadas. `massFromLiters` multiplica os litros pelo quilo por litro: o tomate chama essa função, e a cenoura vai chamar a mesma, com o quilo por litro do lote dela. `bananaFingers` multiplica pencas, dedos por penca e camadas de penca, e marca a estimativa como fora desta fase para a tela não publicar. `fitsTolerance` diz se o intervalo cabe em 10%. Nenhuma dessas funções lê pixel. O catálogo de qual item usa qual conta está em `produce.ts`. A tela Conferir continua oferecendo só tangerina e tomate.

`top-layer.ts` ainda tem a marca pela cor. A Conferir não a usa. Ela ficou para o teste que compara a cor com o modelo.

`yolo-detect.ts` carrega `app/public/models/top-layer.onnx`, o mesmo peso de `sim/assets/detect/top-layer.pt`. A foto vai para um quadrado de 320 pixels, com margem 114, e as caixas voltam para a foto original. `detections.ts` fica com as que passam de 0,55 de confiança e suprime caixas sobrepostas com IoU 0,45. Esse ponto de corte foi escolhido nas fotos de prova do simulador. O notebook `sim/ver-yolo.ipynb` continua sendo o caminho no Python.

`homography.ts` endereça a boca da caixa. Quatro cantos na imagem, mais o comprimento e a largura em centímetros, viram uma função que leva um pixel ao plano da boca. É a régua do diâmetro.

`frame-quality.ts` olha um quadro e diz se ele está escuro, estourado ou torto demais para entrar na conta. O aplicativo percorre o vídeo por causa disso. O detector, quando existir no aparelho, não roda em todo quadro.

`crate-store.ts` guarda o cadastro de caixas (os modelos e qual está em uso) e `lots.ts` guarda os lotes, no `localStorage` do navegador. Não há banco. O que ainda não foi guardado se perde se a aba fechar.

`report.ts` monta o texto do resultado: unidades ou quilos, o intervalo, e se a caixa fica incerta.

## O que a tela não faz

A tela não assenta frutas e não treina modelo. A Conferir lê a altura em `arc-height.ts` quando você abre os quadros do protocolo. A página Conta continua na conta de camadas de `packing.ts`.

O modelo treinado no simulador está em `sim/assets/detect/top-layer.pt`. A Conferir carrega a exportação ONNX desse arquivo, em `app/public/models/top-layer.onnx`. O formato do celular (LiteRT) ainda não é este.
