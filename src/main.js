import './style.css';
import * as THREE from 'three';
import story from '../data/story.json';
import endings from '../data/endings.json';
import { World } from './engine/World.js';
import { Sound } from './engine/Sound.js';
import { UI, wait } from './ui/UI.js';
import { LEVELS } from './levels/index.js';
import { StoryEngine, visibleLines } from './story/StoryEngine.js';
import { createState, resolveEnding, EVIDENCE_NAMES } from './state/GameState.js';
import * as Save from './state/SaveManager.js';

const $ = (s) => document.querySelector(s);
const sound = new Sound();
const ui = new UI(sound);

let state = createState();
let checkpoint = null;
let levelDef = null;
let levelApi = null;
let events = {};
let busy = false;
let playing = false;

const world = new World($('#viewport'), {
  onInteract: (entry) => interact(entry),
  onTrigger: (t) => runNode(typeof t.node === 'function' ? t.node() : t.node, { key: t.key }),
});
world.onFocus = (f) => ui.setPrompt(f ? f.label : null);
world.onLockChange = (locked) => {
  // Esc로 시점 잠금이 풀리면 일시정지 메뉴를 연다
  if (!locked && world.enabled && !world.selfRelease && playing) pause(true);
  world.selfRelease = false;
  updateLookHint(locked);
};
world.bindStick($('#stick'), $('#touch-act'));

function updateLookHint(locked) {
  ui.lookHint(playing && world.enabled && !locked && !world.isTouch);
}

// ---------- 스토리 ----------
const engine = () =>
  new StoryEngine(story, state, {
    say: (line) => ui.say(line),
    choose: (opts, o) => ui.choose(opts, o),
    notify: (changes) => ui.notifyChanges(changes),
    event: (name) => fire(name),
    changed: () => ui.updateHUD(state),
  });

function fire(name) {
  if (name === 'glitch') ui.glitch();
  for (const fn of events[name] || []) fn();
}

function nodeOf(entry) {
  return typeof entry.node === 'function' ? entry.node() : entry.node;
}

async function interact(entry) {
  const id = nodeOf(entry);
  if (!id) return;
  if (entry.speaker) {
    const head = new THREE.Vector3();
    entry.speaker.userData.head.getWorldPosition(head);
    world.lookAt(head);
  }
  const key = typeof entry.node === 'string' ? entry.node : null;
  await runNode(id, { key: entry.once ? key : null });
}

async function runNode(id, { key } = {}) {
  if (busy || !id) return;
  busy = true;
  world.setEnabled(false);
  world.releasePointer();
  ui.lookHint(false);
  ui.openDialogue();
  let result;
  try {
    result = await engine().run(id);
  } catch (err) {
    console.error(err);
    result = {};
  }
  if (key) state.flags[`done_${key}`] = true;
  ui.closeDialogue();
  ui.updateHUD(state);
  busy = false;

  if (result.ending) return showEnding(result.ending);
  if (result.goto) return loadLevel(result.goto);
  Save.save({ ...state, checkpoint });
  world.setEnabled(true);
  updateLookHint(world.locked);
}

// ---------- 장소 ----------
async function loadLevel(id, { fromSave = false } = {}) {
  const def = LEVELS[id];
  playing = true;
  world.setEnabled(false);
  world.releasePointer();
  ui.setPrompt(null);
  ui.lookHint(false);
  await ui.fadeCard({ chapter: def.chapter.split(' · ')[0], title: def.title, sub: `${def.time} · ${def.place}` }, fromSave ? 600 : 1500);

  levelApi?.leave?.();
  world.clear();
  events = {};
  levelDef = def;
  if (!fromSave || state.level !== id) {
    state.level = id;
    state.time = def.time;
  }
  state.objective = state.flags[`entered_${id}`] ? state.objective : '';
  checkpoint = fromSave && state.checkpoint ? state.checkpoint : snapshot();

  const ctx = world.makeContext({
    state,
    sound,
    on: (name, fn) => (events[name] ||= []).push(fn),
  });
  const baseInteract = ctx.interact;
  // once 상호작용은 한 번 끝나면 조사 대상에서 빠진다
  ctx.interact = (obj, def) =>
    baseInteract(obj, {
      ...def,
      enabled: () => {
        if (def.once && typeof def.node === 'string' && state.flags[`done_${def.node}`]) return false;
        return def.enabled ? def.enabled() !== false : true;
      },
    });
  levelApi = def.build(ctx) || {};
  const sp = levelApi.spawn || { x: 0, z: 0, yaw: 0 };
  world.setPlayer(sp.x, sp.z, sp.yaw);
  // 이미 끝난 트리거는 다시 발동하지 않는다
  for (const t of world.triggers) if (t.key && state.flags[`done_${t.key}`]) t.fired = true;

  ui.updateHUD(state, def);
  ui.showHUD(true);
  $('#touch').classList.toggle('hidden', !world.isTouch);
  sound.ambience(def.drone[0], { gain: def.drone[1] });
  await ui.fadeOut();

  if (!state.flags[`entered_${id}`]) {
    state.flags[`entered_${id}`] = true;
    await wait(250);
    await runNode(def.enter);
  } else {
    Save.save({ ...state, checkpoint });
    world.setEnabled(true);
    updateLookHint(world.locked);
  }
}

