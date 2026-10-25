// End-of-game summary: six short pages about DNA, written for ages 11–13.
// Each page has a small drawing and a `focus` that the game uses to light up
// the matching part of the 3D helix.

import { rich, plain } from './ui.js';

const COL = { A: '#ff5a5f', T: '#ffc233', G: '#3b82f6', C: '#1fbf9a', sugar: '#bca4ff', phos: '#ff8a3d', ink: '#2a2140' };
const PAIRS = [['A', 'T'], ['G', 'C'], ['T', 'A'], ['C', 'G']];

const svg = (body, h = 120) => `<svg viewBox="0 0 260 ${h}" role="img" aria-hidden="true">${body}</svg>`;
const r1 = n => Math.round(n * 10) / 10;

function helixArt() {
  let rungs = '', s1 = '', s2 = '';
  for (let x = 12, k = 0; x <= 248; x += 4, k++) {
    const t = (x - 12) / 26;
    const y1 = 60 + 38 * Math.sin(t), y2 = 60 - 38 * Math.sin(t);
    s1 += `${k ? 'L' : 'M'}${x} ${r1(y1)}`;
    s2 += `${k ? 'L' : 'M'}${x} ${r1(y2)}`;
    if (k % 5 === 2) {
      const [a, b] = PAIRS[(k / 5 | 0) % 4];
      const mid = 60;
      rungs += `<line x1="${x}" y1="${r1(y1)}" x2="${x}" y2="${mid}" stroke="${COL[a]}" stroke-width="7" stroke-linecap="round"/>`;
      rungs += `<line x1="${x}" y1="${mid}" x2="${x}" y2="${r1(y2)}" stroke="${COL[b]}" stroke-width="7" stroke-linecap="round"/>`;
    }
  }
  return svg(`${rungs}<path d="${s1}" fill="none" stroke="${COL.sugar}" stroke-width="8" stroke-linecap="round"/>
    <path d="${s2}" fill="none" stroke="${COL.phos}" stroke-width="8" stroke-linecap="round"/>`);
}

function ladderArt() {
  let out = '';
  const top = 30, bot = 92;
  out += `<line x1="18" y1="${top}" x2="242" y2="${top}" stroke="#d9cdf7" stroke-width="6"/>`;
  out += `<line x1="18" y1="${bot}" x2="242" y2="${bot}" stroke="#d9cdf7" stroke-width="6"/>`;
  for (let i = 0; i < 6; i++) {
    const x = 36 + i * 38;
    const [a, b] = PAIRS[i % 4];
    out += `<rect x="${x - 9}" y="${top + 6}" width="18" height="${(bot - top) / 2 - 8}" rx="4" fill="${COL[a]}"/>`;
    out += `<rect x="${x - 9}" y="${(top + bot) / 2 + 2}" width="18" height="${(bot - top) / 2 - 8}" rx="4" fill="${COL[b]}"/>`;
  }
  for (let i = 0; i < 12; i++) {
    const x = 36 + i * 19;
    const fill = i % 2 ? COL.phos : COL.sugar;
    out += `<circle cx="${x}" cy="${top}" r="7" fill="${fill}"/><circle cx="${x}" cy="${bot}" r="7" fill="${fill}"/>`;
  }
  out += `<text x="130" y="14" text-anchor="middle" class="lbl">sugar + phosphate side</text>`;
  out += `<text x="130" y="116" text-anchor="middle" class="lbl">rungs = base pairs</text>`;
  return svg(out, 122);
}

function basesArt() {
  const chip = (L, x, y) => `<rect x="${x}" y="${y}" width="44" height="36" rx="9" fill="${COL[L]}"/>
    <text x="${x + 22}" y="${y + 27}" text-anchor="middle" class="big"${L === 'T' ? ` fill="${COL.ink}"` : ''}>${L}</text>`;
  const bonds = (n, y) => Array.from({ length: n }, (_, i) =>
    `<line x1="82" x2="120" y1="${y + 18 + (i - (n - 1) / 2) * 8}" y2="${y + 18 + (i - (n - 1) / 2) * 8}" stroke="${COL.ink}" stroke-width="3" stroke-dasharray="5 4"/>`).join('');
  return svg(`${chip('A', 34, 8)}${bonds(2, 8)}${chip('T', 124, 8)}
    ${chip('G', 34, 62)}${bonds(3, 62)}${chip('C', 124, 62)}
    <text x="214" y="32" text-anchor="middle" class="lbl">2 bonds</text>
    <text x="214" y="86" text-anchor="middle" class="lbl">3 bonds</text>`, 106);
}

