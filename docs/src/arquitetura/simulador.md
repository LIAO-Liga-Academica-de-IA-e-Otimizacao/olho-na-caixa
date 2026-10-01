# O simulador

O simulador existe para responder uma pergunta que a cozinha ainda não pode responder: se a conta, diante de uma caixa cujo conteúdo a gente conhece, chega perto. A caixa de plástico e as malhas da fruta são modelos. A luz é simples de propósito. Um erro pequeno aqui não vira, sozinho, a margem do edital.

## Como uma cena nasce

O comando de todos os dias está no `Makefile`.

`make render-crate` gera uma caixa só, de cima e de lado, para olhar. `FRUIT=tomato` troca a fruta. `SEED` muda o enchimento. `COUNT` fixa a quantidade.

`make render-dataset` gera o conjunto do detector: 80 tangerinas (sementes 1 a 80) e 40 tomates (sementes 1001 a 1040). A semente divisível por 5 fica de fora do treino. São 24 cenas de prova no detector, porque as duas frutas entram na mesma rede.

O Blender usado nesta máquina é o 4.5.9. O `Makefile` procura o binário em `/tmp/blender-4.5.9-linux-x64/blender` e, se não achar, usa o `blender` do sistema. A renderização é Cycles com poucas amostras, a malha da fruta é compartilhada, e o relevo da casca é bump, não deslocamento de vértice. O capítulo [Simulação no computador](../simulacao.md) explica por que esse atalho ficou.

O Python que o Blender executa não é o `sim/.venv`. O Blender traz o próprio Python. O `sim/.venv` é o ambiente do treino e da leitura: torch, ultralytics e OpenCV. Testes de `sim/detect/` usam esse ambiente, com `PYTHONPATH` apontando para `sim/`.

## O que cada módulo faz

`sim/render_crate/` é a cena.

`_config.py` lê `crate.toml`: qual blend, quantas frutas cabem numa caixa coroada (240 tangerinas, 192 tomates), e os sais que separam pose, enchimento e luz.

`_opening.py` mede o vão interno da malha da caixa. Nesta caixa o vão é 28,2 cm por 39,2 cm, e a altura interna é cerca de 25,7 cm. A base que entra nos litros é 28,2 × 39,2.

`_fruit.py` copia a malha, varia a escala e pinta. O assentamento não usa a malha: usa uma esfera cujo raio é a média geométrica dos três semieixos. A tangerina é quase redonda. O tomate é achatado.

`_settle.py` deixa as esferas caírem e empurra as que atravessam a parede. `keep_inside` tira o que ficou fora da boca. A lista que sobra é a verdade da cena.

`_visible.py` diz duas coisas a partir dessa lista. `visible_indices` marca a fruta cuja capa visível cobre pelo menos metade do disco: é quem pode ganhar uma caixa no detector. `area_mean` é a altura média da tampa. Em cada célula de uma grade no fundo, fica a superfície mais alta. Onde não há fruta, a célula vale zero. A média dessas células é a altura que a conta quer. O pico, sozinho, não serve: num monte, só o meio é alto.

`_studio.py` posiciona a câmera e a luz e grava o PNG.

`dataset.py` amarra isso num processo só do Blender. Sem bandeira, ele grava a foto de cima e o arquivo de caixas do YOLO. Com `--sides`, grava dois quadros do arco das tangerinas e uma planilha de silhueta. Com `--third`, grava o terceiro quadro. Com `--tomato`, grava os três quadros de cada tomate e a altura média verdadeira. Essas bandeiras reescrevem planilhas. Não rode `--sides` outra vez se a planilha da tangerina já tem as colunas dos centros: esse comando recomeça o arquivo.

`sim/detect/produce.py` é o catálogo dos itens. Tangerina e tomate já têm máscara, sementes e classe do detector. Cenoura e banana já têm a conta, e mais nada: a cenoura reusa os litros do tomate, a banana reusa a conta das pencas. As duas ainda pedem malha, máscara de casca e um leitor de altura, porque não são frutas redondas. A mediana do tomate não passa para elas. Uma fruta nova é uma linha nesse catálogo, uma entrada em `crate.toml` e, se for redonda, o mesmo arco. `plan.py` só lista quem já tem faixa de sementes. A regra da prova é uma só: semente divisível por 5 não treina.

`train.py` e `score.py` treinam e medem o YOLO nano na foto de cima. O modelo responde a camada visível, não a caixa inteira. Nas 24 cenas de prova, com confiança 0,55 e supressão 0,45, a contagem visível erra cerca de 5% em média. O pior caso ficou em 14%, num tomate.

## Onde ficam as fotos e os números

`sim/assets/detect/images/` guarda a foto de cima. `labels/` guarda a caixa de cada capa. `sides/` guarda o arco. Essas pastas estão no `.gitignore`: elas são grandes e se regeneram. O peso `top-layer.pt` é a exceção e pode ir no git.

As planilhas vão no git, porque são o registro do erro:

- `height-sheet.csv` é a tangerina. Cada linha é uma cena, com a altura verdadeira e as leituras que foram tentadas.
- `tomato-height-sheet.csv` é o tomate, com a altura verdadeira e a mediana que entrou na reta.

Os testes `test_choose_lid.py` e `test_tomato_volume.py` leem essas planilhas. Eles não precisam das fotos. Se alguém mudar a reta e o erro da prova passar de 10%, o teste quebra.
