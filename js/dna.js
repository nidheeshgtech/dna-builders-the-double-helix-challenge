import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, mesh, rbox, canvasTexture, lerp } from './util.js';
import { TABLE_Y } from './classroom.js';

export const BASES = {
  A: { color: '#ff5a5f', name: 'Adenine', partner: 'T', ink: '#ffffff' },
  T: { color: '#ffc233', name: 'Thymine', partner: 'A', ink: '#2a2140' },
  G: { color: '#3b82f6', name: 'Guanine', partner: 'C', ink: '#ffffff' },
  C: { color: '#1fbf9a', name: 'Cytosine', partner: 'G', ink: '#ffffff' },
  U: { color: '#a066ff', name: 'Uracil', partner: null, ink: '#ffffff' },
};
export const LETTERS = ['A', 'T', 'G', 'C', 'U'];
// hydrogen bonds holding each pair together
export const BONDS = { A: 2, T: 2, G: 3, C: 3 };

export const RUNGS = 8;
export const FRAME_Z = -0.15;
export const SPACING = 0.245;
export const RUNG_Y0 = TABLE_Y + 0.36;
const BLOCK = { len: 0.38, h: 0.2, d: 0.2 };
const GAP = 0.05;               // half the gap between the two blocks of a rung
export const SLOT_X = GAP + BLOCK.len / 2;
const RAIL_X = GAP + BLOCK.len + 0.07;
const TWIST = 0.74;             // radians per rung once the ladder becomes a helix

export const rungY = i => RUNG_Y0 + i * SPACING;

// ------------------------------------------------------------- textures
const labelCache = {};
function labelTexture(letter) {
  if (labelCache[letter]) return labelCache[letter];
  const b = BASES[letter];
  const tex = canvasTexture(512, 270, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.font = '800 200px "Baloo 2", "Arial Rounded MT Bold", sans-serif';
    g.lineJoin = 'round';
    g.lineWidth = 16;
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.strokeText(letter, w / 2, 196);
    g.fillStyle = b.ink;
    g.fillText(letter, w / 2, 190);
    g.font = '700 40px "Nunito", sans-serif';
    g.globalAlpha = 0.85;
    g.fillText(b.name.toUpperCase(), w / 2, 248);
  });
  labelCache[letter] = tex;
  return tex;
}

let haloTex = null;
function getHaloTexture() {
  if (haloTex) return haloTex;
  haloTex = canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  return haloTex;
}

// ------------------------------------------------------------- blocks
const blockGeo = new RoundedBoxGeometry(BLOCK.len, BLOCK.h, BLOCK.d, 4, 0.05);
const decalGeo = new THREE.PlaneGeometry(BLOCK.len * 0.92, BLOCK.h * 0.97);

