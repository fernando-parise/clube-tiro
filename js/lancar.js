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
    var agora = Notas.agoraLocal();

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
    var ultimaExport = novasExport.filter(function (m) { return m.autor !== null; }).reduce(function (max, m) { return (!max || m.data > max) ? m.data : max; }, null);

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
      if (!App.estado.dados) await App.recarregar();
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
        self.estado.propostas = self.lerRevisao();
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
};
