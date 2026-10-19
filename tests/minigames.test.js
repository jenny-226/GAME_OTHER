import { describe, it, expect } from 'vitest';
import stealthPreset from '../data/minigames/stealth_01.json';
import hackPreset from '../data/minigames/memory_hack_01.json';
import searchPreset from '../data/minigames/night_search_01.json';
import story from '../data/story.json';
import { createStealth, stealthAct } from '../src/minigames/stealth.js';
import { createHack, hackAct, hackTick } from '../src/minigames/memoryHack.js';
import { createSearch, searchAct, searchTick, walkable } from '../src/minigames/nightSearch.js';
import { difficultyOf } from '../src/minigames/common.js';
import { applyMinigameResult, minigameDifficulty } from '../src/story/minigameLink.js';
import { createState } from '../src/state/GameState.js';

const M = { R: [1, 0], L: [-1, 0], D: [0, 1], U: [0, -1] };
function playStealth(diff, seq) {
  const st = createStealth(stealthPreset, diff);
  for (const s of seq) {
    if (s === 'O') stealthAct(st, { type: 'open' });
    else if (s === 'W') stealthAct(st, { type: 'wait' });
    else {
      const crouch = s.startsWith('c');
      const [dx, dy] = M[s.slice(-1)];
      stealthAct(st, { type: 'move', dx, dy, crouch });
    }
  }
  return st;
}

describe('difficulty', () => {
  it('switches at suspicion 40 and 70', () => {
    expect([0, 39, 40, 69, 70, 100].map(difficultyOf)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe('01 stealth', () => {
  it('has a clean route on every difficulty', () => {
    expect(playStealth(0, ['R', 'R', 'R', 'R', 'R', 'R', 'D', 'D', 'cD', 'D', 'D', 'cR', 'D', 'O']).outcome).toBe('clean_success');
    expect(playStealth(1, ['R', 'R', 'R', 'D', 'D', 'cD', 'D', 'D', 'D', 'D', 'cR', 'R', 'R', 'O']).outcome).toBe('clean_success');
    expect(playStealth(2, ['R', 'R', 'R', 'D', 'D', 'cD', 'D', 'D', 'D', 'D', 'cR', 'R', 'cR', 'O']).outcome).toBe('clean_success');
  });

  it('ignores walls and E away from the door', () => {
    const st = playStealth(0, ['O']);
    expect(st.outcome).toBe(null);
    expect(st.turn).toBe(0);
  });

  it('sends the player back on first detection and fails on the second', () => {
    // 왼쪽으로 내려가 홀수 턴에 CCTV A 위에 서면 발각
    const st = playStealth(0, ['L', 'D', 'D', 'D', 'R']);
    expect(st.strikes).toBe(1);
    expect(st.player).toEqual({ x: 1, y: 1 });
    for (let i = 0; i < 6 && !st.outcome; i++) {
      for (const s of ['L', 'D', 'D', 'D', 'R']) {
        const [dx, dy] = M[s];
        stealthAct(st, { type: 'move', dx, dy });
      }
    }
    expect(st.outcome).toBe('fail');
  });
});

describe('02 memory hack', () => {
  const route = [[1, 0], [0, 1], [0, 1], [1, 0], [1, 0], [1, 0], [0, 1], [1, 0], [0, 1]];
  // (0,0)→(1,0)→(1,1)→(1,2)? (1,2)는 감시 노드라 피하는 경로를 쓴다
  const safe = [[0, 1], [1, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 0], [1, 0], [0, 1]];

  it('counts watch nodes as detections', () => {
    const st = createHack(hackPreset, 0);
    for (const [dx, dy] of route.slice(0, 3)) hackAct(st, { type: 'move', dx, dy });
    expect(st.strikes).toBe(1);
  });

  it('clean run: safe path, then three in-sync pulses', () => {
    const st = createHack(hackPreset, 0);
    for (const [dx, dy] of safe) hackAct(st, { type: 'move', dx, dy });
    expect(st.strikes).toBe(0);
    hackAct(st, { type: 'confirm' });
    expect(st.phase).toBe('sync');
    for (let i = 0; i < 3; i++) {
      hackTick(st, st.period); // 한 주기 뒤 = 위상 0
      hackAct(st, { type: 'pulse' });
    }
    expect(st.outcome).toBe('clean_success');
  });

  it('fails when time runs out', () => {
    const st = createHack(hackPreset, 0);
    hackTick(st, 91);
    expect(st.outcome).toBe('fail');
  });
});

describe('03 night search', () => {
  it('every evidence point has a walkable neighbour', () => {
    const st = createSearch(searchPreset, 0);
    for (const area of Object.values(st.areas)) {
      for (const p of area.pts) {
        const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => walkable(area, p.x + dx, p.y + dy));
        expect(ok, p.id).toBe(true);
      }
    }
  });

  it('investigating next to a point collects it after 2 seconds', () => {
    const st = createSearch(searchPreset, 0);
    st.pos = { x: 9, y: 2 }; // 재킷 옆
    searchAct(st, { type: 'investigate' });
    searchTick(st, 1);
    expect(st.collected).toEqual([]);
    searchTick(st, 1.1);
    expect(st.collected).toEqual(['ev_usb']);
  });

  it('walking onto the exit moves to the other area', () => {
    const st = createSearch(searchPreset, 0);
    st.pos = { x: 10, y: 4 };
    searchAct(st, { type: 'move', dx: 1, dy: 0 });
    expect(st.area).toBe('alley');
  });

  it('sorting keeps at most three and grades by count', () => {
    const st = createSearch(searchPreset, 0);
    st.collected = ['ev_usb', 'ev_bandage', 'ev_receipt', 'ev_badge'];
    searchAct(st, { type: 'finish' });
    for (let i = 0; i < 4; i++) {
      searchAct(st, { type: 'toggle' });
      searchAct(st, { type: 'move', dx: 0, dy: 1 });
    }
    expect(st.selected).toHaveLength(3);
    searchAct(st, { type: 'finish' });
    expect(st.outcome).toBe('detected_success');
  });
});

describe('story links', () => {
  it('every minigame trigger points to a minigame node whose outcomes exist', () => {
    for (const [id, node] of Object.entries(story)) {
      for (const c of node.choices || []) {
        if (c.fx?.minigame) expect(story[c.fx.minigame]?.type, id).toBe('minigame');
      }
      if (node.type === 'minigame') {
        for (const o of ['clean_success', 'detected_success', 'fail']) expect(story[node.outcomes[o].next], `${id}.${o}`).toBeTruthy();
      }
    }
  });

  it('applies outcome effects and selected evidence', () => {
    const s = createState();
    const r = applyMinigameResult(s, story.mg_search, { outcome: 'clean_success', data: { collected: ['ev_usb', 'ev_badge'], selected_evidence: ['ev_usb'] } });
    expect(r.next).toBe('night_search_clean');
    expect(s.flags.sel_ev_usb && s.flags.found_ev_badge && s.flags.night_searched).toBe(true);
    expect(s.evidence).toContain('ev_usb');
  });

  it('server key makes the stealth mission one level easier', () => {
    const s = createState();
    s.suspicion = 50;
    expect(minigameDifficulty(s, story.mg_stealth)).toBe(1);
    s.flags.server_key = true;
    expect(minigameDifficulty(s, story.mg_stealth)).toBe(0);
  });
});
