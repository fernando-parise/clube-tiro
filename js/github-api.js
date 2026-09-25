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
    var blob = await r.blob();
    // O GitHub costuma devolver application/octet-stream; fixa o tipo pela extensao
    // para o navegador previsualizar (ex.: PDF) em vez de so baixar o arquivo.
    var ext = path.split('.').pop().toLowerCase();
    var tipo = Notas.MIME[ext];
    if (tipo && blob.type !== tipo) blob = blob.slice(0, blob.size, tipo);
    var url = URL.createObjectURL(blob);
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
