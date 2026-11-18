// Draws the three small figures in the Research section. Each one is a
// schematic of the idea behind a paper, not a chart of results:
//
//   fig-remember.svg  facts leave a short window and are routed to weights,
//                     a record that only grows, or a screen that is rewritten
//   fig-think.svg     a batch of reasoning traces sharing one budget; some are
//                     confirmed early and stop, the rest are continued in order
//   fig-answer.svg    a video stream kept densely near the present and sparsely
//                     further back, with a confidence curve meeting a threshold
//
// Run:  node tools/build-figures.js

const fs = require('fs');
const path = require('path');

const INK = '#1a1a19';
const SOFT = '#8c8c85';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (v) => (Math.round(v * 10) / 10).toString();
const save = (name, body) => fs.writeFileSync(
  path.resolve(__dirname, '..', 'assets', `fig-${name}.svg`),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" fill="none" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`);
const label = (x, y, text, anchor = 'start') =>
  `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="Consolas, Menlo, monospace" font-size="8" letter-spacing=".8" fill="${SOFT}" stroke="none">${text}</text>`;
const sq = (x, y, s, filled) => `<rect x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${f(s)}" height="${f(s)}" ${filled ? `fill="${INK}" stroke="none"` : 'stroke-width=".8"'}/>`;

// ---------- what to remember ----------
(function () {
  const parts = [];
  // facts arriving one per step, oldest at the top
  const xs = 34, top = 22, step = 15.5, n = 11;
  for (let i = 0; i < n; i++) parts.push(sq(xs, top + i * step, 6.5, i < n - 2));
  // the history window holds only the last two
  const wy = top + (n - 2) * step - 8;
  parts.push(`<path stroke-width=".8" d="M${xs + 9} ${f(wy)}h5v${f(step + 16)}h-5"/>`);
  parts.push(label(xs + 19, wy + step / 2 + 11, 'WINDOW'));
  parts.push(label(xs - 14, 12, 'FACTS'));

  // three places a fact can live
  const places = [{ y: 40, name: 'WEIGHTS' }, { y: 100, name: 'RECORD' }, { y: 160, name: 'SCREEN' }];
  const from = [top + 1 * step, top + 4 * step, top + 7 * step];
  places.forEach((p, k) => {
    parts.push(`<path stroke-width=".7" d="M${xs + 6} ${f(from[k])}C${xs + 70} ${f(from[k])} 130 ${p.y} 186 ${p.y}"/>`);
    parts.push(`<path stroke-width=".7" d="M181 ${p.y - 3.5}L186 ${p.y}L181 ${p.y + 3.5}"/>`);
    parts.push(label(308, p.y - 22, p.name, 'end'));
  });
  // weights: a lattice of points
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) parts.push(`<circle cx="${198 + c * 12}" cy="${28 + r * 8}" r="1.3" fill="${INK}" stroke="none"/>`);
  // record: lines that are only ever added
  for (let r = 0; r < 5; r++) parts.push(`<path stroke-width="${r === 4 ? 1.6 : .8}" d="M198 ${86 + r * 7}h${[84, 62, 96, 50, 74][r]}"/>`);
  parts.push(`<path stroke-width=".9" d="M286 114h8M290 110v8"/>`);
  // screen: one frame, redrawn each step
  parts.push(`<rect x="198" y="146" width="96" height="30" rx="3" stroke-width=".9"/>`);
  parts.push(`<path stroke-width=".8" d="M206 155h52M206 161h34M206 167h44"/>`);
  parts.push(`<path stroke-width=".8" d="M300 153a9 9 0 1 1 -3 -7"/><path stroke-width=".8" d="M294.5 143.5l2.6 2.6l-3.6 .9"/>`);
  save('remember', parts.join(''));
})();

