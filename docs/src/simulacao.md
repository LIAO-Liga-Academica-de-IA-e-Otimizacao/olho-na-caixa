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

Os meshes ficam em `sim/assets/`: uma tangerina, um tomate, as caixas vazias e a caixa já cheia de referência. As fotos de prova assentam esferas com o volume da caixa envolvente da malha e repetem essa malha uma vez só. O tamanho vai na escala do objeto. A rotação é aleatória. O buraco do talo é o polo +Z, e a direção muda de fruta para fruta. A altura guardada para a conta é a média do perfil de lado da malha já posicionada. O pico fica no mesmo arquivo, e não multiplica a camada de cima. O Cycles só entra na foto. O corpo rígido do Bullet foi o método das fotos guardadas em `sim/assets/preview/rigid-body/`. A noite das 20 cenas, e a das 300, continua proposta no Isaac Sim e não começa sem autorização.

## O que as fotos de prova já mostram

Antes dessa noite, o computador gera fotos para uma pessoa olhar. Elas não entram no erro do relatório, e os PNG não entram no git: cada cena pesa alguns megabytes e a noite inteira não cabe no repositório. O `.txt` ao lado fica versionado. Ele guarda a quantidade e a altura. O Cycles usa a GPU por OptiX, na RTX 4060. Cada caixa de prova tem duas fotos, as mesmas duas vistas do arco: de cima e de lado.

A variação de uma fruta só está em `sim/render-variants.py`. A grade tem 48 sementes por fruta. A semente 0, no canto de trás à esquerda, é a malha como foi publicada. As outras ficam dentro de uma classe comercial, não atravessam cultivares. O deslocamento da casca é relevo de bump, para o Cycles não tesselar uma cópia por fruta.

A primeira caixa cheia é a plástica 01, com 240 tangerinas. O vão interno medido no mesh é 28,2 cm por 39,2 cm, com 25,7 cm de altura. Essas fotos, e a caixa de tomate com 192 frutos, foram feitas com corpo rígido e estão em `sim/assets/preview/rigid-body/`. Nelas o gerador só parava depois de passar da boca. Pela regra de [Captura em arco](captura.md), a altura dessa caixa é a leitura de lado, não a altura interna menos a coroa.

Daqui para a frente cada cena de prova sorteia a quantidade e assenta esferas. Cada esfera cabe no volume da caixa envolvente daquela malha e desce até o buraco mais baixo que ainda a toca. A malha é uma só, e a escala do objeto dá o tamanho. A rotação de cada fruta é aleatória. O sorteio é uniforme entre 35% e 100% da contagem que já coroou essa caixa: 240 tangerinas, ou 192 tomates. O piso dá um monte baixo. O teto repete o monte acima da boca. A altura usada como verdade é a média do perfil de lado da malha já posicionada. O pico fica no mesmo arquivo e não multiplica a camada de cima. O arquivo ao lado das fotos guarda a quantidade sorteada, a que ficou dentro, a média e o pico. A primeira leva, a das esferas iguais, continua rente à borda: ela verifica a álgebra, e não é este sorteio.

O atalho é `make render-crate FRUIT=tomato SEED=5`. Sem `SEED`, a semente é 1. `COUNT=127` fixa a quantidade e pula o sorteio. `BLENDER=/caminho/do/blender` aponta o binário. `make help` lista os comandos. O Blender entra por `sim/render-crate.py`. As quatro caixas de prova juntas saem de um processo só, com `--batch`. A classe `Renderer` e os módulos ficam em `sim/render_crate/`, e os números da cena em `crate.toml`. O nome do arquivo é `crate-01-<fruta>-s<semente>-n<quantidade>.txt`. Quatro sorteios já medidos com esse assentamento, com a parede em 25,7 cm:

| Fruta | Semente | Sorteada | Dentro | Média | Topo |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Tomate | 5 | 69 | 69 | 12,3 cm | 13,9 cm |
| Tangerina | 5 | 86 | 86 | 12,1 cm | 13,0 cm |
| Tomate | 1 | 127 | 127 | 20,5 cm | 21,7 cm |
| Tangerina | 1 | 159 | 159 | 20,1 cm | 21,3 cm |

As quatro ficam abaixo da boca. As caixas de 240 tangerinas e de 192 tomates, no arquivo de corpo rígido, continuam sendo o extremo alto. As oito fotos saíram em 12 s dentro de um processo só do Blender. O relógio de parede marcou 13 s. Essas fotos usam 4 amostras, o subsurf desligado e o denoise na placa. A caixa não aplica o deslocamento de vértice da grade de variação: cada fruta só muda de escala e de cor. O relevo de bump da casca continua no material compartilhado.

