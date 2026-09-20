# Clube Tiro — diário do instrutor (design)

Data: 2026-09-20
Status: aprovado em conversa, aguardando revisão da spec escrita

## 1. Objetivo

Fernando anota o dia a dia de instrutor no clube de tiro num grupo do WhatsApp (texto, áudio, foto com legenda). Depois joga esse material num sistema web que:

1. transforma as mensagens em **notas** classificadas (recarga, campeonatos, armas, munições/preços, pistas, treinos, outros);
2. guarda tudo num repositório **privado** do GitHub;
3. permite **consultar** (lista, filtro, busca) de qualquer aparelho e **imprimir**.

Uso pessoal, um único usuário. Entrada manual: o WhatsApp é só o bloco de notas; nada de bot.

## 2. Decisões tomadas na conversa

| Pergunta | Decisão |
|---|---|
| Captura do WhatsApp | Manual — export da conversa (.zip) ou texto colado |
| Tipo de conteúdo | Notas heterogêneas do dia a dia, com foto e legenda |
| Privacidade | Tudo privado; acesso pelo token do GitHub |
| Áudio | O sistema recebe o arquivo e transcreve (não usa a transcrição do WhatsApp) |
| Arquitetura | Espelho do projeto **meus-habitos**: site estático no GitHub Pages, dados no GitHub, tudo roda no navegador |
| Visual | Design tokens do portal Valariss |
| IA | Claude Opus 5 via API, chave do usuário guardada no navegador |

## 3. Arquitetura

```
[celular/PC]  WhatsApp -> Exportar conversa (.zip)  ou  copiar texto
      |
      v
[navegador] clube-tiro (GitHub Pages, HTML/JS puro)
      |-- JSZip: abre o export
      |-- parser: mensagens {data, texto, anexo}
      |-- API de transcrição (Groq Whisper): áudio -> texto
      |-- API do Claude (Opus 5, structured output): mensagens -> notas propostas
      |-- tela de revisão: usuário ajusta e confirma
      v
[GitHub] clube-tiro-dados (privado)
      |-- notas.json
      |-- midia/AAAA/MM/*.jpg | *.opus
```

Não há servidor próprio. As três credenciais (token GitHub, chave Claude, chave Groq) ficam no `localStorage` do navegador, como o `gh_config` do Hábitos.

### 3.1 Repositório `clube-tiro` (público, GitHub Pages)

```
index.html          uma página, duas telas (Lançar / Consultar) + configuração
css/
  tokens.css        variáveis Valariss (dark padrão, [data-theme="light"])
  app.css           layout, componentes, @media print
js/
  config.js         leitura/gravação das credenciais no localStorage
  github-api.js     Contents API: ler/gravar notas.json, subir/baixar mídia
  whatsapp-parser.js  export .txt -> mensagens (função pura)
  transcricao.js    chamada à API de transcrição
  claude.js         chamada ao Claude, schema das notas
  notas.js          modelo, validação, ids, dedupe (funções puras)
  imagem.js         redimensionar foto no navegador (canvas)
  lancar.js         tela Lançar (entrada -> revisão -> gravar)
  consultar.js      tela Consultar (lista, filtro, busca, nota, edição)
  main.js           roteamento entre telas, inicialização
test/
  whatsapp-parser.test.js
  notas.test.js
server.js           servidor local estático (igual Hábitos)
iniciar.bat / parar.bat / atualizar.bat
.nojekyll
README.md
```

Sem bundler, sem framework. Bibliotecas externas por CDN: JSZip e o SDK `@anthropic-ai/sdk` (ESM, ver 6.1).

### 3.2 Repositório `clube-tiro-dados` (privado)

```
notas.json
midia/2026/09/2026-09-19-2121-a1b2c3.jpg
midia/2026/09/2026-09-19-2125-d4e5f6.opus
```

Nome de mídia: `AAAA-MM-DD-HHMM-<6 hex aleatórios>.<ext>`. Só o app escreve nesse repositório.

## 4. Modelo de dados — `notas.json`

```json
{
  "versao": 1,
  "ultimaMensagemProcessada": "2026-09-19T21:25",
  "notas": [
    {
      "id": "2026-09-19-campeonato-el-patron",
      "data": "2026-09-19T21:21",
      "categoria": "campeonatos",
      "titulo": "Campeonato El Patron",
      "tags": ["7 metros", "contagem de tempo"],
      "texto": "- 3 tiros peito\n- 3 tiros cabeça\n- com uma recarga\n- 7 metros, contagem de tempo",
      "midia": [
        { "tipo": "imagem", "arquivo": "midia/2026/09/2026-09-19-2121-a1b2c3.jpg", "legenda": "alvo 4 cores" },
        { "tipo": "audio",  "arquivo": "midia/2026/09/2026-09-19-2125-d4e5f6.opus", "transcricao": "..." }
      ],
      "origem": "export-whatsapp",
      "criadoEm": "2026-09-20T10:02:11"
    }
  ]
}
```

