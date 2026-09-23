# Redesenho da tela Consultar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a tela Consultar do Clube Tiro para abrir numa home de categorias (em vez de lista com "Todas" pré-selecionado), adicionar zoom de fotos e trocar a impressão por dois botões (lista atual / tudo), conforme a spec.

**Architecture:** App estático, sem build, sem framework (jQuery-free, ES5, `var Objeto = { ... }` com métodos). Toda a mudança fica em `index.html` (markup da seção `tela-consultar`), `css/app.css` (grade de categorias, lightbox) e `js/consultar.js` (novo estado `vista: 'home' | 'lista'`). Uma função pura nova em `js/notas.js` (`contarPorCategoria`) é testável com `node --test`; o resto da tela não tem framework de teste automatizado no projeto — verificação é manual, pelo servidor local (`iniciar.bat`), como já documentado no checklist do README.

**Tech Stack:** HTML/CSS/JS puro (ES5, sem bundler), `node --test` para a camada pura.

**Spec:** `docs/superpowers/specs/2026-09-23-consultar-ux-design.md`

## Global Constraints

- Sem framework, sem bundler, sem dependência nova — mesmo padrão do restante do projeto.
- Estilo de código ES5: `var`, `function () {}` (sem arrow functions, sem `let`/`const` em `js/*.js` — os arquivos de teste em `test/` já usam `const`/arrow, mantenha esse contraste como está).
- Cores por categoria reaproveitam os tokens já definidos em `css/tokens.css` (`--accent`, `--warning`, `--treinos`, etc.) — não inventar cor nova.
- Nenhuma mudança no modelo de dados (`notas.json`) nem na tela Lançar.
- Indentação de 2 espaços, aspas simples em JS, ponto e vírgula sempre — siga o estilo dos arquivos existentes.

---

### Task 1: `Notas.contarPorCategoria`

**Files:**
- Modify: `js/notas.js` (adicionar método depois de `filtrar`, por volta da linha 54)
- Test: `test/notas.test.js` (adicionar teste depois do teste de `filtrar`, por volta da linha 44)

**Interfaces:**
- Produces: `Notas.contarPorCategoria(notas)` → objeto `{ recarga: N, campeonatos: N, armas: N, municoes: N, pistas: N, treinos: N, outros: N }`, uma chave por `Notas.CATEGORIAS`, sempre presente mesmo com contagem 0. Usado pela home de categorias (Task 2) para mostrar quantas notas há em cada bloco.

- [ ] **Step 1: Escrever o teste que falha**

Em `test/notas.test.js`, logo depois do teste `'filtrar por categoria e busca sem acento, ordena por data desc'` (linha 44), adicione:

```js
test('contarPorCategoria conta por categoria, zerando as sem nota', () => {
  const notas = [
    { categoria: 'recarga' },
    { categoria: 'recarga' },
    { categoria: 'armas' },
  ];
  assert.deepEqual(Notas.contarPorCategoria(notas), {
    recarga: 2, campeonatos: 0, armas: 1, municoes: 0, pistas: 0, treinos: 0, outros: 0
  });
  assert.deepEqual(Notas.contarPorCategoria([]), {
    recarga: 0, campeonatos: 0, armas: 0, municoes: 0, pistas: 0, treinos: 0, outros: 0
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test test/notas.test.js`
Expected: FAIL — `Notas.contarPorCategoria is not a function`

- [ ] **Step 3: Implementar**

Em `js/notas.js`, depois do método `filtrar` (fecha em `}` seguido de `,` na linha 54, antes de `mesclarLote`), adicione:

```js
  contarPorCategoria: function (notas) {
    var contagem = {};
    this.CATEGORIAS.forEach(function (c) { contagem[c] = 0; });
    (notas || []).forEach(function (n) { contagem[n.categoria] = (contagem[n.categoria] || 0) + 1; });
    return contagem;
  },
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test test/notas.test.js`
Expected: PASS (todos os testes do arquivo, incluindo o novo)

- [ ] **Step 5: Commit**

