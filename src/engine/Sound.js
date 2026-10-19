// WebAudio로 만드는 간단한 효과음과 배경 드론 (외부 파일 없음)
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.drone = null;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  #tone(freq, dur, { type = 'sine', gain = 0.1, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  blip(speaker) {
    const base = speaker === 'sys' || speaker === 'j03' ? 220 : speaker === 'me' ? 520 : speaker ? 640 : 420;
    this.#tone(base + Math.random() * 40, 0.04, { type: 'square', gain: 0.012 });
  }

  click() {
    this.#tone(880, 0.08, { type: 'triangle', gain: 0.05, slide: -300 });
  }

  alert() {
    this.#tone(660, 0.12, { type: 'sine', gain: 0.04 });
    this.#tone(990, 0.16, { type: 'sine', gain: 0.03, delay: 0.08 });
  }

  pickup() {
    [523, 659, 784].forEach((f, i) => this.#tone(f, 0.18, { type: 'triangle', gain: 0.05, delay: i * 0.07 }));
  }

  glitch() {
    if (!this.ctx || this.muted) return;
    const len = 0.5;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.2 ? 1 : 0.2) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.16;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this.#tone(90, 0.5, { type: 'sawtooth', gain: 0.06, slide: -50 });
  }

  // 장소별 배경음: 낮은 음 두 개를 살짝 어긋나게
  ambience(freq = 55, { gain = 0.05, type = 'sine' } = {}) {
    if (!this.ctx) return;
    if (this.drone) {
      const old = this.drone;
      old.g.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1.5);
      setTimeout(() => old.oscs.forEach((o) => o.stop()), 1700);
      this.drone = null;
    }
    if (!freq) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + 2);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const oscs = [freq, freq * 1.5 + 0.7, freq * 2.01].map((f) => {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(lp);
      o.start();
      return o;
    });
    lp.connect(g).connect(this.master);
    this.drone = { g, oscs };
  }

  alarm(on) {
    if (!this.ctx) return;
    clearInterval(this.alarmTimer);
    if (!on) return;
    let hi = false;
    this.alarmTimer = setInterval(() => {
      hi = !hi;
      this.#tone(hi ? 740 : 560, 0.45, { type: 'square', gain: 0.018 });
    }, 500);
  }
}
