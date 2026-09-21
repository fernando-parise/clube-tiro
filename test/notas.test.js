const test = require('node:test');
const assert = require('node:assert/strict');
const Notas = require('../js/notas.js');

test('slug remove acento, pontuacao e espacos', () => {
  assert.equal(Notas.slug('Campeonato El Patrón!'), 'campeonato-el-patron');
  assert.equal(Notas.slug('   '), 'nota');
});

test('agoraLocal devolve AAAA-MM-DDTHH:MM em hora local', () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const esperado = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const atual = Notas.agoraLocal();
  assert.match(atual, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.equal(atual.slice(0, 10), esperado.slice(0, 10));
});

test('gerarId usa data + slug e resolve colisao com sufixo', () => {
  assert.equal(Notas.gerarId('2026-09-19T21:21', 'Campeonato El Patron', []), '2026-09-19-campeonato-el-patron');
  const ids = ['2026-09-19-campeonato-el-patron', '2026-09-19-campeonato-el-patron-2'];
  assert.equal(Notas.gerarId('2026-09-19T21:21', 'Campeonato El Patron', ids), '2026-09-19-campeonato-el-patron-3');
});

test('validar aceita nota completa e aponta erros', () => {
  const ok = Notas.validar({ data: '2026-09-19T21:21', categoria: 'campeonatos', titulo: 'X', tags: [], texto: '' });
  assert.deepEqual(ok, { ok: true, erros: [] });
  const ruim = Notas.validar({ data: 'ontem', categoria: 'festa', titulo: '', tags: 'a', texto: 1 });
  assert.equal(ruim.ok, false);
  assert.equal(ruim.erros.length, 5);
});

test('filtrar por categoria e busca sem acento, ordena por data desc', () => {
  const notas = [
    { data: '2026-09-01T10:00', categoria: 'recarga', titulo: 'Receita .38', tags: ['38'], texto: 'pólvora' },
    { data: '2026-09-19T21:21', categoria: 'campeonatos', titulo: 'El Patron', tags: ['7 metros'], texto: '' },
    { data: '2026-09-10T08:00', categoria: 'campeonatos', titulo: 'Head Shot', tags: [], texto: 'Cabeça' },
  ];
  assert.deepEqual(Notas.filtrar(notas, { categoria: 'campeonatos' }).map(n => n.titulo), ['El Patron', 'Head Shot']);
  assert.deepEqual(Notas.filtrar(notas, { busca: 'cabeca' }).map(n => n.titulo), ['Head Shot']);
  assert.deepEqual(Notas.filtrar(notas, { busca: 'POLVORA' }).map(n => n.titulo), ['Receita .38']);
  assert.deepEqual(Notas.filtrar(notas, { busca: '7 metros' }).map(n => n.titulo), ['El Patron']);
  assert.equal(Notas.filtrar(notas, {}).length, 3);
});

test('mesclarLote gera ids, criadoEm e atualiza ultimaMensagemProcessada', () => {
  const dados = { versao: 1, ultimaMensagemProcessada: '2026-09-10T08:00', notas: [{ id: '2026-09-19-el-patron', data: '2026-09-19T21:21', titulo: 'El Patron' }] };
  const novas = [
    { data: '2026-09-19T21:22', categoria: 'campeonatos', titulo: 'El Patron', tags: [], texto: '', midia: [], origem: 'colado' },
    { data: '2026-09-19T21:23', categoria: 'outros', titulo: 'Head Shot', tags: [], texto: '', midia: [], origem: 'colado' },
  ];
  const r = Notas.mesclarLote(dados, novas, '2026-09-19T21:25');
  assert.equal(r.notas.length, 3);
  assert.equal(r.notas[1].id, '2026-09-19-el-patron-2');
  assert.equal(r.notas[2].id, '2026-09-19-head-shot');
  assert.ok(r.notas[1].criadoEm);
  assert.equal(r.ultimaMensagemProcessada, '2026-09-19T21:25');
  assert.equal(dados.notas.length, 1, 'nao muta o original');
  const r2 = Notas.mesclarLote(r, [], '2026-09-01T00:00');
  assert.equal(r2.ultimaMensagemProcessada, '2026-09-19T21:25', 'nao volta no tempo');
});

test('renderMarkdown faz lista, negrito, paragrafo e escapa html', () => {
  const html = Notas.renderMarkdown('Regras **7 metros**\n- 3 tiros peito\n- 3 tiros <cabeça>\n\nFim');
  assert.equal(html, '<p>Regras <strong>7 metros</strong></p><ul><li>3 tiros peito</li><li>3 tiros &lt;cabeça&gt;</li></ul><p>Fim</p>');
});