```bash
git add js/notas.js test/notas.test.js
git commit -m "Adiciona Notas.contarPorCategoria para a home de categorias"
```

---

### Task 2: Home de categorias e navegação

**Files:**
- Modify: `index.html:27-39` (markup da seção `tela-consultar`)
- Modify: `css/app.css` (nova grade de categorias; remover `.chips` do seletor de impressão)
- Modify: `js/consultar.js` (novo estado `vista`, `renderHome`, `mostrarVista`, navegação)

**Interfaces:**
- Consumes: `Notas.contarPorCategoria` (Task 1), `Notas.CATEGORIAS`, `Notas.filtrar`, `App.estado.dados`.
- Produces: `Consultar.vista` (`'home'` ou `'lista'`), `Consultar.mostrarVista(vista)`, `Consultar.renderHome()`, `Consultar.renderLista(notas)` — usados por Task 3 (PDF) e Task 4 (lightbox não usa isso, mas convive no mesmo objeto).

- [ ] **Step 1: Reescrever o markup de `tela-consultar`**

Em `index.html`, substitua o bloco (linhas 27-39):

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

por:

```html
    <section id="tela-consultar" class="tela">
      <h1>Consultar</h1>
      <div class="linha">
        <label class="campo" style="flex:1;margin:0"><input id="cons-busca" placeholder="Buscar em título, texto e tags..."></label>
      </div>
      <div id="cons-home">
        <div class="grade-categorias" id="cons-categorias"></div>
      </div>
      <div id="cons-vista-lista" class="oculta">
        <div class="linha">
          <button class="btn" id="cons-voltar">← Categorias</button>
          <span id="cons-contador" class="progresso"></span>
          <button class="btn" id="cons-imprimir-lista">Imprimir lista</button>
        </div>
        <div class="consultar-grade">
          <div id="cons-lista"></div>
          <div id="cons-nota" class="card oculta"></div>
        </div>
      </div>
    </section>
```

(O botão `cons-imprimir-lista` vira dois botões na Task 3 — nesta task ele só muda de lugar, comportamento igual ao de hoje.)

- [ ] **Step 2: CSS da grade de categorias**

Em `css/app.css`, depois do bloco `.chips { ... }` (linha 63), adicione:

```css
.grade-categorias { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 12px 0; }
@media (min-width: 600px) { .grade-categorias { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 900px) { .grade-categorias { grid-template-columns: repeat(4, 1fr); } }
.categoria-bloco {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  min-height: 64px; padding: 12px 14px;
  background: var(--bg-card); border: 1px solid var(--border); border-left: 4px solid var(--border-strong);
  border-radius: 12px; color: var(--text); font: inherit; text-align: left; cursor: pointer;
}
.categoria-bloco:hover { background: var(--input-hover); }
.categoria-bloco .categoria-nome { font-weight: 600; }
.categoria-bloco .categoria-contagem { color: var(--text-faint); font-size: 12px; }
.categoria-bloco[data-cat=""]            { border-left-color: var(--accent); }
.categoria-bloco[data-cat="campeonatos"] { border-left-color: var(--accent); }
.categoria-bloco[data-cat="recarga"]     { border-left-color: var(--warning); }
.categoria-bloco[data-cat="armas"]       { border-left-color: var(--text-muted); }
.categoria-bloco[data-cat="municoes"]    { border-left-color: var(--success); }
.categoria-bloco[data-cat="pistas"]      { border-left-color: var(--accent-2); }
.categoria-bloco[data-cat="treinos"]     { border-left-color: var(--treinos); }
.categoria-bloco[data-cat="outros"]      { border-left-color: var(--border-strong); }
.nota-item { min-height: 44px; }
```

Na regra `@media print` (linha 120), remova o token `.chips` (a classe não existe mais no markup):

Troque:
```css
  .topo, #aviso, .chips, .nao-imprimir, .linha, #tela-lancar, #tela-config, .btn { display: none !important; }
```
por:
```css
  .topo, #aviso, .nao-imprimir, .linha, #tela-lancar, #tela-config, .btn { display: none !important; }
```

