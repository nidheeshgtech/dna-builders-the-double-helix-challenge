import * as THREE from 'three';
import { mat, mesh, rbox, cyl, sphere, capsule, damp, clamp } from './util.js';

// Toy-style characters built from simple shapes. Each one has a small set of
// poses (idle, cheer, think, point, wave, oops) that blend smoothly.

const DARK = 0x2a2140;

function face(head, r, { lashes = false, glasses = false } = {}) {
  const eyeMat = mat(DARK, { roughness: 0.3 });
  const shine = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 });
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * r * 0.36, r * 0.08, r * 0.9);
    head.add(eye);
    const e = sphere(r * 0.15, eyeMat, { cast: false, parent: eye }, 16);
    e.scale.set(1, 1.25, 0.6);
    sphere(r * 0.05, shine, { x: r * 0.05, y: r * 0.07, z: r * 0.08, cast: false, parent: eye }, 8);
    if (lashes) {
      const lash = rbox(r * 0.1, r * 0.04, r * 0.04, r * 0.015, eyeMat, {
        x: sx * r * 0.14, y: r * 0.14, z: 0, rz: sx * -0.6, cast: false, parent: eye,
      });
      lash.scale.set(1, 1, 1);
    }
    eyes.push(eye);
    // brow
    rbox(r * 0.26, r * 0.055, r * 0.05, r * 0.025, eyeMat, {
      x: sx * r * 0.36, y: r * 0.36, z: r * 0.9, rz: sx * -0.12, cast: false, parent: head,
    });
  }
  // nose + cheeks
  sphere(r * 0.08, head.userData.skin, { y: -r * 0.06, z: r * 0.98, cast: false, parent: head }, 12);
  const blush = mat(0xff8f9a, { transparent: true, opacity: 0.55, roughness: 0.9 });
  for (const sx of [-1, 1]) {
    const c = sphere(r * 0.12, blush, { x: sx * r * 0.58, y: -r * 0.14, z: r * 0.76, cast: false, parent: head }, 12);
    c.scale.set(1, 0.6, 0.35);
  }
  // smile (closed) + open mouth for talking
  const smile = mesh(new THREE.TorusGeometry(r * 0.17, r * 0.035, 8, 20, Math.PI), eyeMat, {
    y: -r * 0.24, z: r * 0.92, rz: Math.PI, cast: false, parent: head,
  });
  smile.rotation.x = -0.25;
  const mouth = sphere(r * 0.13, mat(0x7a2b3a), { y: -r * 0.3, z: r * 0.9, cast: false, parent: head }, 14);
  mouth.scale.set(1, 0.01, 0.4);
  mouth.visible = false;

  if (glasses) {
    const frame = mat(0x6b3fa0, { roughness: 0.3 });
    for (const sx of [-1, 1]) {
      mesh(new THREE.TorusGeometry(r * 0.2, r * 0.03, 8, 24), frame, {
        x: sx * r * 0.36, y: r * 0.08, z: r * 0.98, cast: false, parent: head,
      });
    }
    rbox(r * 0.2, r * 0.035, r * 0.035, r * 0.01, frame, { y: r * 0.12, z: r * 1.0, cast: false, parent: head });
  }
  return { eyes, smile, mouth };
}