export function makeBlock(letter) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: BASES[letter].color, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25,
    emissive: 0x000000,
  });
  const body = mesh(blockGeo, bodyMat, { parent: g });
  const decalMat = new THREE.MeshStandardMaterial({ map: labelTexture(letter), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  mesh(decalGeo, decalMat, { z: BLOCK.d / 2 + 0.002, cast: false, parent: g });
  mesh(decalGeo, decalMat, { z: -BLOCK.d / 2 - 0.002, ry: Math.PI, cast: false, parent: g });
  // the top face shows the letter too, for steep camera angles
  const top = mesh(decalGeo, decalMat, { y: BLOCK.h / 2 + 0.002, rx: -Math.PI / 2, cast: false, parent: g });
  top.scale.set(1, BLOCK.d / BLOCK.h * 0.95, 1);
  g.userData = { letter, body, bodyMat, isBlock: true };
  body.userData.block = g;
  return g;
}

export function setGlow(block, color, intensity) {
  const m = block.userData.bodyMat;
  m.emissive.set(color);
  m.emissiveIntensity = intensity;
}

// ------------------------------------------------------------- ladder
export class Ladder {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();       // stays on the table (stand)
    this.group = new THREE.Group();      // lifts + spins in the finale
    this.root.position.set(0, 0, FRAME_Z);
    this.root.add(this.group);
    scene.add(this.root);

    this.twistT = 0;
    this.spin = 0;
    this.rungs = [];

    this.buildStand();
    this.buildRails();
    this.buildRungs();

    // soft coloured glow behind whichever slot is waiting for a block
    this.activeGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getHaloTexture(), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.activeGlow.scale.set(0.9, 0.55, 1);
    this.group.add(this.activeGlow);
  }

  buildStand() {
    const plateTex = canvasTexture(1024, 128, (g, w, h) => {
      g.fillStyle = '#2a2140'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff';
      g.font = '800 72px "Baloo 2", sans-serif';
      g.textAlign = 'center';
      g.fillText('DNA  BUILDER', w / 2, 92);
      const cols = ['#ff5a5f', '#ffc233', '#3b82f6', '#1fbf9a'];
      cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 4, h - 12, w / 4, 12); });
    });
    this.stand = new THREE.Group();
    this.root.add(this.stand);
    rbox(1.5, 0.08, 0.6, 0.03, mat(0x2a2140, { roughness: 0.4 }), { y: TABLE_Y + 0.04, parent: this.stand });
    mesh(new THREE.PlaneGeometry(1.0, 0.0625), mat(0xffffff, { map: plateTex, roughness: 0.4 }), {
      y: TABLE_Y + 0.04, z: 0.302, cast: false, parent: this.stand,
    });
    // clear acrylic posts that hold the ladder upright
    const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0, clearcoat: 1 });
    this.posts = new THREE.Group();
    this.stand.add(this.posts);
    const top = rungY(RUNGS - 1) + 0.25;
    for (const sx of [-1, 1]) {
      rbox(0.06, top - TABLE_Y, 0.06, 0.02, acrylic, { x: sx * (RAIL_X + 0.12), y: (top + TABLE_Y) / 2, cast: false, parent: this.posts });
    }
    rbox(2 * (RAIL_X + 0.12) + 0.06, 0.06, 0.06, 0.02, acrylic, { y: top, cast: false, parent: this.posts });
  }

  buildRails() {
    this.railMat = new THREE.MeshPhysicalMaterial({ color: 0xf2e6ff, roughness: 0.3, clearcoat: 0.7 });
    this.rails = [null, null];
    this.beadMat = mat(0xff8a3d, { physical: true, unique: true });
    this.sugarMat = mat(0xbca4ff, { physical: true, unique: true });
    const beadGeo = new THREE.SphereGeometry(0.065, 18, 12);
    const sugarGeo = new THREE.DodecahedronGeometry(0.075, 0);
    this.beads = [[], []];
    for (let s = 0; s < 2; s++) {
      for (let k = 0; k <= RUNGS * 2; k++) {
        const isSugar = k % 2 === 1;   // sugars sit level with each base, phosphates between
        const b = new THREE.Mesh(isSugar ? sugarGeo : beadGeo, isSugar ? this.sugarMat : this.beadMat);
        b.castShadow = true;
        b.userData.k = k;
        this.group.add(b);
        this.beads[s].push(b);
      }
    }
    this.updateRails();
  }

  // angle of the backbone at a given height, for twist amount t (0..1)
  angleAt(y, t) {
    const mid = (rungY(0) + rungY(RUNGS - 1)) / 2;
    return t * TWIST * (y - mid) / SPACING + this.spin;
  }

  railPoint(side, y, t, target = new THREE.Vector3()) {
    const a = this.angleAt(y, t);
    const sx = side === 0 ? -1 : 1;
    // rotate (sx*R, 0) around the y axis by a
    target.set(sx * RAIL_X * Math.cos(a), y, -sx * RAIL_X * Math.sin(a));
    return target;
  }

  updateRails() {
    const t = this.twistT;
    const y0 = rungY(0) - SPACING * 0.75;
    const y1 = rungY(RUNGS - 1) + SPACING * 0.75;
    for (let s = 0; s < 2; s++) {
      const pts = [];
      const n = 48;
      for (let k = 0; k <= n; k++) pts.push(this.railPoint(s, lerp(y0, y1, k / n), t));
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 160, 0.038, 10, false);
      if (this.rails[s]) {
        this.rails[s].geometry.dispose();
        this.rails[s].geometry = geo;
      } else {
        this.rails[s] = mesh(geo, this.railMat, { parent: this.group });
      }
      for (const b of this.beads[s]) {
        const y = rungY(0) + (b.userData.k - 1) * SPACING / 2;
        this.railPoint(s, y, t, b.position);
        b.rotation.y = this.angleAt(y, t);
      }
    }
    for (let i = 0; i < this.rungs.length; i++) {
      this.rungs[i].group.rotation.y = this.angleAt(rungY(i), t);
    }
  }

  buildRungs() {
    const ghostGeo = new THREE.BoxGeometry(BLOCK.len, BLOCK.h, BLOCK.d);
    const edgeGeo = new THREE.EdgesGeometry(ghostGeo);
    const shellGeo = new RoundedBoxGeometry(2 * (GAP + BLOCK.len) + 0.07, BLOCK.h + 0.07, BLOCK.d + 0.07, 3, 0.06);
    for (let i = 0; i < RUNGS; i++) {
      const group = new THREE.Group();
      group.position.y = rungY(i);
      this.group.add(group);
      const slots = [-1, 1].map(sx => {
        const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false });
        const lineMat = new THREE.LineBasicMaterial({ color: 0x2a2140, transparent: true, opacity: 0.35 });
        const ghost = new THREE.Mesh(ghostGeo, ghostMat);
        ghost.position.x = sx * SLOT_X;
        ghost.add(new THREE.LineSegments(edgeGeo, lineMat));
        ghost.userData = { ghostMat, lineMat };
        group.add(ghost);
        return { ghost, block: null, x: sx * SLOT_X };
      });

      // hydrogen bonds (shown once a pair is correct)
      const bonds = new THREE.Group();
      const bondMat = new THREE.MeshBasicMaterial({ color: 0xeaffd0, toneMapped: false });
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, GAP * 2 - 0.01, 4, 8), bondMat);
        b.rotation.z = Math.PI / 2;
        bonds.add(b);
      }
      bonds.visible = false;
      group.add(bonds);

      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getHaloTexture(), color: 0x3ee84a, transparent: true, opacity: 0,
        depthWrite: false, toneMapped: false,
      }));
      halo.scale.set(1.4, 0.7, 1);
      halo.position.z = -0.16;
      group.add(halo);

      // glowing green rim drawn around the whole pair (back faces of a bigger box)
      const shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
        color: 0x3ee84a, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
      }));
      shell.visible = false;
      group.add(shell);

      this.rungs.push({ group, slots, bonds, halo, shell, active: null });
    }
  }

  clear() {
    for (const r of this.rungs) {
      for (const s of r.slots) {
        if (s.block) { s.block.parent?.remove(s.block); s.block = null; }
        s.ghost.visible = true;
        s.ghost.userData.ghostMat.color.set(0xffffff);
        s.ghost.userData.ghostMat.opacity = 0.12;
        s.ghost.userData.lineMat.color.set(0x2a2140);
        s.ghost.userData.lineMat.opacity = 0.35;
      }
      r.bonds.visible = false;
      r.halo.material.opacity = 0;
      r.shell.visible = false;
      r.active = null;
    }
    this.twistT = 0;
    this.spin = 0;
    this.group.position.y = 0;
    this.group.rotation.y = 0;
    this.posts.visible = true;
    this.posts.scale.set(1, 1, 1);
    this.updateRails();
  }

  // world position of a slot (used for drag targets and fly-in tweens)
  slotWorld(i, side, target = new THREE.Vector3()) {
    return this.rungs[i].slots[side].ghost.getWorldPosition(target);
  }

  // put a block into a slot (block keeps its world transform until tweened)
  attach(block, i, side) {
    const slot = this.rungs[i].slots[side];
    slot.block = block;
    this.rungs[i].group.attach(block);
    slot.ghost.visible = false;
  }

  detach(i, side) {
    const slot = this.rungs[i].slots[side];
    const b = slot.block;
    slot.block = null;
    slot.ghost.visible = true;
    if (b) this.scene.attach(b);
    return b;
  }

  setActive(i, side, color) {
    for (const r of this.rungs) r.active = null;
    if (i == null) return;
    this.rungs[i].active = { side, color: new THREE.Color(color) };
  }

  showBonds(i, letter) {
    const r = this.rungs[i];
    const n = BONDS[letter] || 2;
    r.bonds.children.forEach((b, k) => {
      b.visible = k < n;
      b.position.y = (k - (n - 1) / 2) * 0.055;
    });
    r.bonds.visible = true;
  }

  update(dt, t) {
    let glowOn = false;
    for (const r of this.rungs) {
      r.slots.forEach((s, side) => {
        const gm = s.ghost.userData.ghostMat;
        const lm = s.ghost.userData.lineMat;
        if (r.active && r.active.side === side && !s.block) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 5);
          gm.color.copy(r.active.color);
          gm.opacity = 0.35 + pulse * 0.35;
          lm.color.copy(r.active.color);
          lm.opacity = 1;
          s.ghost.scale.setScalar(1 + pulse * 0.05);
          glowOn = true;
          this.activeGlow.position.set(s.x, r.group.position.y, -0.12);
          this.activeGlow.material.color.copy(r.active.color);
          this.activeGlow.material.opacity = 0.55 + pulse * 0.45;
        } else {
          gm.color.set(0xffffff);
          gm.opacity = 0.1;
          lm.color.set(0x2a2140);
          lm.opacity = 0.3;
          s.ghost.scale.setScalar(1);
        }
      });
    }
    if (!glowOn) this.activeGlow.material.opacity = 0;
  }
}