- [ ] **Step 3: Reescrever `js/consultar.js` — estado e navegação**

Substitua o objeto inteiro (arquivo todo, linhas 1-165) por:

```js
// ========== TELA CONSULTAR ==========
var Consultar = {
  filtro: { categoria: '', busca: '' },
  vista: 'home',
  abertaId: null,

  init: function () {
    var self = this;
    document.getElementById('cons-busca').addEventListener('input', function (e) {
      self.filtro.busca = e.target.value;
      if (self.vista === 'home' && self.filtro.busca.trim()) {
        self.filtro.categoria = '';
        self.mostrarVista('lista');
      }
      self.render();
    });
    document.getElementById('cons-voltar').addEventListener('click', function () {
      self.fechar();
      self.filtro = { categoria: '', busca: '' };
      document.getElementById('cons-busca').value = '';
      self.mostrarVista('home');
      self.render();
    });
    document.getElementById('cons-imprimir-lista').addEventListener('click', function () {
      document.body.classList.add('imprimir-lista');
      window.print();
      document.body.classList.remove('imprimir-lista');
    });
    this.render();
  },

  mostrarVista: function (vista) {
    this.vista = vista;
    document.getElementById('cons-home').classList.toggle('oculta', vista !== 'home');
    document.getElementById('cons-vista-lista').classList.toggle('oculta', vista !== 'lista');
  },

  todasNotas: function () { return (App.estado.dados || {}).notas || []; },

  notas: function () { return Notas.filtrar(this.todasNotas(), this.filtro); },

  renderHome: function () {
    var self = this;
    var todas = this.todasNotas();
    var contagem = Notas.contarPorCategoria(todas);
    var blocos = ['<button class="categoria-bloco" data-cat="">' +
      '<span class="categoria-nome">Todas</span><span class="categoria-contagem">' + todas.length + '</span></button>'
    ].concat(Notas.CATEGORIAS.map(function (c) {
      return '<button class="categoria-bloco" data-cat="' + c + '">' +
        '<span class="categoria-nome">' + c + '</span><span class="categoria-contagem">' + contagem[c] + '</span></button>';
    }));
    var wrap = document.getElementById('cons-categorias');
    wrap.innerHTML = blocos.join('');
    wrap.querySelectorAll('.categoria-bloco').forEach(function (b) {
      b.addEventListener('click', function () {
        self.filtro.categoria = b.dataset.cat;
        self.filtro.busca = '';
        document.getElementById('cons-busca').value = '';
        self.mostrarVista('lista');
        self.render();
      });
    });
  },

  render: function () {
    var self = this;
    this.renderHome();
    var notas = this.notas();
    document.getElementById('cons-contador').textContent = notas.length + ' nota(s)';
    this.renderLista(notas);
    if (this.abertaId && !notas.some(function (n) { return n.id === self.abertaId; })) this.fechar();
  },

  renderLista: function (notas) {
    var self = this, esc = Notas.escaparHtml;
    var vazio = this.filtro.busca.trim() ? 'Nenhum resultado.' :
      (this.filtro.categoria ? 'Nenhuma nota em ' + this.filtro.categoria + '.' : 'Nenhuma nota.');
    var lista = document.getElementById('cons-lista');
    lista.innerHTML = notas.map(function (n) {
      return '<div class="card nota-item" data-id="' + esc(n.id) + '">' +
        '<h3>' + esc(n.titulo) + '</h3>' +
        '<div class="meta"><span class="chip" data-cat="' + esc(n.categoria) + '">' + esc(n.categoria) + '</span>' +
        '<span>' + self.formatarData(n.data) + '</span>' +
        (n.midia && n.midia.length ? '<span>' + n.midia.length + ' anexo(s)</span>' : '') + '</div>' +
        '<div class="nota-texto imprimir-so">' + Notas.renderMarkdown(n.texto) + '</div>' +
        '</div>';
    }).join('') || '<p class="vazio">' + vazio + '</p>';
    lista.querySelectorAll('.nota-item').forEach(function (el) {
      el.addEventListener('click', function () { self.abrir(el.dataset.id); });
    });
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
      '<div class="meta"><span class="chip" data-cat="' + esc(n.categoria) + '">' + esc(n.categoria) + '</span><span>' + this.formatarData(n.data) + '</span>' +
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

Nota: `abrir`/`editar`/`excluir` ficam idênticos ao original nesta task — só `init`, `render` e a navegação mudam. Task 3 mexe de novo no botão de imprimir; Task 4 mexe de novo no clique da foto dentro de `abrir`.

- [ ] **Step 4: Rodar os testes automatizados (não devem quebrar)**

Run: `npm test`
Expected: PASS (a mudança é só em `consultar.js`/`index.html`/`app.css`, nenhum arquivo testado por `node --test` muda de comportamento)

- [ ] **Step 5: Verificação manual no navegador**

Run: `iniciar.bat` (abre `http://localhost:3000`)

