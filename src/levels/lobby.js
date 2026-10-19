import * as THREE from 'three';
import { mat, glow, tex, box, cyl, room, wallSeg, humanoid, plant, textPlane, canvasTex } from '../engine/builders.js';

export function buildLobby(ctx) {
  const { state } = ctx;
  const X1 = -10, X2 = 10, Z1 = -9, Z2 = 9, H = 6;
  room(ctx, {
    x1: X1, z1: Z1, x2: X2, z2: Z2, h: H,
    floor: new THREE.MeshStandardMaterial({ map: tex.tiles('#e6e8ec', '#c3c8d0', [10, 9]), roughness: 0.18, metalness: 0.15 }),
    wall: new THREE.MeshStandardMaterial({ map: tex.wall('#eef0f3', [4, 1]), roughness: 0.8 }),
    ceil: mat(0xf4f5f7),
  });

  // 천장 조명 띠
  for (let z = -7; z <= 7; z += 3.5) {
    ctx.add(box(14, 0.05, 0.25, glow(0xffffff, 2.2), 0, H - 0.06, z));
  }

  // 기둥
  for (const [x, z] of [[-6, -4.5], [6, -4.5], [-6, 4.5], [6, 4.5]]) {
    const c = cyl(0.45, 0.45, H, mat(0xdfe3e8, { roughness: 0.3 }), x, 0, z, 28);
    ctx.add(c);
    ctx.collide(x - 0.45, z - 0.45, x + 0.45, z + 0.45);
  }

  // 안내 데스크
  const recep = new THREE.Group();
  recep.add(box(3.4, 1.1, 0.8, mat(0xffffff, { roughness: 0.25 }), 0, 0, 0));
  recep.add(box(3.5, 0.05, 0.9, mat(0x1a1d22), 0, 1.1, 0));
  const logo = textPlane('LUMEN', 1.6, 0.4, { w: 512, h: 128, color: '#0aa5c4', size: 90, weight: 900 });
  logo.position.set(0, 0.6, 0.41);
  recep.add(logo);
  recep.position.set(-5.5, 0, 6.2);
  ctx.add(recep);
  ctx.collideBox(recep);

  // 출입 게이트 (z = 0)
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, side: THREE.DoubleSide });
  ctx.add(wallSeg(ctx, X1, 0, -4.2, 0, 1.3, glass, { thick: 0.04 }));
  ctx.add(wallSeg(ctx, 4.2, 0, X2, 0, 1.3, glass, { thick: 0.04 }));
  const gateLights = [];
  for (const x of [-4, -2, 0, 2, 4]) {
    const g = box(0.32, 1.05, 1.3, mat(0x2a2f37, { metalness: 0.5, roughness: 0.3 }), x, 0, 0);
    ctx.add(g);
    ctx.collideMesh(g);
    const l = box(0.34, 0.03, 1.32, glow(0x6ee7ff, 2), x, 1.05, 0);
    ctx.add(l);
    gateLights.push(l);
  }
  ctx.tick((dt, t) => {
    const passed = state.flags.done_lobby_gate;
    for (const l of gateLights) {
      l.material.emissive.setHex(passed ? 0x5cff9d : 0x6ee7ff);
      l.material.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.6;
    }
  });
  ctx.trigger({ x1: -4.5, z1: 0.4, x2: 4.5, z2: 2.4, node: 'lobby_gate', cond: () => !state.flags.done_lobby_gate, key: 'lobby_gate' });

  // 대형 스크린 (서쪽 벽)
  const scrTex = canvasTex(1024, 512, () => {});
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
  scr.position.set(X1 + 0.03, 3.4, -1.5);
  scr.rotation.y = Math.PI / 2;
  ctx.add(scr);
  const drawScreen = (t) => {
    const g = scrTex.userData.ctx;
    const grd = g.createLinearGradient(0, 0, 1024, 512);
    grd.addColorStop(0, '#031522');
    grd.addColorStop(1, '#0a3a52');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 512);
    g.strokeStyle = 'rgba(110,231,255,.25)';
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.arc(780, 250, 40 + i * 22 + ((t * 30) % 22), 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#e9fbff';
    g.font = '900 120px "Noto Sans KR"';
    g.fillText('LUMEN', 70, 220);
    g.font = '400 38px "Noto Sans KR"';
    g.fillStyle = '#9fe9ff';
    g.fillText('당신의 일은 당신을 기억하지 않습니다.', 74, 300);
    g.font = '400 24px "Share Tech Mono"';
    g.fillStyle = '#5fb7cf';
    g.fillText('MEMORY SEVERANCE PROGRAM · 시술자 4,812명 · 실종 신고 0건', 74, 420);
    scrTex.needsUpdate = true;
  };
  drawScreen(0);
  let acc = 0;
  ctx.tick((dt, t) => {
    acc += dt;
    if (acc > 0.1) {
      acc = 0;
      drawScreen(t);
    }
  });
  const scrHit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.5, 7), new THREE.MeshBasicMaterial({ visible: false }));
  scrHit.position.set(X1 + 0.3, 2.2, -1.5);
  ctx.add(scrHit);
  ctx.interact(scrHit, { label: '광고 스크린 보기', node: 'lobby_screen' });

  // 엘리베이터 (북쪽 벽)
  const steel = mat(0xb9c0c9, { metalness: 0.85, roughness: 0.25 });
  for (const x of [-3.2, 0, 3.2]) {
    ctx.add(box(1.7, 2.6, 0.08, mat(0x30343b, { metalness: 0.6 }), x, 0, Z1 + 0.05));
    ctx.add(box(0.8, 2.4, 0.05, steel, x - 0.42, 0, Z1 + 0.11), box(0.8, 2.4, 0.05, steel, x + 0.42, 0, Z1 + 0.11));
    const ind = textPlane(x === 0 ? '▲ 1' : '▼ 12', 0.6, 0.18, { w: 256, h: 80, color: '#ff9b5c', size: 52, font: 'Share Tech Mono', weight: 400, bg: '#0b0b0b' });
    ind.position.set(x, 2.85, Z1 + 0.1);
    ctx.add(ind);
  }
  const panel = new THREE.Group();
  panel.add(box(0.28, 0.5, 0.05, mat(0x22262c, { metalness: 0.6 }), 0, 0, 0));
  for (let i = 0; i < 4; i++) panel.add(new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), glow(i === 3 && state.flags.saw_zero ? 0xff3355 : 0xffffff, 0.8)).translateY(0.1 + i * 0.1).translateZ(0.03));
  panel.position.set(1.1, 1.0, Z1 + 0.1);
  ctx.add(panel);
  const panelHit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
  panelHit.position.set(0.6, 1.2, Z1 + 0.25);
  ctx.add(panelHit);
  ctx.interact(panelHit, { label: '엘리베이터 버튼', node: 'lobby_elevator', enabled: () => !!state.flags.done_lobby_gate });

  // 경비원
  const guard = humanoid({ shirt: 0x1d2a44, pants: 0x151a24, skin: 0xc99a74, hair: 0x2a2a2a, coat: 0x1d2a44 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.08, 16), mat(0x10161f));
  cap.position.y = 0.12;
  guard.userData.head.add(cap);
  guard.position.set(3.2, 0, -2.6);
  guard.rotation.y = Math.PI + 0.4;
  ctx.add(guard);
  ctx.collide(2.9, -2.9, 3.5, -2.3);
  ctx.interact(guard, { label: '경비원에게 말 걸기', node: 'lobby_guard', once: true, speaker: guard });
  const desk = box(1.4, 1.0, 0.6, mat(0x2a2f37), 4.6, 0, -2.6);
  ctx.add(desk);
  ctx.collideMesh(desk);
  ctx.tick((dt, t, p) => guard.userData.update(t, p));

  // 화분, 벤치
  for (const [x, z] of [[-8.8, 8], [8.8, 8], [-8.8, -7.8], [8.8, -7.8], [-2, 8.3], [2, 8.3]]) {
    const pl = plant(x, z, 1.4);
    ctx.add(pl);
    ctx.collide(x - 0.35, z - 0.35, x + 0.35, z + 0.35);
  }
  for (const x of [-7.5, 7.5]) {
    const b = box(2.2, 0.45, 0.6, mat(0x2b2f36), x, 0, 3);
    ctx.add(b);
    ctx.collideMesh(b);
  }

  // 감시 카메라 — 플레이어를 따라 고개를 돌린다
  const cams = [];
  for (const [x, z] of [[-8, -1], [8, -1], [0, 6]]) {
    const cam = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x111111, { roughness: 0.2 }));
    dome.rotation.x = Math.PI;
    cam.add(dome);
    const pivot = new THREE.Group();
    pivot.position.y = -0.14;
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.28), mat(0x202020));
    lens.position.z = -0.08;
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), glow(0xff2244, 3));
    red.position.set(0, 0, -0.23);
    lens.add(red);
    pivot.add(lens);
    cam.add(pivot);
    cam.position.set(x, H, z);
    ctx.add(cam);
    cams.push({ cam, pivot, red });
  }
  ctx.tick((dt, t, p) => {
    for (const c of cams) {
      const dx = p.x - c.cam.position.x;
      const dz = p.z - c.cam.position.z;
      c.pivot.rotation.y = Math.atan2(-dx, -dz);
      c.red.material.emissiveIntensity = Math.sin(t * 4) > 0 ? 3 : 0.4;
    }
  });

  ctx.add(new THREE.AmbientLight(0xffffff, 0.6));
  ctx.add(new THREE.HemisphereLight(0xe8f4ff, 0x8a8f99, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 10, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  ctx.add(key);
  const blue = new THREE.PointLight(0x6ee7ff, 6, 12, 1.5);
  blue.position.set(X1 + 1, 3.4, -1.5);
  ctx.add(blue);
  ctx.scene.background = new THREE.Color(0xeef1f5);
  ctx.scene.fog = new THREE.Fog(0xeef1f5, 18, 40);

  return { spawn: { x: 0, z: 7.6, yaw: 0 } };
}
