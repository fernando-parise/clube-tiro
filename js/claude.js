// ========== CLAUDE: estrutura mensagens em notas ==========
var CATEGORIAS = ['recarga', 'campeonatos', 'armas', 'municoes', 'pistas', 'treinos', 'curso', 'outros'];

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
  '- Categorias: recarga (recarga de munição, componentes, receitas); campeonatos (provas, estágios, regras de competição); armas (armas, manutenção, peças, ajustes); municoes (munições, calibres, preços, fornecedores); pistas (pistas e estandes do clube, montagem, procedimentos); treinos (treinos que você dá, exercícios, aulas, alunos); curso (material de cursos e certificações que você faz como aluno: apostilas, slides, resumos de aula); outros (o que não couber acima).',
  '- Título curto e específico (ex.: "Campeonato El Patron", "Preço CBC .38 setembro").',
  '- Tags: termos úteis para busca — calibre, distância, nome da prova, arma, fornecedor. Minúsculas, sem repetir o título inteiro.',
  '- Texto em markdown simples: parágrafos, listas com "- " e **negrito**. Fiel ao original: corrija só grafia óbvia, reorganize em lista quando fizer sentido, não invente nem complete informação.',
  '- Uma foto, um PDF ou uma apresentação com legenda vira nota própria quando é assunto por si; se descreve algo que outra mensagem próxima está tratando, entra naquela nota. Cada anexo aparece em no máximo uma nota, pelo nome exato informado em "(anexo: ...)" — incluindo arquivos PDF, PPT, DOC e XLS além de fotos e áudios. Anexo sem nenhuma mensagem relacionada vira nota própria com título descritivo.',
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

  // fetch direto, sem SDK de terceiros: nada de codigo externo nesta origem
  _chamar: async function (body, chave) {
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
  },

  estruturar: async function (mensagens) {
    var resp = await this._chamar({
      model: this.MODELO,
      max_tokens: 16000,
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: 'Mensagens do grupo do WhatsApp:\n\n' + montarEntrada(mensagens) }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } }
    });
    if (resp.stop_reason === 'refusal') throw new Error('O Claude recusou processar este lote.');
    if (resp.stop_reason === 'max_tokens') throw new Error('Resposta do Claude foi cortada; divida o lote em partes menores.');
    var bloco = resp.content.find(function (b) { return b.type === 'text'; });
    if (!bloco) throw new Error('Resposta do Claude sem texto.');
    try { return JSON.parse(bloco.text).notas; } catch (e) { throw new Error('Resposta do Claude não é JSON válido.'); }
  },

  testar: async function (chave) {
    var r = await this._chamar({
      model: this.MODELO,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Responda apenas OK.' }]
    }, chave);
    return r.content.length > 0;
  }
};