No app aberto e configurado (ou com dados de teste):
1. Consultar abre mostrando a grade de 8 blocos (7 categorias + "Todas"), cada um com contador.
2. Tocar num bloco de categoria leva à lista filtrada por ela; "← Categorias" volta à home.
3. Tocar em "Todas" leva à lista completa.
4. Digitar na busca a partir da home pula direto para a lista de resultados (em todas as categorias).
5. Abrir uma nota, editar e excluir continuam funcionando como antes.
6. Redimensionar a janela abaixo de 600px: a grade de categorias fica em 2 colunas; acima de 900px, lista e nota abrem lado a lado como já acontecia.
7. Tocar numa categoria sem nenhuma nota mostra "Nenhuma nota em [categoria]." em vez de tela quebrada; buscar um termo sem resultado dentro de uma categoria mostra "Nenhum resultado."

- [ ] **Step 6: Commit**

```bash
git add index.html css/app.css js/consultar.js
git commit -m "Home de categorias na tela Consultar, com navegacao por toque"
```

---

### Task 3: PDF desta lista / PDF de tudo

**Files:**
- Modify: `index.html` (botão `cons-imprimir-lista` vira dois botões)
- Modify: `js/consultar.js` (troca o listener do botão de imprimir; remove o botão "Imprimir" de dentro da nota aberta; desabilita botões quando a lista está vazia)

**Interfaces:**
- Consumes: `Consultar.renderLista(notas)`, `Consultar.notas()`, `Consultar.todasNotas()` (Task 2), `Notas.filtrar` (existente).
- Produces: `Consultar.imprimir(notas)` — usado só internamente pelos dois botões desta task.

- [ ] **Step 1: HTML — dois botões no lugar de um**

Em `index.html`, dentro de `#cons-vista-lista`, troque:

```html
          <button class="btn" id="cons-imprimir-lista">Imprimir lista</button>
```

por:

```html
          <button class="btn" id="cons-pdf-lista">PDF desta lista</button>
          <button class="btn" id="cons-pdf-tudo">PDF de tudo</button>
```

- [ ] **Step 2: `js/consultar.js` — troca o listener de impressão**

No `init`, troque o bloco:

```js
    document.getElementById('cons-imprimir-lista').addEventListener('click', function () {
      document.body.classList.add('imprimir-lista');
      window.print();
      document.body.classList.remove('imprimir-lista');
    });
```

por:

```js
    document.getElementById('cons-pdf-lista').addEventListener('click', function () {
      self.imprimir(self.notas());
    });
    document.getElementById('cons-pdf-tudo').addEventListener('click', function () {
      self.imprimir(Notas.filtrar(self.todasNotas(), {}));
    });
```

- [ ] **Step 3: Adicionar o método `imprimir` e desabilitar os botões quando vazio**

Depois do método `renderLista` (definido na Task 2), adicione:

```js
  imprimir: function (notas) {
    this.renderLista(notas);
    document.body.classList.add('imprimir-lista');
    window.print();
    document.body.classList.remove('imprimir-lista');
    this.renderLista(this.notas());
  },
```

