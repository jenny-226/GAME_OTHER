// 01 회사 잠입 미션 — 턴제 격자 잠입
import { key, manhattan, dirOf } from './common.js';

export function createStealth(preset, difficulty = 0) {
  const d = preset.difficulty?.[difficulty] || {};
  const guards = [...preset.guards, ...(d.addGuards || [])].map((g) => ({
    path: g.path.map(([x, y]) => ({ x, y })),
    idx: 0,
    dir: { x: g.dir[0], y: g.dir[1] },
    sight: g.sight + (d.sightBonus || 0),
  }));
  const st = {
    preset,
    w: preset.width,
    h: preset.height,
    walls: new Set(preset.walls.map(([x, y]) => key(x, y))),
    door: { x: preset.door[0], y: preset.door[1] },
    start: { x: preset.start[0], y: preset.start[1] },
    cameras: preset.cameras.map((c) => ({ cells: c.cells.map(([x, y]) => ({ x, y })), on: c.on })),
    guards,
    player: { x: preset.start[0], y: preset.start[1] },
    crouch: false,
    turn: 0,
    strikes: 0,
    outcome: null,
    message: '',
    flash: 0,
    shiftUsed: true,
  };
  return st;
}

const guardPos = (g) => g.path[g.idx];

export function blocked(st, x, y) {
  if (x < 0 || y < 0 || x >= st.w || y >= st.h) return true;
  if (st.walls.has(key(x, y))) return true;
  if (x === st.door.x && y === st.door.y) return true;
  return false;
}

export function cameraOn(st, cam) {
  return cam.on === 'odd' ? st.turn % 2 === 1 : st.turn % 2 === 0;
}

export function sightCells(st, g) {
  const out = [];
  const p = guardPos(g);
  for (let k = 1; k <= g.sight; k++) {
    const x = p.x + g.dir.x * k;
    const y = p.y + g.dir.y * k;
    if (x < 0 || y < 0 || x >= st.w || y >= st.h || st.walls.has(key(x, y))) break;
    out.push({ x, y });
  }
  return out;
}

function detected(st) {
  const p = st.player;
  for (const g of st.guards) {
    if (manhattan(p, guardPos(g)) <= 1) return '경비원과 부딪혔다';
    if (!st.crouch && sightCells(st, g).some((c) => c.x === p.x && c.y === p.y)) return '경비원의 시야에 들어갔다';
  }
  if (!st.crouch) {
    for (const cam of st.cameras) {
      if (cameraOn(st, cam) && cam.cells.some((c) => c.x === p.x && c.y === p.y)) return 'CCTV에 찍혔다';
    }
  }
  return null;
}

function caught(st, why) {
  st.strikes += 1;
  st.flash = 1;
  if (st.strikes >= st.preset.maxStrikes) {
    st.outcome = 'fail';
    st.message = `${why}. 경비원에게 붙잡혔다.`;
    return true;
  }
  st.player = { ...st.start };
  st.crouch = false;
  st.message = `발각! ${why}. 시작 지점으로 돌아갑니다 (${st.strikes}/${st.preset.maxStrikes})`;
  return true;
}

function moveGuards(st) {
  for (const g of st.guards) {
    const from = guardPos(g);
    g.idx = (g.idx + 1) % g.path.length;
    const to = guardPos(g);
    if (to.x !== from.x || to.y !== from.y) g.dir = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
  }
}

// 한 턴 진행: 1차 발각 → 경비원 이동 → 2차 발각
function worldTurn(st) {
  st.turn += 1;
  let why = detected(st);
  if (why) return caught(st, why);
  moveGuards(st);
  why = detected(st);
  if (why) return caught(st, why);
  return false;
}

// action: { type: 'move', dx, dy, crouch } | { type: 'wait' } | { type: 'open' }
export function stealthAct(st, action) {
  if (st.outcome) return st;
  st.message = '';
  if (action.type === 'open') {
    if (manhattan(st.player, st.door) !== 1) {
      st.message = '문과 맞닿은 칸에서 E를 누르세요.';
      return st;
    }
    st.turn += 1;
    st.outcome = st.strikes === 0 ? 'clean_success' : 'detected_success';
    st.message = '서버실 문이 열렸다.';
    return st;
  }
  if (action.type === 'wait') {
    st.crouch = true;
    worldTurn(st);
    return st;
  }
  const nx = st.player.x + action.dx;
  const ny = st.player.y + action.dy;
  if (blocked(st, nx, ny)) return st;
  if (st.guards.some((g) => guardPos(g).x === nx && guardPos(g).y === ny)) return st;
  st.player = { x: nx, y: ny };
  st.crouch = !!action.crouch;
  const turns = action.crouch ? st.preset.crouchMoveTurns : 1;
  for (let i = 0; i < turns; i++) {
    if (worldTurn(st) || st.outcome) break;
  }
  return st;
}

