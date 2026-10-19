import * as THREE from 'three';
import { mat, glow, tex, cyl, particles } from '../engine/builders.js';

const UP = new THREE.Vector3(0, 1, 0);

export function buildCore(ctx) {
  const R = 12;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshStandardMaterial({ map: tex.grid('#6ee7ff', [14, 14]), roughness: 0.4, metalness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  ctx.add(floor);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 10, 64, 1, true), mat(0x05070c, { side: THREE.BackSide, metalness: 0.4 }));
  wall.position.y = 5;
  ctx.add(wall);
  // 원형 벽 충돌: 다각형으로 근사
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const x = Math.cos(a) * (R + 0.3);
    const z = Math.sin(a) * (R + 0.3);
    ctx.collide(x - 1.3, z - 1.3, x + 1.3, z + 1.3);
  }

  // 바닥의 빛나는 동심원
  const rings = [];
  for (let i = 1; i <= 4; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(i * 2.4 - 0.04, i * 2.4, 96), glow(0x6ee7ff, 1.6, { side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.01;
    ctx.add(r);
    rings.push(r);
  }

  // 중앙 구체 (시스템)
  const core = new THREE.Group();
  core.position.set(0, 3.2, 0);
  const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 4), new THREE.MeshStandardMaterial({ color: 0x0a1a24, emissive: 0x1aa7c9, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.2, flatShading: true }));
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(2.25, 2), new THREE.MeshBasicMaterial({ color: 0x6ee7ff, wireframe: true, transparent: true, opacity: 0.35 }));
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16), glow(0xff3355, 4));
  eye.position.z = 1.9;
  sphere.add(eye);
  core.add(sphere, wire);
  const orbits = [];
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(2.8 + i * 0.5, 0.025, 8, 128), glow([0x6ee7ff, 0x8b7bff, 0x5cff9d][i], 2.5));
    t.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    core.add(t);
    orbits.push(t);
  }
  ctx.add(core);
  ctx.collide(-2.2, -2.2, 2.2, 2.2);
  const pedestal = cyl(1.4, 2, 0.8, mat(0x11151c, { metalness: 0.8 }), 0, 0, 0, 48);
  ctx.add(pedestal);

  // 빛의 기둥 (기억 데이터)
  const pillars = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 10, 12, 1, true), new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0x8b7bff : 0x6ee7ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    p.position.set(Math.cos(a) * 9, 5, Math.sin(a) * 9);
    ctx.add(p);
    pillars.push(p);
  }
  const dust = particles(900, { x1: -10, x2: 10, y1: 0, y2: 9, z1: -10, z2: 10 }, { color: 0x6ee7ff, size: 0.05, opacity: 0.7 });
  ctx.add(dust);

  ctx.tick((dt, t, p) => {
    sphere.rotation.y += dt * 0.15;
    wire.rotation.y -= dt * 0.08;
    wire.rotation.x += dt * 0.05;
    orbits.forEach((o, i) => {
      o.rotation.x += dt * (0.2 + i * 0.1);
      o.rotation.y += dt * 0.15;
    });
    // 붉은 눈이 플레이어를 따라본다
    const dir = new THREE.Vector3(p.x, 1.6 - core.position.y, p.z).normalize();
    dir.applyAxisAngle(UP, -sphere.rotation.y);
    eye.position.lerp(dir.multiplyScalar(1.9), 0.1);
    rings.forEach((r, i) => (r.material.opacity = 0.4 + Math.sin(t * 2 - i) * 0.35));
    dust.rotation.y += dt * 0.04;
    const a = dust.geometry.attributes.position;
    for (let i = 0; i < a.count; i += 3) {
      let y = a.getY(i) + dt * 0.4;
      if (y > 9) y = 0;
      a.setY(i, y);
    }
    a.needsUpdate = true;
    pillars.forEach((pl, i) => (pl.material.opacity = 0.2 + Math.abs(Math.sin(t * 0.8 + i)) * 0.3));
  });

  ctx.interact(core, { label: '시스템에 다가간다', node: 'core_final' });
  ctx.trigger({ x1: -4.5, z1: -4.5, x2: 4.5, z2: 4.5, node: 'core_final', key: 'core_final', cond: () => !ctx.state.ending });

  ctx.add(new THREE.AmbientLight(0x22324a, 0.6));
  const cl = new THREE.PointLight(0x6ee7ff, 30, 30, 1.2);
  cl.position.set(0, 3.2, 0);
  ctx.add(cl);
  const rim = new THREE.PointLight(0x8b7bff, 10, 30, 1.5);
  rim.position.set(0, 8, -8);
  ctx.add(rim);
  ctx.scene.background = new THREE.Color(0x020306);
  ctx.scene.fog = new THREE.FogExp2(0x020306, 0.045);

  // 엔딩 화면 뒤에서 천천히 도는 카메라
  ctx.on('ending_camera', () => {
    ctx.world.cinematic = (t, dt, cam) => {
      const a = t * 0.12;
      cam.position.set(Math.cos(a) * 8, 2.2 + Math.sin(t * 0.3) * 0.5, Math.sin(a) * 8);
      cam.lookAt(0, 3.2, 0);
    };
  });

  return { spawn: { x: 0, z: 10.5, yaw: 0 } };
}
