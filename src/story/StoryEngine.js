import { applyEffects, checkCond } from '../state/GameState.js';

// 노드에서 지금 보여 줄 선택지 목록 (cond 불충족 = 숨김, require 불충족 = 잠김)
export function visibleChoices(state, node) {
  return (node.choices || [])
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => checkCond(state, choice.cond))
    .map((c) => ({ ...c, disabled: !checkCond(state, c.choice.require) }));
}

export function visibleLines(state, lines = []) {
  return lines.filter((l) => checkCond(state, l.cond));
}

// 시간 초과 시 고를 선택지 (원래 인덱스 기준, 없으면 첫 번째 가능한 것)
export function timeoutPick(visible, node) {
  const want = visible.findIndex((v) => v.index === node.timeout && !v.disabled);
  if (want >= 0) return want;
  return Math.max(0, visible.findIndex((v) => !v.disabled));
}

// 스토리 노드를 순서대로 재생한다.
// io: { say(line) → Promise, choose(options, opts) → Promise<index>, notify(changes), event(name) }
export class StoryEngine {
  constructor(story, state, io) {
    this.story = story;
    this.state = state;
    this.io = io;
  }

  async run(startId) {
    const result = { goto: null, ending: null, minigame: null };
    let id = startId;
    let guard = 0;
    while (id) {
      if (guard++ > 50) throw new Error(`story loop: ${startId}`);
      const node = this.story[id];
      if (!node) throw new Error(`missing story node: ${id}`);
      await this.#lines(node.lines);
      let next = node.then ?? null;
      const visible = visibleChoices(this.state, node);
      if (visible.length) {
        const pick = await this.io.choose(
          visible.map((v) => ({ text: v.choice.t, disabled: v.disabled, note: v.choice.requireText || '조건 미충족' })),
          { timer: node.timer || 0, timeoutIndex: timeoutPick(visible, node) },
        );
        const choice = visible[pick].choice;
        this.#apply(choice.fx, result);
        await this.#lines(choice.reply);
        if (choice.then) next = choice.then;
      }
      this.#apply(node.fx, result);
      id = next;
    }
    return result;
  }

  async #lines(lines) {
    for (const line of visibleLines(this.state, lines)) {
      if (line.event) this.io.event?.(line.event);
      await this.io.say(line);
    }
  }

  #apply(fx, result) {
    if (!fx) return;
    const changes = applyEffects(this.state, fx);
    if (changes.length) this.io.notify?.(changes);
    if (fx.event) this.io.event?.(fx.event);
    if (fx.goto) result.goto = fx.goto;
    if (fx.ending) result.ending = fx.ending;
    if (fx.minigame) result.minigame = fx.minigame;
    this.io.changed?.();
  }
}