No método `render`, depois da linha `this.renderLista(notas);`, adicione:

```js
    document.getElementById('cons-pdf-lista').disabled = notas.length === 0;
    document.getElementById('cons-pdf-tudo').disabled = this.todasNotas().length === 0;
```

(`render` fica assim, de cima a baixo: `renderHome()` → calcula `notas` → contador → `renderLista(notas)` → os dois `disabled` → checagem de `abertaId`.)

- [ ] **Step 4: Remover o botão "Imprimir" de dentro da nota aberta**

No método `abrir`, troque:

```js
      '<div class="linha nao-imprimir">' +
        '<button class="btn" id="cons-editar">Editar</button>' +
        '<button class="btn" id="cons-imprimir">Imprimir</button>' +
        '<button class="btn btn-perigo" id="cons-excluir">Excluir</button>' +
        '<button class="btn" id="cons-fechar">Fechar</button>' +
      '</div>';
    document.getElementById('cons-editar').addEventListener('click', function () { self.editar(id); });
    document.getElementById('cons-imprimir').addEventListener('click', function () { window.print(); });
    document.getElementById('cons-excluir').addEventListener('click', function () { self.excluir(id); });
```

por:

```js
      '<div class="linha nao-imprimir">' +
        '<button class="btn" id="cons-editar">Editar</button>' +
        '<button class="btn btn-perigo" id="cons-excluir">Excluir</button>' +
        '<button class="btn" id="cons-fechar">Fechar</button>' +
      '</div>';
    document.getElementById('cons-editar').addEventListener('click', function () { self.editar(id); });
    document.getElementById('cons-excluir').addEventListener('click', function () { self.excluir(id); });
```

- [ ] **Step 5: Rodar os testes automatizados**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Verificação manual no navegador**

Com `iniciar.bat` rodando:
1. Entrar numa categoria com notas → "PDF desta lista" abre o diálogo de impressão do navegador só com as notas daquela categoria (confirmar no preview de impressão, sem precisar salvar o PDF de fato).
2. Na mesma lista, "PDF de tudo" abre o diálogo com todas as notas do app, independente da categoria/busca atual; fechar o diálogo e confirmar que a lista na tela volta a mostrar só a categoria filtrada (não fica "vazada" com tudo).
3. Entrar numa categoria sem notas: os dois botões aparecem desabilitados (ou o de "tudo" também, se o app inteiro não tiver nenhuma nota).
4. Abrir uma nota: não há mais botão "Imprimir" ali dentro.

- [ ] **Step 7: Commit**

```bash
git add index.html js/consultar.js
git commit -m "PDF desta lista / PDF de tudo, no lugar do imprimir por nota"
```

---

### Task 4: Lightbox de fotos

**Files:**
- Modify: `css/app.css` (estilos do overlay)
- Modify: `js/consultar.js` (método `abrirLightbox`, troca o clique da foto)

**Interfaces:**
- Consumes: nada novo — usa a `url` (blob URL) e `legenda` já resolvidas em `abrir()` via `GH.getBlobUrl`.
- Produces: `Consultar.abrirLightbox(url, legenda)`.

Falha ao carregar a foto (rede, repositório) já é tratada pelo `catch` existente em torno de `GH.getBlobUrl` em `abrir()` — nesse caso a `<img>` nem chega a ser criada, então o lightbox nunca é acionado para essa foto; não é preciso tratamento novo aqui.

- [ ] **Step 1: CSS do overlay**

Em `css/app.css`, depois do bloco `.midia-grade { ... }` (linha 105), adicione:

```css
.lightbox {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(2, 6, 20, .86);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.lightbox img { max-width: 100%; max-height: 100%; border-radius: 8px; }
.lightbox-fechar {
  position: absolute; top: 16px; right: 16px;
  background: var(--bg-elevated); color: var(--text);
  border: 1px solid var(--border-strong); border-radius: 999px;
  width: 36px; height: 36px; font-size: 16px; cursor: pointer;
}
```

Na regra `@media print` (mesmo bloco da Task 2), acrescente `.lightbox` à lista de elementos escondidos:

