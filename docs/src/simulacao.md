# Simulação no computador

Esta etapa vem por último. Ela não entra na conferência da cozinha. O celular continua calculando a partir do vídeo, sem física 3D. A placa de vídeo do computador gera caixas cuja quantidade já é conhecida, porque a cena foi montada aqui, e o mesmo cálculo do celular é testado nessas imagens.

## Para que serve

Cada cena tem uma verdade anotada na hora em que é criada: tantas tangerinas, ou tantos quilos de tomate. O aplicativo não recebe essa lista. Ele recebe fotos renderizadas, no mesmo tipo de arco que o operador filma. A diferença entre a resposta do aplicativo e a verdade da cena é o erro.

Há dois laços separados.

O primeiro ajusta um número só: o passo entre as camadas da tangerina. Cada cena sorteia o tamanho da caixa, a altura do monte e o diâmetro das frutas. O gerador guarda a contagem. O aplicativo olha a imagem e devolve outra contagem. O passo muda para essa diferença diminuir. Isso é uma regressão. Algumas centenas de cenas bastam.

O segundo treina o detector. As mesmas cenas viram fotos com luz, desfoque e fundo variados, e o modelo aprende a marcar a fruta de cima. Aqui a placa de vídeo trabalha de verdade.

Os dois laços passam pela imagem renderizada. Comparar a fórmula com a lista interna de objetos, sem foto, só verifica a álgebra. O aplicativo da cozinha nunca vê essa lista.

## O que a cena não descobre

O quilo por litro do tomate, dentro do simulador, é o valor atribuído a cada fruta na hora de montar a cena. O laço mede se o aplicativo acertou os litros do monte. A massa de um tomate real não aparece do nada: ela foi digitada.

O formato funciona do mesmo modo. Uma tangerina achatada só entra no teste se o modelo tridimensional for achatado. O passo calibrado nessa cena fica marcado como coeficiente de simulação. No aplicativo, ele é provisório até existir uma caixa real.

Esferas perfeitas, empilhadas do jeito que a fórmula já supõe, fazem o erro cair perto de zero. Esse resultado confirma que o código da fórmula está íntegro. Ele não descreve uma caixa de cozinha.

## Como as cenas são feitas

Os meshes ficam em `sim/assets/`: uma tangerina, um tomate, as caixas vazias e a caixa já cheia de referência. O gerador proposto para a noite é o Isaac Sim, porque a placa disponível é NVIDIA. O Blender com corpo rígido continua válido se o Isaac não estiver instalado. Não há um motor de física escrito para este projeto. A noite das 20 cenas, e a das 300, não começa sem autorização.

## O que as fotos de prova já mostram

Antes dessa noite, o computador gera fotos para uma pessoa olhar. Elas não entram no erro do relatório, e os PNG não entram no git: cada cena pesa alguns megabytes e a noite inteira não cabe no repositório. O `.txt` ao lado fica versionado. Ele guarda a quantidade e a altura. O Cycles usa a GPU por OptiX, na RTX 4060. Cada caixa de prova tem duas fotos, as mesmas duas vistas do arco: de cima e de lado.

A variação de uma fruta só está em `sim/render-variants.py`. A grade tem 48 sementes por fruta. A semente 0, no canto de trás à esquerda, é a malha como foi publicada. As outras ficam dentro de uma classe comercial, não atravessam cultivares. O deslocamento da casca é relevo de bump, para o Cycles não tesselar uma cópia por fruta.

A primeira caixa cheia é a plástica 01, com 240 tangerinas, em `sim/assets/preview/crate-01-full-top.png` e `crate-01-full-side.png`. O vão interno medido no mesh é 28,2 cm por 39,2 cm, com 25,7 cm de altura. As frutas começam em posições e rotações aleatórias, em grupos pequenos, pouco acima do monte, e caem com corpo rígido. A contagem é a das que ficam dentro. Nessa cena o topo passa da boca. Pela regra de [Captura em arco](captura.md), a altura dessa caixa é a leitura de lado, não a altura interna menos a coroa. A caixa de tomate com 192 frutos, nas fotos `crate-01-tomato-top.png` e `crate-01-tomato-side.png`, é o mesmo caso: o gerador só parava depois de passar da boca.

