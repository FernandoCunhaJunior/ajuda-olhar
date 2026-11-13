import { FaceLandmarker, FilesetResolver } from '../vendor/tasks-vision/vision_bundle.mjs';
import { GestureDetector, DEFAULTS, gazeThreshold, signalsFromBlendshapes } from './gestures.js';

const MODELO_LOCAL = 'models/face_landmarker.task';
const MODELO_REMOTO = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const CHAVE = 'ajuda-olhar-config';

const $ = (id) => document.getElementById(id);
const el = {
  inicio: $('tela-inicio'), uso: $('tela-uso'), iniciar: $('btn-iniciar'), msg: $('msg-inicio'),
  video: $('video'), rosto: $('status-rosto'),
  resposta: $('resposta'), icone: $('resposta-icone'), texto: $('resposta-texto'), dica: $('resposta-dica'),
  rotulo: $('rotulo-sinal'), sinal: $('sinal-fill'), limA: $('lim-a'), limB: $('lim-b'), prog: $('progresso-fill'),
  calibrar: $('btn-calibrar'), btnAjustes: $('btn-ajustes'), parar: $('btn-parar'), ajustes: $('ajustes'),
  modo: $('cfg-modo'), hold: $('cfg-hold'), outHold: $('out-hold'), sens: $('cfg-sens'), outSens: $('out-sens'),
  lblSens: $('lbl-sens'), olho: $('cfg-olho'), inverter: $('cfg-inverter'), voz: $('cfg-voz'), historico: $('historico'),
};

// ---------- configuração ----------
function carregarConfig() {
  let salvo = {};
  try { salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch { /* sem armazenamento */ }
  return { mode: DEFAULTS.mode, holdMs: DEFAULTS.holdMs, sensitivity: DEFAULTS.sensitivity,
    invert: false, eye: 'both', voz: true, ...salvo };
}
const cfg = carregarConfig();
const detector = new GestureDetector(cfg);

function salvarConfig() {
  try { localStorage.setItem(CHAVE, JSON.stringify(cfg)); } catch { /* ignora */ }
}

function dicaDoModo() {
  const [a, b] = cfg.invert ? ['NÃO', 'SIM'] : ['SIM', 'NÃO'];
  if (cfg.mode === 'blink') return `1 piscada longa = ${a} · 2 piscadas longas = ${b}`;
  if (cfg.mode === 'horizontal') return `olhar para a direita = ${a} · esquerda = ${b}`;
  return `olhar para cima = ${a} · baixo = ${b}`;
}

function aplicarConfig() {
  detector.setConfig({ mode: cfg.mode, holdMs: cfg.holdMs, sensitivity: cfg.sensitivity, invert: cfg.invert, eye: cfg.eye });
  el.modo.value = cfg.mode;
  el.hold.value = cfg.holdMs;
  el.outHold.textContent = (cfg.holdMs / 1000).toFixed(1).replace('.', ',') + ' s';
  el.sens.value = cfg.sensitivity;
  el.outSens.textContent = cfg.sensitivity;
  el.olho.value = cfg.eye;
  el.inverter.checked = cfg.invert;
  el.voz.checked = cfg.voz;
  el.lblSens.hidden = cfg.mode === 'blink';
  el.calibrar.hidden = cfg.mode === 'blink';
  el.rotulo.textContent = cfg.mode === 'blink' ? 'Olhos fechados' : cfg.mode === 'horizontal' ? 'Olhar para os lados' : 'Olhar para cima / baixo';
  document.querySelectorAll('input[name=modo]').forEach((r) => { r.checked = r.value === cfg.mode; });
  // marcas de limiar na barra
  if (cfg.mode === 'blink') {
    el.limA.style.left = DEFAULTS.blinkThreshold * 100 + '%';
    el.limB.hidden = true;
  } else {
    const T = gazeThreshold(cfg.sensitivity);
    el.limA.style.left = 50 + T * 50 + '%';
    el.limB.style.left = 50 - T * 50 + '%';
    el.limB.hidden = false;
  }
  if (el.resposta.classList.contains('espera')) el.dica.textContent = dicaDoModo();
  salvarConfig();
}

document.querySelectorAll('input[name=modo]').forEach((r) =>
  r.addEventListener('change', () => { cfg.mode = r.value; aplicarConfig(); }));
el.modo.addEventListener('change', () => { cfg.mode = el.modo.value; aplicarConfig(); });
el.hold.addEventListener('input', () => { cfg.holdMs = +el.hold.value; aplicarConfig(); });
el.sens.addEventListener('input', () => { cfg.sensitivity = +el.sens.value; aplicarConfig(); });
el.olho.addEventListener('change', () => { cfg.eye = el.olho.value; aplicarConfig(); });
el.inverter.addEventListener('change', () => { cfg.invert = el.inverter.checked; aplicarConfig(); });
el.voz.addEventListener('change', () => { cfg.voz = el.voz.checked; aplicarConfig(); });
el.btnAjustes.addEventListener('click', () => {
  el.ajustes.hidden = !el.ajustes.hidden;
  el.btnAjustes.setAttribute('aria-expanded', String(!el.ajustes.hidden));
});

// ---------- som e voz ----------
let audio = null;
function bip(freq = 880, ms = 90) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = freq; g.gain.value = 0.15;
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + ms / 1000);
  } catch { /* sem áudio */ }
}
function falar(txt) {
  if (!cfg.voz || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = 'pt-BR'; u.rate = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* ignora */ }
}

