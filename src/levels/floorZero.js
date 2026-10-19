import * as THREE from 'three';
import { mat, glow, tex, box, cyl, room, wallSeg, humanoid, mirror, screen, textPlane } from '../engine/builders.js';

export function buildFloorZero(ctx) {
  const { state } = ctx;
  const H = 3.2;
  const white = new THREE.MeshStandardMaterial({ map: tex.wall('#f4f6f8', [3, 1]), roughness: 0.6 });
  const floorM = new THREE.MeshStandardMaterial({ map: tex.tiles('#eef1f4', '#cfd6de', [3, 10]), roughness: 0.25, metalness: 0.1 });

  // 복도: x -2.5~2.5, z 2.5 ~ -12
  const cf = new THREE.Mesh(new THREE.PlaneGeometry(5, 14.5), floorM);
  cf.rotation.x = -Math.PI / 2;
  cf.position.set(0, 0, -4.75);
  ctx.add(cf);
  const cc = new THREE.Mesh(new THREE.PlaneGeometry(5, 14.5), mat(0xffffff));
  cc.rotation.x = Math.PI / 2;
  cc.position.set(0, H, -4.75);
  ctx.add(cc);
  ctx.add(wallSeg(ctx, -2.5, 2.5, -2.5, -12, H, white));
  ctx.add(wallSeg(ctx, 2.5, 2.5, 2.5, -12, H, white));
  ctx.add(wallSeg(ctx, -2.5, 2.5, 2.5, 2.5, H, white));
  for (let z = 1; z > -12; z -= 2) ctx.add(box(0.3, 0.04, 1.4, glow(0xf2fbff, 2.6), 0, H - 0.05, z));

  // 실험실: x -8~8, z -12 ~ -26
  room(ctx, { x1: -8, z1: -26, x2: 8, z2: -12, h: H + 1, floor: new THREE.MeshStandardMaterial({ map: tex.tiles('#e3e8ed', '#c6cdd6', [8, 7]), roughness: 0.3 }), wall: white, ceil: mat(0xffffff), walls: 'nwe' });
  ctx.add(wallSeg(ctx, -8, -12, -2.5, -12, H + 1, white));
  ctx.add(wallSeg(ctx, 2.5, -12, 8, -12, H + 1, white));
  ctx.add(box(5, 1, 0.12, white, 0, H, -12));
  const flick = [];
  for (const x of [-4, 0, 4]) {
    for (const z of [-15, -19, -23]) {
      const l = box(1.8, 0.04, 0.4, glow(0xf2fbff, 2.4), x, H + 0.95, z);
      ctx.add(l);
      flick.push(l);
    }
  }

  // 엘리베이터 (뒤쪽)
  ctx.add(box(1.6, 2.4, 0.06, mat(0xb9c0c9, { metalness: 0.85, roughness: 0.25 }), 0, 0, 2.43));
  const zero = textPlane('0', 0.3, 0.3, { w: 128, h: 128, color: '#ff3355', size: 100, bg: '#0b0b0b', font: 'Share Tech Mono', weight: 400 });
  zero.position.set(0, 2.65, 2.4);
  zero.rotation.y = Math.PI;
  ctx.add(zero);

  const sign = textPlane(['FLOOR 0', 'PROJECT TRIAD'], 2.4, 0.6, { w: 512, h: 128, color: '#6b7787', size: 44 });
  sign.position.set(2.47, 2.3, -1);
  sign.rotation.y = -Math.PI / 2;
  ctx.add(sign);

  // 유리벽(거울) — 반 박자 늦게 따라오는 또 다른 나
  const other = humanoid({ shirt: 0xdfe6ee, pants: 0x262a33, skin: 0xe2bb98, hair: 0x15100c, eyes: 0x5cff9d });
  other.visible = false;
  ctx.add(other);
  const mir = mirror(4.2, 2.6, other, { tint: 0x9fb8b0 });
  mir.position.set(-2.43, 1.4, -6.5);
  mir.rotation.y = Math.PI / 2;
  const mirG = new THREE.Group();
  mirG.add(mir);
  ctx.add(mirG);
  ctx.add(box(0.03, 0.06, 4.3, mat(0x9aa4b0, { metalness: 0.8 }), -2.46, 0.07, -6.5), box(0.03, 0.06, 4.3, mat(0x9aa4b0, { metalness: 0.8 }), -2.46, 2.7, -6.5));
  ctx.interact(mirG, { label: '유리벽을 본다', node: 'zero_mirror', once: true });
  const lag = new THREE.Vector3();
  let lagYaw = 0;
  ctx.tick((dt, t, p) => {
    const resist = state.flags.resist_03;
    const k = resist ? 1 : Math.min(1, dt * 2.2);
    lag.x += (p.x - lag.x) * k;
    lag.z += (p.z - lag.z) * k;
    lagYaw += (ctx.world.yaw - lagYaw) * k;
    other.position.set(lag.x, 0, lag.z);
    other.rotation.y = lagYaw;
    other.userData.eyeMat.emissiveIntensity = resist ? 0 : 2.5;
  });
  lag.set(0, 0, 1);

  // 캡슐
  const pods = [];
  const podGlass = new THREE.MeshPhysicalMaterial({ color: 0xbff7ff, transparent: true, opacity: 0.25, roughness: 0.02, transmission: 0, side: THREE.DoubleSide });
  const people = [0x5a6170, 0x6b4f4f, 0x405a4d, 0x51466b, 0x6d6450];
  let idx = 0;
  for (const x of [-6, 6]) {
    for (const z of [-15, -18, -21, -24]) {
      const pod = new THREE.Group();
      pod.add(cyl(0.6, 0.65, 0.25, mat(0x2a2f37, { metalness: 0.7 }), 0, 0, 0, 24));
      pod.add(cyl(0.6, 0.6, 0.2, mat(0x2a2f37, { metalness: 0.7 }), 0, 2.25, 0, 24));
      pod.add(cyl(0.58, 0.58, 2.0, podGlass, 0, 0.25, 0, 24));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.02, 8, 32), glow(0x6ee7ff, 2));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.27;
      pod.add(ring);
      const sleeper = humanoid({ shirt: 0xe8edf2, pants: 0xe8edf2, skin: 0xd9b08f, hair: people[idx % people.length] });
      sleeper.scale.setScalar(0.92);
      sleeper.position.y = 0.3;
      sleeper.userData.head.rotation.x = 0.3;
      pod.add(sleeper);
      pod.position.set(x, 0, z);
      pod.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
      ctx.add(pod);
      ctx.collide(x - 0.7, z - 0.7, x + 0.7, z + 0.7);
      pods.push({ pod, ring, sleeper });
      const tag = screen([idx === 0 ? '다니엘 한' : `SUBJ-${String(idx + 1).padStart(3, '0')}`, `REWRITE ${idx === 0 ? 72 : 40 + idx * 7}%`], 0.6, 0.3, { size: 34, color: idx === 0 ? '#ffb547' : '#6ee7ff', w: 320, h: 160 });
      tag.position.set(x < 0 ? x + 0.72 : x - 0.72, 2.05, z);
      tag.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      ctx.add(tag);
      idx++;
    }
  }
  const daniel = pods[0];
  ctx.interact(daniel.pod, { label: '다니엘의 캡슐', node: 'zero_pod', once: true });
  const openPod = () => {
    daniel.pod.children[2].visible = false;
    daniel.ring.material.emissive.setHex(0x5cff9d);
    daniel.sleeper.userData.head.rotation.x = 0;
    daniel.sleeper.position.x = 0;
  };
  if (state.flags.daniel_saved) openPod();
  ctx.on('open_pod', openPod);
  ctx.tick((dt, t) => pods.forEach((p, i) => (p.ring.material.emissiveIntensity = 1.4 + Math.sin(t * 2 + i) * 0.8)));

  // 중앙 터미널
  const term = new THREE.Group();
  term.add(cyl(0.5, 0.6, 1.0, mat(0x1f242c, { metalness: 0.6 }), 0, 0, 0, 6));
  const holo = screen(['PROJECT TRIAD', '01 ▸ 업무 인격', '02 ▸ 사생활 인격', '03 ▸ 명령 수행', '', 'STATUS: ACTIVE'], 1.2, 0.8, { color: '#6ee7ff', bg: 'rgba(0,20,30,0.55)', size: 30 });
  holo.material.transparent = true;
  holo.material.opacity = 0.85;
  holo.position.set(0, 1.6, 0);
  term.add(holo);
  term.position.set(0, 0, -19);
  ctx.add(term);
  ctx.collide(-0.6, -19.6, 0.6, -18.4);
  ctx.interact(term, { label: 'TRIAD 터미널', node: 'zero_terminal', once: true });
  ctx.tick((dt, t) => {
    holo.position.y = 1.6 + Math.sin(t * 1.5) * 0.04;
    holo.rotation.y = Math.sin(t * 0.4) * 0.3;
  });

  // 코어실 문 (북쪽)
  const coreDoor = new THREE.Group();
  coreDoor.add(box(2.6, 3, 0.2, mat(0x1a1d23, { metalness: 0.8, roughness: 0.3 }), 0, 0, 0));
  const strip = box(2.4, 0.06, 0.05, glow(0xff3355, 2.5), 0, 1.5, 0.12);
  coreDoor.add(strip);
  const cl = textPlane('CORE', 1.2, 0.35, { w: 256, h: 80, color: '#ffffff', size: 60, font: 'Share Tech Mono', weight: 400 });
  cl.position.set(0, 2.4, 0.11);
  coreDoor.add(cl);
  coreDoor.position.set(0, 0, -25.85);
  ctx.add(coreDoor);
  ctx.interact(coreDoor, { label: '코어실 문', node: () => (state.flags.know_third ? 'zero_alarm' : 'zero_core_locked') });
  const doorLight = () => strip.material.emissive.setHex(state.flags.know_third ? 0x5cff9d : 0xff3355);
  doorLight();
  ctx.on('open_core', doorLight);

  // 미라 (동행 시)
  if (state.flags.companion_mira) {
    const mira = humanoid({ shirt: 0x8e3b52, pants: 0x22252d, skin: 0xe9c3a3, hair: 0x2b1a12, height: 0.96 });
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat(0x2b1a12));
    bun.position.set(0, 0.08, 0.1);
    mira.userData.head.add(bun);
    mira.position.set(1.4, 0, -2.5);
    mira.rotation.y = Math.PI / 2 + 0.3;
    ctx.add(mira);
    ctx.collide(1.1, -2.8, 1.7, -2.2);
    ctx.interact(mira, { label: '미라와 이야기하기', node: 'zero_mira', once: true, speaker: mira });
    ctx.tick((dt, t, p) => mira.userData.update(t, p));
  }

  // 경보
  const red = new THREE.PointLight(0xff1133, 0, 30, 1);
  red.position.set(0, 3, -20);
  ctx.add(red);
  let alarm = false;
  ctx.on('alarm', () => {
    alarm = true;
    ctx.sound?.alarm(true);
  });
  ctx.tick((dt, t) => {
    if (alarm) red.intensity = 12 + Math.sin(t * 7) * 10;
    for (let i = 0; i < flick.length; i++) {
      if (i === 4) flick[i].material.emissiveIntensity = Math.random() < 0.1 ? 0.2 : 2.4;
      if (alarm) flick[i].material.emissiveIntensity = 0.3;
    }
  });

  ctx.add(new THREE.AmbientLight(0xeaf6ff, 0.75));
  ctx.add(new THREE.HemisphereLight(0xffffff, 0xb8c4d0, 0.6));
  const cold = new THREE.PointLight(0xdff6ff, 6, 20, 1.4);
  cold.position.set(0, 3.6, -19);
  ctx.add(cold);
  const cold2 = new THREE.PointLight(0xdff6ff, 3, 10, 1.4);
  cold2.position.set(0, 2.8, -4);
  ctx.add(cold2);
  ctx.scene.background = new THREE.Color(0xf4f7fa);
  ctx.scene.fog = new THREE.Fog(0xf4f7fa, 8, 34);

  return { spawn: { x: 0, z: 1.3, yaw: 0 }, leave: () => ctx.sound?.alarm(false) };
}
