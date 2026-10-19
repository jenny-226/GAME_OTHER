// 게임 전체가 함께 읽고 쓰는 상태 (신뢰도, 의심도, 기억 손상도, 증거, 플래그)
export const STAT_KEYS = ['trust', 'suspicion', 'memory'];

export const EVIDENCE_NAMES = {
  note_night: '밤의 나의 메모',
  access_log: '서버실 출입 기록',
  cctv: 'CCTV 사본 (사라진 17분)',
  log_03: 'JULIAN-03 접속 로그',
  missing_list: '실종자 펌웨어 기록',
  pod_photo: '캡슐 속 다니엘 사진',
  daniel: '생존자 다니엘의 증언',
  triad_file: 'PROJECT TRIAD 문서',
};

export function createState() {
  return {
    trust: 50,
    suspicion: 10,
    memory: 0,
    evidence: [],
    flags: {},
    level: 'apartment_day',
    objective: '',
    time: '07:30',
    ending: null,
  };
}

const clamp = (v) => Math.max(0, Math.min(100, v));

// fx 객체를 상태에 적용하고, UI 알림용 변화 목록을 돌려준다
export function applyEffects(state, fx = {}) {
  const changes = [];
  for (const k of STAT_KEYS) {
    if (typeof fx[k] === 'number' && fx[k] !== 0) {
      const before = state[k];
      state[k] = clamp(state[k] + fx[k]);
      if (state[k] !== before) changes.push({ type: 'stat', key: k, delta: state[k] - before });
    }
  }
  for (const id of toList(fx.evidence)) {
    if (!state.evidence.includes(id)) {
      state.evidence.push(id);
      changes.push({ type: 'evidence', id });
    }
  }
  for (const f of toList(fx.flag)) state.flags[f] = true;
  for (const f of toList(fx.unflag)) delete state.flags[f];
  if (typeof fx.objective === 'string') state.objective = fx.objective;
  if (typeof fx.time === 'string') state.time = fx.time;
  return changes;
}

export function toList(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// 조건 판정: 모든 항목을 만족해야 true
export function checkCond(state, cond) {
  if (!cond) return true;
  for (const f of toList(cond.flag)) if (!state.flags[f]) return false;
  for (const f of toList(cond.notFlag)) if (state.flags[f]) return false;
  if (cond.anyFlag && !toList(cond.anyFlag).some((f) => state.flags[f])) return false;
  for (const e of toList(cond.evidence)) if (!state.evidence.includes(e)) return false;
  if (cond.notEvidence && toList(cond.notEvidence).some((e) => state.evidence.includes(e))) return false;
  if (cond.minTrust != null && state.trust < cond.minTrust) return false;
  if (cond.maxTrust != null && state.trust > cond.maxTrust) return false;
  if (cond.minSuspicion != null && state.suspicion < cond.minSuspicion) return false;
  if (cond.maxSuspicion != null && state.suspicion > cond.maxSuspicion) return false;
  if (cond.minMemory != null && state.memory < cond.minMemory) return false;
  if (cond.maxMemory != null && state.memory > cond.maxMemory) return false;
  if (cond.minEvidence != null && state.evidence.length < cond.minEvidence) return false;
  if (cond.maxEvidence != null && state.evidence.length > cond.maxEvidence) return false;
  return true;
}

// 최종 선택 → 실제 엔딩 (기억 손상이 크면 세 번째 자아가 몸을 빼앗는다)
export function resolveEnding(state, chosen) {
  if ((chosen === 'day' || chosen === 'night') && state.memory >= 70 && !state.flags.resist_03) {
    return 'third';
  }
  return chosen;
}
