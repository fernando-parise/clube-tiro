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
    document.getElementById('cons-pdf-lista').addEventListener('click', function () {
      self.imprimir(self.notas());
    });
    document.getElementById('cons-pdf-tudo').addEventListener('click', function () {
      self.imprimir(Notas.filtrar(self.todasNotas(), {}));
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
    document.getElementById('cons-pdf-lista').disabled = notas.length === 0;
    document.getElementById('cons-pdf-tudo').disabled = this.todasNotas().length === 0;
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

  imprimir: function (notas) {
    var self = this;
    this.renderLista(notas);
    document.body.classList.add('imprimir-lista');
    window.addEventListener('afterprint', function limpar() {
      window.removeEventListener('afterprint', limpar);
      document.body.classList.remove('imprimir-lista');
      self.renderLista(self.notas());
    });
    window.print();
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
        '<button class="btn btn-perigo" id="cons-excluir">Excluir</button>' +
        '<button class="btn" id="cons-fechar">Fechar</button>' +
      '</div>';
    document.getElementById('cons-editar').addEventListener('click', function () { self.editar(id); });
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
          img.addEventListener('click', function (ev) { self.abrirLightbox(ev.target.src, ev.target.alt); });
          grade.appendChild(img);
        } else if (m.tipo === 'documento') {
          var link = document.createElement('a');
          link.href = url; link.target = '_blank'; link.rel = 'noopener';
          link.className = 'documento-link';
          link.textContent = (m.legenda ? m.legenda + ' — ' : '') + m.arquivo.split('/').pop();
          grade.appendChild(link);
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
