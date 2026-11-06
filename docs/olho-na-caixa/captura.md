# Captura em arco

O operador fotografa a caixa aberta em posições fixas. Cada posição traz o molde da boca sobre a imagem. A leitura dessas fotos está em [A leitura que a simulação mediu](arquitetura/leitura.md).

## O que o arco resolve

A conta precisa de duas vistas:

- uma de cima, para contar a camada visível e medir o tamanho de cada fruta;
- uma de lado, para ver até que altura o monte sobe.

Numa cozinha, a caixa quase sempre está encostada em alguma coisa. O protocolo não pede uma volta completa. Pede a vista de cima, o quadro A e o quadro B. A tangerina pede também o quadro C, do outro lado do arco. O tomate não usa o quadro C.

## O tamanho da caixa continua no catálogo

Fotografar a caixa não cria uma trena. O comprimento, a largura e a altura da caixa continuam sendo os números medidos antes, no cadastro. Sem esse cadastro, a mesma foto pode parecer igual para uma caixa grande longe da câmera e para uma caixa pequena perto dela.

## Passo a passo na cozinha

1. O operador abre a tampa.
2. No aplicativo, ele confirma o item (tangerina ou tomate), o modelo da caixa e a lente do celular.
3. Ele fotografa cada posição com a boca coincidindo com o molde tracejado, sem cortar a borda. O molde cabe na foto. Ele é a boca do modelo, vista com a distância focal do celular, na mira daquela posição do arco. Se essa boca não couber na pose marcada, a mira continua a mesma e o aparelho fica mais longe, até a boca entrar com folga. A vista de cima não usa essa mira do arco. O molde dela é um retângulo: o comprimento pela largura da boca, com a mesma lente. O arquivo do arco não tem câmera de cima. A mira assumida fica na vertical do centro da boca, 52 cm acima da borda em que o arco foi medido, e olha para baixo, para o molde continuar retângulo. Se o retângulo não cabe na foto, essa mira sobe em linha reta até a boca entrar com a mesma folga.
4. Se um quadro estiver escuro ou estourado, **Continuar** fica desabilitado e a tela nomeia o quadro. Ele fotografa esse quadro de novo.
5. Ele confere os quatro cantos internos da boca. Se a boca encheu o quadro, o quadro cheio serve. Se não encheu, ele toca os quatro cantos na ordem que a tela pede.
6. O detector roda uma vez, na vista de cima. A altura sai dos quadros laterais. A conta de unidades ou de quilos roda no mesmo aparelho.
7. Se o intervalo não couber em 10%, o aplicativo pede o peso digitado da balança.

A foto pede luz difusa, sem sol direto sobre a caixa. O envelope medido está no [histórico](simulacao/historico.md).

## Caixa cheia e fruta acima da borda

A altura do monte é a leitura do arco. Esse topo pode ficar acima da boca. A altura interna do catálogo é a parede, não um teto para a leitura. Sem os quadros laterais, a tela diz que a altura não saiu.
