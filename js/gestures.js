// Lógica pura de interpretação dos gestos (sem câmera, sem DOM) — testável em Node.
// Entrada: sinais por quadro { face, blink, h, v } e o tempo em ms.
//   blink: 0 (olho aberto) .. 1 (fechado)
//   h: >0 olhando para a direita DA PESSOA, <0 para a esquerda
//   v: >0 olhando para cima, <0 para baixo
// Saída de update(): null | {type:'tick'} | {type:'answer', value:'SIM'|'NAO'}

export const DEFAULTS = {
  mode: 'blink',        // 'blink' | 'horizontal' | 'vertical'
  holdMs: 700,          // tempo mínimo da piscada longa / de sustentar o olhar
  sensitivity: 5,       // 1 (precisa de movimento amplo) .. 10 (movimento pequeno já conta)
  invert: false,        // troca qual lado/sentido é SIM
  eye: 'both',          // 'both' | 'left' | 'right' (olho da pessoa)
  blinkThreshold: 0.5,
  blinkMaxMs: 3000,     // olhos fechados por mais que isso = descansando, ignora
  blinkWindowMs: 2000,  // espera pela 2ª piscada longa antes de decidir SIM
  cooldownMs: 1500,     // pausa depois de cada resposta
};

export function gazeThreshold(sensitivity) {
  return 0.6 - 0.045 * sensitivity; // 1 → 0,555 ; 5 → 0,375 ; 10 → 0,15
}

// Converte os "blendshapes" do MediaPipe (objeto nome → valor) em sinais.
export function signalsFromBlendshapes(b, eye = 'both') {
  const pick = (l, r) => (eye === 'left' ? l : eye === 'right' ? r : (l + r) / 2);
  const g = (k) => b[k] || 0;
  const right = pick(g('eyeLookInLeft'), g('eyeLookOutRight'));
  const left = pick(g('eyeLookOutLeft'), g('eyeLookInRight'));
  const up = pick(g('eyeLookUpLeft'), g('eyeLookUpRight'));
  const down = pick(g('eyeLookDownLeft'), g('eyeLookDownRight'));
  return {
    face: true,
    blink: pick(g('eyeBlinkLeft'), g('eyeBlinkRight')),
    h: right - left,
    v: up - down,
  };
}

export class GestureDetector {
  constructor(config = {}) {
    this.config = { ...DEFAULTS, ...config };
    this.baseline = { h: 0, v: 0 };
    this.reset();
  }

  setConfig(patch) {
    Object.assign(this.config, patch);
    this.reset();
  }

  setBaseline(h, v) {
    this.baseline = { h, v };
  }

  reset() {
    this.cooldownUntil = 0;
    // piscada
    this.closedSince = null;
    this.ticked = false;
    this.longCount = 0;
    this.windowEnd = 0;
    // olhar
    this.candidate = null;
    this.candidateSince = 0;
    this.lastGazeFrame = 0;
    this.needNeutral = false;
    this.progress = 0; // 0..1, para a interface
    this.level = 0;    // valor atual do sinal usado, para a interface
  }

  _answer(value, t) {
    const v = this.config.invert ? (value === 'SIM' ? 'NAO' : 'SIM') : value;
    this.reset();
    this.cooldownUntil = t + this.config.cooldownMs;
    this.needNeutral = true;
    return { type: 'answer', value: v };
  }

  update(s, t) {
    const c = this.config;
    if (!s || !s.face) {
      const cd = this.cooldownUntil, nn = this.needNeutral;
      this.reset();
      this.cooldownUntil = cd;
      this.needNeutral = nn;
      return null;
    }
    return c.mode === 'blink' ? this._blink(s, t) : this._gaze(s, t);
  }

  _blink(s, t) {
    const c = this.config;
    this.level = s.blink;
    if (t < this.cooldownUntil) { this.progress = 0; this.closedSince = null; return null; }

    const closed = this.closedSince !== null
      ? s.blink > c.blinkThreshold * 0.7   // histerese: só "abre" abaixo de 70% do limiar
      : s.blink > c.blinkThreshold;

    if (closed) {
      if (this.closedSince === null) { this.closedSince = t; this.ticked = false; }
      const dur = t - this.closedSince;
      this.progress = Math.min(1, dur / c.holdMs);
      if (dur > c.blinkMaxMs) { this.longCount = 0; this.progress = 0; return null; }
      if (!this.ticked && dur >= c.holdMs) { this.ticked = true; return { type: 'tick' }; }
      return null;
    }

    // olho aberto
    if (this.closedSince !== null) {
      const dur = t - this.closedSince;
      this.closedSince = null;
      this.progress = 0;
      if (dur >= c.holdMs && dur <= c.blinkMaxMs) {
        this.longCount += 1;
        this.windowEnd = t + c.blinkWindowMs;
        if (this.longCount >= 2) return this._answer('NAO', t);
      }
      return null;
    }
    if (this.longCount === 1 && t >= this.windowEnd) return this._answer('SIM', t);
    return null;
  }

  _gaze(s, t) {
    const c = this.config;
    const T = gazeThreshold(c.sensitivity);
    const raw = c.mode === 'horizontal' ? s.h - this.baseline.h : s.v - this.baseline.v;
    this.level = raw;

    // Durante a piscada o olhar não é confiável: pula o quadro (se durar, zera).
    if (s.blink > c.blinkThreshold) {
      if (t - this.lastGazeFrame > 400) { this.candidate = null; this.progress = 0; }
      return null;
    }
    this.lastGazeFrame = t;

    const dir = raw > T ? 'pos' : raw < -T ? 'neg' : null;

    if (this.needNeutral || t < this.cooldownUntil) {
      // só rearma depois de voltar ao centro
      if (Math.abs(raw) < T * 0.6 && t >= this.cooldownUntil) this.needNeutral = false;
      this.candidate = null;
      this.progress = 0;
      return null;
    }

    if (dir !== this.candidate) {
      this.candidate = dir;
      this.candidateSince = t;
      this.progress = 0;
      return null;
    }
    if (!dir) return null;

    const dur = t - this.candidateSince;
    this.progress = Math.min(1, dur / c.holdMs);
    // direita / cima = SIM ; esquerda / baixo = NÃO (antes de "inverter")
    if (dur >= c.holdMs) return this._answer(dir === 'pos' ? 'SIM' : 'NAO', t);
    return null;
  }
}
