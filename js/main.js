import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { buildClassroom } from './classroom.js';
import { buildCast } from './characters.js';
import { Ladder, Tray, Confetti, RUNGS, FRAME_Z, rungY } from './dna.js';
import { Game } from './game.js';
import { stepTweens, tween, ease } from './tween.js';
import { soundOn, voiceOn, setSound, setVoice, unlockAudio, sfx } from './audio.js';
import * as ui from './ui.js';

const stage = document.getElementById('stage');

// ------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
stage.appendChild(renderer.domElement);
stage.classList.add('grab');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6e7cf);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 60);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.rotateSpeed = 0.6;
controls.enabled = false;


// ------------------------------------------------------------ camera rig
const PLAY_TARGET = new THREE.Vector3(0, 1.97, FRAME_Z);
const rig = {
  mode: 'title',
  spinning: false,

  // pull the camera back on narrow / portrait screens so the tray still fits
  playDistance() {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const tanH = Math.tan(vfov / 2) * camera.aspect;
    const needHalfWidth = 1.45;
    return Math.max(5.5, needHalfWidth / tanH + 0.6);
  },

  playPosition() {
    const d = this.playDistance();
    const dir = new THREE.Vector3(0, 0.2, 1).normalize();
    return PLAY_TARGET.clone().addScaledVector(dir, d);
  },

  limits(free) {
    controls.minAzimuthAngle = free ? -Infinity : -0.75;
    controls.maxAzimuthAngle = free ? Infinity : 0.75;
    controls.minPolarAngle = free ? 0.5 : 1.05;
    controls.maxPolarAngle = free ? 1.75 : 1.68;
    controls.minDistance = 2.6;
    controls.maxDistance = free ? 9 : Math.max(8, this.playDistance() + 2);
  },

  moveTo(pos, target, duration = 1.4) {
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    controls.enabled = false;
    return tween({
      duration, easing: ease.inOut,
      update: p => {
        camera.position.lerpVectors(p0, pos, p);
        controls.target.lerpVectors(t0, target, p);
        camera.lookAt(controls.target);
      },
      done: () => { controls.enabled = true; },
    });
  },

  toPlay() {
    this.mode = 'play';
    controls.autoRotate = false;
    this.spinning = false;
    this.limits(false);
    this.moveTo(this.playPosition(), PLAY_TARGET);
  },

  showcase() {
    this.mode = 'showcase';
    this.limits(true);
    const target = new THREE.Vector3(0, rungY((RUNGS - 1) / 2) + 0.3, FRAME_Z);
    this.moveTo(new THREE.Vector3(0.9, target.y + 0.45, Math.max(4.4, this.playDistance() - 0.6)), target, 3.6);
  },

  // only the helix spins; the camera stays in front so the class keeps its bearings
  spin(on) {
    this.spinning = on;
    if (!on) ladder.group.rotation.y = 0;
  },

  update(dt, t) {
    if (this.mode === 'title') {
      const a = Math.sin(t * 0.18) * 0.55;
      const r = 6.2;
      camera.position.set(Math.sin(a) * r, 2.7 + Math.sin(t * 0.3) * 0.15, FRAME_Z + Math.cos(a) * r);
      camera.lookAt(0, 1.8, FRAME_Z);
      return;
    }
    if (this.spinning) ladder.group.rotation.y += dt * 0.55;
    if (controls.enabled) controls.update();
  },
};

// ------------------------------------------------------------ world
// built in boot() once the web fonts are ready, because the block letters,
// blackboard and posters are drawn onto canvases
let classroom, cast, ladder, tray, confetti, game;

function buildWorld() {
  classroom = buildClassroom(scene);
  cast = buildCast(scene);
  ladder = new Ladder(scene);
  tray = new Tray(scene);
  confetti = new Confetti(scene);
  game = new Game({ scene, camera, controls, ladder, tray, cast, confetti, canvas: renderer.domElement, rig });
}

// ------------------------------------------------------------ overlay tracking
const v = new THREE.Vector3();
function toScreen(vec) {
  v.copy(vec).project(camera);
  return {
    x: (v.x + 1) / 2 * window.innerWidth,
    y: (1 - v.y) / 2 * window.innerHeight,
    ok: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2,
  };
}

