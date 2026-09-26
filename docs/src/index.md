# Olho na Caixa

Este livro descreve o método do Desafio Olho na Caixa (Solutis / UFBA). O problema é conferir hortifruti na recepção de cozinhas escolares em menos de um minuto por caixa. O operador usa um celular comum, sem sensor de profundidade.

## Como ler

O livro está dividido em quatro capítulos. A ordem abaixo segue o raciocínio do método: primeiro o que o time já decidiu, depois a filmagem, a conta e a forma de medir o erro.

| Capítulo | O que o capítulo explica |
| :--- | :--- |
| [Decisões fechadas](decisoes.md) | O que o time já escolheu, e o que ainda depende de uma visita à cozinha |
| [Captura em arco](captura.md) | Como o operador filma a caixa, e como o aplicativo escolhe os quadros que entram na conta |
| [Como a quantidade é calculada](calculo.md) | A conta que transforma essas fotos em unidades ou em quilos |
| [Validação](validacao.md) | Qual número entra no relatório, e como esse número é medido |

Para ver este livro no navegador, na raiz do repositório:

```bash
make docs-serve
```

O endereço local é `http://localhost:3000`. O site existe só na máquina em que o comando foi executado. Este repositório não publica uma página no GitHub.

## Escopo desta fase

Nesta fase, o método estima tangerina em unidades e tomate em quilos. A banana fica para uma fase seguinte, e essa fase só começa se a estimativa de tangerina já estiver com erro médio dentro de 10%. A cenoura ficou de fora desta fase.
