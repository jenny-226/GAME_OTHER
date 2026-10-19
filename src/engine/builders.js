import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

// ---------- 재질 / 텍스처 ----------
export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });
}

export function glow(color, intensity = 1.5, opts = {}) {
  return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, ...opts });
}

export function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  t.userData.canvas = c;
  t.userData.ctx = g;
  return t;
}

function noise(g, w, h, amount = 18, alpha = 0.08) {
  for (let i = 0; i < (w * h) / 6; i++) {
    const v = Math.random() * 255;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * Math.random()})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * amount * 0.05, 1);
  }
}

export const tex = {
  wood: (rep = [3, 3]) =>
    canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#6b4a33';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#5d3f2a' : '#73503a';
        g.fillRect(0, (i * h) / 8, w, h / 8 - 2);
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.fillRect(0, ((i + 1) * h) / 8 - 2, w, 2);
        g.fillRect(((i * 97) % w), (i * h) / 8, 2, h / 8);
      }
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = 'rgba(40,25,15,.25)';
        g.beginPath();
        const y = Math.random() * h;
        g.moveTo(0, y);
        g.bezierCurveTo(w / 3, y + 4, (2 * w) / 3, y - 4, w, y + 2);
        g.stroke();
      }
    }, { repeat: rep }),
  tiles: (base = '#d9dde3', line = '#aab2bd', rep = [8, 8]) =>
    canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      noise(g, w, h, 20, 0.06);
      g.strokeStyle = line;
      g.lineWidth = 3;
      g.strokeRect(0, 0, w, h);
    }, { repeat: rep }),
  carpet: (base = '#3a4250', rep = [6, 6]) =>
    canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      noise(g, w, h, 10, 0.2);
    }, { repeat: rep }),
  wall: (base = '#cfc8bd', rep = [2, 1]) =>
    canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      noise(g, w, h, 30, 0.05);
    }, { repeat: rep }),
  grid: (color = '#6ee7ff', rep = [10, 10]) =>
    canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#05080d';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = color;
      g.globalAlpha = 0.35;
      g.lineWidth = 2;
      g.strokeRect(0, 0, w, h);
    }, { repeat: rep }),
};

// ---------- 텍스트 ----------
export function textTexture(lines, { w = 512, h = 256, bg = 'rgba(0,0,0,0)', color = '#fff', size = 48, font = 'Noto Sans KR', weight = 700, align = 'center', lineGap = 1.3, padding = 24 } = {}) {
  const list = Array.isArray(lines) ? lines : [lines];
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    g.textBaseline = 'middle';
    g.textAlign = align;
    const total = list.length * size * lineGap;
    list.forEach((line, i) => {
      const item = typeof line === 'string' ? { t: line } : line;
      g.font = `${item.weight ?? weight} ${item.size ?? size}px "${font}", sans-serif`;
      g.fillStyle = item.color ?? color;
      const x = align === 'left' ? padding : align === 'right' ? w - padding : w / 2;
      g.fillText(item.t, x, h / 2 - total / 2 + size * lineGap * (i + 0.5));
    });
  });
}

export function textPlane(lines, width, height, opts = {}) {
  const t = textTexture(lines, opts);
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), m);
  return mesh;
}

// 화면(모니터) — 빛나는 텍스트 패널
export function screen(lines, width, height, { color = '#6ee7ff', bg = '#03121a', size = 34, align = 'left', w = 512, h = 320, intensity = 1 } = {}) {
  const t = textTexture(lines, { w, h, bg, color, size, align, font: 'Share Tech Mono', weight: 400, lineGap: 1.35 });
  const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(intensity, intensity, intensity) });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), m);
}

