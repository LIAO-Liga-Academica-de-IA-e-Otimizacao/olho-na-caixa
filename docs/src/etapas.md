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

O quadro de cima recebe marcas uma vez, dentro da borda. Por enquanto a marca é a cor da casca: laranja conta como tangerina, vermelho como tomate. O diâmetro mediano dessas marcas usa a borda como régua e entra na conta. O YOLO nano ainda não está no aparelho. A cor é o encaixe, para a marca aparecer antes do modelo. O tempo da passagem aparece na última tela, medido neste computador. O minuto oficial continua esperando o celular de referência, que ainda não foi escolhido.

O clipe de teste agora tem círculos laranja dentro da caixa marrom, para as marcas terem o que pegar sem a foto do kit.

O que você faz, sem a foto do kit e sem webcam:

1. Com `make dev` no ar, percorra Conferir até o quadro de cima. Grave o clipe de teste e escolha um instante em que os círculos laranja estejam dentro da caixa.
2. Marque os quatro cantos da caixa marrom, não o fundo bege.
3. Na última tela, cada círculo dentro da borda deve ganhar um anel. A contagem e o diâmetro mediano devem seguir esses anéis. O quadrado laranja que anda fora da caixa não entra.
4. Volte, escolha tomate, e percorra de novo. A tela deve dizer que não há tomate dentro da borda.

O que você me diz: se os anéis caíram nos círculos, e se a contagem ficou igual ao que você viu. A foto do kit, quando existir, entra no mesmo lugar do clipe. O minuto no celular de referência fica para quando esse aparelho estiver escolhido.

## Etapa 4. O número que vai para o edital

A tela Coleta guarda a ficha de cada caixa: vídeo, modelo, altura da régua e a verdade. Na tangerina a verdade é a contagem dupla. No tomate, é o peso. O conjunto de calibração é o que um dia troca o passo e os quilos por litro. O conjunto congelado, de outro dia, produz o viés, a margem de erro média, o desvio padrão, a fração dentro de 10% e o percentil 90. Sem caixa real, a lista fica vazia e o número do edital não existe. Uma ilustração com erros inventados mostra as cinco linhas, rotulada como ilustração.

O que você faz, sem pesar nada:

1. Com `make dev` no ar, abra `http://localhost:3001/coleta/`.
2. Leia a ficha. Os campos são item, papel da caixa, modelo, variedade, altura da régua, vídeo, duas contagens na tangerina e peso no tomate.
3. Confira que a tela diz que não há caixa congelada e que o número do edital ainda não existe.
4. A ilustração do relatório não é fruta de cozinha.

O que você me diz: se esses campos bastam para uma coleta futura. A coleta em si fica de fora enquanto não houver caixa real.

## Etapa 5. Simulação no computador

Por último, e só no computador com a placa de vídeo. O gerador monta caixas com uma quantidade conhecida, renderiza o arco e compara a resposta do aplicativo com essa quantidade. Serve para testar a fórmula, ajustar o passo entre camadas e treinar o detector. Não descobre o quilo por litro de um tomate real, e não roda na cozinha. O detalhe está em [Simulação no computador](simulacao.md).

A tela Simulação lista as hipóteses para autorização: 20 cenas fáceis, 300 cenas no laço do passo, a leva que imita a cozinha, e o Isaac Sim como gerador proposto. Nenhuma cena foi renderizada.

O que você faz, antes de qualquer noite de placa de vídeo:

1. Com `make dev` no ar, abra `http://localhost:3001/simulacao/`. O caminho também está no fim da ficha, em Coleta.
2. Leia a leva 1, os dois laços e a leva 2.
3. Confira que a tela diz que nenhuma cena foi renderizada, e que a frase do relatório recusa usar esse erro como erro de cozinha.

O que você me diz: se autoriza a noite com essas hipóteses, e se o gerador é o Isaac Sim. Sem essa autorização, a renderização não começa.