function copyArt() {
  // left: zipped ladder. right: unzipped, each old half gets a new partner half (dashed)
  let out = '';
  const mid = 70, top = 44, bot = 96, slope = 0.27;
  for (let i = 0; i < 4; i++) {
    const x = 20 + i * 22;
    const [a, b] = PAIRS[i % 4];
    out += `<rect x="${x - 6}" y="${top + 4}" width="12" height="20" rx="3" fill="${COL[a]}"/><rect x="${x - 6}" y="${mid + 2}" width="12" height="20" rx="3" fill="${COL[b]}"/>`;
  }
  out += `<path d="M10 ${top}H100L250 ${r1(top - 150 * slope)}" fill="none" stroke="${COL.sugar}" stroke-width="5"/>`;
  out += `<path d="M10 ${bot}H100L250 ${r1(bot + 150 * slope)}" fill="none" stroke="${COL.phos}" stroke-width="5"/>`;
  for (let i = 0; i < 4; i++) {
    const x = 134 + i * 28;
    const [a, b] = PAIRS[(i + 1) % 4];
    const ty = top - (x - 100) * slope;   // old top strand at this x
    const by = bot + (x - 100) * slope;   // old bottom strand
    out += `<rect x="${x - 6}" y="${r1(ty + 3)}" width="12" height="13" rx="3" fill="${COL[a]}"/>`;
    out += `<rect x="${x - 6}" y="${r1(ty + 17)}" width="12" height="13" rx="3" fill="${COL[b]}" opacity=".55" stroke="${COL.ink}" stroke-dasharray="3 2"/>`;
    out += `<rect x="${x - 6}" y="${r1(by - 16)}" width="12" height="13" rx="3" fill="${COL[b]}"/>`;
    out += `<rect x="${x - 6}" y="${r1(by - 30)}" width="12" height="13" rx="3" fill="${COL[a]}" opacity=".55" stroke="${COL.ink}" stroke-dasharray="3 2"/>`;
  }
  out += `<text x="56" y="124" text-anchor="middle" class="lbl">old DNA</text>`;
  out += `<text x="100" y="${mid + 5}" class="lbl">unzips</text>`;
  out += `<rect x="14" y="6" width="12" height="10" rx="2" fill="#ddd" stroke="${COL.ink}" stroke-dasharray="3 2"/>`;
  out += `<text x="31" y="15" class="lbl">= new half</text>`;
  return svg(out, 142);
}

function cellArt() {
  const x = (cx, cy, c) => `<g stroke="${c}" stroke-width="5" stroke-linecap="round"><line x1="${cx - 6}" y1="${cy - 9}" x2="${cx + 6}" y2="${cy + 9}"/><line x1="${cx + 6}" y1="${cy - 9}" x2="${cx - 6}" y2="${cy + 9}"/></g>`;
  return svg(`<ellipse cx="110" cy="60" rx="96" ry="52" fill="#d8f2c8" stroke="#4c9a3b" stroke-width="4"/>
    <circle cx="110" cy="60" r="32" fill="#e7d6ff" stroke="#7b4cb3" stroke-width="4"/>
    ${x(98, 52, COL.A)}${x(120, 50, COL.G)}${x(104, 72, COL.C)}${x(124, 70, COL.T)}
    <ellipse cx="44" cy="40" rx="10" ry="6" fill="#ff9f6b"/><ellipse cx="170" cy="86" rx="11" ry="6" fill="#ff9f6b"/>
    <path d="M142 48 L204 22" stroke="${COL.ink}" stroke-width="2"/>
    <text x="232" y="20" text-anchor="middle" class="lbl">nucleus</text>
    <text x="232" y="104" text-anchor="middle" class="lbl">cell</text>`);
}

