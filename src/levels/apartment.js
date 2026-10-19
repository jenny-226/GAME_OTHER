import * as THREE from 'three';
import { mat, glow, tex, box, cyl, room, canvasTex, humanoid, mirror, particles, textPlane } from '../engine/builders.js';

// 창밖 도시 풍경 텍스처
function cityTexture(night) {
  return canvasTex(512, 320, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    if (night) {
      sky.addColorStop(0, '#02040a');
      sky.addColorStop(1, '#12203a');
    } else {
      sky.addColorStop(0, '#8cc6ff');
      sky.addColorStop(1, '#ffe2b8');
    }
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const bw = 20 + Math.random() * 40;
      const bh = 60 + Math.random() * 200;
      const x = (i / 26) * w + Math.random() * 10;
      g.fillStyle = night ? '#070b14' : `rgba(70,90,120,${0.5 + Math.random() * 0.4})`;
      g.fillRect(x, h - bh, bw, bh);
      for (let wy = h - bh + 6; wy < h; wy += 10) {
        for (let wx = x + 4; wx < x + bw - 4; wx += 8) {
          if (Math.random() < (night ? 0.35 : 0.12)) {
            g.fillStyle = night ? 'rgba(255,210,140,.85)' : 'rgba(255,255,255,.4)';
            g.fillRect(wx, wy, 3, 4);
          }
        }
      }
    }
    // LUMEN 타워
    g.fillStyle = night ? '#0b1222' : '#5b6f8c';
    g.fillRect(w * 0.62, 20, 46, h);
    g.fillStyle = night ? '#6ee7ff' : '#e9fbff';
    g.font = 'bold 18px "Share Tech Mono"';
    g.fillText('LUMEN', w * 0.62 + 2, 40);
  }, { repeat: [1, 1] });
}

