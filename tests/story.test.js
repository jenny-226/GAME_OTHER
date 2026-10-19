import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import story from '../data/story.json';
import endings from '../data/endings.json';
import { StoryEngine, visibleChoices, timeoutPick } from '../src/story/StoryEngine.js';
import { createState } from '../src/state/GameState.js';

const LEVEL_IDS = ['apartment_day', 'lobby', 'office17', 'apartment_night', 'floor_zero', 'core'];

describe('story data', () => {
  it('every then/goto/ending points to something real', () => {
    for (const [id, node] of Object.entries(story)) {
      const fxs = [node.fx, ...(node.choices || []).map((c) => c.fx), ...Object.values(node.outcomes || {}).map((o) => o.fx)].filter(Boolean);
      if (node.then) expect(story[node.then], `${id}.then`).toBeTruthy();
      for (const c of node.choices || []) if (c.then) expect(story[c.then], `${id} choice then`).toBeTruthy();
      for (const fx of fxs) {
        if (fx.goto) expect(LEVEL_IDS, `${id} goto`).toContain(fx.goto);
        if (fx.ending) expect(endings[fx.ending], `${id} ending`).toBeTruthy();
      }
      if (node.timeout != null) expect(node.choices[node.timeout], `${id} timeout`).toBeTruthy();
    }
  });

  it('every node referenced from level code exists', () => {
    const dir = join(__dirname, '../src/levels');
    const refs = new Set();
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/['"]((?:intro|apt|lobby|off|night|zero|core)_[a-z0-9_]+|intro)['"]/g)) refs.add(m[1]);
    }
    expect(refs.size).toBeGreaterThan(20);
    for (const r of refs) expect(story[r], r).toBeTruthy();
  });

  it('every node has at least one visible choice in a fresh state or none at all', () => {
    for (const [id, node] of Object.entries(story)) {
      if (!node.choices) continue;
      const anyUnconditional = node.choices.some((c) => !c.cond);
      expect(anyUnconditional, `${id} may show zero choices`).toBe(true);
    }
  });

  it('timeout picks the original index when visible', () => {
    const s = createState();
    const node = story.off_1500;
    const vis = visibleChoices(s, node);
    expect(vis[timeoutPick(vis, node)].index).toBe(1);
  });

  it('merge ending choice is locked until trust and evidence are high enough', () => {
    const s = createState();
    const lock = () => visibleChoices(s, story.core_final).find((v) => v.choice.fx.ending === 'merge').disabled;
    expect(lock()).toBe(true);
    s.trust = 60;
    s.evidence = ['a', 'b', 'c'];
    expect(lock()).toBe(false);
  });
});

// 선택 순서를 정해 두고 스토리를 끝까지 자동 진행한다
async function play(picks) {
  const state = createState();
  const order = [...picks];
  const route = [];
  const io = {
    say: async () => {},
    choose: async (opts) => {
      const want = order.length ? order.shift() : 0;
      let i = typeof want === 'function' ? want(opts) : want;
      if (i >= opts.length || opts[i].disabled) i = opts.findIndex((o) => !o.disabled);
      return i;
    },
  };
  const engine = new StoryEngine(story, state, io);
  const run = async (id) => {
    route.push(id);
    const r = await engine.run(id);
    return r;
  };
  return { state, run, route };
}

describe('playthroughs', () => {
  it('reaches the merge ending with a trusting, evidence-heavy route', async () => {
    const g = await play([]);
    const pick = (p) => (opts) => opts.findIndex((o) => o.text.includes(p));
    const seq = async (id, ...ps) => {
      const e = new StoryEngine(story, g.state, {
        say: async () => {},
        choose: async (opts) => {
          const f = ps.shift();
          const i = f ? f(opts) : 0;
          return i < 0 ? 0 : i;
        },
      });
      return e.run(id);
    };
    await seq('intro', pick('소매'));
    await seq('apt_mirror', pick('칩 자국'));
    await seq('apt_desk', pick('지갑'));
    await seq('apt_phone', pick('누구야'));
    expect((await seq('apt_door', pick('출근한다'))).goto).toBe('lobby');
    await seq('lobby_gate', pick('권한'));
    expect((await seq('lobby_elevator', pick('17층'))).goto).toBe('office17');
    await seq('off_mira', pick('손목'));
    await seq('off_cctv', pick('USB'));
    await seq('off_log', pick('사진'));
    expect((await seq('off_1500', pick('미라'))).goto).toBe('apartment_night');
    await seq('night_laptop', pick('공통점'));
    await seq('night_desk', pick('전부'));
    expect((await seq('night_bed')).goto).toBe('floor_zero');
    await seq('zero_pod', pick('레버'));
    await seq('zero_terminal', pick('다운로드'));
    await seq('zero_mirror', pick('메모'));
    expect((await seq('zero_alarm', pick('미라'))).goto).toBe('core');
    const end = await seq('core_final', pick('합친다'));
    expect(end.ending).toBe('merge');
    expect(g.state.trust).toBeGreaterThanOrEqual(60);
    expect(g.state.evidence.length).toBeGreaterThanOrEqual(3);
  });

  it('can reach day, night and third endings from core_final', async () => {
    for (const [idx, want] of [[0, 'day'], [1, 'night'], [3, 'third']]) {
      const g = await play([idx]);
      const r = await g.run('core_final');
      expect(r.ending).toBe(want);
    }
  });
});
