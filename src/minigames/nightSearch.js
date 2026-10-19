// 03 야간 증거 수집 — 2D 탐색 · 아이템 수집 (실시간)
import { dirOf } from './common.js';

function parseArea(def, points) {
  const map = def.map;
  const h = map.length;
  const w = map[0].length;
  const pts = [];
  let exit = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = map[y][x];
      if (c === 'X') exit = { x, y };
      const p = points.find((pp) => pp.char === c);
      if (p) pts.push({ ...p, x, y });
    }
  }
  return { ...def, w, h, exit, pts };
}

export function createSearch(preset, difficulty = 0) {
  const d = preset.difficulty?.[difficulty] || {};
  const points = preset.points.map((p) => ({ ...p, hidden: p.hidden || (d.hide || []).includes(p.id) }));
  const areas = {};
  for (const [id, def] of Object.entries(preset.areas)) areas[id] = parseArea(def, points.filter((p) => p.area === id));
  const dr = preset.drone;
  return {
    preset,
    areas,
    area: preset.start.area,
    pos: { x: preset.start.pos[0], y: preset.start.pos[1] },
    face: { x: 0, y: -1 },
    timeLeft: d.time ?? preset.time,
    collected: [],
    selected: [],
    phase: 'explore', // explore → sort → done
    inventory: false,
    investigating: null, // { id, t }
    moveCd: 0,
    held: null,
    drone: { area: dr.area, path: dr.path.map(([x, y]) => ({ x, y })), seg: 0, t: 0, x: dr.path[0][0], y: dr.path[0][1], speed: d.droneSpeed ?? dr.speed, radius: dr.radius, grace: 0 },
    cursor: 0,
    sortLeft: preset.sortTime,
    outcome: null,
    message: '',
    fade: 0,
    flash: 0,
  };
}

const A = (st) => st.areas[st.area];

export function walkable(area, x, y) {
  if (x < 0 || y < 0 || x >= area.w || y >= area.h) return false;
  const c = area.map[y][x];
  return c === '.' || c === 'X';
}

export function visiblePoints(st) {
  const r = st.preset.revealRange;
  return A(st).pts.filter((p) => !p.hidden || Math.max(Math.abs(p.x - st.pos.x), Math.abs(p.y - st.pos.y)) <= r);
}

// 바로 옆(8방향)에 있는 조사 가능 지점
export function nearPoint(st) {
  return visiblePoints(st).find((p) => !st.collected.includes(p.id) && Math.max(Math.abs(p.x - st.pos.x), Math.abs(p.y - st.pos.y)) <= 1) || null;
}

function enterArea(st, to) {
  const def = st.areas[to];
  const from = st.area;
  st.area = to;
  const sp = st.areas[from].exit && st.preset.areas[from].exit.spawn;
  st.pos = { x: sp[0], y: sp[1] };
  st.fade = 1;
  st.timeLeft -= 1;
  st.message = `${def.name}`;
}

export function searchStep(st, dx, dy) {
  if (st.phase !== 'explore' || st.investigating || st.outcome) return st;
  st.face = { x: dx, y: dy };
  const nx = st.pos.x + dx;
  const ny = st.pos.y + dy;
  const area = A(st);
  if (!walkable(area, nx, ny)) return st;
  st.pos = { x: nx, y: ny };
  if (area.exit && nx === area.exit.x && ny === area.exit.y) enterArea(st, st.preset.areas[st.area].exit.to);
  return st;
}