// ------------------------------------------------------------- tray
export const TRAY_Z = 0.5;
const TRAY_SPACING = 0.5;

export class Tray {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, TABLE_Y, TRAY_Z);
    scene.add(this.group);
    this.sources = {};
    this.bins = {};
    this.highlighted = null;

    LETTERS.forEach((L, i) => {
      const x = (i - 2) * TRAY_SPACING;
      const bin = new THREE.Group();
      bin.position.x = x;
      this.group.add(bin);
      const isU = L === 'U';
      const binMat = mat(isU ? 0xe9dcff : 0xffffff, { roughness: 0.5 });
      rbox(0.46, 0.04, 0.3, 0.015, binMat, { y: 0.02, parent: bin });
      rbox(0.46, 0.08, 0.025, 0.01, binMat, { y: 0.06, z: 0.14, parent: bin });
      rbox(0.46, 0.08, 0.025, 0.01, binMat, { y: 0.06, z: -0.14, parent: bin });
      // coloured strip on the front lip
      rbox(0.44, 0.02, 0.01, 0.005, mat(BASES[L].color), { y: 0.085, z: 0.155, cast: false, parent: bin });

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getHaloTexture(), color: BASES[L].color, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      glow.scale.set(0.9, 0.6, 1);
      glow.position.set(0, 0.16, -0.12);
      bin.add(glow);

      const block = makeBlock(L);
      block.position.y = 0.16;
      block.userData.source = true;
      bin.add(block);
      this.sources[L] = block;
      this.bins[L] = { bin, glow, base: 0.16 };
    });

    // small "RNA only" tag in front of the U bin
    const tagTex = canvasTexture(256, 64, (g, w, h) => {
      g.fillStyle = '#a066ff';
      g.beginPath(); g.roundRect(0, 0, w, h, 18); g.fill();
      g.fillStyle = '#fff';
      g.font = '800 38px "Baloo 2", sans-serif';
      g.textAlign = 'center';
      g.fillText('RNA only', w / 2, 46);
    });
    mesh(new THREE.PlaneGeometry(0.34, 0.085), new THREE.MeshBasicMaterial({ map: tagTex, transparent: true }), {
      x: 2 * TRAY_SPACING, y: 0.05, z: 0.2, rx: -0.5, cast: false, parent: this.group,
    });
  }

  sourceWorld(L, target = new THREE.Vector3()) {
    return this.sources[L].getWorldPosition(target);
  }

  highlight(L) { this.highlighted = L; }

  pickables() { return LETTERS.map(L => this.sources[L].userData.body); }

  update(dt, t) {
    LETTERS.forEach((L, i) => {
      const { glow, base } = this.bins[L];
      const src = this.sources[L];
      const lit = this.highlighted === L;
      const hover = src.userData.hover ? 1 : 0;
      src.position.y = base + Math.sin(t * 2 + i) * 0.012 + hover * 0.05 + (lit ? Math.abs(Math.sin(t * 6)) * 0.08 : 0);
      src.rotation.y = Math.sin(t * 1.2 + i) * 0.08;
      const target = lit ? 0.9 : hover * 0.45;
      glow.material.opacity += (target - glow.material.opacity) * Math.min(1, dt * 8);
      const s = 1 + hover * 0.08;
      src.scale.setScalar(s);
    });
  }
}