export function buildApartment(ctx, { night }) {
  const { state } = ctx;
  const X1 = -3.5, X2 = 3.5, Z1 = -3, Z2 = 3, H = 2.7;
  room(ctx, {
    x1: X1, z1: Z1, x2: X2, z2: Z2, h: H,
    floor: new THREE.MeshStandardMaterial({ map: tex.wood([3, 3]), roughness: 0.55 }),
    wall: new THREE.MeshStandardMaterial({ map: tex.wall(night ? '#9aa0ad' : '#d8d0c3'), roughness: 0.95 }),
    ceil: mat(0xe9e6e0),
  });

  // 창문
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.35), new THREE.MeshBasicMaterial({ map: cityTexture(night), toneMapped: false }));
  win.position.set(-0.4, 1.55, Z1 + 0.01);
  ctx.add(win);
  const frameM = mat(0xf2f2f2);
  ctx.add(box(2.36, 0.08, 0.08, frameM, -0.4, 0.84, Z1 + 0.03), box(2.36, 0.08, 0.08, frameM, -0.4, 2.22, Z1 + 0.03), box(0.06, 1.4, 0.06, frameM, -0.4, 0.86, Z1 + 0.04));
  const sill = box(2.4, 0.04, 0.22, frameM, -0.4, 0.82, Z1 + 0.1);
  ctx.add(sill);
  ctx.interact(win, { label: '창밖을 본다', node: night ? 'night_window' : 'apt_window' });

  // 침대 + 협탁
  const bed = new THREE.Group();
  bed.add(box(1.5, 0.35, 2.1, mat(0x3b3f47), 0, 0, 0));
  bed.add(box(1.44, 0.18, 2.0, mat(0xeeeeee, { roughness: 0.9 }), 0, 0.35, 0));
  bed.add(box(1.46, 0.08, 1.3, mat(night ? 0x34406a : 0x6f8fb3, { roughness: 0.95 }), 0, 0.5, 0.33));
  bed.add(box(0.6, 0.14, 0.38, mat(0xffffff), -0.33, 0.53, -0.75), box(0.6, 0.14, 0.38, mat(0xffffff), 0.33, 0.53, -0.75));
  bed.add(box(1.6, 0.9, 0.08, mat(0x3b3f47), 0, 0, -1.05));
  bed.position.set(-2.6, 0, -1.8);
  ctx.add(bed);
  ctx.collideBox(bed);
  if (night) ctx.interact(bed, { label: '잠자리에 든다', node: () => (state.flags.wrote_msg ? 'night_bed' : 'night_bed_wait') });

  const stand = box(0.5, 0.55, 0.45, mat(0x6b4a33), -1.5, 0, -2.6);
  ctx.add(stand);
  ctx.collideMesh(stand);
  const lampBase = cyl(0.08, 0.1, 0.32, mat(0x222222), -1.6, 0.55, -2.65);
  const shade = cyl(0.12, 0.18, 0.2, mat(0xfff1d6, { emissive: 0xffc777, emissiveIntensity: night ? 1.2 : 0.4 }), -1.6, 0.82, -2.65);
  ctx.add(lampBase, shade);
  const lampLight = new THREE.PointLight(0xffc27a, night ? 4 : 0.6, 6, 1.4);
  lampLight.position.set(-1.6, 1.0, -2.55);
  ctx.add(lampLight);

  // 휴대폰 (낮)
  if (!night) {
    const phone = new THREE.Group();
    phone.add(box(0.08, 0.012, 0.16, mat(0x111111, { roughness: 0.2 }), 0, 0, 0));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.145), glow(0x6ee7ff, 1.6));
    scr.rotation.x = -Math.PI / 2;
    scr.position.y = 0.014;
    phone.add(scr);
    phone.position.set(-1.42, 0.55, -2.55);
    phone.rotation.y = 0.4;
    ctx.add(phone);
    // 손으로 집기 쉽게 투명한 조사 범위를 키운다
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.35), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(-1.42, 0.6, -2.55);
    phone.add(hit);
    hit.position.set(0, 0.05, 0);
    ctx.interact(phone, { label: '휴대폰 확인', node: 'apt_phone', once: true });
    ctx.tick((dt, t) => {
      if (!state.flags['done_apt_phone']) scr.material.emissiveIntensity = 1.2 + Math.sin(t * 6) * 0.8;
      else scr.material.emissiveIntensity = 0.3;
    });
  }

  // 책상
  const desk = new THREE.Group();
  const top = mat(0x2a2d33, { roughness: 0.5 });
  desk.add(box(1.5, 0.05, 0.7, top, 0, 0.72, 0));
  desk.add(box(0.05, 0.72, 0.66, top, -0.72, 0, 0), box(0.05, 0.72, 0.66, top, 0.72, 0, 0));
  desk.position.set(2.6, 0, -2.55);
  ctx.add(desk);
  ctx.collideBox(desk);
  const deskLamp = new THREE.PointLight(night ? 0xffd9a0 : 0xfff0d0, night ? 3.5 : 0.3, 5, 1.5);
  deskLamp.position.set(3.1, 1.3, -2.5);
  ctx.add(deskLamp);

  if (!night) {
    const note = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.18), new THREE.MeshStandardMaterial({ map: canvasTex(128, 96, (g) => {
      g.fillStyle = '#fbf6e4';
      g.fillRect(0, 0, 128, 96);
      g.strokeStyle = '#333';
      g.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(10, 20 + i * 14);
        for (let x = 10; x < 110; x += 6) g.lineTo(x, 20 + i * 14 + Math.sin(x) * 2);
        g.stroke();
      }
    }) }));
    paper.rotation.x = -Math.PI / 2;
    paper.rotation.z = 0.25;
    note.add(paper);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.35), new THREE.MeshBasicMaterial({ visible: false }));
    note.add(hit);
    note.position.set(2.4, 0.78, -2.45);
    ctx.add(note);
    ctx.interact(note, { label: '접힌 메모 읽기', node: 'apt_desk', once: true });
  } else {
    // 노트북
    const lap = new THREE.Group();
    lap.add(box(0.42, 0.02, 0.3, mat(0x9aa0aa, { metalness: 0.6, roughness: 0.3 }), 0, 0, 0));
    const lid = box(0.42, 0.28, 0.015, mat(0x9aa0aa, { metalness: 0.6, roughness: 0.3 }), 0, 0, 0);
    lid.position.set(0, 0.14, -0.15);
    lid.rotation.x = -0.25;
    lap.add(lid);
    const scr = textPlane(['MISSING · 5', '■ 이수민', '■ 박지호', '■ 최유나', '■ 강도윤', '■ 다니엘 한 ←'], 0.38, 0.24, { w: 384, h: 256, bg: '#06101a', color: '#ff8fa3', size: 30, align: 'left', font: 'Share Tech Mono' });
    scr.position.set(0, 0.15, -0.14);
    scr.rotation.x = -0.25;
    lap.add(scr);
    lap.position.set(2.85, 0.75, -2.55);
    ctx.add(lap);
    ctx.interact(lap, { label: '노트북 조사 보드', node: 'night_laptop', once: true });

    const pad = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), mat(0xfbf6e4));
    paper.rotation.x = -Math.PI / 2;
    pad.add(paper);
    pad.add(box(0.012, 0.012, 0.16, mat(0x1d4ed8), 0.15, 0, 0));
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    pad.add(hit);
    pad.position.set(2.2, 0.775, -2.45);
    ctx.add(pad);
    ctx.interact(pad, { label: '낮의 나에게 메시지 남기기', node: 'night_desk', once: true });
  }

  // 의자 (+ 밤엔 재킷)
  const chair = new THREE.Group();
  const cm = mat(0x1f2228);
  chair.add(box(0.5, 0.06, 0.5, cm, 0, 0.45, 0), box(0.5, 0.6, 0.06, cm, 0, 0.5, 0.25), cyl(0.03, 0.03, 0.45, cm, 0, 0, 0, 8));
  chair.position.set(2.4, 0, -1.7);
  ctx.add(chair);
  ctx.collideBox(chair);
  if (night) {
    const jacket = new THREE.Group();
    jacket.add(box(0.52, 0.55, 0.12, mat(0x3a2f2a, { roughness: 0.95 }), 0, 0.5, 0.32));
    jacket.add(box(0.14, 0.4, 0.1, mat(0x3a2f2a), -0.3, 0.6, 0.32), box(0.14, 0.4, 0.1, mat(0x3a2f2a), 0.3, 0.6, 0.32));
    chair.add(jacket);
    ctx.interact(chair, { label: '재킷 주머니 뒤지기', node: 'night_jacket', once: true });
  }

  // 옷장, 러그, 선반
  const ward = box(1.2, 2.2, 0.6, mat(0x8b6a4d), 2.85, 0, 1.6);
  ward.rotation.y = 0;
  ctx.add(ward);
  ctx.collideMesh(ward);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.5), new THREE.MeshStandardMaterial({ map: tex.carpet(night ? '#2a3150' : '#7a5c58', [2, 2]) }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.005, 0.3);
  ctx.add(rug);
  const shelf = box(1.2, 0.04, 0.25, mat(0x6b4a33), 0.6, 1.6, Z1 + 0.15);
  ctx.add(shelf);
  for (let i = 0; i < 5; i++) ctx.add(box(0.06, 0.2 + Math.random() * 0.08, 0.17, mat([0x9b2c2c, 0x2c5f9b, 0xd9a441, 0x3b7a57, 0x444444][i]), 1.95 + i * 0.08, 1.64, Z1 + 0.15));

  // 문 (남쪽 벽)
  const door = new THREE.Group();
  door.add(box(0.95, 2.1, 0.06, mat(0x5a4636, { roughness: 0.6 }), 0, 0, 0));
  door.add(box(0.08, 0.04, 0.08, mat(0xd8c08a, { metalness: 0.8, roughness: 0.3 }), -0.35, 1.0, -0.06));
  door.position.set(1.6, 0, Z2 - 0.05);
  ctx.add(door);
  if (!night) {
    const seen = () => ['apt_mirror', 'apt_desk', 'apt_phone'].filter((k) => state.flags[`done_${k}`]).length;
    ctx.interact(door, { label: '현관문 — 출근하기', node: () => (seen() >= 2 ? 'apt_door' : 'apt_door_locked') });
  } else {
    ctx.interact(door, { label: '현관문 — 흔적 찾으러 나가기', node: () => (state.flags.night_searched ? 'night_door_done' : 'night_door') });
  }

  // 거울 (서쪽 벽) — 거울에만 비치는 내 몸
  const body = humanoid({ shirt: night ? 0x1c1c22 : 0xdfe6ee, pants: 0x262a33, skin: 0xe2bb98, hair: 0x15100c });
  body.visible = false;
  ctx.add(body);
  const mir = mirror(0.9, 1.7, body);
  mir.position.set(X1 + 0.04, 1.35, 1.2);
  mir.rotation.y = Math.PI / 2;
  ctx.add(mir);
  const mframe = box(0.04, 1.8, 1.0, mat(0x111111), X1 + 0.005, 0.45, 1.2);
  ctx.add(mframe);
  const mirHit = new THREE.Group();
  mirHit.add(mir);
  ctx.add(mirHit);
  ctx.interact(mirHit, { label: '거울을 본다', node: night ? 'night_mirror' : 'apt_mirror', once: !night });
  ctx.tick((dt, t, p) => {
    body.position.set(p.x, 0, p.z);
    body.rotation.y = ctx.world.yaw;
    body.userData.head.rotation.x = -ctx.world.pitch * 0.5;
  });

  // 조명
  if (night) {
    ctx.add(new THREE.AmbientLight(0x5a6890, 0.9));
    ctx.add(new THREE.HemisphereLight(0x3a4a80, 0x1a1410, 0.5));
    const moon = new THREE.DirectionalLight(0x6f8cff, 0.45);
    moon.position.set(-0.5, 2.5, -6);
    moon.target.position.set(0, 0, 1);
    ctx.add(moon, moon.target);
    ctx.scene.fog = new THREE.Fog(0x05070d, 6, 16);
    ctx.scene.background = new THREE.Color(0x05070d);
    // 창에 흐르는 빗줄기
    const rain = particles(260, { x1: -1.5, x2: 0.7, y1: 0.85, y2: 2.2, z1: Z1 + 0.03, z2: Z1 + 0.05 }, { size: 0.012, opacity: 0.7 });
    ctx.add(rain);
    ctx.tick((dt) => {
      const a = rain.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - dt * (0.6 + (i % 5) * 0.3);
        if (y < 0.85) y = 2.2;
        a.setY(i, y);
      }
      a.needsUpdate = true;
    });
    // 드론 불빛 (창밖)
    const drone = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), glow(0xff3355, 4));
    drone.position.set(0.1, 1.9, Z1 - 0.02);
    ctx.add(drone);
    ctx.tick((dt, t) => (drone.material.emissiveIntensity = Math.sin(t * 3) > 0 ? 4 : 0.3));
  } else {
    ctx.add(new THREE.AmbientLight(0xfff3e0, 0.55));
    ctx.add(new THREE.HemisphereLight(0xcfe6ff, 0x6b4a33, 0.45));
    const sun = new THREE.DirectionalLight(0xffe2b0, 2.2);
    sun.position.set(-0.4, 3.2, -5);
    sun.target.position.set(0.5, 0, 1.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -5;
    sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 5;
    sun.shadow.camera.bottom = -5;
    ctx.add(sun, sun.target);
    // 햇살 속 먼지
    const dust = particles(140, { x1: -2, x2: 1.5, y1: 0.3, y2: 2.4, z1: -2.8, z2: 1 }, { color: 0xffe9c4, size: 0.015, opacity: 0.5 });
    ctx.add(dust);
    ctx.tick((dt, t) => (dust.rotation.y = Math.sin(t * 0.1) * 0.05));
    ctx.scene.background = new THREE.Color(0xdfe9f5);
  }

  return night ? { spawn: { x: -1.0, z: 0.6, yaw: -0.9 } } : { spawn: { x: -1.0, z: 0.4, yaw: -1.0 } };
}