// ---------- resposta ----------
let limparEm = 0;
function mostrarResposta(valor) {
  const sim = valor === 'SIM';
  el.resposta.className = 'resposta ' + (sim ? 'sim' : 'nao');
  el.icone.textContent = sim ? '✓' : '✕';
  el.texto.textContent = sim ? 'SIM' : 'NÃO';
  el.dica.textContent = '';
  limparEm = performance.now() + 5000;
  falar(sim ? 'Sim' : 'Não');
  if (navigator.vibrate) navigator.vibrate(sim ? 150 : [120, 80, 120]);
  const li = document.createElement('li');
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  li.innerHTML = `<b>${sim ? 'SIM' : 'NÃO'}</b> — ${hora}`;
  el.historico.prepend(li);
}
function mostrarEspera() {
  el.resposta.className = 'resposta espera';
  el.icone.textContent = '';
  el.texto.textContent = 'Aguardando…';
  el.dica.textContent = dicaDoModo();
  limparEm = 0;
}

// ---------- calibração (centro do olhar) ----------
let calib = null; // { ate, n, h, v }
function calibrar() {
  calib = { ate: performance.now() + 2000, n: 0, h: 0, v: 0 };
  el.calibrar.disabled = true;
  el.calibrar.textContent = 'Olhe para a tela…';
}
el.calibrar.addEventListener('click', calibrar);

// ---------- câmera + detecção ----------
let landmarker = null, stream = null, rodando = false, wakeLock = null, jaCalibrou = false, ultimoTempoVideo = -1;

async function criarLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks('vendor/tasks-vision/wasm');
  let modelo = MODELO_REMOTO;
  try { if ((await fetch(MODELO_LOCAL, { method: 'HEAD' })).ok) modelo = MODELO_LOCAL; } catch { /* usa o remoto */ }
  const opcoes = (delegate) => ({
    baseOptions: { modelAssetPath: modelo, delegate },
    runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
  });
  try { return await FaceLandmarker.createFromOptions(fileset, opcoes('GPU')); }
  catch { return await FaceLandmarker.createFromOptions(fileset, opcoes('CPU')); }
}

async function pedirWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* ignora */ }
}
document.addEventListener('visibilitychange', () => { if (rodando && document.visibilityState === 'visible') pedirWakeLock(); });

