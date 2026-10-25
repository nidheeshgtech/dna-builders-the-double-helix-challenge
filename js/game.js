import * as THREE from 'three';
import { BASES, LETTERS, RUNGS, FRAME_Z, makeBlock, setGlow, rungY } from './dna.js';
import { tween, wait, killTweens, ease } from './tween.js';
import { sfx, say, hush, unlockAudio } from './audio.js';
import * as ui from './ui.js';
import { openRecap, closeRecap } from './recap.js';

const PLAYER = {
  boy: { side: 0, color: 0x1fa3ff, css: 'left', sideName: 'LEFT' },
  girl: { side: 1, color: 0xff4fa0, css: 'right', sideName: 'RIGHT' },
};

const PRAISE = [
  'Yes! Perfect match!',
  'Brilliant pairing!',
  'Spot on. That rung is locked in!',
  'Great thinking!',
  'Exactly right. Nice work!',
  'You nailed it!',
];

const FACTS = [
  'If you stretched out all the DNA in just one of your cells, it would be about 2 metres long!',
  'Your DNA is 99.9% the same as every other person on Earth. The tiny 0.1% makes you unique.',
  'A and T are held together by 2 hydrogen bonds. G and C are held by 3, so G–C pairs are a little stronger.',
  'RNA uses U (uracil) instead of T. That is why U never appears in a DNA ladder.',
  'The double helix shape of DNA was described in 1953, with key X-ray images taken by Rosalind Franklin.',
  'Humans share about 60% of their DNA with bananas!',
];

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, camera, controls, ladder, tray, cast, confetti, canvas, rig
    this.state = 'title';
    this.gen = 0;
    this.names = { boy: 'Leo', girl: 'Maya' };
    this.loose = new Set();     // blocks in flight or being dragged
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(FRAME_Z + 0.32));
    this.drag = null;
    this.hovered = null;
    this.tmp = new THREE.Vector3();
    this.bindInput();
  }

  // ------------------------------------------------------------ lifecycle
  start(names) {
    unlockAudio();
    this.names = names;
    ui.setNames(names.boy, names.girl);
    ui.showTitle(false);
    ui.setPlaying(true);
    this.newRound();
    this.rig.toPlay();
    this.runIntro(this.gen);
  }

  restart() {
    ui.hideWin();
    this.newRound();
    this.rig.toPlay();
    this.quickStart(this.gen);
  }

  newRound() {
    this.gen++;
    killTweens();
    hush();
    closeRecap();
    ui.hideBubble();
    ui.hideWin();
    ui.setPlaying(true);
    this.confetti.stop();
    this.cancelDrag();
    for (const b of this.loose) b.parent?.remove(b);
    this.loose.clear();
    this.ladder.clear();
    this.tray.highlight(null);
    this.rig.spin(false);

    // two of each base, shuffled, so every DNA letter shows up on both sides
    const pool = ['A', 'T', 'G', 'C', 'A', 'T', 'G', 'C'];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.rungs = pool.slice(0, RUNGS).map((template, i) => {
      const player = i % 2 === 0 ? 'boy' : 'girl';
      return {
        template, player,
        side: PLAYER[player].side,
        answer: BASES[template].partner,
        attempts: 0, hintUsed: false, done: false,
        pending: null, pendingBlock: null,
      };
    });
    this.current = -1;
    this.score = 0;
    this.points = { boy: 0, girl: 0 };
    this.firstTry = 0;
    this.taughtBonds = { AT: false, GC: false };
    ui.setScore(0, false);
    ui.setPlayerPoints(0, 0);
    ui.buildProgress(RUNGS);
    ui.setProgress(0, -1, []);
    ui.setTurn(null);
    ui.setCheck(false);
    ui.showActions(false);
    ui.setInstruction('');
    for (const k of ['teacher', 'boy', 'girl']) {
      this.cast[k].setPose('idle');
      this.cast[k].setActive(false);
    }
    this.lookAll(this.ladder.slotWorld(Math.floor(RUNGS / 2), 0).setX(0));
    this.state = 'intro';
  }

  alive(gen) { return gen === this.gen; }

  // ------------------------------------------------------------ teacher talk
  speak(text, opts = {}) {
    ui.showBubble(text, { ...opts, onType: () => sfx.blip() });
    say(ui.plain(text));
    const words = ui.plain(text).split(/\s+/).length;
    this.cast.teacher.talk(Math.max(1.4, words * 0.3));
    if (opts.pose) this.cast.teacher.setPose(opts.pose, opts.poseFor || 2.6);
  }

  waitNext() {
    return new Promise(resolve => { this.nextResolve = resolve; });
  }

  async runIntro(gen) {
    const { boy, girl } = this.names;
    this.skipIntro = false;
    const T = this.cast.teacher;
    T.lookAt(this.camera.position);

    const steps = [
      { text: `Hello ${boy} and ${girl}! Today we're going to build a model of **DNA**, the instructions inside every living cell.`, pose: 'wave' },
      { text: `DNA looks like a ladder. Each rung is made of two blocks called **bases**. I've already placed one base on every rung for you.`, pose: 'point', templates: true },
      { text: `Rule number 1: [A] always pairs with [T].`, pose: 'explain', glow: ['A', 'T'] },
      { text: `Rule number 2: [G] always pairs with [C].`, pose: 'explain', glow: ['G', 'C'] },
      { text: `Careful with [U]! U is used in RNA, not in DNA, so it never goes on our ladder.`, pose: 'think', glow: ['U'] },
      { text: `${boy}, you build the LEFT side. ${girl}, you build the RIGHT side. Drag the partner block into the glowing space, then press Check answer. Ready?`, pose: 'wave', last: true },
    ];

    let templatesIn = false;
    for (const step of steps) {
      if (!this.alive(gen) || this.skipIntro) break;
      this.speak(step.text, { intro: true, pose: step.pose, poseFor: 3 });
      if (step.templates) { this.dropTemplates(gen); templatesIn = true; }
      if (step.glow) this.flashBins(step.glow, gen);
      ui.el.next.textContent = step.last ? "Let's build!" : 'Next';
      await this.waitNext();
    }
    if (!this.alive(gen)) return;
    this.flashToken = (this.flashToken || 0) + 1; // stop any bin flashing still running
    this.tray.highlight(null);
    if (!templatesIn) this.dropTemplates(gen, true);
    await wait(templatesIn ? 0.1 : 0.9, gen);
    this.beginTurn(0, gen);
  }

  async quickStart(gen) {
    this.speak(`A brand-new ladder! ${this.names.boy} starts on the LEFT. Let's go!`, { pose: 'wave' });
    this.dropTemplates(gen);
    await wait(1.6);
    if (this.alive(gen)) this.beginTurn(0, gen);
  }

  async flashBins(letters, gen) {
    const token = (this.flashToken = (this.flashToken || 0) + 1);
    const current = () => this.alive(gen) && token === this.flashToken;
    for (let k = 0; k < 4; k++) {
      for (const L of letters) {
        if (!current()) return;
        this.tray.highlight(L);
        sfx.hint();
        await wait(0.55);
      }
    }
    if (current()) this.tray.highlight(null);
  }

  dropTemplates(gen, fast = false) {
    this.rungs.forEach((r, i) => {
      const otherSide = 1 - r.side;
      const block = makeBlock(r.template);
      const rung = this.ladder.rungs[i];
      const slot = rung.slots[otherSide];
      this.ladder.attach(block, i, otherSide);
      block.position.set(slot.x, 2.2, 0);
      block.scale.setScalar(0.01);
      tween({
        duration: 0.6, delay: (fast ? 0.05 : 0.12) * i, easing: ease.back,
        update: p => {
          block.position.y = 2.2 * (1 - p);
          block.scale.setScalar(Math.max(0.01, Math.min(1, p * 1.4)));
        },
        done: () => { block.position.y = 0; block.scale.setScalar(1); sfx.place(); },
      });
    });
  }

  // ------------------------------------------------------------ turns
  beginTurn(i, gen = this.gen) {
    if (!this.alive(gen)) return;
    this.current = i;
    const r = this.rungs[i];
    const P = PLAYER[r.player];
    const name = this.names[r.player];
    this.state = 'turn';
    ui.hideBubble();
    this.ladder.setActive(i, r.side, P.color);
    this.cast.boy.setActive(r.player === 'boy');
    this.cast.girl.setActive(r.player === 'girl');
    ui.setTurn(r.player);
    ui.showActions(true);
    ui.setCheck(false);
    ui.setProgress(this.doneCount(), i, this.progressColors());
    this.setTurnInstruction();
    const slot = this.ladder.slotWorld(i, r.side);
    this.lookAll(slot);
    this.cast.teacher.lookAt(slot);
    sfx.turn();

    const prompts = [
      `Your turn, ${name}! Which block pairs with [${r.template}]?`,
      `${name}, find the partner for [${r.template}].`,
      `Over to you, ${name}. What goes with [${r.template}]?`,
    ];
    this.speak(prompts[i % prompts.length], { pose: 'point', poseFor: 1.6 });
  }

  setTurnInstruction(extra) {
    const r = this.rungs[this.current];
    const name = this.names[r.player];
    const P = PLAYER[r.player];
    if (extra) { ui.setInstruction(extra); return; }
    ui.setInstruction(r.pending
      ? `Press <b>Check answer</b> when you're sure, or click the block to take it back.`
      : `<b class="${P.css}">${name}</b>: drag the partner of ${ui.rich(`[${r.template}]`)} into the glowing space on the ${P.sideName}`);
  }

  doneCount() { return this.rungs.filter(r => r.done).length; }

  progressColors() {
    return this.rungs.map(r => {
      if (!r.done) return null;
      const left = r.side === 0 ? r.answer : r.template;
      const right = r.side === 0 ? r.template : r.answer;
      return [BASES[left].color, BASES[right].color];
    });
  }

  lookAll(v) {
    this.cast.boy.lookAt(v);
    this.cast.girl.lookAt(v);
  }

  // ------------------------------------------------------------ placing
  place(letter, block = null) {
    if (this.state !== 'turn') return;
    const i = this.current;
    const r = this.rungs[i];
    if (r.pendingBlock) this.sendBack(this.ladder.detach(i, r.side));

    if (!block) {
      block = makeBlock(letter);
      this.tray.sourceWorld(letter, block.position);
      this.scene.add(block);
    }
    this.loose.add(block);
    r.pending = letter;
    r.pendingBlock = block;

    const from = block.position.clone();
    const to = this.ladder.slotWorld(i, r.side);
    const fromScale = block.scale.x;
    const gen = this.gen;
    sfx.pick();
    this.cast[r.player].setPose('reach', 0.9);
    tween({
      duration: 0.45, easing: ease.inOut,
      update: p => {
        block.position.lerpVectors(from, to, p);
        block.position.y += Math.sin(p * Math.PI) * 0.35;
        block.rotation.x = (1 - p) * 0.3;
        block.scale.setScalar(fromScale + (1 - fromScale) * p);
      },
      done: () => {
        if (!this.alive(gen) || r.pendingBlock !== block) return;
        this.loose.delete(block);
        this.ladder.attach(block, i, r.side);
        block.position.set(this.ladder.rungs[i].slots[r.side].x, 0, 0);
        block.rotation.set(0, 0, 0);
        block.scale.setScalar(1);
        sfx.place();
        this.squash(block);
      },
    });
    ui.setCheck(true);
    this.setTurnInstruction();
  }

  takeBack() {
    if (this.state !== 'turn') return;
    const r = this.rungs[this.current];
    if (!r.pendingBlock) return;
    this.sendBack(this.ladder.detach(this.current, r.side));
    r.pending = null;
    r.pendingBlock = null;
    ui.setCheck(false);
    this.setTurnInstruction();
  }

  squash(block) {
    tween({
      duration: 0.35, easing: ease.linear,
      update: p => {
        const s = 1 + Math.sin(p * Math.PI) * 0.12 * (1 - p);
        block.scale.set(s, 2 - s, s);
      },
      done: () => block.scale.setScalar(1),
    });
  }

  // fly a block back to its bin and remove it
  sendBack(block) {
    if (!block) return;
    if (block.parent !== this.scene) this.scene.attach(block);
    this.loose.add(block);
    const from = block.position.clone();
    const to = this.tray.sourceWorld(block.userData.letter);
    sfx.drop();
    tween({
      duration: 0.5, easing: ease.inOut,
      update: p => {
        block.position.lerpVectors(from, to, p);
        block.position.y += Math.sin(p * Math.PI) * 0.3;
        block.scale.setScalar(Math.max(0.01, 1 - p * 0.9));
      },
      done: () => { block.parent?.remove(block); this.loose.delete(block); },
    });
  }

  // ------------------------------------------------------------ checking
  async check() {
    if (this.state !== 'turn') return;
    const i = this.current;
    const r = this.rungs[i];
    const gen = this.gen;
    if (!r.pending) {
      this.speak(`Put a block in the glowing space first, then press Check answer.`, { tone: 'hint', pose: 'point' });
      return;
    }
    this.state = 'busy';
    ui.setCheck(false);
    this.tray.highlight(null);
    r.attempts++;
    const pos = this.screenOf(this.ladder.slotWorld(i, r.side));

    if (r.pending === r.answer) {
      const pts = r.hintUsed ? 3 : r.attempts === 1 ? 10 : r.attempts === 2 ? 6 : 3;
      if (r.attempts === 1 && !r.hintUsed) this.firstTry++;
      r.done = true;
      this.score += pts;
      this.points[r.player] += pts;
      ui.setScore(this.score);
      ui.setPlayerPoints(this.points.boy, this.points.girl);
      ui.pop(pos.x, pos.y, `+${pts}`);
      ui.setProgress(this.doneCount(), -1, this.progressColors());
      sfx.correct();
      this.ladder.setActive(null);
      this.glowRung(i);

      const other = r.player === 'boy' ? 'girl' : 'boy';
      this.cast[r.player].setPose('cheer', 1.6);
      this.cast[other].setPose('clap', 1.4);
      this.cast.teacher.setPose('clap', 1.2);

      const pairKey = r.answer === 'A' || r.answer === 'T' ? 'AT' : 'GC';
      let line = PRAISE[Math.floor(Math.random() * PRAISE.length)];
      if (!this.taughtBonds[pairKey]) {
        this.taughtBonds[pairKey] = true;
        line = pairKey === 'AT'
          ? `Yes! [A] and [T] are partners. See the 2 little bonds holding them together?`
          : `Correct! [G] and [C] are partners, held together by 3 bonds.`;
      }
      if (r.attempts > 1 && !r.hintUsed) line = `You got it! Trying again is what scientists do.`;
      this.speak(line, { tone: 'good' });
      ui.setInstruction(`<b class="${PLAYER[r.player].css}">${this.names[r.player]}</b> scored <b>+${pts}</b>!`);

      await wait(this.taughtBonds[pairKey] && line.includes('bond') ? 2.6 : 1.8);
      if (!this.alive(gen)) return;
      if (i + 1 < RUNGS) this.beginTurn(i + 1, gen);
      else this.finale(gen);
    } else {
      const wrong = r.pending;
      sfx.wrong();
      ui.pop(pos.x, pos.y, 'Try again!', 'warn');
      this.shake(r.pendingBlock);
      this.cast[r.player].setPose('oops', 1.6);
      this.cast.teacher.setPose('think', 2);
      const hint = this.hintFor(r, wrong);
      this.speak(hint, { tone: 'hint' });
      await wait(1.1);
      if (!this.alive(gen)) return;
      this.sendBack(this.ladder.detach(i, r.side));
      r.pending = null;
      r.pendingBlock = null;
      if (r.attempts >= 3) this.tray.highlight(r.answer);
      this.state = 'turn';
      this.setTurnInstruction(`Have another go, <b class="${PLAYER[r.player].css}">${this.names[r.player]}</b>! Find the partner of ${ui.rich(`[${r.template}]`)}.`);
    }
  }

  hintFor(r, wrong) {
    const t = r.template;
    if (r.attempts >= 3) return `Let me help: [${t}] always pairs with [${r.answer}]. Look for the bouncing block in the tray!`;
    if (wrong === 'U') return `That's [U], uracil. U is used in RNA, not DNA! Pick a DNA base instead: A, T, G or C.`;
    if (wrong === t) return `Two [${t}] blocks can't pair up. Every base needs a different partner!`;
    if (r.attempts === 2) return `So close! Remember: [A] goes with [T], and [G] goes with [C]. Which one belongs with [${t}]?`;
    return `Hmm, [${wrong}] pairs with [${BASES[wrong].partner}], not with [${t}]. Try again!`;
  }

  askTeacher() {
    if (this.state !== 'turn') return;
    const r = this.rungs[this.current];
    r.hintUsed = true;
    this.tray.highlight(r.answer);
    sfx.hint();
    this.speak(`Here's a clue: the partner of [${r.template}] is bouncing in the tray. You'll still earn 3 points!`, { tone: 'hint', pose: 'point' });
  }

  glowRung(i) {
    const rung = this.ladder.rungs[i];
    const blocks = rung.slots.map(s => s.block).filter(Boolean);
    const green = new THREE.Color(0x56ff5a);
    this.ladder.showBonds(i, this.rungs[i].answer);
    tween({
      duration: 2.2, easing: ease.linear,
      update: p => {
        // hold the glow for a moment so it's easy to see, then fade
        const k = p < 0.4 ? 1 : 1 - ease.inOut((p - 0.4) / 0.6);
        const pulse = 0.85 + 0.15 * Math.sin(p * 30);
        for (const b of blocks) setGlow(b, green, 1.4 * k * pulse);
        rung.halo.material.opacity = 0.9 * k;
        rung.shell.visible = k > 0.01;
        rung.shell.material.opacity = 0.95 * k;
        const s = 1 + Math.min(p * 3, 1) * 0.5;
        rung.halo.scale.set(1.7 * s, 0.75 * s, 1);
        rung.bonds.scale.set(1, Math.min(1, p * 6), Math.min(1, p * 6));
      },
      done: () => { for (const b of blocks) setGlow(b, 0x000000, 0); },
    });
    for (const b of blocks) this.squash(b);
  }

  shake(block) {
    if (!block) return;
    const x0 = block.position.x;
    setGlow(block, 0xff9f1c, 0.8);
    tween({
      duration: 0.6, easing: ease.linear,
      update: p => {
        block.position.x = x0 + Math.sin(p * Math.PI * 8) * 0.04 * (1 - p);
        block.rotation.z = Math.sin(p * Math.PI * 8) * 0.08 * (1 - p);
      },
      done: () => { block.position.x = x0; block.rotation.z = 0; },
    });
  }

  // ------------------------------------------------------------ finale
  async finale(gen) {
    this.state = 'finale';
    this.ladder.setActive(null);
    this.cast.boy.setActive(false);
    this.cast.girl.setActive(false);
    ui.setTurn(null);
    ui.showActions(false);
    ui.setProgress(RUNGS, -1, this.progressColors());
    const center = new THREE.Vector3(0, rungY(RUNGS / 2), FRAME_Z);
    this.lookAll(center);
    this.cast.teacher.lookAt(center);

    this.speak(`Every rung is matched! Now watch what real DNA does…`, { tone: 'good', pose: 'point', poseFor: 3 });
    await wait(2.4);
    if (!this.alive(gen)) return;

    ui.hideBubble();
    sfx.whoosh(3.6);
    this.rig.showcase();
    const L = this.ladder;
    tween({
      duration: 0.8, easing: ease.in,
      update: p => { L.posts.scale.set(1, 1 - p, 1); },
      done: () => { L.posts.visible = false; },
    });
    await tween({
      duration: 3.8, delay: 0.3, easing: ease.inOut,
      update: p => {
        L.twistT = p;
        L.group.position.y = p * 0.3;
        L.updateRails();
      },
    });
    if (!this.alive(gen)) return;

    this.rig.spin(true);
    sfx.fanfare();
    this.confetti.burst(new THREE.Vector3(0, rungY(RUNGS - 1) + 0.5, FRAME_Z));
    setTimeout(() => this.alive(gen) && this.confetti.burst(new THREE.Vector3(0, rungY(RUNGS - 1) + 0.6, FRAME_Z)), 700);
    L.rungs.forEach((_, i) => setTimeout(() => this.alive(gen) && this.sparkleRung(i), i * 90));
    this.cast.boy.setPose('cheer', 4);
    this.cast.girl.setPose('cheer', 4);
    this.cast.teacher.setPose('clap', 3);
    this.cast.teacher.lookAt(this.camera.position);
    this.speak(`Congratulations, ${this.names.boy} and ${this.names.girl}! You turned your ladder into a DNA double helix, the shape found inside living cells!`, { tone: 'good' });

    await wait(4.2);
    if (!this.alive(gen)) return;

    this.state = 'recap';
    ui.hideBubble();
    await this.runRecap();
    if (!this.alive(gen)) return;

    this.state = 'won';
    this.cast.teacher.stopTalking();
    hush();
    ui.showWin({
      names: [this.names.boy, this.names.girl],
      score: this.score,
      first: this.firstTry,
      total: RUNGS,
      fact: FACTS[Math.floor(Math.random() * FACTS.length)],
    });
  }

  // Teacher walks the class through what DNA is, while the helix keeps spinning.
  async runRecap(lastLabel) {
    ui.el.rules.classList.add('hidden');
    this.cast.teacher.lookAt(this.camera.position);
    const gen = this.gen;
    await openRecap({
      lastLabel,
      onPage: (page, spoken) => {
        sfx.pick();
        hush();
        say(spoken);
        this.cast.teacher.talk(Math.max(2, spoken.split(/\s+/).length * 0.32));
        this.cast.teacher.setPose(page.focus === 'why' ? 'wave' : 'explain', 3);
        this.focusPart(page.focus, gen);
      },
    });
    hush();
    this.cast.teacher.stopTalking();
    if (this.alive(gen)) ui.el.rules.classList.remove('hidden');
  }

  async reviewFacts() {
    if (this.state !== 'won') return;
    ui.hideWin();
    this.state = 'recap';
    const gen = this.gen;
    await this.runRecap('Back to results');
    if (!this.alive(gen)) return;
    this.state = 'won';
    ui.el.win.classList.remove('hidden');
  }

  // light up the part of the 3D model a recap page is talking about
  focusPart(focus, gen) {
    const L = this.ladder;
    if (focus === 'backbone') {
      tween({
        duration: 2.4, easing: ease.linear,
        update: p => {
          const k = Math.max(0, Math.sin(p * Math.PI * 3));
          L.beadMat.emissive.set(0xffffff); L.beadMat.emissiveIntensity = k * 0.45;
          L.sugarMat.emissive.set(0xffffff); L.sugarMat.emissiveIntensity = k * 0.45;
        },
        done: () => { L.beadMat.emissiveIntensity = 0; L.sugarMat.emissiveIntensity = 0; },
      });
    } else if (focus === 'helix' || focus === 'bases' || focus === 'copy') {
      const step = focus === 'copy' ? 70 : 120;
      L.rungs.forEach((_, i) => setTimeout(() => this.alive(gen) && this.state === 'recap' && this.sparkleRung(i), i * step));
    }
  }

  sparkleRung(i) {
    const rung = this.ladder.rungs[i];
    const blocks = rung.slots.map(s => s.block).filter(Boolean);
    sfx.sparkle();
    tween({
      duration: 1.2, easing: ease.out,
      update: p => {
        const k = Math.sin(p * Math.PI);
        rung.halo.material.opacity = k * 0.8;
        for (const b of blocks) setGlow(b, 0xffffff, k * 0.5);
      },
    });
  }

  // ------------------------------------------------------------ input
  screenOf(v) {
    const p = v.clone().project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height, behind: p.z > 1 };
  }

  setPointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  pickAt(e) {
    this.setPointer(e);
    const targets = this.tray.pickables();
    const r = this.current >= 0 ? this.rungs[this.current] : null;
    if (r?.pendingBlock && !this.loose.has(r.pendingBlock)) targets.push(r.pendingBlock.userData.body);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    return hit ? hit.object.userData.block : null;
  }

  bindInput() {
    // capture phase on the wrapper so a block grab never reaches OrbitControls
    this.canvas.parentElement.addEventListener('pointerdown', e => this.onDown(e), { capture: true });
    window.addEventListener('pointermove', e => this.onMove(e));
    window.addEventListener('pointerup', e => this.onUp(e));
    window.addEventListener('pointercancel', () => this.cancelDrag());
    window.addEventListener('keydown', e => this.onKey(e));
  }

  onDown(e) {
    if (this.state !== 'turn' || this.drag) return;
    const block = this.pickAt(e);
    if (!block) return;
    e.stopPropagation();
    e.preventDefault();
    this.controls.enabled = false;
    this.drag = {
      letter: block.userData.letter,
      isPending: !block.userData.source,
      sx: e.clientX, sy: e.clientY,
      block: null, near: false, id: e.pointerId,
    };
    if (!this.drag.isPending) sfx.pick();
  }

  onMove(e) {
    if (!this.drag) {
      if (this.state !== 'turn') { this.setHover(null); return; }
      const b = e.target === this.canvas ? this.pickAt(e) : null;
      this.setHover(b);
      return;
    }
    const d = this.drag;
    if (!d.block && !d.isPending && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) {
      d.block = makeBlock(d.letter);
      this.tray.sourceWorld(d.letter, d.block.position);
      d.block.scale.setScalar(1.1);
      this.scene.add(d.block);
      this.loose.add(d.block);
      this.canvas.parentElement.classList.add('dragging');
    }
    if (d.block) {
      this.setPointer(e);
      const hit = this.raycaster.ray.intersectPlane(this.dragPlane, this.tmp);
      if (hit) d.block.position.lerp(hit, 0.6);
      const r = this.rungs[this.current];
      const s = this.screenOf(this.ladder.slotWorld(this.current, r.side));
      d.near = Math.hypot(e.clientX - s.x, e.clientY - s.y) < Math.max(70, window.innerHeight * 0.09);
      d.block.rotation.z = d.near ? 0 : Math.sin(performance.now() / 120) * 0.06;
      d.block.scale.setScalar(d.near ? 1.0 : 1.1);
    }
  }

  onUp(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.controls.enabled = true;
    this.canvas.parentElement.classList.remove('dragging');
    if (this.state !== 'turn') { if (d.block) this.sendBack(d.block); return; }

    if (d.isPending) {
      // clicking the block sitting in the slot takes it back out
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 10) this.takeBack();
      return;
    }
    if (!d.block) { this.place(d.letter); return; }       // simple click
    if (d.near) { this.loose.delete(d.block); this.place(d.letter, d.block); return; }

    // dropped somewhere else: was it on the other player's side?
    const r = this.rungs[this.current];
    const other = this.screenOf(this.ladder.slotWorld(this.current, 1 - r.side));
    if (Math.hypot(e.clientX - other.x, e.clientY - other.y) < 70) {
      const P = PLAYER[r.player];
      this.speak(`Nice try, but your glowing space is on the ${P.sideName} side of the ladder.`, { tone: 'hint', pose: 'point' });
    }
    this.sendBack(d.block);
  }

  cancelDrag() {
    if (!this.drag) return;
    if (this.drag.block) this.sendBack(this.drag.block);
    this.drag = null;
    this.controls.enabled = true;
    this.canvas.parentElement.classList.remove('dragging');
  }

  setHover(block) {
    if (this.hovered === block) return;
    if (this.hovered) this.hovered.userData.hover = false;
    this.hovered = block;
    if (block) { block.userData.hover = true; sfx.hover(); }
    this.canvas.parentElement.classList.toggle('can-pick', !!block);
  }

  onKey(e) {
    if (e.target instanceof HTMLInputElement) return;
    if (this.state === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this.nextResolve?.();
      return;
    }
    if (this.state !== 'turn') return;
    const k = e.key.toUpperCase();
    if (LETTERS.includes(k)) { this.place(k); return; }
    if (e.key === 'Enter') { e.preventDefault(); this.check(); }
    if (e.key === 'Backspace' || e.key === 'Delete') this.takeBack();
  }
}
