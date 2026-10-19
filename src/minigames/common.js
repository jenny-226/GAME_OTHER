// 미니게임 공통: 난이도, 시드 난수, 결과 판정 도우미
export function difficultyOf(suspicion) {
  if (suspicion >= 70) return 2;
  if (suspicion >= 40) return 1;
  return 0;
}

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const key = (x, y) => `${x},${y}`;
export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// 방향키/WASD → 이동 벡터
export function dirOf(code) {
  switch (code) {
    case 'ArrowUp': case 'KeyW': return { dx: 0, dy: -1 };
    case 'ArrowDown': case 'KeyS': return { dx: 0, dy: 1 };
    case 'ArrowLeft': case 'KeyA': return { dx: -1, dy: 0 };
    case 'ArrowRight': case 'KeyD': return { dx: 1, dy: 0 };
    default: return null;
  }
}