function hairCap(r, color, tilt = 0.5) {
  const m = mesh(new THREE.SphereGeometry(r * 1.07, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(color, { roughness: 0.65 }), {});
  m.rotation.x = -tilt;
  m.position.set(0, r * 0.04, -r * 0.06);
  return m;
}

function buildHair(head, r, style, color) {
  const hm = mat(color, { roughness: 0.65 });
  head.add(hairCap(r, color));
  if (style === 'boy') {
    // spiky fringe
    for (let i = 0; i < 6; i++) {
      const a = -0.9 + i * 0.36;
      const s = sphere(r * 0.24, hm, { x: Math.sin(a) * r * 0.8, y: r * 0.5, z: Math.cos(a) * r * 0.8, parent: head }, 12);
      s.scale.set(1, 0.7, 0.9);
    }
    const tuft = mesh(new THREE.ConeGeometry(r * 0.15, r * 0.4, 8), hm, { y: r * 1.1, z: r * 0.1, rx: 0.3, rz: -0.25, parent: head });
    tuft.castShadow = true;
  } else if (style === 'girl') {
    // fringe + two big pigtails with bobbles
    for (let i = 0; i < 5; i++) {
      const a = -0.7 + i * 0.35;
      const s = sphere(r * 0.24, hm, { x: Math.sin(a) * r * 0.8, y: r * 0.52, z: Math.cos(a) * r * 0.8, parent: head }, 12);
      s.scale.set(1.1, 0.6, 0.8);
    }
    const tie = mat(0xffc233, { physical: true });
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(sx * r * 0.95, r * 0.15, -r * 0.2);
      head.add(g);
      sphere(r * 0.13, tie, { parent: g }, 12);
      const tail = sphere(r * 0.32, hm, { x: sx * r * 0.22, y: -r * 0.35, parent: g }, 16);
      tail.scale.set(0.85, 1.25, 0.85);
      const tip = sphere(r * 0.2, hm, { x: sx * r * 0.3, y: -r * 0.8, parent: g }, 12);
      tip.scale.set(0.8, 1.2, 0.8);
      head.userData['tail' + sx] = g;
    }
  } else if (style === 'teacher') {
    // side-swept fringe and a bun
    const fr = sphere(r * 0.5, hm, { x: -r * 0.32, y: r * 0.55, z: r * 0.5, parent: head }, 16);
    fr.scale.set(1.2, 0.45, 0.6);
    fr.rotation.z = 0.35;
    sphere(r * 0.36, hm, { y: r * 0.82, z: -r * 0.55, parent: head }, 18);
    mesh(new THREE.TorusGeometry(r * 0.3, r * 0.06, 8, 20), mat(0xff4fa0), { y: r * 0.72, z: -r * 0.42, rx: 1.0, parent: head });
    // hair down the back
    const back = sphere(r * 0.95, hm, { y: -r * 0.12, z: -r * 0.25, parent: head }, 20);
    back.scale.set(1.1, 1.05, 0.9);
  }
}

