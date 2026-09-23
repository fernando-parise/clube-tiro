# Clube Tiro

Diário do instrutor: notas do dia a dia (recarga, campeonatos, armas, munições, pistas, treinos) lançadas a partir do WhatsApp, guardadas num repositório privado do GitHub e consultadas de qualquer aparelho.

Spec: `docs/superpowers/specs/2026-09-20-clube-tiro-design.md` · Plano: `docs/superpowers/plans/2026-09-20-clube-tiro.md`

Redesenho da tela Consultar: `docs/superpowers/specs/2026-09-23-consultar-ux-design.md` · Plano: `docs/superpowers/plans/2026-09-23-consultar-ux.md`

## Como funciona

WhatsApp (export .zip ou texto colado) → o app transcreve áudios (Groq), estrutura em notas (Claude) → você revisa → grava em `clube-tiro-anotacoes` (privado): `notas.json` + `midia/`. Tudo roda no navegador; nenhum servidor próprio.

## Configuração (uma vez, por navegador)

1. Repositório privado `clube-tiro-anotacoes` no GitHub (vazio).
2. Token fine-grained: só esse repositório, *Contents: Read and write*.
3. (Opcional) Chave da API em console.anthropic.com — só para o jeito 2.
4. (Opcional) Chave da API em console.groq.com — só para transcrever áudio no app.
5. Abrir o app → Config → preencher, "Testar GitHub", "Testar Claude", Salvar.

As credenciais ficam no `localStorage` do navegador. Cada navegador (PC, celular) precisa da configuração.

## Dois jeitos de estruturar as notas

1. **Pelo claude.ai (sem chave de API)** — crie um Projeto no claude.ai com as instruções de `docs/instrucoes-projeto-claude-ai.md`, mande lá as mensagens do WhatsApp (áudio: transcreva no próprio WhatsApp e mande o texto), copie o JSON que ele devolve e cole em **Lançar**. O app reconhece o JSON e vai direto pra revisão. Fotos: anexe no app junto com o JSON, com o mesmo nome de arquivo que você citou pro Claude.
2. **Pela API (chaves do Claude e do Groq na Config)** — cole o texto ou o export .zip em Lançar e o app transcreve e estrutura sozinho. Custo por uso.

## Uso

- **Lançar**: dois botões — **Processar JSON** (cola o JSON do Projeto do claude.ai, ou o texto/export do WhatsApp quando há chave de API configurada) e **Nota manual** (o que você escrever vira uma nota só, sem IA; categoria, título e tags você ajusta na revisão).
- **Lançar (detalhe)**: no WhatsApp, menu do grupo → Exportar conversa → *Incluir mídia*; salve o .zip e escolha-o em Lançar. Ou cole o texto / envie áudios e fotos soltos. Processar → revisar → Gravar tudo. Mensagens já processadas de exports anteriores são ignoradas.
- **Consultar**: abre numa grade de categorias (com contador de notas); tocar numa categoria (ou em "Todas") leva à lista, com busca dentro dela — "← Categorias" volta. Nota aberta com fotos (toque amplia) e áudio, editar, excluir. PDF pela lista: "PDF desta lista" (filtro atual) ou "PDF de tudo".

## Segurança

- As credenciais (token do GitHub, chaves de API) ficam só no `localStorage` do navegador; nunca vão para o repositório nem para uma URL.
- A página não carrega código de terceiros além do JSZip (com verificação de integridade SRI); a chamada ao Claude é `fetch` direto, sem SDK externo.
- `Content-Security-Policy` na página limita scripts a esta origem e conexões a api.github.com, api.anthropic.com e api.groq.com.
- `Config.save` recusa gravar as notas no repositório público do site.
- O `localStorage` é compartilhado por todos os projetos publicados em `fernando-parise.github.io`: não publique nesse usuário páginas com código de terceiros que você não audite. Para isolar de vez, use um domínio próprio em Settings → Pages → Custom domain.

## Rodar local

    iniciar.bat        (ou: node server.js)  -> http://localhost:3000
    parar.bat

## Testes

    npm test

## Publicar

    atualizar.bat      (commit + push; o GitHub Pages publica a branch main)

## Checklist de teste manual

- [ ] Config: testar GitHub e Claude, salvar, F5 mantém
- [ ] Lançar texto colado com dois campeonatos → 2 notas em `campeonatos`
- [ ] Lançar export .zip com foto e áudio → transcrição no texto, foto com legenda, áudio com player
- [ ] Reprocessar o mesmo zip → "Nada novo"
- [ ] Consultar: home de categorias com contadores corretos, tocar leva à lista certa, "← Categorias" volta
- [ ] Consultar: busca a partir da home pula direto para os resultados; busca sem acento continua funcionando
- [ ] Consultar: abrir, editar, excluir nota; foto abre no lightbox e fecha tocando fora ou no X
- [ ] PDF desta lista traz só o filtro atual; PDF de tudo ignora o filtro; PDF desta lista desabilita com a lista filtrada vazia; PDF de tudo só desabilita se o app inteiro não tiver nenhuma nota
- [ ] PDF desta lista inclui as notas que exigem rolagem pra alcançar, não só as visíveis sem rolar
- [ ] No celular: tela em uma coluna, lançar e consultar funcionam
- [ ] Consultar: grade lado a lado (lista + nota) a partir de 900px de largura; abaixo disso, layout empilhado
- [ ] Consultar: mensagem "Nenhuma nota em [categoria]." numa categoria vazia; "Nenhum resultado." numa busca sem resultado
- [ ] Lightbox funciona corretamente em orientação retrato e paisagem (testar redimensionando a janela)

## Decisões registradas

- Transcrição: Groq `whisper-large-v3-turbo` (chamada direta do navegador confirmada em 2026-09-20). Alternativa: OpenAI `whisper-1`, comentada em `js/transcricao.js`.
- Claude: SDK `@anthropic-ai/sdk@0.127.0` via esm.sh (versão fixada) com `dangerouslyAllowBrowser` (confirmado em 2026-09-20; o fallback com `fetch` não foi necessário).
