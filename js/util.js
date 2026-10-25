import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const matCache = new Map();

// Shared "toy plastic" material. Cached by colour + options so the scene
// doesn't create hundreds of identical materials.
export function mat(color, opts = {}) {
  const { physical, unique, ...rest } = opts;
  // textures can't be part of a cache key, so textured materials are never shared
  const cacheable = !unique && !Object.values(rest).some(v => v && typeof v === 'object');
  const key = cacheable ? color + JSON.stringify(opts) : null;
  if (cacheable && matCache.has(key)) return matCache.get(key);
  const m = physical
    ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.35, ...rest })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...rest });
  if (cacheable) matCache.set(key, m);
  return m;
}

export function mesh(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, receive = true, parent } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}

export const box = (w, h, d, material, o) => mesh(new THREE.BoxGeometry(w, h, d), material, o);
export const rbox = (w, h, d, r, material, o) => mesh(new RoundedBoxGeometry(w, h, d, 4, r), material, o);
export const cyl = (rt, rb, h, material, o, seg = 24) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material, o);
export const sphere = (r, material, o, seg = 24) => mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), material, o);
export const capsule = (r, len, material, o) => mesh(new THREE.CapsuleGeometry(r, len, 6, 16), material, o);

export function canvasTexture(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

// Seeded random so the classroom looks the same on every visit.
export function rng(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