Daqui para a frente cada cena de prova sorteia a quantidade. O sorteio é uniforme entre 35% e 100% da contagem que já coroou essa caixa: 240 tangerinas, ou 192 tomates. O piso dá um monte baixo. O teto repete o monte acima da boca. A altura usada como verdade é medida depois da queda, do fundo interno até o topo da fruta mais alta, e pode ficar abaixo ou acima da parede. O arquivo ao lado das fotos guarda a quantidade sorteada, a que ficou dentro e essa altura. A primeira leva, a das esferas iguais, continua rente à borda: ela verifica a álgebra, e não é este sorteio.

O script é `sim/render-crate.py`. A fruta vem depois de `--`. `--seed` escolhe o sorteio. `--count` fixa a quantidade e pula o sorteio. O nome do arquivo é `crate-01-<fruta>-s<semente>-n<quantidade>.txt`. Quatro sorteios já medidos, com a parede em 25,7 cm:

| Fruta | Semente | Sorteada | Dentro | Topo |
| :--- | ---: | ---: | ---: | ---: |
| Tomate | 5 | 69 | 69 | 16,5 cm |
| Tangerina | 5 | 86 | 86 | 16,5 cm |
| Tomate | 1 | 127 | 127 | 25,4 cm |
| Tangerina | 1 | 159 | 159 | 24,1 cm |

As duas primeiras ficam abaixo da boca. As outras duas chegam perto da borda. As caixas de 240 tangerinas e de 192 tomates continuam sendo o extremo alto.

## Onde a renderização roda

Ela roda na máquina que tem a placa NVIDIA. O Blender não está no repositório. O Cycles usa OptiX, e isso acompanha o driver dessa máquina. Docker não entra nesta fase. Um contêiner com a placa ainda exige esse driver, e não deixa outra pessoa renderizar numa máquina sem a placa. O que a equipe compartilha é o script, a semente e o `.txt`. O aplicativo do celular também não roda em contêiner: o cálculo continua na exportação estática.

## De onde vem a variação da fruta

O sorteio segue medidas publicadas, no que elas existem. Onde o texto só descreve a forma, o número é uma classe visível, e o livro diz isso.

O tamanho, em relação à malha, fica na faixa 0,92 a 1,08. Nas malhas atuais isso é cerca de 10 mm no tomate e cerca de 12 mm na tangerina, dentro da regra de uma classe já embalada: o maior diâmetro menos o menor não passa de 15 mm (Portaria MAARA 553/1995, depois revogada pela IN MAPA 33/2018; o mesmo teto está na IN SARC 85/2002). No tomate salada, o coeficiente de variação do diâmetro dentro do cultivar fica perto de 8% (Takahashi e outros, 2025). A escala extra em x e y é 0,98 a 1,02.

Na tangerina, a escala em z vai de 1,04 a 1,12, para a razão altura/diâmetro sair de cerca de 0,78 na malha e andar na direção das médias Ponkan 0,82 a 0,88 (Guarçoni e outros, 2018, Revista Intelletto, diâmetro médio 85,7 mm, coeficiente de variação 6,22%, n = 113; Oliveira, Brunini e Nunes, 2014). A malha publicada tem cerca de 5,3 cm. Uma Ponkan média de 70 a 82 mm pediria um fator perto de 1,45 a 1,55. Esse fator é um deslocamento da média, não este sorteio, e ainda não foi aplicado. No tomate, a escala em z fica entre 0,96 e 1,04. A malha, cerca de 6,0 por 5,8 por 4,8 cm, cabe numa classe achatada da CEAGESP.

