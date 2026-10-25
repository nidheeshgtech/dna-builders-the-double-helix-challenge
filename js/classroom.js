import * as THREE from 'three';
import { mat, mesh, box, rbox, cyl, sphere, canvasTexture, rng } from './util.js';

export const TABLE_Y = 0.82; // top surface of the lab table

const ROOM = { w: 15, d: 11, h: 5.2, back: -5, left: -7.5, right: 7.5 };

export function buildClassroom(scene) {
  const room = new THREE.Group();
  scene.add(room);

  buildShell(room);
  buildBlackboard(room);
  buildWindows(room);
  const clock = buildClock(room);
  buildPosters(room);
  buildShelf(room);
  buildDesks(room);
  buildPlants(room);
  buildLabTable(room);
  buildLights(scene);

  return {
    update() {
      const now = new Date();
      const s = now.getSeconds() + now.getMilliseconds() / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;
      clock.hour.rotation.z = -h / 12 * Math.PI * 2;
      clock.minute.rotation.z = -m / 60 * Math.PI * 2;
      clock.second.rotation.z = -Math.floor(s) / 60 * Math.PI * 2;
    },
  };
}

// ---------------------------------------------------------------- room shell
function buildShell(room) {
  const r = rng(11);
  const floorTex = canvasTexture(1024, 1024, (g, w, h) => {
    const rows = 8;
    const rh = h / rows;
    const tones = ['#d9a86c', '#cf9b5f', '#e0b47a', '#c98f54', '#d6a467'];
    for (let y = 0; y < rows; y++) {
      let x = -r() * 300;
      while (x < w) {
        const len = 260 + r() * 260;
        g.fillStyle = tones[Math.floor(r() * tones.length)];
        g.fillRect(x, y * rh, len, rh);
        // grain
        g.strokeStyle = 'rgba(120, 72, 30, 0.12)';
        g.lineWidth = 2;
        for (let k = 0; k < 6; k++) {
          const gy = y * rh + 8 + r() * (rh - 16);
          g.beginPath();
          g.moveTo(x, gy);
          g.bezierCurveTo(x + len * 0.3, gy + r() * 6 - 3, x + len * 0.6, gy + r() * 6 - 3, x + len, gy);
          g.stroke();
        }
        g.fillStyle = 'rgba(90, 50, 20, 0.35)';
        g.fillRect(x, y * rh, 3, rh);
        x += len;
      }
      g.fillStyle = 'rgba(90, 50, 20, 0.4)';
      g.fillRect(0, y * rh, w, 3);
    }
  }, { repeat: [3, 2.2] });

  const floor = mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat(0xffffff, { map: floorTex, roughness: 0.55 }), {
    rx: -Math.PI / 2, z: ROOM.back + ROOM.d / 2, cast: false,
  });
  room.add(floor);

  // rug under the lab table
  const rugTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#4fb5a5'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff3d6'; g.lineWidth = 14;
    g.strokeRect(26, 26, w - 52, h - 52);
    g.strokeStyle = '#ffc233'; g.lineWidth = 6;
    g.strokeRect(50, 50, w - 100, h - 100);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
      g.beginPath(); g.arc(80 + i * 44, 80 + j * 44, 5, 0, Math.PI * 2); g.fill();
    }
  });
  const rug = mesh(new THREE.PlaneGeometry(6.6, 3.8), mat(0xffffff, { map: rugTex, roughness: 0.95 }), {
    rx: -Math.PI / 2, y: 0.005, z: 0.1, cast: false,
  });
  room.add(rug);

  const wallUpper = mat(0xfbe9cf, { roughness: 0.9 });
  const wallLower = mat(0x8fcfbf, { roughness: 0.85 });
  const trim = mat(0xb07a45, { roughness: 0.6 });
  const dado = 1.05;

  const walls = [
    { w: ROOM.w, pos: [0, 0, ROOM.back], ry: 0 },
    { w: ROOM.d, pos: [ROOM.left, 0, ROOM.back + ROOM.d / 2], ry: Math.PI / 2 },
    { w: ROOM.d, pos: [ROOM.right, 0, ROOM.back + ROOM.d / 2], ry: -Math.PI / 2 },
  ];
  for (const wl of walls) {
    const g = new THREE.Group();
    g.position.set(...wl.pos);
    g.rotation.y = wl.ry;
    mesh(new THREE.PlaneGeometry(wl.w, ROOM.h - dado), wallUpper, { y: dado + (ROOM.h - dado) / 2, cast: false, parent: g });
    mesh(new THREE.PlaneGeometry(wl.w, dado), wallLower, { y: dado / 2, cast: false, parent: g });
    box(wl.w, 0.07, 0.05, trim, { y: dado, z: 0.025, parent: g });
    box(wl.w, 0.14, 0.04, mat(0xf3dcb8), { y: 0.07, z: 0.02, parent: g });
    room.add(g);
  }

  const ceiling = mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat(0xfff7ea, { roughness: 1 }), {
    rx: Math.PI / 2, y: ROOM.h, z: ROOM.back + ROOM.d / 2, cast: false,
  });
  room.add(ceiling);
  const panelMat = mat(0xffffff, { emissive: 0xfff4dd, emissiveIntensity: 0.9 });
  for (const [x, z] of [[-3, -2.5], [3, -2.5], [-3, 1.5], [3, 1.5]]) {
    box(2.2, 0.04, 0.6, panelMat, { x, y: ROOM.h - 0.02, z, cast: false });
  }
}

