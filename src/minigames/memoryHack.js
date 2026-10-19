// 02 기억 칩 해킹 — 1단계 데이터 경로 구성, 2단계 주파수(타이밍) 맞추기
import { key, dirOf } from './common.js';

export function createHack(preset, difficulty = 0) {
  const d = preset.difficulty?.[difficulty] || {};
  const watch = [...preset.watch, ...(d.addWatch || [])];
  return {
    preset,
    w: preset.width,
    h: preset.height,
    target: { x: preset.target[0], y: preset.target[1] },
    watch: new Set(watch.map(([x, y]) => key(x, y))),
    path: [{ x: preset.start[0], y: preset.start[1] }],
    phase: 'path', // path → sync
    timeLeft: d.pathTime ?? preset.pathTime,
    syncTime: preset.syncTime,
    period: d.period ?? preset.period,
    window: preset.window,
    clock: 0,
    cooldown: 0,
    hits: 0,
    strikes: 0,
    outcome: null,
    message: '',
    flash: 0,
    pulse: 0,
  };
}

const head = (st) => st.path[st.path.length - 1];

function strike(st, why) {
  st.strikes += 1;
  st.flash = 1;
  st.message = `${why} (${st.strikes}/${st.preset.maxStrikes})`;
  if (st.strikes >= st.preset.maxStrikes) {
    st.outcome = 'fail';
    st.message = '보안 AI가 접속을 차단했다. 기억 조각이 흩어진다.';
  }
}

// 현재 입력 파형과 목표 파형의 위상차 (라디안, -π~π)
export function phaseDiff(st) {
  const phi = ((st.clock % st.period) / st.period) * Math.PI * 2;
  return Math.atan2(Math.sin(phi), Math.cos(phi));
}

export function hackAct(st, action) {
  if (st.outcome) return st;
  if (st.phase === 'path') {
    if (action.type === 'move') {
      const h = head(st);
      const nx = h.x + action.dx;
      const ny = h.y + action.dy;
      if (nx < 0 || ny < 0 || nx >= st.w || ny >= st.h) return st;
      st.path.push({ x: nx, y: ny });
      st.message = '';
      if (st.watch.has(key(nx, ny))) strike(st, '감시 노드에 접촉했다');
    } else if (action.type === 'back') {
      if (st.path.length > 1) st.path.pop();
    } else if (action.type === 'confirm') {
      const h = head(st);
      if (h.x === st.target.x && h.y === st.target.y) {
        st.phase = 'sync';
        st.timeLeft = st.syncTime;
        st.clock = 0;
        st.message = '경로 연결 완료. 파형이 겹치는 순간 Space!';
      } else st.message = '목표 노드(기억 조각)까지 경로를 이어야 합니다.';
    }
    return st;
  }
  if (action.type === 'pulse') {
    if (st.cooldown > 0) return st;
    st.pulse = 1;
    if (Math.abs(phaseDiff(st)) <= st.window) {
      st.hits += 1;
      st.message = `동기화 성공 ${st.hits}/${st.preset.needHits}`;
      st.cooldown = st.period * 0.5;
      if (st.hits >= st.preset.needHits) {
        st.outcome = st.strikes === 0 ? 'clean_success' : 'detected_success';
        st.message = '삭제된 기억 복구 완료.';
      }
    } else {
      st.message = '어긋났다. 잠시 후 다시.';
      st.cooldown = st.preset.cooldown;
    }
  }
  return st;
}

export function hackTick(st, dt) {
  st.flash = Math.max(0, st.flash - dt * 2);
  st.pulse = Math.max(0, st.pulse - dt * 3);
  if (st.outcome) return st;
  st.timeLeft -= dt;
  st.clock += dt;
  st.cooldown = Math.max(0, st.cooldown - dt);
  if (st.timeLeft <= 0) {
    st.timeLeft = 0;
    st.outcome = 'fail';
    st.message = '시간 초과. 접속이 끊겼다.';
  }
  return st;
}

