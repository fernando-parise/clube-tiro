// ========== MODELO DE NOTAS (funcoes puras, roda no navegador e no Node) ==========
var Notas = {
  CATEGORIAS: ['recarga', 'campeonatos', 'armas', 'municoes', 'pistas', 'treinos', 'outros'],

  dadosVazios: function () {
    return { versao: 1, ultimaMensagemProcessada: null, notas: [] };
  },

  // "Agora" em hora local (nao UTC), formato AAAA-MM-DDTHH:MM
  agoraLocal: function () {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  },

  normalizar: function (texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
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
      return Object.assign({}, n, { id: id, criadoEm: n.criadoEm || self.agoraLocal() });
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