// ---------------------------------------------------------------- blackboard
function buildBlackboard(room) {
  const W = 5.6, H = 2.1;
  const g = new THREE.Group();
  g.position.set(0, 2.75, ROOM.back + 0.06);
  room.add(g);

  const tex = canvasTexture(2048, 768, (c, w, h) => {
    // board surface with smudges
    c.fillStyle = '#2f5a46';
    c.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(255,255,255,${0.015 + r() * 0.03})`;
      c.beginPath();
      c.ellipse(r() * w, r() * h, 80 + r() * 200, 20 + r() * 50, r() * 3, 0, Math.PI * 2);
      c.fill();
    }

    const chalk = (text, x, y, size, color = 'rgba(244,241,230,0.92)', align = 'left') => {
      c.font = `${size}px "Patrick Hand", "Comic Sans MS", cursive`;
      c.textAlign = align;
      c.fillStyle = color;
      c.fillText(text, x, y);
      c.globalAlpha = 0.25;
      c.fillText(text, x + 1.5, y + 1);
      c.globalAlpha = 1;
    };

    chalk('Today: Building DNA!', 80, 120, 92);
    c.strokeStyle = 'rgba(244,241,230,0.8)';
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(80, 140); c.quadraticCurveTo(450, 155, 760, 138); c.stroke();

    // pairing rules with bond lines (2 for A-T, 3 for G-C)
    const pair = (a, b, bonds, y, ca, cb) => {
      chalk(a, 120, y, 120, ca);
      chalk(b, 400, y, 120, cb);
      c.strokeStyle = 'rgba(244,241,230,0.85)';
      c.lineWidth = 6;
      for (let i = 0; i < bonds; i++) {
        const yy = y - 52 + (i - (bonds - 1) / 2) * 18;
        c.setLineDash([16, 12]);
        c.beginPath(); c.moveTo(210, yy); c.lineTo(385, yy); c.stroke();
      }
      c.setLineDash([]);
    };
    pair('A', 'T', 2, 330, '#ff9a9d', '#ffe08a');
    pair('G', 'C', 3, 500, '#9cc4ff', '#8ef0d6');
    chalk('U → RNA only!', 110, 650, 72, '#e3c8ff');
    c.strokeStyle = '#e3c8ff';
    c.lineWidth = 4;
    c.beginPath(); c.ellipse(105, 628, 40, 46, 0, 0, Math.PI * 2); c.stroke();

    // helix doodle on the right
    const hx = 1640, top = 110, bottom = 700;
    c.lineWidth = 7;
    for (const phase of [0, Math.PI]) {
      c.strokeStyle = phase ? 'rgba(255,190,200,0.9)' : 'rgba(170,215,255,0.9)';
      c.beginPath();
      for (let y = top; y <= bottom; y += 4) {
        const x = hx + Math.sin((y - top) / 95 + phase) * 140;
        y === top ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
    }
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(244,241,230,0.6)';
    for (let y = top + 30; y < bottom; y += 46) {
      const a = Math.sin((y - top) / 95) * 140;
      c.beginPath(); c.moveTo(hx + a, y); c.lineTo(hx - a, y); c.stroke();
    }
    chalk('double helix', 1640, 750, 56, 'rgba(244,241,230,0.85)', 'center');
    chalk('Grade 7/8 · Science', 1980, 70, 44, 'rgba(244,241,230,0.6)', 'right');
  });

  mesh(new THREE.PlaneGeometry(W, H), mat(0xffffff, { map: tex, roughness: 0.95 }), { cast: false, parent: g });
  const frame = mat(0xa8763f, { roughness: 0.55 });
  box(W + 0.24, 0.12, 0.08, frame, { y: H / 2 + 0.06, parent: g });
  box(W + 0.24, 0.12, 0.08, frame, { y: -H / 2 - 0.06, parent: g });
  box(0.12, H, 0.08, frame, { x: -W / 2 - 0.06, parent: g });
  box(0.12, H, 0.08, frame, { x: W / 2 + 0.06, parent: g });
  box(W * 0.9, 0.04, 0.16, frame, { y: -H / 2 - 0.12, z: 0.08, parent: g });
  // chalk + eraser on the ledge
  const chalkColors = [0xffffff, 0xffe08a, 0xff9a9d, 0x9cc4ff];
  chalkColors.forEach((col, i) => cyl(0.018, 0.018, 0.14, mat(col), { x: -2 + i * 0.22, y: -H / 2 - 0.08, z: 0.1, rz: Math.PI / 2, parent: g }, 8));
  rbox(0.26, 0.06, 0.09, 0.02, mat(0x3c3c5a), { x: 1.9, y: -H / 2 - 0.07, z: 0.1, parent: g });
}

// ---------------------------------------------------------------- windows
function buildWindows(room) {
  const sky = canvasTexture(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#7cc7ff');
    grad.addColorStop(0.7, '#cdeeff');
    grad.addColorStop(1, '#e9f7d9');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, s] of [[60, 70, 26], [90, 62, 32], [122, 72, 24], [180, 120, 18], [204, 114, 22]]) {
      g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#9ad06a';
    g.beginPath(); g.ellipse(60, 250, 120, 50, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7fbf55';
    g.beginPath(); g.ellipse(220, 260, 110, 56, 0, 0, Math.PI * 2); g.fill();
  });
  const glass = new THREE.MeshBasicMaterial({ map: sky, toneMapped: false });
  glass.color.setScalar(0.92);
  const frame = mat(0xffffff, { roughness: 0.5 });

  for (const z of [-3, 0.2]) {
    const g = new THREE.Group();
    g.position.set(ROOM.left + 0.04, 2.55, z);
    g.rotation.y = Math.PI / 2;
    room.add(g);
    const W = 2.2, H = 2.2;
    mesh(new THREE.PlaneGeometry(W, H), glass, { cast: false, receive: false, parent: g });
    box(W + 0.16, 0.1, 0.1, frame, { y: H / 2, parent: g });
    box(W + 0.16, 0.1, 0.1, frame, { y: -H / 2, parent: g });
    box(0.1, H, 0.1, frame, { x: -W / 2, parent: g });
    box(0.1, H, 0.1, frame, { x: W / 2, parent: g });
    box(0.06, H, 0.06, frame, { parent: g });
    box(W, 0.06, 0.06, frame, { y: 0.2, parent: g });
    box(W + 0.3, 0.05, 0.22, frame, { y: -H / 2 - 0.05, z: 0.1, parent: g });
  }
}

// ---------------------------------------------------------------- clock
function buildClock(room) {
  const g = new THREE.Group();
  g.position.set(4.1, 3.85, ROOM.back + 0.06);
  room.add(g);
  const face = canvasTexture(256, 256, (c, w) => {
    c.fillStyle = '#fffdf6'; c.beginPath(); c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a2140';
    c.font = 'bold 30px "Baloo 2", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
      const a = i / 12 * Math.PI * 2;
      c.fillText(String(i), w / 2 + Math.sin(a) * 98, w / 2 - Math.cos(a) * 98);
    }
  });
  cyl(0.36, 0.36, 0.06, mat(0xff5a5f, { physical: true }), { rx: Math.PI / 2, parent: g }, 40);
  mesh(new THREE.CircleGeometry(0.31, 40), mat(0xffffff, { map: face, roughness: 0.6 }), { z: 0.032, cast: false, parent: g });
  const hand = (len, wid, color, z) => {
    const pivot = new THREE.Group();
    pivot.position.z = z;
    box(wid, len, 0.01, mat(color), { y: len / 2 - 0.03, cast: false, parent: pivot });
    g.add(pivot);
    return pivot;
  };
  const hour = hand(0.17, 0.03, 0x2a2140, 0.04);
  const minute = hand(0.25, 0.022, 0x2a2140, 0.045);
  const second = hand(0.27, 0.008, 0xff5a5f, 0.05);
  sphere(0.02, mat(0x2a2140), { z: 0.055, parent: g }, 10);
  return { hour, minute, second };
}

// ---------------------------------------------------------------- posters
function buildPosters(room) {
  // a friendly cell diagram
  const cellTex = canvasTexture(512, 680, (c, w, h) => {
    c.fillStyle = '#fff6e0'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a2140';
    c.font = 'bold 54px "Baloo 2", sans-serif';
    c.textAlign = 'center';
    c.fillText('The Cell', w / 2, 80);
    c.fillStyle = '#bfe8a8';
    c.strokeStyle = '#4c9a3b'; c.lineWidth = 10;
    c.beginPath(); c.ellipse(w / 2, 360, 200, 230, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#c69cf0'; c.strokeStyle = '#7b4cb3';
    c.beginPath(); c.arc(w / 2, 350, 80, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#2a2140'; c.lineWidth = 4;
    for (let y = 300; y <= 400; y += 10) {
      c.beginPath(); c.moveTo(w / 2 - 30 + Math.sin(y / 8) * 15, y); c.lineTo(w / 2 + 30 + Math.sin(y / 8) * 15, y); c.stroke();
    }
    c.fillStyle = '#ff9f6b';
    for (const [x, y] of [[170, 220], [360, 250], [180, 480], [340, 500]]) {
      c.beginPath(); c.ellipse(x, y, 34, 18, 0.6, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#2a2140';
    c.font = '34px "Patrick Hand", cursive';
    c.fillText('nucleus = home of DNA', w / 2, 640);
  });
  const p1 = mesh(new THREE.PlaneGeometry(1.15, 1.53), mat(0xffffff, { map: cellTex, roughness: 0.8 }), {
    x: ROOM.right - 0.02, y: 2.6, z: -2.4, ry: -Math.PI / 2, cast: false,
  });
  room.add(p1);

  // periodic-table-ish colour grid
  const ptTex = canvasTexture(640, 420, (c, w, h) => {
    c.fillStyle = '#26314f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = 'bold 36px "Baloo 2", sans-serif'; c.textAlign = 'center';
    c.fillText('Elements of Life', w / 2, 52);
    const cols = ['#ff7a59', '#ffc233', '#1fbf9a', '#3b82f6', '#a066ff', '#ff4fa0'];
    const sym = ['C', 'H', 'O', 'N', 'P', 'S'];
    const r = rng(5);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 12; x++) {
      if ((y === 0 && x > 0 && x < 11) || (y === 1 && x > 1 && x < 9)) continue;
      c.fillStyle = cols[Math.floor(r() * cols.length)];
      c.fillRect(30 + x * 49, 80 + y * 64, 44, 58);
    }
    c.fillStyle = '#fff'; c.font = 'bold 28px "Baloo 2", sans-serif';
    sym.forEach((s, i) => c.fillText(s, 52 + (i + 3) * 49, 400));
  });
  const p2 = mesh(new THREE.PlaneGeometry(1.6, 1.05), mat(0xffffff, { map: ptTex, roughness: 0.8 }), {
    x: ROOM.right - 0.02, y: 2.75, z: 0.6, ry: -Math.PI / 2, cast: false,
  });
  room.add(p2);

  // little pennant bunting across the back wall
  const colors = [0xff5a5f, 0xffc233, 0x3b82f6, 0x1fbf9a, 0xa066ff];
  for (let i = 0; i < 22; i++) {
    const x = -6.8 + i * 0.65;
    const sag = Math.cos((i / 21 - 0.5) * Math.PI) * 0.22;
    const tri = new THREE.Shape();
    tri.moveTo(-0.17, 0); tri.lineTo(0.17, 0); tri.lineTo(0, -0.32);
    mesh(new THREE.ShapeGeometry(tri), mat(colors[i % colors.length], { side: THREE.DoubleSide }), {
      x, y: 4.85 - sag, z: ROOM.back + 0.08, rz: (i % 2 ? 0.05 : -0.05), cast: false, parent: room,
    });
  }
}

// ---------------------------------------------------------------- shelf
function buildShelf(room) {
  const g = new THREE.Group();
  g.position.set(5.6, 0, ROOM.back + 0.35);
  room.add(g);
  const wood = mat(0xc48a52, { roughness: 0.6 });
  box(1.8, 0.06, 0.5, wood, { y: 0.03, parent: g });
  for (const y of [0.6, 1.2, 1.8]) box(1.8, 0.05, 0.5, wood, { y, parent: g });
  box(0.06, 1.85, 0.5, wood, { x: -0.87, y: 0.92, parent: g });
  box(0.06, 1.85, 0.5, wood, { x: 0.87, y: 0.92, parent: g });
  box(1.8, 1.85, 0.03, wood, { y: 0.92, z: -0.24, parent: g });
  const r = rng(9);
  const bookCols = [0xff5a5f, 0xffc233, 0x3b82f6, 0x1fbf9a, 0xa066ff, 0xff8a3d, 0x2a2140];
  for (const shelfY of [0.06, 0.63, 1.23]) {
    let x = -0.8;
    while (x < 0.75) {
      const bw = 0.06 + r() * 0.06, bh = 0.32 + r() * 0.18;
      box(bw, bh, 0.32, mat(bookCols[Math.floor(r() * bookCols.length)]), {
        x: x + bw / 2, y: shelfY + bh / 2, rz: r() < 0.12 ? 0.12 : 0, parent: g,
      });
      x += bw + 0.008;
      if (r() < 0.12) x += 0.15;
    }
  }
  // globe on top
  const globeTex = canvasTexture(256, 128, (c, w, h) => {
    c.fillStyle = '#4aa3ff'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7ad16a';
    const rr = rng(2);
    for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(rr() * w, 20 + rr() * 88, 10 + rr() * 26, 8 + rr() * 18, rr() * 3, 0, Math.PI * 2); c.fill(); }
  });
  cyl(0.06, 0.12, 0.08, mat(0x2a2140), { x: -0.4, y: 1.87, parent: g });
  sphere(0.2, mat(0xffffff, { map: globeTex, roughness: 0.4 }), { x: -0.4, y: 2.12, rz: 0.4, parent: g }, 32);
  // a beaker
  cyl(0.08, 0.08, 0.2, mat(0xbfefff, { transparent: true, opacity: 0.45, roughness: 0.1 }), { x: 0.4, y: 1.93, parent: g });
  cyl(0.075, 0.075, 0.1, mat(0x8ef06a, { emissive: 0x3b9c25, emissiveIntensity: 0.3 }), { x: 0.4, y: 1.88, parent: g });
}

// ---------------------------------------------------------------- desks
function buildDesks(room) {
  const top = mat(0xf2d3a2, { roughness: 0.55 });
  const metal = mat(0x6c7a96, { roughness: 0.4, metalness: 0.3 });
  const seatCols = [0xff8a3d, 0x3b82f6, 0x1fbf9a, 0xff4fa0];
  const spots = [[-4.6, -3.1], [-4.6, -0.6], [4.4, -1.6], [4.6, 1.4]];
  spots.forEach(([x, z], i) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = x < 0 ? 0.25 : -0.25;
    room.add(g);
    rbox(1.1, 0.05, 0.6, 0.02, top, { y: 0.74, parent: g });
    for (const [lx, lz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) {
      cyl(0.022, 0.022, 0.72, metal, { x: lx, y: 0.36, z: lz, parent: g }, 8);
    }
    // chair
    const seat = mat(seatCols[i]);
    rbox(0.42, 0.05, 0.4, 0.02, seat, { y: 0.44, z: 0.55, parent: g });
    rbox(0.42, 0.34, 0.04, 0.02, seat, { y: 0.68, z: 0.75, rx: -0.08, parent: g });
    for (const [lx, lz] of [[-0.18, 0.38], [0.18, 0.38], [-0.18, 0.72], [0.18, 0.72]]) {
      cyl(0.016, 0.016, 0.44, metal, { x: lx, y: 0.22, z: lz, parent: g }, 8);
    }
    // a notebook
    box(0.28, 0.015, 0.2, mat(seatCols[(i + 1) % 4]), { x: -0.2, y: 0.775, z: 0.05, ry: 0.3, parent: g });
  });
}

// ---------------------------------------------------------------- plants
function buildPlants(room) {
  const pot = mat(0xe07a4f, { roughness: 0.7 });
  const leaf = mat(0x58b84a, { roughness: 0.6 });
  const leaf2 = mat(0x3f9a3c, { roughness: 0.6 });
  for (const [x, z, s] of [[-6.7, -4.3, 1.2], [6.8, 3.2, 1]]) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    room.add(g);
    cyl(0.28, 0.2, 0.5, pot, { y: 0.25, parent: g });
    cyl(0.3, 0.3, 0.06, pot, { y: 0.5, parent: g });
    const r = rng(Math.round(x * 10 + 50));
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      const l = mesh(new THREE.SphereGeometry(0.18, 12, 8), i % 2 ? leaf : leaf2, {
        x: Math.cos(a) * 0.18, y: 0.75 + r() * 0.5, z: Math.sin(a) * 0.18, parent: g,
      });
      l.scale.set(0.7, 1.6, 0.5);
      l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
  }
}

// ---------------------------------------------------------------- lab table
function buildLabTable(room) {
  const g = new THREE.Group();
  room.add(g);
  const W = 3.6, D = 1.6;
  rbox(W, 0.08, D, 0.03, mat(0xf6f3ee, { roughness: 0.35, physical: true, clearcoat: 0.3 }), { y: TABLE_Y - 0.04, parent: g });
  rbox(W + 0.02, 0.05, D + 0.02, 0.02, mat(0xff8a3d), { y: TABLE_Y - 0.1, parent: g });
  const cabinet = mat(0x5aa9e6, { roughness: 0.6 });
  rbox(W - 0.3, TABLE_Y - 0.2, D - 0.3, 0.04, cabinet, { y: (TABLE_Y - 0.12) / 2 + 0.02, parent: g });
  // cabinet doors with knobs
  const knob = mat(0xffc233, { physical: true });
  for (let i = 0; i < 4; i++) {
    const x = -1.2 + i * 0.8;
    rbox(0.72, 0.48, 0.02, 0.02, mat(0x74b9ee), { x, y: 0.36, z: (D - 0.3) / 2 + 0.01, parent: g });
    sphere(0.035, knob, { x: x + (i % 2 ? -0.26 : 0.26), y: 0.4, z: (D - 0.3) / 2 + 0.04, parent: g }, 12);
  }
  // props on the table ends
  const glass = mat(0xd6f4ff, { transparent: true, opacity: 0.4, roughness: 0.05 });
  cyl(0.09, 0.09, 0.26, glass, { x: -1.55, y: TABLE_Y + 0.13, z: -0.5, parent: g });
  cyl(0.085, 0.085, 0.14, mat(0xff7ab8, { emissive: 0xc0306e, emissiveIntensity: 0.25 }), { x: -1.55, y: TABLE_Y + 0.07, z: -0.5, parent: g });
  // test-tube rack
  rbox(0.4, 0.04, 0.12, 0.01, mat(0xc48a52), { x: 1.5, y: TABLE_Y + 0.12, z: -0.55, parent: g });
  rbox(0.4, 0.03, 0.12, 0.01, mat(0xc48a52), { x: 1.5, y: TABLE_Y + 0.015, z: -0.55, parent: g });
  [0xffc233, 0x3b82f6, 0x1fbf9a].forEach((c, i) => {
    cyl(0.022, 0.022, 0.24, glass, { x: 1.38 + i * 0.12, y: TABLE_Y + 0.13, z: -0.55, parent: g }, 10);
    cyl(0.02, 0.02, 0.1, mat(c), { x: 1.38 + i * 0.12, y: TABLE_Y + 0.07, z: -0.55, parent: g }, 10);
  });
}

// ---------------------------------------------------------------- lights
function buildLights(scene) {
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0xb58d63, 0.45));

  const sun = new THREE.DirectionalLight(0xfff0d8, 1.9);
  sun.position.set(-6, 8, 4.5);
  sun.target.position.set(0, 1, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -4;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 25;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  const fill = new THREE.DirectionalLight(0xdce8ff, 0.35);
  fill.position.set(5, 4, 6);
  scene.add(fill);
}
