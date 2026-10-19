import * as THREE from 'three';
import { mat, glow, tex, box, room, wallSeg, humanoid, plant, screen, canvasTex, deskWithMonitor, textPlane } from '../engine/builders.js';

function rackTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#0d1016';
    g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 16) {
      g.fillStyle = '#1a1f28';
      g.fillRect(6, y, w - 12, 12);
      for (let x = 12; x < w - 12; x += 9) {
        if (Math.random() < 0.5) {
          g.fillStyle = Math.random() < 0.8 ? '#33e1ff' : '#5cff9d';
          g.fillRect(x, y + 4, 3, 3);
        }
      }
    }
  }, { repeat: [1, 1] });
}

export function buildOffice(ctx) {
  const { state } = ctx;
  const X1 = -8, X2 = 8, Z1 = -7, Z2 = 8, H = 3;
  room(ctx, {
    x1: X1, z1: Z1, x2: X2, z2: Z2, h: H,
    floor: new THREE.MeshStandardMaterial({ map: tex.carpet('#3d4553', [8, 8]), roughness: 0.95 }),
    wall: new THREE.MeshStandardMaterial({ map: tex.wall('#e4e6ea', [4, 1]), roughness: 0.9 }),
    ceil: mat(0xf0f1f3),
  });
  // 서버실 바닥은 금속
  const sf = new THREE.Mesh(new THREE.PlaneGeometry(16, 5.5), new THREE.MeshStandardMaterial({ map: tex.tiles('#3a3f48', '#22262c', [8, 3]), metalness: 0.5, roughness: 0.4 }));
  sf.rotation.x = -Math.PI / 2;
  sf.position.set(0, 0.004, -4.25);
  ctx.add(sf);

  const lights = [];
  for (let z = -5; z <= 7; z += 3) {
    for (const x of [-4, 0, 4]) {
      const p = box(1.6, 0.04, 0.5, glow(0xffffff, z < -1 ? 0.8 : 2), x, H - 0.05, z);
      ctx.add(p);
      lights.push(p);
    }
  }

  // 유리벽 + 문 (z = -1.5)
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fdfff, transparent: true, opacity: 0.22, roughness: 0.05, side: THREE.DoubleSide });
  ctx.add(wallSeg(ctx, X1, -1.5, -0.75, -1.5, H, glass, { thick: 0.05 }));
  ctx.add(wallSeg(ctx, 0.75, -1.5, X2, -1.5, H, glass, { thick: 0.05 }));
  ctx.add(box(1.5, 0.5, 0.06, mat(0x2a2f37), 0, H - 0.5, -1.5));
  const door = box(1.5, H - 0.5, 0.05, new THREE.MeshPhysicalMaterial({ color: 0x9fdfff, transparent: true, opacity: 0.3, roughness: 0.05 }), 0, 0, -1.5);
  ctx.add(door);
  const doorCol = ctx.collide(-0.75, -1.56, 0.75, -1.44);
  const sign = textPlane(['SERVER ROOM B', '서버실 B · 레벨 3'], 1.4, 0.35, { w: 512, h: 128, color: '#ffffff', size: 40, bg: '#1d2430' });
  sign.position.set(0, H - 0.25, -1.46);
  ctx.add(sign);
  let doorTarget = state.flags.server_open ? 1 : 0;
  let doorOpen = doorTarget;
  ctx.tick((dt) => {
    doorOpen += (doorTarget - doorOpen) * Math.min(1, dt * 3);
    door.position.x = doorOpen * 1.5;
    doorCol.on = doorOpen < 0.6;
  });
  ctx.on('open_server', () => (doorTarget = 1));

  const reader = new THREE.Group();
  reader.add(box(0.12, 0.18, 0.04, mat(0x15181d), 0, 0, 0));
  const led = box(0.05, 0.02, 0.01, glow(0xff3355, 2), 0, 0.13, 0.025);
  reader.add(led);
  reader.position.set(1.0, 1.1, -1.44);
  ctx.add(reader);
  const readerHit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
  readerHit.position.set(0.3, 1.1, -1.3);
  ctx.add(readerHit);
  ctx.interact(readerHit, {
    label: '서버실 출입 (카드 리더기)',
    enabled: () => !state.flags.server_open,
    node: () => (state.flags.server_key ? 'off_door_key' : state.flags.guard_route ? 'off_door_route' : 'off_door_locked'),
  });
  ctx.tick(() => led.material.emissive.setHex(state.flags.server_open ? 0x5cff9d : 0xff3355));

  // 서버 랙
  const rackM = new THREE.MeshStandardMaterial({ map: rackTexture(), emissive: 0xffffff, emissiveMap: rackTexture(), emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.4 });
  const racks = [];
  for (const x of [-6, -4.2, 4.2, 6]) {
    for (const z of [-5.6, -3.4]) {
      const r = box(1.2, 2.3, 0.9, [mat(0x1a1d23, { metalness: 0.7 }), mat(0x1a1d23), mat(0x1a1d23), mat(0x1a1d23), rackM, rackM], x, 0, z);
      ctx.add(r);
      ctx.collideMesh(r);
      racks.push(r);
    }
  }
  ctx.tick((dt, t) => {
    rackM.emissiveIntensity = 0.7 + Math.sin(t * 9) * 0.15 + (Math.random() < 0.05 ? 0.4 : 0);
  });
  const rackHit = racks[1];
  ctx.interact(rackHit, { label: '서버 랙 이름표', node: 'off_racks' });

  // 로그 단말 (랙 옆)
  const logT = new THREE.Group();
  logT.add(box(0.5, 1.1, 0.4, mat(0x22262c), 0, 0, 0));
  const ls = screen(['> MEMORY ACCESS LOG', 'JULIAN-01  OK', 'JULIAN-02  OK', 'JULIAN-03  ??'], 0.44, 0.3, { color: '#5cff9d', size: 30 });
  ls.position.set(0, 1.28, 0.05);
  ls.rotation.x = -0.35;
  logT.add(ls, box(0.5, 0.06, 0.45, mat(0x15181d), 0, 1.1, 0));
  logT.position.set(2.6, 0, -4.6);
  logT.rotation.y = -Math.PI / 2;
  ctx.add(logT);
  ctx.collideBox(logT);
  ctx.interact(logT, { label: '기억 접속 로그 단말', node: 'off_log', once: true });

  // CCTV 단말
  const cctv = new THREE.Group();
  cctv.add(box(2.4, 0.05, 0.8, mat(0x2a2d33), 0, 0.75, 0));
  cctv.add(box(2.4, 0.75, 0.05, mat(0x1d2026), 0, 0, -0.38));
  const feeds = [];
  for (let i = 0; i < 3; i++) {
    const ft = canvasTex(256, 160, () => {});
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.44), new THREE.MeshBasicMaterial({ map: ft, toneMapped: false }));
    m.position.set(-0.75 + i * 0.75, 1.15, -0.3);
    cctv.add(m, box(0.74, 0.48, 0.03, mat(0x111111), -0.75 + i * 0.75, 0.91, -0.33));
    feeds.push(ft);
  }
  cctv.position.set(0, 0, -6.4);
  ctx.add(cctv);
  ctx.collideBox(cctv);
  ctx.interact(cctv, { label: 'CCTV 보관 단말', node: 'off_cctv', once: true });
  let fAcc = 0;
  const drawFeeds = (t) => {
    feeds.forEach((ft, i) => {
      const g = ft.userData.ctx;
      g.fillStyle = '#0c1410';
      g.fillRect(0, 0, 256, 160);
      g.strokeStyle = 'rgba(160,255,190,.35)';
      for (let k = 0; k < 6; k++) g.strokeRect(20 + k * 10, 30 + k * 8, 216 - k * 20, 100 - k * 16);
      if (i === 1) {
        g.fillStyle = Math.sin(t * 2) > 0 ? '#ff3355' : '#661020';
        g.fillRect(100, 50, 56, 60);
        g.fillStyle = '#ffffff';
        g.font = '16px "Share Tech Mono"';
        g.fillText('02:13 ~ 02:30 DELETED', 40, 145);
      }
      for (let y = 0; y < 160; y += 3) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`;
        g.fillRect(0, y, 256, 1);
      }
      g.fillStyle = '#a0ffbe';
      g.font = '14px "Share Tech Mono"';
      g.fillText(`CAM-0${i + 3}  ${new Date(0, 0, 0, 14, 40, Math.floor(t) % 60).toTimeString().slice(0, 8)}`, 10, 18);
      ft.needsUpdate = true;
    });
  };
  ctx.tick((dt, t) => {
    fAcc += dt;
    if (fAcc > 0.15) {
      fAcc = 0;
      drawFeeds(t);
    }
  });

  // 사무 공간
  const lines = (name) => ['> LUMEN OS v3.0', `> ${name}`, '> 업무 중...'];
  for (const [x, z, n] of [[-5, 1.5, 'K.LEE'], [-3.2, 1.5, 'M.SEO'], [3.2, 1.5, 'D.HAN'], [5, 1.5, 'Y.CHOI'], [-5, 4.5, 'J.PARK'], [-3.2, 4.5, 'S.KANG'], [5, 4.5, 'H.YOON']]) {
    deskWithMonitor(ctx, x, z, 0, lines(n));
  }
  const mine = deskWithMonitor(ctx, 3.2, 4.5, 0, ['> JULIAN', '> 오전 기록: 없음', '> 17 17 17 17'], '#ffb547');
  ctx.tick((dt, t) => (mine.screen.material.color.setScalar(Math.random() < 0.03 ? 0.3 : 1)));
  // 칸막이
  for (const x of [-4.1, 4.1]) {
    for (const z of [1.5, 4.5]) {
      const p = box(0.05, 1.2, 1.4, mat(0x8a93a3), x, 0, z);
      ctx.add(p);
    }
  }
  for (const [x, z] of [[-7.4, 7.4], [7.4, 7.4], [-7.4, -0.8], [7.4, -0.8]]) ctx.add(plant(x, z, 1.1));

  // 창문 (동쪽 벽)
  const city = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.8), new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(512, 128, (g) => {
    const s = g.createLinearGradient(0, 0, 0, 128);
    s.addColorStop(0, '#9cc9f2');
    s.addColorStop(1, '#f5dfc0');
    g.fillStyle = s;
    g.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(90,110,140,${0.4 + Math.random() * 0.4})`;
      const bh = 30 + Math.random() * 80;
      g.fillRect(i * 13, 128 - bh, 12, bh);
    }
  }) }));
  city.position.set(X2 - 0.02, 1.6, 3.5);
  city.rotation.y = -Math.PI / 2;
  ctx.add(city);

  // 엘리베이터 문 (남쪽)
  ctx.add(box(1.6, 2.4, 0.06, mat(0xb9c0c9, { metalness: 0.85, roughness: 0.25 }), 0, 0, Z2 - 0.05));
  const fl = textPlane('17F', 0.5, 0.2, { w: 256, h: 100, color: '#ff9b5c', size: 70, bg: '#0b0b0b', font: 'Share Tech Mono', weight: 400 });
  fl.position.set(0, 2.6, Z2 - 0.08);
  fl.rotation.y = Math.PI;
  ctx.add(fl);

  // 미라
  const mira = humanoid({ shirt: 0x8e3b52, pants: 0x22252d, skin: 0xe9c3a3, hair: 0x2b1a12, height: 0.96 });
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat(0x2b1a12));
  bun.position.set(0, 0.08, 0.1);
  mira.userData.head.add(bun);
  mira.position.set(-1.6, 0, 2.6);
  mira.rotation.y = -Math.PI / 2 - 0.4;
  ctx.add(mira);
  ctx.collide(-1.9, 2.3, -1.3, 2.9);
  ctx.interact(mira, { label: '미라에게 말 걸기', node: 'off_mira', once: true, speaker: mira });
  ctx.tick((dt, t, p) => mira.userData.update(t, p));

  // 15:00 — 두 단서를 모두 확인하면 정전
  ctx.trigger({
    x1: X1, z1: Z1, x2: X2, z2: Z2, delay: 1.2, node: 'off_1500', key: 'off_1500',
    cond: () => state.flags.done_off_cctv && state.flags.done_off_log && !state.flags.done_off_1500,
  });

  const amb = new THREE.AmbientLight(0xffffff, 0.55);
  const hemi = new THREE.HemisphereLight(0xeaf3ff, 0x40444c, 0.6);
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.2);
  sun.position.set(10, 6, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  const serverGlow = new THREE.PointLight(0x33e1ff, 4, 9, 1.5);
  serverGlow.position.set(0, 2.2, -4.3);
  ctx.add(amb, hemi, sun, serverGlow);
  ctx.scene.background = new THREE.Color(0xe8ecf1);

  const red = new THREE.PointLight(0xff1133, 0, 18, 1.2);
  red.position.set(0, 2.6, 2);
  ctx.add(red);
  let blackout = false;
  ctx.on('blackout', () => {
    blackout = true;
    amb.intensity = 0.05;
    hemi.intensity = 0.05;
    sun.intensity = 0;
    serverGlow.intensity = 0.6;
    lights.forEach((l) => (l.material.emissiveIntensity = 0));
    ctx.scene.background = new THREE.Color(0x090103);
    ctx.scene.fog = new THREE.Fog(0x090103, 2, 16);
    ctx.sound?.alarm(true);
  });
  ctx.tick((dt, t) => {
    if (blackout) red.intensity = 9 + Math.sin(t * 6) * 7;
  });

  return { spawn: { x: 3.2, z: 6.2, yaw: 0.15 }, leave: () => ctx.sound?.alarm(false) };
}
