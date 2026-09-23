# Clube Tiro — redesenho da tela Consultar (design)

Data: 2026-09-23
Status: aprovado em conversa, aguardando revisão da spec escrita

## 1. Objetivo

O app está no ar e funcionando (ver `docs/superpowers/specs/2026-09-20-clube-tiro-design.md`), mas a tela Consultar foi desenhada antes de sabermos como o Fernando realmente usa o app. O levantamento em `docs/produto-uso-real.md` mostrou que consultar — não lançar — é o caso de uso mais frequente e o mais sensível a fricção: dentro do clube, no celular ou no PC, com pressa, procurando uma regra de prova, um preço de munição ou uma receita de recarga.

Esta spec desenha a tela Consultar de novo em cima desse caso de uso. Lançar não muda — continua tarefa de PC, fora de escopo aqui.

## 2. Decisões tomadas na conversa

| Pergunta em aberto (do produto-uso-real.md) | Resposta |
|---|---|
| O que ele procura primeiro ao abrir | Uma categoria específica — não busca livre, não "última nota" |
| Volume esperado em 6 meses | 30 a 100 notas — ordenação por mais recente resolve; paginação não é necessária ainda |
| Para que serve a impressão | Gerar PDF de uma ficha para levar ao estande (via impressão do navegador) |
| Fotos no celular | Precisa ver bem — zoom dedicado, não só a legenda |
| Consulta acontece onde | PC ou celular, sempre pelo site — o desenho vale para qualquer tamanho de tela |
| Lançar acontece onde | Só PC — confirmado, fora de escopo desta spec |

Decisão adicional levantada na conversa: a home de categorias inclui um bloco extra "Todas" (não é obrigatório escolher 1 categoria por vez); e o PDF é gerado a partir da lista (filtrada ou não), nunca de dentro de uma nota isolada — para 1 nota só, o Fernando filtra/busca até sobrar ela e gera o PDF dali.

## 3. Escopo

**Muda:** fluxo e layout da tela Consultar (`tela-consultar` em `index.html`, `js/consultar.js`, `app.css`).
**Não muda:** modelo de dados (`notas.js`, `Notas.CATEGORIAS`), tela Lançar, integração com GitHub/Claude/Groq, tema visual (tokens Valariss).

## 4. Tela inicial — home de categorias

Ao entrar em Consultar, a tela não cai mais direto numa lista com "Todas" pré-selecionado. Mostra:

- Campo de busca (`#cons-busca`) sempre visível no topo. Digitar ali pula direto para a lista de resultados (busca em todas as categorias), sem precisar tocar em nenhum bloco.
- Uma grade de 8 blocos grandes e tocáveis abaixo da busca: os 7 nomes de `Notas.CATEGORIAS` (recarga, campeonatos, armas, municoes, pistas, treinos, outros) + um bloco **Todas**. Cada bloco mostra o nome da categoria e o contador de notas nela.
- A grade é responsiva por número de colunas (menos colunas em telas estreitas, mais em telas largas) — é a mesma estrutura em qualquer tamanho de tela, não uma versão "mobile" separada.

Tocar num bloco leva à lista filtrada por aquela categoria (ou sem filtro, no caso de "Todas").

## 5. Lista dentro de uma categoria (ou "Todas")

Mesma lista de hoje (`consultar.js`), chegando agora por um toque na home em vez de nascer com "Todas" pré-selecionado:

- Busca de texto continua ativa dentro da lista (filtra dentro da categoria escolhida, ou em tudo se for "Todas").
- Os chips de categoria somem desta tela — trocar de categoria é voltar para a home (botão **"← Categorias"**, sempre visível no topo da lista e da nota aberta), não escolher outro chip. Evita duplicar a navegação entre home e lista.
- Ordenação: mais recente primeiro (padrão atual, mantido). Sem paginação — o volume esperado (30–100 notas em 6 meses) não justifica.
- Contador de resultados, como hoje.

No desktop (≥900px), lista e nota aberta continuam lado a lado via grid (`consultar-grade`, comportamento atual mantido). Abaixo de 900px, tudo empilhado (comportamento atual mantido).

## 6. Nota aberta e fotos

