// DOM side of the game: HUD, speech bubble, popups and the full-screen cards.

const $ = id => document.getElementById(id);

const el = {
  hud: $('hud'), progress: $('progress'), rules: $('rules'), actions: $('actions'),
  score: $('score'), pillBoy: $('pill-boy'), pillGirl: $('pill-girl'),
  track: $('progress-track'), count: $('progress-count'),
  instruction: $('instruction'), check: $('btn-check'), hint: $('btn-hint'),
  bubble: $('bubble'), bubbleText: document.querySelector('#bubble .bubble-text'),
  bubbleActions: document.querySelector('#bubble .bubble-actions'),
  next: $('bubble-next'), skip: $('bubble-skip'),
  tagBoy: $('tag-boy'), tagGirl: $('tag-girl'), pops: $('pops'),
  title: $('title-screen'), start: $('btn-start'), loading: $('loading'),
  nameBoy: $('name-boy'), nameGirl: $('name-girl'),
  win: $('win-screen'), help: $('help-screen'), confirm: $('confirm-screen'),
  sound: $('btn-sound'), voice: $('btn-voice'),
};
export { el };

// "[A]" in teacher lines becomes a coloured letter chip
function segments(text) {
  const out = [];
  const re = /\[([ATGCU])\]|\*\*(.+?)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    if (m[1]) out.push({ chip: m[1] });
    else out.push({ t: m[2], bold: true });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function renderSegments(segs, limit = Infinity) {
  let html = '', n = 0;
  for (const s of segs) {
    if (n >= limit) break;
    if (s.chip) { html += `<span class="b ${s.chip}">${s.chip}</span>`; n++; continue; }
    const take = s.t.slice(0, Math.max(0, limit - n));
    html += s.bold ? `<b>${esc(take)}</b>` : esc(take);
    n += take.length;
  }
  return { html, total: segs.reduce((a, s) => a + (s.chip ? 1 : s.t.length), 0) };
}

export const plain = text => text.replace(/\[([ATGCU])\]/g, '$1').replace(/\*\*/g, '');
export const rich = text => renderSegments(segments(text)).html;

let typer = null;
let typeTick = null;

export function showBubble(text, { tone = '', intro = false, onType } = {}) {
  el.bubble.classList.remove('hidden', 'tone-good', 'tone-hint');
  if (tone) el.bubble.classList.add('tone-' + tone);
  // restart the pop-in animation
  el.bubble.style.animation = 'none';
  void el.bubble.offsetWidth;
  el.bubble.style.animation = '';
  el.bubbleActions.classList.toggle('none', !intro);

  const segs = segments(text);
  const { total } = renderSegments(segs);
  let shown = 0;
  clearInterval(typer);
  typeTick = onType;
  const step = () => {
    shown = Math.min(total, shown + 2);
    el.bubbleText.innerHTML = renderSegments(segs, shown).html;
    if (shown % 6 === 0 && typeTick) typeTick();
    if (shown >= total) clearInterval(typer);
  };
  step();
  typer = setInterval(step, 28);
}

export function hideBubble() {
  clearInterval(typer);
  el.bubble.classList.add('hidden');
}

const lastPos = { x: -1e4, y: -1e4, w: 0 };
export function placeBubble(x, y) {
  if (el.bubble.classList.contains('hidden')) return;
  const w = el.bubble.offsetWidth, h = el.bubble.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  // small screens: pin under the HUD instead of following the teacher
  if (vw < 700) {
    el.bubble.style.translate = `${(vw - w) / 2}px ${vw < 600 ? 112 : 96}px`;
    el.bubble.style.setProperty('--tail', '-100px');
    return;
  }
  let left = x - w * 0.22;
  let top = y - h - 26;
  left = Math.max(12, Math.min(vw - w - 12, left));
  top = Math.max(180, Math.min(vh - h - 110, top));
  left = Math.round(left); top = Math.round(top);
  if (Math.abs(left - lastPos.x) > 4 || Math.abs(top - lastPos.y) > 4 || lastPos.w !== w) {
    lastPos.x = left; lastPos.y = top; lastPos.w = w;
    el.bubble.style.translate = `${left}px ${top}px`;
  }
  const tail = Math.max(24, Math.min(w - 24, x - lastPos.x));
  el.bubble.style.setProperty('--tail', tail + 'px');
}

export function placeTag(tag, x, y, visible = true) {
  tag.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  tag.classList.toggle('off', !visible);
}

export function pop(x, y, text, cls = '') {
  const d = document.createElement('div');
  d.className = 'pop ' + cls;
  d.textContent = text;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  el.pops.appendChild(d);
  setTimeout(() => d.remove(), 1500);
}

let shownScore = 0;
let scoreAnim = null;
export function setScore(value, animate = true) {
  cancelAnimationFrame(scoreAnim);
  if (!animate) { shownScore = value; el.score.textContent = value; return; }
  el.score.classList.remove('bump');
  void el.score.offsetWidth;
  el.score.classList.add('bump');
  const from = shownScore, t0 = performance.now();
  const tick = now => {
    const p = Math.min(1, (now - t0) / 500);
    shownScore = Math.round(from + (value - from) * p);
    el.score.textContent = shownScore;
    if (p < 1) scoreAnim = requestAnimationFrame(tick);
  };
  scoreAnim = requestAnimationFrame(tick);
}

export function setNames(boy, girl) {
  el.pillBoy.querySelector('.pill-name').textContent = boy;
  el.pillGirl.querySelector('.pill-name').textContent = girl;
  el.tagBoy.querySelector('.nt-name').textContent = boy;
  el.tagGirl.querySelector('.nt-name').textContent = girl;
}

export function setPlayerPoints(boy, girl) {
  el.tagBoy.querySelector('.nt-pts').textContent = boy;
  el.tagGirl.querySelector('.nt-pts').textContent = girl;
}

export function setTurn(player) {
  el.pillBoy.classList.toggle('active', player === 'boy');
  el.pillGirl.classList.toggle('active', player === 'girl');
}

export function buildProgress(n) {
  el.track.style.setProperty('--n', n);
  el.track.innerHTML = '';
  for (let i = 0; i < n; i++) el.track.appendChild(document.createElement('span'));
  el.count.textContent = `0 / ${n}`;
}

export function setProgress(done, current, colors) {
  const spans = el.track.children;
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    s.classList.toggle('current', i === current);
    if (colors[i]) {
      s.classList.add('done');
      s.style.setProperty('--l', colors[i][0]);
      s.style.setProperty('--r', colors[i][1]);
    } else {
      s.classList.remove('done');
    }
  }
  el.count.textContent = `${done} / ${spans.length}`;
}

