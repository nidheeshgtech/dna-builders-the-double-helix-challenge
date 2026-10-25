// All sound effects are synthesised with the Web Audio API, so the game needs
// no audio files. The teacher's lines can also be read aloud with the
// browser's speech engine.

let ctx = null;
let master = null;
let noiseBuf = null;

const prefs = {
  sound: readPref('dna-sound', true),
  voice: readPref('dna-voice', true),
};

function readPref(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch { return fallback; }
}
function writePref(key, val) {
  try { localStorage.setItem(key, val ? '1' : '0'); } catch { /* private mode */ }
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export const soundOn = () => prefs.sound;
export const voiceOn = () => prefs.voice;
export function setSound(on) { prefs.sound = on; writePref('dna-sound', on); }
export function setVoice(on) {
  prefs.voice = on;
  writePref('dna-voice', on);
  if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
}

function ready() { return ctx && prefs.sound; }

function tone(freq, { at = 0, dur = 0.2, type = 'sine', gain = 0.3, attack = 0.005, slide = 0, filter = 0 } = {}) {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = osc.connect(g);
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    node = g.connect(f);
  }
  node.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ at = 0, dur = 0.3, gain = 0.2, from = 400, to = 4000, q = 1.2, type = 'bandpass' } = {}) {
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

const note = n => 440 * Math.pow(2, (n - 69) / 12);

export const sfx = {
  hover() { if (!ready()) return; tone(1200, { dur: 0.05, gain: 0.04, type: 'triangle' }); },

  pick() {
    if (!ready()) return;
    tone(520, { dur: 0.12, gain: 0.22, slide: 380, type: 'sine' });
    tone(1040, { at: 0.03, dur: 0.08, gain: 0.06, type: 'triangle' });
  },

  place() {
    if (!ready()) return;
    tone(190, { dur: 0.16, gain: 0.35, slide: -90, type: 'triangle' });
    noise({ dur: 0.06, gain: 0.12, from: 2500, to: 1200, q: 0.8 });
  },

  drop() {
    if (!ready()) return;
    tone(420, { dur: 0.18, gain: 0.15, slide: -200, type: 'sine' });
  },

  correct() {
    if (!ready()) return;
    [72, 76, 79, 84].forEach((n, i) => {
      tone(note(n), { at: i * 0.075, dur: 0.35, gain: 0.2, type: 'triangle' });
      tone(note(n + 12), { at: i * 0.075, dur: 0.25, gain: 0.05, type: 'sine' });
    });
    [96, 100, 103].forEach((n, i) => tone(note(n), { at: 0.32 + i * 0.05, dur: 0.18, gain: 0.04 }));
  },

  wrong() {
    if (!ready()) return;
    // a soft "uh-oh", not a harsh buzzer
    tone(note(64), { dur: 0.18, gain: 0.18, type: 'square', filter: 900 });
    tone(note(60), { at: 0.17, dur: 0.3, gain: 0.18, type: 'square', filter: 700, slide: -20 });
  },

  turn() {
    if (!ready()) return;
    tone(note(79), { dur: 0.5, gain: 0.08, type: 'sine' });
    tone(note(86), { at: 0.08, dur: 0.6, gain: 0.05, type: 'sine' });
  },

  hint() {
    if (!ready()) return;
    [81, 84, 88].forEach((n, i) => tone(note(n), { at: i * 0.06, dur: 0.3, gain: 0.07, type: 'sine' }));
  },

  blip() {
    if (!ready()) return;
    tone(note(76 + Math.floor(Math.random() * 5)), { dur: 0.04, gain: 0.025, type: 'square', filter: 2000 });
  },

  whoosh(dur = 3) {
    if (!ready()) return;
    noise({ dur, gain: 0.16, from: 200, to: 3000, q: 2 });
    for (let i = 0; i < 12; i++) tone(note(60 + i * 2), { at: i * (dur / 12), dur: 0.3, gain: 0.05, type: 'sine' });
  },

  fanfare() {
    if (!ready()) return;
    const seq = [[67, 0], [72, 0.14], [76, 0.28], [79, 0.42], [76, 0.62], [79, 0.76]];
    seq.forEach(([n, at]) => {
      tone(note(n), { at, dur: 0.3, gain: 0.16, type: 'triangle' });
      tone(note(n - 12), { at, dur: 0.3, gain: 0.08, type: 'sine' });
    });
    [72, 76, 79, 84].forEach(n => tone(note(n), { at: 0.95, dur: 1.4, gain: 0.1, type: 'triangle', attack: 0.02 }));
    noise({ at: 0.95, dur: 0.9, gain: 0.05, from: 6000, to: 9000, q: 0.5, type: 'highpass' });
  },

  sparkle() {
    if (!ready()) return;
    for (let i = 0; i < 6; i++) tone(note(88 + Math.floor(Math.random() * 12)), { at: i * 0.07, dur: 0.15, gain: 0.03 });
  },
};

// ---------- teacher voice ----------
let voice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const all = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
  const prefer = ['Samantha', 'Karen', 'Moira', 'Tessa', 'Serena', 'Google UK English Female', 'Microsoft Libby', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Zira', 'Female'];
  for (const name of prefer) {
    const v = all.find(v => v.name.includes(name));
    if (v) { voice = v; return; }
  }
  voice = all[0] || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function say(text) {
  if (!prefs.voice || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 1.02;
  u.pitch = 1.1;
  speechSynthesis.speak(u);
}

export function hush() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
