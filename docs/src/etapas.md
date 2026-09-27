# Etapas de construção

Cada etapa abaixo termina num ponto em que vale a pena você olhar e dizer se seguimos. Trabalho miúdo (estrutura de pastas, testes da fórmula, ajustes de tela) fica dentro da etapa, sem uma parada própria.

A etapa 1 está no repositório. Nenhuma etapa pede uma ida ao mercado. Fruta de verdade só entra se um dia houver coleta para o edital. Até lá, o teste é a câmera do computador, números digitados, fotos do kit do desafio, e a simulação.

O livro da documentação usa a porta 3000. O aplicativo usa a 3001, para os dois poderem ficar abertos ao mesmo tempo.

## Stack proposta

A interface é **Next.js com App Router**, em TypeScript. No celular não existe um servidor Node, então o build do aplicativo usa export estático (`output: 'export'`). As telas da conferência são client-side. Server Actions, middleware e rotas que precisem de um servidor ficam de fora deste aplicativo.

O pacote nativo é **Capacitor** (geração atual, 7). Ele pega esse export e gera o projeto Android. É a ferramenta mantida para levar um app web a uma loja ou a um aparelho sem reescrever a interface em React Native. Tauri Mobile é mais novo, e o ecossistema de câmera e de modelo no Android ainda é mais fino. Um wrapper que abre um site publicado exigiria rede, e a decisão 7 tirou a rede da conferência.

O detector roda em **LiteRT** (o nome atual do TensorFlow Lite), num plugin nativo pequeno do Capacitor, no Android. O modelo é um YOLO nano exportado para TFLite, quantizado, numa imagem de 320 pixels, uma vez por caixa. Se a GPU do aparelho aceitar o delegate, ele usa a GPU. Se não aceitar, usa a CPU. A geometria da borda e as fórmulas de tangerina e tomate ficam em TypeScript, no próprio app. Não há API paga.

O primeiro alvo é Android, que é o aparelho de entrada da cozinha. O mesmo projeto Capacitor consegue gerar iOS depois, se a banca pedir.

## O que já dá para fazer sem visita

Dá para construir a jornada, a escolha de quadros, as fórmulas e o encaixe do detector com coeficientes provisórios, marcados como provisórios. Comprimento de caixa, quilos por litro e passo entre camadas entram num arquivo de configuração. Trocar esses números depois não redesenha o aplicativo.

## O que não dá para pesquisar no lugar do time

| Pendência | Por que trava | Até quando o app vive sem isso |
| :--- | :--- | :--- |
| Nome da variedade | O diâmetro desta caixa sai da foto. A variedade guarda o formato: o passo da tangerina e os quilos por litro do tomate. | A tela diz “tangerina” e “tomate”. O coeficiente de formato fica provisório até a calibração, ou até a simulação. |
| Medidas internas das caixas | O centímetro da conta é o vão interno. O aplicativo tem um campo para esse vão. A lista pronta da cozinha piloto ainda depende da visita. | Dá para digitar uma caixa e usar a conta de exemplo. |
| Modelo exato do celular | A faixa já está escolhida: intermediário comum, cerca de R$ 1.000 a R$ 1.500, com uns 8 GB de RAM. Falta o aparelho concreto dessa faixa. | As etapas 1 e 2 rodam no navegador ou em qualquer Android à mão. A etapa 3 mede o tempo nesse modelo. |
| Lotes contados e pesados | A margem de erro do edital sai desse conjunto, não de um dataset público. | A etapa 4 espera essa coleta. |

O cartão de tamanho conhecido continua fora, salvo se sobrar tempo.

## Etapa 1. O celular filma

O aplicativo abre no navegador, pede a câmera e grava um arco curto. O vídeo fica na sessão e pode ser revisto na tela. Ainda não há detector. A conta desta fase usa números digitados, na tela Conta.

O que você faz, no computador, sem fruta e sem webcam:

