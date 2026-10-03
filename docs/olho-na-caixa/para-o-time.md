# Para o time

Este capítulo é o que falta fazer, e como testar no celular. O método que já está no código continua nos outros capítulos. O enunciado, com o regulamento e o prazo, está no repositório [desafio-olho-na-caixa](https://github.com/marx-correia/desafio-olho-na-caixa). Este livro não copia esse texto.

Dá para passar o aplicativo aos colegas para fotografar caixa real, anotar o que a tela disse e corrigir o que quebrar. Não dá para tratar essa passagem como a validação do edital. A margem publicada até aqui é de simulador. Uma caixa de cozinha, com contagem ou peso conhecidos, ainda não foi medida de ponta a ponta.

## O que já está sólido

A jornada da Conferir percorre item, modelo da caixa, fotos com molde, quatro cantos, caixas do modelo sobre a vista de cima, altura do arco e estimativa. **Guardar conferência** grava essa vista com as caixas, e **Guardadas** lista o registro. A contagem soma toda caixa dentro da borda. A classe majoritária só avisa se destoa do item escolhido.

A conta mora em `app/lib/`, e a tela chama essas funções. Um item novo é uma linha no catálogo (`app/lib/produce.ts` e `sim/detect/produce.py`), na conta que ele já tem: camadas, litros ou pencas. A caixa, o arco e a meta de 10% não se copiam por item. O que não se herda é a máscara da casca e o leitor de altura, quando a peça não é redonda.

Os testes do aplicativo são `npm test` dentro de `app/`. Os do simulador são `PYTHONPATH=sim sim/.venv/bin/python -m unittest discover -s sim/detect`. O livro abre com `make docs-serve`, em `http://localhost:3000`.

## Testar no celular

A câmera do Chrome só abre em contexto seguro. No celular, esse contexto é `http://localhost:3001`, depois que o `adb reverse` liga essa porta à máquina de desenvolvimento. Um endereço `http://` da rede local não abre a câmera.

Você precisa do repositório, do Node, de um celular Android com cabo USB, do Chrome nesse celular e do comando `adb` (Android platform-tools).

Na primeira vez, na pasta `app/`:

```bash
npm install
```

Na raiz, deixe o servidor no ar:

```bash
make dev
```

O aplicativo fica em `http://localhost:3001` nesta máquina.

No celular, abra as opções do desenvolvedor e ligue a depuração USB. Conecte o cabo e aceite a chave do computador. Nesta máquina:

```bash
adb devices
adb reverse tcp:3001 tcp:3001
```

`adb devices` tem de listar o aparelho como `device`. Se o cabo sair, rode o `reverse` de novo.

No Chrome do celular, abra `http://localhost:3001` e permita a câmera quando o site pedir.

### A jornada

1. Em **Medidas**, guarde um modelo: nome, comprimento interno, largura interna e altura interna, em centímetros. A Conferir usa a caixa em uso. Sem esse vão, a foto não tem régua.
2. Em **Conferir**, escolha tangerina ou tomate.
3. Em **Caixa e celular**, escolha o modelo. Escolha a lente do aparelho. **Android comum** vale 26 mm. Se a ficha técnica do celular trouxer outro número em milímetro equivalente, digite esse número. **Simulador** é a lente de 35 mm das fotos geradas. Numa foto de celular, essa lente desloca a altura.
4. Em **Quadros**, toque **Fotografar** em cada posição: vista de cima, quadro A, quadro B e, na tangerina, quadro C. Encha o molde tracejado com a boca, sem cortar a borda. A luz é difusa, sem sol direto na caixa. O tomate não usa o quadro C.
5. Se **Continuar** ficar desabilitado, a tela nomeia o quadro escuro ou estourado. Fotografe esse quadro de novo.
6. Em **Borda**, toque os quatro cantos internos na ordem que a tela pede: superior esquerdo, superior direito, inferior direito, inferior esquerdo. Se a boca encheu o quadro, **Usar o quadro cheio** assume os quatro cantos da imagem.
7. Em **Resultado**, confira as caixas sobre as frutas, a contagem, o diâmetro mediano, a altura do arco e a estimativa. Toque **Guardar conferência**. **Guardadas** mostra o JPEG.

Anote, ao lado da estimativa, uma contagem manual na tangerina ou o peso da balança no tomate. Esse par é o relatório de bug e o começo de uma medida real. O quilo por litro que a tela mostra começa em 0,55, que é ilustração, até alguém pesar um lote e trocar o campo na etapa da caixa.

A reta da altura foi ajustada numa boca de 28,2 cm por 39,2 cm. Uma boca mais de 2% fora disso faz a tela pedir a balança. Para ver a conta da foto sozinha, meça uma caixa perto dessa boca.

O nome do quadro no botão abre um arquivo, se a câmera falhar. Isso testa o resto da jornada. Não testa a câmera.

`?test=1` enche os quadros com fotos do simulador. É um atalho do computador. Não é o teste do celular.

### O que anotar num bug

Anote o modelo do celular, o item, as três medidas da caixa, a lente em milímetros, o passo da jornada, o texto da tela e a imagem em **Guardadas**. Diga o que você contou ou pesou. Se as caixas caem nas frutas e a altura não sai, o defeito está no arco, não no modelo da camada de cima.

### Pacote instalado, sem cabo

O caminho de cima precisa do computador ligado. O pacote Android leva o site estático para o aparelho e, depois de instalado, não precisa de cabo nem de rede. Na pasta `app/`:

```bash
npm run cap:sync
npx cap open android
```

O Android Studio abre o projeto em `app/android/`. Rode no aparelho. O identificador é `br.ufba.liao.olhonacaixa`. A permissão de câmera já está no manifesto. Esse pacote compilou. Uma conferência inteira nele, com câmera e com o modelo, ainda é o teste que este capítulo pede. Uma falha que só aparece aqui é falha do WebView, e o caminho com `adb reverse` continua válido.

## O que falta antes da entrega

O prazo no repositório do desafio é 6 de novembro de 2026, 23h59, pelo formulário de submissão de lá. O pacote que esse repositório pede, em palavras nossas, é o código, um README com quem é o time e como rodar, um documento de até 6 páginas, um vídeo de até 5 minutos em material real, e o material de captura usado na margem, com a quantidade real de cada lote e como ela foi apurada.

| Falta | Onde está o rascunho | O que ainda é trabalho |
| :--- | :--- | :--- |
| Documento de até 6 páginas, em PDF | `docs/submissao.md` | Exportar no limite de páginas. |
| Vídeo de até 5 minutos | `docs/roteiro-video.md` | Filmar caixa real de tangerina e de tomate, a recusa de luz e o resultado. Desfocar rostos. Nenhuma criança entra na imagem. |
| README para a banca | `README.md` na raiz | Nomes de quem entrega, instalação e o comando que sobe a tela. O README de hoje aponta o livro. |
| Material da margem | [Validação](validacao.md) | A margem do livro é simulador. Se a entrega ficar com esse número, o pacote leva as cenas e a semente do gerador, e o texto diz que é simulador. Uma margem de cozinha pede caixas contadas ou pesadas, noutro dia, por outra pessoa, depois que o passo e o quilo por litro estiverem travados. |
| Formulário | repositório do desafio | Enviar o link deste repositório. |

No aplicativo, antes de chamar a passagem de validação real:

- Cronometrar uma conferência no celular. O relógio da tela de resultado é o desta passagem, no aparelho em que ela rodou. O modelo de referência da decisão 14 ainda não tem nome.
- Medir com trena o vão interno das caixas que a cozinha piloto recebe, e guardar em **Medidas**.
- Pesar um lote de tomate e trocar o quilo por litro. Até lá, o quilo da tela é ilustração.
- Fechar uma caixa real de ponta a ponta. As caixas do modelo caíram sobre frutas do kit. A altura do arco só foi pontuada no simulador, e o cruzamento das frutas ainda usa a cor da casca. Uma caixa com total conhecido pode falhar na altura mesmo com as caixas certas na foto de cima.
- Corrigir o que essa passagem quebrar.

Dois números do simulador convivem, e os dois são simulador. A tela de resultado cita 2,3% na tangerina e 2,8% nos litros do tomate: a primeira prova, 16 e 8 cenas. O rascunho de submissão cita 2,4% e 3,3%: a prova ampliada, 24 e 16 cenas. O detalhe está em [A leitura que a simulação mediu](arquitetura/leitura.md) e no [histórico](simulacao/historico.md).

## Se sobrar tempo

A laranja é o acréscimo mais curto. Ela não é um dos quatro itens do desafio. É o extra de generalizar, e o time ainda não o pleiteia. A peça é redonda, então entra na conta de camadas, a mesma da tangerina. O diâmetro sai das caixas da foto. A contagem não pede uma classe nova, porque toda caixa dentro da borda já entra. O que falta é um conjunto pontuado: a reta da altura foi ajustada em tangerina e tomate. Acrescentar a laranja é uma linha em `PHASE_ITEMS` (`app/lib/produce.ts`) e um registro em `sim/detect/produce.py`, e depois um punhado de cenas, renderizadas ou reais, pontuadas com a reta congelada. A malha só entra se o simulador for gerar essas cenas. O extra só se pleiteia depois desse número.

A banana continua atrás da decisão 1: ela entra depois que a tangerina estiver com erro médio dentro de 10%. Esse 10% em caixa real ainda não existe. A conta já tem nome, `bunches`: pencas visíveis, vezes os dedos por penca, vezes as camadas de penca. Uma penca não é uma fruta redonda. O leitor de altura da tangerina e a contagem de caixas não passam para ela. Falta um detector de penca, a espessura medida no lote e, no simulador, malha e máscara. É mais trabalho do que a laranja.

A cenoura permanece fora desta fase, pela mesma decisão. A conta seria a dos litros. O leitor de altura do tomate não serve, porque a peça não é redonda.