export const hackGame = {
  id: 'hack',
  title: 'HACK 02 — 기억 칩 해킹',
  goal: '1단계: 붉은 감시 노드를 피해 기억 조각(초록)까지 데이터 경로를 잇고 Enter. 2단계: 흔들리는 파형이 목표선과 겹치는 순간 Space를 3번 맞추세요.',
  controls: [
    ['방향키', '데이터 경로 선택'],
    ['Backspace', '마지막 경로 취소'],
    ['Enter', '경로 확정'],
    ['Space', '적절한 순간에 해킹 (2단계)'],
  ],
  create: (preset, diff) => createHack(preset, diff),
  key(st, e) {
    if (st.phase === 'path') {
      const d = dirOf(e.code);
      if (d) return hackAct(st, { type: 'move', ...d });
      if (e.code === 'Backspace') return hackAct(st, { type: 'back' });
      if (e.code === 'Enter') return hackAct(st, { type: 'confirm' });
    } else if (e.code === 'Space' && !e.repeat) return hackAct(st, { type: 'pulse' });
  },
  tick: hackTick,
  hud: (st) => `${st.phase === 'path' ? '1단계 · 경로' : '2단계 · 동기화'} · 남은 시간 <b>${Math.ceil(st.timeLeft)}s</b> · 발각 <b>${'●'.repeat(st.strikes)}${'○'.repeat(st.preset.maxStrikes - st.strikes)}</b>${st.phase === 'sync' ? ` · 성공 <b>${st.hits}/${st.preset.needHits}</b>` : ''}`,
  message: (st) => st.message,
  result: (st) => (st.outcome ? { outcome: st.outcome, strikes: st.strikes, turns: 0, data: { hits: st.hits } } : null),
  draw(st, g, W, H, t) {
    g.fillStyle = '#040b10';
    g.fillRect(0, 0, W, H);
    const top = st.phase === 'path' ? H : H * 0.55;
    const cs = Math.min(W / (st.w + 1), top / (st.h + 1));
    const ox = (W - cs * (st.w - 1)) / 2;
    const oy = (top - cs * (st.h - 1)) / 2;
    const P = (x, y) => [ox + x * cs, oy + y * cs];
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(110,231,255,.15)';
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
      if (x < st.w - 1) { g.beginPath(); g.moveTo(...P(x, y)); g.lineTo(...P(x + 1, y)); g.stroke(); }
      if (y < st.h - 1) { g.beginPath(); g.moveTo(...P(x, y)); g.lineTo(...P(x, y + 1)); g.stroke(); }
    }
    // 경로
    g.strokeStyle = '#6ee7ff';
    g.lineWidth = 5;
    g.shadowColor = '#6ee7ff';
    g.shadowBlur = 12;
    g.beginPath();
    st.path.forEach((p, i) => (i ? g.lineTo(...P(p.x, p.y)) : g.moveTo(...P(p.x, p.y))));
    g.stroke();
    g.shadowBlur = 0;
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
      const [px, py] = P(x, y);
      const w = st.watch.has(key(x, y));
      const tg = x === st.target.x && y === st.target.y;
      g.fillStyle = w ? `rgba(255,60,90,${0.7 + Math.sin(t * 5 + x) * 0.3})` : tg ? '#5cff9d' : '#1f3a4a';
      g.beginPath();
      g.arc(px, py, cs * (w || tg ? 0.18 : 0.1), 0, Math.PI * 2);
      g.fill();
      if (w) {
        g.fillStyle = '#05070b';
        g.beginPath();
        g.arc(px, py, cs * 0.06, 0, Math.PI * 2);
        g.fill();
      }
    }
    const h = head(st);
    const [hx, hy] = P(h.x, h.y);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(hx, hy, cs * 0.25 + Math.sin(t * 6) * 2, 0, Math.PI * 2);
    g.stroke();

    if (st.phase === 'sync') {
      const y0 = H * 0.78;
      const amp = H * 0.12;
      const span = W * 0.8;
      const x0 = W * 0.1;
      // 목표 파형 (고정)
      g.strokeStyle = 'rgba(92,255,157,.8)';
      g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = x0 + (span * i) / 200;
        const y = y0 - Math.sin((i / 200) * Math.PI * 4) * amp;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      // 입력 파형 (흐름)
      const phi = ((st.clock % st.period) / st.period) * Math.PI * 2;
      const near = Math.abs(phaseDiff(st)) <= st.window;
      g.strokeStyle = near ? '#ffffff' : '#ff5c7a';
      g.lineWidth = near ? 4 : 2;
      g.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = x0 + (span * i) / 200;
        const y = y0 - Math.sin((i / 200) * Math.PI * 4 + phi) * amp;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      g.fillStyle = near ? '#5cff9d' : 'rgba(233,238,245,.6)';
      g.font = '16px "Share Tech Mono", monospace';
      g.textAlign = 'center';
      g.fillText(near ? '◆ SYNC NOW ◆' : 'SIGNAL DRIFT', W / 2, y0 + amp + 30);
      if (st.pulse > 0) {
        g.fillStyle = `rgba(110,231,255,${st.pulse * 0.25})`;
        g.fillRect(0, top, W, H - top);
      }
    }
    if (st.flash > 0) {
      g.fillStyle = `rgba(255,40,70,${st.flash * 0.35})`;
      g.fillRect(0, 0, W, H);
    }
  },
};