function updateOverlays() {
  const th = cast.teacher.worldHead.clone();
  th.y += 0.42;
  const tp = toScreen(th);
  ui.placeBubble(tp.x, tp.y);

  for (const [who, tag] of [['boy', ui.el.tagBoy], ['girl', ui.el.tagGirl]]) {
    const h = cast[who].worldHead.clone();
    h.y += 0.42;
    const s = toScreen(h);
    placeTagSafe(tag, s);
  }
}
function placeTagSafe(tag, s) {
  ui.placeTag(tag, s.x, s.y, s.ok);
}

// ------------------------------------------------------------ loop
const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  stepTweens(dt);
  rig.update(dt, elapsed);
  for (const c of Object.values(cast)) c.update(dt, elapsed);
  ladder.update(dt, elapsed);
  tray.update(dt, elapsed);
  confetti.update(dt);
  classroom.update();
  renderer.render(scene, camera);
  updateOverlays();
  requestAnimationFrame(frame);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (rig.mode === 'play' && controls.enabled) {
    // keep the same viewing direction, just refit the distance
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, rig.playDistance());
    rig.limits(false);
  }
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------ UI wiring
const { el } = ui;

function syncToggles() {
  el.sound.classList.toggle('muted', !soundOn());
  el.voice.classList.toggle('muted', !voiceOn());
}
syncToggles();
if (!('speechSynthesis' in window)) el.voice.classList.add('hidden');

el.sound.addEventListener('click', () => { setSound(!soundOn()); unlockAudio(); syncToggles(); sfx.pick(); });
el.voice.addEventListener('click', () => { setVoice(!voiceOn()); syncToggles(); });

el.start.addEventListener('click', () => {
  const clean = (s, d) => (s.trim() || d).slice(0, 12);
  game.start({ boy: clean(el.nameBoy.value, 'Leo'), girl: clean(el.nameGirl.value, 'Maya') });
});
for (const input of [el.nameBoy, el.nameGirl]) {
  input.addEventListener('keydown', e => { if (e.key === 'Enter') el.start.click(); });
}

el.next.addEventListener('click', () => { sfx.pick(); game.nextResolve?.(); });
el.skip.addEventListener('click', () => { game.skipIntro = true; game.nextResolve?.(); });
el.check.addEventListener('click', () => game.check());
el.hint.addEventListener('click', () => game.askTeacher());

document.getElementById('btn-restart').addEventListener('click', () => {
  if (game.state === 'won') { game.restart(); return; }
  ui.toggleModal(el.confirm, true);
});
document.getElementById('btn-confirm-no').addEventListener('click', () => ui.toggleModal(el.confirm, false));
document.getElementById('btn-confirm-yes').addEventListener('click', () => { ui.toggleModal(el.confirm, false); game.restart(); });

document.getElementById('btn-help').addEventListener('click', () => ui.toggleModal(el.help, true));
document.getElementById('btn-help-close').addEventListener('click', () => ui.toggleModal(el.help, false));

document.getElementById('btn-again').addEventListener('click', () => game.restart());
document.getElementById('btn-facts').addEventListener('click', () => game.reviewFacts());
document.getElementById('btn-admire').addEventListener('click', () => {
  document.body.classList.add('admiring');
  const back = document.createElement('button');
  back.id = 'admire-back';
  back.className = 'btn start';
  back.textContent = 'Back to results';
  back.addEventListener('click', () => { document.body.classList.remove('admiring'); back.remove(); });
  document.body.appendChild(back);
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ui.toggleModal(el.help, false);
    ui.toggleModal(el.confirm, false);
  }
});

// ------------------------------------------------------------ boot
async function boot() {
  el.start.disabled = true;
  const fonts = ['800 100px "Baloo 2"', '700 40px "Nunito"', '40px "Patrick Hand"'];
  await Promise.race([
    Promise.all(fonts.map(f => document.fonts.load(f))).catch(() => {}),
    new Promise(r => setTimeout(r, 2500)),
  ]);
  buildWorld();
  el.loading.classList.add('hidden');
  el.start.disabled = false;
  camera.position.set(0, 2.7, 6);
  frame();
}
boot();
