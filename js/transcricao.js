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
