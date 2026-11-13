// Rodar com: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GestureDetector } from '../js/gestures.js';

// Simula quadros a ~30 fps. Cada segmento: [duraçãoMs, sinais]. Devolve os eventos.
function run(det, segments, t0 = 0) {
  const events = [];
  let t = t0;
  for (const [ms, sig] of segments) {
    for (const end = t + ms; t < end; t += 33) {
      const e = det.update({ face: true, blink: 0, h: 0, v: 0, ...sig }, t);
      if (e) events.push({ ...e, t });
    }
  }
  return { events, t };
}
const answers = (r) => r.events.filter((e) => e.type === 'answer').map((e) => e.value);
const OPEN = {}, SHUT = { blink: 0.9 };

test('piscada: uma longa = SIM', () => {
  const d = new GestureDetector({ mode: 'blink' });
  assert.deepEqual(answers(run(d, [[500, OPEN], [1000, SHUT], [3000, OPEN]])), ['SIM']);
});

test('piscada: duas longas = NÃO', () => {
  const d = new GestureDetector({ mode: 'blink' });
  assert.deepEqual(answers(run(d, [[500, OPEN], [1000, SHUT], [600, OPEN], [1000, SHUT], [3000, OPEN]])), ['NAO']);
});

test('piscada: piscadas normais (curtas) não respondem nada', () => {
  const d = new GestureDetector({ mode: 'blink' });
  const segs = [];
  for (let i = 0; i < 20; i++) segs.push([2500, OPEN], [200, SHUT]);
  assert.deepEqual(answers(run(d, segs)), []);
});

test('piscada: piscada curta entre duas longas não atrapalha o NÃO', () => {
  const d = new GestureDetector({ mode: 'blink' });
  assert.deepEqual(answers(run(d, [[300, OPEN], [900, SHUT], [400, OPEN], [150, SHUT], [400, OPEN], [900, SHUT], [3000, OPEN]])), ['NAO']);
});

test('piscada: olhos fechados por muito tempo (descanso) é ignorado', () => {
  const d = new GestureDetector({ mode: 'blink' });
  assert.deepEqual(answers(run(d, [[500, OPEN], [8000, SHUT], [4000, OPEN]])), []);
});

test('piscada: avisa (tick) quando a piscada já é longa o bastante', () => {
  const d = new GestureDetector({ mode: 'blink' });
  const r = run(d, [[500, OPEN], [1000, SHUT]]);
  assert.equal(r.events.filter((e) => e.type === 'tick').length, 1);
});

test('olhar horizontal: direita = SIM, esquerda = NÃO', () => {
  const d = new GestureDetector({ mode: 'horizontal' });
  const r = run(d, [[500, OPEN], [1200, { h: 0.7 }], [2500, OPEN], [1200, { h: -0.7 }], [1000, OPEN]]);
  assert.deepEqual(answers(r), ['SIM', 'NAO']);
});

test('olhar: sustentar o olhar não repete a resposta', () => {
  const d = new GestureDetector({ mode: 'horizontal' });
  assert.deepEqual(answers(run(d, [[500, OPEN], [10000, { h: 0.7 }]])), ['SIM']);
});

test('olhar: olhada rápida (menor que o tempo mínimo) não conta', () => {
  const d = new GestureDetector({ mode: 'horizontal' });
  assert.deepEqual(answers(run(d, [[500, OPEN], [300, { h: 0.7 }], [1000, OPEN], [300, { h: -0.7 }], [1000, OPEN]])), []);
});

test('olhar vertical: cima = SIM, baixo = NÃO; piscada no meio não quebra', () => {
  const d = new GestureDetector({ mode: 'vertical' });
  const r = run(d, [[500, OPEN], [400, { v: 0.6 }], [150, { v: -0.8, blink: 0.9 }], [500, { v: 0.6 }],
    [2500, OPEN], [1200, { v: -0.6 }], [500, OPEN]]);
  assert.deepEqual(answers(r), ['SIM', 'NAO']);
});

test('olhar: calibração desconta o desvio natural do olhar', () => {
  const d = new GestureDetector({ mode: 'horizontal' });
  d.setBaseline(0.3, 0);
  assert.deepEqual(answers(run(d, [[3000, { h: 0.45 }]])), []);            // perto do "centro" dela
  assert.deepEqual(answers(run(d, [[1500, { h: 0.9 }]], 3000)), ['SIM']);
});

test('inverter troca SIM e NÃO', () => {
  const d = new GestureDetector({ mode: 'horizontal', invert: true });
  assert.deepEqual(answers(run(d, [[500, OPEN], [1200, { h: 0.7 }]])), ['NAO']);
});

test('sem rosto: zera o gesto em andamento', () => {
  const d = new GestureDetector({ mode: 'horizontal' });
  let t = 0; const ev = [];
  for (; t < 500; t += 33) ev.push(d.update({ face: true, blink: 0, h: 0.7, v: 0 }, t));
  for (; t < 800; t += 33) ev.push(d.update({ face: false }, t));
  for (; t < 1200; t += 33) ev.push(d.update({ face: true, blink: 0, h: 0.7, v: 0 }, t));
  assert.equal(ev.filter(Boolean).length, 0);
});