// ---------- 기본 도형 ----------
// y = 바닥 높이, 박스는 바닥에서 위로 쌓인다
export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function cyl(rt, rb, h, material, x = 0, y = 0, z = 0, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// 바닥, 천장, 네 벽을 만들고 벽 충돌을 등록한다
export function room(ctx, { x1, z1, x2, z2, h = 2.8, floor, wall, ceil, walls = 'nsew' }) {
  const w = x2 - x1;
  const d = z2 - z1;
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floor);
  f.rotation.x = -Math.PI / 2;
  f.position.set(cx, 0, cz);
  f.receiveShadow = true;
  ctx.add(f);
  if (ceil) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceil);
    c.rotation.x = Math.PI / 2;
    c.position.set(cx, h, cz);
    ctx.add(c);
  }
  const t = 0.12;
  if (walls.includes('n')) ctx.add(wallSeg(ctx, x1, z1 - t / 2, x2, z1 - t / 2, h, wall));
  if (walls.includes('s')) ctx.add(wallSeg(ctx, x1, z2 + t / 2, x2, z2 + t / 2, h, wall));
  if (walls.includes('w')) ctx.add(wallSeg(ctx, x1 - t / 2, z1, x1 - t / 2, z2, h, wall));
  if (walls.includes('e')) ctx.add(wallSeg(ctx, x2 + t / 2, z1, x2 + t / 2, z2, h, wall));
}

// 축에 평행한 벽 조각
export function wallSeg(ctx, x1, z1, x2, z2, h, material, { collide = true, y = 0, thick = 0.12 } = {}) {
  const horizontal = Math.abs(z2 - z1) < Math.abs(x2 - x1);
  const len = horizontal ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const geo = horizontal ? new THREE.BoxGeometry(len, h, thick) : new THREE.BoxGeometry(thick, h, len);
  const m = new THREE.Mesh(geo, material);
  m.position.set((x1 + x2) / 2, y + h / 2, (z1 + z2) / 2);
  m.receiveShadow = true;
  if (collide) ctx.collideMesh(m);
  return m;
}

// ---------- 인물 ----------
export function humanoid({ shirt = 0x2f3a4a, pants = 0x1d2129, skin = 0xe0b896, hair = 0x1b1410, eyes = 0x111111, height = 1.0, coat = null } = {}) {
  const g = new THREE.Group();
  const skinM = mat(skin, { roughness: 0.6 });
  const shirtM = mat(shirt);
  const pantsM = mat(pants);
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.7, 4, 8);
  const legL = new THREE.Mesh(legGeo, pantsM);
  legL.position.set(-0.1, 0.45, 0);
  const legR = legL.clone();
  legR.position.x = 0.1;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 12), shirtM);
  torso.position.y = 1.12;
  torso.scale.set(1, 1, 0.65);
  const armGeo = new THREE.CapsuleGeometry(0.058, 0.5, 4, 8);
  const armL = new THREE.Mesh(armGeo, coat ? mat(coat) : shirtM);
  armL.position.set(-0.27, 1.07, 0);
  armL.rotation.z = 0.08;
  const armR = armL.clone();
  armR.position.x = 0.27;
  armR.rotation.z = -0.08;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), skinM);
  neck.position.y = 1.47;
  const head = new THREE.Group();
  head.position.y = 1.62;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), skinM);
  skull.scale.set(0.9, 1.08, 0.95);
  const hairM = mat(hair, { roughness: 0.9 });
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
  hairMesh.position.y = 0.02;
  hairMesh.scale.set(0.95, 1.05, 1.02);
  const eyeM = new THREE.MeshStandardMaterial({ color: eyes, emissive: eyes, emissiveIntensity: eyes === 0x111111 ? 0 : 2.5 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), eyeM);
  eyeL.position.set(-0.045, 0.01, -0.118);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.045;
  head.add(skull, hairMesh, eyeL, eyeR);
  g.add(legL, legR, torso, armL, armR, neck, head);
  if (coat) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.27, 0.75, 14, 1, true), mat(coat, { side: THREE.DoubleSide }));
    c.position.y = 0.95;
    c.scale.z = 0.7;
    g.add(c);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  g.scale.setScalar(height);
  g.userData = { head, torso, armL, armR, eyeMat: eyeM, phase: Math.random() * 10 };
  // 캐릭터는 기본적으로 -z 방향(정면)을 본다. 플레이어를 바라보게 하는 업데이트 함수
  g.userData.update = (t, playerPos) => {
    const u = g.userData;
    u.torso.scale.y = 1 + Math.sin(t * 1.6 + u.phase) * 0.012;
    if (playerPos) {
      const dx = playerPos.x - g.position.x;
      const dz = playerPos.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      const target = Math.atan2(-dx, -dz) - g.rotation.y;
      const wrapped = Math.atan2(Math.sin(target), Math.cos(target));
      const want = dist < 4 ? Math.max(-1, Math.min(1, wrapped)) : 0;
      u.head.rotation.y += (want - u.head.rotation.y) * 0.06;
    }
  };
  return g;
}

