# Validação

O número que vai para o edital não é o erro das mesmas caixas que ensinaram o app. São dois grupos.

## Calibração

Cerca de 30 caixas por item (tangerina e tomate). Aqui se ajustam o passo entre camadas e os quilos por litro. Cada caixa guarda:

- o modelo e as medidas internas
- a variedade
- a altura do monte medida com régua
- o vídeo do arco
- a verdade: contagem dupla, no caso da tangerina; peso de balança, no caso do tomate

A contagem dupla vale se os dois contadores diferirem em menos de 2%. Se diferirem mais, um terceiro conta. A balança dessa etapa pode ser lenta. O limite de um minuto é do operador na demonstração, não de quem está etiquetando.

O ajuste usa validação deixando uma caixa de fora de cada vez, para escolher o coeficiente. Isso ainda não é o número publicado.

## Conjunto congelado

Pelo menos 20 caixas por item, em outro dia, fotografadas por outra pessoa, depois que os coeficientes já foram travados. Ninguém mexe no passo nem nos quilos por litro depois de olhar esse conjunto.

Em cada caixa i, o erro relativo é:

> **eᵢ = (estimativa − verdade) / verdade**

O relatório mostra, por item:

- viés: a média de eᵢ (positivo se o app exagera)
- margem de erro média: a média de |eᵢ|
- desvio padrão de eᵢ, dividindo por n − 1
- fração de caixas com |eᵢ| dentro de 10%
- percentil 90 de |eᵢ|

A meta do edital, do jeito que está escrita hoje, compara com a margem de erro média. A fração e o percentil 90 acompanham para a leitura caixa a caixa.

## O que dataset público não substitui

Fotos públicas de fruta servem, no máximo, para o detector começar menos cego. Nenhuma delas traz o quilo por litro da caixa desta cozinha. Esse número só existe nas caixas pesadas por vocês.
