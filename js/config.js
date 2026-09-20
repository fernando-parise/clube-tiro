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
    if (!d.ghRepo) d.ghRepo = 'clube-tiro-anotacoes';
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
      document.getElementById('cfg-' + c).value = Config.get(c) || (c === 'ghRepo' ? 'clube-tiro-anotacoes' : '');
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