export function makeCharacter(o) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs and jumps
  root.add(body);

  const skin = mat(o.skin, { roughness: 0.6 });
  const top = mat(o.top, { roughness: 0.7 });
  const bottom = mat(o.bottom, { roughness: 0.75 });
  const shoes = mat(o.shoes ?? 0x3a3550, { roughness: 0.5 });

  const legLen = o.legLen;
  const torsoLen = o.torsoLen;
  const hipW = o.hipW ?? 0.1;

  // legs
  const legs = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * hipW, legLen, 0);
    body.add(pivot);
    capsule(0.075, legLen - 0.17, o.bareLegs ? skin : bottom, { y: -(legLen) / 2 + 0.02, parent: pivot });
    if (o.socks) cyl(0.08, 0.08, 0.1, mat(0xffffff), { y: -legLen + 0.15, parent: pivot }, 12);
    rbox(0.16, 0.1, 0.26, 0.04, shoes, { y: -legLen + 0.05, z: 0.04, parent: pivot });
    legs.push(pivot);
  }

  // torso
  const torso = new THREE.Group();
  torso.position.y = legLen;
  body.add(torso);
  const chest = capsule(0.2, torsoLen - 0.3, top, { y: torsoLen / 2 + 0.02, parent: torso });
  chest.scale.set(1.05, 1, 0.78);
  if (o.shorts) {
    const s = cyl(0.21, 0.23, 0.2, bottom, { y: 0.0, parent: torso });
    s.scale.z = 0.8;
  }
  if (o.skirt) {
    const s = cyl(0.2, 0.34, 0.32, bottom, { y: -0.06, parent: torso }, 28);
    s.scale.z = 0.85;
  }
  if (o.coat) {
    const coat = cyl(0.215, 0.34, torsoLen + 0.42, mat(0xffffff, { roughness: 0.6 }), { y: torsoLen / 2 - 0.2, parent: torso }, 28);
    coat.scale.z = 0.8;
    // blouse showing at the front + pocket + collar
    const v = rbox(0.14, torsoLen * 0.5, 0.04, 0.02, top, { y: torsoLen * 0.7, z: 0.165, parent: torso });
    v.rotation.x = -0.15;
    rbox(0.12, 0.1, 0.02, 0.01, mat(0xe9eef5), { x: -0.12, y: torsoLen * 0.55, z: 0.18, rx: -0.12, parent: torso });
    cyl(0.008, 0.008, 0.08, mat(0xff4fa0), { x: -0.1, y: torsoLen * 0.6, z: 0.19, parent: torso }, 6);
    cyl(0.008, 0.008, 0.08, mat(0x3b82f6), { x: -0.13, y: torsoLen * 0.6, z: 0.19, parent: torso }, 6);
  }
  if (o.collar) {
    for (const sx of [-1, 1]) {
      rbox(0.12, 0.03, 0.08, 0.01, mat(0xffffff), { x: sx * 0.06, y: torsoLen - 0.02, z: 0.12, rz: sx * 0.35, rx: -0.4, parent: torso });
    }
  }
  if (o.tie) rbox(0.05, 0.2, 0.02, 0.01, mat(o.tie), { y: torsoLen - 0.16, z: 0.165, rx: -0.1, parent: torso });
  if (o.badge) sphere(0.035, mat(o.badge, { physical: true }), { x: 0.1, y: torsoLen * 0.7, z: 0.155, parent: torso }, 10);

  // arms
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.25, torsoLen - 0.04, 0);
    torso.add(pivot);
    const sleeve = o.coat ? mat(0xffffff, { roughness: 0.6 }) : top;
    capsule(0.065, 0.22, sleeve, { y: -0.16, parent: pivot });
    capsule(0.055, 0.12, o.coat || o.longSleeves ? sleeve : skin, { y: -0.34, parent: pivot });
    sphere(0.07, skin, { y: -0.46, parent: pivot }, 14);
    arms.push(pivot);
  }

  // neck + head
  cyl(0.06, 0.07, 0.1, skin, { y: torsoLen + 0.02, parent: torso }, 12);
  const headPivot = new THREE.Group();
  headPivot.position.y = torsoLen + 0.06;
  torso.add(headPivot);
  const head = new THREE.Group();
  const r = o.headR;
  head.position.y = r * 0.95;
  headPivot.add(head);
  head.userData.skin = skin;
  sphere(r, skin, { parent: head }, 32);
  for (const sx of [-1, 1]) sphere(r * 0.2, skin, { x: sx * r * 0.98, y: -r * 0.02, parent: head }, 12);
  const f = face(head, r, { lashes: o.lashes, glasses: o.glasses });
  buildHair(head, r, o.hair, o.hairColor);

  // turn marker: ring on the floor + bobbing arrow overhead
  let marker = null;
  if (o.markerColor) {
    marker = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: o.markerColor, transparent: true, opacity: 0.85, toneMapped: false });
    const ring = mesh(new THREE.RingGeometry(0.42, 0.52, 48), ringMat, { rx: -Math.PI / 2, y: 0.02, cast: false, receive: false });
    marker.add(ring);
    const arrow = new THREE.Group();
    const arrowMat = mat(o.markerColor, { emissive: o.markerColor, emissiveIntensity: 0.5 });
    mesh(new THREE.ConeGeometry(0.11, 0.2, 4), arrowMat, { rx: Math.PI, parent: arrow });
    mesh(new THREE.BoxGeometry(0.07, 0.14, 0.07), arrowMat, { y: 0.15, parent: arrow });
    arrow.position.y = legLen + torsoLen + r * 2 + 0.45;
    marker.add(arrow);
    marker.userData = { ring, arrow };
    marker.visible = false;
    root.add(marker);
  }

  const state = {
    pose: 'idle',
    poseUntil: 0,
    talkingUntil: 0,
    blinkAt: 1 + Math.random() * 3,
    lookAt: null,
    baseYaw: 0,
    jump: 0,
    seed: Math.random() * 10,
  };

  const ch = {
    root, body, torso, head, headPivot, arms, legs, marker,
    worldHead: new THREE.Vector3(),

    setPose(pose, seconds = 0) {
      state.pose = pose;
      state.poseUntil = seconds ? performance.now() / 1000 + seconds : 0;
    },
    talk(seconds) { state.talkingUntil = performance.now() / 1000 + seconds; },
    stopTalking() { state.talkingUntil = 0; },
    lookAt(v) { state.lookAt = v ? v.clone() : null; },
    face(x, z) {
      state.baseYaw = Math.atan2(x - root.position.x, z - root.position.z);
      root.rotation.y = state.baseYaw;
    },
    setActive(on) { if (marker) marker.visible = on; },

    update(dt, t) {
      const now = performance.now() / 1000;
      if (state.poseUntil && now > state.poseUntil) { state.pose = 'idle'; state.poseUntil = 0; }
      const p = state.pose;
      const tt = t + state.seed;

      // targets: [rx, rz] for arm -1 and arm +1
      let a0x = 0, a0z = -0.12, a1x = 0, a1z = 0.12;
      let headTilt = 0, lean = 0, jumpH = 0;
      const breathe = Math.sin(tt * 2.1) * 0.012;

      switch (p) {
        case 'cheer':
          a0z = -2.7 + Math.sin(tt * 14) * 0.15;
          a1z = 2.7 - Math.sin(tt * 14) * 0.15;
          jumpH = Math.abs(Math.sin(tt * 9)) * 0.16;
          break;
        case 'clap': {
          const c = Math.sin(tt * 16) * 0.25;
          a0x = -1.25; a1x = -1.25; a0z = 0.35 + c; a1z = -0.35 - c;
          jumpH = Math.abs(Math.sin(tt * 8)) * 0.05;
          break;
        }
        case 'wave':
          a1z = 2.5 + Math.sin(tt * 9) * 0.35; a1x = -0.2;
          headTilt = Math.sin(tt * 3) * 0.08;
          break;
        case 'point':
          a0x = -1.1; a0z = -0.8;
          lean = 0.06;
          break;
        case 'think':
          a1x = -2.2; a1z = -0.5;
          headTilt = 0.18;
          break;
        case 'oops':
          a1x = -0.6; a1z = 2.6 + Math.sin(tt * 12) * 0.12;
          headTilt = -0.2 + Math.sin(tt * 3) * 0.05;
          break;
        case 'reach':
          a1x = -1.6 + Math.sin(tt * 4) * 0.08; a1z = 0.15;
          lean = 0.1;
          break;
        case 'explain':
          a0x = -0.9 + Math.sin(tt * 2.6) * 0.25; a0z = -0.4;
          a1x = -0.7 + Math.sin(tt * 2.2 + 1) * 0.25; a1z = 0.4;
          break;
        default:
          a0z += Math.sin(tt * 1.3) * 0.03;
          a1z -= Math.sin(tt * 1.3) * 0.03;
      }

      const k = 10;
      const [A0, A1] = arms;
      A0.rotation.x = damp(A0.rotation.x, a0x, k, dt);
      A0.rotation.z = damp(A0.rotation.z, a0z, k, dt);
      A1.rotation.x = damp(A1.rotation.x, a1x, k, dt);
      A1.rotation.z = damp(A1.rotation.z, a1z, k, dt);

      state.jump = damp(state.jump, jumpH, 18, dt);
      body.position.y = state.jump + breathe * 0.5;
      torso.scale.set(1, 1 + breathe, 1);
      torso.rotation.x = damp(torso.rotation.x, lean, 6, dt);

      // head looks toward a point in the world (clamped so it never spins)
      let yaw = 0, pitch = 0;
      if (state.lookAt) {
        head.getWorldPosition(ch.worldHead);
        const dx = state.lookAt.x - ch.worldHead.x;
        const dy = state.lookAt.y - ch.worldHead.y;
        const dz = state.lookAt.z - ch.worldHead.z;
        yaw = Math.atan2(dx, dz) - root.rotation.y;
        yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        pitch = -Math.atan2(dy, Math.hypot(dx, dz));
        yaw = clamp(yaw, -1.0, 1.0);
        pitch = clamp(pitch, -0.5, 0.45);
      }
      headPivot.rotation.y = damp(headPivot.rotation.y, yaw, 6, dt);
      headPivot.rotation.x = damp(headPivot.rotation.x, pitch, 6, dt);
      headPivot.rotation.z = damp(headPivot.rotation.z, headTilt, 6, dt);

      // pigtails swing a little
      for (const sx of [-1, 1]) {
        const tail = head.userData['tail' + sx];
        if (tail) tail.rotation.z = Math.sin(tt * 3 + sx) * 0.08 + state.jump * sx * 1.5;
      }

      // blinking
      if (now > state.blinkAt) state.blinkAt = now + 2 + Math.random() * 3.5;
      const blinkPhase = state.blinkAt - now;
      const closed = blinkPhase > 0 && blinkPhase < 0.13 ? 0.1 : 1;
      for (const e of f.eyes) e.scale.y = damp(e.scale.y, closed, 40, dt);

      // talking mouth
      const talking = now < state.talkingUntil;
      f.mouth.visible = talking;
      f.smile.visible = !talking;
      if (talking) f.mouth.scale.y = 0.35 + Math.abs(Math.sin(now * 13)) * 0.6 * (0.6 + 0.4 * Math.sin(now * 5));

      // marker animation
      if (marker && marker.visible) {
        marker.userData.arrow.position.y += Math.sin(t * 4) * 0.002;
        marker.userData.arrow.rotation.y += dt * 2;
        const s = 1 + Math.sin(t * 4) * 0.06;
        marker.userData.ring.scale.set(s, s, s);
      }

      head.getWorldPosition(ch.worldHead);
    },
  };

  return ch;
}

