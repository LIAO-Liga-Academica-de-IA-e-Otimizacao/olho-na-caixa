# Olho na Caixa — Desafio Solutis/LIAO

**Equipe:** LIAO — Liga Acadêmica de IA e Otimização (UFBA)
**Itens atendidos:** ( ) Banana (x) Tangerina (x) Tomate ( ) Cenoura
**Data:** outubro de 2026
**Repositório:** `https://github.com/LIAO-Liga-Academica-de-IA-e-Otimizacao/olho-na-caixa`

Documento de submissão: processo de captura, evidências, protótipo, margem de erro, limites e extras.

## 1. Processo de captura

Quem recebe abre a tampa, confirma item e modelo da caixa no app e fotografa três posições guiadas com o molde da boca sobre a imagem: vista de cima, quadro A e quadro B de lado (a tangerina usa um terceiro quadro C). Depois confirma ou ajusta os quatro cantos da boca com quatro toques e lê o resultado na Conta. A captura pede luz difusa, sem sol direto sobre a caixa.

Comportamento com luz ruim: a trava de qualidade é dura. Cada quadro passa por análise de brilho e estouro ainda na captura e no envio de arquivo; com aviso em qualquer quadro usado, o botão de continuar desabilita e a tela nomeia o quadro a repetir. Foto tremida, estourada ou sem borda não entra na conta. Sem rede, tudo continua: a leitura roda no aparelho (ONNX no navegador), sem chamada a servidor ou API paga.

Tempo estimado: três fotos guiadas de alguns segundos cada, quatro toques e conta em fração de segundo no aparelho; total estimado abaixo de 1 minuto por caixa, a cronometrar em cozinha real. A mudança de processo é só marcar as três posições do arco no chão ou no balcão, uma vez por cozinha.

## 2. Evidências da abordagem utilizada

Os sinais que chegam ao número: área da boca (do catálogo de caixas medido uma vez), altura do monte (arco de três câmeras calibradas com pose mediana congelada e reta ajustada só no treino), camada visível de cima (YOLO nano com caixas filtradas ao quadrilátero da boca) e, no tomate, quilogramas por litro do lote para converter volume em peso — sem balança em nenhum ponto. A tangerina conta unidades por camadas (altura × área ÷ volume da fruta com passo de empilhamento); o tomate mede litros (área × altura) e multiplica pela densidade do lote.

Cada conferência pode guardar a vista de cima com as caixas do modelo, no próprio aparelho, pela página Guardadas. As outras fotos ficam na sessão.

## 3. PoC / protótipo funcional

`make dev` sobe o app em `http://localhost:3001` (Next.js + Capacitor, exportável para Android). O fluxo Conferir lê o catálogo de caixas, guia as fotos com molde, confirma a borda, desenha as caixas do YOLO sobre a foto de cima e calcula conta e margem na Conta. O simulador em `sim/` gera as caixas de prova no Blender (semente + roteiro versionados) e pontua com o arco congelado; `PYTHONPATH=sim sim/.venv/bin/python -m detect.score_new` reproduz as margens abaixo. A banca pode fotografar qualquer caixa do catálogo e acompanhar cada número até a foto.

## 4. Margem de erro (por item atendido)

| Item | Lotes testados | Valor real | Métrica | Resultado |
|---|---|---|---|---|
| Tangerina (un) | 24 cenas de prova | contagem do gerador (semente) | erro absoluto médio; maior observado | 2,4%; máx +8,7% (s15) |
| Tomate (kg) | 16 cenas de prova | altura de área do gerador (semente) | erro absoluto médio nos litros; maior observado | 3,3%; máx −7,0% (s1070) |

Reta e arco congelados do treino; a prova entra sem reajuste. Validação cruzada em 5 dobras no conjunto original: 2,1% nas 80 tangerinas e 3,2% nos 40 tomates, uma fora em cada. Declara incerteza por conferência? Não.

## 5. Limites conhecidos da solução

Luz dura quebra a leitura: 232 tangerinas e 240 tomates sob sol forte e matiz variada erram 5,6% e 10,1%, com 24 e 35 fora de 10% — medido, não estimado. Reajustar na luz dura não conserta; o degrau de borda não se move (pose intacta) e o cruzamento das frutas corrompe. O envelope de operação é luz difusa, garantido pela trava de qualidade. A altura foi validada em simulador. Em material real do kit, a localização das caixas transfere e a classe tangerina-contra-tomate não (pokan real sai como tomate). A Conferir soma toda caixa dentro da borda, e a classe majoritária só confere o item. Banana (pencas) e cenoura (vazios) estão fora desta entrega.

## 6. Pontos extras atendidos

- (x) Estima peso por imagem sem depender de balança (tomate: litros × kg/L do lote).
- (x) Trata explicitamente casos em que não deve responder (trava de luz/enquadramento com recusa e repetição nomeada).
- (x) Tempo total por caixa estimado abaixo de 1 minuto (a cronometrar em cozinha).
- (x) Custo por conferência: zero — sem API paga, tudo no aparelho.
- ( ) Generaliza sem retrabalho: laranja segue a mesma conta de camadas (diâmetro + reta), sem validação; ponto não pleiteado.
