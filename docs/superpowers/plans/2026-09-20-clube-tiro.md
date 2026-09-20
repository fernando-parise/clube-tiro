# Clube Tiro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App estático (GitHub Pages) que recebe export do WhatsApp / texto / áudio / fotos, transcreve, estrutura em notas com o Claude, grava num repositório privado do GitHub e permite consultar, editar e imprimir.

**Architecture:** HTML/JS puro sem build, no padrão do projeto `meus-habitos`: um `index.html` com três telas (Consultar, Lançar, Configuração), módulos globais em `js/*.js`, credenciais no `localStorage`, dados lidos/gravados direto na Contents API do GitHub. Módulos puros (`notas.js`, `whatsapp-parser.js`) rodam também em Node para teste.

**Tech Stack:** HTML/CSS/JS (ES2017, sem transpilar), `node --test` (Node 18+), JSZip 3.10 (CDN), `@anthropic-ai/sdk` via esm.sh, Groq Whisper API, GitHub Contents API.

**Spec:** `docs/superpowers/specs/2026-09-20-clube-tiro-design.md`

## Global Constraints

- Sem bundler, sem framework, sem `npm install` (as duas bibliotecas externas vêm por CDN).
- Código em `var` + objetos globais (padrão do Hábitos); módulos puros terminam com `if (typeof module !== 'undefined') module.exports = X;`.
- Todo texto de interface em português. Nomes de arquivos/variáveis sem acento.
- Categorias fixas: `recarga`, `campeonatos`, `armas`, `municoes`, `pistas`, `treinos`, `outros`.
- Modelo Claude: `claude-opus-5`, structured output via `output_config.format` (`type: "json_schema"`, todo objeto com `additionalProperties: false`), `fallbacks: "default"` com beta `server-side-fallback-2026-07-01`.
- Transcrição: Groq `whisper-large-v3-turbo`, `language=pt`. Alternativa pronta: OpenAI `whisper-1` (mesma requisição, outra URL/chave).
- Repositório de dados: `clube-tiro-dados` (privado), arquivo único `notas.json` + `midia/AAAA/MM/`.
- Token GitHub fine-grained: só `clube-tiro-dados`, *Contents: read and write*.
- Foto redimensionada no navegador: lado maior 1600 px, JPEG 0.8.
- Cada tarefa termina com commit. Mensagens de commit em português, com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Nunca commitar `notas.json`, `midia/` nem credenciais.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Casca: cabeçalho, nav, as três `<section class="tela">`, scripts |
| `css/tokens.css` | Variáveis Valariss (dark padrão, `[data-theme="light"]`) |
| `css/app.css` | Layout, componentes, `@media print` |
| `js/config.js` | `Config` (localStorage) + `ConfigTela` (formulário e botões Testar) |
| `js/notas.js` | `Notas`: categorias, slug/id, validação, filtro/busca, merge de lote, markdown mínimo |
| `js/whatsapp-parser.js` | `WhatsAppParser.parse` / `filtrarNovas` |
| `js/github-api.js` | `GH`: Contents API (ler/gravar `notas.json`, subir/baixar mídia) |
| `js/imagem.js` | `Imagem.redimensionar` / `blobParaBase64` |
| `js/transcricao.js` | `Transcricao.transcrever` |
| `js/claude.js` (módulo ESM) | `window.ClaudeAPI.estruturar` / `testar` |
| `js/lancar.js` | `Lancar`: entrada → normalização → transcrição → Claude → revisão → gravação |
| `js/consultar.js` | `Consultar`: lista, filtro, busca, nota aberta, editar, excluir, imprimir |
| `js/main.js` | `App`: estado (`dados`, `sha`), navegação, tema, avisos, inicialização |
| `test/*.test.js` | Testes dos módulos puros |
| `server.js`, `*.bat`, `package.json`, `.nojekyll`, `.gitignore`, `README.md` | Infra local e deploy |

Ordem dos `<script>` em `index.html` (classic, nesta ordem): `config.js`, `notas.js`, `whatsapp-parser.js`, `github-api.js`, `imagem.js`, `transcricao.js`, `lancar.js`, `consultar.js`, `main.js`. `claude.js` entra como `<script type="module">` antes de `main.js`. Cada tarefa adiciona a sua tag.

---

### Task 1: Casca do projeto (HTML, CSS, servidor local)

**Files:**
- Create: `index.html`, `css/tokens.css`, `css/app.css`, `server.js`, `iniciar.bat`, `parar.bat`, `atualizar.bat`, `package.json`, `.nojekyll`, `.gitignore`, `README.md`

**Interfaces:**
- Produces: `<section id="tela-consultar|tela-lancar|tela-config" class="tela">`, `<div id="aviso">`, classe `.oculta`, botões `nav button[data-tela]`, `#btn-tema`, `#btn-config`. Classes CSS: `.card`, `.chip`, `.chip.ativo`, `.btn`, `.btn-primario`, `.btn-perigo`, `.campo`, `.linha`, `.vazio`, `.progresso`.

- [ ] **Step 1: Verificar Node**

Run: `node --version`
Expected: `v18` ou maior. Se não houver Node, instalar o LTS de nodejs.org antes de continuar.

- [ ] **Step 2: Criar `package.json`, `.gitignore`, `.nojekyll`**

`package.json`:
```json
{
  "name": "clube-tiro",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "test": "node --test test/"
  }
}
```

`.gitignore`:
```
notas.json
midia/
node_modules/
```

`.nojekyll`: arquivo vazio.

- [ ] **Step 3: Criar `css/tokens.css`**

```css
:root {
  --bg: #070b18;
  --bg-elevated: #0f1936;
  --bg-card: #152242;
  --input: #152242;
  --input-hover: #1c2b52;
  --border: #233156;
  --border-soft: #182241;
  --border-strong: #34446d;
  --text: #f1f5f9;
  --text-muted: #94a3b8;
  --text-faint: #8391a9;
  --text-faintest: #7a88a1;
  --accent: #22d3ee;
  --accent-2: #06b6d4;
  --on-accent: #031318;
  --danger: #f87171;
  --danger-bg: rgba(248, 113, 113, 0.09);
  --warning: #fbbf24;
  --warning-bg: rgba(251, 191, 36, 0.08);
  --success: #34d399;
  --success-bg: rgba(52, 211, 153, 0.1);
  --treinos: #c4b5fd;
  --sombra: 0 28px 60px -30px rgba(2, 6, 20, 0.85);
  --grade: rgba(255, 255, 255, 0.035);
  --veu: rgba(2, 6, 20, 0.66);
  --fonte: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --fonte-titulo: "Space Grotesk", var(--fonte);
  --fonte-mono: "JetBrains Mono", ui-monospace, monospace;
}

:root[data-theme="light"] {
  --bg: #f6f7f9;
  --bg-elevated: #ffffff;
  --bg-card: #f0f1f3;
  --input: #f8f9fb;
  --input-hover: #f0f2f5;
  --border: #e4e4e7;
  --border-soft: #ececef;
  --border-strong: #cfd3da;
  --text: #18181b;
  --text-muted: #52525b;
  --text-faint: #71717a;
  --text-faintest: #6b6b74;
  --accent: #0891b2;
  --accent-2: #0e7490;
  --on-accent: #ffffff;
  --danger: #dc2626;
  --danger-bg: rgba(220, 38, 38, 0.07);
  --warning: #b45309;
  --warning-bg: rgba(217, 119, 6, 0.08);
  --success: #15803d;
  --success-bg: rgba(21, 128, 61, 0.08);
  --treinos: #6d28d9;
  --sombra: 0 22px 48px -28px rgba(15, 23, 42, 0.3);
  --grade: rgba(15, 23, 42, 0.05);
  --veu: rgba(15, 23, 42, 0.45);
}
```

- [ ] **Step 4: Criar `css/app.css`**

```css
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: var(--bg);
  background-image: linear-gradient(var(--grade) 1px, transparent 1px), linear-gradient(90deg, var(--grade) 1px, transparent 1px);
  background-size: 32px 32px;
  color: var(--text);
  font-family: var(--fonte);
  font-size: 15px;
  line-height: 1.5;
  min-height: 100vh;
}
h1, h2, h3 { font-family: var(--fonte-titulo); margin: 0 0 8px; }
a { color: var(--accent); }
code, .mono { font-family: var(--fonte-mono); font-size: 13px; }
.oculta { display: none !important; }

.topo {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 10;
}
.topo .marca { font-family: var(--fonte-titulo); font-weight: 700; letter-spacing: .02em; }
.topo .marca span { color: var(--accent); }
.topo nav { display: flex; gap: 4px; margin-left: 8px; }
.topo nav button, .topo .acoes button {
  background: transparent; color: var(--text-muted);
  border: 1px solid transparent; border-radius: 8px;
  padding: 6px 12px; font: inherit; cursor: pointer;
}
.topo nav button.ativo { color: var(--text); background: var(--bg-card); border-color: var(--border); }
.topo .acoes { margin-left: auto; display: flex; gap: 4px; }

main { max-width: 1100px; margin: 0 auto; padding: 16px; }
.tela h1 { font-size: 22px; }

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: var(--sombra);
  margin-bottom: 12px;
}
.card h3 { font-size: 16px; }
.card .meta { color: var(--text-faint); font-size: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.chip {
  display: inline-block; padding: 2px 10px; border-radius: 999px;
  border: 1px solid var(--border-strong); color: var(--text-muted);
  font-size: 12px; cursor: pointer; background: transparent; font: inherit;
}
.chip.ativo { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.chip[data-cat="campeonatos"] { border-color: var(--accent); color: var(--accent); }
.chip[data-cat="recarga"]     { border-color: var(--warning); color: var(--warning); }
.chip[data-cat="armas"]       { border-color: var(--text-muted); color: var(--text-muted); }
.chip[data-cat="municoes"]    { border-color: var(--success); color: var(--success); }
.chip[data-cat="pistas"]      { border-color: var(--accent-2); color: var(--accent-2); }
.chip[data-cat="treinos"]     { border-color: var(--treinos); color: var(--treinos); }
.chip[data-cat="outros"]      { border-color: var(--border-strong); color: var(--text-faint); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }

.btn {
  background: var(--bg-elevated); color: var(--text);
  border: 1px solid var(--border-strong); border-radius: 8px;
  padding: 8px 14px; font: inherit; cursor: pointer;
}
.btn:hover { background: var(--input-hover); }
.btn:disabled { opacity: .5; cursor: default; }
.btn-primario { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 600; }
.btn-primario:hover { background: var(--accent-2); }
.btn-perigo { color: var(--danger); border-color: var(--danger); background: var(--danger-bg); }
.linha { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 8px 0; }

.campo { display: block; margin-bottom: 10px; }
.campo span { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.campo input, .campo select, .campo textarea {
  width: 100%; background: var(--input); color: var(--text);
  border: 1px solid var(--border); border-radius: 8px;
  padding: 8px 10px; font: inherit;
}
.campo input:focus, .campo select:focus, .campo textarea:focus { outline: none; border-color: var(--accent); }
.campo textarea { min-height: 120px; resize: vertical; }

.vazio { color: var(--text-faint); text-align: center; padding: 32px 0; }
.progresso { color: var(--text-muted); font-size: 13px; margin: 8px 0; }

.aviso {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
  background: var(--bg-elevated); border: 1px solid var(--border-strong);
  color: var(--text); padding: 10px 16px; border-radius: 10px;
  box-shadow: var(--sombra); z-index: 20; max-width: 90vw;
}
.aviso.erro { border-color: var(--danger); background: var(--danger-bg); }
.aviso.ok { border-color: var(--success); background: var(--success-bg); }

.nota-texto ul { margin: 6px 0; padding-left: 20px; }
.nota-texto p { margin: 6px 0; }
.midia-grade { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.midia-grade img { max-width: 160px; max-height: 160px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; }
.midia-grade audio { width: 100%; }

@media (min-width: 900px) {
  .consultar-grade { display: grid; grid-template-columns: 1fr 1.4fr; gap: 16px; align-items: start; }
}
```