// ------------------------------------------------------------- confetti
export class Confetti {
  constructor(scene, count = 260) {
    this.count = count;
    const geo = new THREE.PlaneGeometry(0.06, 0.1);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, material, count);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    const cols = ['#ff5a5f', '#ffc233', '#3b82f6', '#1fbf9a', '#ff4fa0', '#ffffff'].map(c => new THREE.Color(c));
    this.p = [];
    for (let i = 0; i < count; i++) {
      this.mesh.setColorAt(i, cols[i % cols.length]);
      this.p.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3() });
    }
    this.dummy = new THREE.Object3D();
    this.active = false;
  }

  burst(origin) {
    this.mesh.visible = true;
    this.active = true;
    for (const q of this.p) {
      q.pos.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.4, (Math.random() - 0.5) * 0.6));
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3;
      q.vel.set(Math.cos(a) * sp, 3 + Math.random() * 4, Math.sin(a) * sp * 0.6 + 0.8);
      q.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      q.spin.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
    }
  }

  stop() { this.active = false; this.mesh.visible = false; }

  update(dt) {
    if (!this.active) return;
    let alive = 0;
    this.p.forEach((q, i) => {
      q.vel.y -= 6 * dt;
      q.vel.multiplyScalar(1 - 1.6 * dt);
      q.vel.y = Math.max(q.vel.y, -1.2);
      q.pos.addScaledVector(q.vel, dt);
      if (q.pos.y < 0.01) { q.pos.y = 0.01; q.vel.set(0, 0, 0); q.spin.set(0, 0, 0); q.rot.x = -Math.PI / 2; }
      else alive++;
      q.rot.x += q.spin.x * dt; q.rot.y += q.spin.y * dt; q.rot.z += q.spin.z * dt;
      this.dummy.position.copy(q.pos);
      this.dummy.rotation.copy(q.rot);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!alive) this.active = false;
  }
}