A cor da casca laranja permanece perto do tom medido. Silva e outros (2014) dão à Ponkan o ângulo de cor CIELAB 67,8° ± 3,0°, com croma perto de 64, n = 48. A malha, já renderizada, senta perto de 38° no HSV, mais amarela que a laranja da referência de mercado. As cópias laranja voltam cerca de 9° a 15° nessa direção. As amarelas ficam perto da malha. Cerca de 7% saem azeitona na fruta inteira, com vermelho e verde quase iguais e valor mais baixo. Outras guardam a laranja e recebem uma mancha amarelo-esverdeada, com mistura parcial e rampa larga, para a borda não parecer podre. Ponkan colhida verde no norte de Minas já pode ter razão de maturação perto de 10, e o ângulo de cor fica acima de 90° até um tratamento longo com etileno (dos Santos da Costa e outros, 2017). O tomate de mesa maduro fica perto do ângulo 42° (López Camelo e Gómez, 2004). A malha do tomate, já renderizada, senta perto de 21° no HSV. Cerca de 10% das cópias saem amarelo-esverdeadas na fruta inteira, e cerca de 28% guardam uma região vermelha e uma região verde na mesma fruta, com a mesma rampa larga. A casca do tomate ganha uma camada de verniz: a rugosidade publicada é 0,45 e o verniz estava em zero, então o brilho da cera não aparecia. A saturação do tomate maduro não desce de 1,00. Nas cópias verdes ela pode ficar um pouco abaixo, para o amarelo-esverdeado não estourar.

A forma segue o descritor, não um milímetro copiado. Ponkan tem ápice deprimido e casca irregular. Na coleção do IAC, Cascalho, Campeona e Mexerica-do-Pará são rugosas, Natsu Mikan é muito rugosa, e Clementina vai de lisa a rugosa (Pio e outros, Scientia Agricola). O protocolo mede a profundidade do ápice, mas o texto impresso dos acessos não traz os milímetros. Os 3 a 7 mm, e o relevo de 1,2 a 2,2 mm, são a classe que se vê. O pescoço da Ponkan não está modelado.

A primeira leva tem 20 cenas e serve para ver se a fórmula fecha. Em cada cena as esferas são iguais, com um diâmetro sorteado entre 5 e 8 cm. A caixa é sorteada entre 40 e 60 cm de comprimento, 25 e 40 cm de largura, e 15 e 25 cm de altura interna. O monte está cheio: a fruta encosta na borda dos quatro lados, e a altura do monte é a altura interna, sem desconto de coroa. A luz é uniforme e o fundo é liso. A verdade é a contagem que o gerador colocou. O aplicativo só vê as imagens. Se o erro não cair perto de zero, o defeito está no código e o detector fica de fora.

O laço do passo usa 300 cenas renderizadas. Só o passo entre camadas muda, a partir do valor inicial de cerca de 0,82. O coeficiente que sair fica marcado como simulação.

O laço do detector reutiliza essas cenas com luz, desfoque e fundo variados, para treinar o modelo na camada de cima.

A leva seguinte só abre depois que a primeira fechar. Ela imita a cozinha: diâmetros misturados, camada de cima incompleta, luz ruim, câmera no arco, fruta um pouco achatada, quantidade sorteada e monte que pode ficar abaixo da boca ou subir acima dela. A altura desse monte é a leitura do quadro de lado. O achatamento só entra se o modelo tridimensional for achatado. O erro dessa leva é o que mede o método, ainda como simulação.

## O que entra no relatório

O erro medido aqui pode ser citado como evidência de desenvolvimento, com a frase de que a verdade foi a contagem gerada pelo simulador, sob as hipóteses da cena. Esse número não substitui a margem de erro de fruta real. O regulamento pede a quantidade real e o modo como ela foi obtida. Sem foto de fruta, o documento não apresenta o erro da simulação como se fosse o erro da cozinha.
