import * as THREE from 'three';

const EYE = 1.62;
const RADIUS = 0.28;
const REACH = 2.8;

// 3D 세계: 렌더러, 1인칭 조작, 충돌, 상호작용, 트리거를 담당
export class World {
  constructor(container, { onInteract, onTrigger, onPause }) {
    this.container = container;
    this.onInteract = onInteract;
    this.onTrigger = onTrigger;
    this.onPause = onPause;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.05, 200);
    this.camera.rotation.order = 'YXZ';
    this.scene = new THREE.Scene();

    this.yaw = 0;
    this.pitch = 0;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector2();
    this.bob = 0;
    this.keys = new Set();
    this.enabled = false; // 이동/시점 가능 여부 (대화 중엔 false)
    this.locked = false;
    this.lockFailed = false;
    this.touchMove = new THREE.Vector2();
    this.cinematic = null; // 엔딩 등에서 카메라 자동 회전

    this.colliders = [];
    this.interactables = [];
    this.triggers = [];
    this.updaters = [];
    this.focus = null;
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.time = 0;

    this.#bindInput();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.#frame());
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- 레벨 관리 ----------
  clear() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of [].concat(o.material)) {
          if (m.map && !m.map.userData.shared) m.map.dispose();
          m.dispose();
        }
      }
      if (o.isReflector || o.getRenderTarget) o.getRenderTarget?.().dispose();
    });
    this.scene = new THREE.Scene();
    this.colliders = [];
    this.interactables = [];
    this.triggers = [];
    this.updaters = [];
    this.focus = null;
    this.cinematic = null;
  }

  // 레벨 빌드 함수에 넘겨줄 도구 모음
  makeContext(extra) {
    const world = this;
    return {
      THREE,
      world,
      scene: this.scene,
      add: (...objs) => objs.forEach((o) => world.scene.add(o)),
      // 축 정렬 사각형 충돌 영역 (x1,z1)-(x2,z2)
      collide: (x1, z1, x2, z2) => {
        const c = { x1: Math.min(x1, x2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), z2: Math.max(z1, z2), on: true };
        world.colliders.push(c);
        return c;
      },
      collideMesh: (mesh, pad = 0) => world.#colliderFromObject(mesh, pad),
      collideBox: (obj, pad = 0) => world.#colliderFromObject(obj, pad),
      interact: (object, def) => {
        object.traverse((o) => (o.userData.interactRoot = object));
        const entry = { object, ...def };
        world.interactables.push(entry);
        return entry;
      },
      trigger: (def) => {
        const t = { fired: false, ...def };
        world.triggers.push(t);
        return t;
      },
      tick: (fn) => world.updaters.push(fn),
      ...extra,
    };
  }

  #colliderFromObject(obj, pad) {
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj);
    const c = { x1: b.min.x - pad, z1: b.min.z - pad, x2: b.max.x + pad, z2: b.max.z + pad, on: true };
    this.colliders.push(c);
    return c;
  }

  setPlayer(x, z, yaw = 0) {
    this.pos.set(x, 0, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.vel.set(0, 0);
    this.#applyCamera(0);
  }

  // ---------- 입력 ----------
  #bindInput() {
    const el = this.renderer.domElement;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') return;
      this.keys.add(e.code);
      if (e.code === 'KeyE' && this.enabled && this.focus) this.#interact(this.focus);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      this.lockFailed = true;
      this.onLockChange?.(false);
    });

    let down = null;
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, moved: 0 };
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked) {
        this.yaw -= e.movementX * 0.0022;
        this.pitch -= e.movementY * 0.0022;
      } else if (down) {
        const dx = e.movementX;
        const dy = e.movementY;
        down.moved += Math.abs(dx) + Math.abs(dy);
        this.yaw -= dx * 0.005;
        this.pitch -= dy * 0.005;
      }
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    });
    window.addEventListener('mouseup', (e) => {
      if (!down) return;
      const click = down.moved < 6;
      down = null;
      if (!click || !this.enabled) return;
      if (this.locked) {
        if (this.focus) this.#interact(this.focus);
        return;
      }
      // 잠기지 않은 상태: 클릭 지점의 물체를 조사하거나, 시점 잠금 시도
      const hit = this.#pick(e.clientX, e.clientY);
      if (hit) this.#interact(hit);
      else if (!this.lockFailed && !this.isTouch) {
        try {
          const p = el.requestPointerLock?.();
          if (p && p.catch) p.catch(() => (this.lockFailed = true));
        } catch {
          this.lockFailed = true;
        }
      }
    });

    // 터치: 왼쪽 스틱 이동, 나머지 드래그 시점, 탭 조사
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    const touches = new Map();
    el.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) touches.set(t.identifier, { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY });
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        const p = touches.get(t.identifier);
        if (!p || !this.enabled) continue;
        this.yaw -= (t.clientX - p.x) * 0.006;
        this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - (t.clientY - p.y) * 0.006));
        p.x = t.clientX;
        p.y = t.clientY;
      }
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        const p = touches.get(t.identifier);
        touches.delete(t.identifier);
        if (p && this.enabled && Math.hypot(t.clientX - p.sx, t.clientY - p.sy) < 10) {
          const hit = this.#pick(t.clientX, t.clientY);
          if (hit) this.#interact(hit);
        }
      }
    });
  }

  bindStick(stickEl, actEl) {
    const knob = stickEl.querySelector('i');
    let id = null;
    let cx = 0;
    let cy = 0;
    const move = (t) => {
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const len = Math.hypot(dx, dy);
      const max = 45;
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touchMove.set(dx / max, dy / max);
    };
    stickEl.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      id = t.identifier;
      const r = stickEl.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      move(t);
      e.preventDefault();
    }, { passive: false });
    stickEl.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) move(t);
      e.preventDefault();
    }, { passive: false });
    const end = () => {
      id = null;
      knob.style.transform = '';
      this.touchMove.set(0, 0);
    };
    stickEl.addEventListener('touchend', end);
    stickEl.addEventListener('touchcancel', end);
    actEl.addEventListener('click', () => {
      if (this.enabled && this.focus) this.#interact(this.focus);
    });
  }

  releasePointer() {
    if (document.pointerLockElement) {
      this.selfRelease = true;
      document.exitPointerLock();
    }
  }

  // ---------- 상호작용 ----------
  #active(entry) {
    return entry.enabled ? entry.enabled() !== false : true;
  }

  #pick(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    return this.#rayHit(ndc);
  }

  #rayHit(ndc) {
    const active = this.interactables.filter((e) => this.#active(e));
    if (!active.length) return null;
    this.raycaster.setFromCamera(ndc, this.camera);
    this.raycaster.far = REACH;
    const hits = this.raycaster.intersectObjects(active.map((e) => e.object), true);
    // 첫 번째로 맞은 것이 벽 등에 가려졌는지 확인
    if (!hits.length) return null;
    const blockers = this.raycaster.intersectObjects(this.scene.children, true).filter((h) => !h.object.userData.interactRoot && h.object.type === 'Mesh' && !h.object.userData.noBlock);
    const first = hits[0];
    if (blockers.length && blockers[0].distance < first.distance - 0.05) return null;
    const root = first.object.userData.interactRoot;
    return active.find((e) => e.object === root) || null;
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.enabledAt = performance.now();
    else this.keys.clear();
  }

  #interact(entry) {
    if (!this.enabled) return;
    // 대화를 닫은 키 입력이 곧바로 다시 조사로 이어지지 않도록
    if (performance.now() - (this.enabledAt || 0) < 350) return;
    this.onInteract?.(entry);
  }

  // ---------- 매 프레임 ----------
  #frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    if (this.enabled) this.#move(dt);
    this.#applyCamera(dt);

    if (this.cinematic) this.cinematic(this.time, dt, this.camera);

    for (const fn of this.updaters) fn(dt, this.time, this.pos);

    if (this.enabled) {
      const f = this.#rayHit(new THREE.Vector2(0, 0));
      if (f !== this.focus) {
        this.focus = f;
        this.onFocus?.(f);
      }
      for (const t of this.triggers) {
        if (t.fired && t.once !== false) continue;
        if (t.cond && !t.cond()) continue;
        const inside = this.pos.x >= t.x1 && this.pos.x <= t.x2 && this.pos.z >= t.z1 && this.pos.z <= t.z2;
        if (!inside) {
          t.wait = 0;
          continue;
        }
        t.wait = (t.wait || 0) + dt;
        if (t.wait < (t.delay || 0)) continue;
        t.fired = true;
        this.onTrigger?.(t);
        break;
      }
    } else if (this.focus) {
      this.focus = null;
      this.onFocus?.(null);
    }

    this.renderer.render(this.scene, this.camera);
  }

  #move(dt) {
    const k = this.keys;
    let fx = 0;
    let fz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fz -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fz += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) fx += 1;
    fx += this.touchMove.x;
    fz += this.touchMove.y;
    const len = Math.hypot(fx, fz);
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = run ? 4.3 : 2.5;
    let tx = 0;
    let tz = 0;
    if (len > 0.05) {
      const nx = fx / Math.max(1, len);
      const nz = fz / Math.max(1, len);
      const s = Math.sin(this.yaw);
      const c = Math.cos(this.yaw);
      tx = (nx * c + nz * s) * speed;
      tz = (-nx * s + nz * c) * speed;
    }
    const a = 1 - Math.exp(-dt * 12);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.y += (tz - this.vel.y) * a;
    this.#slide(this.vel.x * dt, 0);
    this.#slide(0, this.vel.y * dt);
    const sp = this.vel.length();
    this.bob += dt * sp * 3.2;
    this.speed = sp;
  }

  #slide(dx, dz) {
    const nx = this.pos.x + dx;
    const nz = this.pos.z + dz;
    for (const c of this.colliders) {
      if (!c.on) continue;
      if (nx + RADIUS > c.x1 && nx - RADIUS < c.x2 && nz + RADIUS > c.z1 && nz - RADIUS < c.z2) return;
    }
    this.pos.x = nx;
    this.pos.z = nz;
  }

  #applyCamera() {
    if (this.cinematic) return;
    const bobY = Math.sin(this.bob * 2) * 0.035 * Math.min(1, (this.speed || 0) / 2.5);
    this.camera.position.set(this.pos.x, EYE + bobY, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  // 대화 중 카메라가 대상(인물)을 부드럽게 바라본다
  lookAt(target, duration = 0.6) {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const targetYaw = Math.atan2(-dx, -dz);
    const dist = Math.hypot(dx, dz);
    const targetPitch = Math.atan2((target.y ?? EYE) - EYE, dist);
    const sy = this.yaw;
    const sp = this.pitch;
    let dy = targetYaw - sy;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / (duration * 1000));
      const e = t * t * (3 - 2 * t);
      this.yaw = sy + dy * e;
      this.pitch = sp + (targetPitch - sp) * e;
      if (t < 1) requestAnimationFrame(step);
    };
    step();
  }
}