function recipeArt() {
  let helix = '';
  for (let y = 22; y <= 98; y += 2) {
    const t = (y - 22) / 9;
    helix += `${y === 22 ? 'M' : 'L'}${r1(78 + Math.sin(t) * 16)} ${y}`;
  }
  let helix2 = '';
  for (let y = 22; y <= 98; y += 2) {
    const t = (y - 22) / 9;
    helix2 += `${y === 22 ? 'M' : 'L'}${r1(78 - Math.sin(t) * 16)} ${y}`;
  }
  const lines = [30, 44, 58, 72, 86].map((y, i) => `<line x1="146" y1="${y}" x2="${i % 2 ? 196 : 210}" y2="${y}" stroke="#cdbfa6" stroke-width="5" stroke-linecap="round"/>`).join('');
  return svg(`<path d="M130 14 C100 6 60 6 30 14 V106 C60 98 100 98 130 106Z" fill="#fff" stroke="${COL.ink}" stroke-width="3"/>
    <path d="M130 14 C160 6 200 6 230 14 V106 C200 98 160 98 130 106Z" fill="#fff" stroke="${COL.ink}" stroke-width="3"/>
    <path d="${helix}" fill="none" stroke="${COL.sugar}" stroke-width="5"/><path d="${helix2}" fill="none" stroke="${COL.phos}" stroke-width="5"/>
    ${lines}`);
}

export const PAGES = [
  {
    title: 'DNA is a double helix',
    text: `DNA looks like a ladder that has been twisted, just like the one you built! This shape is called a **double helix**. "Double" means two strands, and "helix" means a spiral.`,
    art: helixArt, focus: 'helix',
  },
  {
    title: 'Sides and rungs',
    text: `The two sides of the ladder are long chains of **sugar** and **phosphate** (the purple and orange beads). The rungs in the middle are pairs of **bases**.`,
    art: ladderArt, focus: 'backbone',
  },
  {
    title: 'The four bases',
    text: `DNA has four bases: [A] adenine, [T] thymine, [G] guanine and [C] cytosine. They always pair the same way: [A] with [T], and [G] with [C]. [U] is only found in RNA.`,
    art: basesArt, focus: 'bases',
  },
  {
    title: 'How new DNA is made',
    text: `Before a cell divides, the DNA ladder **unzips** down the middle. Each half is used as a pattern to build a new matching half. That makes two copies that are exactly the same. That's what you did today: you matched new bases to the ones already there!`,
    art: copyArt, focus: 'copy',
  },
  {
    title: 'Where DNA is found',
    text: `DNA is inside almost every cell in your body, in the cell's control centre, the **nucleus**. It is packed tightly into **chromosomes**. Humans have 46 of them. Plants, animals and even tiny bacteria have DNA too.`,
    art: cellArt, focus: 'cell',
  },
  {
    title: 'Why DNA matters',
    text: `DNA is like a **recipe book** for life. The order of its bases gives the instructions for how a living thing grows, works and looks, like the colour of your eyes. Parents pass DNA to their children, which is why family members often look alike.`,
    art: recipeArt, focus: 'why',
  },
];

const $ = id => document.getElementById(id);
let session = null;

// Opens the summary. Resolves when the last page is finished or it's skipped.
export function openRecap({ onPage, lastLabel = 'See my results' } = {}) {
  closeRecap();
  const root = $('recap');
  const dots = $('recap-dots');
  dots.innerHTML = PAGES.map(() => '<span></span>').join('');
  root.classList.remove('hidden');

  return new Promise(resolve => {
    let page = 0;
    const show = i => {
      page = i;
      const p = PAGES[i];
      $('recap-step').textContent = `${i + 1} / ${PAGES.length}`;
      $('recap-title').textContent = p.title;
      $('recap-text').innerHTML = rich(p.text);
      $('recap-art').innerHTML = p.art();
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k <= i));
      $('recap-back').disabled = i === 0;
      $('recap-next').textContent = i === PAGES.length - 1 ? lastLabel : 'Next';
      const card = root.querySelector('.recap-card');
      card.classList.remove('turn');
      void card.offsetWidth;
      card.classList.add('turn');
      onPage?.(p, plain(p.text));
    };
    const finish = () => { closeRecap(); resolve(); };
    const next = () => (page < PAGES.length - 1 ? show(page + 1) : finish());
    const back = () => page > 0 && show(page - 1);
    const key = e => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') back();
      else if (e.key === 'Escape') finish();
    };

    $('recap-next').onclick = next;
    $('recap-back').onclick = back;
    $('recap-skip').onclick = finish;
    window.addEventListener('keydown', key);
    session = { key };
    show(0);
  });
}

export function closeRecap() {
  $('recap').classList.add('hidden');
  if (session) window.removeEventListener('keydown', session.key);
  session = null;
}