O detector da camada de cima tem um conjunto à parte, em `sim/assets/detect/`, gerado com essa mesma renderização simplificada. São 80 tangerinas e 40 tomates, só a foto de cima, 640 por 480. A semente divisível por 5 fica de fora do treino: 24 cenas. Cada fruta entra na marcação quando a área em que ela é a superfície mais alta cobre pelo menos metade do disco equatorial. O que está embaixo não leva caixa. A luz e a posição da câmera mudam um pouco de cena para cena. O modelo é um YOLO nano, imagem de 320 pixels. Nas 24 cenas que ele não viu, com limiar 0,55 e supressão de caixas sobrepostas em 0,45, a precisão e a revocação das caixas ficam em 94%. O erro absoluto médio da contagem visível fica em 5%, e o pior caso em 14%, num tomate. O mAP50 é 0,97. Isso mede a camada de cima no simulador. Não é a contagem da caixa inteira, e não é o erro da cozinha. Os pesos ficam em `sim/assets/detect/top-layer.pt`. A tela da conferência continua marcando pela cor, porque o clipe de teste não é este domínio.

A reta da contagem, N = 15,57 + 8,859 h, com h em centímetros da altura média da tampa, foi aplicada às 16 tangerinas que o detector não viu. Com a altura verdadeira, o erro absoluto médio é 0,7% e o pior caso é +2,0%. A silhueta de lado das esferas acompanha essa altura (correlação 0,999) e fica, em média, 3,8 cm acima. Uma correção reta, ajustada só nas outras 64 cenas, traz o erro dessas 16 para 0,9%. A foto colada na grade, lida pelos pixels através do vão, não entrega essa silhueta: a correlação com a altura média é −0,34, e a mesma reta erra a contagem em 57% em média. O plástico tapa o perfil. O embedding da foto de cima também não carrega a altura.

A vista seguinte fica acima da borda próxima e olha a parede do fundo. A faixa vazia entre a boca e a fruta é a altura. Nas mesmas 80 tangerinas essa leitura acompanha a altura média com correlação 0,974. Sem correção, a reta erra as 16 cenas de prova em 9,2% em média, e o pior caso fica 36% abaixo, porque a grade ainda esconde o topo dos montes baixos. Uma correção reta, ajustada só nas outras 64, deixa a média em 6,8%. Quatro das 16 passam de 10%, e o pior caso é +18,9%: a correção levanta um monte cuja foto já estava perto da altura certa.

Dois quadros do mesmo arco, separados por cerca de 10 cm, com a leitura mais alta em cada trecho, pioram esse número. Nas 16 de prova o erro absoluto médio vai a 7,9%, e seis ficam fora de 10%. A leitura mais alta muitas vezes é uma fruta vista por um furo da grade, acima do monte. O cruzamento das duas linhas de visão do contorno também não serve: elas se encontram no ar, acima da casca. Com correção, o erro médio fica em 18%, e nove das 16 passam de 10%.

O centro de cada fruta, visto nos dois quadros, é outra conta. O disco da tangerina tem o centro na projeção do centro da fruta, então as duas retas se encontram na fruta. Em média 22 frutas casam por caixa. Essa altura acompanha a altura média com correlação 0,990, e fica cerca de 5 cm acima, quase o mesmo tanto em toda caixa. Uma correção reta, ajustada só nas 64 de treino, deixa as 16 de prova com erro absoluto médio de 4,1%, entre −6,8% e +14,8%. Duas passam de 10%: uma em +10,1% e outra em +14,8%.

Um terceiro quadro, do outro lado do arco e um pouco mais alto, exige que a mesma fruta apareça nos três. Sozinho, esse quadro deixa duas das 16 fora de 10%, porque poucas frutas concordam e elas são as mais altas.

A leitura que fica é a menor das duas: a dos dois quadros e a dos três. Quando a dos três está mais alta, a terceira câmera só viu a coroa. O deslocamento de 4,22 cm, medido nas 64 de treino, é o mesmo em toda caixa. Nas 16 de prova o erro absoluto médio é 2,2%, entre −6,0% e +4,5%. Nenhuma passa de 10%. Nas 64, a pior fica em 8,4%. Uma caixa, no computador, leva uma fração de segundo.

Um colega contou 42 tangerinas na caixa da semente 5 e 45 na da semente 1, em fotos de cima anteriores. Esses pixels foram substituídos. As contagens 42 e 45 não são uma leitura dos arquivos atuais. Com diâmetro 5,3 cm e passo 0,82, as médias de 12,1 cm e 20,1 cm não publicam as verdades 86 e 159. Nas duas a conta pede outro arco.

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