Abrir uma nota mantém o comportamento atual (painel lateral no desktop, tela cheia empilhada no mobile). A mudança é em como as fotos se comportam: hoje uma foto abre em nova aba do navegador (`consultar.js:94-114`); passa a abrir em um **lightbox** sobre a própria tela — imagem ampliada, fundo escurecido, fecha tocando fora dela ou num botão de fechar, com zoom/pinça nativo do navegador disponível. Resolve o caso de precisar ler algo na foto (ex.: planilha de recarga fotografada) sem trocar de aba. Áudio continua como está (`<audio controls>`).

## 7. Geração de PDF

O botão de gerar PDF fica na tela de lista (depois de entrar numa categoria, "Todas", ou aplicar uma busca), com duas opções: **PDF desta lista** e **PDF de tudo**. "Desta lista" imprime todas as notas que batem com o filtro/busca atual — não só as visíveis na tela sem rolar. O mecanismo continua sendo `window.print()` com o `@media print` que já existe (`app.css:118-139`) e já funciona bem; não precisa de biblioteca de geração de PDF — "gerar PDF" aqui é o usuário escolhendo "Salvar como PDF" no diálogo de impressão do navegador.

Não há botão de imprimir/gerar PDF dentro da nota aberta — para 1 nota isolada, o caminho é filtrar/buscar até sobrar ela na lista e usar "PDF desta lista".

## 8. Ergonomia e responsivo

- Busca sempre no topo, em qualquer tamanho de tela.
- Blocos de categoria e cards da lista ganham área de toque mínima confortável (o app hoje não trata tamanho de toque especificamente) — relevante para o caso "sol na tela, uma mão, pressa" do levantamento.
- Nenhuma tela "exclusiva de mobile": a mesma estrutura (home → lista → nota) serve PC e celular, só a quantidade de colunas na grade de categorias e a presença do grid lado a lado (lista+nota, ≥900px) mudam por largura de tela.

## 9. Impacto no modelo de dados

Nenhum. `Notas.CATEGORIAS` continua a única fonte de verdade das categorias; os contadores da home de categorias são calculados no cliente a partir das notas já carregadas, sem campo novo em `notas.json`.

## 10. Tratamento de erros

| Situação | Comportamento |
|---|---|
| Categoria sem nenhuma nota | Bloco aparece na home com contador 0; toque nele leva a uma lista vazia com mensagem ("nenhuma nota em [categoria]"), não um erro |
| Busca sem resultado dentro de uma categoria | Mensagem "nenhum resultado", sem sair da tela |
| Foto falha ao carregar no lightbox | Ícone de erro no lugar da imagem, lightbox continua fechável normalmente |
| `window.print()` chamado sem notas na lista | Botão de PDF fica desabilitado quando a lista está vazia |

## 11. Testes

Sem framework de teste visual no projeto (só `node --test` para lógica pura). Checklist de teste manual a acrescentar ao README/checklist existente:

- Home mostra os 8 blocos (7 categorias + Todas) com contadores corretos.
- Tocar em cada bloco leva à lista certa; "← Categorias" volta à home a partir da lista e da nota aberta.
- Busca a partir da home pula direto para a lista de resultados.
- Lightbox abre/fecha e mostra a foto ampliada, nas duas orientações de tela.
- "PDF desta lista" inclui todas as notas do filtro atual, mesmo as que exigem rolar a tela; "PDF de tudo" ignora o filtro.
- Grid lado a lado (lista+nota) continua funcionando ≥900px; empilhado abaixo disso.
- Categoria com 0 notas e busca sem resultado mostram mensagem, não tela quebrada.

## 12. Fora de escopo (nesta spec)

- Qualquer mudança na tela Lançar.
- Seleção de múltiplas categorias ao mesmo tempo na home (cogitado na conversa, descartado — só a opção "Todas" cobre o caso).
- Geração de PDF por biblioteca própria (o `window.print()` já resolve).
- Paginação da lista (volume esperado não justifica).
- Lembrar a última categoria visitada entre sessões (cogitado como abordagem alternativa, descartado em favor da home sempre visível).

## 13. Riscos e pontos a confirmar

1. **Contagem por categoria com volume maior que o esperado** — se o volume passar muito de 100 notas, recalcular contadores no cliente a cada abertura da home pode pesar; não é um risco no volume atual (30–100).
2. **Lightbox e o painel lateral do desktop** — confirmar no protótipo que o lightbox cobre bem a tela mesmo com o grid lista+nota aberto ao lado (z-index, área ocupada).
3. **"PDF desta lista" em listas grandes** — o `@media print` atual já tem quebra de página entre notas; confirmar que continua legível com listas maiores (30–100 notas) antes de considerar pronto.