- `id`: data da nota + slug do título (sem acento, minúsculas, hífens). Se colidir, sufixo `-2`, `-3`.
- `categoria`: uma de `recarga | campeonatos | armas | municoes | pistas | treinos | outros`. Lista fixa em `notas.js`.
- `texto`: markdown simples (listas, negrito, quebras). Renderizado com um conversor mínimo próprio (listas, `**negrito**`, parágrafos) — sem biblioteca.
- `midia[].tipo`: `imagem | audio`. Áudio guarda a `transcricao` (o texto da nota já a incorpora; a transcrição fica pra referência e re-processamento).
- `origem`: `export-whatsapp | colado | arquivo`.
- `ultimaMensagemProcessada`: data/hora da última mensagem de export que virou nota; exports novos ignoram mensagens até esse instante.

Um arquivo só. Ordem no arquivo é irrelevante; a tela ordena por `data`.

## 5. Tela Lançar

### 5.1 Entrada

- `textarea` para texto colado.
- `<input type="file" multiple>` aceitando `.zip`, `.txt`, áudios (`.opus .ogg .m4a .mp3 .wav`) e imagens (`.jpg .jpeg .png .webp`).
- Botão **Processar**.

### 5.2 Normalização — `whatsapp-parser.js`

Entrada: texto do `.txt` do export (ou o texto colado). Saída: `[{ data: "2026-09-19T21:21", autor, texto, anexo: "IMG-....jpg" | null }]`.

Formatos reconhecidos (pt-BR):

| Origem | Linha de mensagem | Anexo |
|---|---|---|
| Android | `19/09/2026 21:21 - Fernando: texto` | `IMG-20260919-WA0001.jpg (arquivo anexado)` |
| iOS | `[19/09/2026, 21:21:05] Fernando: texto` | `<anexado: 00000012-PHOTO-2026-09-19-21-21-05.jpg>` |

Linhas sem prefixo de data continuam a mensagem anterior. Linhas de sistema (`Mensagens e chamadas são protegidas...`, `criou o grupo`, `<Mídia oculta>`) são descartadas. Texto colado sem nenhum prefixo de data vira uma única mensagem com `data = agora`.

Arquivos do zip são casados com o nome do anexo. Áudio/imagem enviados soltos (sem `.txt`) viram mensagens com `data = agora` e texto vazio.

Mensagens com `data <= ultimaMensagemProcessada` são descartadas quando a origem é export.

### 5.3 Transcrição — `transcricao.js`

Cada anexo de áudio vai para a API de transcrição (seção 6.2). Resultado entra como `texto` da mensagem e como `transcricao` da mídia. Falha em um áudio não interrompe o lote: a mensagem fica com `[áudio não transcrito]` e o arquivo segue anexado.

### 5.4 Estruturação — `claude.js`

Uma chamada por lote com todas as mensagens normalizadas (data, texto, referência a anexos). O Claude devolve, via structured output, `{ notas: [...] }` no formato da seção 4, sem `id`, `criadoEm` nem caminhos de mídia (o app preenche). Cada anexo é referenciado pelo nome original e o app o liga à nota indicada.

Instruções do prompt (system):

- contexto: instrutor de tiro esportivo no Brasil; vocabulário da área (recarga, calibre, pista, prova, estágio, cadência, alvo);
- agrupar mensagens que formam um mesmo assunto (ex.: os quatro blocos `=====` são quatro notas de `campeonatos`); não juntar assuntos diferentes;
- uma foto com legenda vira nota própria ou entra na nota que estiver descrevendo — decidir pelo contexto;
- título curto, tags úteis para busca (calibre, distância, nome da prova, arma);
- texto em markdown simples, fiel ao original — reorganizar em lista quando fizer sentido, sem inventar informação;
- categoria sempre uma da lista; na dúvida `outros`.

### 5.5 Revisão

Tabela/cards das notas propostas. Por nota: categoria (select), título, tags, texto (textarea), miniaturas das fotos e player dos áudios, botão excluir. Botão **Gravar tudo**. Nada é gravado antes disso.

