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

Os meshes ficam em `sim/assets/`: uma tangerina, as caixas vazias e a caixa já cheia. O gerador proposto para a noite é o Isaac Sim, porque a placa disponível é NVIDIA. O Blender com corpo rígido continua válido se o Isaac não estiver instalado. Não há um motor de física escrito para este projeto. Nenhuma cena foi renderizada. A noite não começa sem autorização.

A primeira leva tem 20 cenas e serve para ver se a fórmula fecha. Em cada cena as esferas são iguais, com um diâmetro sorteado entre 5 e 8 cm. A caixa é sorteada entre 40 e 60 cm de comprimento, 25 e 40 cm de largura, e 15 e 25 cm de altura interna. O monte está cheio: a fruta encosta na borda dos quatro lados, e a altura do monte é a altura interna, sem desconto de coroa. A luz é uniforme e o fundo é liso. A verdade é a contagem que o gerador colocou. O aplicativo só vê as imagens. Se o erro não cair perto de zero, o defeito está no código e o detector fica de fora.

O laço do passo usa 300 cenas renderizadas. Só o passo entre camadas muda, a partir do valor inicial de cerca de 0,82. O coeficiente que sair fica marcado como simulação.

O laço do detector reutiliza essas cenas com luz, desfoque e fundo variados, para treinar o modelo na camada de cima.

A leva seguinte só abre depois que a primeira fechar. Ela imita a cozinha: diâmetros misturados, camada de cima incompleta, luz ruim, câmera no arco, fruta um pouco achatada. O achatamento só entra se o modelo tridimensional for achatado. O erro dessa leva é o que mede o método, ainda como simulação.

## O que entra no relatório

O erro medido aqui pode ser citado como evidência de desenvolvimento, com a frase de que a verdade foi a contagem gerada pelo simulador, sob as hipóteses da cena. Esse número não substitui a margem de erro de fruta real. O regulamento pede a quantidade real e o modo como ela foi obtida. Sem foto de fruta, o documento não apresenta o erro da simulação como se fosse o erro da cozinha.