export function searchAct(st, action) {
  if (st.outcome) return st;
  if (st.phase === 'explore') {
    if (action.type === 'move') {
      st.held = { dx: action.dx, dy: action.dy };
      // 새로 누른 키는 바로 한 칸, 누르고 있는 동안은 일정 간격으로 이동
      if (!action.repeat || st.moveCd <= 0) {
        searchStep(st, action.dx, action.dy);
        st.moveCd = st.preset.moveDelay;
      }
    } else if (action.type === 'release') st.held = null;
    else if (action.type === 'investigate') {
      const p = nearPoint(st);
      if (p && !st.investigating) st.investigating = { id: p.id, t: 0 };
      else if (!p) st.message = '조사할 것이 근처에 없다.';
    } else if (action.type === 'inventory') st.inventory = !st.inventory;
    else if (action.type === 'finish') startSort(st);
  } else if (st.phase === 'sort') {
    const n = st.collected.length;
    if (action.type === 'move' && n) st.cursor = (st.cursor + (action.dy || action.dx) + n) % n;
    else if (action.type === 'toggle' && n) {
      const id = st.collected[st.cursor];
      if (st.selected.includes(id)) st.selected = st.selected.filter((s) => s !== id);
      else if (st.selected.length < st.preset.maxSelect) st.selected.push(id);
      else st.message = `최대 ${st.preset.maxSelect}개까지 고를 수 있다.`;
    } else if (action.type === 'finish') finish(st);
  }
  return st;
}

function startSort(st) {
  st.phase = 'sort';
  st.inventory = false;
  st.investigating = null;
  st.cursor = 0;
  st.message = '낮의 나에게 전할 증거를 최대 3개 고르세요.';
  if (!st.collected.length) finish(st);
}

function finish(st) {
  const n = st.collected.length;
  const th = st.preset.thresholds;
  st.phase = 'done';
  st.outcome = n >= th.clean ? 'clean_success' : n >= th.detected ? 'detected_success' : 'fail';
}

function droneTick(st, dt) {
  const d = st.drone;
  d.grace = Math.max(0, d.grace - dt);
  const a = d.path[d.seg];
  const b = d.path[(d.seg + 1) % d.path.length];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  d.t += (d.speed * dt) / len;
  if (d.t >= 1) {
    d.t = 0;
    d.seg = (d.seg + 1) % d.path.length;
  }
  const a2 = d.path[d.seg];
  const b2 = d.path[(d.seg + 1) % d.path.length];
  d.x = a2.x + (b2.x - a2.x) * d.t;
  d.y = a2.y + (b2.y - a2.y) * d.t;
  if (st.area === d.area && d.grace <= 0 && Math.hypot(d.x - st.pos.x, d.y - st.pos.y) < d.radius) {
    st.timeLeft -= st.preset.drone.penalty;
    st.flash = 1;
    st.investigating = null;
    const area = A(st);
    st.pos = { x: area.exit.x + 1, y: area.exit.y };
    d.grace = st.preset.drone.grace;
    st.message = `드론 탐조등에 걸렸다! 시간 -${st.preset.drone.penalty}초`;
  }
}

export function searchTick(st, dt) {
  st.fade = Math.max(0, st.fade - dt * 2);
  st.flash = Math.max(0, st.flash - dt * 2);
  if (st.outcome) return st;
  if (st.phase === 'explore') {
    st.timeLeft -= dt;
    st.moveCd -= dt;
    if (st.held && st.moveCd <= 0 && !st.inventory) {
      searchStep(st, st.held.dx, st.held.dy);
      st.moveCd = st.preset.moveDelay;
    }
    if (st.investigating) {
      st.investigating.t += dt;
      if (st.investigating.t >= st.preset.investigate) {
        const p = st.preset.points.find((pp) => pp.id === st.investigating.id);
        st.collected.push(p.id);
        st.investigating = null;
        st.message = `획득: ${p.item}`;
        st.lastFound = p.id;
      }
    }
    droneTick(st, dt);
    if (st.timeLeft <= 0) {
      st.timeLeft = 0;
      startSort(st);
    }
  } else if (st.phase === 'sort') {
    st.sortLeft -= dt;
    if (st.sortLeft <= 0) finish(st);
  }
  return st;
}