### 5.6 Gravação — `github-api.js`

1. Para cada foto: redimensionar (lado maior 1600 px, JPEG 0.8) e `PUT /repos/{owner}/clube-tiro-dados/contents/midia/...` (base64).
2. Para cada áudio: `PUT` do arquivo original.
3. `GET notas.json` (pega o `sha` atual), acrescenta as notas, atualiza `ultimaMensagemProcessada`, `PUT` com o `sha`.
4. Se o `PUT` do `notas.json` voltar 409/422 (sha desatualizado): `GET` de novo, reaplica, tenta uma vez.

Barra de progresso simples (arquivo N de M).

## 6. Serviços externos

### 6.1 Claude

- Modelo `claude-opus-5`; SDK `@anthropic-ai/sdk` importado por ESM de CDN, cliente com `dangerouslyAllowBrowser: true`. Se a importação por CDN se mostrar instável, cair para `fetch` direto em `/v1/messages` com o header `anthropic-dangerous-direct-browser-access: true` — decidir no primeiro teste.
- Thinking adaptativo (padrão do modelo); `effort` padrão. Structured output via `output_config.format` com o JSON Schema das notas. Streaming não é necessário (saída pequena).
- `fallbacks: "default"` com beta `server-side-fallback-2026-07-01`, conforme padrão recomendado para Opus 5.
- Custo estimado: um lote de 20 mensagens ~ 4k tokens de entrada + 2k de saída ≈ US$ 0,07.

### 6.2 Transcrição

- **Groq**, modelo `whisper-large-v3-turbo`, endpoint compatível com o formato Whisper (`multipart/form-data`, campo `file`, `language=pt`). Aceita `.opus`/`.ogg` do WhatsApp. Tem faixa gratuita.
- **A confirmar antes de implementar** (spike de 10 minutos): a API aceita chamada direta do navegador (CORS). Se não aceitar, usar a API de transcrição da OpenAI (mesmo formato de requisição, paga por minuto) — a troca é só de URL e chave em `transcricao.js`.

### 6.3 GitHub

- Token fine-grained, escopo: repositório `clube-tiro-dados`, permissão *Contents: read and write*. Nada além disso.
- Leitura de mídia privada: `GET .../contents/{path}` com `Accept: application/vnd.github.raw+json` e o token → `blob` → `URL.createObjectURL`. Cache em memória por sessão.
- `notas.json` até 1 MB vem inline na Contents API; acima disso o mesmo `GET` com `Accept: raw` continua funcionando. Não há limite prático para o volume esperado.

## 7. Tela Consultar

- Lista de notas, mais recentes primeiro. Filtro por categoria (chips), busca de texto (título, texto, tags — sem acento, sem maiúscula). Contador de resultados.
- Nota aberta: título, data, categoria, tags, texto renderizado, fotos (clique amplia), player de áudio.
- **Editar**: título, categoria, tags, texto. **Excluir**: com confirmação. Ambos gravam `notas.json` pelo mesmo caminho da seção 5.6. Mídia de nota excluída fica no repositório (não apaga arquivos — simples e seguro).

## 8. Impressão

- Botão **Imprimir** na nota aberta e na lista filtrada → `window.print()`.
- `@media print`: fundo branco, texto preto, fontes do sistema, esconde cabeçalho/menus/botões/chips, fotos com largura máxima da página, quebra de página entre notas na lista.

## 9. Configuração e segurança

- Tela de configuração (engrenagem): usuário do GitHub, nome do repositório de dados, token GitHub, chave Claude, chave Groq. Botão **Testar** valida cada uma (GET no repositório; chamada mínima ao Claude; nada no Groq além de guardar). Tudo em `localStorage` chave `ct_config`.
- O repositório `clube-tiro-dados` é criado à mão no GitHub (privado, vazio), uma vez. Primeiro uso: se ele não tiver `notas.json`, o app cria com `{ "versao": 1, "notas": [] }`.
- Nenhuma credencial vai para o repositório público. `.gitignore` cobre `notas.json` local e `midia/` (usados só em teste local).

## 10. Visual — tokens Valariss

Fontes (Google Fonts): corpo *Plus Jakarta Sans* 400–700, títulos *Space Grotesk* 500–700, mono *JetBrains Mono* 400–500. Dark-first, cards com borda sutil e brilho ciano discreto, sombra profunda. Tema claro em `:root[data-theme="light"]`, alternância na barra superior, preferência salva no `localStorage`.

