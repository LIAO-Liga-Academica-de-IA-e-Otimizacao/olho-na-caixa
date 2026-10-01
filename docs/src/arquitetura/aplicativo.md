# O aplicativo

O aplicativo é um site estático. No celular não haverá um servidor Node ao lado da câmera. Por isso o build usa export estático, e as telas que filmam e que contam rodam no próprio navegador. Server Actions ficam de fora. A decisão está em [Etapas de construção](../etapas.md), na seção da stack.

Hoje você usa o modo de desenvolvimento (`make dev`, porta 3001). O pacote Capacitor, que gera o projeto Android, está previsto e ainda não é o caminho do dia a dia.

## As telas

O menu fica em `app/components/Shell.tsx`. São quatro entradas.

**Conferir** (`app/app/page.tsx`) abre `Conference`. É a jornada: escolher tangerina ou tomate, confirmar o vão da caixa, gravar um arco curto, escolher o quadro de cima e o de lado, tocar os quatro cantos internos e ver o resultado. No clipe de teste não há fruta. Há uma caixa desenhada e círculos laranja, para a marca pela cor ter o que pegar.

**Medidas** (`app/app/medidas/page.tsx`) guarda o vão interno que alguém mediu com trena. Comprimento, largura e altura. Esse vão é a régua. A foto não inventa o centímetro da caixa.

**Conta** (`app/app/conta/page.tsx`) mostra a conta com números de exemplo, sem foto. É o lugar para ver a fórmula antiga sozinha. O exemplo da tangerina dá 112 unidades: 28 frutas visíveis, diâmetro 6 cm, altura de monte 21 cm, passo 0,82. A conta está no capítulo [Como a quantidade é calculada](../calculo.md).

**Coleta** (`app/app/coleta/page.tsx`) é o caderno dos lotes. O quilo por litro do tomate, quando existir, entra por uma pesagem do lote, não por uma rede neural.

**Simulação** (`app/app/simulacao/page.tsx`) não está no menu. É uma página de texto sobre o que o computador já rodou. Ela não executa o Blender e não mostra o erro ao vivo.

## O que cada arquivo de `app/lib/` faz

A pasta `app/lib/` é a conta e o estado, separados da tela. A tela chama essas funções. Ela não reimplementa a fórmula.

`packing.ts` é a conta que a tela usa hoje. `tangerineCount` multiplica as frutas visíveis pelo número de camadas. `tomatoMassKg` multiplica os litros pelo quilo por litro. `fitsTolerance` diz se o intervalo cabe em 10%. Nenhuma dessas funções lê pixel.

`top-layer.ts` marca a camada de cima pela cor. Laranja conta como tangerina. Vermelho conta como tomate. É um encaixe, para a jornada existir antes do modelo no aparelho. O clipe de teste foi desenhado para essa marca.

`detections.ts` é o encaixe do YOLO, para o dia em que o modelo rodar no aparelho. Ele recebe caixas no formato do YOLO (centro e tamanho, em fração da imagem), fica com as que passam de 0,55 de confiança, e suprime caixas sobrepostas com IoU 0,45. Esse ponto de corte foi escolhido nas fotos de prova do simulador. A função devolve o mesmo tipo de registro que a marca pela cor, para a tela não precisar de dois caminhos.

`homography.ts` endereça a boca da caixa. Quatro cantos na imagem, mais o comprimento e a largura em centímetros, viram uma função que leva um pixel ao plano da boca. É a régua do diâmetro.

`frame-quality.ts` olha um quadro e diz se ele está escuro, estourado ou torto demais para entrar na conta. O aplicativo percorre o vídeo por causa disso. O detector, quando existir no aparelho, não roda em todo quadro.

`crate-store.ts` e `lots.ts` guardam a caixa e os lotes no `localStorage` do navegador. Não há banco. Fechar a aba no modo de teste pode perder o que não foi o foco da tela, conforme cada página grava.

`report.ts` monta o texto do resultado: unidades ou quilos, o intervalo, e se a caixa fica incerta.

## O que a tela não faz

A tela não assenta frutas, não treina modelo e não lê a altura pelos centros. Quando a Conferir mostra um número, esse número saiu de `packing.ts` com a altura e o diâmetro que a jornada tinha naquele momento. No clipe de teste, a altura não é a altura de um monte de verdade.

O modelo treinado no simulador está em `sim/assets/detect/top-layer.pt`. O aplicativo não carrega esse arquivo. Ligar os dois é um passo futuro: exportar o YOLO para o formato do celular e chamar `layerFromDetections` no lugar da cor. A leitura de altura do arco é outro passo, separado, e também ainda não está em TypeScript.
