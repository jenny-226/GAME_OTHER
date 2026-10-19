const KEY = 'the-other-me-3d/save';
const ENDINGS_KEY = 'the-other-me-3d/endings';

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function save(state) {
  try {
    storage()?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 저장 실패는 게임 진행을 막지 않는다 */
  }
}

export function load() {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clear() {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* noop */
  }
}

export function recordEnding(id) {
  const list = foundEndings();
  if (!list.includes(id)) list.push(id);
  try {
    storage()?.setItem(ENDINGS_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
  return list;
}

export function foundEndings() {
  try {
    return JSON.parse(storage()?.getItem(ENDINGS_KEY) || '[]');
  } catch {
    return [];
  }
}
