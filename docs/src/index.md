# Olho na Caixa

Documentação do método para o Desafio Olho na Caixa (Solutis / UFBA). O problema é conferir hortifruti na recepção de cozinhas escolares em menos de um minuto por caixa, usando um celular comum, sem sensor de profundidade.

## Como ler

| Capítulo | Para quê |
| :--- | :--- |
| [Decisões fechadas](decisoes.md) | O que o time já escolheu, e o que ainda depende de uma visita à cozinha |
| [Captura em arco](captura.md) | Como o operador filma a caixa e como o app escolhe os quadros |
| [Como a quantidade é calculada](calculo.md) | A conta que transforma essas fotos em unidades ou quilos |
| [Validação](validacao.md) | Qual número entra no relatório e como ele é medido |

Para ver este livro no navegador, na raiz do repositório:

```bash
make docs-serve
```

O endereço local é `http://localhost:3000`. O site é só na sua máquina. Este repositório não publica página no GitHub.

## Escopo desta fase

Tangerina (unidades) e tomate (quilos). Banana fica para uma fase seguinte, e só começa se a tangerina já estiver dentro de 10%. Cenoura não entrou nesta fase.