1. Na raiz do repositório, rode `make dev`.
2. Abra `http://localhost:3001` no Chrome normal.
3. Clique em **Gravar clipe de teste**. A prévia mostra uma caixa desenhada e um quadrado laranja que anda.
4. Espere cerca de dois segundos e clique em **Parar**.
5. Dê play no replay. A caixa e o quadrado têm de aparecer de novo.
6. Abra Medidas, guarde um vão interno, e abra Conta. Os números de exemplo devem mostrar 112 unidades de tangerina. O tomate usa 0,55 kg por litro só como ilustração.

O que você me diz: se o replay mostrou a caixa, e se a conta mostrou 112 unidades.

## Etapa 2. A conferência sem detector

Entra a jornada combinada: item, modelo de caixa, arco, notas de nitidez e de luz, quadro de cima e quadro de lado, quatro toques na borda quando o retângulo não fechar, resultado com intervalo, e o pedido de peso digitado quando o intervalo não cabe em 10%. A caixa e os coeficientes são os de exemplo. O diâmetro, nesta etapa, pode ser informado ou lido de um valor fixo de exemplo, porque o detector ainda não existe.

A etapa 2 está na tela Conferir. O que você faz, ainda sem fruta e sem webcam:

1. Com `make dev` no ar, abra `http://localhost:3001`.
2. Escolha tangerina ou tomate e continue.
3. Confira o vão interno e continue.
4. Clique em **Gravar clipe de teste**, espere uns dois segundos, pare, e continue.
5. No vídeo, escolha um instante como vista de cima e outro como vista de lado. Cada botão mostra o instante, e **Pular para este quadro** volta o vídeo até ele. No clipe de teste, os dois podem ser o mesmo desenho.
6. Toque os quatro cantos internos na ordem pedida.
7. Na última tela, confira se tangerina aparece em unidades e tomate em quilos, com um intervalo. A incerteza orçada ainda pede o peso da balança.

O que você me diz: se uma pessoa da cozinha entenderia esses passos, e se a unidade de cada item ficou clara.

## Etapa 3. O detector no aparelho

O YOLO nano passa a contar a camada de cima e a medir o diâmetro mediano, uma vez, no quadro de cima. O tempo da conferência inteira é medido no celular de referência. Se esse aparelho ainda não tiver sido escolhido, a etapa para nele.

O que você faz: aponta a câmera para uma foto de caixa do kit do desafio, na tela de outro aparelho ou impressa, e olha se o detector marca a fruta de cima. Sem essa foto, a etapa não tem o que mostrar. O tempo do minuto é medido no celular de referência, quando esse aparelho estiver na mão. Você me diz se o tempo coube e se as marcas fazem sentido na foto.

## Etapa 4. O número que vai para o edital

O aplicativo passa a guardar, para cada caixa de coleta, o vídeo, o modelo, a altura medida com régua e a verdade (contagem dupla ou peso). Com o conjunto de calibração, os coeficientes deixam de ser exemplo. O conjunto congelado, de outro dia, produz a margem de erro média, o desvio padrão, o viés, a fração dentro de 10% e o percentil 90.

O que você faz: lê o roteiro na tela e diz se os campos bastam (vídeo, modelo da caixa, altura da régua, contagem ou peso). Você não pesa nada nesta validação. A coleta em si fica de fora enquanto não houver caixa real.

## Etapa 5. Simulação no computador

Por último, e só no computador com a placa de vídeo. O gerador monta caixas com uma quantidade conhecida, renderiza o arco e compara a resposta do aplicativo com essa quantidade. Serve para testar a fórmula, ajustar o passo entre camadas e treinar o detector. Não descobre o quilo por litro de um tomate real, e não roda na cozinha. O detalhe está em [Simulação no computador](simulacao.md).

O que você faz: lê as hipóteses das cenas e autoriza a noite de render. Quando o relatório sair, você olha o erro e confirma que ele está rotulado como simulação, não como fruta de cozinha.
