import { EVIDENCE_NAMES } from '../state/GameState.js';

const $ = (s) => document.querySelector(s);

const SPEAKERS = {
  mira: { name: '서미라', cls: '' },
  guard: { name: '경비원 박', cls: '' },
  daniel: { name: '다니엘 한', cls: '' },
  sender: { name: '발신자: 나', cls: 'night' },
  sys: { name: 'SYSTEM', cls: 'sys' },
  sec: { name: '보안요원', cls: 'sys' },
  j03: { name: 'JULIAN-03', cls: 'j03' },
};

const STAT_LABEL = { trust: '자아 신뢰도', suspicion: '회사 의심도', memory: '기억 손상도' };

// 화면 UI: HUD, 대화창, 선택지, 알림, 화면 전환
export class UI {
  constructor(sound) {
    this.sound = sound;
    this.self = 'day';
    this.advance = null;
    this.choiceHandler = null;
    window.addEventListener('keydown', (e) => this.#key(e));
    $('#dlg-box').addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      this.advance?.();
    });
  }

  #key(e) {
    if ($('#dialogue').classList.contains('hidden')) return;
    if (this.choiceHandler) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) this.choiceHandler(n - 1);
      return;
    }
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
      e.preventDefault();
      this.advance?.();
    }
  }

  // ---------- HUD ----------
  showHUD(on) {
    $('#hud').classList.toggle('hidden', !on);
    $('#crosshair').classList.toggle('hidden', !on);
  }

  updateHUD(state, level) {
    if (level) {
      $('#hud-chapter').textContent = level.chapter;
      $('#hud-loc').textContent = level.place;
      this.self = level.self;
      const s = $('#hud-self');
      s.textContent = level.self === 'night' ? '밤의 나 · JULIAN-02' : '낮의 나 · JULIAN-01';
      s.className = level.self === 'night' ? 'self-night' : 'self-day';
    }
    $('#hud-time').textContent = state.time;
    $('#hud-objective span').textContent = state.objective || '주변을 둘러보자';
    for (const k of ['trust', 'suspicion', 'memory']) {
      $(`#bar-${k}`).style.width = `${state[k]}%`;
      $(`#val-${k}`).textContent = state[k];
    }
    $('#hud-evidence b').textContent = state.evidence.length;
  }

  setPrompt(label) {
    const p = $('#prompt');
    p.classList.toggle('hidden', !label);
    if (label) p.querySelector('span').textContent = label;
    $('#crosshair').classList.toggle('active', !!label);
    $('#touch-act').style.opacity = label ? 1 : 0.35;
  }

  lookHint(on) {
    $('#lookhint').classList.toggle('hidden', !on);
  }

  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3300);
  }

  notifyChanges(changes) {
    for (const c of changes) {
      if (c.type === 'stat') {
        const sign = c.delta > 0 ? '+' : '';
        const bad = (c.key === 'trust' && c.delta < 0) || (c.key !== 'trust' && c.delta > 0);
        this.toast(`${STAT_LABEL[c.key]} ${sign}${c.delta}`, bad ? 'minus' : '');
      } else if (c.type === 'evidence') {
        this.toast(`증거 획득 · ${EVIDENCE_NAMES[c.id] ?? c.id}`, 'ev');
        this.sound?.pickup();
      }
    }
  }

  glitch() {
    const g = $('#fx-glitch');
    g.classList.remove('on');
    void g.offsetWidth;
    g.classList.add('on');
    this.sound?.glitch();
  }

  // ---------- 대화 ----------
  openDialogue() {
    $('#dialogue').classList.remove('hidden');
    this.showHUD(true);
    $('#crosshair').classList.add('hidden');
    this.setPrompt(null);
  }

  closeDialogue() {
    $('#dialogue').classList.add('hidden');
    $('#crosshair').classList.remove('hidden');
    $('#dlg-choices').innerHTML = '';
  }

  // 한 줄을 타자 효과로 출력하고, 입력을 받으면 resolve
  say(line) {
    const spk = $('#dlg-speaker');
    const txt = $('#dlg-text');
    const info = this.#speaker(line.s);
    spk.textContent = info.name;
    spk.className = info.cls;
    txt.className = line.style === 'note' ? 'note' : line.s ? '' : 'narration';
    $('#dlg-choices').innerHTML = '';
    $('#dlg-next').classList.remove('hidden');
    $('#dlg-timer').classList.add('hidden');
    if (line.glitch) this.glitch();

    const full = line.t;
    let i = 0;
    txt.textContent = '';
    return new Promise((resolve) => {
      let done = false;
      const timer = setInterval(() => {
        i += 1;
        txt.textContent = full.slice(0, i);
        if (i % 3 === 0 && full[i] !== ' ') this.sound?.blip(line.s);
        if (i >= full.length) {
          clearInterval(timer);
          done = true;
        }
      }, 24);
      this.advance = () => {
        if (!done) {
          clearInterval(timer);
          txt.textContent = full;
          done = true;
          return;
        }
        this.advance = null;
        resolve();
      };
    });
  }

  // 선택지 표시. options: [{text, disabled, note}] → 고른 인덱스
  choose(options, { timer = 0, timeoutIndex = 0 } = {}) {
    const list = $('#dlg-choices');
    list.innerHTML = '';
    $('#dlg-next').classList.add('hidden');
    this.sound?.alert();
    return new Promise((resolve) => {
      let t0 = performance.now();
      let raf = 0;
      const finish = (i) => {
        if (options[i]?.disabled) return;
        this.choiceHandler = null;
        cancelAnimationFrame(raf);
        $('#dlg-timer').classList.add('hidden');
        this.sound?.click();
        resolve(i);
      };
      options.forEach((o, i) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.innerHTML = `<b>${i + 1}</b><span></span>`;
        b.querySelector('span').textContent = o.text;
        if (o.disabled) {
          b.disabled = true;
          const sm = document.createElement('small');
          sm.textContent = `🔒 ${o.note}`;
          b.querySelector('span').appendChild(sm);
        }
        b.addEventListener('click', () => finish(i));
        li.appendChild(b);
        list.appendChild(li);
      });
      this.choiceHandler = finish;
      if (timer > 0) {
        const bar = $('#dlg-timer');
        bar.classList.remove('hidden');
        const fill = bar.querySelector('i');
        t0 = performance.now();
        const tick = () => {
          const left = 1 - (performance.now() - t0) / (timer * 1000);
          fill.style.width = `${Math.max(0, left) * 100}%`;
          if (left <= 0) {
            this.toast('시간 초과 — 몸이 먼저 움직였다', 'minus');
            finish(timeoutIndex);
            return;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
    });
  }

  #speaker(s) {
    if (!s) return { name: '', cls: '' };
    if (s === 'me') return this.self === 'night' ? { name: '나 · 밤의 Julian', cls: 'night' } : { name: '나 · 낮의 Julian', cls: 'day' };
    return SPEAKERS[s] ?? { name: s, cls: '' };
  }

  // ---------- 전환 ----------
  async fadeCard({ chapter = '', title = '', sub = '' }, hold = 1600) {
    $('#card-chapter').textContent = chapter;
    $('#card-title').textContent = title;
    $('#card-sub').textContent = sub;
    $('#fade').classList.add('on');
    await wait(1000 + hold);
  }

  async fadeOut() {
    $('#fade').classList.remove('on');
    await wait(700);
  }

  screen(id, on) {
    $(`#${id}`).classList.toggle('hidden', !on);
  }
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