// ---------- how long to think ----------
(function () {
  const R = rng(8);
  const parts = [];
  const x0 = 20, opening = 46, rows = 9;
  const lens = [];
  for (let i = 0; i < rows; i++) lens.push(60 + R() * 215);
  lens.sort((a, b) => a - b);
  const stopEarly = [0, 1, 3, 6];
  lens.forEach((len, i) => {
    const y = 30 + i * 17.5;
    const early = stopEarly.includes(i);
    const end = early ? x0 + opening + 12 + R() * 26 : x0 + len;
    parts.push(`<path stroke-width="2" d="M${x0} ${f(y)}h${opening}"/>`);                       // the opening that is always read
    parts.push(`<path stroke-width="1.9" stroke-dasharray=".1 4.6" d="M${x0 + opening + 5} ${f(y)}H${f(end)}"/>`);
    if (early) {
      parts.push(`<circle cx="${f(end + 5)}" cy="${f(y)}" r="2.6" fill="${INK}" stroke="none"/>`);   // confirmed, stops here
      parts.push(`<path stroke="${SOFT}" stroke-width="1.3" stroke-dasharray=".1 4.6" d="M${f(end + 12)} ${f(y)}H${f(x0 + len)}"/>`);
    } else {
      parts.push(`<path stroke-width=".8" d="M${f(end + 3)} ${f(y - 3)}l4 3l-4 3"/>`);
    }
  });
  parts.push(`<path stroke="${SOFT}" stroke-width=".7" stroke-dasharray="3 3" d="M${x0 + opening + 2.5} 16V182"/>`);
  parts.push(label(x0, 12, 'OPENING'));
  parts.push(`<path stroke-width=".9" d="M302 20V182"/>`);
  parts.push(label(298, 12, 'BUDGET', 'end'));
  parts.push(label(x0, 195, 'ONE QUESTION PER LINE'));
  save('think', parts.join(''));
})();

// ---------- when to answer ----------
(function () {
  const R = rng(19);
  const parts = [];
  const x0 = 16, x1 = 300, base = 168;
  parts.push(`<path stroke-width=".8" d="M${x0} ${base}H${x1}"/>`);
  // frames: dense near the present, sparse further back
  const n = 26;
  for (let k = 0; k < n; k++) {
    const u = k / (n - 1);
    const x = x1 - (x1 - x0 - 8) * Math.pow(1 - u, 2.6) - 5;
    const h = 7 + 11 * Math.pow(u, 1.6);
    parts.push(`<rect x="${f(x - 3)}" y="${f(base - 3 - h)}" width="6" height="${f(h)}" stroke-width=".7"${u > .78 ? ` fill="${INK}"` : ''}/>`);
  }
  // confidence rising unevenly, and the threshold it has to reach
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const y = 122 - 78 * Math.pow(u, 1.5) + 7 * Math.sin(u * 17) * (1 - u * .5) + (R() - .5) * 3;
    pts.push([x0 + (x1 - x0) * u, y]);
  }
  const thr = (x) => 46 + 16 * (x - x0) / (x1 - x0);
  let hit = pts.findIndex((p, i) => i > 30 && p[1] <= thr(p[0]));
  if (hit < 0) hit = 55;
  parts.push(`<path stroke-width="1.1" d="${pts.slice(0, hit + 1).map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('')}"/>`);
  parts.push(`<path stroke="${SOFT}" stroke-width=".8" stroke-dasharray="3 3" d="M${x0} ${f(thr(x0))}L${x1} ${f(thr(x1))}"/>`);
  const h = pts[hit];
  parts.push(`<circle cx="${f(h[0])}" cy="${f(h[1])}" r="3" fill="${INK}" stroke="none"/>`);
  parts.push(`<path stroke-width=".7" d="M${f(h[0])} ${f(h[1] + 6)}V${base - 26}"/>`);
  parts.push(label(h[0] - 6, h[1] - 8, 'RESPOND', 'end'));
  parts.push(label(x0, thr(x0) - 6, 'THRESHOLD'));
  parts.push(label(x0, base + 16, 'EARLIER'));
  parts.push(label(x1, base + 16, 'NOW', 'end'));
  save('answer', parts.join(''));
})();

console.log('figures written');