| token | dark (padrão) | light |
|---|---|---|
| --bg | #070b18 | #f6f7f9 |
| --bg-elevated | #0f1936 | #ffffff |
| --bg-card | #152242 | #f0f1f3 |
| --input | #152242 | #f8f9fb |
| --input-hover | #1c2b52 | #f0f2f5 |
| --border | #233156 | #e4e4e7 |
| --border-soft | #182241 | #ececef |
| --border-strong | #34446d | #cfd3da |
| --text | #f1f5f9 | #18181b |
| --text-muted | #94a3b8 | #52525b |
| --text-faint | #8391a9 | #71717a |
| --text-faintest | #7a88a1 | #6b6b74 |
| --accent | #22d3ee | #0891b2 |
| --accent-2 | #06b6d4 | #0e7490 |
| --on-accent | #031318 | #ffffff |
| --danger | #f87171 | #dc2626 |
| --danger-bg | rgba(248,113,113,.09) | rgba(220,38,38,.07) |
| --warning | #fbbf24 | #b45309 |
| --warning-bg | rgba(251,191,36,.08) | rgba(217,119,6,.08) |
| --success | #34d399 | #15803d |
| --success-bg | rgba(52,211,153,.1) | rgba(21,128,61,.08) |
| --sombra | 0 28px 60px -30px rgba(2,6,20,.85) | 0 22px 48px -28px rgba(15,23,42,.3) |
| --grade | rgba(255,255,255,.035) | rgba(15,23,42,.05) |
| --veu | rgba(2,6,20,.66) | rgba(15,23,42,.45) |

Cor por categoria (só para o chip/borda do card, derivada dos tokens): campeonatos = accent, recarga = warning, armas = text-muted, municoes = success, pistas = accent-2, treinos = #c4b5fd (dark) / #6d28d9 (light), outros = border-strong.

Layout responsivo: uma coluna no celular (gutter 16 px), duas colunas (lista + nota) a partir de 900 px.

## 11. Tratamento de erros

| Situação | Comportamento |
|---|---|
| Token GitHub inválido / sem permissão | Mensagem na tela e link para a configuração; nada mais carrega |
| Chave Claude inválida ou erro de API | Erro exibido, entrada preservada, botão "Tentar de novo" |
| Áudio falha na transcrição | Mensagem vira `[áudio não transcrito]`, arquivo segue anexado, lote continua |
| Claude devolve JSON fora do schema | Structured output garante o formato; ainda assim `notas.js` valida e rejeita o lote com mensagem clara |
| `PUT notas.json` com sha desatualizado | Recarrega e reaplica uma vez; se falhar de novo, avisa e mantém a revisão na tela |
| Upload de mídia falha no meio | Notas ainda não gravadas; usuário pode repetir "Gravar tudo" (uploads já feitos são refeitos — nome aleatório evita conflito) |
| Sem rede | `fetch` falha → mensagem genérica de conexão |

## 12. Testes

- `node --test test/` (Node 18+), sem framework.
- `whatsapp-parser.test.js`: Android e iOS, mensagem multilinha, anexo com legenda, linhas de sistema, texto colado sem data, corte por `ultimaMensagemProcessada`.
- `notas.test.js`: geração de `id` e colisão, validação de categoria/campos, normalização de busca sem acento, merge de lote no `notas.json`.
- `imagem.js`, `github-api.js`, `claude.js`, `transcricao.js` e as telas: teste manual no `server.js` local com um export real do grupo. Checklist de teste manual no README.

## 13. Fora de escopo (v1)

- Bot/automação do WhatsApp.
- Múltiplos usuários, permissões, compartilhamento.
- Login OAuth "Entrar com GitHub".
- Edição de fotos, exclusão de arquivos de mídia no repositório.
- Campos estruturados por categoria (ex.: calibre como campo próprio) — tags cobrem a busca.
- Exportar PDF (a impressão do navegador resolve).

## 14. Riscos e pontos a confirmar

1. **CORS do Groq** — spike antes de codar `transcricao.js`; alternativa OpenAI pronta (6.2).
2. **SDK do Claude por CDN no navegador** — testar no primeiro passo; alternativa `fetch` direto (6.1).
3. **Formato do export do WhatsApp** muda entre versões/idiomas — o parser cobre os dois formatos conhecidos e o teste manual usa um export real; ajustar regex se aparecer variação.
4. **Foto grande no celular** — redimensionar no canvas resolve tamanho; se a memória do celular reclamar com muitas fotos num lote, processar uma por vez (já é sequencial).