Troque:
```css
  .topo, #aviso, .nao-imprimir, .linha, #tela-lancar, #tela-config, .btn { display: none !important; }
```
por:
```css
  .topo, #aviso, .nao-imprimir, .linha, #tela-lancar, #tela-config, .btn, .lightbox { display: none !important; }
```

- [ ] **Step 2: Método `abrirLightbox` e troca do clique na foto**

Em `js/consultar.js`, no método `abrir`, troque:

```js
          img.addEventListener('click', function (ev) { window.open(ev.target.src, '_blank'); });
```

por:

```js
          img.addEventListener('click', function (ev) { self.abrirLightbox(ev.target.src, m.legenda || ''); });
```

Depois do método `fechar` (antes de `abrir`), adicione:

```js
  abrirLightbox: function (url, legenda) {
    var esc = Notas.escaparHtml;
    var overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.innerHTML = '<button class="lightbox-fechar" aria-label="Fechar">✕</button><img src="' + esc(url) + '" alt="' + esc(legenda) + '">';
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay || ev.target.classList.contains('lightbox-fechar')) overlay.remove();
    });
    document.body.appendChild(overlay);
  },
```

- [ ] **Step 3: Rodar os testes automatizados**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Verificação manual no navegador**

Com `iniciar.bat` rodando, abrir uma nota que tenha foto:
1. Tocar na foto abre o lightbox em tela cheia, fundo escurecido.
2. Tocar fora da imagem, ou no botão "✕", fecha o lightbox.
3. Testar em janela redimensionada para largura de celular (< 600px) — a imagem cabe na tela sem cortar.

- [ ] **Step 5: Commit**

```bash
git add css/app.css js/consultar.js
git commit -m "Lightbox para ampliar fotos das notas"
```

---

### Task 5: Atualizar o README

**Files:**
- Modify: `README.md`

**Interfaces:** nenhuma — só documentação.

- [ ] **Step 1: Atualizar a linha de "Consultar" em Uso**

Em `README.md`, linha 30, troque:

```markdown
- **Consultar**: filtro por categoria, busca, nota aberta com fotos e áudio, editar, excluir, imprimir (nota ou lista filtrada).
```

por:

```markdown
- **Consultar**: abre numa grade de categorias (com contador de notas); tocar numa categoria (ou em "Todas") leva à lista, com busca dentro dela — "← Categorias" volta. Nota aberta com fotos (toque amplia) e áudio, editar, excluir. PDF pela lista: "PDF desta lista" (filtro atual) ou "PDF de tudo".
```

- [ ] **Step 2: Atualizar o checklist de teste manual**

Em `README.md`, troque as linhas 59-60:

```markdown
- [ ] Consultar: filtro, busca sem acento, abrir, editar, excluir
- [ ] Imprimir nota e imprimir lista filtrada
```

por:

```markdown
- [ ] Consultar: home de categorias com contadores corretos, tocar leva à lista certa, "← Categorias" volta
- [ ] Consultar: busca a partir da home pula direto para os resultados; busca sem acento continua funcionando
- [ ] Consultar: abrir, editar, excluir nota; foto abre no lightbox e fecha tocando fora ou no X
- [ ] PDF desta lista traz só o filtro atual; PDF de tudo ignora o filtro; ambos desabilitam com lista vazia
```

- [ ] **Step 3: Referenciar a nova spec**

Na linha 5, troque:

```markdown
Spec: `docs/superpowers/specs/2026-09-20-clube-tiro-design.md` · Plano: `docs/superpowers/plans/2026-09-20-clube-tiro.md`
```

por:

```markdown
Spec: `docs/superpowers/specs/2026-09-20-clube-tiro-design.md` · Plano: `docs/superpowers/plans/2026-09-20-clube-tiro.md`
Redesenho da tela Consultar: `docs/superpowers/specs/2026-09-23-consultar-ux-design.md` · Plano: `docs/superpowers/plans/2026-09-23-consultar-ux.md`
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Atualiza README para a home de categorias em Consultar"
```