async function iniciar() {
  el.iniciar.disabled = true;
  el.msg.textContent = 'Abrindo a câmera…';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('sem-camera');
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    el.video.srcObject = stream;
    await el.video.play();
    el.msg.textContent = 'Carregando o reconhecimento facial (na primeira vez pode demorar)…';
    landmarker = landmarker || await criarLandmarker();
  } catch (e) {
    console.error(e);
    pararCamera();
    el.iniciar.disabled = false;
    el.msg.textContent = e?.name === 'NotAllowedError' ? 'Permissão da câmera negada. Libere a câmera nas configurações do navegador e tente de novo.'
      : e?.message === 'sem-camera' || e?.name === 'NotFoundError' ? 'Não encontrei câmera neste aparelho (o site precisa estar em https).'
      : 'Não foi possível iniciar. Verifique a internet e tente de novo.';
    return;
  }
  bip(660, 60); // também destrava o áudio no iOS
  el.msg.textContent = '';
  el.inicio.hidden = true; el.uso.hidden = false;
  rodando = true; jaCalibrou = false;
  mostrarEspera();
  pedirWakeLock();
  requestAnimationFrame(quadro);
}

function pararCamera() {
  rodando = false;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  wakeLock?.release?.().catch(() => {}); wakeLock = null;
}
function parar() {
  pararCamera();
  detector.reset();
  el.uso.hidden = true; el.inicio.hidden = false; el.iniciar.disabled = false;
}

function quadro() {
  if (!rodando) return;
  const agora = performance.now();
  if (el.video.readyState >= 2 && el.video.currentTime !== ultimoTempoVideo) {
    ultimoTempoVideo = el.video.currentTime;
    let res = null;
    try { res = landmarker.detectForVideo(el.video, agora); } catch (e) { console.error(e); }
    const cats = res?.faceBlendshapes?.[0]?.categories;
    let s = { face: false };
    if (cats) {
      const b = {};
      for (const c of cats) b[c.categoryName] = c.score;
      s = signalsFromBlendshapes(b, cfg.eye);
    }
    el.rosto.textContent = s.face ? 'rosto detectado' : 'procurando rosto…';
    el.rosto.classList.toggle('ok', s.face);

    if (s.face && !jaCalibrou && cfg.mode !== 'blink') { jaCalibrou = true; calibrar(); }
    if (calib) {
      if (s.face && s.blink < 0.4) { calib.n++; calib.h += s.h; calib.v += s.v; }
      if (agora >= calib.ate) {
        if (calib.n > 5) { detector.setBaseline(calib.h / calib.n, calib.v / calib.n); bip(1000, 60); }
        calib = null; detector.reset();
        el.calibrar.disabled = false; el.calibrar.textContent = 'Calibrar centro';
      }
    } else {
      const ev = detector.update(s, agora);
      if (ev?.type === 'tick') bip(880, 70);
      if (ev?.type === 'answer') mostrarResposta(ev.value);
    }
    desenharMedidores();
  }
  if (limparEm && agora > limparEm) mostrarEspera();
  requestAnimationFrame(quadro);
}

function desenharMedidores() {
  const n = detector.level;
  if (cfg.mode === 'blink') {
    el.sinal.style.left = '0'; el.sinal.style.width = Math.max(0, Math.min(1, n)) * 100 + '%';
  } else {
    // a barra acompanha a imagem espelhada: direita da pessoa aparece à esquerda da tela
    const x = Math.max(-1, Math.min(1, cfg.mode === 'horizontal' ? -n : n)) * 50;
    el.sinal.style.left = (x < 0 ? 50 + x : 50) + '%';
    el.sinal.style.width = Math.abs(x) + '%';
  }
  el.prog.style.width = detector.progress * 100 + '%';
}

el.iniciar.addEventListener('click', iniciar);
el.parar.addEventListener('click', parar);
aplicarConfig();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
