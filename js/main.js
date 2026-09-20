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
    Config.load();
    ConfigTela.init();
    document.getElementById('btn-tema').addEventListener('click', function () {
      self.aplicarTema(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });
    document.getElementById('btn-config').addEventListener('click', function () { self.mostrar('config'); });
    document.querySelectorAll('nav button[data-tela]').forEach(function (b) {
      b.addEventListener('click', function () { self.mostrar(b.dataset.tela); });
    });
    if (!Config.isConfigured()) { this.mostrar('config'); return; }
    this.mostrar('consultar');
  }
};

document.addEventListener('DOMContentLoaded', function () { App.init(); });
