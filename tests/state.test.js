import { describe, it, expect } from 'vitest';
import { createState, applyEffects, checkCond, resolveEnding } from '../src/state/GameState.js';

describe('GameState', () => {
  it('clamps stats to 0..100', () => {
    const s = createState();
    applyEffects(s, { trust: 500, suspicion: -50 });
    expect(s.trust).toBe(100);
    expect(s.suspicion).toBe(0);
  });

  it('adds evidence once and reports changes', () => {
    const s = createState();
    const c1 = applyEffects(s, { evidence: 'cctv', trust: 5 });
    const c2 = applyEffects(s, { evidence: 'cctv' });
    expect(s.evidence).toEqual(['cctv']);
    expect(c1).toHaveLength(2);
    expect(c2).toHaveLength(0);
  });

  it('sets and clears flags, objective and time', () => {
    const s = createState();
    applyEffects(s, { flag: ['a', 'b'], objective: 'x', time: '15:00' });
    applyEffects(s, { unflag: 'a' });
    expect(s.flags).toEqual({ b: true });
    expect(s.objective).toBe('x');
    expect(s.time).toBe('15:00');
  });

  it('checks conditions', () => {
    const s = createState();
    s.flags.x = true;
    s.evidence = ['a', 'b', 'c'];
    expect(checkCond(s, { flag: 'x', minEvidence: 3, minTrust: 50 })).toBe(true);
    expect(checkCond(s, { notFlag: 'x' })).toBe(false);
    expect(checkCond(s, { anyFlag: ['y', 'x'] })).toBe(true);
    expect(checkCond(s, { anyFlag: ['y'] })).toBe(false);
    expect(checkCond(s, { maxEvidence: 2 })).toBe(false);
    expect(checkCond(s, { notEvidence: 'a' })).toBe(false);
  });

  it('lets the third self hijack day/night endings at high memory damage', () => {
    const s = createState();
    s.memory = 70;
    expect(resolveEnding(s, 'day')).toBe('third');
    expect(resolveEnding(s, 'merge')).toBe('merge');
    s.flags.resist_03 = true;
    expect(resolveEnding(s, 'night')).toBe('night');
  });
});