// ---------- 러너용 모듈 ----------
export const stealthGame = {
  id: 'stealth',
  title: 'MISSION 01 — 회사 잠입',
  goal: '경비원의 시야(노란 칸)와 켜진 CCTV(붉은 칸)를 피해 서버실 문(초록)에 닿은 뒤 E로 여세요.',
  controls: [
    ['WASD / 방향키', '한 칸 이동 (1턴)'],
    ['Shift + 이동', '웅크린 채 이동 — 시야·CCTV에 안 걸림, 2턴 소모'],
    ['Shift', '웅크리고 대기 (1턴)'],
    ['E', '맞닿은 문 열기'],
  ],
  create: (preset, diff) => createStealth(preset, diff),
  key(st, e) {
    if (e.code === 'KeyE') return stealthAct(st, { type: 'open' });
    const d = dirOf(e.code);
    if (d) {
      if (e.shiftKey) st.shiftUsed = true;
      return stealthAct(st, { type: 'move', ...d, crouch: e.shiftKey });
    }
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) st.shiftUsed = false;
  },
  // Shift를 이동 없이 눌렀다 떼면 웅크리고 대기
  keyUp(st, e) {
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !st.shiftUsed) stealthAct(st, { type: 'wait' });
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') st.shiftUsed = true;
  },
  tick(st, dt) {
    st.flash = Math.max(0, st.flash - dt * 2);
  },
  hud: (st) => `턴 <b>${st.turn}</b> · 발각 <b>${'●'.repeat(st.strikes)}${'○'.repeat(st.preset.maxStrikes - st.strikes)}</b> · ${st.crouch ? '<b>웅크림</b>' : '서 있음'}`,
  message: (st) => st.message,
  result: (st) => (st.outcome ? { outcome: st.outcome, strikes: st.strikes, turns: st.turn, data: {} } : null),
  draw(st, g, W, H, t) {
    const cs = Math.floor(Math.min(W / st.w, H / st.h));
    const ox = Math.floor((W - cs * st.w) / 2);
    const oy = Math.floor((H - cs * st.h) / 2);
    const cell = (x, y, color, pad = 0) => {
      g.fillStyle = color;
      g.fillRect(ox + x * cs + pad, oy + y * cs + pad, cs - pad * 2, cs - pad * 2);
    };
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) cell(x, y, (x + y) % 2 ? '#1b2330' : '#18202b', 1);
    // CCTV
    for (const cam of st.cameras) {
      const on = cameraOn(st, cam);
      for (const c of cam.cells) cell(c.x, c.y, on ? `rgba(255,60,90,${0.45 + Math.sin(t * 8) * 0.15})` : 'rgba(255,60,90,0.12)', 2);
    }
    // 시야
    for (const gd of st.guards) for (const c of sightCells(st, gd)) cell(c.x, c.y, 'rgba(255,200,70,0.28)', 2);
    for (const w of st.walls) {
      const [x, y] = w.split(',').map(Number);
      cell(x, y, '#3a4558', 0);
      g.fillStyle = '#4b5870';
      g.fillRect(ox + x * cs, oy + y * cs, cs, 4);
    }
    // 시작, 문
    g.strokeStyle = 'rgba(110,231,255,.5)';
    g.lineWidth = 2;
    g.strokeRect(ox + st.start.x * cs + 4, oy + st.start.y * cs + 4, cs - 8, cs - 8);
    cell(st.door.x, st.door.y, `rgba(92,255,157,${0.6 + Math.sin(t * 4) * 0.25})`, 3);
    g.fillStyle = '#05140b';
    g.font = `${Math.floor(cs * 0.28)}px "Share Tech Mono", monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('SERVER', ox + st.door.x * cs + cs / 2, oy + st.door.y * cs + cs / 2);
    // 경비원
    for (const gd of st.guards) {
      const p = guardPos(gd);
      const cx = ox + p.x * cs + cs / 2;
      const cy = oy + p.y * cs + cs / 2;
      g.fillStyle = '#ff5c7a';
      g.beginPath();
      g.arc(cx, cy, cs * 0.32, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#fff';
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + gd.dir.x * cs * 0.4, cy + gd.dir.y * cs * 0.4);
      g.stroke();
    }
    // 플레이어
    const px = ox + st.player.x * cs + cs / 2;
    const py = oy + st.player.y * cs + cs / 2;
    g.fillStyle = '#6ee7ff';
    g.shadowColor = '#6ee7ff';
    g.shadowBlur = 14;
    g.beginPath();
    g.arc(px, py, cs * (st.crouch ? 0.22 : 0.32), 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#e9eef5';
    g.font = `${Math.floor(cs * 0.24)}px "Noto Sans KR", sans-serif`;
    g.fillText('Julian', px, py - cs * 0.55);
    if (st.flash > 0) {
      g.fillStyle = `rgba(255,40,70,${st.flash * 0.35})`;
      g.fillRect(0, 0, W, H);
    }
  },
};