function snapshot() {
  const { checkpoint: _c, ...rest } = state;
  return JSON.parse(JSON.stringify(rest));
}

// ---------- 엔딩 ----------
async function showEnding(chosen) {
  const id = resolveEnding(state, chosen);
  state.ending = id;
  const found = Save.recordEnding(id);
  Save.clear();
  world.setEnabled(false);
  ui.showHUD(false);
  $('#touch').classList.add('hidden');
  ui.glitch();
  fire('ending_camera');
  sound.ambience(id === 'third' ? 30 : 49, { gain: 0.05 });
  await wait(1200);

  const e = endings[id];
  $('#end-title').textContent = e.title;
  const box = $('#end-text');
  box.innerHTML = '';
  for (const line of visibleLines(state, e.lines)) {
    const p = document.createElement('p');
    p.textContent = line.t;
    if (line.style) p.className = line.style;
    box.appendChild(p);
  }
  const ev = state.evidence.map((k) => EVIDENCE_NAMES[k] ?? k).join(', ') || '없음';
  $('#end-stats').innerHTML =
    `자아 신뢰도 <b>${state.trust}</b> · 회사 의심도 <b>${state.suspicion}</b> · 기억 손상도 <b>${state.memory}</b><br>` +
    `확보한 증거 (${state.evidence.length}) — <b>${escapeHtml(ev)}</b><br>` +
    `발견한 엔딩 <b>${found.length} / 4</b>` +
    (chosen !== id ? '<br><span style="color:var(--danger)">기억 손상도가 너무 높아, 세 번째 자아가 선택을 가로챘다.</span>' : '');
  ui.screen('ending', true);
  playing = false;
}

// ---------- 메뉴 ----------
function refreshTitle() {
  $('#btn-continue').disabled = !Save.load();
  const f = Save.foundEndings();
  const names = { day: '낮', night: '밤', merge: '통합', third: '세 번째' };
  $('#endings-found').textContent = f.length ? `발견한 엔딩 ${f.length}/4 · ${f.map((k) => names[k]).join(' · ')}` : '';
}

async function startGame(saved) {
  sound.unlock();
  await document.fonts?.ready;
  ui.screen('title', false);
  ui.screen('ending', false);
  if (saved) {
    state = saved;
    await loadLevel(state.level, { fromSave: true });
  } else {
    Save.clear();
    state = createState();
    await loadLevel('apartment_day');
  }
}

function pause(on) {
  if (on && (!playing || busy)) return;
  ui.screen('pause', on);
  world.setEnabled(!on);
  if (on) world.releasePointer();
  updateLookHint(world.locked);
}

$('#btn-new').addEventListener('click', () => startGame(null));
$('#btn-continue').addEventListener('click', () => startGame(Save.load()));
$('#btn-help').addEventListener('click', () => ui.screen('help', true));
$('#help .close').addEventListener('click', () => ui.screen('help', false));
$('#btn-resume').addEventListener('click', () => pause(false));
$('#btn-restart-level').addEventListener('click', async () => {
  ui.screen('pause', false);
  state = JSON.parse(JSON.stringify(checkpoint));
  await loadLevel(state.level);
});
$('#btn-title').addEventListener('click', () => {
  ui.screen('pause', false);
  playing = false;
  world.setEnabled(false);
  ui.showHUD(false);
  ui.lookHint(false);
  sound.alarm(false);
  refreshTitle();
  ui.screen('title', true);
});
$('#btn-again').addEventListener('click', () => startGame(null));
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  if (!$('#pause').classList.contains('hidden')) pause(false);
  else if (!$('#help').classList.contains('hidden')) ui.screen('help', false);
  else pause(true);
});

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// 타이틀 배경: 낮의 아파트를 천천히 둘러보는 카메라
(async () => {
  await document.fonts?.ready;
  const ctx = world.makeContext({ state, sound, on: () => {} });
  LEVELS.apartment_day.build(ctx);
  world.cinematic = (t, dt, cam) => {
    cam.position.set(Math.sin(t * 0.15) * 1.2, 1.5, 1.8);
    cam.lookAt(-0.6 + Math.sin(t * 0.1), 1.3, -2.5);
  };
  refreshTitle();
})();

// 디버그/테스트용 접근
window.__game = { get state() { return state; }, world, loadLevel, runNode };
