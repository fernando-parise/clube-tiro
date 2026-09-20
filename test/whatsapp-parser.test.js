const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/whatsapp-parser.js');

const ANDROID = [
  '19/09/2026 21:20 - Mensagens e chamadas são protegidas com a criptografia de ponta a ponta.',
  '19/09/2026 21:21 - Fernando: ============================',
  'Campeonao El Patron',
  '3 Tiros Peito',
  '============================',
  '19/09/2026 21:23 - Fernando: IMG-20260919-WA0001.jpg (arquivo anexado)',
  'alvo 4 cores',
  '19/09/2026 21:25 - Fernando: PTT-20260919-WA0002.opus (arquivo anexado)',
  '19/09/2026 21:26 - Fernando: <Mídia oculta>',
].join('\n');

test('android: separa mensagens, multilinha, anexo com legenda, descarta sistema', () => {
  const m = P.parse(ANDROID);
  assert.equal(m.length, 3);
  assert.deepEqual(m[0], { data: '2026-09-19T21:21', autor: 'Fernando', texto: '============================\nCampeonao El Patron\n3 Tiros Peito\n============================', anexo: null });
  assert.deepEqual(m[1], { data: '2026-09-19T21:23', autor: 'Fernando', texto: 'alvo 4 cores', anexo: 'IMG-20260919-WA0001.jpg' });
  assert.deepEqual(m[2], { data: '2026-09-19T21:25', autor: 'Fernando', texto: '', anexo: 'PTT-20260919-WA0002.opus' });
});

test('ios: formato com colchetes, segundos e <anexado: ...>', () => {
  const ios = [
    '\u200e[19/09/2026, 21:21:05] Fernando: Campeonato Head Shot',
    '2 Tiros Cabeça',
    '[19/09/2026, 21:23:40] Fernando: \u200e<anexado: 00000012-PHOTO-2026-09-19-21-23-40.jpg>',
    'alvo',
  ].join('\n');
  const m = P.parse(ios);
  assert.equal(m.length, 2);
  assert.equal(m[0].data, '2026-09-19T21:21');
  assert.equal(m[0].texto, 'Campeonato Head Shot\n2 Tiros Cabeça');
  assert.equal(m[1].anexo, '00000012-PHOTO-2026-09-19-21-23-40.jpg');
  assert.equal(m[1].texto, 'alvo');
});

test('texto colado sem data vira uma mensagem com data = agora', () => {
  const m = P.parse('Campeonato Gauge Reload\nTiro com Recarga\n2 tiros com a Cal. 12', '2026-09-20T10:00');
  assert.equal(m.length, 1);
  assert.deepEqual(m[0], { data: '2026-09-20T10:00', autor: null, texto: 'Campeonato Gauge Reload\nTiro com Recarga\n2 tiros com a Cal. 12', anexo: null });
});

test('ano com dois digitos e hora com um digito', () => {
  const m = P.parse('5/1/26 9:07 - Fernando: teste');
  assert.equal(m[0].data, '2026-01-05T09:07');
});

test('filtrarNovas mantem so mensagens depois da ultima processada', () => {
  const m = P.parse(ANDROID);
  assert.equal(P.filtrarNovas(m, '2026-09-19T21:23').length, 1);
  assert.equal(P.filtrarNovas(m, null).length, 3);
});
