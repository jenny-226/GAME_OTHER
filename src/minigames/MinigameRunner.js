// 미니게임 공통 실행기: 소개 카드 → 플레이 → 결과 카드, Esc 일시정지, R 재시작
import { stealthGame } from './stealth.js';
import { hackGame } from './memoryHack.js';
import { searchGame } from './nightSearch.js';
import stealth01 from '../../data/minigames/stealth_01.json';
import hack01 from '../../data/minigames/memory_hack_01.json';
import search01 from '../../data/minigames/night_search_01.json';

export const GAMES = { stealth: stealthGame, hack: hackGame, search: searchGame };
export const PRESETS = { stealth_01: stealth01, memory_hack_01: hack01, night_search_01: search01 };

const OUTCOME_LABEL = {
  clean_success: ['CLEAN', '완벽하게 성공했다'],
  detected_success: ['DETECTED', '성공했지만 흔적을 남겼다'],
  fail: ['FAILED', '실패했다 — 하지만 이야기는 계속된다'],
};

const $ = (s) => document.querySelector(s);

export function runMinigame({ game, preset, difficulty = 0, tag = '', sound }) {
  const def = GAMES[game];
  const data = PRESETS[preset];
  const root = $('#minigame');
  const canvas = $('#mg-canvas');
  const g = canvas.getContext('2d');
  $('#mg-tag').textContent = tag ? `[${tag}]` : def.title;
  $('#mg-title').textContent = def.title;
  $('#mg-goal').textContent = def.goal;
  $('#mg-diff').textContent = `난이도 ${['보통', '경계', '삼엄'][difficulty]}  ·  회사 의심도에 따라 달라집니다`;
  $('#mg-controls').innerHTML = def.controls.map(([k, d]) => `<li><kbd>${k}</kbd><span>${d}</span></li>`).join('');
  $('#mg-keys').textContent = def.controls.map(([k, d]) => `${k} ${d.split(' — ')[0].split(' (')[0]}`).join('  ·  ') + '  ·  R 재시작  ·  Esc 일시정지';
  root.classList.remove('hidden');

  let st;
  let mode = 'intro'; // intro | play | paused | end
  let last = performance.now();
  let t = 0;
  let raf = 0;
  let endAt = 0;

  const show = (id) => ['mg-intro', 'mg-pause', 'mg-end'].forEach((x) => $(`#${x}`).classList.toggle('hidden', x !== id));
  const reset = () => {
    st = def.create(data, difficulty);
    mode = 'intro';
    show('mg-intro');
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  reset();
  resize();
  window.addEventListener('resize', resize);

  return new Promise((resolve) => {
    const finish = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('resize', resize);
      root.classList.add('hidden');
      resolve({ ...def.result(st), elapsed_ms: Math.round(t * 1000) });
    };
    const onKey = (e) => {
      e.stopPropagation();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace'].includes(e.code)) e.preventDefault();
      if (mode === 'end') {
        if ((e.code === 'Space' || e.code === 'Enter') && performance.now() > endAt) finish();
        return;
      }
      if (e.code === 'Escape') {
        if (mode === 'play') { mode = 'paused'; show('mg-pause'); }
        else if (mode === 'paused') { mode = 'play'; show(null); }
        return;
      }
      if (e.code === 'KeyR' && mode !== 'intro') { reset(); return; }
      if (mode === 'intro') {
        if (e.code === 'Space' || e.code === 'Enter') { mode = 'play'; show(null); sound?.click(); }
        return;
      }
      if (mode === 'paused') return;
      const before = st.strikes;
      def.key(st, e);
      if (st.strikes > before) sound?.glitch();
      const msg = def.message(st);
      $('#mg-msg').textContent = msg || '';
    };
    const onUp = (e) => {
      if (mode !== 'play') return;
      def.keyUp?.(st, e);
      $('#mg-msg').textContent = def.message(st) || '';
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onUp, true);
    $('#mg-resume').onclick = () => { mode = 'play'; show(null); };
    $('#mg-restart').onclick = () => reset();
    $('#mg-start').onclick = () => { mode = 'play'; show(null); };
    $('#mg-continue').onclick = () => finish();

    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (mode === 'play') {
        t += dt;
        const beforeStrikes = st.strikes;
        def.tick(st, dt);
        if (st.strikes > beforeStrikes) sound?.glitch();
        const msg = def.message(st);
        if (msg) $('#mg-msg').textContent = msg;
        const res = def.result(st);
        if (res) {
          mode = 'end';
          endAt = performance.now() + 600;
          const [label, sub] = OUTCOME_LABEL[res.outcome];
          $('#mg-end-label').textContent = label;
          $('#mg-end-label').className = res.outcome;
          $('#mg-end-sub').textContent = sub;
          $('#mg-end-msg').textContent = def.message(st) || '';
          show('mg-end');
          if (res.outcome === 'fail') sound?.glitch();
          else sound?.pickup();
        }
      }
      else if (mode === 'end') def.tick(st, dt);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      g.clearRect(0, 0, W, H);
      def.draw(st, g, W, H, now / 1000);
      $('#mg-hud').innerHTML = def.hud(st);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });
}
