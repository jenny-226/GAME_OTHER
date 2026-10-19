import { applyEffects, checkCond } from '../state/GameState.js';
import { difficultyOf } from '../minigames/common.js';

// 미니게임 노드의 난이도: 회사 의심도 기준, easierIf 조건을 만족하면 한 단계 쉬워진다
export function minigameDifficulty(state, node) {
  let d = difficultyOf(state.suspicion);
  if (node.easierIf && checkCond(state, node.easierIf)) d -= 1;
  return Math.max(0, Math.min(2, d));
}

// 결과를 상태에 반영하고 다음 스토리 노드 id를 돌려준다
export function applyMinigameResult(state, node, res) {
  const oc = node.outcomes[res.outcome] || node.outcomes.fail;
  const changes = applyEffects(state, oc.fx || {});
  state.flags[`mg_${node.game}_${res.outcome}`] = true;
  const data = res.data || {};
  for (const id of data.collected || []) state.flags[`found_${id}`] = true;
  for (const id of data.selected_evidence || []) {
    state.flags[`sel_${id}`] = true;
    changes.push(...applyEffects(state, { evidence: id }));
  }
  return { next: oc.next, changes };
}