- [ ] **Step 5: Criar `index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Clube Tiro</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/app.css">
</head>
<body>
  <header class="topo">
    <div class="marca">Clube<span>Tiro</span></div>
    <nav>
      <button data-tela="consultar" class="ativo">Consultar</button>
      <button data-tela="lancar">Lançar</button>
    </nav>
    <div class="acoes">
      <button id="btn-tema" title="Alternar tema">Tema</button>
      <button id="btn-config" title="Configuração">Config</button>
    </div>
  </header>

  <main>
    <section id="tela-consultar" class="tela">
      <h1>Consultar</h1>
    </section>

    <section id="tela-lancar" class="tela oculta">
      <h1>Lançar</h1>
    </section>

    <section id="tela-config" class="tela oculta">
      <h1>Configuração</h1>
    </section>
  </main>

  <div id="aviso" class="aviso oculta"></div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 6: Criar `js/main.js` mínimo (navegação, tema, aviso)**

```js
// ========== APP: estado, navegacao, tema, avisos ==========
var App = {
  estado: { dados: null, sha: null },

  mostrar: function (tela) {
    document.querySelectorAll('.tela').forEach(function (s) {
      s.classList.toggle('oculta', s.id !== 'tela-' + tela);
    });
    document.querySelectorAll('nav button[data-tela]').forEach(function (b) {
      b.classList.toggle('ativo', b.dataset.tela === tela);
    });
  },

  aviso: function (msg, tipo) {
    var el = document.getElementById('aviso');
    el.textContent = msg;
    el.className = 'aviso ' + (tipo || '');
    clearTimeout(this._avisoTimer);
    this._avisoTimer = setTimeout(function () { el.classList.add('oculta'); }, 5000);
  },

  aplicarTema: function (tema) {
    if (tema === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    localStorage.setItem('ct_tema', tema || 'dark');
  },

  init: function () {
    var self = this;
    this.aplicarTema(localStorage.getItem('ct_tema') || 'dark');
    document.getElementById('btn-tema').addEventListener('click', function () {
      self.aplicarTema(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });
    document.getElementById('btn-config').addEventListener('click', function () { self.mostrar('config'); });
    document.querySelectorAll('nav button[data-tela]').forEach(function (b) {
      b.addEventListener('click', function () { self.mostrar(b.dataset.tela); });
    });
    this.mostrar('consultar');
  }
};

document.addEventListener('DOMContentLoaded', function () { App.init(); });
```

- [ ] **Step 7: Criar `server.js` (estático, porta 3000)**

```js
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const PORT = 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.opus': 'audio/ogg', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4'
};

http.createServer((req, res) => {
  let filePath = decodeURIComponent(req.url.split('?')[0]);
  if (filePath === '/') filePath = '/index.html';
  filePath = path.join(DIR, filePath);
  if (!filePath.startsWith(DIR)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404); res.end('404');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Clube Tiro rodando em http://localhost:${PORT}`);
  console.log(`Na rede local: http://${ipLocal()}:${PORT}`);
});

function ipLocal() {
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}
```

- [ ] **Step 8: Criar os `.bat` (usam a própria pasta, pra sobreviver à mudança de diretório)**

`iniciar.bat`:
```bat
@echo off
cd /d "%~dp0"
echo CreateObject("Wscript.Shell").Run "cmd /c cd /d ""%~dp0"" && node server.js", 0, False > "%temp%\clubetiro_start.vbs"
wscript "%temp%\clubetiro_start.vbs"
timeout /t 2 /nobreak >nul
start http://localhost:3000
```

`parar.bat`:
```bat
@echo off
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1
echo Servidor parado.
```

`atualizar.bat`:
```bat
@echo off
cd /d "%~dp0"
echo.
echo === Clube Tiro - Atualizar GitHub ===
echo.
git status --short
echo.
set /p msg="Mensagem do commit: "
if "%msg%"=="" set msg=Atualizacao do projeto
git add -A
git commit -m "%msg%"
git push
echo.
echo Pronto! Codigo atualizado no GitHub.
pause
```

- [ ] **Step 9: Criar `README.md` inicial**

```markdown
# Clube Tiro

Diário do instrutor: notas do dia a dia (recarga, campeonatos, armas, munições, pistas, treinos) lançadas a partir do WhatsApp, guardadas num repositório privado do GitHub e consultadas de qualquer aparelho.

Spec: `docs/superpowers/specs/2026-09-20-clube-tiro-design.md`

## Rodar local

    iniciar.bat        (ou: node server.js)  -> http://localhost:3000
    parar.bat

## Testes

    npm test

(Seções de configuração e checklist de teste manual são preenchidas na Task 13.)
```

- [ ] **Step 10: Subir o servidor e conferir a casca**

Run: `node server.js` (em outro terminal) e abrir `http://localhost:3000`.
Expected: cabeçalho escuro com "ClubeTiro", botões Consultar/Lançar alternam a seção visível, "Tema" alterna claro/escuro e a escolha sobrevive ao F5. Sem erro no console.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Casca do app: html, tokens Valariss, servidor local

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `notas.js` — modelo e funções puras

**Files:**
- Create: `js/notas.js`, `test/notas.test.js`
- Modify: `index.html` (adicionar `<script src="js/notas.js">` antes de `main.js`)

**Interfaces:**
- Produces (global `Notas`):
  - `CATEGORIAS: string[]`
  - `dadosVazios() -> { versao: 1, ultimaMensagemProcessada: null, notas: [] }`
  - `normalizar(texto) -> string` (minúsculas, sem acento)
  - `slug(texto) -> string`
  - `gerarId(data, titulo, idsExistentes) -> string`
  - `validar(nota) -> { ok: boolean, erros: string[] }`
  - `filtrar(notas, { categoria?, busca? }) -> nota[]` (ordenadas por `data` desc)
  - `mesclarLote(dados, novas, ultimaMensagem) -> dados` (novo objeto; preenche `id` e `criadoEm`)
  - `escaparHtml(s) -> string`
  - `renderMarkdown(texto) -> string` (html)
- Nota: `{ id, data: 'AAAA-MM-DDTHH:MM', categoria, titulo, tags: string[], texto, midia: [{tipo:'imagem'|'audio', arquivo, legenda?, transcricao?}], origem, criadoEm }`

- [ ] **Step 1: Escrever os testes**

`test/notas.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Notas = require('../js/notas.js');

test('slug remove acento, pontuacao e espacos', () => {
  assert.equal(Notas.slug('Campeonato El Patrón!'), 'campeonato-el-patron');
  assert.equal(Notas.slug('   '), 'nota');
});

test('gerarId usa data + slug e resolve colisao com sufixo', () => {
  assert.equal(Notas.gerarId('2026-09-19T21:21', 'Campeonato El Patron', []), '2026-09-19-campeonato-el-patron');
  const ids = ['2026-09-19-campeonato-el-patron', '2026-09-19-campeonato-el-patron-2'];
  assert.equal(Notas.gerarId('2026-09-19T21:21', 'Campeonato El Patron', ids), '2026-09-19-campeonato-el-patron-3');
});

test('validar aceita nota completa e aponta erros', () => {
  const ok = Notas.validar({ data: '2026-09-19T21:21', categoria: 'campeonatos', titulo: 'X', tags: [], texto: '' });
  assert.deepEqual(ok, { ok: true, erros: [] });
  const ruim = Notas.validar({ data: 'ontem', categoria: 'festa', titulo: '', tags: 'a', texto: 1 });
  assert.equal(ruim.ok, false);
  assert.equal(ruim.erros.length, 5);
});

test('filtrar por categoria e busca sem acento, ordena por data desc', () => {
  const notas = [
    { data: '2026-09-01T10:00', categoria: 'recarga', titulo: 'Receita .38', tags: ['38'], texto: 'pólvora' },
    { data: '2026-09-19T21:21', categoria: 'campeonatos', titulo: 'El Patron', tags: ['7 metros'], texto: '' },
    { data: '2026-09-10T08:00', categoria: 'campeonatos', titulo: 'Head Shot', tags: [], texto: 'Cabeça' },
  ];
  assert.deepEqual(Notas.filtrar(notas, { categoria: 'campeonatos' }).map(n => n.titulo), ['El Patron', 'Head Shot']);
  assert.deepEqual(Notas.filtrar(notas, { busca: 'cabeca' }).map(n => n.titulo), ['Head Shot']);
  assert.deepEqual(Notas.filtrar(notas, { busca: 'POLVORA' }).map(n => n.titulo), ['Receita .38']);
  assert.deepEqual(Notas.filtrar(notas, { busca: '7 metros' }).map(n => n.titulo), ['El Patron']);
  assert.equal(Notas.filtrar(notas, {}).length, 3);
});

test('mesclarLote gera ids, criadoEm e atualiza ultimaMensagemProcessada', () => {
  const dados = { versao: 1, ultimaMensagemProcessada: '2026-09-10T08:00', notas: [{ id: '2026-09-19-el-patron', data: '2026-09-19T21:21', titulo: 'El Patron' }] };
  const novas = [
    { data: '2026-09-19T21:22', categoria: 'campeonatos', titulo: 'El Patron', tags: [], texto: '', midia: [], origem: 'colado' },
    { data: '2026-09-19T21:23', categoria: 'outros', titulo: 'Head Shot', tags: [], texto: '', midia: [], origem: 'colado' },
  ];
  const r = Notas.mesclarLote(dados, novas, '2026-09-19T21:25');
  assert.equal(r.notas.length, 3);
  assert.equal(r.notas[1].id, '2026-09-19-el-patron-2');
  assert.equal(r.notas[2].id, '2026-09-19-head-shot');
  assert.ok(r.notas[1].criadoEm);
  assert.equal(r.ultimaMensagemProcessada, '2026-09-19T21:25');
  assert.equal(dados.notas.length, 1, 'nao muta o original');
  const r2 = Notas.mesclarLote(r, [], '2026-09-01T00:00');
  assert.equal(r2.ultimaMensagemProcessada, '2026-09-19T21:25', 'nao volta no tempo');
});

test('renderMarkdown faz lista, negrito, paragrafo e escapa html', () => {
  const html = Notas.renderMarkdown('Regras **7 metros**\n- 3 tiros peito\n- 3 tiros <cabeça>\n\nFim');
  assert.equal(html, '<p>Regras <strong>7 metros</strong></p><ul><li>3 tiros peito</li><li>3 tiros &lt;cabeça&gt;</li></ul><p>Fim</p>');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/notas.js'`.

- [ ] **Step 3: Implementar `js/notas.js`**

```js
// ========== MODELO DE NOTAS (funcoes puras, roda no navegador e no Node) ==========
var Notas = {
  CATEGORIAS: ['recarga', 'campeonatos', 'armas', 'municoes', 'pistas', 'treinos', 'outros'],

  dadosVazios: function () {
    return { versao: 1, ultimaMensagemProcessada: null, notas: [] };
  },

  normalizar: function (texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  },

  slug: function (texto) {
    return this.normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'nota';
  },

  gerarId: function (data, titulo, idsExistentes) {
    var base = String(data).slice(0, 10) + '-' + this.slug(titulo);
    var existe = new Set(idsExistentes || []);
    if (!existe.has(base)) return base;
    for (var n = 2; ; n++) {
      if (!existe.has(base + '-' + n)) return base + '-' + n;
    }
  },

  validar: function (nota) {
    var erros = [];
    if (!nota || typeof nota !== 'object') return { ok: false, erros: ['nota vazia'] };
    if (!nota.titulo || !String(nota.titulo).trim()) erros.push('titulo obrigatorio');
    if (this.CATEGORIAS.indexOf(nota.categoria) < 0) erros.push('categoria invalida: ' + nota.categoria);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(nota.data || ''))) erros.push('data invalida: ' + nota.data);
    if (typeof nota.texto !== 'string') erros.push('texto deve ser texto');
    if (!Array.isArray(nota.tags)) erros.push('tags deve ser lista');
    return { ok: erros.length === 0, erros: erros };
  },

  filtrar: function (notas, filtro) {
    filtro = filtro || {};
    var busca = this.normalizar(filtro.busca || '').trim();
    var self = this;
    return (notas || []).filter(function (n) {
      if (filtro.categoria && n.categoria !== filtro.categoria) return false;
      if (!busca) return true;
      var alvo = self.normalizar([n.titulo, n.texto, (n.tags || []).join(' ')].join(' '));
      return alvo.indexOf(busca) >= 0;
    }).sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
  },

  mesclarLote: function (dados, novas, ultimaMensagem) {
    var ids = dados.notas.map(function (n) { return n.id; });
    var self = this;
    var adicionadas = (novas || []).map(function (n) {
      var id = self.gerarId(n.data, n.titulo, ids);
      ids.push(id);
      return Object.assign({}, n, { id: id, criadoEm: n.criadoEm || new Date().toISOString().slice(0, 19) });
    });
    var ultima = dados.ultimaMensagemProcessada || null;
    if (ultimaMensagem && (!ultima || ultimaMensagem > ultima)) ultima = ultimaMensagem;
    return { versao: dados.versao || 1, ultimaMensagemProcessada: ultima, notas: dados.notas.concat(adicionadas) };
  },

  escaparHtml: function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  renderMarkdown: function (texto) {
    var self = this;
    var html = '', emLista = false;
    function inline(s) { return self.escaparHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }
    String(texto || '').split(/\r?\n/).forEach(function (l) {
      var item = l.match(/^\s*[-*]\s+(.*)$/);
      if (item) {
        if (!emLista) { html += '<ul>'; emLista = true; }
        html += '<li>' + inline(item[1]) + '</li>';
      } else {
        if (emLista) { html += '</ul>'; emLista = false; }
        if (l.trim()) html += '<p>' + inline(l) + '</p>';
      }
    });
    if (emLista) html += '</ul>';
    return html;
  }
};

if (typeof module !== 'undefined') module.exports = Notas;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: 6 testes de `notas.test.js` passando.

- [ ] **Step 5: Incluir no `index.html`**

Antes de `<script src="js/main.js">`:
```html
<script src="js/notas.js"></script>
```

- [ ] **Step 6: Commit**

```bash
git add js/notas.js test/notas.test.js index.html
git commit -m "Modelo de notas: id, validacao, filtro, merge, markdown

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `whatsapp-parser.js` — export do WhatsApp para mensagens

**Files:**
- Create: `js/whatsapp-parser.js`, `test/whatsapp-parser.test.js`
- Modify: `index.html`

**Interfaces:**
- Produces (global `WhatsAppParser`):
  - `parse(texto, agoraISO?) -> mensagem[]` com `mensagem = { data: 'AAAA-MM-DDTHH:MM', autor: string|null, texto: string, anexo: string|null }`
  - `filtrarNovas(mensagens, ultimaMensagemProcessada) -> mensagem[]` (só `data > ultima`)

- [ ] **Step 1: Escrever os testes**

`test/whatsapp-parser.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/whatsapp-parser.js');

const ANDROID = [
  '19/09/2026 21:20 - Mensagens e chamadas são protegidas com a criptografia de ponta a ponta.',
  '19/09/2026 21:21 - Fernando: ============================',
  'Campeonao El Patron',
  '3 Tiros Peito',
  '============================',
  '19/09/2026 21:23 - Fernando: IMG-20260919-WA0001.jpg (arquivo anexado)',
  'alvo 4 cores',
  '19/09/2026 21:25 - Fernando: PTT-20260919-WA0002.opus (arquivo anexado)',
  '19/09/2026 21:26 - Fernando: <Mídia oculta>',
].join('\n');

test('android: separa mensagens, multilinha, anexo com legenda, descarta sistema', () => {
  const m = P.parse(ANDROID);
  assert.equal(m.length, 3);
  assert.deepEqual(m[0], { data: '2026-09-19T21:21', autor: 'Fernando', texto: '============================\nCampeonao El Patron\n3 Tiros Peito\n============================', anexo: null });
  assert.deepEqual(m[1], { data: '2026-09-19T21:23', autor: 'Fernando', texto: 'alvo 4 cores', anexo: 'IMG-20260919-WA0001.jpg' });
  assert.deepEqual(m[2], { data: '2026-09-19T21:25', autor: 'Fernando', texto: '', anexo: 'PTT-20260919-WA0002.opus' });
});

test('ios: formato com colchetes, segundos e <anexado: ...>', () => {
  const ios = [
    '‎[19/09/2026, 21:21:05] Fernando: Campeonato Head Shot',
    '2 Tiros Cabeça',
    '[19/09/2026, 21:23:40] Fernando: ‎<anexado: 00000012-PHOTO-2026-09-19-21-23-40.jpg>',
    'alvo',
  ].join('\n');
  const m = P.parse(ios);
  assert.equal(m.length, 2);
  assert.equal(m[0].data, '2026-09-19T21:21');
  assert.equal(m[0].texto, 'Campeonato Head Shot\n2 Tiros Cabeça');
  assert.equal(m[1].anexo, '00000012-PHOTO-2026-09-19-21-23-40.jpg');
  assert.equal(m[1].texto, 'alvo');
});

test('texto colado sem data vira uma mensagem com data = agora', () => {
  const m = P.parse('Campeonato Gauge Reload\nTiro com Recarga\n2 tiros com a Cal. 12', '2026-09-20T10:00');
  assert.equal(m.length, 1);
  assert.deepEqual(m[0], { data: '2026-09-20T10:00', autor: null, texto: 'Campeonato Gauge Reload\nTiro com Recarga\n2 tiros com a Cal. 12', anexo: null });
});

test('ano com dois digitos e hora com um digito', () => {
  const m = P.parse('5/1/26 9:07 - Fernando: teste');
  assert.equal(m[0].data, '2026-01-05T09:07');
});

test('filtrarNovas mantem so mensagens depois da ultima processada', () => {
  const m = P.parse(ANDROID);
  assert.equal(P.filtrarNovas(m, '2026-09-19T21:23').length, 1);
  assert.equal(P.filtrarNovas(m, null).length, 3);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/whatsapp-parser.js'`.

- [ ] **Step 3: Implementar `js/whatsapp-parser.js`**

```js
// ========== PARSER DO EXPORT DO WHATSAPP (funcao pura) ==========
var WhatsAppParser = {
  // Android: "19/09/2026 21:21 - Fernando: texto"   (aceita virgula depois da data e am/pm)
  RE_ANDROID: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),? (\d{1,2}):(\d{2})(?::\d{2})?\s?(?:[ap]\.?m\.?)?\s-\s([^:]+?):\s?(.*)$/i,
  // iOS: "[19/09/2026, 21:21:05] Fernando: texto"
  RE_IOS: /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),? (\d{1,2}):(\d{2})(?::\d{2})?\]\s([^:]+?):\s?(.*)$/,
  // Linha que comeca com data mas sem "Autor:" = mensagem de sistema
  RE_LINHA_DATA: /^\[?\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}(?::\d{2})?\]?\s?(?:[ap]\.?m\.?)?\s?-?\s/i,
  RE_ANEXO_ANDROID: /^(\S+\.(?:jpe?g|png|webp|gif|opus|ogg|m4a|mp3|wav|mp4|pdf))\s\(arquivo anexado\)\s*/i,
  RE_ANEXO_IOS: /^<anexado:\s*([^>]+?)\s*>\s*/i,
  SISTEMA: [/mensagens e chamadas s[aã]o protegidas/i, /criou o grupo/i, /^<m[ií]dia oculta>$/i, /adicionou voc[eê]/i, /mudou o nome do grupo/i, /^mensagem apagada$/i],

  parse: function (texto, agora) {
    var self = this;
    var mensagens = [], atual = null;

    String(texto || '').split(/\r?\n/).forEach(function (bruta) {
      var linha = bruta.replace(/‎/g, '');
      var m = linha.match(self.RE_ANDROID) || linha.match(self.RE_IOS);
      if (m) {
        if (atual) mensagens.push(self._fechar(atual));
        atual = { data: self._data(m[1], m[2], m[3], m[4], m[5]), autor: m[6].trim(), texto: m[7], anexo: null };
      } else if (self.RE_LINHA_DATA.test(linha)) {
        if (atual) mensagens.push(self._fechar(atual));
        atual = null; // linha de sistema: descarta
      } else if (atual) {
        atual.texto += '\n' + linha;
      } else if (linha.trim()) {
        atual = { data: null, autor: null, texto: linha, anexo: null };
      }
    });
    if (atual) mensagens.push(self._fechar(atual));

    var agoraIso = agora || new Date().toISOString().slice(0, 16);
    return mensagens
      .filter(function (msg) { return !self._ehSistema(msg); })
      .map(function (msg) { if (!msg.data) msg.data = agoraIso; return msg; })
      .filter(function (msg) { return msg.texto || msg.anexo; });
  },

  filtrarNovas: function (mensagens, ultima) {
    if (!ultima) return mensagens;
    return mensagens.filter(function (m) { return m.data > ultima; });
  },

  _fechar: function (msg) {
    var t = msg.texto.trim();
    var a = t.match(this.RE_ANEXO_ANDROID) || t.match(this.RE_ANEXO_IOS);
    if (a) { msg.anexo = a[1].trim(); t = t.slice(a[0].length); }
    msg.texto = t.trim();
    return msg;
  },

  _data: function (d, m, a, h, min) {
    if (a.length === 2) a = '20' + a;
    return a + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0') + 'T' + h.padStart(2, '0') + ':' + min;
  },

  // Testa autor + texto: "Fernando criou o grupo "Notas: tiro"" cai no RE_ANDROID com autor errado
  _ehSistema: function (msg) {
    var t = ((msg.autor || '') + ' ' + msg.texto).trim();
    var soTexto = String(msg.texto).trim();
    return this.SISTEMA.some(function (re) { return re.test(t) || re.test(soTexto); });
  }
};

if (typeof module !== 'undefined') module.exports = WhatsAppParser;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: todos os testes (notas + parser) passando.

- [ ] **Step 5: Incluir no `index.html`** (depois de `notas.js`)

```html
<script src="js/whatsapp-parser.js"></script>
```

- [ ] **Step 6: Commit**

```bash
git add js/whatsapp-parser.js test/whatsapp-parser.test.js index.html
git commit -m "Parser do export do WhatsApp (Android e iOS)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `config.js` — credenciais e tela de configuração

**Files:**
- Create: `js/config.js`
- Modify: `index.html` (seção `#tela-config` + script), `js/main.js`

**Interfaces:**
- Produces (global `Config`): `load() -> obj|null`, `save(obj)`, `clear()`, `get(campo) -> string`, `isConfigured() -> boolean`. Campos: `ghUser, ghRepo, ghToken, claudeKey, groqKey`. Chave localStorage `ct_config`.
- Produces (global `ConfigTela`): `init()`. Os botões "Testar GitHub" / "Testar Claude" chamam `GH.testar(user, repo, token)` (Task 5) e `window.ClaudeAPI.testar(chave)` (Task 8); enquanto esses módulos não existem, o botão mostra "módulo ainda não carregado".
- Consumes: `App.aviso`, `App.mostrar`, `App.recarregar` (Task 5 adiciona `recarregar`; aqui só chamamos se existir).

- [ ] **Step 1: Markup da tela em `index.html`** (substituir o conteúdo de `#tela-config`)

```html
<section id="tela-config" class="tela oculta">
  <h1>Configuração</h1>
  <div class="card">
    <h3>GitHub (dados)</h3>
    <label class="campo"><span>Usuário do GitHub</span><input id="cfg-ghUser" autocomplete="off" placeholder="fernando-parise"></label>
    <label class="campo"><span>Repositório privado de dados</span><input id="cfg-ghRepo" autocomplete="off" value="clube-tiro-dados"></label>
    <label class="campo"><span>Token fine-grained (Contents: read/write só nesse repositório)</span><input id="cfg-ghToken" type="password" autocomplete="off"></label>
    <div class="linha"><button class="btn" id="cfg-testar-gh">Testar GitHub</button><span id="cfg-res-gh" class="progresso"></span></div>
  </div>
  <div class="card">
    <h3>Claude (estruturação das notas)</h3>
    <label class="campo"><span>Chave da API (console.anthropic.com)</span><input id="cfg-claudeKey" type="password" autocomplete="off"></label>
    <div class="linha"><button class="btn" id="cfg-testar-claude">Testar Claude</button><span id="cfg-res-claude" class="progresso"></span></div>
  </div>
  <div class="card">
    <h3>Groq (transcrição de áudio)</h3>
    <label class="campo"><span>Chave da API (console.groq.com)</span><input id="cfg-groqKey" type="password" autocomplete="off"></label>
  </div>
  <div class="linha">
    <button class="btn btn-primario" id="cfg-salvar">Salvar</button>
    <button class="btn btn-perigo" id="cfg-limpar">Limpar tudo</button>
  </div>
</section>
```

- [ ] **Step 2: Implementar `js/config.js`**

```js
// ========== CONFIGURACAO (localStorage) ==========
var Config = {
  CHAVE: 'ct_config',
  CAMPOS: ['ghUser', 'ghRepo', 'ghToken', 'claudeKey', 'groqKey'],
  dados: null,

  load: function () {
    try { this.dados = JSON.parse(localStorage.getItem(this.CHAVE)) || null; }
    catch (e) { this.dados = null; }
    return this.dados;
  },

  save: function (obj) {
    var d = {};
    this.CAMPOS.forEach(function (c) { d[c] = String(obj[c] || '').trim(); });
    if (!d.ghRepo) d.ghRepo = 'clube-tiro-dados';
    localStorage.setItem(this.CHAVE, JSON.stringify(d));
    this.dados = d;
  },

  clear: function () {
    localStorage.removeItem(this.CHAVE);
    this.dados = null;
  },

  get: function (campo) { return (this.dados || {})[campo] || ''; },

  isConfigured: function () {
    return !!(this.get('ghUser') && this.get('ghRepo') && this.get('ghToken'));
  }
};

// ========== TELA DE CONFIGURACAO ==========
var ConfigTela = {
  init: function () {
    var self = this;
    this.preencher();
    document.getElementById('cfg-salvar').addEventListener('click', function () { self.salvar(); });
    document.getElementById('cfg-limpar').addEventListener('click', function () {
      if (!confirm('Apagar todas as credenciais deste navegador?')) return;
      Config.clear();
      self.preencher();
      App.aviso('Configuração apagada.');
    });
    document.getElementById('cfg-testar-gh').addEventListener('click', function () { self.testarGitHub(); });
    document.getElementById('cfg-testar-claude').addEventListener('click', function () { self.testarClaude(); });
  },

  preencher: function () {
    Config.CAMPOS.forEach(function (c) {
      document.getElementById('cfg-' + c).value = Config.get(c) || (c === 'ghRepo' ? 'clube-tiro-dados' : '');
    });
  },

  ler: function () {
    var obj = {};
    Config.CAMPOS.forEach(function (c) { obj[c] = document.getElementById('cfg-' + c).value; });
    return obj;
  },

  salvar: async function () {
    Config.save(this.ler());
    App.aviso('Configuração salva.', 'ok');
    if (typeof App.recarregar === 'function') {
      try {
        await App.recarregar();
        if (typeof Consultar !== 'undefined') Consultar.render();
        App.mostrar('consultar');
      } catch (e) { App.aviso('Salvo, mas não consegui ler o repositório: ' + e.message, 'erro'); }
    }
  },

  testarGitHub: async function () {
    var r = document.getElementById('cfg-res-gh'), c = this.ler();
    if (typeof GH === 'undefined') { r.textContent = 'módulo ainda não carregado'; return; }
    r.textContent = 'testando...';
    try { r.textContent = (await GH.testar(c.ghUser, c.ghRepo, c.ghToken)) ? 'OK, repositório acessível' : 'Falhou: verifique usuário, repositório e token'; }
    catch (e) { r.textContent = 'Erro: ' + e.message; }
  },

  testarClaude: async function () {
    var r = document.getElementById('cfg-res-claude'), c = this.ler();
    if (!window.ClaudeAPI) { r.textContent = 'módulo ainda não carregado'; return; }
    r.textContent = 'testando...';
    try { r.textContent = (await window.ClaudeAPI.testar(c.claudeKey)) ? 'OK' : 'Falhou'; }
    catch (e) { r.textContent = 'Erro: ' + e.message; }
  }
};
```

- [ ] **Step 3: Ligar em `main.js`**

Em `App.init`, logo depois de `this.aplicarTema(...)`:
```js
    Config.load();
    ConfigTela.init();
```
E no fim de `init`, trocar `this.mostrar('consultar');` por:
```js
    if (!Config.isConfigured()) { this.mostrar('config'); return; }
    this.mostrar('consultar');
```

- [ ] **Step 4: Incluir o script em `index.html`** — `config.js` deve ser o **primeiro** script depois do JSZip:

```html
<script src="js/config.js"></script>
```

- [ ] **Step 5: Testar no navegador**

Abrir `http://localhost:3000` (com localStorage limpo: DevTools → Application → Local Storage → limpar).
Expected: abre direto na tela Configuração. Preencher usuário e um token qualquer, Salvar → aviso verde, campos persistem após F5. "Testar GitHub" mostra "módulo ainda não carregado". "Limpar tudo" pede confirmação e esvazia.

- [ ] **Step 6: Commit**

```bash
git add js/config.js js/main.js index.html
git commit -m "Tela de configuracao e credenciais no localStorage

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `github-api.js` — Contents API do repositório de dados

**Files:**
- Create: `js/github-api.js`
- Modify: `index.html`, `js/main.js`

**Interfaces:**
- Consumes: `Config.get`, `Notas.dadosVazios`.
- Produces (global `GH`):
  - `getFile(path) -> Promise<{ conteudo: string, sha } | null>` (null em 404)
  - `putFile(path, base64, mensagem, sha?) -> Promise<{ sha }>`; lança `GH.ConflitoError` em 409/422
  - `getBlobUrl(path) -> Promise<string>` (object URL, cache por sessão)
  - `carregarNotas() -> Promise<{ dados, sha }>` (cria `notas.json` se não existir)
  - `salvarNotas(dados, sha) -> Promise<{ sha }>`
  - `testar(user, repo, token) -> Promise<boolean>`
  - `encodeBase64Texto(texto) -> string`
- Produces (em `App`): `App.recarregar() -> Promise<{dados, sha}>` que popula `App.estado`.

- [ ] **Step 1: Preparar o repositório de dados (manual, uma vez)**

1. No GitHub: novo repositório `clube-tiro-dados`, **Private**, sem README.
2. Settings → Developer settings → Personal access tokens → Fine-grained → Generate: Repository access = *Only select repositories* → `clube-tiro-dados`; Permissions → Repository → *Contents: Read and write*. Copiar o token.
3. No app (Configuração): usuário, repositório, token → Salvar.

- [ ] **Step 2: Implementar `js/github-api.js`**

```js
// ========== GITHUB CONTENTS API (repositorio privado de dados) ==========
var GH = {
  _cacheBlob: {},

  ConflitoError: function (msg) { this.name = 'ConflitoError'; this.message = msg; },

  _base: function () {
    return 'https://api.github.com/repos/' + Config.get('ghUser') + '/' + Config.get('ghRepo') + '/contents/';
  },

  _headers: function (extra) {
    return Object.assign({
      'Authorization': 'Bearer ' + Config.get('ghToken'),
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }, extra || {});
  },

  decodeBase64Texto: function (b64) {
    var bin = atob(b64.replace(/\n/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  },

  encodeBase64Texto: function (texto) {
    var bytes = new TextEncoder().encode(texto), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  },

  getFile: async function (path) {
    var r = await fetch(this._base() + path, { headers: this._headers() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('GitHub ' + r.status + ' ao ler ' + path);
    var j = await r.json();
    var conteudo = j.content ? this.decodeBase64Texto(j.content) : null;
    if (conteudo === null) { // arquivo > 1 MB: content vem vazio, busca o raw
      var raw = await fetch(this._base() + path, { headers: this._headers({ 'Accept': 'application/vnd.github.raw+json' }) });
      if (!raw.ok) throw new Error('GitHub ' + raw.status + ' ao ler raw ' + path);
      conteudo = await raw.text();
    }
    return { conteudo: conteudo, sha: j.sha };
  },

  putFile: async function (path, base64, mensagem, sha) {
    var body = { message: mensagem, content: base64 };
    if (sha) body.sha = sha;
    var r = await fetch(this._base() + path, {
      method: 'PUT',
      headers: this._headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    });
    if (r.status === 409 || r.status === 422) throw new GH.ConflitoError('Conflito ao gravar ' + path);
    if (!r.ok) throw new Error('GitHub ' + r.status + ' ao gravar ' + path);
    var j = await r.json();
    return { sha: j.content.sha };
  },

  getBlobUrl: async function (path) {
    if (this._cacheBlob[path]) return this._cacheBlob[path];
    var r = await fetch(this._base() + path, { headers: this._headers({ 'Accept': 'application/vnd.github.raw+json' }) });
    if (!r.ok) throw new Error('GitHub ' + r.status + ' ao baixar ' + path);
    var url = URL.createObjectURL(await r.blob());
    this._cacheBlob[path] = url;
    return url;
  },

  carregarNotas: async function () {
    var f = await this.getFile('notas.json');
    if (!f) {
      var vazio = Notas.dadosVazios();
      var r = await this.putFile('notas.json', this.encodeBase64Texto(JSON.stringify(vazio, null, 2)), 'Cria notas.json');
      return { dados: vazio, sha: r.sha };
    }
    return { dados: JSON.parse(f.conteudo), sha: f.sha };
  },

  salvarNotas: async function (dados, sha) {
    var texto = JSON.stringify(dados, null, 2);
    return this.putFile('notas.json', this.encodeBase64Texto(texto), 'Atualiza notas (' + dados.notas.length + ')', sha);
  },

  testar: async function (user, repo, token) {
    var r = await fetch('https://api.github.com/repos/' + user + '/' + repo, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
    });
    return r.ok;
  }
};
```

- [ ] **Step 3: `App.recarregar` e inicialização em `main.js`**

Adicionar ao objeto `App`:
```js
  recarregar: async function () {
    var r = await GH.carregarNotas();
    this.estado = r;
    return r;
  },
```

Trocar o final de `init` por:
```js
    if (!Config.isConfigured()) { this.mostrar('config'); return; }
    try {
      await this.recarregar();
    } catch (e) {
      this.aviso('Não consegui ler o repositório de dados: ' + e.message, 'erro');
      this.mostrar('config');
      return;
    }
    this.mostrar('consultar');
```
e declarar `init: async function () {`.

- [ ] **Step 4: Incluir o script em `index.html`** (depois de `whatsapp-parser.js`)

```html
<script src="js/github-api.js"></script>
```

- [ ] **Step 5: Testar no navegador**

1. Configuração → "Testar GitHub" → "OK, repositório acessível". Com token errado → "Falhou".
2. F5. Expected: abre em Consultar, sem erro; no GitHub, `clube-tiro-dados` agora tem `notas.json` com `{"versao":1,"ultimaMensagemProcessada":null,"notas":[]}`.
3. No console:
```js
await GH.putFile('midia/teste.txt', GH.encodeBase64Texto('olá'), 'teste')
await GH.getBlobUrl('midia/teste.txt')   // retorna blob:http://localhost:3000/...
```
Expected: os dois resolvem sem erro. Apagar `midia/teste.txt` pelo site do GitHub depois.
4. Conflito: `await GH.salvarNotas(App.estado.dados, 'sha-errado')` → lança `ConflitoError`.

- [ ] **Step 6: Commit**

```bash
git add js/github-api.js js/main.js index.html
git commit -m "Contents API: ler/gravar notas.json e midia no repositorio privado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `imagem.js` — redimensionar foto no navegador

**Files:**
- Create: `js/imagem.js`
- Modify: `index.html`

**Interfaces:**
- Produces (global `Imagem`): `redimensionar(file, maxLado=1600, qualidade=0.8) -> Promise<Blob image/jpeg>`, `blobParaBase64(blob) -> Promise<string>` (sem o prefixo `data:`).

- [ ] **Step 1: Implementar `js/imagem.js`**

```js
// ========== IMAGEM: redimensiona no canvas e converte para base64 ==========
var Imagem = {
  redimensionar: function (file, maxLado, qualidade) {
    maxLado = maxLado || 1600;
    qualidade = qualidade || 0.8;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error('Falha ao converter imagem'));
        }, 'image/jpeg', qualidade);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Imagem inválida: ' + (file.name || ''))); };
      img.src = url;
    });
  },

  blobParaBase64: function (blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(blob);
    });
  }
};
```

(Navegadores atuais aplicam a orientação EXIF ao decodificar a `<img>`, então a foto de celular sai em pé.)

- [ ] **Step 2: Incluir em `index.html`** (depois de `github-api.js`)

```html
<script src="js/imagem.js"></script>
```

- [ ] **Step 3: Testar no console**

Adicionar temporariamente `<input type="file" id="tmp">` no HTML **ou** usar o console:
```js
var inp = document.createElement('input'); inp.type = 'file'; inp.onchange = async () => {
  var b = await Imagem.redimensionar(inp.files[0]); console.log(inp.files[0].size, '->', b.size, b.type);
  console.log((await Imagem.blobParaBase64(b)).slice(0, 20));
}; inp.click();
```
Expected: uma foto de 3–5 MB vira ~200–400 KB `image/jpeg`; base64 começa com `/9j/`.

- [ ] **Step 4: Commit**

```bash
git add js/imagem.js index.html
git commit -m "Redimensionar imagem no navegador

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `transcricao.js` — áudio para texto (Groq)

**Files:**
- Create: `js/transcricao.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `Config.get('groqKey')`.
- Produces (global `Transcricao`): `transcrever(blob, nome) -> Promise<string>`; lança `Error` em falha.

- [ ] **Step 1: Implementar `js/transcricao.js`**

```js
// ========== TRANSCRICAO DE AUDIO (Groq, API compativel com Whisper) ==========
var Transcricao = {
  URL: 'https://api.groq.com/openai/v1/audio/transcriptions',
  MODELO: 'whisper-large-v3-turbo',
  CHAVE: 'groqKey',
  // Alternativa (se o Groq nao aceitar chamada do navegador):
  //   URL: 'https://api.openai.com/v1/audio/transcriptions', MODELO: 'whisper-1', CHAVE: 'openaiKey'
  //   e acrescentar 'openaiKey' em Config.CAMPOS + campo na tela de configuracao.

  transcrever: async function (blob, nome) {
    var fd = new FormData();
    fd.append('file', blob, nome || 'audio.ogg');
    fd.append('model', this.MODELO);
    fd.append('language', 'pt');
    fd.append('response_format', 'json');
    var r = await fetch(this.URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Config.get(this.CHAVE) },
      body: fd
    });
    if (!r.ok) throw new Error('Transcrição ' + r.status + ': ' + (await r.text()).slice(0, 200));
    var j = await r.json();
    return String(j.text || '').trim();
  }
};
```

- [ ] **Step 2: Incluir em `index.html`** (depois de `imagem.js`)

```html
<script src="js/transcricao.js"></script>
```

- [ ] **Step 3: Spike de CORS (obrigatório antes de seguir)**

1. Criar chave em console.groq.com, salvar na Configuração.
2. Pegar um `PTT-*.opus` de um export do WhatsApp (ou qualquer `.ogg/.mp3` curto).
3. No console:
```js
var inp = document.createElement('input'); inp.type = 'file'; inp.onchange = async () => {
  console.log(await Transcricao.transcrever(inp.files[0], inp.files[0].name));
}; inp.click();
```
Expected: o texto do áudio em português.
Se aparecer erro de CORS (`blocked by CORS policy` no console): trocar `URL`, `MODELO` e `CHAVE` pela alternativa comentada no arquivo, adicionar `openaiKey` em `Config.CAMPOS` e um campo `cfg-openaiKey` na tela (mesmo padrão do `cfg-groqKey`), e repetir o teste. Registrar a decisão no README (Task 13).

- [ ] **Step 4: Commit**

```bash
git add js/transcricao.js index.html
git commit -m "Transcricao de audio via API Whisper

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: `claude.js` — mensagens para notas estruturadas

**Files:**
- Create: `js/claude.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `Config.get('claudeKey')`; mensagens no formato `{ data, texto, anexo, tipoAnexo? }` (Task 9 acrescenta `tipoAnexo: 'imagem'|'audio'`).
- Produces (`window.ClaudeAPI`):
  - `estruturar(mensagens) -> Promise<proposta[]>` com `proposta = { data, categoria, titulo, tags: string[], texto, anexos: string[] }` (nomes originais dos anexos)
  - `testar(chave) -> Promise<boolean>`

- [ ] **Step 1: Implementar `js/claude.js` (módulo ESM)**

```js
// ========== CLAUDE: estrutura mensagens em notas ==========
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk';

var CATEGORIAS = ['recarga', 'campeonatos', 'armas', 'municoes', 'pistas', 'treinos', 'outros'];

var SCHEMA = {
  type: 'object',
  properties: {
    notas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'Data/hora da primeira mensagem da nota, formato AAAA-MM-DDTHH:MM' },
          categoria: { type: 'string', enum: CATEGORIAS },
          titulo: { type: 'string', description: 'Curto e específico' },
          tags: { type: 'array', items: { type: 'string' } },
          texto: { type: 'string', description: 'Markdown simples: parágrafos, listas com "- ", **negrito**' },
          anexos: { type: 'array', items: { type: 'string' }, description: 'Nomes exatos dos anexos que pertencem a esta nota' }
        },
        required: ['data', 'categoria', 'titulo', 'tags', 'texto', 'anexos'],
        additionalProperties: false
      }
    }
  },
  required: ['notas'],
  additionalProperties: false
};

var SYSTEM = [
  'Você organiza as anotações de um instrutor de tiro esportivo de um clube no Brasil. Recebe mensagens copiadas de um grupo do WhatsApp (texto, transcrições de áudio, legendas de fotos) e devolve uma lista de notas.',
  '',
  'Regras:',
  '- Agrupe mensagens que tratam do mesmo assunto numa nota só; nunca junte assuntos diferentes. Blocos separados por linhas de "=====" são notas separadas.',
  '- Categorias: recarga (recarga de munição, componentes, receitas); campeonatos (provas, estágios, regras de competição); armas (armas, manutenção, peças, ajustes); municoes (munições, calibres, preços, fornecedores); pistas (pistas e estandes do clube, montagem, procedimentos); treinos (treinos, exercícios, aulas, alunos); outros (o que não couber acima).',
  '- Título curto e específico (ex.: "Campeonato El Patron", "Preço CBC .38 setembro").',
  '- Tags: termos úteis para busca — calibre, distância, nome da prova, arma, fornecedor. Minúsculas, sem repetir o título inteiro.',
  '- Texto em markdown simples: parágrafos, listas com "- " e **negrito**. Fiel ao original: corrija só grafia óbvia, reorganize em lista quando fizer sentido, não invente nem complete informação.',
  '- Uma foto com legenda vira nota própria quando é assunto por si; se descreve algo que outra mensagem próxima está tratando, entra naquela nota. Cada anexo aparece em no máximo uma nota, pelo nome exato informado em "(anexo: ...)". Anexo sem nenhuma mensagem relacionada vira nota própria com título descritivo.',
  '- "data" da nota é a data/hora da primeira mensagem que a compõe, no formato AAAA-MM-DDTHH:MM.',
  '- Mensagens sem conteúdo útil (cumprimentos, "ok", figurinhas) não viram nota.',
  '- Vocabulário da área: recarga, espoleta, pólvora, projétil, estojo, calibre, cadência, estágio, alvo, pista, estande, cronômetro, coldre, carabina, pistola, revólver, cal. 12.'
].join('\n');

function montarEntrada(mensagens) {
  return mensagens.map(function (m, i) {
    var cab = '[' + (i + 1) + '] ' + m.data;
    if (m.anexo) cab += ' (anexo: ' + m.anexo + (m.tipoAnexo ? ', ' + m.tipoAnexo : '') + ')';
    return cab + '\n' + (m.texto || '(sem texto)');
  }).join('\n\n');
}

window.ClaudeAPI = {
  MODELO: 'claude-opus-5',

  _client: function (chave) {
    return new Anthropic({ apiKey: chave || Config.get('claudeKey'), dangerouslyAllowBrowser: true });
  },

  estruturar: async function (mensagens) {
    var resp = await this._client().beta.messages.create({
      model: this.MODELO,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: 'Mensagens do grupo do WhatsApp:\n\n' + montarEntrada(mensagens) }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } }
    });
    if (resp.stop_reason === 'refusal') throw new Error('O Claude recusou processar este lote.');
    var bloco = resp.content.find(function (b) { return b.type === 'text'; });
    if (!bloco) throw new Error('Resposta do Claude sem texto.');
    return JSON.parse(bloco.text).notas;
  },

  testar: async function (chave) {
    var r = await this._client(chave).messages.create({
      model: this.MODELO,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Responda apenas OK.' }]
    });
    return r.content.length > 0;
  }
};
```

- [ ] **Step 2: Incluir em `index.html`** (depois de `transcricao.js`, antes de `main.js`)

```html
<script type="module" src="js/claude.js"></script>
```

- [ ] **Step 3: Spike do SDK no navegador + teste real**

1. Chave em console.anthropic.com → Configuração → "Testar Claude". Expected: "OK". Se o console mostrar falha ao importar de `esm.sh` (rede/CDN), substituir o corpo de `estruturar`/`testar` pela versão com `fetch` abaixo e remover o `import`:
```js
async function chamar(body, chave) {
  var r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': chave || Config.get('claudeKey'),
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Claude ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}
// estruturar: var resp = await chamar({ model, max_tokens, fallbacks: 'default', system: SYSTEM, messages: [...], output_config: {...} });
// testar:     var r = await chamar({ model, max_tokens: 16, messages: [...] }, chave);
```
Se a API responder 400 reclamando de `fallbacks` junto com `output_config`, remover `betas`/`fallbacks` (e o header `anthropic-beta`) e anotar no README.

2. No console, com o export de exemplo:
```js
var msgs = WhatsAppParser.parse(`19/09/2026 21:21 - Fernando: ============================
Campeonao El Patron
3 Tiros Peito
3 Tiros Cabeça
Com uma Recagra
7 Metros - Contagem de Tempo
============================
19/09/2026 21:22 - Fernando: ============================
Campeonato Head Shot
2 Tiros Cabeça
Pistola ou Carabina
7 Metros - Contagem de Tempo
============================`);
console.log(await ClaudeAPI.estruturar(msgs));
```
Expected: duas propostas, `categoria: 'campeonatos'`, títulos "Campeonato El Patron" e "Campeonato Head Shot", texto em lista, `anexos: []`.

- [ ] **Step 4: Commit**

```bash
git add js/claude.js index.html
git commit -m "Estruturacao das notas com Claude (structured output)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Tela Lançar — entrada, normalização, transcrição, Claude, revisão

**Files:**
- Create: `js/lancar.js`
- Modify: `index.html` (seção `#tela-lancar` + script), `css/app.css`

**Interfaces:**
- Consumes: `WhatsAppParser.parse/filtrarNovas`, `Transcricao.transcrever`, `window.ClaudeAPI.estruturar`, `Notas.CATEGORIAS/escaparHtml`, `App.estado.dados.ultimaMensagemProcessada`, `App.aviso`, `JSZip`.
- Produces (global `Lancar`): `init()`, `processar()`, `estado = { mensagens: [], arquivos: {nome: Blob}, propostas: [], ultimaExport: string|null }`, `lerRevisao() -> proposta[]` (lê os campos editados da tela). `gravar()` vem na Task 10.

- [ ] **Step 1: Markup em `index.html`** (substituir `#tela-lancar`)

```html
<section id="tela-lancar" class="tela oculta">
  <h1>Lançar</h1>
  <div class="card" id="lancar-entrada">
    <label class="campo"><span>Texto copiado do WhatsApp (opcional)</span><textarea id="lancar-texto" placeholder="Cole aqui as mensagens..."></textarea></label>
    <label class="campo"><span>Arquivos: export do WhatsApp (.zip ou .txt), áudios, fotos</span>
      <input id="lancar-arquivos" type="file" multiple accept=".zip,.txt,.opus,.ogg,.m4a,.mp3,.wav,.jpg,.jpeg,.png,.webp"></label>
    <div class="linha">
      <button class="btn btn-primario" id="lancar-processar">Processar</button>
      <span id="lancar-status" class="progresso"></span>
    </div>
  </div>
  <div id="lancar-revisao" class="oculta">
    <h2>Revisão</h2>
    <p class="progresso">Confira, ajuste e grave. Nada foi gravado ainda.</p>
    <div id="lancar-cards"></div>
    <div class="linha">
      <button class="btn btn-primario" id="lancar-gravar">Gravar tudo</button>
      <button class="btn" id="lancar-cancelar">Descartar</button>
      <span id="lancar-progresso" class="progresso"></span>
    </div>
  </div>
</section>
```

- [ ] **Step 2: CSS dos cards de revisão** (acrescentar em `css/app.css`)

```css
.revisao-card .campo input, .revisao-card .campo textarea { font-size: 14px; }
.revisao-card textarea { min-height: 90px; }
.revisao-card .anexos { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
.revisao-card .anexos img { max-width: 120px; max-height: 120px; border-radius: 8px; border: 1px solid var(--border); }
.revisao-card .anexos .anexo-audio { display: flex; flex-direction: column; gap: 4px; width: 100%; }
.revisao-card .anexos .anexo-audio small { color: var(--text-faint); }
```

- [ ] **Step 3: Implementar `js/lancar.js`**

```js
// ========== TELA LANCAR: entrada -> mensagens -> transcricao -> Claude -> revisao -> gravar ==========
var Lancar = {
  estado: { mensagens: [], arquivos: {}, propostas: [], ultimaExport: null },
  RE_AUDIO: /\.(opus|ogg|m4a|mp3|wav)$/i,
  RE_IMAGEM: /\.(jpe?g|png|webp|gif)$/i,
  MIME: { opus: 'audio/ogg', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' },

  init: function () {
    var self = this;
    document.getElementById('lancar-processar').addEventListener('click', function () { self.processar(); });
    document.getElementById('lancar-cancelar').addEventListener('click', function () { self.limpar(); });
    document.getElementById('lancar-gravar').addEventListener('click', function () { self.gravar(); });
  },

  status: function (msg) { document.getElementById('lancar-status').textContent = msg || ''; },

  tipoAnexo: function (nome) {
    if (this.RE_AUDIO.test(nome)) return 'audio';
    if (this.RE_IMAGEM.test(nome)) return 'imagem';
    return null;
  },

  limpar: function () {
    this.estado = { mensagens: [], arquivos: {}, propostas: [], ultimaExport: null };
    document.getElementById('lancar-texto').value = '';
    document.getElementById('lancar-arquivos').value = '';
    document.getElementById('lancar-cards').innerHTML = '';
    document.getElementById('lancar-revisao').classList.add('oculta');
    document.getElementById('lancar-entrada').classList.remove('oculta');
    document.getElementById('lancar-progresso').textContent = '';
    this.status('');
  },

  // Le textarea + arquivos e devolve { mensagens, arquivos, ultimaExport }
  normalizar: async function () {
    var self = this;
    var texto = document.getElementById('lancar-texto').value;
    var files = Array.from(document.getElementById('lancar-arquivos').files);
    var deExport = [], soltas = [], arquivos = {};
    var agora = new Date().toISOString().slice(0, 16);

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (/\.zip$/i.test(f.name)) {
        var zip = await JSZip.loadAsync(f);
        var nomes = Object.keys(zip.files).filter(function (n) { return !zip.files[n].dir; });
        for (var k = 0; k < nomes.length; k++) {
          var nome = nomes[k], base = nome.split('/').pop();
          if (/\.txt$/i.test(base)) {
            deExport = deExport.concat(WhatsAppParser.parse(await zip.files[nome].async('string'), agora));
          } else if (self.tipoAnexo(base)) {
            var ext = base.split('.').pop().toLowerCase();
            arquivos[base] = new Blob([await zip.files[nome].async('uint8array')], { type: self.MIME[ext] || 'application/octet-stream' });
          }
        }
      } else if (/\.txt$/i.test(f.name)) {
        deExport = deExport.concat(WhatsAppParser.parse(await f.text(), agora));
      } else if (self.tipoAnexo(f.name)) {
        arquivos[f.name] = f;
        soltas.push({ data: agora, autor: null, texto: '', anexo: f.name });
      }
    }
    if (texto.trim()) soltas = soltas.concat(WhatsAppParser.parse(texto, agora));

    var ultimaProcessada = (App.estado.dados || {}).ultimaMensagemProcessada;
    var novasExport = WhatsAppParser.filtrarNovas(deExport, ultimaProcessada);
    var ultimaExport = novasExport.reduce(function (max, m) { return m.data > max ? m.data : max; }, null);

    var mensagens = novasExport.concat(soltas).map(function (m) {
      return Object.assign({}, m, { tipoAnexo: m.anexo ? self.tipoAnexo(m.anexo) : null, origem: deExport.indexOf(m) >= 0 ? 'export-whatsapp' : (m.anexo ? 'arquivo' : 'colado') });
    });
    // Anexo referenciado no export mas sem arquivo (ex.: export sem midia): mantem a mensagem, sem anexo
    mensagens.forEach(function (m) { if (m.anexo && !arquivos[m.anexo]) { m.texto = (m.texto ? m.texto + ' ' : '') + '[anexo ' + m.anexo + ' não veio no arquivo]'; m.anexo = null; m.tipoAnexo = null; } });

    return { mensagens: mensagens, arquivos: arquivos, ultimaExport: ultimaExport, ignoradas: deExport.length - novasExport.length };
  },

  transcrever: async function (mensagens, arquivos) {
    var audios = mensagens.filter(function (m) { return m.tipoAnexo === 'audio'; });
    for (var i = 0; i < audios.length; i++) {
      var m = audios[i];
      this.status('Transcrevendo áudio ' + (i + 1) + ' de ' + audios.length + '...');
      try {
        m.transcricao = await Transcricao.transcrever(arquivos[m.anexo], m.anexo);
        m.texto = (m.texto ? m.texto + '\n' : '') + m.transcricao;
      } catch (e) {
        console.warn('Transcrição falhou', m.anexo, e);
        m.transcricao = null;
        m.texto = (m.texto ? m.texto + '\n' : '') + '[áudio não transcrito]';
      }
    }
  },

  processar: async function () {
    var self = this;
    var btn = document.getElementById('lancar-processar');
    btn.disabled = true;
    try {
      this.status('Lendo arquivos...');
      var n = await this.normalizar();
      if (!n.mensagens.length) {
        this.status('');
        App.aviso(n.ignoradas ? 'Nada novo: ' + n.ignoradas + ' mensagem(ns) já processada(s).' : 'Nada para processar.');
        return;
      }
      await this.transcrever(n.mensagens, n.arquivos);
      if (!window.ClaudeAPI) throw new Error('Módulo do Claude ainda não carregou; tente de novo.');
      this.status('Estruturando ' + n.mensagens.length + ' mensagem(ns) com o Claude...');
      var propostas = await window.ClaudeAPI.estruturar(n.mensagens);
      this.estado = { mensagens: n.mensagens, arquivos: n.arquivos, propostas: propostas, ultimaExport: n.ultimaExport };
      this.renderRevisao();
      this.status('');
    } catch (e) {
      console.error(e);
      this.status('');
      App.aviso('Erro: ' + e.message, 'erro');
    } finally {
      btn.disabled = false;
    }
  },

  renderRevisao: function () {
    var self = this, esc = Notas.escaparHtml;
    var html = this.estado.propostas.map(function (p, i) {
      var opcoes = Notas.CATEGORIAS.map(function (c) { return '<option value="' + c + '"' + (c === p.categoria ? ' selected' : '') + '>' + c + '</option>'; }).join('');
      var anexos = (p.anexos || []).map(function (nome) {
        var blob = self.estado.arquivos[nome];
        if (!blob) return '<small>' + esc(nome) + ' (sem arquivo)</small>';
        var url = URL.createObjectURL(blob);
        return self.tipoAnexo(nome) === 'imagem'
          ? '<img src="' + url + '" alt="' + esc(nome) + '">'
          : '<div class="anexo-audio"><audio controls src="' + url + '"></audio><small>' + esc(nome) + '</small></div>';
      }).join('');
      return '<div class="card revisao-card" data-i="' + i + '">' +
        '<div class="linha"><label class="campo" style="flex:1"><span>Título</span><input class="rev-titulo" value="' + esc(p.titulo) + '"></label>' +
        '<label class="campo"><span>Categoria</span><select class="rev-categoria">' + opcoes + '</select></label>' +
        '<label class="campo"><span>Data</span><input class="rev-data" value="' + esc(p.data) + '"></label></div>' +
        '<label class="campo"><span>Tags (separadas por vírgula)</span><input class="rev-tags" value="' + esc((p.tags || []).join(', ')) + '"></label>' +
        '<label class="campo"><span>Texto</span><textarea class="rev-texto">' + esc(p.texto) + '</textarea></label>' +
        '<div class="anexos">' + anexos + '</div>' +
        '<div class="linha"><button class="btn btn-perigo rev-excluir">Excluir esta nota</button></div>' +
        '</div>';
    }).join('');
    var cards = document.getElementById('lancar-cards');
    cards.innerHTML = html || '<p class="vazio">O Claude não identificou nenhuma nota.</p>';
    cards.querySelectorAll('.rev-excluir').forEach(function (b) {
      b.addEventListener('click', function () {
        var card = b.closest('.revisao-card');
        self.estado.propostas.splice(Number(card.dataset.i), 1);
        self.renderRevisao();
      });
    });
    document.getElementById('lancar-entrada').classList.add('oculta');
    document.getElementById('lancar-revisao').classList.remove('oculta');
  },

  lerRevisao: function () {
    var self = this;
    return Array.from(document.querySelectorAll('.revisao-card')).map(function (card) {
      var p = self.estado.propostas[Number(card.dataset.i)];
      return {
        data: card.querySelector('.rev-data').value.trim(),
        categoria: card.querySelector('.rev-categoria').value,
        titulo: card.querySelector('.rev-titulo').value.trim(),
        tags: card.querySelector('.rev-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
        texto: card.querySelector('.rev-texto').value,
        anexos: p.anexos || []
      };
    });
  },

  gravar: async function () {
    App.aviso('Gravação entra na próxima etapa.');
  }
};
```

- [ ] **Step 4: Ligar em `main.js`** — em `init`, logo depois de `ConfigTela.init();` (antes da checagem `Config.isConfigured()`, para os botões ficarem ligados mesmo quando o app abre na configuração):

```js
    Lancar.init();
```

- [ ] **Step 5: Incluir em `index.html`** (depois de `transcricao.js`, antes do módulo `claude.js`)

```html
<script src="js/lancar.js"></script>
```

- [ ] **Step 6: Testar no navegador**

1. Lançar → colar o texto dos dois campeonatos (o mesmo da Task 8) → Processar. Expected: status passa por "Estruturando..." e aparecem dois cards editáveis; "Excluir esta nota" remove; "Descartar" volta à entrada limpa.
2. Um export real do WhatsApp com mídia (.zip) → Processar. Expected: áudios são transcritos (status "Transcrevendo áudio N de M"), fotos aparecem como miniatura no card certo, áudios com player.
3. Processar o mesmo zip de novo **depois** da Task 10 gravar: aviso "Nada novo".

- [ ] **Step 7: Commit**

```bash
git add js/lancar.js js/main.js index.html css/app.css
git commit -m "Tela Lancar: entrada, transcricao, Claude e revisao

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Gravação do lote no repositório

**Files:**
- Modify: `js/lancar.js` (substituir `gravar`), `js/main.js`

**Interfaces:**
- Consumes: `Lancar.lerRevisao`, `Imagem.redimensionar/blobParaBase64`, `GH.putFile/salvarNotas`, `GH.ConflitoError`, `Notas.validar/mesclarLote`, `App.estado`, `App.recarregar`.
- Produces: `App.salvarDados(mutador) -> Promise<void>` — aplica `mutador(dadosCopia) -> novosDados` e grava com uma tentativa extra em conflito; atualiza `App.estado`. Usado também pela Task 11.

- [ ] **Step 1: `App.salvarDados` em `main.js`**

```js
  // mutador recebe uma copia dos dados e devolve os dados novos
  salvarDados: async function (mutador) {
    for (var tentativa = 1; tentativa <= 2; tentativa++) {
      var copia = JSON.parse(JSON.stringify(this.estado.dados));
      var novos = mutador(copia);
      try {
        var r = await GH.salvarNotas(novos, this.estado.sha);
        this.estado = { dados: novos, sha: r.sha };
        return;
      } catch (e) {
        if (!(e instanceof GH.ConflitoError) || tentativa === 2) throw e;
        await this.recarregar();
      }
    }
  },
```

- [ ] **Step 2: Substituir `gravar` em `lancar.js`**

```js
  nomeMidia: function (data, nomeOriginal) {
    var ext = nomeOriginal.split('.').pop().toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    var hex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    var d = data.slice(0, 10), hm = data.slice(11, 16).replace(':', '');
    return 'midia/' + d.slice(0, 4) + '/' + d.slice(5, 7) + '/' + d + '-' + hm + '-' + hex + '.' + ext;
  },

  gravar: async function () {
    var self = this;
    var btn = document.getElementById('lancar-gravar');
    var prog = document.getElementById('lancar-progresso');
    var propostas = this.lerRevisao();
    if (!propostas.length) { App.aviso('Nada para gravar.'); return; }

    for (var i = 0; i < propostas.length; i++) {
      var v = Notas.validar(propostas[i]);
      if (!v.ok) { App.aviso('Nota ' + (i + 1) + ': ' + v.erros.join('; '), 'erro'); return; }
    }

    btn.disabled = true;
    try {
      var totalAnexos = propostas.reduce(function (n, p) { return n + p.anexos.length; }, 0), feito = 0;
      var novas = [];
      for (var p = 0; p < propostas.length; p++) {
        var prop = propostas[p], midia = [];
        for (var a = 0; a < prop.anexos.length; a++) {
          var nome = prop.anexos[a], blob = this.estado.arquivos[nome];
          if (!blob) continue;
          feito++;
          prog.textContent = 'Enviando arquivo ' + feito + ' de ' + totalAnexos + '...';
          var tipo = this.tipoAnexo(nome);
          var msg = this.estado.mensagens.find(function (m) { return m.anexo === nome; }) || {};
          if (tipo === 'imagem') blob = await Imagem.redimensionar(blob);
          var caminho = this.nomeMidia(prop.data, tipo === 'imagem' ? 'foto.jpg' : nome);
          await GH.putFile(caminho, await Imagem.blobParaBase64(blob), 'Mídia ' + nome);
          var item = { tipo: tipo, arquivo: caminho };
          if (tipo === 'imagem') item.legenda = (msg.texto || '').split('\n')[0].slice(0, 200);
          else item.transcricao = msg.transcricao || null;
          midia.push(item);
        }
        var origem = prop.anexos.length ? 'arquivo' : 'colado';
        if (this.estado.mensagens.some(function (m) { return m.origem === 'export-whatsapp'; })) origem = 'export-whatsapp';
        novas.push({ data: prop.data, categoria: prop.categoria, titulo: prop.titulo, tags: prop.tags, texto: prop.texto, midia: midia, origem: origem });
      }

      prog.textContent = 'Gravando notas...';
      var ultima = this.estado.ultimaExport;
      await App.salvarDados(function (dados) { return Notas.mesclarLote(dados, novas, ultima); });
      App.aviso(novas.length + ' nota(s) gravada(s).', 'ok');
      this.limpar();
      if (typeof Consultar !== 'undefined') Consultar.render();
      App.mostrar('consultar');
    } catch (e) {
      console.error(e);
      prog.textContent = '';
      App.aviso('Erro ao gravar: ' + e.message + ' — ajuste e tente "Gravar tudo" de novo.', 'erro');
    } finally {
      btn.disabled = false;
    }
  }
```

- [ ] **Step 3: Testar no navegador**

1. Colar os dois campeonatos → Processar → Gravar tudo. Expected: aviso "2 nota(s) gravada(s)", volta pra Consultar (ainda vazia até a Task 11), e no GitHub o `notas.json` tem as duas notas com `id`, `criadoEm`, `origem: "colado"`.
2. Export .zip com foto e áudio → Processar → Gravar tudo. Expected: progresso "Enviando arquivo N de M", arquivos em `midia/AAAA/MM/`, nota com `midia[].legenda` (foto) e `midia[].transcricao` (áudio), `ultimaMensagemProcessada` = data da última mensagem do export.
3. Processar o mesmo zip de novo. Expected: "Nada novo: N mensagem(ns) já processada(s)".
4. Conflito: em outra aba, gravar uma nota; voltar à primeira aba (estado antigo) e gravar outra. Expected: grava sem erro e as duas notas existem no `notas.json`.
5. Validação: apagar o título de um card e gravar. Expected: aviso "Nota 1: titulo obrigatorio", nada gravado.

- [ ] **Step 4: Commit**

```bash
git add js/lancar.js js/main.js
git commit -m "Gravar lote: upload de midia, merge e conflito

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Tela Consultar — lista, busca, nota, editar, excluir

**Files:**
- Create: `js/consultar.js`
- Modify: `index.html` (seção `#tela-consultar` + script), `js/main.js`

**Interfaces:**
- Consumes: `Notas.filtrar/renderMarkdown/escaparHtml/CATEGORIAS/validar`, `GH.getBlobUrl`, `App.estado`, `App.salvarDados`, `App.aviso`.
- Produces (global `Consultar`): `init()`, `render()`, `abrir(id)`, `editar(id)`, `excluir(id)`.

- [ ] **Step 1: Markup em `index.html`** (substituir `#tela-consultar`)

```html
<section id="tela-consultar" class="tela">
  <h1>Consultar</h1>
  <div class="linha">
    <label class="campo" style="flex:1;margin:0"><input id="cons-busca" placeholder="Buscar em título, texto e tags..."></label>
    <span id="cons-contador" class="progresso"></span>
    <button class="btn" id="cons-imprimir-lista">Imprimir lista</button>
  </div>
  <div class="chips" id="cons-chips"></div>
  <div class="consultar-grade">
    <div id="cons-lista"></div>
    <div id="cons-nota" class="card oculta"></div>
  </div>
</section>
```

- [ ] **Step 2: Implementar `js/consultar.js`**

```js
// ========== TELA CONSULTAR ==========
var Consultar = {
  filtro: { categoria: '', busca: '' },
  abertaId: null,

  init: function () {
    var self = this;
    var chips = ['<button class="chip ativo" data-cat="">Todas</button>'].concat(
      Notas.CATEGORIAS.map(function (c) { return '<button class="chip" data-cat="' + c + '">' + c + '</button>'; })
    ).join('');
    var wrap = document.getElementById('cons-chips');
    wrap.innerHTML = chips;
    wrap.querySelectorAll('.chip').forEach(function (b) {
      b.addEventListener('click', function () {
        self.filtro.categoria = b.dataset.cat;
        wrap.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('ativo', x === b); });
        self.render();
      });
    });
    document.getElementById('cons-busca').addEventListener('input', function (e) {
      self.filtro.busca = e.target.value;
      self.render();
    });
    document.getElementById('cons-imprimir-lista').addEventListener('click', function () {
      document.body.classList.add('imprimir-lista');
      window.print();
      document.body.classList.remove('imprimir-lista');
    });
    this.render();
  },

  notas: function () { return Notas.filtrar((App.estado.dados || {}).notas || [], this.filtro); },

  render: function () {
    var self = this, esc = Notas.escaparHtml;
    var notas = this.notas();
    document.getElementById('cons-contador').textContent = notas.length + ' nota(s)';
    var lista = document.getElementById('cons-lista');
    lista.innerHTML = notas.map(function (n) {
      return '<div class="card nota-item" data-id="' + esc(n.id) + '">' +
        '<h3>' + esc(n.titulo) + '</h3>' +
        '<div class="meta"><span class="chip" data-cat="' + n.categoria + '">' + n.categoria + '</span>' +
        '<span>' + self.formatarData(n.data) + '</span>' +
        (n.midia && n.midia.length ? '<span>' + n.midia.length + ' anexo(s)</span>' : '') + '</div>' +
        '<div class="nota-texto imprimir-so">' + Notas.renderMarkdown(n.texto) + '</div>' +
        '</div>';
    }).join('') || '<p class="vazio">Nenhuma nota.</p>';
    lista.querySelectorAll('.nota-item').forEach(function (el) {
      el.addEventListener('click', function () { self.abrir(el.dataset.id); });
    });
    if (this.abertaId && !notas.some(function (n) { return n.id === self.abertaId; })) this.fechar();
  },

  formatarData: function (iso) {
    return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) + ' ' + iso.slice(11, 16);
  },

  buscar: function (id) {
    return (App.estado.dados.notas || []).find(function (n) { return n.id === id; });
  },

  fechar: function () {
    this.abertaId = null;
    var el = document.getElementById('cons-nota');
    el.innerHTML = '';
    el.classList.add('oculta');
  },

  abrir: async function (id) {
    var self = this, esc = Notas.escaparHtml;
    var n = this.buscar(id);
    if (!n) return;
    this.abertaId = id;
    var el = document.getElementById('cons-nota');
    el.classList.remove('oculta');
    el.innerHTML =
      '<h2>' + esc(n.titulo) + '</h2>' +
      '<div class="meta"><span class="chip" data-cat="' + n.categoria + '">' + n.categoria + '</span><span>' + this.formatarData(n.data) + '</span>' +
      (n.tags || []).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<div class="nota-texto">' + Notas.renderMarkdown(n.texto) + '</div>' +
      '<div class="midia-grade" id="cons-midia"></div>' +
      '<div class="linha nao-imprimir">' +
        '<button class="btn" id="cons-editar">Editar</button>' +
        '<button class="btn" id="cons-imprimir">Imprimir</button>' +
        '<button class="btn btn-perigo" id="cons-excluir">Excluir</button>' +
        '<button class="btn" id="cons-fechar">Fechar</button>' +
      '</div>';
    document.getElementById('cons-editar').addEventListener('click', function () { self.editar(id); });
    document.getElementById('cons-imprimir').addEventListener('click', function () { window.print(); });
    document.getElementById('cons-excluir').addEventListener('click', function () { self.excluir(id); });
    document.getElementById('cons-fechar').addEventListener('click', function () { self.fechar(); });
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var grade = document.getElementById('cons-midia');
    for (var i = 0; i < (n.midia || []).length; i++) {
      var m = n.midia[i];
      try {
        var url = await GH.getBlobUrl(m.arquivo);
        if (m.tipo === 'imagem') {
          var img = document.createElement('img');
          img.src = url; img.alt = m.legenda || ''; img.title = m.legenda || '';
          img.addEventListener('click', function (ev) { window.open(ev.target.src, '_blank'); });
          grade.appendChild(img);
        } else {
          var audio = document.createElement('audio');
          audio.controls = true; audio.src = url;
          grade.appendChild(audio);
        }
      } catch (e) {
        var erro = document.createElement('small');
        erro.textContent = 'Não carregou ' + m.arquivo;
        grade.appendChild(erro);
      }
    }
  },

  editar: function (id) {
    var self = this, esc = Notas.escaparHtml;
    var n = this.buscar(id);
    var el = document.getElementById('cons-nota');
    var opcoes = Notas.CATEGORIAS.map(function (c) { return '<option value="' + c + '"' + (c === n.categoria ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    el.innerHTML =
      '<label class="campo"><span>Título</span><input id="ed-titulo" value="' + esc(n.titulo) + '"></label>' +
      '<label class="campo"><span>Categoria</span><select id="ed-categoria">' + opcoes + '</select></label>' +
      '<label class="campo"><span>Tags (separadas por vírgula)</span><input id="ed-tags" value="' + esc((n.tags || []).join(', ')) + '"></label>' +
      '<label class="campo"><span>Texto</span><textarea id="ed-texto">' + esc(n.texto) + '</textarea></label>' +
      '<div class="linha"><button class="btn btn-primario" id="ed-salvar">Salvar</button><button class="btn" id="ed-cancelar">Cancelar</button></div>';
    document.getElementById('ed-cancelar').addEventListener('click', function () { self.abrir(id); });
    document.getElementById('ed-salvar').addEventListener('click', async function () {
      var alterada = {
        titulo: document.getElementById('ed-titulo').value.trim(),
        categoria: document.getElementById('ed-categoria').value,
        tags: document.getElementById('ed-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
        texto: document.getElementById('ed-texto').value
      };
      var v = Notas.validar(Object.assign({}, n, alterada));
      if (!v.ok) { App.aviso(v.erros.join('; '), 'erro'); return; }
      try {
        await App.salvarDados(function (dados) {
          var alvo = dados.notas.find(function (x) { return x.id === id; });
          Object.assign(alvo, alterada);
          return dados;
        });
        App.aviso('Nota salva.', 'ok');
        self.render();
        self.abrir(id);
      } catch (e) { App.aviso('Erro ao salvar: ' + e.message, 'erro'); }
    });
  },

  excluir: async function (id) {
    var self = this;
    var n = this.buscar(id);
    if (!confirm('Excluir a nota "' + n.titulo + '"?')) return;
    try {
      await App.salvarDados(function (dados) {
        dados.notas = dados.notas.filter(function (x) { return x.id !== id; });
        return dados;
      });
      App.aviso('Nota excluída.', 'ok');
      this.fechar();
      this.render();
    } catch (e) { App.aviso('Erro ao excluir: ' + e.message, 'erro'); }
  }
};
```

- [ ] **Step 3: Ligar em `main.js`** — em `init`, logo depois de `ConfigTela.init();` (junto com `Lancar.init()`, antes da checagem de configuração):

```js
    Consultar.init();
```

E logo depois de `await this.recarregar();` dentro do `try`:

```js
      Consultar.render();
```

- [ ] **Step 4: Incluir em `index.html`** (depois de `lancar.js`)

```html
<script src="js/consultar.js"></script>
```

- [ ] **Step 5: CSS** (acrescentar em `css/app.css`) — na tela o texto completo fica só na nota aberta:

```css
.nota-item { cursor: pointer; }
.nota-item .imprimir-so { display: none; }
```

- [ ] **Step 6: Testar no navegador**

1. Consultar mostra as notas gravadas na Task 10, mais recentes primeiro, contador certo.
2. Chip "campeonatos" filtra; busca "cabeca" acha "Head Shot"; busca vazia volta tudo.
3. Clicar numa nota abre à direita (ou abaixo no celular) com texto renderizado, foto (clique abre em nova aba) e player de áudio.
4. Editar → mudar categoria e salvar → lista e nota refletem; `notas.json` no GitHub atualizado.
5. Excluir → confirmação → some da lista e do `notas.json`.
6. Estreitar a janela para ~400 px: uma coluna, nada estoura na horizontal.

- [ ] **Step 7: Commit**

```bash
git add js/consultar.js js/main.js index.html css/app.css
git commit -m "Tela Consultar: lista, busca, nota, editar e excluir

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Impressão

**Files:**
- Modify: `css/app.css`

**Interfaces:**
- Consumes: classes `imprimir-lista` (no `body`, ligada pela Task 11), `imprimir-so`, `nao-imprimir`, `#cons-nota`, `#cons-lista`.

- [ ] **Step 1: Acrescentar `@media print` em `css/app.css`**

```css
@media print {
  body { background: #fff !important; color: #000 !important; font-family: Georgia, "Times New Roman", serif; font-size: 12pt; }
  .topo, #aviso, .chips, .nao-imprimir, .linha, #tela-lancar, #tela-config, .btn { display: none !important; }
  main { max-width: none; padding: 0; }
  .card { background: #fff !important; border: none !important; box-shadow: none !important; padding: 0; margin: 0 0 14pt; }
  .chip { border: 1px solid #000 !important; color: #000 !important; background: none !important; }
  .meta { color: #333 !important; }
  .midia-grade img { max-width: 60%; max-height: none; border: none; }
  .midia-grade audio { display: none; }
  h1, h2, h3 { color: #000 !important; }

  /* Nota aberta: imprime so ela */
  body:not(.imprimir-lista) #cons-lista { display: none !important; }
  body:not(.imprimir-lista) .consultar-grade { display: block; }
  #cons-nota { display: block !important; }

  /* Lista filtrada: imprime todas as notas, com o texto completo, uma por pagina */
  body.imprimir-lista #cons-nota { display: none !important; }
  body.imprimir-lista .consultar-grade { display: block; }
  body.imprimir-lista .nota-item { page-break-inside: avoid; break-inside: avoid; border-bottom: 1px solid #999 !important; padding-bottom: 10pt; }
  body.imprimir-lista .nota-item .imprimir-so { display: block; }
}
```

- [ ] **Step 2: Testar (Ctrl+P → visualizar)**

1. Nota aberta → "Imprimir": só a nota, fundo branco, sem botões/menus, foto até 60% da largura.
2. Chip "campeonatos" → "Imprimir lista": todas as notas de campeonatos com texto completo, uma abaixo da outra, sem cortar nota no meio da página.
3. Cancelar a impressão: a tela volta ao normal (classe `imprimir-lista` removida).

- [ ] **Step 3: Commit**

```bash
git add css/app.css
git commit -m "CSS de impressao: nota e lista filtrada

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: README, deploy no GitHub Pages e teste de ponta a ponta

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Completar o `README.md`**

```markdown
# Clube Tiro

Diário do instrutor: notas do dia a dia (recarga, campeonatos, armas, munições, pistas, treinos) lançadas a partir do WhatsApp, guardadas num repositório privado do GitHub e consultadas de qualquer aparelho.

Spec: `docs/superpowers/specs/2026-09-20-clube-tiro-design.md` · Plano: `docs/superpowers/plans/2026-09-20-clube-tiro.md`

## Como funciona

WhatsApp (export .zip ou texto colado) → o app transcreve áudios (Groq), estrutura em notas (Claude) → você revisa → grava em `clube-tiro-dados` (privado): `notas.json` + `midia/`. Tudo roda no navegador; nenhum servidor próprio.

## Configuração (uma vez, por navegador)

1. Repositório privado `clube-tiro-dados` no GitHub (vazio).
2. Token fine-grained: só esse repositório, *Contents: Read and write*.
3. Chave da API em console.anthropic.com.
4. Chave da API em console.groq.com.
5. Abrir o app → Config → preencher, "Testar GitHub", "Testar Claude", Salvar.

As credenciais ficam no `localStorage` do navegador. Cada navegador (PC, celular) precisa da configuração.

## Uso

- **Lançar**: no WhatsApp, menu do grupo → Exportar conversa → *Incluir mídia*; salve o .zip e escolha-o em Lançar. Ou cole o texto / envie áudios e fotos soltos. Processar → revisar → Gravar tudo. Mensagens já processadas de exports anteriores são ignoradas.
- **Consultar**: filtro por categoria, busca, nota aberta com fotos e áudio, editar, excluir, imprimir (nota ou lista filtrada).

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
- [ ] Consultar: filtro, busca sem acento, abrir, editar, excluir
- [ ] Imprimir nota e imprimir lista filtrada
- [ ] No celular: tela em uma coluna, lançar e consultar funcionam

## Decisões registradas

- Transcrição: Groq `whisper-large-v3-turbo` (chamada direta do navegador confirmada em <data>). Alternativa: OpenAI `whisper-1`, comentada em `js/transcricao.js`.
- Claude: SDK via esm.sh com `dangerouslyAllowBrowser` (ou `fetch` direto — anotar qual ficou).
```

Preencher `<data>` e a linha do Claude com o que de fato foi confirmado nas Tasks 7 e 8.

- [ ] **Step 2: Rodar os testes uma última vez**

Run: `npm test`
Expected: tudo passando.

- [ ] **Step 3: Criar o repositório público e publicar**

```bash
gh repo create fernando-parise/clube-tiro --public --source=. --remote=origin --push
```
Depois, no GitHub: Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)` → Save. Aguardar 1–2 min.

- [ ] **Step 4: Teste de ponta a ponta no site publicado**

1. Abrir `https://fernando-parise.github.io/clube-tiro/` no PC: configurar, lançar um export, consultar, imprimir.
2. Abrir no celular: configurar (mesmas chaves), Consultar mostra as notas; Lançar com uma foto tirada na hora + texto colado funciona.
3. Rodar o checklist do README inteiro e marcar.

- [ ] **Step 5: Commit final**

```bash
git add README.md
git commit -m "README com configuracao, uso e checklist

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```