export function buildCast(scene) {
  const teacher = makeCharacter({
    skin: 0xc98b62, top: 0x9b4dca, bottom: 0x3a3550, shoes: 0x7a2b3a,
    legLen: 0.86, torsoLen: 0.62, hipW: 0.1, headR: 0.25,
    coat: true, hair: 'teacher', hairColor: 0x3b2418, glasses: true, lashes: true,
  });
  teacher.root.position.set(1.3, 0, -1.35);
  teacher.face(0.2, 2);

  const boy = makeCharacter({
    skin: 0xf2c29b, top: 0x1fa3ff, bottom: 0x2f3b63, shoes: 0x2a2140,
    legLen: 0.6, torsoLen: 0.5, hipW: 0.095, headR: 0.27,
    hair: 'boy', hairColor: 0x5a3720, collar: true, tie: 0xff5a5f, shorts: false,
    markerColor: 0x1fa3ff,
  });
  boy.root.position.set(-2.1, 0, 0.35);
  boy.face(0, 1.2);

  const girl = makeCharacter({
    skin: 0x9c6644, top: 0xff4fa0, bottom: 0x2f3b63, shoes: 0x2a2140,
    legLen: 0.6, torsoLen: 0.5, hipW: 0.09, headR: 0.27,
    hair: 'girl', hairColor: 0x1d1412, collar: true, skirt: true, bareLegs: true, socks: true,
    lashes: true, badge: 0xffc233,
    markerColor: 0xff4fa0,
  });
  girl.root.position.set(2.1, 0, 0.35);
  girl.face(0, 1.2);

  scene.add(teacher.root, boy.root, girl.root);
  return { teacher, boy, girl };
}