export function setInstruction(html) { el.instruction.innerHTML = html; }

export function setCheck(enabled) {
  el.check.disabled = !enabled;
  el.check.classList.toggle('ready', enabled);
}

export function setPlaying(on) {
  for (const n of [el.hud, el.progress, el.rules, el.actions]) n.classList.toggle('hidden', !on);
  document.getElementById('tags').classList.toggle('hidden', !on);
}

export function showActions(on) {
  el.actions.classList.toggle('hidden', !on);
}

export function showTitle(on) { el.title.classList.toggle('hidden', !on); }

export function showWin({ names, score, first, total, fact }) {
  const stars = first >= total - 1 ? 3 : first >= Math.ceil(total / 2) ? 2 : 1;
  const starEls = document.querySelectorAll('#stars i');
  starEls.forEach((s, i) => {
    s.classList.toggle('on', i < stars);
    s.style.animation = 'none';
    void s.offsetWidth;
    s.style.animation = '';
  });
  $('win-names').textContent = `Brilliant teamwork, ${names[0]} and ${names[1]}!`;
  $('win-score').textContent = score;
  $('win-first').textContent = `${first}/${total}`;
  $('win-fact').textContent = fact;
  el.win.classList.remove('hidden');
}

export function hideWin() {
  el.win.classList.add('hidden');
  document.body.classList.remove('admiring');
  document.getElementById('admire-back')?.remove();
}

export function toggleModal(node, on) { node.classList.toggle('hidden', !on); }