// ---------- 거울 ----------
// 거울에만 보이는 플레이어 몸(reflectBody)을 함께 렌더링한다
export function mirror(width, height, reflectBody, { tint = 0xb8c4d0, res = 512 } = {}) {
  const geo = new THREE.PlaneGeometry(width, height);
  const m = new Reflector(geo, {
    clipBias: 0.003,
    textureWidth: res,
    textureHeight: Math.round((res * height) / width),
    color: tint,
  });
  if (reflectBody) {
    const orig = m.onBeforeRender;
    m.onBeforeRender = function (...args) {
      reflectBody.visible = true;
      orig.apply(this, args);
      reflectBody.visible = false;
    };
  }
  return m;
}

// ---------- 소품 ----------
export function plant(x, z, s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.22 * s, 0.17 * s, 0.45 * s, mat(0x2b2f36), 0, 0, 0));
  const leafM = mat(0x2f6b3e, { roughness: 0.9 });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 8, 6), leafM);
    leaf.position.set(Math.cos(i) * 0.15 * s, (0.6 + (i % 3) * 0.22) * s, Math.sin(i * 1.7) * 0.15 * s);
    leaf.scale.set(1, 1.4, 1);
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  return g;
}

export function deskWithMonitor(ctx, x, z, rot = 0, lines = ['> LUMEN OS', '> 사용자: ---'], color = '#6ee7ff') {
  const g = new THREE.Group();
  const top = mat(0xe8e8ea, { roughness: 0.4 });
  const leg = mat(0x50555e, { metalness: 0.6, roughness: 0.4 });
  g.add(box(1.6, 0.04, 0.8, top, 0, 0.72, 0));
  for (const [lx, lz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) g.add(box(0.04, 0.72, 0.04, leg, lx, 0, lz));
  g.add(box(0.5, 0.32, 0.03, mat(0x15181d), 0, 0.82, -0.25));
  const s = screen(lines, 0.46, 0.28, { color, size: 30, w: 384, h: 230 });
  s.position.set(0, 0.98, -0.232);
  g.add(s);
  g.add(box(0.05, 0.1, 0.05, leg, 0, 0.76, -0.27));
  g.add(box(0.42, 0.015, 0.14, mat(0x22252b), 0, 0.76, 0.05));
  // 의자
  const chairM = mat(0x23262c);
  g.add(box(0.5, 0.06, 0.5, chairM, 0, 0.45, 0.65));
  g.add(box(0.5, 0.55, 0.06, chairM, 0, 0.5, 0.9));
  g.add(cyl(0.03, 0.03, 0.45, leg, 0, 0, 0.65, 8));
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  ctx.add(g);
  ctx.collideBox(g, 0.05);
  return { group: g, screen: s };
}

let dot = null;
function dotTexture() {
  if (dot) return dot;
  dot = canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.4, 'rgba(255,255,255,.6)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  });
  dot.wrapS = dot.wrapT = THREE.ClampToEdgeWrapping;
  dot.userData.shared = true;
  return dot;
}

// 빗줄기 등 반복 애니메이션용 파티클
export function particles(count, area, { color = 0xa8c8ff, size = 0.03, opacity = 0.6 } = {}) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = area.x1 + Math.random() * (area.x2 - area.x1);
    pos[i * 3 + 1] = area.y1 + Math.random() * (area.y2 - area.y1);
    pos[i * 3 + 2] = area.z1 + Math.random() * (area.z2 - area.z1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: dotTexture(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  p.userData.area = area;
  return p;
}
