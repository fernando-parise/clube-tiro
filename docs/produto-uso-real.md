# Uso real do app — base para o trabalho de UX (a fazer)

Levantado com o Fernando em 2026-09-22. **Nada implementado ainda**: este arquivo existe para quando formos desenhar as telas.

## Como ele usa, em ordem de importância

1. **Consulta rápida no celular, dentro do clube** — o caso mais frequente. Está na pista e precisa achar a regra de uma prova, o preço de uma munição, a receita de recarga, em segundos. Tela pequena, uma mão, pressa, possivelmente sol na tela e sinal ruim.
2. **Anotação na hora, pelo WhatsApp** — quando acontece algo, ele manda áudio ou texto para o próprio grupo do WhatsApp. O app não participa desse momento.
3. **Lançamento em lote, em casa, no PC** — depois, sentado, ele leva o que acumulou no WhatsApp para o app (hoje: cola no Projeto do claude.ai, traz o JSON, ou usa a Nota manual).

## O que isso implica para o desenho (hipóteses a validar)

- **Consultar é a tela principal, não Lançar.** O app já abre nela; o peso visual e a ergonomia deveriam refletir isso no celular.
- **Busca e filtro são o coração do caso 1.** Achar em segundos importa mais do que qualquer outra coisa: campo de busca ao alcance do polegar, resultado imediato, categorias acessíveis sem rolar.
- **Lançar é tarefa de desktop.** Pode ser mais denso, com mais campos visíveis e revisão lado a lado — não precisa caber numa tela de celular com conforto.
- **O celular quase nunca lança.** Vale checar se o botão Lançar deve ficar menos proeminente no celular, ou se a Nota manual justifica presença lá.
- **Leitura offline/com sinal ruim** é um risco do caso 1 que ainda não tratamos: hoje toda consulta depende de buscar o `notas.json` no GitHub.

## Perguntas ainda em aberto

- O que ele procura primeiro ao abrir no clube: a nota mais recente, uma categoria específica, ou busca por texto?
- Quantas notas ele espera ter em 6 meses? (muda a necessidade de busca/ordenação)
- Imprimir é para quê exatamente — ficha de prova para levar ao estande, ou arquivo?
- Fotos: consulta no celular precisa ver a foto em tamanho bom, ou a legenda basta?
