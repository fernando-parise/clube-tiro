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
      var linha = bruta.replace(/\u200e/g, '');
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

    var agoraIso = agora || self._agoraLocal();
    return mensagens
      .filter(function (msg) { return !self._ehSistema(msg); })
      .map(function (msg) { if (!msg.data) msg.data = agoraIso; return msg; })
      .filter(function (msg) { return msg.texto || msg.anexo; });
  },

  filtrarNovas: function (mensagens, ultima) {
    if (!ultima) return mensagens;
    return mensagens.filter(function (m) { return m.data > ultima; });
  },

  // Copia local de agoraLocal (Notas.agoraLocal): este modulo nao pode depender de Notas
  _agoraLocal: function () {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
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