export const searchGame = {
  id: 'search',
  title: 'NIGHT 03 — 야간 증거 수집',
  goal: '아파트와 뒷골목을 돌며 낮의 내가 남긴 흔적을 찾으세요. 숨은 흔적은 가까이 가야 보입니다. 골목의 감시 드론 불빛은 피하세요. 다 찾았으면 Enter.',
  controls: [
    ['방향키 / WASD', '이동 (누르고 있으면 계속)'],
    ['E', '조사 (2초)'],
    ['I', '인벤토리 — 시간은 계속 흐름'],
    ['Enter', '탐색 종료 → 메시지에 담을 증거 고르기'],
  ],
  create: (preset, diff) => createSearch(preset, diff),
  key(st, e) {
    const d = dirOf(e.code);
    if (st.phase === 'explore') {
      if (d) return searchAct(st, { type: 'move', ...d, repeat: e.repeat });
      if (e.code === 'KeyE') return searchAct(st, { type: 'investigate' });
      if (e.code === 'KeyI') return searchAct(st, { type: 'inventory' });
      if (e.code === 'Enter') return searchAct(st, { type: 'finish' });
    } else if (st.phase === 'sort') {
      if (d) return searchAct(st, { type: 'move', ...d });
      if (e.code === 'Space') return searchAct(st, { type: 'toggle' });
      if (e.code === 'Enter') return searchAct(st, { type: 'finish' });
    }
  },
  keyUp(st, e) {
    if (dirOf(e.code)) searchAct(st, { type: 'release' });
  },
  tick: searchTick,
  hud: (st) =>
    st.phase === 'sort'
      ? `메시지 정리 · 남은 시간 <b>${Math.ceil(st.sortLeft)}s</b> · 선택 <b>${st.selected.length}/${st.preset.maxSelect}</b>`
      : `${A(st).name} · 남은 시간 <b>${Math.ceil(st.timeLeft)}s</b> · 증거 <b>${st.collected.length}/${st.preset.points.length}</b>`,
  message: (st) => st.message,
  result: (st) => (st.outcome ? { outcome: st.outcome, strikes: 0, turns: 0, data: { collected: [...st.collected], selected_evidence: [...st.selected] } } : null),
  draw(st, g, W, H, t) {
    const area = A(st);
    g.fillStyle = '#03050a';
    g.fillRect(0, 0, W, H);
    const cs = Math.floor(Math.min(W / area.w, (H * 0.9) / area.h));
    const ox = Math.floor((W - cs * area.w) / 2);
    const oy = Math.floor((H - cs * area.h) / 2);
    const night = st.area === 'apartment' ? ['#1b2336', '#171e2e', '#3b3446'] : ['#1a1f26', '#161a20', '#2e3540'];
    for (let y = 0; y < area.h; y++) {
      for (let x = 0; x < area.w; x++) {
        const c = area.map[y][x];
        const px = ox + x * cs;
        const py = oy + y * cs;
        if (c === '.' || c === 'X') {
          g.fillStyle = (x + y) % 2 ? night[0] : night[1];
          g.fillRect(px, py, cs, cs);
          if (c === 'X') {
            g.fillStyle = 'rgba(110,231,255,.35)';
            g.fillRect(px + 3, py + 3, cs - 6, cs - 6);
            g.fillStyle = '#e9eef5';
            g.font = `${Math.floor(cs * 0.3)}px "Noto Sans KR", sans-serif`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(st.area === 'apartment' ? '현관' : '집', px + cs / 2, py + cs / 2);
          }
        } else {
          g.fillStyle = night[2];
          g.fillRect(px, py, cs, cs);
          g.fillStyle = 'rgba(255,255,255,.05)';
          g.fillRect(px, py, cs, 3);
        }
      }
    }
    // 조사 지점
    const vis = visiblePoints(st);
    for (const p of vis) {
      const px = ox + p.x * cs + cs / 2;
      const py = oy + p.y * cs + cs / 2;
      const got = st.collected.includes(p.id);
      g.fillStyle = got ? 'rgba(140,150,170,.5)' : `rgba(255,214,120,${0.6 + Math.sin(t * 4 + p.x) * 0.3})`;
      g.beginPath();
      g.arc(px, py, cs * (got ? 0.12 : 0.2), 0, Math.PI * 2);
      g.fill();
    }
    // 드론
    const d = st.drone;
    if (st.area === d.area) {
      const dx = ox + d.x * cs + cs / 2;
      const dy = oy + d.y * cs + cs / 2;
      const grd = g.createRadialGradient(dx, dy, 0, dx, dy, d.radius * cs);
      grd.addColorStop(0, d.grace > 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,240,200,.55)');
      grd.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(dx, dy, d.radius * cs, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = Math.sin(t * 8) > 0 ? '#ff3355' : '#661020';
      g.beginPath();
      g.arc(dx, dy, cs * 0.12, 0, Math.PI * 2);
      g.fill();
    }
    // 플레이어
    const px = ox + st.pos.x * cs + cs / 2;
    const py = oy + st.pos.y * cs + cs / 2;
    g.fillStyle = '#8b7bff';
    g.shadowColor = '#8b7bff';
    g.shadowBlur = 14;
    g.beginPath();
    g.arc(px, py, cs * 0.3, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    // 어둠 (플레이어 주변만 밝다)
    const dark = g.createRadialGradient(px, py, cs * 1.5, px, py, cs * 5);
    dark.addColorStop(0, 'rgba(0,0,0,0)');
    dark.addColorStop(1, 'rgba(0,0,0,.82)');
    g.fillStyle = dark;
    g.fillRect(0, 0, W, H);
    // 근처 조사 안내 / 조사 진행 바
    const near = nearPoint(st);
    g.textAlign = 'center';
    g.font = `${Math.max(12, Math.floor(cs * 0.28))}px "Noto Sans KR", sans-serif`;
    if (st.investigating) {
      const r = st.investigating.t / st.preset.investigate;
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(px - cs, py - cs * 0.95, cs * 2, 8);
      g.fillStyle = '#ffd679';
      g.fillRect(px - cs, py - cs * 0.95, cs * 2 * r, 8);
    } else if (near && st.phase === 'explore') {
      g.fillStyle = '#ffd679';
      g.fillText(`[E] ${near.name}`, px, py - cs * 0.75);
    }
    // 인벤토리 / 정리 화면
    if (st.inventory || st.phase === 'sort') {
      g.fillStyle = 'rgba(4,7,12,.9)';
      g.fillRect(W * 0.12, H * 0.08, W * 0.76, H * 0.84);
      g.strokeStyle = 'rgba(110,231,255,.35)';
      g.strokeRect(W * 0.12, H * 0.08, W * 0.76, H * 0.84);
      g.textAlign = 'left';
      g.fillStyle = '#6ee7ff';
      g.font = '15px "Share Tech Mono", monospace';
      g.fillText(st.phase === 'sort' ? 'MESSAGE — 낮의 나에게 전할 증거 (Space 체크 · Enter 확정)' : 'INVENTORY (I 닫기)', W * 0.15, H * 0.14);
      if (!st.collected.length) {
        g.fillStyle = '#8b97a8';
        g.font = '15px "Noto Sans KR", sans-serif';
        g.fillText('아직 찾은 증거가 없다.', W * 0.15, H * 0.22);
      }
      const rowH = Math.min(52, (H * 0.7) / Math.max(1, st.collected.length));
      st.collected.forEach((id, i) => {
        const p = st.preset.points.find((pp) => pp.id === id);
        const y = H * 0.2 + i * rowH;
        const sel = st.selected.includes(id);
        if (st.phase === 'sort' && i === st.cursor) {
          g.fillStyle = 'rgba(110,231,255,.14)';
          g.fillRect(W * 0.14, y - 6, W * 0.72, rowH - 4);
        }
        g.fillStyle = sel ? '#5cff9d' : '#e9eef5';
        g.font = '15px "Noto Sans KR", sans-serif';
        g.fillText(`${st.phase === 'sort' ? (sel ? '☑ ' : '☐ ') : '• '}${p.item}`, W * 0.16, y + 12);
        g.fillStyle = '#8b97a8';
        g.font = '12px "Noto Sans KR", sans-serif';
        g.fillText(p.desc, W * 0.16, y + 30);
      });
    }
    if (st.fade > 0) {
      g.fillStyle = `rgba(0,0,0,${st.fade})`;
      g.fillRect(0, 0, W, H);
    }
    if (st.flash > 0) {
      g.fillStyle = `rgba(255,240,200,${st.flash * 0.35})`;
      g.fillRect(0, 0, W, H);
    }
  },
};
