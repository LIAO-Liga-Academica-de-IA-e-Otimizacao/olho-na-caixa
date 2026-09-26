# Etapas de construção

Cada etapa abaixo termina num ponto em que vale a pena você olhar e dizer se seguimos. Trabalho miúdo (estrutura de pastas, testes da fórmula, ajustes de tela) fica dentro da etapa, sem uma parada própria.

A etapa 1 está no repositório. Na raiz, `make dev` abre o aplicativo em `http://localhost:3001`. A tela Filmar é o que esta etapa pede para validar. As telas Medidas e Conta já existem, com números digitados, para a fórmula poder ser olhada antes da validação da jornada.

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

O que você valida: o aplicativo instala no seu celular, a câmera abre, e o vídeo fica utilizável. Se a câmera dentro da WebView falhar, esta etapa troca o plugin de captura antes de qualquer conta.

## Etapa 2. A conferência sem detector

Entra a jornada combinada: item, modelo de caixa, arco, notas de nitidez e de luz, quadro de cima e quadro de lado, quatro toques na borda quando o retângulo não fechar, resultado com intervalo, e o pedido de peso digitado quando o intervalo não cabe em 10%. A caixa e os coeficientes são os de exemplo. O diâmetro, nesta etapa, pode ser informado ou lido de um valor fixo de exemplo, porque o detector ainda não existe.

O que você valida: se uma pessoa da cozinha entenderia os passos, e se a tela de resultado mostra a unidade certa (unidades de tangerina, quilos de tomate) com uma incerteza legível.

## Etapa 3. O detector no aparelho

O YOLO nano passa a contar a camada de cima e a medir o diâmetro mediano, uma vez, no quadro de cima. O tempo da conferência inteira é medido no celular de referência. Se esse aparelho ainda não tiver sido escolhido, a etapa para nele.

O que você valida: se o tempo cabe no minuto e se as caixas desenhadas em volta da fruta fazem sentido numa caixa real, mesmo antes da calibração fina.

## Etapa 4. O número que vai para o edital

O aplicativo passa a guardar, para cada caixa de coleta, o vídeo, o modelo, a altura medida com régua e a verdade (contagem dupla ou peso). Com o conjunto de calibração, os coeficientes deixam de ser exemplo. O conjunto congelado, de outro dia, produz a margem de erro média, o desvio padrão, o viés, a fração dentro de 10% e o percentil 90.

O que você valida: o roteiro da coleta, antes de pesar as 30 caixas. Sem essa visita e sem essa balança, esta etapa não começa.

## Etapa 5. Simulação no computador

Por último, e só no computador com a placa de vídeo. O gerador monta caixas com uma quantidade conhecida, renderiza o arco e compara a resposta do aplicativo com essa quantidade. Serve para testar a fórmula, ajustar o passo entre camadas e treinar o detector. Não descobre o quilo por litro de um tomate real, e não roda na cozinha. O detalhe está em [Simulação no computador](simulacao.md).

O que você valida: as hipóteses das cenas, antes de gastar uma noite de render. O erro dessa etapa não entra no relatório como se fosse erro de fruta.
